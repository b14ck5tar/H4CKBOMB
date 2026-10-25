"use client";

import { FEATURES } from "@/lib/features";
import { canStart, getBuses, isAllMuted, isServer, isSilenced } from "./context";
import { STORY_SFX_IDS, pickStorySfx } from "@/lib/storySfx";

/**
 * Story sound effects (CD, Sun AM): ONE short sound per slide (the opener scene, each outcome, the finale, each
 * montage panel), playing under the narration. Muse picks an id from STORY_SFX_IDS (lib/storySfx.ts) in its turn and
 * ending JSON; the TV calls playStorySfx(id) when the slide shows. Never stacked (a new one fades the last one out),
 * at most 3 s, about 9 dB under the narrator. Files: game/public/sfx/<id>.mp3 (ElevenLabs Sound Effects, made once).
 * Behind FEATURES.storySfx: off = silent, nothing loads.
 */
export { STORY_SFX_IDS, pickStorySfx }; // the library (ids with a file in game/public/sfx), shared with the host

const GAIN = 0.35; // ~ -9 dB: under the narrator (the voice peaks near full scale, these files near -3 dBFS)
const MAX_SEC = 3;
const FADE = 0.25;

const buffers = new Map<string, Promise<AudioBuffer | null>>();
const level = new Map<string, number>();
let current: { src: AudioBufferSourceNode; g: GainNode } | null = null;

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

/** Fade out whatever story sound is playing. */
export function stopStorySfx(sec = 0.15) {
  const c = current;
  current = null;
  if (!c) return;
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

/** Play one slide's sound (an id from STORY_SFX_IDS). Unknown, missing or switched off = silent. */
export async function playStorySfx(raw: string | null | undefined, delaySec = 0) {
  const ok = pickStorySfx(raw);
  if (!FEATURES.storySfx || isServer() || !ok) return;
  if (isAllMuted() || isSilenced() || !canStart()) return;
  const b = getBuses();
  if (!b) return;
  const buf = await load(ok);
  if (!buf) return;
  try {
    stopStorySfx();
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
    current = mine;
    src.onended = () => {
      if (current === mine) current = null;
      try {
        src.disconnect();
        g.disconnect();
      } catch {}
    };
  } catch {
    /* never let audio break the game */
  }
}
