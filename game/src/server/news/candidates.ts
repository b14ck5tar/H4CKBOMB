import "server-only";
import { createHash } from "node:crypto";
import { museJSON } from "@/server/muse";
import type { Rating } from "@/lib/types";
import { dedupe, fetchArticleFacts, fetchSerpApiFixture, fetchSerpApiParams, normalizeTitle, serpApiCalls, type NewsItem } from "./sources";
import { ADULT_ONLY, HARD_BLOCK, SOURCE_DENYLIST, softMatch } from "./filter";
import { addToLibrary } from "./library";

// "Odd news" story candidates for the story vote and the Quick Tale (design/24).
// CD: "only choose ones that can be storytold/dramatized; otherwise we're grasping at straws."
// SerpApi (2 past-week queries; 1 past-month query only if the week keeps < 3; random English editions) → dedupe →
// regex block → rank (narrative words up, sports/business down) → enrich (free page fetch) → STORYABILITY GATE
// (muse-spark-1.3, low, parallel batches) → top 10, also saved to the story library (library.ts).
// THE GATE (design/37, CD): the hard safety gate (code + model), then the CD's 8-box checklist. A story enters the
// pool ONLY if all 8 boxes are YES. Each box carries a short reason (DM's Notes / library). "talk" (1-5) only ranks
// stories that passed. Never throws; [] on failure (client uses seeds).

/** design/37: the CD's 8 questions. All must be YES. */
export const CHECKLIST = {
  box1: "Is the problem big enough that it takes the whole group to solve?",
  box2: "Is there an alterable ending that doesn't strictly favor one side?",
  box3: "Does the story feel and flow well when dramatized for a group of people?",
  box4: "Can the dramatized story fit unique characters with different superpower abilities?",
  box5: "Can the story have multiple endings and routes, especially when someone does something unexpected?",
  box6: 'Does the real event make people say "wait, that REALLY happened?"',
  box7: "Is it easy to follow? Can the setup be told in one plain sentence (where, what's wrong, what's at stake), and can every turn be followed by someone who just walked up to the table?",
  box8: "Is there a real dilemma the group will argue about, not just a task?",
} as const;
export const BOX_KEYS = Object.keys(CHECKLIST) as (keyof typeof CHECKLIST)[];
export type BoxKey = (typeof BOX_KEYS)[number];
export type Box = { yes: boolean; why: string };
export type Checklist = Record<BoxKey, Box>;
/** Kept for older callers: the checklist IS the score now. */
export type Scores = Checklist;

export interface NewsCandidate {
  id: string;
  headline: string;
  snippet: string;
  source: string;
  url: string;
  date: string; // ISO, "" if unknown
  place: string; // "Town, Country" or ""
  rating: Rating; // youngest group it suits
  storyability: number; // "talk" 1-5: ranks stories that passed all 8 boxes (it is not a gate)
  checklist: Checklist; // all 8 YES, each with a short reason
  one_sentence_setup: string; // where, what's wrong, what's at stake (box 7), for the opener
  dilemma: string; // what the group will argue about (box 8), for the opener
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
  phase?: "week" | "week+month";
  kept: { title: string; talk: number; setup: string; dilemma: string }[];
  rejected: { title: string; reason: string; failed?: string[]; checklist?: Checklist }[];
  ms: number;
  error?: string;
}

const WANT = 10;
const ENRICH_TOP = 48;
const GATE_TOP = 40; // 5 parallel batches of 8 (8 boxes with reasons per story is a long answer)
const BATCH = 8;
const MAX_AGE_MS = 35 * 24 * 3600 * 1000;
const CACHE_TTL_MS = 4 * 3600 * 1000;

/** English Google News editions; three are picked at random per refresh so the places vary worldwide. */
const EDITIONS = ["us", "gb", "au", "ca", "in", "nz", "ie", "za", "sg", "ph"];

