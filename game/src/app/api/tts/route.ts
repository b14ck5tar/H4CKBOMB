import OpenAI from "openai";
import { NextResponse } from "next/server";
import { isRating } from "@/lib/rating";
import type { Rating } from "@/lib/types";

// POST /api/tts { text, rating? } → audio/mpeg. The narrator's voice for the big moments (quest intro,
// scene openings, epilogue, reveal). Muse writes every word; this only reads it aloud.
// 503 when there's no key, 429 when rate-limited: the client then falls back to the browser's own voice.

export const maxDuration = 30;

const MODEL = "gpt-4o-mini-tts";
const VOICE = "fable";
const MAX_CHARS = 1200;

const STYLE: Record<Rating, string> = {
  kids: "Narrate like a warm, playful storyteller reading to kids at bedtime. Gentle, smiling, a little silly. Never scary.",
  teens: "Narrate like a late-night radio host telling a spooky-funny story to friends. Warm, a bit mysterious, lively but not over the top.",
  adults: "Narrate like a dry, late-night radio host with a spooky edge, telling a story to grown-up friends. Deadpan timing, never melodramatic.",
};

// The deploy link is public, so cap what one visitor (and one server instance) can spend.
const WINDOW_MS = 10 * 60_000;
const PER_IP = 40;
const PER_INSTANCE = 300;
const hits = new Map<string, number[]>();
let instanceHits: number[] = [];

function allow(ip: string) {
  const now = Date.now();
  const fresh = (xs: number[]) => xs.filter((t) => now - t < WINDOW_MS);
  instanceHits = fresh(instanceHits);
  const mine = fresh(hits.get(ip) ?? []);
  if (mine.length >= PER_IP || instanceHits.length >= PER_INSTANCE) return false;
  mine.push(now);
  instanceHits.push(now);
  hits.set(ip, mine);
  if (hits.size > 5000) hits.clear();
  return true;
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "no voice key" }, { status: 503 });

  let body: { text?: unknown; rating?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const text = String(body.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });
  const rating: Rating = isRating(body.rating) ? body.rating : "teens";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(ip)) return NextResponse.json({ error: "slow down" }, { status: 429 });

  try {
    const client = new OpenAI({ apiKey: key });
    const res = await client.audio.speech.create(
      { model: MODEL, voice: VOICE, input: text, instructions: STYLE[rating], response_format: "mp3" },
      { timeout: 20_000, maxRetries: 1 },
    );
    const audio = await res.arrayBuffer();
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    // Never echo the provider's error body: it can include account details.
    console.error("[tts] failed:", (e as Error).message?.slice(0, 200));
    return NextResponse.json({ error: "voice failed" }, { status: 502 });
  }
}
