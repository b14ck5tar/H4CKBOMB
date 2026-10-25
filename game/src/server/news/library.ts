import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { questAllowed } from "@/lib/rating";
import type { Rating } from "@/lib/types";
import seedLibrary from "@/data/story_library.json";
import type { Checklist, NewsCandidate } from "./candidates";

// The story library (CD: "pull from an old database of good stories"). Every story that passes the storyability
// gate is kept here, with its opener, real_setting and beats once one is written, plus the curated seeds.
// Source of truth: game/src/data/story_library.json (committed). The server keeps it in memory and adds new gated
// stories at runtime; in dev it also writes them back to the file (Vercel's disk is read-only, so there
// scripts/story-library.mjs pulls the live list into the file). /api/news fills from it when the live pool is thin.

export type LibraryOrigin = "news" | "curated";

export interface LibraryStory {
  id: string; // news-<hash>, or the curated seed id (e.g. "rust-wyrm")
  origin: LibraryOrigin;
  headline: string;
  snippet: string;
  source: string;
  url: string;
  date: string;
  place: string;
  rating: Rating;
  storyability: number; // "talk" 1-5 for ranking (old entries: the old average score)
  checklist?: Checklist | null; // design/37's 8 boxes, all YES (null/absent = not re-scored yet)
  one_sentence_setup?: string;
  dilemma?: string;
  scores?: unknown; // legacy field from the old 1-5 gate
  thumbnail?: string;
  added_at: string;
  opener?: unknown; // the last opener written for it (the /api/story/opener result's opener)
  opener_rating?: Rating; // the audience it was written for (reused only for the same rating)
  ending_facts?: unknown;
}

type LibraryFile = { version: number; updated: string; stories: LibraryStory[] };

const FILE = path.join(process.cwd(), "src", "data", "story_library.json");
const canWrite = () => process.env.NODE_ENV !== "production" && process.env.STORY_LIBRARY_WRITE !== "0";

const g = globalThis as unknown as { __storyLibrary?: Map<string, LibraryStory>; __storyLibraryWrite?: Promise<void> };

/**
 * Stories that must never be picked again (CD decisions), by id or headline. Checked on load, on every add, in the
 * /api/news fill, the seed fallback and the live pipeline, so no refresh can bring them back.
 */
export const EXCLUDED_IDS = new Set(["norwich-batman"]);
const EXCLUDED_HEADLINES = [/\bbatman\b/i]; // the Norwich Batman handbag chase (CD, Sun 10:50)
export function isExcluded(s: { id?: string; headline?: string }) {
  return EXCLUDED_IDS.has(String(s.id ?? "")) || EXCLUDED_HEADLINES.some((re) => re.test(String(s.headline ?? "")));
}

function lib(): Map<string, LibraryStory> {
  if (!g.__storyLibrary) {
    g.__storyLibrary = new Map((seedLibrary as LibraryFile).stories.filter((s) => !isExcluded(s)).map((s) => [s.id, s as LibraryStory]));
  }
  return g.__storyLibrary;
}

/** Write the library back to the JSON file (dev only, serialized, never throws). */
function persist() {
  if (!canWrite()) return;
  const prev = g.__storyLibraryWrite ?? Promise.resolve();
  g.__storyLibraryWrite = prev.then(async () => {
    try {
      const stories = [...lib().values()].sort((a, b) => (a.origin === b.origin ? b.storyability - a.storyability : a.origin === "news" ? -1 : 1));
      const body: LibraryFile = { version: 1, updated: new Date().toISOString(), stories };
      await fs.writeFile(FILE, `${JSON.stringify(body, null, 1)}\n`, "utf8");
    } catch (e) {
      console.warn(`[library] write failed: ${(e as Error).message}`);
    }
  });
}

