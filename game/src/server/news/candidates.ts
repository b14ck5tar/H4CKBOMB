import "server-only";
import { createHash } from "node:crypto";
import { museJSON } from "@/server/muse";
import type { Rating } from "@/lib/types";
import { dedupe, fetchArticleFacts, fetchSerpApiFixture, fetchSerpApiParams, normalizeTitle, serpApiCalls, type NewsItem } from "./sources";
import { HARD_BLOCK, SOURCE_DENYLIST, softMatch } from "./filter";

// "Odd news" story candidates for the story vote and the Quick Tale (design/24).
// CD: "only choose ones that can be storytold/dramatized; otherwise we're grasping at straws."
// SerpApi (3 narrative human-interest queries per 4 h refresh, random English editions worldwide) → dedupe →
// regex block → rank (narrative words up, sports/business down) → enrich (free page fetch) → STORYABILITY GATE
// (muse-spark-1.3, low, 3 parallel batches of 15): 7 scores
// 1-5, keep avg >= 4 with no score below 3 → top 10 by score. Never throws; [] on failure (client uses seeds).

export const SCORE_KEYS = ["situation", "problem", "setting", "arc", "roles", "payoff", "fantasy_fit"] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];
export type Scores = Record<ScoreKey, number>;

export interface NewsCandidate {
  id: string;
  headline: string;
  snippet: string;
  source: string;
  url: string;
  date: string; // ISO, "" if unknown
  place: string; // "Town, Country" or ""
  rating: Rating; // youngest group it suits
  storyability: number; // average of the 7 scores, 1-5
  scores: Scores;
  thumbnail: string;
}

export interface CandidateStats {
  live: boolean;
  serpCalls: number;
  editions: string[];
  fetched: number;
  deduped: number;
  regexOk: number;
  enriched: number;
  gated: number;
  picked: number;
  kept: { title: string; avg: number; scores: Scores }[];
  rejected: { title: string; reason: string; avg?: number; scores?: Scores }[];
  ms: number;
  error?: string;
}

const WANT = 10;
const ENRICH_TOP = 48;
const GATE_TOP = 45; // 3 parallel batches of 15
const BATCH = 15;
const MIN_AVG = 4;
const MIN_ANY = 3;
const MAX_AGE_MS = 35 * 24 * 3600 * 1000;
const CACHE_TTL_MS = 4 * 3600 * 1000;
const POOL_MAX_AGE_MS = 21 * 24 * 3600 * 1000; // a gated story stays in the pool for up to 3 weeks

/** English Google News editions; three are picked at random per refresh so the places vary worldwide. */
const EDITIONS = ["us", "gb", "au", "ca", "in", "nz", "ie", "za", "sg", "ph"];

/** Three queries per refresh = 3 SerpApi credits per 4 h per server. Narrative human-interest, past few weeks. */
// Phrases that describe something HAPPENING to someone. Single words like "giant", "legend", "championship" or
// "baffled" pulled in sports and business pages (live test Sat night: 2-3 of ~37 passed the gate).
const QUERIES = [
  // lost and found, rescues, reunions
  `"reunited with" OR "found after" OR "rescued from" OR "returned to its" OR "years later" OR "finally home" when:21d`,
  // animals and things in odd places
  `"on the loose" OR "escaped from" OR "wandered into" OR "stuck in a" OR "made itself at home" OR "unexpected visitor" when:21d`,
  // record attempts with a twist, town mix-ups, silly heists, mysteries solved
  `"record attempt" OR "mix-up" OR "mystery solved" OR "statue stolen" OR "villagers" OR "residents puzzled" when:21d`,
];

/** Narrative words that hint at a story with a scene, a problem and an outcome. Used only to rank before the gate. */
const NARRATIVE =
  /\b(rescued?|reunited|returned|found|lost|missing|escaped|loose|spotted|stuck|record|attempt|contest|competition|championship|festival|giant|biggest|mystery|baffl\w*|mix-?up|stolen|heist|legend|village\w*|town\w*|unexpected|years later|finally|surprise\w*|odd|bizarre|quirky|strange|zoo|farm|museum|parade)\b/gi;

/** Not stories: sports, business, promos, interviews and opinion. Ranked down before the gate (the gate still decides). */
const NOT_STORY =
  /(football|rugby|cricket|league|match|score[ds]?|derby|tournament|season|coach|preview|interview|q&a|review|commentary|opinion|column|announces?|launch\w*|stock|deal|brand|sale|podcast|episode|trailer|album|tour)/gi;

