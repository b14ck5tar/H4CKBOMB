import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FEATURES } from "@/lib/features";
import { VOICE_DIRECTION, VOICES, type VoiceId } from "@/lib/voices";

// The narrator's voice (design/24 P5). Meta has no TTS model, so this is the one job that leaves Meta.
// Providers, in order: ElevenLabs when TTS_PROVIDER=elevenlabs (streamed pcm_24000), then OpenAI gpt-4o-mini-tts (style
// line as `instructions`), then Gemini TTS (style prompt, its lite model on 429). All return raw 24 kHz 16-bit mono PCM,
// which we wrap as WAV (exact length for the text sync).
// Every clip is cached by (voice, style, text): in memory, then on disk, so a replayed line is free and instant.
// `rate` = how fast the TV should play it: OpenAI reads at a natural pace (1), Gemini's calm style is slow (1.25).

const MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"]; // the lite model only when the first is rate-limited (429)
const RATE = 24_000;
const DIR = path.join(os.tmpdir(), "group-project-tts");
type Clip = { wav: Buffer; ms: number; rate: number; provider: "elevenlabs" | "openai" | "gemini" };
const g = globalThis as unknown as { __gpTts?: Map<string, Clip>; __gpTtsInflight?: Map<string, Promise<Clip | null>> };
const mem = (g.__gpTts ??= new Map());
const inflight = (g.__gpTtsInflight ??= new Map()) as Map<string, Promise<Clip | null>>;

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

/**
 * Raw 16-bit PCM for playback: an even byte count, scaled down only if it would clip, and a 5 ms
 * fade at each end so a clip never starts or stops with a click.
 */
/**
 * Smooth delivery (CD: "a bit choppy"): any pause longer than 0.3 s inside a line is shortened to 0.3 s and lead-in
 * silence to 0.06 s. Only near-silence (under -38 dBFS: silence and breath noise) is removed, with a 6 ms crossfade
 * at each cut, so nothing is time-stretched (that is what sounded echoey).
 */
export function trimPauses(pcm: Buffer): Buffer {
  const n = pcm.length / 2;
  const at = (i: number) => pcm.readInt16LE(i * 2);
  const QUIET = 410; // -38 dBFS: silence and breath noise, never a word
  const win = Math.floor(RATE * 0.01); // 10 ms blocks
  const maxGap = Math.floor(RATE * 0.3);
  const lead = Math.floor(RATE * 0.06);
  const xf = Math.floor(RATE * 0.006);
  const loud: boolean[] = [];
  for (let b = 0; b * win < n; b++) {
    let peak = 0;
    for (let i = b * win; i < Math.min(n, (b + 1) * win); i++) peak = Math.max(peak, Math.abs(at(i)));
    loud.push(peak > QUIET);
  }
  const first = loud.indexOf(true);
  if (first < 0) return pcm;
  // keep-ranges in samples
  const keep: [number, number][] = [];
  let start = Math.max(0, first * win - lead);
  let b = first;
  while (b < loud.length) {
    if (loud[b]) { b++; continue; }
    let e = b;
    while (e < loud.length && !loud[e]) e++;
    const gap = (e - b) * win;
    if (e < loud.length && gap > maxGap) {
      // keep half the allowed pause on each side of the cut
      keep.push([start, b * win + maxGap / 2]);
      start = e * win - maxGap / 2;
    }
    b = e;
  }
  const last = loud.lastIndexOf(true);
  const end = Math.min(n, (last + 1) * win + Math.floor(RATE * 0.25)); // 0.25 s of tail after the last sound
  keep.push([start, end]);
  if (keep.length === 1 && keep[0][0] === 0 && end === n) return pcm;
  const out: number[] = [];
  for (const [a, z] of keep) {
    for (let i = a; i < z; i++) {
      const v = at(i);
      const k = i - a;
      if (out.length >= xf && k < xf) {
        // crossfade into the previous range's tail
        const j = out.length - xf + k;
        const t = k / xf;
        out[j] = Math.round(out[j] * (1 - t) + v * t);
        continue;
      }
      out.push(v);
    }
  }
  const buf = Buffer.alloc(out.length * 2);
  for (let i = 0; i < out.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, out[i])), i * 2);
  return buf;
}

