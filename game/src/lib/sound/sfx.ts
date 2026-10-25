"use client";

import { canStart, getBuses, isAllMuted, isServer } from "./context";
import { EPS, adEnv, cleanup, mtof, pinkNoise, rand, reverbIR, whiteNoise } from "./dsp";

/**
 * The "house" sound effects: one consistent family. Everything is built from the same three
 * ingredients (a glassy FM bell, a soft felt thump, filtered-noise air), tuned to D: D major for
 * good news, D minor / chromatic slides for bad news. A short room reverb glues them together.
 */

export type SfxName =
  | "tap"
  | "pick"
  | "vote"
  | "submit"
  | "join"
  | "diceRoll"
  | "diceLand"
  | "success"
  | "partial"
  | "fail"
  | "nat20"
  | "nat1"
  | "turnStart"
  | "timerTick"
  | "reveal"
  | "finaleShake"
  | "keepsake";

export const SFX_NAMES: SfxName[] = [
  "tap", "pick", "vote", "submit", "join", "diceRoll", "diceLand", "success", "partial", "fail",
  "nat20", "nat1", "turnStart", "timerTick", "reveal", "finaleShake", "keepsake",
];

export interface SfxOpts {
  /** loudness multiplier (1 = designed level) */
  volume?: number;
  /** transpose in semitones */
  pitch?: number;
  /** length for diceRoll / finaleShake (ms) */
  ms?: number;
  /** timerTick: seconds left (alternates tick / tock); 1 gives the brighter last tick */
  index?: number;
  /** timerTick: the final tick */
  final?: boolean;
}

const OUT_LEVEL = 0.42;

let fx: { ctx: AudioContext; out: GainNode; verb: GainNode } | null = null;

function bus() {
  if (fx) return fx;
  const b = getBuses();
  if (!b) return null;
  const { ctx } = b;
  try {
    const out = ctx.createGain();
    out.gain.value = OUT_LEVEL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const verb = ctx.createGain();
    verb.gain.value = 1;
    const conv = ctx.createConvolver();
    conv.buffer = reverbIR(ctx, 1.3, 0.7, 0.008);
    const ret = ctx.createGain();
    ret.gain.value = 0.22;
    out.connect(comp);
    verb.connect(conv);
    conv.connect(ret);
    ret.connect(comp);
    comp.connect(b.sfx);
    fx = { ctx, out, verb };
    return fx;
  } catch {
    return null;
  }
}

/** Voice context: `d` dry destination, `r` reverb send, `p` pitch multiplier. */
interface V {
  c: AudioContext;
  d: AudioNode;
  r: AudioNode;
  t: number;
  p: number;
  o: SfxOpts;
}
type Voice = (v: V) => void;

function run(fn: Voice, o: SfxOpts = {}) {
  if (isServer() || isAllMuted() || !canStart()) return;
  const f = bus();
  if (!f) return;
  const { ctx } = f;
  const go = () => {
    try {
      const g = ctx.createGain();
      g.gain.value = Math.max(0, o.volume ?? 1);
      g.connect(f.out);
      const rs = ctx.createGain();
      rs.gain.value = Math.max(0, o.volume ?? 1);
      rs.connect(f.verb);
      fn({ c: ctx, d: g, r: rs, t: ctx.currentTime + 0.01, p: Math.pow(2, (o.pitch ?? 0) / 12), o });
      // the per-call gains are released after the longest effect (~4 s)
      setTimeout(() => {
        try {
          g.disconnect();
          rs.disconnect();
        } catch {
          /* ignore */
        }
      }, 6000 + (o.ms ?? 0));
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.warn("[sound] sfx failed", e);
    }
  };
  if (ctx.state === "running") return go();
  const asked = performance.now();
  ctx
    .resume()
    .then(() => {
      if (ctx.state === "running" && performance.now() - asked < 400) go();
    })
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/* ingredients                                                         */
/* ------------------------------------------------------------------ */

function bell(v: V, t: number, midi: number, vel: number, decay = 1, ratio = 3.5, index = 1.2, wet = 0.5) {
  const { c } = v;
  const f = mtof(midi) * v.p;
  const car = c.createOscillator();
  car.frequency.value = f;
  const mod = c.createOscillator();
  mod.frequency.value = f * ratio;
  const mg = c.createGain();
  const idx = index * f * ratio;
  mg.gain.setValueAtTime(idx, t);
  mg.gain.exponentialRampToValueAtTime(idx * 0.05 + 0.5, t + decay * 0.4);
  mod.connect(mg);
  mg.connect(car.frequency);
  const amp = c.createGain();
  adEnv(amp.gain, t, vel, 0.002, decay);
  car.connect(amp);
  amp.connect(v.d);
  const ws = c.createGain();
  ws.gain.value = wet;
  amp.connect(ws);
  ws.connect(v.r);
  car.start(t);
  mod.start(t);
  car.stop(t + decay + 0.05);
  mod.stop(t + decay + 0.05);
  cleanup(car, amp, mg, ws);
  cleanup(mod);
}

function blip(v: V, t: number, f0: number, f1: number, dur: number, vel: number, type: OscillatorType = "sine", wet = 0.2) {
  const { c } = v;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0 * v.p, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1 * v.p, t + dur);
  const amp = c.createGain();
  adEnv(amp.gain, t, vel, 0.002, dur);
  o.connect(amp);
  amp.connect(v.d);
  const ws = c.createGain();
  ws.gain.value = wet;
  amp.connect(ws);
  ws.connect(v.r);
  o.start(t);
  o.stop(t + dur + 0.05);
  cleanup(o, amp, ws);
}

