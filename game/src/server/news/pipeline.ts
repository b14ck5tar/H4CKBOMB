import "server-only";
import { createHash } from "node:crypto";
import type { QuestSeed } from "@/lib/types";
import {
  HOME,
  LOCALITY_RANK,
  RSS_FEEDS,
  dedupe,
  fetchArticleFacts,
  fetchRss,
  fetchSerpApi,
  fetchSerpApiFixture,
  locality,
  normalizeTitle,
  type Locality,
  type NewsItem,
} from "./sources";
import {
  accepted,
  hardMatch,
  softMatch,
  stageA,
  stageB,
  storyRating,
  type Candidate,
  type Classification,
  type StageAResult,
} from "./filter";
import { isQuestSeed, transformToQuest } from "./transform";

// fetch → dedupe → Stage A → local-first pick → enrich → Stage B (+ rating) → transform (+ Stage C) → QuestSeed[].
// Source: design/02-news-to-quest.md. Never throws: any failure returns [].
// Every quest carries a `rating` (youngest group it suits); /api/news filters by it AFTER the
// cache, so one run (2 SerpApi searches when live) serves kids, teens and adults alike.
// More quests per run come from classifying more of the items we already fetch (SerpApi + free
// RSS), never from extra searches: the SerpApi cost per run is unchanged.
// Local-first: stories from the home city (HOME, default Austin, Texas) come first, then its state,
// then national. The same safety filter and rating rules apply to every tier.

const LOCAL_SLOTS = 12; // of the candidates sent to Stage B, up to this many are reserved for city/state stories
const CLASSIFY_TOP = 20; // candidates sent to Stage B
const CLASSIFY_BATCH = 10; // per Stage B call; batches run in parallel, so one slow/failed call doesn't sink the run
const ENRICH_TOP = 12; // og:description fetches (free)
const WANT = 10; // quests to return (all ratings together)
const MAX_MUSE_CALLS = 16; // hard cap per run: 2 classify + 10 transforms + a few Stage C retries
const DEADLINE_MS = 105_000; // the route has maxDuration = 120
const CACHE_TTL_MS = 4 * 3600 * 1000;

export interface PipelineStats {
  live: boolean;
  fetched: Record<string, number>;
  deduped: number;
  stageA: number;
  enriched: number;
  classified: number;
  home: string;
  accepted: { title: string; category: string; tone: string; fun: number; rating: string; locality: Locality }[];
  rejected: { title: string; reason: string }[];
  museCalls: number;
  ms: number;
  error?: string;
}

export function isLiveNews() {
  return process.env.NEWS_LIVE === "1" || process.env.VERCEL === "1";
}

export function questId(title: string) {
  return `news-${createHash("sha1").update(normalizeTitle(title)).digest("hex").slice(0, 10)}`;
}

async function fetchAll(live: boolean, stats: PipelineStats): Promise<NewsItem[]> {
  const serp = live
    ? Promise.all([fetchSerpApi("science"), fetchSerpApi("local")]).then((r) => r.flat()) // the only 2 SerpApi searches
    : fetchSerpApiFixture();
  const [serpItems, ...rss] = await Promise.all([serp, ...RSS_FEEDS.map(fetchRss)]);
  stats.fetched[live ? "serpapi" : "serpapi_fixture"] = serpItems.length;
  RSS_FEEDS.forEach((f, i) => (stats.fetched[f.name] = rss[i].length));
  // Priority order for dedupe: SerpApi (direct links + thumbnails) → local station + BBC (real snippets) → Google News RSS.
  const kind = (k: string) => rss.filter((_, i) => RSS_FEEDS[i].kind === k).flat();
  return [...serpItems, ...kind("local"), ...kind("bbc"), ...kind("gnews")];
}

const rankOf = (text: string) => LOCALITY_RANK[locality(text)];

/**
 * Local-first candidate list: up to LOCAL_SLOTS city/state stories (city first, then by Stage A score),
 * then the best of everything else. Local stories never take every slot, so a day of local news that
 * is all crime or politics (rejected later) can't starve the run of national stories.
 */
function localFirst(list: StageAResult[], n: number): StageAResult[] {
  const tiered = list.map((r) => ({ r, tier: rankOf(`${r.item.title} ${r.item.snippet}`) }));
  const local = tiered
    .filter((x) => x.tier < LOCALITY_RANK.national && x.r.score > 0)
    .sort((a, b) => a.tier - b.tier || b.r.score - a.r.score)
    .slice(0, LOCAL_SLOTS);
  const rest = tiered.filter((x) => !local.includes(x)); // already sorted by score (stageA)
  return [...local, ...rest].slice(0, n).map((x) => x.r);
}