function cleanPcm(raw: Buffer): Buffer {
  const pcm = trimPauses(raw.length % 2 ? raw.subarray(0, raw.length - 1) : Buffer.from(raw));
  const n = pcm.length / 2;
  let peak = 1;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)));
  // OpenAI's audio passes through untouched (the CD heard static only after processing): never boosted, only
  // scaled down if it would clip.
  const ceiling = 32_000;
  const gain = peak > ceiling ? ceiling / peak : 1;
  const fade = Math.min(Math.floor(RATE * 0.005), Math.floor(n / 2)); // 5 ms fade in
  const fadeOut = Math.min(Math.floor(RATE * 0.02), Math.floor(n / 2)); // 20 ms fade out: an end never clicks
  for (let i = 0; i < n; i++) {
    let g = gain;
    if (i < fade) g *= i / fade;
    else if (i >= n - fadeOut) g *= (n - 1 - i) / fadeOut;
    if (g !== 1) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.readInt16LE(i * 2) * g))), i * 2);
  }
  return pcm;
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
      body: JSON.stringify(
        VOICES[voice].model
          ? // tts-1-hd voices (shimmer): no instructions, natural speed
            { model: VOICES[voice].model, voice: VOICES[voice].openai, input: text, response_format: "pcm" }
          : {
              model: "gpt-4o-mini-tts",
              voice: VOICES[voice].openai,
              input: text,
              instructions: `${style || "Read this as a storyteller"}. ${VOICE_DIRECTION}`,
              response_format: "pcm",
            },
      ),
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

// ElevenLabs (TTS_PROVIDER=elevenlabs). The CD found OpenAI "robotic" with harsh S sounds; bake-off in
// devpost-media/voice-bakeoff. Flash v2.5 reads live lines (~180 ms to first byte); v3 is more expressive but had a
// 10.7 s cold start, so it only reads text made ahead of time (`ahead`, e.g. openers during the vote).
type ElevenModel = "eleven_flash_v2_5" | "eleven_v3";
type ElevenSettings = { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean; speed?: number };
// "Combo" (CD pick, Sun AM): Flash's crisp sound with v3's expression. Every live line reads with it (instant).
const FLASH: ElevenSettings = { stability: 0.2, similarity_boost: 0.75, style: 0.65, use_speaker_boost: true, speed: 1.08 };
const V3: ElevenSettings = { stability: 0, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true }; // v3 takes stability 0 / 0.5 / 1
// ONE narrator for every story (CD, Sun AM): Sarah, at the bake-off clip's settings the CD picked (v3 funny: stability 0,
// similarity 0.8, style 0.45, speaker boost). Every persona id maps to her, so casting and host.ts stay as they are.
const SARAH = { voiceId: "EXAVITQu4vr4xnSDxMaL", voice: "Sarah", live: "eleven_flash_v2_5", ahead: "eleven_v3", settings: { eleven_flash_v2_5: FLASH, eleven_v3: V3 } } as const;
export const ELEVEN: Record<VoiceId, { voiceId: string; voice: string; live: ElevenModel; ahead: ElevenModel; settings: Partial<Record<ElevenModel, ElevenSettings>> }> = {
  vesper: SARAH,
  hollis: SARAH,
  wren: SARAH,
  juniper: SARAH,
};
const ELEVEN_FIRST_BYTE_MS = 4_000; // slower than this to start = fall back to OpenAI
let elevenOffUntil = 0; // out of characters / bad key: skip ElevenLabs for a while instead of paying the wait every line

// ---- credit guard: ONE provider per game, so the narrator's voice never switches mid-game ----
// Billing (measured from the `character-cost` header): v3 = 1 credit per character, Flash v2.5 = 0.5.
// Estimated per game with v3 for openers/scenes/endings and Flash for live lines (3 players): Full ~2,500,
// Quick ~2,000, judge ~1,150 (its stored opener is free once cached). The real number is logged after each game.
const GAME_CREDITS = Number(process.env.ELEVENLABS_GAME_CREDITS) || 3_000; // less than this left = OpenAI for the game
const NEW_GAME_IDLE_MS = 6 * 60_000; // no narration this long = the next line starts a new game (when the TV doesn't say)
type Decision = { provider: "elevenlabs" | "openai"; remaining: number | null; why: string; at: number; credits: number };
const gs = globalThis as unknown as { __gpTtsGame?: { decision: Promise<Decision> | null; lastAt: number; current: Decision | null; subUntil: number } };
const game = (gs.__gpTtsGame ??= { decision: null, lastAt: 0, current: null, subUntil: 0 });