function air(v: V, t: number, dur: number, vel: number, type: BiquadFilterType, f0: number, f1?: number, q = 1, attack = 0.002, wet = 0.2, pink = false) {
  const { c } = v;
  const s = c.createBufferSource();
  s.buffer = pink ? pinkNoise(c) : whiteNoise(c);
  s.loop = true;
  const fl = c.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t);
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const amp = c.createGain();
  adEnv(amp.gain, t, vel, attack, dur);
  s.connect(fl);
  fl.connect(amp);
  amp.connect(v.d);
  const ws = c.createGain();
  ws.gain.value = wet;
  amp.connect(ws);
  ws.connect(v.r);
  s.start(t, rand(0, 1.4));
  s.stop(t + dur + 0.05);
  cleanup(s, fl, amp, ws);
}

function thump(v: V, t: number, vel: number, f0 = 140, f1 = 48, dur = 0.28) {
  blip(v, t, f0, f1, dur, vel, "sine", 0.05);
  air(v, t, 0.05, vel * 0.35, "lowpass", 700, 200, 0.7, 0.002, 0.05);
}

/** A soft held chord (triangle voices) that swells and fades: the "glow" under big moments. */
function glow(v: V, t: number, midis: number[], vel: number, attack: number, dur: number) {
  const { c } = v;
  const amp = c.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel, t + attack);
  amp.gain.setTargetAtTime(0, t + attack, dur / 4);
  amp.connect(v.d);
  const ws = c.createGain();
  ws.gain.value = 0.8;
  amp.connect(ws);
  ws.connect(v.r);
  const oscs = midis.map((m) => {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = mtof(m) * v.p;
    o.detune.value = rand(-6, 6);
    o.connect(amp);
    o.start(t);
    o.stop(t + attack + dur + 0.1);
    return o;
  });
  cleanup(oscs[0], amp, ws);
}

/** Plastic dice clacks for `sec`, slowing down like a real roll. */
function rattle(v: V, t: number, sec: number) {
  air(v, t, sec, 0.1, "lowpass", 420, 170, 0.6, 0.05, 0.05);
  let el = 0;
  let n = 0;
  while (el < sec && n < 70) {
    const p = el / sec;
    const tt = t + el;
    const vel = 0.42 * (1 - 0.45 * p) * rand(0.7, 1);
    air(v, tt, rand(0.018, 0.032), vel, "bandpass", rand(2300, 4800), undefined, 4, 0.001, 0.1);
    blip(v, tt, rand(700, 1300), rand(600, 1100), 0.03, vel * 0.22, "triangle", 0.1);
    el += 0.026 + 0.16 * p * p + rand(0, 0.018);
    n++;
  }
}

/* ------------------------------------------------------------------ */
/* the family                                                          */
/* ------------------------------------------------------------------ */

