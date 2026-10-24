import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { getTodaysQuestsDetailed } from "@/server/news/pipeline";
import type { QuestSeed } from "@/lib/types";

// GET /api/news → { quests: QuestSeed[], generatedAt }
// "Tales from Today": 0–3 quests made from today's real news. Never errors; [] on failure.
//
// Caching (so SerpApi is hit at most ~6x/day):
//  1. unstable_cache keeps a non-empty result in Next's Data Cache for 4h (empty results throw
//     inside the cached fn, so a bad run is never cached and the stale good one is kept).
//  2. Cache-Control s-maxage lets the Vercel CDN serve it without invoking the function.
//  3. The pipeline also memoizes per server instance, and SerpApi GETs use fetch revalidate.
// The handler reads the request, so it is NOT prerendered at build time (no API calls during build).

export const revalidate = 14400; // 4h
export const maxDuration = 120;

type Payload = { quests: QuestSeed[]; generatedAt: string };

const cachedQuests = unstable_cache(
  async (): Promise<Payload> => {
    const { quests } = await getTodaysQuestsDetailed();
    if (!quests.length) throw new Error("no quests (not caching)");
    return { quests, generatedAt: new Date().toISOString() };
  },
  ["news-quests-v1"],
  { revalidate: 14400, tags: ["news-quests"] },
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams; // always read: keeps the route dynamic (no build-time run)
  const dev = process.env.NODE_ENV !== "production";
  const debug = dev && sp.get("debug") === "1";
  const fresh = dev && sp.get("fresh") === "1"; // dev only: bypass caches (costs Muse calls)

  try {
    if (debug || fresh) {
      const { quests, stats } = await getTodaysQuestsDetailed({ fresh });
      return NextResponse.json({ quests, generatedAt: new Date().toISOString(), ...(debug ? { stats } : {}) });
    }
    const payload = await cachedQuests();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.warn(`[api/news] ${(e as Error).message}`);
    return NextResponse.json({ quests: [], generatedAt: new Date().toISOString() } satisfies Payload, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
