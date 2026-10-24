import "server-only";
import { createHash } from "node:crypto";
import type { QuestSeed } from "@/lib/types";
import {
  RSS_FEEDS,
  dedupe,
  fetchArticleFacts,
  fetchRss,
  fetchSerpApi,
  fetchSerpApiFixture,
  normalizeTitle,
  type NewsItem,
} from "./sources";
import { accepted, hardMatch, softMatch, stageA, stageB, type Candidate, type Classification } from "./filter";
import { isQuestSeed, transformToQuest } from "./transform";

// fetch → dedupe → Stage A → enrich → Stage B → transform (+ Stage C) → QuestSeed[].
// Source: design/02-news-to-quest.md. Never throws: any failure returns [].

const CLASSIFY_TOP = 12; // candidates sent to the (single, batched) Stage B call
const ENRICH_TOP = 8; // og:description fetches
const WANT = 3; // quests to return
const MAX_MUSE_CALLS = 9; // hard cap per run: 1 classify + transforms + Stage C retries
const DEADLINE_MS = 105_000; // the route has maxDuration = 120
const CACHE_TTL_MS = 4 * 3600 * 1000;

export interface PipelineStats {
  live: boolean;
  fetched: Record<string, number>;
  deduped: number;
  stageA: number;
  enriched: number;
  classified: number;
  accepted: { title: string; category: string; tone: string; fun: number }[];
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
    ? Promise.all([fetchSerpApi("science"), fetchSerpApi("search")]).then((r) => r.flat())
    : fetchSerpApiFixture();
  const [serpItems, ...rss] = await Promise.all([serp, ...RSS_FEEDS.map(fetchRss)]);
  stats.fetched[live ? "serpapi" : "serpapi_fixture"] = serpItems.length;
  RSS_FEEDS.forEach((f, i) => (stats.fetched[f.name] = rss[i].length));
  // Priority order for dedupe: SerpApi (direct links + thumbnails) → BBC (real snippets) → Google News RSS.
  const bbc = rss.filter((_, i) => RSS_FEEDS[i].kind === "bbc").flat();
  const gn = rss.filter((_, i) => RSS_FEEDS[i].kind === "gnews").flat();
  return [...serpItems, ...bbc, ...gn];
}

/** Pick up to n, highest fun first, preferring distinct categories. */
function pickDiverse<T extends { cls: Classification; c: Candidate }>(list: T[], n: number): T[] {
  const sorted = [...list].sort((a, b) => b.cls.fun_score - a.cls.fun_score || b.c.score - a.c.score);
  const out: T[] = [];
  const cats = new Set<string>();
  for (const x of sorted) {
    if (out.length < n && !cats.has(x.cls.category)) {
      out.push(x);
      cats.add(x.cls.category);
    }
  }
  for (const x of sorted) if (out.length < n && !out.includes(x)) out.push(x);
  return out;
}

async function run(stats: PipelineStats): Promise<QuestSeed[]> {
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
  const top = a.slice(0, CLASSIFY_TOP + 4).map((r) => ({ ...r, facts: "" }) as Candidate);
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

  // STAGE B (one batched call)
  stats.museCalls++;
  const classes = await stageB(cands);
  stats.classified = classes.size;
  const ok: { c: Candidate; cls: Classification }[] = [];
  cands.forEach((c, i) => {
    const cls = classes.get(i);
    if (!cls) return;
    if (accepted(cls)) {
      ok.push({ c, cls });
      stats.accepted.push({ title: c.item.title, category: cls.category, tone: cls.tone, fun: cls.fun_score });
    } else {
      stats.rejected.push({ title: c.item.title, reason: `stage B: ${cls.usable ? `${cls.tone}, fun ${cls.fun_score}` : cls.reason}` });
    }
  });
  if (!ok.length) return [];

  // TRANSFORM (+ Stage C lint inside), in parallel; refill from the bench if some fail.
  const quests: QuestSeed[] = [];
  let bench = pickDiverse(ok, ok.length);
  while (quests.length < WANT && bench.length && Date.now() - t0 < DEADLINE_MS - 60_000) {
    const room = MAX_MUSE_CALLS - stats.museCalls;
    const n = Math.min(WANT - quests.length, bench.length, room);
    if (n <= 0) break;
    const batch = bench.slice(0, n);
    bench = bench.slice(n);
    const results = await Promise.all(
      batch.map(({ c, cls }) =>
        transformToQuest(c.item, c.facts, cls, questId(c.item.title), {
          // retries only while the run-wide budget allows
          maxRetries: Math.max(0, Math.min(2, Math.floor((MAX_MUSE_CALLS - stats.museCalls - n) / n))),
          onCall: () => stats.museCalls++,
        }).catch((e) => {
          console.warn(`[news] transform failed for "${c.item.title}": ${(e as Error).message}`);
          return null;
        }),
      ),
    );
    for (const q of results) if (q && isQuestSeed(q) && !quests.some((x) => x.id === q.id)) quests.push(q);
  }
  return quests;
}

// ---------------------------------------------------------------- cache + public API

type Cache = { at: number; quests: QuestSeed[]; stats: PipelineStats } | null;
const g = globalThis as unknown as { __newsCache?: Cache; __newsInflight?: Promise<{ quests: QuestSeed[]; stats: PipelineStats }> };

/** Full run with stats (for debugging). Never throws. Non-empty results are memoized for 4h per server instance. */
export async function getTodaysQuestsDetailed(opts: { fresh?: boolean } = {}): Promise<{ quests: QuestSeed[]; stats: PipelineStats }> {
  const c = g.__newsCache;
  if (!opts.fresh && c && Date.now() - c.at < CACHE_TTL_MS) return { quests: c.quests, stats: c.stats };
  if (g.__newsInflight) return g.__newsInflight;

  const stats: PipelineStats = {
    live: isLiveNews(),
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
  g.__newsInflight = (async () => {
    let quests: QuestSeed[] = [];
    try {
      quests = await Promise.race([
        run(stats),
        new Promise<QuestSeed[]>((_, rej) => setTimeout(() => rej(new Error("pipeline deadline")), DEADLINE_MS)),
      ]);
    } catch (e) {
      stats.error = (e as Error).message;
      console.warn(`[news] pipeline failed: ${stats.error}`);
      quests = [];
    }
    stats.ms = Date.now() - t0;
    console.log(`[news] pipeline: ${quests.length} quests, ${stats.museCalls} muse calls, ${stats.ms}ms`);
    if (quests.length) g.__newsCache = { at: Date.now(), quests, stats };
    return { quests, stats };
  })().finally(() => {
    g.__newsInflight = undefined;
  });
  return g.__newsInflight;
}

/** Today's news as 0–3 QuestSeeds (ids `news-<hash>`). Never throws; returns [] on any failure. */
export async function getTodaysQuests(): Promise<QuestSeed[]> {
  try {
    return (await getTodaysQuestsDetailed()).quests;
  } catch {
    return [];
  }
}
