"use client";

import { FEATURES } from "@/lib/features";
import { canStart, getBuses, isAllMuted, isServer, isSilenced } from "./context";
import { playSfx, type SfxName } from "./sfx";
import { STORY_SFX_IDS, pickStorySfx } from "@/lib/storySfx";

/**
 * Story sound effects (CD, Sun AM): ONE short sound per slide (the opener scene, each outcome, the finale, each
 * montage panel), playing under the narration. Muse picks an id from STORY_SFX_IDS (lib/storySfx.ts) in its turn and
 * ending JSON; the TV calls playStorySfx(id) when the slide shows. Never stacked (a new one fades the last one out),
 * at most 3 s, about 9 dB under the narrator. Files: game/public/sfx/<id>.mp3 (ElevenLabs Sound Effects, made once).
 * Behind FEATURES.storySfx: off = silent, nothing loads.
 */
export { STORY_SFX_IDS, pickStorySfx }; // the library (ids with a file in game/public/sfx), shared with the host

// Without an ElevenLabs file, these ids play the house engine's own sound instead (the small fallback set).
export const STORY_SFX_ENGINE: Record<string, SfxName> = {
  whoosh: "whoosh",
  rumble: "boom",
  crash: "thud",
  heartbeat: "heartbeat",
  "ticking-clock": "timerTick",
  "magic-shimmer": "reveal",
  drumroll: "drumroll",
};

const GAIN = 0.35; // ~ -9 dB: under the narrator (the voice peaks near full scale, these files near -3 dBFS)
const MAX_SEC = 3;
const FADE = 0.25;

const buffers = new Map<string, Promise<AudioBuffer | null>>();
const level = new Map<string, number>();
let playing = new Set<{ src: AudioBufferSourceNode; g: GainNode }>(); // this slide's sounds

function load(id: string): Promise<AudioBuffer | null> {
  const hit = buffers.get(id);
  if (hit) return hit;
  const b = getBuses();
  if (!b) return Promise.resolve(null);
  const p = fetch(`/sfx/${id}.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((ab) => (ab ? b.ctx.decodeAudioData(ab) : null))
    .then((buf) => {
      // level every file to the same peak (-3 dBFS), so a loud thunder and a soft owl sit at the same height
      if (buf) {
        let peak = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) for (const v of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
        level.set(id, peak > 0.01 ? 0.7 / peak : 1);
      }
      return buf;
    })
    .catch(() => null);
  buffers.set(id, p);
  return p;
}

/** Warm the files a story will use (call when the story starts). Safe to call any time. */
export function preloadStorySfx(ids: (string | null | undefined)[]) {
  if (!FEATURES.storySfx || isServer() || !canStart()) return;
  for (const x of ids) {
    const id = pickStorySfx(x);
    if (id) void load(id);
  }
}

/** Fade out the story sounds that are playing (a new slide's sounds never stack on the last slide's). */
export function stopStorySfx(sec = 0.15) {
  const all = [...playing];
  playing = new Set();
  for (const c of all) {
    try {
      const t = c.g.context.currentTime;
      c.g.gain.cancelScheduledValues(t);
      c.g.gain.setValueAtTime(c.g.gain.value, t);
      c.g.gain.linearRampToValueAtTime(0, t + sec);
      c.src.stop(t + sec + 0.02);
    } catch {
      /* already stopped */
    }
  }
}

/** Start one sound (no stopping of others). */
async function start(raw: string | null | undefined, delaySec: number) {
  const ok = pickStorySfx(raw);
  if (!FEATURES.storySfx || isServer() || !ok) return;
  if (isAllMuted() || isSilenced() || !canStart()) return;
  const b = getBuses();
  if (!b) return;
  const buf = await load(ok);
  if (!buf) {
    const engine = STORY_SFX_ENGINE[ok];
    if (engine) setTimeout(() => playSfx(engine, { volume: 0.6 }), Math.max(0, delaySec) * 1000); // no file: the house sound
    return;
  }
  try {
    const ctx = b.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + Math.max(0, delaySec);
    const peakGain = GAIN * Math.min(4, level.get(ok) ?? 1);
    const end = t0 + Math.min(buf.duration, MAX_SEC);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peakGain, t0 + 0.02);
    g.gain.setValueAtTime(peakGain, Math.max(t0 + 0.02, end - FADE));
    g.gain.linearRampToValueAtTime(0, end);
    src.connect(g);
    g.connect(b.sfx);
    src.start(t0);
    src.stop(end + 0.02);
    const mine = { src, g };
    playing.add(mine);
    src.onended = () => {
      playing.delete(mine);
      try {
        src.disconnect();
        g.disconnect();
      } catch {}
    };
  } catch {
    /* never let audio break the game */
  }
}

/** Play one slide's sound (an id from STORY_SFX_IDS). Unknown, missing or switched off = silent. */
export async function playStorySfx(raw: string | null | undefined, delaySec = 0) {
  if (!FEATURES.storySfx) return;
  stopStorySfx();
  await start(raw, delaySec);
}

const WORD_SEC = 0.37; // the narrator's pace (Combo Flash, ~2.7 words a second): a cue on word 8 plays ~3 s in

/**
 * A slide's cues (1-3, each on a word of the narration): the last slide's sounds fade out, then each cue plays at
 * about the moment its word is spoken. Cues of one slide may overlap; they never touch the narrator.
 */
export async function playStorySfxCues(cues: { id: string; word: number }[] | null | undefined, startDelaySec = 0) {
  if (!FEATURES.storySfx || !cues?.length) return;
  stopStorySfx();
  await Promise.all(cues.slice(0, 3).map((c) => start(c.id, startDelaySec + Math.max(0, c.word) * WORD_SEC)));
}
