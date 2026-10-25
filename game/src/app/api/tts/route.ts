import { gameProvider, speak } from "@/server/tts";
import { isVoice } from "@/lib/voices";

// POST { text, voice, style, ahead? } -> audio/wav (X-Audio-Ms header = its length, X-Voice-Provider = who read it).
// The narrator's voice for one line. `ahead: true` = text made ahead of time (openers), which may use a slower,
// more expressive model.
// Clips are cached by (voice, style, text). On any failure: 502, and the TV just shows the text.

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET ?start=1 at game start: picks the provider for the whole game (credit guard). Returns which one, no secrets. */
export async function GET(req: Request) {
  const start = new URL(req.url).searchParams.get("start") === "1";
  const d = await gameProvider(start);
  return Response.json({ provider: d.provider, remaining: d.remaining, why: d.why });
}

export async function POST(req: Request) {
  let body: { text?: unknown; voice?: unknown; style?: unknown; ahead?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const text = String(body.text ?? "").replace(/\s+/g, " ").trim().slice(0, 700);
  const style = String(body.style ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 240);
  if (!text || !isVoice(body.voice)) return new Response("need text and a cast voice", { status: 400 });
  try {
    const clip = await speak(body.voice, style, text, { ahead: typeof body.ahead === "boolean" ? body.ahead : undefined });
    return new Response(new Uint8Array(clip.wav), {
      headers: { "Content-Type": "audio/wav", "X-Audio-Ms": String(clip.ms), "X-Voice-Rate": String(clip.rate), "X-Voice-Provider": clip.provider, "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    console.error("[tts] failed:", (e as Error).message);
    return new Response("tts failed", { status: 502 });
  }
}
