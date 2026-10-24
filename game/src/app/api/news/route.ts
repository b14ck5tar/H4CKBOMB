import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { getTodaysQuestsDetailed } from "@/server/news/pipeline";
import { DEFAULT_RATING, isRating, questAllowed } from "@/lib/rating";
import type { QuestSeed, Rating } from "@/lib/types";

// GET /api/news?rating=kids|teens|adults → { quests: QuestSeed[], generatedAt }
// "Tales from Today": 0–10 quests made from today's real news, each tagged with `rating` (the youngest
// group it suits). Only quests allowed for the requested group are returned (`questAllowed`).
// No or invalid `rating` = "teens" (teens and kids quests). Never errors; [] on failure.
// Local-first: quests from the home city (env NEWS_CITY, default "Austin, Texas") come first, then its
// state, then national. There is deliberately no per-request `city` param: each city would need its own
// SerpApi searches and Muse run every 4 h. A deployment picks its one city with NEWS_CITY instead.
//
// Caching (so SerpApi is hit at most ~6x/day, whatever the mix of ratings asked for):
//  1. unstable_cache keeps a non-empty result in Next's Data Cache for 4h (empty results throw
//     inside the cached fn, so a bad run is never cached and the stale good one is kept).
//     It holds ALL ratings; the rating filter runs after it, so one pipeline run serves every group.
//  2. Cache-Control s-maxage lets the Vercel CDN serve it without invoking the function.
//  3. The pipeline also memoizes per server instance, and SerpApi GETs use fetch revalidate.
// The handler reads the request, so it is NOT prerendered at build time (no API calls during build).

export const revalidate = 14400; // 4h
export const maxDuration = 120;

const MAX_QUESTS = 10;

type Payload = { quests: QuestSeed[]; generatedAt: string };

/** Every quest leaves with a valid rating (missing = "teens", the conservative default). */
function rated(quests: QuestSeed[]): QuestSeed[] {
  return quests.map((q) => (isRating(q.rating) ? q : { ...q, rating: "teens" as Rating }));
}

function forRating(quests: QuestSeed[], rating: Rating): QuestSeed[] {
  return quests.filter((q) => questAllowed(q.rating, rating)).slice(0, MAX_QUESTS);
}

const cachedQuests = unstable_cache(
  async (): Promise<Payload> => {
    const { quests } = await getTodaysQuestsDetailed();
    if (!quests.length) throw new Error("no quests (not caching)");
    return { quests: rated(quests), generatedAt: new Date().toISOString() };
  },
  ["news-quests-v2"], // v2: quests carry `rating`; never serve a v1 (unrated) payload
  { revalidate: 14400, tags: ["news-quests"] },
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams; // always read: keeps the route dynamic (no build-time run)
  const param = sp.get("rating");
  const rating: Rating = isRating(param) ? param : DEFAULT_RATING;
  const dev = process.env.NODE_ENV !== "production";
  const debug = dev && sp.get("debug") === "1";
  const fresh = dev && sp.get("fresh") === "1"; // dev only: bypass caches (costs Muse calls)

  try {
    if (debug || fresh) {
      const { quests, stats } = await getTodaysQuestsDetailed({ fresh });
      return NextResponse.json({
        quests: forRating(rated(quests), rating),
        generatedAt: new Date().toISOString(),
        ...(debug ? { stats } : {}),
      });
    }
    const payload = await cachedQuests();
    return NextResponse.json({ ...payload, quests: forRating(rated(payload.quests), rating) } satisfies Payload, {
      headers: { "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.warn(`[api/news] ${(e as Error).message}`);
    return NextResponse.json({ quests: [], generatedAt: new Date().toISOString() } satisfies Payload, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
