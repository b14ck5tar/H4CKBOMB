import { NextResponse } from "next/server";
import { stats } from "@/server/art/cache";
import { ArtInputError, paintArt } from "@/server/art/sceneArt";
import type { ArtRequest } from "@/server/art/types";

// POST { questId, sceneIndex | "quick", heroes, rating }            → { url, cached, ms, key, fallback? }
// POST { mode: "poster", questId, heroes, title }                   → same shape, 1280×1920 keepsake cover
// GET                                                               → call/cache counters (cost log)
// See src/server/art/README.md.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: ArtRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad JSON" }, { status: 400 });
  }
  try {
    const result = await paintArt(body, new URL(req.url).origin);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ArtInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[scene-art] unexpected:", (e as Error).message);
    return NextResponse.json({ error: "scene-art failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(stats());
}
