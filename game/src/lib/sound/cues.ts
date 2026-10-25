"use client";

import { rand } from "./dsp";
import type { Kit } from "./instruments";

/**
 * Musical phase cues, played in the key of whatever track is on (so they always sound like part of
 * the score). Each cue writes into its own small Kit, which the engine can fade or cut at any time.
 *   riser    suspense build into a roll (noise + rising synth + accelerating snare roll)
 *   hit      the landing: boom, crash and a chord stab ("up" major, "down" minor, "neutral" open fifth)
 *   finale   a short tension bed: drone, accelerating heartbeat, ticking ostinato, a swell at the end
 *   resolve  the reveal: a warm major chord bloom with a rising pluck arpeggio
 *   yourTurn a soft two-note pluck sting (no bells or dings anywhere in the cues)
 */

export type CueName = "riser" | "hit" | "finale" | "resolve" | "yourTurn";
export const CUE_NAMES: CueName[] = ["riser", "hit", "finale", "resolve", "yourTurn"];

export interface CueOpts {
  /** riser / finale length (ms) */
  ms?: number;
  /** hit colour */
  grade?: "up" | "down" | "neutral";
}

/** How long a cue keeps sounding (ms), so the engine knows when to dispose its Kit. */
export function cueLength(name: CueName, o: CueOpts = {}): number {
  if (name === "riser") return (o.ms ?? 2000) + 400;
  if (name === "finale") return o.ms ?? 8000;
  if (name === "hit") return 2600;
  if (name === "resolve") return 3600;
  return 1600;
}

export function playCue(name: CueName, k: Kit, t0: number, key: number, minor: boolean, o: CueOpts = {}) {
  // keep the root in a comfortable register (F#3..F4)
  let root = key;
  while (root > 65) root -= 12;
  while (root < 54) root += 12;

  if (name === "riser") {
    const sec = Math.max(0.6, Math.min(8, (o.ms ?? 2000) / 1000));
    k.swell(t0, sec, 0.9, 250, 6000, 1.4);
    k.riseTone(root - 12, root + 12, t0, sec, 1);
    let el = 0;
    let n = 0;
    while (el < sec - 0.04 && n < 80) {
      const p = el / sec;
      k.snare(t0 + el, 0.12 + 0.45 * p * p, "rim");
      if (n % 4 === 0) k.tom(t0 + el, 0.2 + 0.3 * p, 70 + 30 * p);
      el += 0.28 - 0.23 * Math.pow(p, 0.7);
      n++;
    }
    return;
  }

  if (name === "hit") {
    const g = o.grade ?? "neutral";
    const chord = g === "up" ? [root, root + 4, root + 7, root + 14] : g === "down" ? [root, root + 3, root + 7, root + 8] : [root, root + 7, root + 12];
    k.kick(t0, 1, { f0: 90, f1: 32, decay: 1.1 });
    k.tom(t0, 0.6, 55);
    k.crash(t0, 1, 2.2);
    k.bass(root - 24, t0, 1.2, 0.9, "sub");
    k.keys(chord, t0, 1.2, 0.75, { strum: 0.006, bright: 1.1 });
    k.pad(chord.map((n) => n + 12), t0, 0.9, 0.5, { attack: 0.02, release: 1.4 });
    k.pluck(chord[chord.length - 1] + 12, t0 + 0.01, 0.45, { type: "triangle", decay: 0.6, bright: 0.7 });
    return;
  }

  if (name === "finale") {
    const sec = Math.max(2, Math.min(20, (o.ms ?? 8000) / 1000));
    k.bass(root - 24, t0, sec, 0.7, "sub");
    k.pad([root - 12, root - 9, root - 6], t0, sec, 0.65, { kind: "hollow", attack: 1.5, release: 1.2, detune: 9 });
    k.pad([root + 25], t0 + 1, sec - 1, 0.18, { kind: "warm", attack: 2.5, release: 1 });
    // heartbeat that speeds up
    let el = 0.2;
    while (el < sec - 0.3) {
      const p = el / sec;
      k.kick(t0 + el, 0.5 + 0.35 * p, { f0: 82, f1: 38, decay: 0.32 });
      k.kick(t0 + el + 0.2 - 0.06 * p, 0.32 + 0.25 * p, { f0: 74, f1: 36, decay: 0.28 });
      el += 0.85 - 0.38 * p;
    }
    // ticking ostinato on a nervous minor second
    const tick = 0.3;
    for (let i = 0, tt = 0.6; tt < sec - 0.2; i++, tt += tick) {
      const p = tt / sec;
      k.pluck(root + 24 + (i % 4 === 3 ? 1 : 0), t0 + tt, 0.12 + 0.18 * p, { type: "sine", decay: 0.14, pan: i % 2 ? 0.4 : -0.4 });
    }
    k.swell(t0 + Math.max(0, sec - 2.2), 2.2, 0.7, 300, 4000, 1.5);
    return;
  }

  if (name === "resolve") {
    const R = minor ? root + 3 : root;
    k.bass(R - 24, t0, 3, 0.75, "sub");
    k.pad([R - 12, R - 5, R, R + 4, R + 7, R + 14], t0, 2.6, 0.7, { attack: 0.45, release: 2.2 });
    k.keys([R, R + 4, R + 7, R + 11], t0 + 0.05, 2.5, 0.5, { strum: 0.05, bright: 0.8 });
    [R + 12, R + 16, R + 19, R + 24].forEach((n, i) => k.pluck(n, t0 + 0.12 + i * 0.09, 0.45 - i * 0.04, { type: "triangle", decay: 0.7, bright: 0.7, pan: rand(-0.4, 0.4) }));
    k.crash(t0, 0.3, 2.6);
    return;
  }

  // yourTurn
  const third = minor ? 3 : 4;
  k.kick(t0, 0.45, { f0: 120, f1: 60, decay: 0.2 });
  for (const n of [root + 12, root + 12 + third, root + 19]) k.pluck(n, t0, 0.5, { type: "triangle", decay: 0.25, bright: 1.2, pan: rand(-0.3, 0.3) });
  k.pluck(root + 7, t0 + 0.02, 0.5, { type: "triangle", decay: 0.5, bright: 0.7, pan: -0.15 });
  k.pluck(root + 12, t0 + 0.16, 0.55, { type: "triangle", decay: 0.7, bright: 0.7, pan: 0.15 });
}