// D major: D5 74, E5 76, F#5 78, A5 81, B5 83, D6 86, E6 88, F#6 90, A6 93
const VOICES: Record<SfxName, Voice> = {
  tap: (v) => {
    const k = rand(0.97, 1.03);
    blip(v, v.t, 1320 * k, 1700 * k, 0.035, 0.26, "sine", 0.1);
    air(v, v.t, 0.012, 0.13, "highpass", 4200, undefined, 0.8, 0.001, 0);
  },
  pick: (v) => {
    blip(v, v.t, 320, 760, 0.07, 0.22, "sine", 0.1);
    bell(v, v.t + 0.02, 81, 0.2, 0.45, 2, 0.8, 0.4);
    bell(v, v.t + 0.06, 86, 0.12, 0.4, 2, 0.6, 0.4);
  },
  vote: (v) => {
    air(v, v.t, 0.05, 0.35, "bandpass", 950, undefined, 3, 0.001, 0.15);
    blip(v, v.t, 440, 300, 0.07, 0.18, "triangle", 0.1);
    bell(v, v.t + 0.025, 86, 0.22, 0.7, 3.5, 1, 0.5);
  },
  submit: (v) => {
    air(v, v.t, 0.24, 0.22, "bandpass", 500, 3600, 1.4, 0.09, 0.3);
    bell(v, v.t + 0.12, 81, 0.24, 0.7, 3.5, 1.1);
    bell(v, v.t + 0.2, 86, 0.26, 1, 3.5, 1.1);
  },
  join: (v) => {
    [74, 78, 81].forEach((m, i) => bell(v, v.t + i * 0.075, m, 0.26, 1.1, 3.5, 1));
    bell(v, v.t + 0.23, 86, 0.2, 1.4, 3.5, 1);
    bell(v, v.t + 0.3, 93, 0.06, 0.8, 2, 0.6, 0.8);
    thump(v, v.t, 0.25, 180, 90, 0.15);
  },
  diceRoll: (v) => rattle(v, v.t, Math.max(0.3, Math.min((v.o.ms ?? 1400) / 1000, 4))),
  diceLand: (v) => {
    thump(v, v.t, 0.85, 130, 48, 0.3);
    air(v, v.t, 0.04, 0.5, "bandpass", 1700, undefined, 2.5, 0.001, 0.2);
    blip(v, v.t, 520, 380, 0.06, 0.16, "triangle");
    thump(v, v.t + 0.13, 0.32, 95, 50, 0.15);
    air(v, v.t + 0.13, 0.03, 0.22, "bandpass", 1900, undefined, 3, 0.001, 0.1);
    air(v, v.t + 0.21, 0.02, 0.1, "bandpass", 2300, undefined, 3, 0.001, 0.1);
  },
  success: (v) => {
    thump(v, v.t, 0.3, 160, 70, 0.2);
    [74, 78, 81, 86].forEach((m, i) => bell(v, v.t + i * 0.06, m, 0.28 - i * 0.02, 1.3, 3.5, 1.2));
    bell(v, v.t + 0.26, 90, 0.1, 1.2, 2, 0.6, 0.8);
    glow(v, v.t + 0.05, [62, 69, 74, 78], 0.05, 0.25, 1.2);
  },
  partial: (v) => {
    bell(v, v.t, 74, 0.26, 0.9, 3.5, 1.1);
    bell(v, v.t + 0.11, 81, 0.26, 0.7, 3.5, 1.1);
    // "...but": a sideways step down with a little droop
    blip(v, v.t + 0.3, mtof(80), mtof(79), 0.45, 0.13, "triangle", 0.4);
    bell(v, v.t + 0.3, 80, 0.18, 0.9, 1, 1.4, 0.5);
  },
  fail: (v) => {
    [81, 77, 74].forEach((m, i) => bell(v, v.t + i * 0.13, m, 0.24, 0.9, 1, 1.6, 0.4));
    // soft "bwomp"
    const { c } = v;
    const t = v.t + 0.38;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(196 * v.p, t);
    o.frequency.exponentialRampToValueAtTime(98 * v.p, t + 0.45);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.5);
    const amp = c.createGain();
    adEnv(amp.gain, t, 0.16, 0.03, 0.55);
    o.connect(lp);
    lp.connect(amp);
    amp.connect(v.d);
    o.start(t);
    o.stop(t + 0.6);
    cleanup(o, lp, amp);
  },
  nat20: (v) => {
    const t = v.t;
    thump(v, t, 1, 170, 38, 0.65);
    air(v, t, 1.6, 0.18, "highpass", 6000, 9000, 0.6, 0.03, 0.8);
    [62, 69, 74, 78, 81, 86, 90, 93].forEach((m, i) => bell(v, t + i * 0.035, m, 0.24 - i * 0.012, 2.2, 3.5, 1.3, 0.7));
    // a brassy swell underneath
    const { c } = v;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1;
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(2800, t + 0.25);
    lp.frequency.exponentialRampToValueAtTime(900, t + 1.6);
    const amp = c.createGain();
    amp.gain.setValueAtTime(EPS, t);
    amp.gain.exponentialRampToValueAtTime(0.1, t + 0.18);
    amp.gain.setTargetAtTime(EPS, t + 0.9, 0.35);
    lp.connect(amp);
    amp.connect(v.d);
    const ws = c.createGain();
    ws.gain.value = 0.6;
    amp.connect(ws);
    ws.connect(v.r);
    const oscs = [50, 57, 62, 66].flatMap((m) =>
      [-8, 8].map((det) => {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(m) * v.p;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + 2.6);
        return o;
      }),
    );
    cleanup(oscs[0], lp, amp, ws);
    // sparkle cascade
    const pent = [86, 88, 90, 93, 95, 98, 100, 102];
    for (let i = 0; i < 12; i++) bell(v, t + 0.3 + i * 0.06 + rand(0, 0.02), pent[Math.floor(rand(0, pent.length))], 0.07, 0.6, 2, 0.6, 0.9);
  },
  nat1: (v) => {
    const { c } = v;
    const t = v.t;
    // slide whistle down
    const o = c.createOscillator();
    o.frequency.setValueAtTime(1500 * v.p, t);
    o.frequency.exponentialRampToValueAtTime(320 * v.p, t + 0.62);
    const vib = c.createOscillator();
    vib.frequency.value = 7;
    const vg = c.createGain();
    vg.gain.value = 25;
    vib.connect(vg);
    vg.connect(o.detune);
    const amp = c.createGain();
    amp.gain.setValueAtTime(EPS, t);
    amp.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
    amp.gain.setValueAtTime(0.16, t + 0.5);
    amp.gain.exponentialRampToValueAtTime(EPS, t + 0.66);
    o.connect(amp);
    amp.connect(v.d);
    o.start(t);
    vib.start(t);
    o.stop(t + 0.7);
    vib.stop(t + 0.7);
    cleanup(o, amp);
    cleanup(vib, vg);
    // thud + boing
    const tb = t + 0.66;
    thump(v, tb, 0.55, 110, 45, 0.25);
    const b = c.createOscillator();
    b.frequency.value = 170 * v.p;
    const bl = c.createOscillator();
    bl.frequency.value = 16;
    const bg = c.createGain();
    bg.gain.setValueAtTime(60, tb);
    bg.gain.exponentialRampToValueAtTime(1, tb + 0.6);
    bl.connect(bg);
    bg.connect(b.frequency);
    const ba = c.createGain();
    adEnv(ba.gain, tb, 0.2, 0.004, 0.65);
    b.connect(ba);
    ba.connect(v.d);
    b.start(tb);
    bl.start(tb);
    b.stop(tb + 0.7);
    bl.stop(tb + 0.7);
    cleanup(b, ba);
    cleanup(bl, bg);
  },
  turnStart: (v) => {
    thump(v, v.t, 0.22, 200, 90, 0.12);
    bell(v, v.t, 81, 0.3, 1.1, 3.5, 1.2);
    bell(v, v.t + 0.16, 86, 0.32, 1.5, 3.5, 1.2);
    glow(v, v.t + 0.1, [74, 81], 0.035, 0.2, 0.8);
  },
  timerTick: (v) => {
    const tock = (v.o.index ?? 0) % 2 === 1;
    const last = v.o.final || v.o.index === 1;
    const f = last ? 1650 : tock ? 980 : 1240;
    blip(v, v.t, f, f * 0.94, 0.045, last ? 0.2 : 0.12, "triangle", 0.15);
    air(v, v.t, 0.014, last ? 0.14 : 0.09, "bandpass", f * 2.1, undefined, 4, 0.001, 0.1);
  },
  reveal: (v) => {
    const t = v.t;
    // a reversed-cymbal style rise into a chord bloom
    const { c } = v;
    const s = c.createBufferSource();
    s.buffer = pinkNoise(c);
    s.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = "bandpass";
    fl.Q.value = 0.9;
    fl.frequency.setValueAtTime(400, t);
    fl.frequency.exponentialRampToValueAtTime(6000, t + 0.9);
    const amp = c.createGain();
    amp.gain.setValueAtTime(EPS, t);
    amp.gain.exponentialRampToValueAtTime(0.32, t + 0.88);
    amp.gain.exponentialRampToValueAtTime(EPS, t + 0.98);
    s.connect(fl);
    fl.connect(amp);
    amp.connect(v.d);
    s.start(t);
    s.stop(t + 1.05);
    cleanup(s, fl, amp);
    const tb = t + 0.9;
    thump(v, tb, 0.45, 120, 40, 0.5);
    [74, 78, 81, 85, 88].forEach((m, i) => bell(v, tb + i * 0.05, m, 0.2, 2.4, 3.5, 1.1, 0.8));
    glow(v, tb, [50, 62, 69, 74], 0.06, 0.15, 2.2);
  },
  finaleShake: (v) => {
    const sec = Math.max(0.5, Math.min((v.o.ms ?? 1500) / 1000, 5));
    let el = 0;
    let n = 0;
    while (el < sec && n < 140) {
      const p = el / sec;
      air(v, v.t + el, 0.06, 0.16 + 0.22 * p, "bandpass", 3600 + 3400 * p, undefined, 1.1, 0.012, 0.1);
      if (n % 4 === 0) thump(v, v.t + el, 0.22 + 0.3 * p, 110, 55, 0.18);
      el += 0.075 - 0.03 * p;
      n++;
    }
    air(v, v.t, sec, 0.12, "bandpass", 300, 2400, 1.5, sec * 0.8, 0.4, true);
  },
  keepsake: (v) => {
    const t = v.t;
    const notes: [number, number][] = [
      [86, 0],
      [81, 0.2],
      [90, 0.4],
      [88, 0.6],
      [86, 0.95],
    ];
    for (const [m, off] of notes) bell(v, t + off, m, 0.22, 1.8, 5, 0.8, 0.8);
    glow(v, t, [62, 66, 69, 76], 0.045, 0.6, 2);
    air(v, t + 0.9, 1.2, 0.05, "highpass", 7000, undefined, 0.6, 0.4, 0.9);
  },
};

