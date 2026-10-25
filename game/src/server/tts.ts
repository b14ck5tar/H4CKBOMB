import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { VOICES, type VoiceId } from "@/lib/voices";

// The narrator's voice (design/24 P5). Meta has no TTS model, so this is the one job that leaves Meta.
// Providers, in order: OpenAI gpt-4o-mini-tts (style line as `instructions`), then Gemini TTS (style prompt, its lite
// model on 429). Both return raw 24 kHz 16-bit mono PCM, which we wrap as WAV (exact length for the text sync).
// Every clip is cached by (voice, style, text): in memory, then on disk, so a replayed line is free and instant.
// `rate` = how fast the TV should play it: OpenAI reads at a natural pace (1), Gemini's calm style is slow (1.25).

const MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"]; // the lite model only when the first is rate-limited (429)
const RATE = 24_000;
const DIR = path.join(os.tmpdir(), "group-project-tts");
type Clip = { wav: Buffer; ms: number; rate: number };
const g = globalThis as unknown as { __gpTts?: Map<string, Clip>; __gpTtsInflight?: Map<string, Promise<Clip>> };
const mem = (g.__gpTts ??= new Map());
const inflight = (g.__gpTtsInflight ??= new Map());

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY is not set");
  return k;
}

function wavFromPcm(pcm: Buffer): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** OpenAI first: natural pace, steerable with `instructions`. null when there's no key or it fails. */
async function openai(voice: VoiceId, style: string, text: string, timeoutMs: number): Promise<Buffer | null> {
  const k = process.env.OPENAI_API_KEY;
  if (!k) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: VOICES[voice].openai,
        input: text,
        instructions: `${style || "Read this as a storyteller"}. Brisk, flowing pace, natural, no breaths.`,
        response_format: "pcm",
      }),
    });
    if (!res.ok) {
      console.warn(`[tts] openai HTTP ${res.status}, falling back to Gemini`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.warn(`[tts] openai failed (${(e as Error).message}), falling back to Gemini`);
    return null;
  }
}

async function call(model: string, voice: VoiceId, style: string, text: string, timeoutMs: number) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      contents: [{ parts: [{ text: style ? `${style}:\n${text}` : text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[voice].gemini } } },
      },
    }),
  });
  return res;
}

export async function speak(voice: VoiceId, style: string, text: string, timeoutMs = 20_000): Promise<Clip> {
  const id = crypto.createHash("sha1").update(`${voice}|${style}|${text}`).digest("hex");
  const hit = mem.get(id);
  if (hit) return hit;
  const file = path.join(DIR, `${id}.wav`);
  try {
    const wav = fs.readFileSync(file);
    const rate = fs.existsSync(`${file}.gemini`) ? 1.25 : 1;
    const clip = { wav, ms: Math.round(((wav.length - 44) / (RATE * 2)) * 1000), rate };
    mem.set(id, clip);
    return clip;
  } catch {}
  const running = inflight.get(id);
  if (running) return running;
  const p = (async () => {
    const t0 = Date.now();
    let pcm = await openai(voice, style, text, timeoutMs);
    const provider = pcm ? "openai" : "gemini";
    if (!pcm) {
      let res = await call(MODELS[0], voice, style, text, timeoutMs);
      if (res.status === 429) res = await call(MODELS[1], voice, style, text, timeoutMs);
      if (!res.ok) throw new Error(`tts HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = await res.json();
      const data = j?.candidates?.[0]?.content?.parts?.find((x: { inlineData?: { data?: string } }) => x?.inlineData?.data)?.inlineData?.data;
      if (!data) throw new Error("tts: no audio");
      pcm = Buffer.from(data, "base64");
    }
    const wav = wavFromPcm(pcm);
    const clip = { wav, ms: Math.round(((wav.length - 44) / (RATE * 2)) * 1000), rate: provider === "gemini" ? 1.25 : 1 };
    console.log(`[tts] ${provider} ${voice} ${clip.ms}ms of audio in ${Date.now() - t0}ms (${text.length} chars)`);
    mem.set(id, clip);
    if (mem.size > 200) mem.delete(mem.keys().next().value as string);
    try {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(file, wav);
      if (provider === "gemini") fs.writeFileSync(`${file}.gemini`, "");
    } catch {}
    return clip;
  })();
  inflight.set(id, p);
  try {
    return await p;
  } finally {
    inflight.delete(id);
  }
}
