import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { getNewsCandidates, lastStats, type NewsCandidate } from "@/server/news/candidates";
import { DEFAULT_RATING, isRating, questAllowed } from "@/lib/rating";

// GET /api/news?rating=kids|teens|adults → { quests: [{id, headline, snippet, source, url, date, place, rating}], generatedAt }
// Up to 10 odd, harmless real stories for the "Odd news" story vote. Never errors; [] on failure (the client
// falls back to the curated seeds).
//
// Credits: one refresh = 2 SerpApi calls. The full list (all ratings) is cached for 4 h in Next's Data Cache
// (survives dev restarts) and in memory; the rating filter runs AFTER the cache, so ratings never multiply calls.
// Empty results throw inside the cached fn, so a bad run is never cached.

export const revalidate = 14400;
export const maxDuration = 120;

type Payload = { list: NewsCandidate[]; generatedAt: string };

const cached = unstable_cache(
  async (): Promise<Payload> => {
    const { list } = await getNewsCandidates();
    if (!list.length) throw new Error("no candidates (not caching)");
    return { list, generatedAt: new Date().toISOString() };
  },
  ["odd-news-candidates-v2"],
  { revalidate: 14400, tags: ["news-candidates"] },
);

const view = (c: NewsCandidate) => ({
  id: c.id,
  headline: c.headline,
  snippet: c.snippet,
  source: c.source,
  url: c.url,
  date: c.date,
  place: c.place,
  rating: c.rating,
});

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const r = sp.get("rating");
  const rating = isRating(r) ? r : DEFAULT_RATING;
  const dev = process.env.NODE_ENV !== "production";
  const debug = dev && sp.get("debug") === "1";

  try {
    const { list, generatedAt } = await cached();
    const quests = list.filter((c) => questAllowed(c.rating, rating)).map(view);
    const body: Record<string, unknown> = { quests, generatedAt };
    if (debug) {
      body.stats = lastStats(); // in-memory only: never triggers a run
      body.all = list;
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=14400" } });
  } catch (e) {
    console.warn(`[api/news] ${(e as Error).message}`);
    // Never re-run the pipeline here: an empty run isn't cached, so a retry would spend SerpApi credits again.
    return NextResponse.json({ quests: [], generatedAt: new Date().toISOString(), ...(debug ? { error: (e as Error).message } : {}) }, { headers: { "Cache-Control": "no-store" } });
  }
}