// Hard blocks for this mode. filter.ts HARD_BLOCK minus its "missing / arrest / trial" rule (a lost tortoise found
// after years is exactly what we want), plus our own court/crime rule and heavy topics. The gate judges the rest.
const COURT = /\b(manhunt|arrest(ed)?|charged|sentenced|trial|lawsuit|sues?|indict\w*|jail|prison|court)\b/i;
const EXTRA_BLOCK =
  /\b(victims?|injur\w*|tragic|tragedy|disaster|crisis|attack(ed|s)?|weapons?|guns?|drugs?|cocaine|poison\w*|toxic|robbery|burglar\w*|protest\w*|strike|government|minister|mayor|governor|obituary|funeral|grief|mourn\w*|wildfire|hurricane|earthquake|flood\w*|evacuat\w*|earnings|shares|stock|ipo|revenue|quarterly|launch(es|ed)?)\b/i;
const MISSING_OK = /\b(found|reunited|returned|home|back|safe)\b/i;

function blocked(text: string): string | null {
  for (const re of HARD_BLOCK) {
    const m = text.match(re);
    if (!m) continue;
    if (/^(missing|search for)$/i.test(m[0]) && MISSING_OK.test(text)) continue; // lost and found is fine
    if (/^(missing|search for)/i.test(m[0])) return m[0];
    if (re.source.includes("missing|search for")) continue; // that rule's court words are handled by COURT
    return m[0];
  }
  return text.match(COURT)?.[0] ?? text.match(EXTRA_BLOCK)?.[0] ?? null;
}

export function isLiveNews() {
  if (process.env.NEWS_LIVE === "0") return false;
  return Boolean(process.env.SERPAPI_KEY);
}

export function candidateId(title: string) {
  return `news-${createHash("sha1").update(normalizeTitle(title)).digest("hex").slice(0, 10)}`;
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ---------------------------------------------------------------- storyability gate

const GATE_SYSTEM = `You are the story editor for a party game. A group of friends step INTO a real news event as
heroes, play it with one fantasy twist, and at the end learn it really happened. Your job: keep only real stories
that can be told as a story. If we have to grasp at straws to dramatize it, it is a bad pick.

For each numbered story, score 1 to 5 (5 = perfect, 3 = workable, 1 = missing):
- situation: a clear situation a group could step into right now ("a town getting ready for a giant parade").
- problem: a concrete problem with stakes (something stuck, lost, broken, at risk, about to go wrong).
- setting: a visual, specific setting you can picture (a muddy farm field, a museum basement, a harbor).
- arc: a natural 3-4 step arc that ACTUALLY HAPPENED (setup, complication, climax, outcome), from the text.
- roles: real people involved, by role, that heroes could talk to (the farmer, the zookeeper, the volunteers).
- payoff: an ending that pays off at the reveal ("wait, that really happened?").
- fantasy_fit: one fantasy twist makes it better and stays easy to follow, not confusing.

SAFETY: usable=false (and every score 1) if anyone died, is missing without being found, was hurt, sick or in
danger now; any disaster or accident with victims; violence, real crime with victims or named suspects (a silly,
harmless heist of an odd object with nobody hurt is fine); war, the military, politics, protests; health scares or
medical stories; a named private person who could be embarrassed; a child named.
Also score low (these are not stories): pure statistics or rankings, policy, business, earnings, product launches,
obituaries, opinion, a science paper with no scene, celebrity gossip, sports results.

Also return: index, usable, reason (12 words max), rating (the YOUNGEST group it suits: "kids" = fine for 6-year-olds,
"teens" = a little spooky or gross, "adults" = grown-up topics), place ("Town, Country" or "Region, Country" from
the text, "" if none). Be honest and strict: most news is not a story. Return ONLY JSON matching the schema.`;

const int5 = { type: "integer", enum: [1, 2, 3, 4, 5] } as const;
const GATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "usable", "reason", ...SCORE_KEYS, "rating", "place"],
        properties: {
          index: { type: "integer" },
          usable: { type: "boolean" },
          reason: { type: "string" },
          ...Object.fromEntries(SCORE_KEYS.map((k) => [k, int5])),
          rating: { type: "string", enum: ["kids", "teens", "adults"] },
          place: { type: "string" },
        },
      },
    },
  },
} as const;

type Gate = { index: number; usable: boolean; reason: string; rating: Rating; place: string } & Scores;

type Cand = { item: NewsItem; facts: string; score: number };

function snippetOf(c: Cand) {
  // The facts the client shows and later sends back to the opener: the publisher's own description first.
  const base = c.facts || c.item.snippet;
  const cut = base.slice(0, 420);
  const end = cut.lastIndexOf(". ");
  return (end > 120 ? cut.slice(0, end + 1) : cut).trim();
}