// Phrases that describe something HAPPENING to someone. Single words like "giant", "legend", "championship" or
// "baffled" pulled in sports and business pages (live test Sat night: 2-3 of ~37 passed the gate).
// CD: "if none good for the past week, look at the past month." Budget: at most 3 SerpApi calls per refresh.
/** Phase 1: the past week (2 calls). */
const WEEK_QUERIES = [
  // lost and found, rescues, reunions, animals and things in odd places
  `"reunited with" OR "found after" OR "rescued from" OR "returned to its" OR "on the loose" OR "escaped from" OR "wandered into" when:7d`,
  // record attempts with a twist, town mix-ups, silly heists, mysteries solved
  `"record attempt" OR "mix-up" OR "mystery solved" OR "statue stolen" OR "villagers" OR "residents puzzled" OR "unexpected visitor" when:7d`,
];
/** Phase 2, only if the week kept fewer than MIN_WEEK: the past month (1 call). */
const MONTH_QUERY = `"reunited with" OR "found after" OR "on the loose" OR "record attempt" OR "mix-up" OR "mystery solved" OR "years later" when:30d`;
const MIN_WEEK = 3;

/** Narrative words that hint at a story with a scene, a problem and an outcome. Used only to rank before the gate. */
const NARRATIVE =
  /\b(rescued?|reunited|returned|found|lost|missing|escaped|loose|spotted|stuck|record|attempt|contest|competition|championship|festival|giant|biggest|mystery|baffl\w*|mix-?up|stolen|heist|legend|village\w*|town\w*|unexpected|years later|finally|surprise\w*|odd|bizarre|quirky|strange|zoo|farm|museum|parade)\b/gi;

/** Not stories: sports, business, promos, interviews and opinion. Ranked down before the gate (the gate still decides). */
const NOT_STORY =
  /\b(football|rugby|cricket|league|match|score[ds]?|derby|tournament|season|coach|preview|interview|q&a|review|commentary|opinion|column|announces?|launch\w*|stock|deal|brand|sale|podcast|episode|trailer|album|tour)\b/gi;

// Hard blocks for this mode. filter.ts HARD_BLOCK minus its "missing / arrest / trial" rule (a lost tortoise found
// after years is exactly what we want), plus our own court/crime rule and heavy topics. The gate judges the rest.
const COURT = /\b(manhunt|arrest(ed)?|charged|sentenced|trial|lawsuit|sues?|indict\w*|jail|prison|court)\b/i;
const EXTRA_BLOCK =
  /\b(victims?|injur\w*|tragic|tragedy|disaster|crisis|attack(ed|s)?|weapons?|guns?|drugs?|cocaine|poison\w*|toxic|robbery|burglar\w*|protest\w*|strike|government|minister|mayor|governor|obituary|funeral|grief|mourn\w*|wildfire|hurricane|earthquake|flood\w*|evacuat\w*|earnings|shares|stock|ipo|revenue|quarterly|launch(es|ed)?)\b/i;
const MISSING_OK = /\b(found|reunited|returned|home|back|safe)\b/i;

export function blocked(text: string): string | null {
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

const GATE_SYSTEM = `You are the strict story editor for a party game. A group of friends step INTO a real news event as
heroes with different superpowers, play it with one fantasy twist, and at the end learn it really happened. Most news
is NOT a story we can use. Be strict: when a box is not clearly YES, it is NO.

SAFETY GATE FIRST: safe=false if anyone died, is missing and not found, was seriously hurt, sick or in danger now; any
disaster or accident with victims; violence against people; sexual content; children involved; hate; war, the
military, tragedies; partisan hot-button politics or protests; health scares or medical stories; a named private
person who could be embarrassed or mocked. Then answer the boxes anyway (all NO is fine).
ADULTS ONLY (still safe, rating "adults"): non-violent crime (heists, cons, smuggling, bizarre thefts), weird court
cases, scandals of public figures or institutions, absurd local-government drama, dark-funny topics, as long as
nobody was hurt and no private person is mocked.

THE 8 BOXES (answer each YES or NO with a reason of 12 words or less):
box1: ${CHECKLIST.box1}
box2: ${CHECKLIST.box2}
box3: ${CHECKLIST.box3}
box4: ${CHECKLIST.box4}
box5: ${CHECKLIST.box5}
box6: ${CHECKLIST.box6}
box7: ${CHECKLIST.box7}
box8: ${CHECKLIST.box8}
NO examples: a road or bridge reopening (box6, box8), a statistic or ranking (box3, box7), a science paper with no
scene (box3), a lost pet found (box1: one family's problem, box8: nothing to argue about), a sports result (box2).
YES example: workers find a fortune in gold coins hidden in a cellar wall (whole crew, who keeps it is a real
dilemma, many endings, "wait, really?").

Also return:
- one_sentence_setup: ONE plain sentence a newcomer gets at once: where, what's wrong, what's at stake. No names of
  private people. "" if you cannot.
- dilemma: ONE plain sentence of the choice the group will argue about ("keep the gold or hand it in"). "" if none.
- talk (1-5): how hard adults lean in at a party when they hear it. 5 = everyone, 1 = nobody repeats it.
- index, safe, safety_reason (12 words max, "" if safe), rating (the YOUNGEST group it suits: "kids" = fine for
  6-year-olds, "teens" = a little spooky or gross, "adults" = grown-up topics), place ("Town, Country" or "Region,
  Country" from the text, "" if none).
Return ONLY JSON matching the schema.`;

const box = { type: "object", additionalProperties: false, required: ["yes", "why"], properties: { yes: { type: "boolean" }, why: { type: "string" } } } as const;
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
        required: ["index", "safe", "safety_reason", ...BOX_KEYS, "one_sentence_setup", "dilemma", "talk", "rating", "place"],
        properties: {
          index: { type: "integer" },
          safe: { type: "boolean" },
          safety_reason: { type: "string" },
          ...Object.fromEntries(BOX_KEYS.map((k) => [k, box])),
          one_sentence_setup: { type: "string" },
          dilemma: { type: "string" },
          talk: { type: "integer", enum: [1, 2, 3, 4, 5] },
          rating: { type: "string", enum: ["kids", "teens", "adults"] },
          place: { type: "string" },
        },
      },
    },
  },
} as const;