/** Where an accepted story happens, using everything we know (including the classifier's location). */
function storyLocality(c: Candidate, cls: Classification): Locality {
  return locality(`${c.item.title} ${c.item.snippet} ${c.facts} ${cls.location}`);
}

/**
 * Pick up to n: home city first, then state, then national (locality always wins). Within a tier,
 * highest fun first, preferring categories not picked yet.
 */
function pickDiverse<T extends { cls: Classification; c: Candidate; tier: number }>(list: T[], n: number): T[] {
  const out: T[] = [];
  const cats = new Set<string>();
  for (const tier of [...new Set(list.map((x) => x.tier))].sort((a, b) => a - b)) {
    const sorted = list.filter((x) => x.tier === tier).sort((a, b) => b.cls.fun_score - a.cls.fun_score || b.c.score - a.c.score);
    const fresh: T[] = [];
    for (const x of sorted) {
      if (cats.has(x.cls.category)) continue;
      fresh.push(x);
      cats.add(x.cls.category);
    }
    for (const x of [...fresh, ...sorted.filter((x) => !fresh.includes(x))]) if (out.length < n) out.push(x);
  }
  return out;
}

/** Stage B in parallel batches. Throws only if every batch fails (same contract as one stageB call). */
async function classifyAll(cands: Candidate[], stats: PipelineStats): Promise<Map<number, Classification>> {
  const batches: Candidate[][] = [];
  for (let i = 0; i < cands.length; i += CLASSIFY_BATCH) batches.push(cands.slice(i, i + CLASSIFY_BATCH));
  stats.museCalls += batches.length;
  const settled = await Promise.allSettled(batches.map((b) => stageB(b)));
  const out = new Map<number, Classification>();
  settled.forEach((s, b) => {
    if (s.status === "fulfilled") for (const [i, cls] of s.value) out.set(b * CLASSIFY_BATCH + i, cls);
    else console.warn(`[news] stage B batch ${b} failed: ${(s.reason as Error)?.message}`);
  });
  if (batches.length && settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
  return out;
}

/** Pushes finished quests into `quests` as they complete, so a deadline still keeps the finished ones. */
async function run(stats: PipelineStats, quests: QuestSeed[]): Promise<QuestSeed[]> {
  const t0 = Date.now();
  const live = stats.live;

  // FETCH + DEDUPE
  const all = dedupe(await fetchAll(live, stats));
  stats.deduped = all.length;

  // STAGE A
  const a = stageA(all, { ignoreAgeFor: (i) => !live && i.origin === "serpapi_fixture" });
  stats.stageA = a.length;
  if (!a.length) return [];

  // ENRICH the top few with a direct publisher link, then re-run the regexes on the new text.
  const top = localFirst(a, CLASSIFY_TOP + 4).map((r) => ({ ...r, facts: "" }) as Candidate);
  const toEnrich = top.filter((c) => !/news\.google\.com/.test(c.item.link)).slice(0, ENRICH_TOP);
  await Promise.all(
    toEnrich.map(async (c) => {
      c.facts = await fetchArticleFacts(c.item.link);
      if (c.facts) stats.enriched++;
    }),
  );
  const cands = top
    .filter((c) => {
      const hit = c.facts && hardMatch(c.facts);
      if (hit) stats.rejected.push({ title: c.item.title, reason: `stage A (article text): ${hit}` });
      return !hit;
    })
    .map((c) => {
      const soft = c.facts && !c.flags.length ? softMatch(c.facts) : null;
      return soft ? { ...c, flags: [...c.flags, `needs_casualty_check (${soft})`] } : c;
    })
    .slice(0, CLASSIFY_TOP);

  // STAGE B (batched calls) + rating. Rejections are unchanged; the rating only sorts accepted stories by audience.
  const classes = await classifyAll(cands, stats);
  stats.classified = classes.size;
  const ok: { c: Candidate; cls: Classification; tier: number }[] = [];
  cands.forEach((c, i) => {
    const raw = classes.get(i);
    if (!raw) return;
    const cls: Classification = { ...raw, rating: storyRating(raw, c) };
    if (accepted(cls)) {
      const where = storyLocality(c, cls);
      ok.push({ c, cls, tier: LOCALITY_RANK[where] });
      stats.accepted.push({ title: c.item.title, category: cls.category, tone: cls.tone, fun: cls.fun_score, rating: cls.rating, locality: where });
    } else {
      stats.rejected.push({ title: c.item.title, reason: `stage B: ${cls.usable ? `${cls.tone}, fun ${cls.fun_score}` : cls.reason}` });
    }
  });
  if (!ok.length) return [];

  // TRANSFORM (+ Stage C lint inside), in parallel; refill from the bench if some fail.
  let bench = pickDiverse(ok, ok.length);
  // Quests finish in any order; keep the array in local-first pick order (so a deadline snapshot is ordered too).
  const order = new Map(bench.map((x, i) => [questId(x.c.item.title), i]));
  const place = (q: QuestSeed) => {
    quests.push(q);
    quests.sort((x, y) => (order.get(x.id) ?? 99) - (order.get(y.id) ?? 99));
  };
  while (quests.length < WANT && bench.length && Date.now() - t0 < DEADLINE_MS - 60_000) {
    const room = MAX_MUSE_CALLS - stats.museCalls;
    const n = Math.min(WANT - quests.length, bench.length, room);
    if (n <= 0) break;
    const batch = bench.slice(0, n);
    bench = bench.slice(n);
    const retries = Math.max(0, Math.min(2, Math.floor((MAX_MUSE_CALLS - stats.museCalls - n) / n)));
    await Promise.all(
      batch.map(({ c, cls }) =>
        transformToQuest(c.item, c.facts, cls, questId(c.item.title), {
          maxRetries: retries, // retries only while the run-wide budget allows
          onCall: () => stats.museCalls++,
        })
          .then((q) => {
            if (q && isQuestSeed(q) && quests.length < WANT && !quests.some((x) => x.id === q.id)) place(q);
          })
          .catch((e) => {
            console.warn(`[news] transform failed for "${c.item.title}": ${(e as Error).message}`);
          }),
      ),
    );
  }
  return quests;
}

// ---------------------------------------------------------------- cache + public API

// v2: quests carry `rating`. A new global key so a dev server's hot reload never serves v1 (unrated) quests.
type Cache = { at: number; quests: QuestSeed[]; stats: PipelineStats } | null;
const g = globalThis as unknown as { __newsCacheV2?: Cache; __newsInflightV2?: Promise<{ quests: QuestSeed[]; stats: PipelineStats }> };

/** Full run with stats (for debugging). Never throws. Non-empty results are memoized for 4h per server instance. */
export async function getTodaysQuestsDetailed(opts: { fresh?: boolean } = {}): Promise<{ quests: QuestSeed[]; stats: PipelineStats }> {
  const c = g.__newsCacheV2;
  if (!opts.fresh && c && Date.now() - c.at < CACHE_TTL_MS) return { quests: c.quests, stats: c.stats };
  if (g.__newsInflightV2) return g.__newsInflightV2;

  const stats: PipelineStats = {
    live: isLiveNews(),
    home: HOME.label,
    fetched: {},
    deduped: 0,
    stageA: 0,
    enriched: 0,
    classified: 0,
    accepted: [],
    rejected: [],
    museCalls: 0,
    ms: 0,
  };
  const t0 = Date.now();
  g.__newsInflightV2 = (async () => {
    const done: QuestSeed[] = []; // run() pushes finished quests here as they complete
    let quests: QuestSeed[] = [];
    try {
      quests = await Promise.race([
        run(stats, done),
        new Promise<QuestSeed[]>((_, rej) => setTimeout(() => rej(new Error("pipeline deadline")), DEADLINE_MS)),
      ]);
    } catch (e) {
      stats.error = (e as Error).message;
      console.warn(`[news] pipeline failed: ${stats.error}${done.length ? ` (keeping ${done.length} finished quests)` : ""}`);
      quests = [...done]; // a deadline keeps what already finished; a Stage B failure leaves this empty
    }
    stats.ms = Date.now() - t0;
    console.log(`[news] pipeline: ${quests.length} quests, ${stats.museCalls} muse calls, ${stats.ms}ms`);
    if (quests.length) g.__newsCacheV2 = { at: Date.now(), quests, stats };
    return { quests, stats };
  })().finally(() => {
    g.__newsInflightV2 = undefined;
  });
  return g.__newsInflightV2;
}

/** Today's news as 0–10 rated QuestSeeds (ids `news-<hash>`), all ratings. Never throws; returns [] on any failure. */
export async function getTodaysQuests(): Promise<QuestSeed[]> {
  try {
    return (await getTodaysQuestsDetailed()).quests;
  } catch {
    return [];
  }
}
