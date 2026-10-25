import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { getNewsCandidates, lastStats, type NewsCandidate } from "@/server/news/candidates";
import { fillFromLibrary } from "@/server/news/library";
import { DEFAULT_RATING, isRating } from "@/lib/rating";

// GET /api/news?rating=kids|teens|adults&played=id1,id2
//   → { quests: [{id, origin, headline, snippet, source, url, date, place, rating, storyability, scores, has_opener}], generatedAt }
// Up to 10 stories, best first, every one storyable:
//   1. "live": this refresh's gated stories (past week; widened to the past month if the week kept < 3),
//   2. "library": stories that passed the gate before (game/src/data/story_library.json), best score first,
//   3. "curated": the hand-written seeds (id = the seed id, so the client can use its scenes).
// `played` (optional) = ids the table played recently; they are skipped. The vote's 3 cards = quests[0..2];
// the Quick Tale can pick from the list. Never errors.
//
// Credits: one refresh = 2 SerpApi calls (3 if the month is needed). The live list is cached 4 h in Next's Data
// Cache and in memory; the rating filter and library fill run AFTER the cache, so they never cost a call.
// Empty live results throw inside the cached fn, so a bad run is never cached.

export const revalidate = 14400;
export const maxDuration = 120;

type Payload = { list: NewsCandidate[]; generatedAt: string };

const cached = unstable_cache(
  async (): Promise<Payload> => {
    const { list } = await getNewsCandidates();
    if (!list.length) throw new Error("no candidates (not caching)");
    return { list, generatedAt: new Date().toISOString() };
  },
  ["story-news-candidates-v4"],
  { revalidate: 14400, tags: ["news-candidates"] },
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const r = sp.get("rating");
  const rating = isRating(r) ? r : DEFAULT_RATING;
  const played = new Set((sp.get("played") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50));
  const dev = process.env.NODE_ENV !== "production";
  const debug = dev && sp.get("debug") === "1";

  let live: NewsCandidate[] = [];
  let generatedAt = new Date().toISOString();
  let error = "";
  try {
    ({ list: live, generatedAt } = await cached());
  } catch (e) {
    // Never re-run the pipeline here: an empty run isn't cached, so a retry would spend SerpApi credits again.
    error = (e as Error).message;
    console.warn(`[api/news] ${error}`);
  }
  const quests = fillFromLibrary(live, rating, played);
  const body: Record<string, unknown> = { quests, generatedAt };
  if (debug) Object.assign(body, { stats: lastStats(), all: live, ...(error ? { error } : {}) });
  return NextResponse.json(body, {
    headers: { "Cache-Control": live.length && !played.size ? "public, s-maxage=3600, stale-while-revalidate=14400" : "no-store" },
  });
}
