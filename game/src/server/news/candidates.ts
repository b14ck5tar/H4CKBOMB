import "server-only";
import { createHash } from "node:crypto";
import { museJSON } from "@/server/muse";
import type { Rating } from "@/lib/types";
import { dedupe, fetchArticleFacts, fetchSerpApiFixture, fetchSerpApiParams, normalizeTitle, serpApiCalls, type NewsItem } from "./sources";
import { SOURCE_DENYLIST, boostScore, hardMatch, softMatch } from "./filter";

// "Odd news" story candidates for the story vote (design/24): odd, little-known, harmless stories from the past
// week or month, from random English-language Google News editions worldwide.
// SerpApi (2 calls per refresh) → dedupe → regex block → enrich (free page fetch) → ONE muse-spark-1.3
// safety + oddness pass → best 10, each tagged with the youngest audience it suits. Never throws; [] on failure.

export interface NewsCandidate {
  id: string;
  headline: string;
  snippet: string;
  source: string;
  url: string;
  date: string; // ISO, "" if unknown
  place: string; // "Town, Country" or ""
  rating: Rating; // youngest group it suits
  oddness: number; // 1-10
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
  classified: number;
  picked: number;
  rejected: { title: string; reason: string }[];
  ms: number;
  error?: string;
}

const WANT = 10;
const ENRICH_TOP = 24;
const CLASSIFY_TOP = 22;
const MAX_AGE_MS = 31 * 24 * 3600 * 1000;
const CACHE_TTL_MS = 4 * 3600 * 1000;

/** English Google News editions; two are picked at random per refresh so the places vary worldwide. */
const EDITIONS = ["us", "gb", "au", "ca", "in", "nz", "ie", "za", "sg", "ph"];

/** Two queries per refresh = 2 SerpApi credits per 4 h per server. */
const QUERIES = [
  `"world record" OR "rare" OR "unusual" OR "bizarre" OR "quirky" OR "baffled" OR "oddly" when:7d`,
  `"discovered" OR "spotted" OR "giant" OR "invented" OR "mystery" OR "festival" OR "zoo" when:30d`,
];

// Extra regex blocks for this mode (on top of filter.ts HARD_BLOCK): heavy topics the odd-news net catches.
const EXTRA_BLOCK =
  /\b(police|crash(es|ed)?|victims?|injur\w*|tragic|tragedy|disaster|crisis|attack(ed|s)?|weapons?|guns?|drugs?|cocaine|poison\w*|toxic|lawsuit|court|jail|prison|stolen|theft|robbery|protest\w*|strike|government|minister|mp|mayor|governor|obituary|funeral|grief|wildfire|hurricane|earthquake|flood\w*|evacuat\w*)\b/i;

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

// ---------------------------------------------------------------- AI pass

const PICK_SYSTEM = `You are the story editor for a party game. Friends play a funny co-op story built from a REAL
news story, then learn at the end that it really happened. You pick which real stories are safe and fun.

We want ODD, little-known, harmless stories that make people say "wait, that is real?": strange animals and
animal behavior, weird discoveries and finds, odd local events and contests, quirky inventions, records,
unusual objects, places or traditions. Specific and visual beats general. Bonus for stories from
interesting places around the world.

REJECT (usable=false) if ANY are true. Be strict, when unsure reject:
- Anyone died, is missing, was hurt, sick, or in danger. Any disaster, accident or emergency with victims.
- Violence, crime, police, courts, scams, weapons, drugs, abuse, war, the military, terrorism.
- Politics, politicians, elections, governments as the subject, protests, culture-war topics, religion fights.
- Health scares, diseases, outbreaks, medical stories, mental health.
- The story is about a named private person in a way that could embarrass or mock them, or a child is named.
- Celebrity gossip, product ads, business or market news, sports results without an odd hook, opinion.
- Dry policy, studies with no visual hook, or anything sad.

For each numbered story return:
- index (the story number), usable, reason (12 words max)
- oddness (1-10): 9-10 = jaw-dropping and funny, 6-8 = good odd story, 1-5 = ordinary
- rating: the YOUNGEST group it suits. "kids" = fine for 6-year-olds, "teens" = a little spooky or gross,
  "adults" = grown-up topics (money, work, alcohol, dating)
- place: where it happened as "Town, Country" or "Region, Country", from any place named in the headline or
  text (add the country when the town makes it obvious). "" only if no place is named at all.
Return ONLY JSON matching the schema.`;

const PICK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "usable", "reason", "oddness", "rating", "place"],
        properties: {
          index: { type: "integer" },
          usable: { type: "boolean" },
          reason: { type: "string" },
          oddness: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
          rating: { type: "string", enum: ["kids", "teens", "adults"] },
          place: { type: "string" },
        },
      },
    },
  },
} as const;

type Pick = { index: number; usable: boolean; reason: string; oddness: number; rating: Rating; place: string };

type Cand = { item: NewsItem; facts: string; score: number };

function snippetOf(c: Cand) {
  // The facts the client shows and later sends back to the opener: the publisher's own description first.
  const base = c.facts || c.item.snippet;
  const cut = base.slice(0, 420);
  const end = cut.lastIndexOf(". ");
  return (end > 120 ? cut.slice(0, end + 1) : cut).trim();
}

// ---------------------------------------------------------------- run