/** Credits left this month, from the subscription endpoint. null = unknown (the key lacks the User: Read permission). */
async function elevenRemaining(): Promise<number | null> {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k || Date.now() < game.subUntil) return null;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": k }, signal: AbortSignal.timeout(3_000) });
    if (!res.ok) {
      game.subUntil = Date.now() + 10 * 60_000; // don't ask again for a while
      console.warn(`[tts] can't read ElevenLabs credits (HTTP ${res.status}); give the key the "User: Read" permission for the guard`);
      return null;
    }
    const j = (await res.json()) as { character_limit?: number; character_count?: number };
    return typeof j.character_limit === "number" && typeof j.character_count === "number" ? j.character_limit - j.character_count : null;
  } catch {
    return null;
  }
}

async function decide(): Promise<Decision> {
  const at = Date.now();
  if (process.env.TTS_PROVIDER !== "elevenlabs" || !process.env.ELEVENLABS_API_KEY) return { provider: "openai", remaining: null, why: "TTS_PROVIDER is not elevenlabs", at, credits: 0 };
  if (Date.now() < elevenOffUntil) return { provider: "openai", remaining: null, why: "ElevenLabs paused (out of credits or a key error)", at, credits: 0 };
  const remaining = await elevenRemaining();
  if (remaining != null && remaining < GAME_CREDITS)
    return { provider: "openai", remaining, why: `only ${remaining} ElevenLabs credits left (a game needs ~${GAME_CREDITS})`, at, credits: 0 };
  return { provider: "elevenlabs", remaining, why: remaining == null ? "credits unknown" : `${remaining} credits left`, at, credits: 0 };
}

/**
 * The provider for the current game. Decided once at game start (the TV calls GET /api/tts?start=1), or on the first
 * line after NEW_GAME_IDLE_MS of quiet, then kept for the whole game.
 */
export function gameProvider(start = false): Promise<Decision> {
  const now = Date.now();
  if (start || !game.decision || now - game.lastAt > NEW_GAME_IDLE_MS) {
    const prev = game.current;
    if (prev && prev.provider === "elevenlabs") console.log(`[tts] last game used ${Math.round(prev.credits)} ElevenLabs credits`);
    game.current = null;
    game.decision = decide().then((d) => {
      game.current = d;
      console.log(`[tts] this game reads with ${d.provider} (${d.why})`);
      return d;
    });
  }
  game.lastAt = now;
  return game.decision;
}

/** v3 reads [audio tags]; Flash would say them out loud, so they're dropped for it. */
function elevenText(model: ElevenModel, text: string) {
  if (model !== "eleven_v3") return text.replace(/\[[^\]]{1,30}\]\s*/g, "").trim();
  // v3 stops on its last sound (the bake-off's "cut-off last word"); a closing pause tag lets it finish cleanly
  // (measured on Sarah: the last 20 ms went from -32 dB, cut, to a clean decay at -91 dB).
  return /\]\s*$/.test(text) ? text : `${text} [short pause]`;
}

// Starter allows 3 requests at once (a 4th gets HTTP 429). The host asks for the outcome, the scene and the next turn
// line together, so requests queue here instead.
const ELEVEN_MAX_AT_ONCE = 3;
let elevenActive = 0;
const elevenQueue: (() => void)[] = [];

async function eleven(voice: VoiceId, model: ElevenModel, text: string, timeoutMs: number, voiceIdOverride?: string): Promise<Buffer | null> {
  if (elevenActive >= ELEVEN_MAX_AT_ONCE) await new Promise<void>((r) => elevenQueue.push(r));
  elevenActive++;
  try {
    return await elevenOnce(voice, model, text, timeoutMs, voiceIdOverride);
  } finally {
    elevenActive--;
    elevenQueue.shift()?.();
  }
}

