import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { questAllowed } from "@/lib/rating";
import type { Rating } from "@/lib/types";
import seedLibrary from "@/data/story_library.json";
import type { NewsCandidate, Scores } from "./candidates";

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
  storyability: number;
  scores: Scores | null; // null for curated seeds (hand-picked)
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

function lib(): Map<string, LibraryStory> {
  if (!g.__storyLibrary) {
    g.__storyLibrary = new Map((seedLibrary as LibraryFile).stories.map((s) => [s.id, s as LibraryStory]));
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
      scores: c.scores,
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

export type ServedStory = Omit<LibraryStory, "origin" | "added_at" | "opener" | "ending_facts" | "opener_rating" | "thumbnail"> & {
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
  scores: s.scores,
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
    if (out.length >= want || seen.has(s.id) || played.has(s.id) || !questAllowed(s.rating, rating)) return;
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

export function libraryStory(idOrHeadline: string): LibraryStory | undefined {
  return lib().get(idOrHeadline) ?? [...lib().values()].find((x) => x.headline === idOrHeadline);
}