async function run(stats: CandidateStats): Promise<NewsCandidate[]> {
  const live = stats.live;
  let raw: NewsItem[];
  if (live) {
    const eds = shuffle(EDITIONS).slice(0, QUERIES.length);
    stats.editions = eds;
    const before = serpApiCalls.count;
    const res = await Promise.all(
      QUERIES.map((q, i) => fetchSerpApiParams(`odd-${eds[i]}`, { engine: "google_news", q, gl: eds[i], hl: "en" })),
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
    const hit = hardMatch(text) ?? text.match(EXTRA_BLOCK)?.[0];
    if (hit) {
      stats.rejected.push({ title: item.title, reason: `regex: ${hit}` });
      continue;
    }
    if (SOURCE_DENYLIST.test(item.source)) continue;
    const t = Date.parse(item.date);
    if (live && !Number.isNaN(t) && now - t > MAX_AGE_MS) continue;
    if (/^(live|watch|listen|quiz|photos?|video)\b[:|-]/i.test(item.title) || /\?$/.test(item.title)) continue;
    let score = boostScore(item.title) * 2 + boostScore(item.snippet);
    if (softMatch(text)) score -= 3;
    if (/news\.google\.com/.test(item.link)) score -= 2; // can't enrich, so the opener has less to go on
    ok.push({ item, facts: "", score });
  }
  stats.regexOk = ok.length;
  if (!ok.length) return [];

  // Light shuffle inside the ranking so equal scores don't always pick the same stories.
  const ranked = shuffle(ok).sort((a, b) => b.score - a.score).slice(0, ENRICH_TOP);
  await Promise.all(
    ranked.map(async (c) => {
      c.facts = await fetchArticleFacts(c.item.link, 4_000);
      if (c.facts) stats.enriched++;
    }),
  );
  const cands = ranked
    .filter((c) => {
      const hit = c.facts && (hardMatch(c.facts) ?? c.facts.match(EXTRA_BLOCK)?.[0]);
      if (hit) stats.rejected.push({ title: c.item.title, reason: `regex (article): ${hit}` });
      return !hit && (c.facts || c.item.snippet || c.item.title.length > 50);
    })
    .slice(0, CLASSIFY_TOP);
  if (!cands.length) return [];

  const user = cands
    .map((c, i) => {
      const d = c.item.date ? c.item.date.slice(0, 10) : "unknown";
      return `STORY ${i}\nHEADLINE: ${c.item.title}\nSOURCE: ${c.item.source}\nDATE: ${d}\nTEXT: ${(c.facts || c.item.snippet || "(none)").slice(0, 600)}`;
    })
    .join("\n\n");
  const res = await museJSON<{ results: Pick[] }>({
    task: "news-pick",
    system: PICK_SYSTEM,
    user,
    schema: PICK_SCHEMA,
    effort: "low",
    maxTokens: 6000,
    timeoutMs: 50_000,
  });
  const picks = new Map<number, Pick>();
  for (const r of res.results ?? []) if (Number.isInteger(r.index) && r.index >= 0 && r.index < cands.length && !picks.has(r.index)) picks.set(r.index, r);
  stats.classified = picks.size;

  const good: { c: Cand; p: Pick }[] = [];
  cands.forEach((c, i) => {
    const p = picks.get(i);
    if (!p) return;
    if (p.usable && p.oddness >= 6) good.push({ c, p });
    else stats.rejected.push({ title: c.item.title, reason: `ai: ${p.usable ? `oddness ${p.oddness}` : p.reason}` });
  });
  good.sort((a, b) => b.p.oddness - a.p.oddness || b.c.score - a.c.score);

  const out = good.slice(0, WANT).map(({ c, p }) => ({
    id: candidateId(c.item.title),
    headline: c.item.title,
    snippet: snippetOf(c),
    source: c.item.source,
    url: c.item.link,
    date: c.item.date,
    place: p.place.trim(),
    rating: p.rating,
    oddness: p.oddness,
    thumbnail: c.item.thumbnail,
  }));
  stats.picked = out.length;
  return out;
}

// ---------------------------------------------------------------- cache

type Cache = { at: number; list: NewsCandidate[]; stats: CandidateStats } | null;
const g = globalThis as unknown as { __oddNews?: Cache; __oddNewsLast?: CandidateStats; __oddNewsInflight?: Promise<{ list: NewsCandidate[]; stats: CandidateStats }> };

/** All candidates (every rating), memoized 4 h per server instance. Empty results are never cached. */
export async function getNewsCandidates(opts: { fresh?: boolean } = {}): Promise<{ list: NewsCandidate[]; stats: CandidateStats }> {
  const c = g.__oddNews;
  if (!opts.fresh && c && Date.now() - c.at < CACHE_TTL_MS) return { list: c.list, stats: c.stats };
  if (g.__oddNewsInflight) return g.__oddNewsInflight;
  const stats: CandidateStats = {
    live: isLiveNews(),
    serpCalls: 0,
    editions: [],
    fetched: 0,
    deduped: 0,
    regexOk: 0,
    enriched: 0,
    classified: 0,
    picked: 0,
    rejected: [],
    ms: 0,
  };
  const t0 = Date.now();
  g.__oddNewsInflight = (async () => {
    let list: NewsCandidate[] = [];
    try {
      list = await Promise.race([
        run(stats),
        new Promise<NewsCandidate[]>((_, rej) => setTimeout(() => rej(new Error("deadline")), 90_000)),
      ]);
    } catch (e) {
      stats.error = (e as Error).message;
      console.warn(`[news] candidates failed: ${stats.error}`);
    }
    stats.ms = Date.now() - t0;
    console.log(`[news] candidates: ${list.length} picked, ${stats.serpCalls} serpapi calls, ${stats.ms}ms`);
    g.__oddNewsLast = stats;
    if (list.length) g.__oddNews = { at: Date.now(), list, stats };
    return { list, stats };
  })().finally(() => {
    g.__oddNewsInflight = undefined;
  });
  return g.__oddNewsInflight;
}

/** Stats of the last finished run on this instance (debug only; never starts a run). */
export function lastStats(): CandidateStats | null {
  return g.__oddNews?.stats ?? g.__oddNewsLast ?? null;
}
