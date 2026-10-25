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

// Loudness targets (RMS, dBFS). The narrator's speech measures -13 to -16 dBFS: line cues ~10 dB under her, the
// finale build-up a touch quieter, the payoff hit the loudest story sound (it lands right after her line). Peaks capped.
const TARGET_DB = { line: -24, buildup: -26, payoff: -17 } as const;
const PEAK_CAP = { line: 0.45, buildup: 0.45, payoff: 0.9 } as const;
type Kind = keyof typeof TARGET_DB;
function gainFor(id: string, kind: Kind) {
  const l = level.get(id);
  if (!l || l.rms < 1e-5) return 0;
  const g = Math.pow(10, TARGET_DB[kind] / 20) / l.rms;
  return Math.min(g, PEAK_CAP[kind] / Math.max(l.peak, 1e-3), 8);
}
const GAIN: Kind = "line";
const MAX_SEC = 3;
const FADE = 0.25;

const buffers = new Map<string, Promise<AudioBuffer | null>>();
const level = new Map<string, { rms: number; peak: number }>();
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
      // level every file by LOUDNESS (not peak): a siren and a soft owl both land ~9 dB under the narrator
      if (buf) {
        let peak = 0, ss = 0, n = 0;
        for (let c = 0; c < buf.numberOfChannels; c++)
          for (const v of buf.getChannelData(c)) {
            peak = Math.max(peak, Math.abs(v));
            ss += v * v;
            n++;
          }
        level.set(id, { rms: Math.sqrt(ss / Math.max(1, n)), peak });
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
async function start(raw: string | null | undefined, delaySec: number, gain: Kind = GAIN, maxSec = MAX_SEC, into: Set<{ src: AudioBufferSourceNode; g: GainNode }> = playing) {
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
    const peakGain = gainFor(ok, gain);
    if (!peakGain) return;
    const end = t0 + Math.min(buf.duration, maxSec);
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
    into.add(mine);
    src.onended = () => {
      into.delete(mine);
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
 * A slide's cues (1-3, each on a word of the narration): each plays at about the moment its word is spoken. Cues may
 * overlap each other (CD); they never pause, cut or duck the narrator: they just sit ~10 dB under her.
 */
export async function playStorySfxCues(cues: { id: string; word: number }[] | null | undefined, startDelaySec = 0) {
  if (!FEATURES.storySfx || !cues?.length) return;
  await Promise.all(cues.slice(0, 3).map((c) => start(c.id, startDelaySec + Math.max(0, c.word) * WORD_SEC)));
}

// ---- the finale: a build-up under the last line, then the payoff hit on the result (the biggest sound of the game) ----
const BUILD_GAIN: Kind = "buildup"; // under the narrator's last line
const HIT_GAIN: Kind = "payoff"; // the loudest story sound; it lands as the result shows, right after her line
const building = new Set<{ src: AudioBufferSourceNode; g: GainNode }>();

function fadeOut(set: Set<{ src: AudioBufferSourceNode; g: GainNode }>, sec: number) {
  for (const c of [...set]) {
    try {
      const t = c.g.context.currentTime;
      c.g.gain.cancelScheduledValues(t);
      c.g.gain.setValueAtTime(c.g.gain.value, t);
      c.g.gain.linearRampToValueAtTime(0, t + sec);
      c.src.stop(t + sec + 0.02);
    } catch {}
  }
  set.clear();
}

/** The finale's build-up (up to 8 s; it fades the instant the payoff lands). */
export async function playStoryBuildup(raw: string | null | undefined) {
  if (!FEATURES.storySfx) return;
  fadeOut(building, 0.2);
  await start(raw, 0, BUILD_GAIN, 8, building);
}

/** The payoff hit, exactly on the result: the build-up stops, the hit plays loud. */
export async function playStoryPayoff(raw: string | null | undefined) {
  if (!FEATURES.storySfx) return;
  fadeOut(building, 0.08);
  await start(raw, 0, HIT_GAIN, 3.5);
}

/** Leaving the finale: any build-up still going fades out. */
export function stopStoryBuildup() {
  fadeOut(building, 0.3);
}