/** Streams 24 kHz PCM; aborts if the first audio byte takes over 4 s. null on any failure. */
async function elevenOnce(voice: VoiceId, model: ElevenModel, text: string, timeoutMs: number, voiceIdOverride?: string): Promise<Buffer | null> {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k || Date.now() < elevenOffUntil) return null;
  const cfg = ELEVEN[voice];
  const ctrl = new AbortController();
  const whole = setTimeout(() => ctrl.abort(new Error(`no full clip in ${timeoutMs} ms`)), timeoutMs);
  const first = setTimeout(() => ctrl.abort(new Error(`no first byte in ${ELEVEN_FIRST_BYTE_MS} ms`)), ELEVEN_FIRST_BYTE_MS);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceIdOverride ?? cfg.voiceId}/stream?output_format=pcm_24000`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": k },
      signal: ctrl.signal,
      body: JSON.stringify({ text: elevenText(model, text), model_id: model, voice_settings: cfg.settings[model] ?? FLASH }),
    });
    if (!res.ok || !res.body) {
      const why = (await res.text().catch(() => "")).slice(0, 160).replace(/\s+/g, " ");
      // 401 = out of characters or a bad key, 402/403 = plan: stop trying for 10 minutes. Other errors: just this line.
      if ([401, 402, 403].includes(res.status)) elevenOffUntil = Date.now() + 10 * 60_000;
      console.warn(`[tts] elevenlabs HTTP ${res.status} (${why})`);
      return null;
    }
    const cost = Number(res.headers.get("character-cost"));
    if (Number.isFinite(cost) && game.current) game.current.credits += cost;
    const parts: Buffer[] = [];
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) {
        if (!parts.length) clearTimeout(first);
        parts.push(Buffer.from(value));
      }
    }
    const pcm = Buffer.concat(parts);
    return pcm.length > 2_400 ? pcm : null; // under 50 ms of audio = something went wrong
  } catch (e) {
    console.warn(`[tts] elevenlabs ${model} failed (${(e as Error).message})`);
    return null;
  } finally {
    clearTimeout(first);
    clearTimeout(whole);
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

/** `ahead: true` asks for v3 (nothing sends it today: every live line reads with the Combo Flash settings). */
export type SpeakOpts = { ahead?: boolean; timeoutMs?: number; characterVoices?: boolean };

/** Reads a clip from memory, then disk, else makes it once (concurrent asks share one call) and caches it. */
async function cached(id: string, provider: Clip["provider"], make: () => Promise<Clip | null>): Promise<Clip | null> {
  const hit = mem.get(id);
  if (hit) return hit;
  const file = path.join(DIR, `${id}.wav`);
  try {
    // committed clips first (game/voice-cache: the judge stories' openers, voiced once), then this machine's cache
    let wav: Buffer;
    try {
      wav = fs.readFileSync(path.join(process.cwd(), "voice-cache", `${id}.wav`));
    } catch {
      wav = fs.readFileSync(file);
    }
    // every clip plays at its natural speed (time-stretching in the browser adds static)
    const clip: Clip = { wav, ms: Math.round(((wav.length - 44) / (RATE * 2)) * 1000), rate: 1, provider };
    mem.set(id, clip);
    return clip;
  } catch {}
  const running = inflight.get(id);
  if (running) return running;
  const p = make().then((clip) => {
    if (!clip) return null;
    mem.set(id, clip);
    if (mem.size > 200) mem.delete(mem.keys().next().value as string);
    try {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(file, clip.wav);
    } catch {}
    return clip;
  });
  inflight.set(id, p);
  try {
    return await p;
  } finally {
    inflight.delete(id);
  }
}

function toClip(pcm: Buffer, provider: Clip["provider"]): Clip {
  const wav = wavFromPcm(cleanPcm(pcm));
  return { wav, ms: Math.round(((wav.length - 44) / (RATE * 2)) * 1000), rate: 1, provider };
}

/** ElevenLabs, cached by (voice, model, settings, text): the style line doesn't change its read, so it's not in the key. */
async function elevenClip(voice: VoiceId, text: string, model: ElevenModel, timeoutMs: number, onlyIfMade = false, as?: { voiceId: string; voice: string }) {
  const cfg = as ? { ...ELEVEN[voice], ...as } : ELEVEN[voice];
  const body = elevenText(model, text);
  const id = crypto.createHash("sha1").update(`el3|${cfg.voiceId}|${model}|${JSON.stringify(cfg.settings[model] ?? FLASH)}|${body}`).digest("hex");
  return cached(id, "elevenlabs", async () => {
    if (onlyIfMade) return null; // a lookup only: is this line already voiced (committed or cached)?
    const t0 = Date.now();
    const pcm = await eleven(voice, model, text, timeoutMs, as?.voiceId);
    if (!pcm) return null;
    const clip = toClip(pcm, "elevenlabs");
    console.log(`[tts] elevenlabs ${model} ${cfg.voice} ${clip.ms}ms of audio in ${Date.now() - t0}ms (${body.length} chars)`);
    return clip;
  });
}

/** OpenAI first, then Gemini; cached by (voice, style, text). Throws when both fail. */
async function openaiClip(voice: VoiceId, style: string, text: string, timeoutMs: number) {
  const id = crypto.createHash("sha1").update(`v6|${voice}|${style}|${text}`).digest("hex"); // v6: natural speed, smooth direction, pauses trimmed
  const clip = await cached(id, "openai", async () => {
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
    const clip = toClip(pcm, provider);
    console.log(`[tts] ${provider} ${voice} ${clip.ms}ms of audio in ${Date.now() - t0}ms (${text.length} chars)`);
    return clip;
  });
  if (!clip) throw new Error("tts: no audio");
  return clip;
}

// The finale's "Alright, everyone…" in the CD's favorite read (host style B: v3, [playfully], style 0.8), voiced once
// and committed; spliced in front of the rest of the finale line, which reads live on Flash.
const FINALE_INTRO = /^Alright, everyone…\s*/;
let finaleIntro: Buffer | null | undefined;
function finaleIntroPcm(): Buffer | null {
  if (finaleIntro !== undefined) return finaleIntro;
  try {
    finaleIntro = cleanPcm(fs.readFileSync(path.join(process.cwd(), "voice-cache", "finale-intro.wav")).subarray(44));
  } catch {
    finaleIntro = null;
  }
  return finaleIntro;
}

/** A live ElevenLabs line: Flash, then one staggered retry. null = this line is text only. */
async function elevenLive(voice: VoiceId, text: string, timeoutMs: number) {
  const cfg = ELEVEN[voice];
  let clip = await elevenClip(voice, text, cfg.live, timeoutMs);
  if (!clip && Date.now() >= elevenOffUntil) {
    await new Promise((r) => setTimeout(r, 400)); // one retry, staggered
    clip = await elevenClip(voice, text, cfg.live, timeoutMs);
  }
  return clip;
}

/**
 * One narrator line as WAV, from the provider picked for this game (gameProvider). On ElevenLabs: a line already
 * voiced on v3 (the judge openers) plays from its clip; the finale gets the committed "Alright, everyone…" plus the
 * rest live; every other line reads live on Flash at the Combo settings. A failed line tries Flash once more, then
 * throws (that line is text only): it never falls back to OpenAI mid-game, so the voice never switches. An
 * out-of-credits error stops ElevenLabs for 10 minutes, so the next game picks OpenAI. On OpenAI: OpenAI, then Gemini.
 */
async function speakOne(voice: VoiceId, style: string, text: string, opts: SpeakOpts = {}): Promise<Clip> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  if ((await gameProvider()).provider === "elevenlabs") {
    const cfg = ELEVEN[voice];
    // 1) already voiced on v3 (the judge openers in game/voice-cache): play that, instantly
    const made = await elevenClip(voice, text, cfg.ahead, timeoutMs, true);
    if (made) return made;
    // 2) asked for v3 explicitly (nothing does today): v3, else the live path
    if (opts.ahead) {
      const v3 = await elevenClip(voice, text, cfg.ahead, timeoutMs);
      if (v3) return v3;
    }
    // 3) the finale: the committed "Alright, everyone…" + the rest live on Flash
    const intro = FINALE_INTRO.exec(text);
    const head = intro ? finaleIntroPcm() : null;
    if (intro && head) {
      const rest = await elevenLive(voice, text.slice(intro[0].length), timeoutMs);
      if (rest) {
        const gap = Buffer.alloc(Math.floor(RATE * 0.08) * 2); // a short breath between the two reads
        const wav = wavFromPcm(Buffer.concat([head, gap, rest.wav.subarray(44)]));
        return { wav, ms: Math.round(((wav.length - 44) / (RATE * 2)) * 1000), rate: 1, provider: "elevenlabs" };
      }
    }
    // 4) every other line: live on Flash at the Combo settings (instant)
    const clip = await elevenLive(voice, text, timeoutMs);
    if (clip) return clip;
    throw new Error("elevenlabs could not read this line: text only (no mid-game switch to another voice)");
  }
  return openaiClip(voice, style, text, timeoutMs);
}

// ---- character voices (CD, Sun AM; FEATURES.characterVoices) ----
// Sarah reads the narration; each "quoted" line reads in its speaker's own voice, as ONE clip (back to back, never
// overlapping, so the TV's text sync stays right). The speaker is the few words before the quote ("And the bridge
// inspector? Very calmly:" -> "bridge inspector"); the same name always gets the same voice, in every game.
const CHAR_VOICES = {
  m: [
    { voiceId: "nPczCjzI2devNBz1zQrb", voice: "Brian" }, // deep, resonant
    { voiceId: "IKne3meq5aSn9XLyUdCD", voice: "Charlie" }, // young, natural
  ],
  f: [
    { voiceId: "cgSgspJ2msm6clMCkdW9", voice: "Jessica" }, // playful
    { voiceId: "pFZP5JQG7iQjIQuC4Bku", voice: "Lily" }, // British, velvety
  ],
};
const FEMALE = /\b(she|her|woman|lady|girl|queen|princess|mother|mom|mum|grandma|granny|aunt|sister|wife|daughter|mrs|ms|miss|madam|ivy|nun)\b/i;
const MALE = /\b(he|him|man|guy|boy|king|prince|father|dad|grandpa|uncle|brother|husband|son|mr|mister|sir|batman|monk|foreman)\b/i;

export function speakerOf(before: string) {
  let t = before.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    t = t.replace(/[\s:;,.!?…]+$/, "");
    t = t.replace(/\s*\b(?:very|so|quite)?\s*(?:calmly|softly|quietly|loudly|slowly|sadly|proudly|gently|firmly|brightly|flatly)$/i, "");
    t = t.replace(/\s*\b(?:says|said|asks|asked|shouts|shouted|whispers|whispered|replies|replied|adds|added|yells|yelled|mutters|muttered|calls|called)$/i, "");
  }
  // only the last sentence ("…it can find. And Batman" -> "And Batman")
  t = t.slice(Math.max(t.lastIndexOf(". "), t.lastIndexOf("! "), t.lastIndexOf("? "), t.lastIndexOf("; ")) + 1).trim();
  const w = t.split(" ").slice(-3);
  while (w.length > 1 && /^(and|then|the|a|an|but|so|while|now)$/i.test(w[0])) w.shift();
  return w.join(" ").toLowerCase();
}

export function voiceForSpeaker(name: string, near = "") {
  const h = parseInt(crypto.createHash("sha1").update(name || "someone").digest("hex").slice(0, 8), 16);
  const nf = FEMALE.test(near) && !MALE.test(near);
  const nm = MALE.test(near) && !FEMALE.test(near);
  const g: "f" | "m" = FEMALE.test(name) ? "f" : MALE.test(name) ? "m" : nf ? "f" : nm ? "m" : h % 2 ? "f" : "m";
  const pool = CHAR_VOICES[g];
  return pool[h % pool.length];
}

async function speakWithCharacters(voice: VoiceId, style: string, text: string, opts: SpeakOpts): Promise<Clip | null> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const parts: { text: string; as?: { voiceId: string; voice: string } }[] = [];
  const re = /"([^"]{2,})"/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index);
    if (before.trim()) parts.push({ text: before.trim() });
    const who = speakerOf(text.slice(Math.max(0, m.index - 80), m.index));
    parts.push({ text: m[1].trim(), as: voiceForSpeaker(who, text.slice(Math.max(0, m.index - 160), m.index)) });
    last = m.index + m[0].length;
  }
  const after = text.slice(last);
  if (after.trim()) parts.push({ text: after.trim() });
  if (!parts.some((p) => p.as)) return null;
  const pcm: Buffer[] = [];
  const gap = Buffer.alloc(Math.floor(RATE * 0.14) * 2); // a breath between speakers
  for (const p of parts) {
    let clip: Clip | null = null;
    if (p.as) {
      clip = await elevenClip(voice, p.text, ELEVEN[voice].live, timeoutMs, false, p.as);
      if (!clip) clip = await speakOne(voice, style, `"${p.text}"`, opts).catch(() => null); // Sarah reads it rather than lose it
    } else clip = await speakOne(voice, style, p.text, opts); // narration: throws = this line is text only
    if (!clip) continue;
    if (pcm.length) pcm.push(gap);
    pcm.push(clip.wav.subarray(44));
  }
  if (!pcm.length) return null;
  const wav = wavFromPcm(Buffer.concat(pcm));
  return { wav, ms: Math.round(((wav.length - 44) / (RATE * 2)) * 1000), rate: 1, provider: "elevenlabs" };
}

/**
 * One narrator line as WAV (see speakOne). With character voices on (and ElevenLabs for this game), any "quoted"
 * dialogue reads in its speaker's own voice, joined into the same clip.
 */
export async function speak(voice: VoiceId, style: string, text: string, opts: SpeakOpts = {}): Promise<Clip> {
  const on = opts.characterVoices ?? FEATURES.characterVoices;
  if (on && /"[^"]{2,}"/.test(text) && (await gameProvider()).provider === "elevenlabs") {
    const clip = await speakWithCharacters(voice, style, text, opts);
    if (clip) return clip;
  }
  return speakOne(voice, style, text, opts);
}
