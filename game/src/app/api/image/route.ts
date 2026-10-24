import { NextResponse } from "next/server";
import { museImage } from "@/server/muse";
import { portraitPrompt, scenePrompt } from "@/server/prompts";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  try {
    if (body.kind === "portrait") {
      // "high" keeps the uncanny tell (low dropped it in testing); ~18 s, hidden behind card reveals.
      const img = await museImage({ prompt: portraitPrompt(body.visual, body.flaw ?? "", body.ability ?? ""), size: "1024x1536", quality: "best" });
      return NextResponse.json(img);
    }
    if (body.kind === "scene") {
      const img = await museImage({ prompt: scenePrompt(body), size: "1920x1080", quality: body.quality === "fast" ? "fast" : "best" });
      return NextResponse.json(img);
    }
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  } catch (e) {
    console.error("[image] failed:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