export type Gate = {
  index: number;
  safe: boolean;
  safety_reason: string;
  one_sentence_setup: string;
  dilemma: string;
  talk: number;
  rating: Rating;
  place: string;
} & Checklist;

export const checklistOf = (g: Gate): Checklist =>
  Object.fromEntries(BOX_KEYS.map((k) => [k, { yes: Boolean(g[k]?.yes), why: String(g[k]?.why ?? "").slice(0, 120) }])) as Checklist;
export const failedBoxes = (c: Checklist) => BOX_KEYS.filter((k) => !c[k].yes);
/** The pass rule: safe, all 8 YES, and the two sentences the opener needs. */
export const passes = (g: Gate) => g.safe && !failedBoxes(checklistOf(g)).length && Boolean(g.one_sentence_setup.trim()) && Boolean(g.dilemma.trim());

/** One story the gate can read. */
export type GateInput = { headline: string; source: string; date: string; text: string };

/** Run the gate on any stories (live candidates, library re-scoring, judge seeds). Parallel batches; never throws. */
export async function checkStories(items: GateInput[]): Promise<(Gate | null)[]> {
  const out: (Gate | null)[] = items.map(() => null);
  const batches: number[][] = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH).map((_, j) => i + j));
  await Promise.all(
    batches.map(async (idx) => {
      const user = idx
        .map((ii, n) => {
          const it = items[ii];
          return `STORY ${n}\nHEADLINE: ${it.headline}\nSOURCE: ${it.source}\nDATE: ${(it.date || "").slice(0, 10) || "unknown"}\nTEXT: ${(it.text || "(none)").slice(0, 700)}`;
        })
        .join("\n\n");
      try {
        const res = await museJSON<{ results: Gate[] }>({
          task: "news-checklist",
          system: GATE_SYSTEM,
          user,
          schema: GATE_SCHEMA,
          effort: "low",
          maxTokens: 12000,
          timeoutMs: 90_000,
        });
        for (const r of res.results ?? []) if (Number.isInteger(r.index) && r.index >= 0 && r.index < idx.length && !out[idx[r.index]]) out[idx[r.index]] = r;
      } catch (e) {
        console.warn(`[news] checklist batch failed: ${(e as Error).message}`);
      }
    }),
  );
  return out;
}

type Cand = { item: NewsItem; facts: string; score: number };