const scoresOf = (g: Gate): Scores => Object.fromEntries(SCORE_KEYS.map((k) => [k, Number(g[k]) || 1])) as Scores;
const avgOf = (s: Scores) => Math.round((SCORE_KEYS.reduce((a, k) => a + s[k], 0) / SCORE_KEYS.length) * 10) / 10;

/** Score one batch. Indexes in the result refer to the batch. Throws on AI failure. */
async function gateBatch(batch: Cand[]): Promise<Map<number, Gate>> {
  const user = batch
    .map((c, i) => {
      const d = c.item.date ? c.item.date.slice(0, 10) : "unknown";
      return `STORY ${i}\nHEADLINE: ${c.item.title}\nSOURCE: ${c.item.source}\nDATE: ${d}\nTEXT: ${(c.facts || c.item.snippet || "(none)").slice(0, 700)}`;
    })
    .join("\n\n");
  const res = await museJSON<{ results: Gate[] }>({
    task: "news-storyability",
    system: GATE_SYSTEM,
    user,
    schema: GATE_SCHEMA,
    effort: "low",
    maxTokens: 8000,
    timeoutMs: 60_000,
  });
  const out = new Map<number, Gate>();
  for (const r of res.results ?? []) if (Number.isInteger(r.index) && r.index >= 0 && r.index < batch.length && !out.has(r.index)) out.set(r.index, r);
  return out;
}

// ---------------------------------------------------------------- run

async function run(stats: CandidateStats): Promise<NewsCandidate[]> {
  const live = stats.live;
  let raw: NewsItem[];
  if (live) {
    // NEWS_EDITIONS=gb,au,za pins the editions (tests: identical searches within an hour are free on SerpApi).
    const pinned = (process.env.NEWS_EDITIONS ?? "").split(",").map((x) => x.trim()).filter((x) => EDITIONS.includes(x));
    const eds = pinned.length >= QUERIES.length ? pinned.slice(0, QUERIES.length) : shuffle(EDITIONS).slice(0, QUERIES.length);
    stats.editions = eds;
    const before = serpApiCalls.count;
    const res = await Promise.all(
      QUERIES.map((q, i) => fetchSerpApiParams(`story-${eds[i]}`, { engine: "google_news", q, gl: eds[i], hl: "en" })),
    );
    stats.serpCalls = serpApiCalls.count - before;
    raw = res.flat();
  } else {
    raw = await fetchSerpApiFixture();
    stats.editions = ["fixture"];
  }
  stats.fetched = raw.length;
  const all = dedupe(raw);
  stats.deduped = all.length;

  const now = Date.now();
  const ok: Cand[] = [];
  for (const item of all) {
    const text = `${item.title} ${item.snippet}`;
    const hit = blocked(text);
    if (hit) {
      stats.rejected.push({ title: item.title, reason: `regex: ${hit}` });
      continue;
    }
    if (SOURCE_DENYLIST.test(item.source)) continue;
    const t = Date.parse(item.date);
    if (live && !Number.isNaN(t) && now - t > MAX_AGE_MS) continue;
    if (/^(live|watch|listen|quiz|photos?|video|opinion)\b[:|-]/i.test(item.title) || /\?$/.test(item.title)) continue;
    let score = (item.title.match(NARRATIVE)?.length ?? 0) * 2 + (item.snippet.match(NARRATIVE)?.length ?? 0);
    score -= (text.match(NOT_STORY)?.length ?? 0) * 4;
    if (softMatch(text)) score -= 2;
    if (/news\.google\.com/.test(item.link)) score -= 3; // can't enrich, so the gate and the opener have less to go on
    ok.push({ item, facts: "", score });
  }
  stats.regexOk = ok.length;
  if (!ok.length) return [];

  // Light shuffle inside the ranking so equal scores don't always pick the same stories.
  const ranked = shuffle(ok).sort((a, b) => b.score - a.score).slice(0, ENRICH_TOP);
  // Free page fetches, at most 10 at a time (48 at once got most of them throttled or timed out).
  const queue = [...ranked];
  await Promise.all(
    Array.from({ length: 10 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        c.facts = await fetchArticleFacts(c.item.link, 6_000);
        if (c.facts) stats.enriched++;
      }
    }),
  );
  const cands = ranked
    .filter((c) => {
      const hit = c.facts && blocked(c.facts);
      if (hit) stats.rejected.push({ title: c.item.title, reason: `regex (article): ${hit}` });
      return !hit && (c.facts || c.item.snippet || c.item.title.length > 50);
    })
    // Stories with article text first: the gate can't see an arc in a bare headline.
    .sort((a, b) => Number(Boolean(b.facts)) - Number(Boolean(a.facts)))
    .slice(0, GATE_TOP);
  if (!cands.length) return [];

  // STORYABILITY GATE: parallel batches of 15 (faster and steadier than one big call).
  const batches: Cand[][] = [];
  for (let i = 0; i < cands.length; i += BATCH) batches.push(cands.slice(i, i + BATCH));
  const results = await Promise.all(batches.map((b) => gateBatch(b).catch((e) => (console.warn(`[news] gate batch failed: ${(e as Error).message}`), new Map<number, Gate>()))));

  const good: { c: Cand; g: Gate; s: Scores; avg: number }[] = [];
  batches.forEach((b, bi) =>
    b.forEach((c, i) => {
      const g = results[bi].get(i);
      if (!g) return;
      stats.gated++;
      const s = scoresOf(g);
      const avg = avgOf(s);
      const min = Math.min(...SCORE_KEYS.map((k) => s[k]));
      if (g.usable && avg >= MIN_AVG && min >= MIN_ANY) good.push({ c, g, s, avg });
      else stats.rejected.push({ title: c.item.title, reason: g.usable ? `storyability ${avg} (min ${min})` : `unsafe: ${g.reason}`, avg, scores: s });
    }),
  );
  if (!stats.gated) throw new Error("storyability gate failed");
  good.sort((a, b) => b.avg - a.avg || b.c.score - a.c.score);

  const out = good.slice(0, WANT).map(({ c, g, s, avg }) => ({
    id: candidateId(c.item.title),
    headline: c.item.title,
    snippet: snippetOf(c),
    source: c.item.source,
    url: c.item.link,
    date: c.item.date,
    place: String(g.place ?? "").trim(),
    rating: g.rating,
    storyability: avg,
    scores: s,
    thumbnail: c.item.thumbnail,
  }));
  stats.kept = out.map((x) => ({ title: x.headline, avg: x.storyability, scores: x.scores }));
  stats.picked = out.length;
  return out;
}

