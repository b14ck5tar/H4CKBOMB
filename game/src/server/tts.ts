import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { VOICES, type VoiceId } from "@/lib/voices";

// The narrator's voice (design/24 P5). Meta has no TTS model, so this is the one job that leaves Meta:
// Gemini TTS, with a style prompt per story. Raw 24 kHz 16-bit mono PCM comes back; we wrap it as WAV.
// Every clip is cached by (voice, style, text): in memory, then on disk, so a replayed line is free and instant.

const MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"]; // the lite model only when the first is rate-limited (429)
const RATE = 24_000;
const DIR = path.join(os.tmpdir(), "group-project-tts");
type Clip = { wav: Buffer; ms: number };
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
    const clip = { wav, ms: Math.round(((wav.length - 44) / (RATE * 2)) * 1000) };
    mem.set(id, clip);
    return clip;
  } catch {}
  const running = inflight.get(id);
  if (running) return running;
  const p = (async () => {
    const t0 = Date.now();
    let res = await call(MODELS[0], voice, style, text, timeoutMs);
    if (res.status === 429) res = await call(MODELS[1], voice, style, text, timeoutMs);
    if (!res.ok) throw new Error(`tts HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const data = j?.candidates?.[0]?.content?.parts?.find((x: { inlineData?: { data?: string } }) => x?.inlineData?.data)?.inlineData?.data;
    if (!data) throw new Error("tts: no audio");
    const wav = wavFromPcm(Buffer.from(data, "base64"));
    const clip = { wav, ms: Math.round(((wav.length - 44) / (RATE * 2)) * 1000) };
    console.log(`[tts] ${voice} ${clip.ms}ms of audio in ${Date.now() - t0}ms (${text.length} chars)`);
    mem.set(id, clip);
    if (mem.size > 200) mem.delete(mem.keys().next().value as string);
    try {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(file, wav);
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