/** Add gated live stories (upsert by id; keeps the best score and any opener already written). */
export function addToLibrary(list: NewsCandidate[]) {
  let changed = false;
  for (const c of list) {
    if (isExcluded(c)) continue;
    const old = lib().get(c.id);
    if (old && old.storyability >= c.storyability) continue;
    lib().set(c.id, {
      ...(old ?? {}),
      id: c.id,
      origin: "news",
      headline: c.headline,
      snippet: c.snippet,
      source: c.source,
      url: c.url,
      date: c.date,
      place: c.place,
      rating: c.rating,
      storyability: c.storyability,
      checklist: c.checklist,
      one_sentence_setup: c.one_sentence_setup,
      dilemma: c.dilemma,
      scores: undefined,
      thumbnail: c.thumbnail,
      added_at: old?.added_at ?? new Date().toISOString(),
    });
    changed = true;
  }
  if (changed) persist();
}

/** Remember the opener written for a library story (matched by id, else by headline), so a replay can reuse it. */
export function attachOpener(idOrHeadline: string, opener: unknown, ending_facts: unknown, rating?: Rating) {
  const s = lib().get(idOrHeadline) ?? [...lib().values()].find((x) => x.headline === idOrHeadline);
  if (!s) return;
  lib().set(s.id, { ...s, opener, ending_facts, opener_rating: rating });
  persist();
}

export type ServedStory = Omit<LibraryStory, "origin" | "added_at" | "opener" | "ending_facts" | "opener_rating" | "thumbnail" | "scores"> & {
  origin: "live" | "library" | "curated";
  has_opener: boolean;
};

const serve = (s: LibraryStory | NewsCandidate, origin: ServedStory["origin"]): ServedStory => ({
  id: s.id,
  origin,
  headline: s.headline,
  snippet: s.snippet,
  source: s.source,
  url: s.url,
  date: s.date,
  place: s.place,
  rating: s.rating,
  storyability: s.storyability,
  checklist: s.checklist ?? null,
  one_sentence_setup: s.one_sentence_setup ?? "",
  dilemma: s.dilemma ?? "",
  has_opener: Boolean((lib().get(s.id) as LibraryStory | undefined)?.opener),
});

/**
 * The /api/news list: live gated stories first, then library news stories (best score first), then curated seeds,
 * up to `want`. Stories in `played` (ids the client played recently) are skipped. Rating-filtered.
 */
export function fillFromLibrary(live: NewsCandidate[], rating: Rating, played: Set<string>, want = 10): ServedStory[] {
  const out: ServedStory[] = [];
  const seen = new Set<string>();
  const take = (s: LibraryStory | NewsCandidate, origin: ServedStory["origin"]) => {
    if (out.length >= want || seen.has(s.id) || played.has(s.id) || isExcluded(s) || !questAllowed(s.rating, rating)) return;
    seen.add(s.id);
    out.push(serve(s, origin));
  };
  // Live and library news compete on score (CD: prefer the curated top 10 when today's live news is weak); a tie goes live.
  const all = [...lib().values()];
  const pool = [...live.map((c) => ({ s: c as LibraryStory | NewsCandidate, o: "live" as const })), ...all.filter((x) => x.origin === "news").map((s) => ({ s: s as LibraryStory | NewsCandidate, o: "library" as const }))];
  for (const { s, o } of pool.sort((a, b) => b.s.storyability - a.s.storyability || (a.o === "live" ? -1 : 1))) take(s, o);
  for (const s of all.filter((x) => x.origin === "curated").sort((a, b) => b.storyability - a.storyability)) take(s, "curated");
  return out;
}

/** design/37 re-score: stories that pass keep their checklist; stories that fail are dropped from the library. */
export function applyChecklist(results: { id: string; pass: boolean; checklist: Checklist; one_sentence_setup: string; dilemma: string; talk: number }[]) {
  let dropped = 0;
  for (const r of results) {
    const s = lib().get(r.id);
    if (!s) continue;
    if (!r.pass) {
      lib().delete(r.id);
      dropped++;
      continue;
    }
    lib().set(r.id, { ...s, checklist: r.checklist, one_sentence_setup: r.one_sentence_setup, dilemma: r.dilemma, storyability: r.talk, scores: undefined });
  }
  persist();
  return { dropped, kept: lib().size };
}

export function allStories(): LibraryStory[] {
  return [...lib().values()];
}

export function libraryStory(idOrHeadline: string): LibraryStory | undefined {
  return lib().get(idOrHeadline) ?? [...lib().values()].find((x) => x.headline === idOrHeadline);
}