// ---------------------------------------------------------------- cache

type Cache = { at: number; list: NewsCandidate[]; stats: CandidateStats } | null;
const g = globalThis as unknown as { __storyPool?: NewsCandidate[]; __storyNews?: Cache; __storyNewsLast?: CandidateStats; __storyNewsInflight?: Promise<{ list: NewsCandidate[]; stats: CandidateStats }> };

/** All candidates (every rating), sorted by storyability, memoized 4 h per server instance. Empty results are never cached. */
export async function getNewsCandidates(opts: { fresh?: boolean } = {}): Promise<{ list: NewsCandidate[]; stats: CandidateStats }> {
  const c = g.__storyNews;
  if (!opts.fresh && c && Date.now() - c.at < CACHE_TTL_MS) return { list: c.list, stats: c.stats };
  if (g.__storyNewsInflight) return g.__storyNewsInflight;
  const stats: CandidateStats = {
    live: isLiveNews(),
    serpCalls: 0,
    editions: [],
    fetched: 0,
    deduped: 0,
    regexOk: 0,
    enriched: 0,
    gated: 0,
    picked: 0,
    kept: [],
    rejected: [],
    ms: 0,
  };
  const t0 = Date.now();
  g.__storyNewsInflight = (async () => {
    let list: NewsCandidate[] = [];
    try {
      list = await Promise.race([
        run(stats),
        new Promise<NewsCandidate[]>((_, rej) => setTimeout(() => rej(new Error("deadline")), 100_000)),
      ]);
    } catch (e) {
      stats.error = (e as Error).message;
      console.warn(`[news] candidates failed: ${stats.error}`);
    }
    stats.ms = Date.now() - t0;
    console.log(`[news] candidates: ${list.length} kept of ${stats.gated} gated, ${stats.serpCalls} serpapi calls, ${stats.ms}ms`);
    g.__storyNewsLast = stats;
    // Rolling pool: merge with stories that passed the gate in earlier refreshes (same server instance).
    if (stats.live) {
      const seen = new Set(list.map((x) => x.id));
      const fresh = (x: NewsCandidate) => !x.date || Date.now() - Date.parse(x.date) < POOL_MAX_AGE_MS;
      const old = (g.__storyPool ?? []).filter((x) => !seen.has(x.id) && fresh(x));
      list = [...list, ...old].sort((a, b) => b.storyability - a.storyability).slice(0, WANT);
      g.__storyPool = list;
    }
    if (list.length) g.__storyNews = { at: Date.now(), list, stats };
    return { list, stats };
  })().finally(() => {
    g.__storyNewsInflight = undefined;
  });
  return g.__storyNewsInflight;
}

/** Stats of the last finished run on this instance (debug only; never starts a run). */
export function lastStats(): CandidateStats | null {
  return g.__storyNews?.stats ?? g.__storyNewsLast ?? null;
}
