import { speak } from "@/server/tts";
import { isVoice } from "@/lib/voices";

// POST { text, voice, style, ahead? } -> audio/wav (X-Audio-Ms header = its length, X-Voice-Provider = who read it).
// The narrator's voice for one line. `ahead: true` = text made ahead of time (openers), which may use a slower,
// more expressive model.
// Clips are cached by (voice, style, text). On any failure: 502, and the TV just shows the text.

export const runtime = "nodejs";
export const maxDuration = 30;

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
    const clip = await speak(body.voice, style, text, { ahead: body.ahead === true });
    return new Response(new Uint8Array(clip.wav), {
      headers: { "Content-Type": "audio/wav", "X-Audio-Ms": String(clip.ms), "X-Voice-Rate": String(clip.rate), "X-Voice-Provider": clip.provider, "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    console.error("[tts] failed:", (e as Error).message);
    return new Response("tts failed", { status: 502 });
  }
}