function snippetOf(c: Cand) {
  // The facts the client shows and later sends back to the opener: the publisher's own description first.
  const seen = new Set<string>();
  const base = (c.facts || c.item.snippet)
    .split(/(?<=[.!?])\s+/)
    .filter((x) => {
      const k = x.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(" ");
  const cut = base.slice(0, 420);
  const end = cut.lastIndexOf(". ");
  return (end > 120 ? cut.slice(0, end + 1) : cut).trim();
}

// ---------------------------------------------------------------- run

type Good = { c: Cand; g: Gate; list: Checklist };

/** Regex block → rank → enrich → storyability gate, for one batch of fetched items. Pushes rejects to stats. */
async function gatePhase(raw: NewsItem[], stats: CandidateStats, live: boolean, skip: Set<string>): Promise<Good[]> {
  const all = dedupe(raw).filter((i) => !skip.has(normalizeTitle(i.title)));
  stats.deduped += all.length;

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
  stats.regexOk += ok.length;
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

  // THE GATE: safety + the 8-box checklist, in parallel batches.
  const results = await checkStories(cands.map((c) => ({ headline: c.item.title, source: c.item.source, date: c.item.date, text: c.facts || c.item.snippet })));
  const good: Good[] = [];
  let gated = 0;
  cands.forEach((c, i) => {
    const g = results[i];
    if (!g) return;
    gated++;
    const list = checklistOf(g);
    if (passes(g)) good.push({ c, g, list });
    else
      stats.rejected.push({
        title: c.item.title,
        reason: !g.safe ? `unsafe: ${g.safety_reason}` : `failed ${failedBoxes(list).join(", ") || "setup/dilemma missing"}`,
        failed: failedBoxes(list),
        checklist: list,
      });
  });
  stats.gated += gated;
  if (!gated) throw new Error("storyability gate failed");
  return good;
}

async function run(stats: CandidateStats): Promise<NewsCandidate[]> {
  const live = stats.live;
  const serp = async (q: string, ed: string, label: string) => {
    const before = serpApiCalls.count;
    const items = await fetchSerpApiParams(`${label}-${ed}`, { engine: "google_news", q, gl: ed, hl: "en" });
    stats.serpCalls += serpApiCalls.count - before;
    return items;
  };
  // NEWS_EDITIONS=gb,au,za pins the editions (tests only; note SerpApi still bills repeated searches).
  const pinned = (process.env.NEWS_EDITIONS ?? "").split(",").map((x) => x.trim()).filter((x) => EDITIONS.includes(x));
  const eds = pinned.length >= 3 ? pinned.slice(0, 3) : shuffle(EDITIONS).slice(0, 3);

  let good: Good[] = [];
  if (live) {
    // Phase 1: the past week.
    stats.editions = eds.slice(0, 2);
    const week = (await Promise.all(WEEK_QUERIES.map((q, i) => serp(q, eds[i], "week")))).flat();
    stats.fetched += week.length;
    good = await gatePhase(week, stats, live, new Set());
    stats.phase = "week";
    // Phase 2: widen to the past month only if the week is thin (1 more call, 3 in total).
    if (good.length < MIN_WEEK) {
      stats.editions.push(eds[2]);
      stats.phase = "week+month";
      const month = await serp(MONTH_QUERY, eds[2], "month");
      stats.fetched += month.length;
      const seen = new Set(week.map((i) => normalizeTitle(i.title)));
      good = [...good, ...(await gatePhase(month, stats, live, seen).catch(() => []))];
    }
  } else {
    const raw = await fetchSerpApiFixture();
    stats.editions = ["fixture"];
    stats.fetched = raw.length;
    good = await gatePhase(raw, stats, live, new Set());
  }
  good.sort((a, b) => b.g.talk - a.g.talk || b.c.score - a.c.score);

  const out = good.slice(0, WANT).map(({ c, g, list }) => ({
    id: candidateId(c.item.title),
    headline: c.item.title,
    snippet: snippetOf(c),
    source: c.item.source,
    url: c.item.link,
    date: c.item.date,
    place: String(g.place ?? "").trim(),
    // Crime, cons and court stories are adults-only, whatever the gate said (CD: the safety tier follows the rating).
    rating: ADULT_ONLY.test(`${c.item.title} ${c.item.snippet} ${c.facts}`) ? ("adults" as const) : g.rating,
    storyability: g.talk,
    checklist: list,
    one_sentence_setup: g.one_sentence_setup.trim(),
    dilemma: g.dilemma.trim(),
    thumbnail: c.item.thumbnail,
  }));
  stats.kept = out.map((x) => ({ title: x.headline, talk: x.storyability, setup: x.one_sentence_setup, dilemma: x.dilemma }));
  stats.picked = out.length;
  if (live && out.length) addToLibrary(out); // the "old database of good stories"
  return out;
}

// ---------------------------------------------------------------- cache

type Cache = { at: number; list: NewsCandidate[]; stats: CandidateStats } | null;
const g = globalThis as unknown as { __storyNews?: Cache; __storyNewsLast?: CandidateStats; __storyNewsInflight?: Promise<{ list: NewsCandidate[]; stats: CandidateStats }> };

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