const ALIASES: Record<string, SfxName> = {
  tap: "tap", press: "tap", click: "tap", button: "tap",
  pick: "pick", select: "pick", choose: "pick",
  vote: "vote", back: "vote",
  submit: "submit", send: "submit",
  join: "join", joined: "join", playerjoined: "join",
  diceroll: "diceRoll", roll: "diceRoll", rattle: "diceRoll",
  diceland: "diceLand", land: "diceLand",
  success: "success", win: "success", hit: "success",
  partial: "partial", yesbut: "partial", mixed: "partial",
  fail: "fail", miss: "fail", failure: "fail",
  nat20: "nat20", natural20: "nat20", crit: "nat20", critical: "nat20",
  nat1: "nat1", natural1: "nat1", fumble: "nat1",
  turnstart: "turnStart", turn: "turnStart", yourturn: "turnStart",
  timertick: "timerTick", tick: "timerTick", countdown: "timerTick",
  reveal: "reveal",
  finaleshake: "finaleShake", shake: "finaleShake",
  keepsake: "keepsake",
};

/** Resolve a loose name ("Your turn", "nat_20", "yes-but") to a house SFX, or null. */
export function sfxName(name: string): SfxName | null {
  const k = String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ALIASES[k] ?? null;
}

/** Play a house sound effect. Unknown names are ignored. Never throws. */
export function playSfx(name: SfxName | string, opts?: SfxOpts): void {
  const n = (SFX_NAMES as string[]).includes(name) ? (name as SfxName) : sfxName(name);
  if (!n) return;
  run(VOICES[n], opts);
}
