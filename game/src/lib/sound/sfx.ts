"use client";

import { canStart, getBuses, getRoom, isAllMuted, isServer, makeRoom } from "./context";
import { EPS, adEnv, cleanup, mtof, pinkNoise, rand, whiteNoise } from "./dsp";
import { music } from "./music";

/**
 * The house sound effects: ONE cohesive family built from the music's own palette.
 *   - muted plucks (like the loops' pizzicato), soft FM keys (like the Rhodes), a warm pad
 *   - soft woody clicks, rounded low blips, low whooshes, dice wood/plastic textures
 * No bells, chimes or dings. Everything goes through a 4 kHz lowpass (no sharp highs) and the same
 * room as the music, and the tonal ones follow the key of whatever track is playing.
 * Every voice is loudness-normalised (TRIM) to the same level, about 6 dB under the narrator and
 * never above the music bed's peaks.
 */

export type SfxName =
  | "tap"
  | "pop"
  | "pick"
  | "vote"
  | "submit"
  | "join"
  | "cardFlip"
  | "stamp"
  | "whoosh"
  | "thud"
  | "boom"
  | "swell"
  | "heartbeat"
  | "countBeat"
  | "drumroll"
  | "diceThrow"
  | "diceBounce"
  | "diceRoll"
  | "diceLand"
  | "legendary"
  | "great"
  | "good"
  | "meh"
  | "bad"
  | "disaster"
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
  "tap", "pop", "pick", "vote", "submit", "join", "cardFlip", "stamp", "whoosh", "thud", "boom", "swell",
  "heartbeat", "countBeat", "drumroll", "diceThrow", "diceBounce", "diceRoll", "diceLand",
  "legendary", "great", "good", "meh", "bad", "disaster", "success", "partial", "fail", "nat20", "nat1",
  "turnStart", "timerTick", "reveal", "finaleShake", "keepsake",
];

export type Grade = "disaster" | "bad" | "meh" | "good" | "great" | "legendary";
export const GRADES: Grade[] = ["disaster", "bad", "meh", "good", "great", "legendary"];

export interface SfxOpts {
  /** loudness multiplier (1 = the normalised level) */
  volume?: number;
  /** transpose in semitones (on top of following the music's key) */
  pitch?: number;
  /** length for diceRoll / finaleShake / drumroll (ms) */
  ms?: number;
  /** timerTick: seconds left (alternates tick / tock; 1 = the last tick). diceBounce: bounce number (0 = first, loudest) */
  index?: number;
  /** timerTick: the final tick. countBeat: the "go" beat */
  final?: boolean;
  /** stereo position -1..1 (dice) */
  pan?: number;
}

const OUT_LEVEL = 0.42;
const TONE_HZ = 4000; // nothing sharp above this

let fx: { ctx: AudioContext; out: GainNode; verb: GainNode } | null = null;

let ceilCache: Float32Array<ArrayBuffer> | null = null;
function ceilingCurve(): Float32Array<ArrayBuffer> {
  if (ceilCache) return ceilCache;
  const n = 2048;
  const k = 0.2; // -14 dBFS: level with the music bed's peaks
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = k * Math.tanh(x / k);
  }
  ceilCache = curve;
  return curve;
}

/**
 * The shared tone + room every voice goes through (also used by the offline renderer). Live, the reverb send goes
 * to the app's ONE shared room (`room`, context.ts); the offline renderer makes its own copy of that room.
 */
function makeChain(c: BaseAudioContext, dest: AudioNode, outLevel: number, room?: AudioNode) {
  const out = c.createGain();
  out.gain.value = outLevel;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = TONE_HZ;
  lp.Q.value = 0.5;
  const verb = c.createGain();
  const send = c.createGain();
  send.gain.value = 0.3 / 0.38; // the effects' old room return (0.3) through the shared room's (0.38)
  verb.connect(send);
  send.connect(room ?? makeRoom(c, lp).input);
  // a gentle peak catcher so short clicks never poke above the music bed
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 6;
  comp.ratio.value = 6;
  comp.attack.value = 0.001;
  comp.release.value = 0.12;
  out.connect(lp);
  // and a soft ceiling at -14 dBFS: millisecond click peaks are rounded off, never poke above the music
  const ceil = c.createWaveShaper();
  ceil.curve = ceilingCurve();
  ceil.oversample = "2x";
  lp.connect(comp);
  comp.connect(ceil);
  ceil.connect(dest);
  return { out, verb };
}

function bus() {
  if (fx) return fx;
  const b = getBuses();
  if (!b) return null;
  try {
    fx = { ctx: b.ctx, ...makeChain(b.ctx, b.sfx, OUT_LEVEL, getRoom()?.input) };
    return fx;
  } catch {
    return null;
  }
}

/** Voice context: `d` dry destination, `r` reverb send, `p` pitch multiplier. */
interface V {
  c: BaseAudioContext;
  d: AudioNode;
  r: AudioNode;
  t: number;
  p: number;
  o: SfxOpts;
}
type Voice = (v: V) => void;

/** Follow the music: transpose the D-based phrases to the current track's key (nearest, -6..+5). */
function keyShift(): number {
  const k = music.keyInfo();
  if (!k) return 0;
  const d = (((k.key - 62) % 12) + 12) % 12;
  return d > 5 ? d - 12 : d;
}

function run(name: SfxName, o: SfxOpts = {}) {
  if (isServer() || isAllMuted() || !canStart()) return;
  const f = bus();
  if (!f) return;
  const { ctx } = f;
  const go = () => {
    try {
      const vol = Math.max(0, o.volume ?? 1) * (TRIM[name] ?? 1);
      const g = ctx.createGain();
      g.gain.value = vol;
      g.connect(f.out);
      let d: AudioNode = g;
      if (o.pan && typeof ctx.createStereoPanner === "function") {
        const sp = ctx.createStereoPanner();
        sp.pan.value = Math.max(-1, Math.min(1, o.pan));
        sp.connect(g);
        d = sp;
      }
      const rs = ctx.createGain();
      rs.gain.value = vol;
      rs.connect(f.verb);
      if (name === "disaster" || name === "nat1") music.stumble(0.5);
      VOICES[name]({ c: ctx, d, r: rs, t: ctx.currentTime + 0.01, p: Math.pow(2, ((o.pitch ?? 0) + keyShift()) / 12), o });
      setTimeout(() => {
        try {
          d.disconnect();
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
/* ingredients (the music's palette)                                   */
/* ------------------------------------------------------------------ */

function wet(v: V, from: AudioNode, amt: number): AudioNode[] {
  if (amt <= 0) return [];
  const w = v.c.createGain();
  w.gain.value = amt;
  from.connect(w);
  w.connect(v.r);
  return [w];
}

/** Muted pluck (the loops' pizzicato): two soft triangles through a closing lowpass. */
function pluck(v: V, t: number, midi: number, vel: number, decay = 0.35, bright = 1, rv = 0.35) {
  const { c } = v;
  const f = mtof(midi) * v.p;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.9;
  lp.frequency.setValueAtTime(Math.min(3200, f * 5 * bright), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(150, f * 1.4), t + decay * 0.6);
  const amp = c.createGain();
  adEnv(amp.gain, t, vel, 0.005, decay);
  lp.connect(amp);
  amp.connect(v.d);
  const ws = wet(v, amp, rv);
  const oscs = [0, 6].map((det, i) => {
    const o = c.createOscillator();
    o.type = i ? "sine" : "triangle";
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(lp);
    o.start(t);
    o.stop(t + decay + 0.05);
    return o;
  });
  cleanup(oscs[0], lp, amp, ...ws);
}

/** Soft FM keys (the loops' Rhodes, with a gentle low index: rounded, never glassy). */
function keys(v: V, t: number, midis: number[], vel: number, dur = 1.2, strum = 0.02) {
  const { c } = v;
  const per = vel / Math.sqrt(midis.length);
  midis.forEach((m, i) => {
    const tt = t + i * strum;
    const f = mtof(m) * v.p;
    const car = c.createOscillator();
    car.frequency.value = f;
    const mod = c.createOscillator();
    mod.frequency.value = f;
    const mg = c.createGain();
    mg.gain.setValueAtTime(f * 0.9, tt);
    mg.gain.exponentialRampToValueAtTime(f * 0.15 + 1, tt + 0.4);
    mod.connect(mg);
    mg.connect(car.frequency);
    const amp = c.createGain();
    amp.gain.setValueAtTime(EPS, tt);
    amp.gain.exponentialRampToValueAtTime(per, tt + 0.012);
    amp.gain.exponentialRampToValueAtTime(per * 0.4, tt + Math.min(1, dur));
    amp.gain.setTargetAtTime(EPS, tt + dur, 0.15);
    car.connect(amp);
    amp.connect(v.d);
    const ws = wet(v, amp, 0.45);
    car.start(tt);
    mod.start(tt);
    car.stop(tt + dur + 0.8);
    mod.stop(tt + dur + 0.8);
    cleanup(car, amp, mg, ...ws);
    cleanup(mod);
  });
}

/** Warm pad swell (detuned triangles), the glow under bigger moments. */
function pad(v: V, t: number, midis: number[], vel: number, attack = 0.3, dur = 1.4) {
  const { c } = v;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500;
  const amp = c.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel / Math.sqrt(midis.length), t + attack);
  amp.gain.setTargetAtTime(0, t + attack, dur / 4);
  lp.connect(amp);
  amp.connect(v.d);
  const ws = wet(v, amp, 0.8);
  const oscs = midis.flatMap((m) =>
    [-7, 7].map((det) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = mtof(m) * v.p;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + attack + dur + 0.2);
      return o;
    }),
  );
  cleanup(oscs[0], lp, amp, ...ws);
}

/** Soft woody click (woodblock / knuckle on a table). */
function wood(v: V, t: number, f: number, vel: number, dur = 0.06) {
  blip(v, t, f, f * 0.75, dur, vel, "triangle", 0.15);
  air(v, t, 0.014, vel * 0.4, "bandpass", Math.min(2400, f * 1.7), undefined, 3, 0.003, 0.1, false);
}

function blip(v: V, t: number, f0: number, f1: number, dur: number, vel: number, type: OscillatorType = "sine", rv = 0.2) {
  const { c } = v;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0 * v.p, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1 * v.p, t + dur);
  const amp = c.createGain();
  adEnv(amp.gain, t, vel, 0.003, dur);
  o.connect(amp);
  amp.connect(v.d);
  const ws = wet(v, amp, rv);
  o.start(t);
  o.stop(t + dur + 0.05);
  cleanup(o, amp, ...ws);
}

function air(v: V, t: number, dur: number, vel: number, type: BiquadFilterType, f0: number, f1?: number, q = 1, attack = 0.002, rv = 0.2, pink = true, pan?: [number, number]) {
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
  let out: AudioNode = amp;
  const extra: AudioNode[] = [];
  if (pan && typeof c.createStereoPanner === "function") {
    const sp = c.createStereoPanner();
    sp.pan.setValueAtTime(pan[0], t);
    sp.pan.linearRampToValueAtTime(pan[1], t + dur);
    amp.connect(sp);
    out = sp;
    extra.push(sp);
  }
  out.connect(v.d);
  const ws = wet(v, out, rv);
  s.start(t, rand(0, 1.4));
  s.stop(t + dur + 0.05);
  cleanup(s, fl, amp, ...extra, ...ws);
}

function thump(v: V, t: number, vel: number, f0 = 140, f1 = 48, dur = 0.28) {
  blip(v, t, f0, f1, dur, vel, "sine", 0.05);
  air(v, t, 0.05, vel * 0.3, "lowpass", 600, 200, 0.7, 0.002, 0.05);
}

/** A low, soft whoosh. */
function whoosh(v: V, t: number, dur: number, vel: number, f0 = 260, f1 = 1500) {
  air(v, t, dur, vel, "bandpass", f0, f1, 1.1, dur * 0.45, 0.3, true, [-0.5, 0.5]);
}

/** One die hitting the table: a muted plastic clack plus a small woody knock. */
function clack(v: V, t: number, vel: number) {
  air(v, t, rand(0.018, 0.028), vel, "bandpass", rand(1700, 3000), undefined, 3, 0.003, 0.12, false);
  blip(v, t, rand(700, 1100), rand(600, 950), 0.03, vel * 0.3, "triangle", 0.1);
  blip(v, t, rand(190, 230), 120, 0.05, vel * 0.4, "sine", 0.03);
}

/* ------------------------------------------------------------------ */
/* the family (written in D, follows the music's key)                  */
/* ------------------------------------------------------------------ */
// D4 62, E4 64, F#4 66, G4 67, A4 69, B4 71, C#5 73, D5 74, E5 76, F#5 78, A5 81

const diceThrow: Voice = (v) => {
  clack(v, v.t, 0.2);
  clack(v, v.t + 0.045, 0.15);
  whoosh(v, v.t + 0.05, 0.32, 0.3, 300, 1600);
};
const diceBounce: Voice = (v) => {
  const n = Math.max(0, v.o.index ?? 0);
  const vel = 0.5 * Math.pow(0.72, n);
  clack(v, v.t, vel);
  thump(v, v.t, vel * 0.7, 150, 60, 0.12);
};
const diceLand: Voice = (v) => {
  thump(v, v.t, 0.85, 130, 48, 0.32);
  clack(v, v.t, 0.45);
  [0.09, 0.15, 0.19].forEach((d, i) => clack(v, v.t + d, 0.2 * Math.pow(0.6, i))); // the die rocks to a stop
};

const legendary: Voice = (v) => {
  thump(v, v.t, 0.7, 150, 40, 0.5);
  [62, 66, 69, 74, 78, 81].forEach((m, i) => pluck(v, v.t + i * 0.05, m, 0.3 + i * 0.02, 0.5));
  keys(v, v.t + 0.32, [62, 66, 69, 73, 76], 0.42, 1.4, 0.03);
  pad(v, v.t + 0.3, [50, 57, 62, 66], 0.16, 0.25, 1.6);
};
const great: Voice = (v) => {
  thump(v, v.t, 0.4, 150, 60, 0.25);
  [62, 69, 74, 78].forEach((m, i) => pluck(v, v.t + i * 0.055, m, 0.32, 0.45));
  keys(v, v.t + 0.22, [62, 66, 69, 74], 0.38, 1.1, 0.025);
};
const good: Voice = (v) => {
  pluck(v, v.t, 69, 0.36, 0.35);
  pluck(v, v.t + 0.11, 74, 0.38, 0.5);
  keys(v, v.t + 0.11, [62, 66, 69], 0.26, 0.8, 0.02);
};
const meh: Voice = (v) => {
  // "yes, but": a step up, then it hangs on the leading tone over a soft, unresolved chord
  pluck(v, v.t, 74, 0.36, 0.35);
  pluck(v, v.t + 0.14, 73, 0.34, 0.6, 0.8);
  keys(v, v.t + 0.14, [64, 67, 71], 0.22, 0.8, 0.02);
};
const bad: Voice = (v) => {
  // a muted pluck stumble: two quick off-beat notes that trip, then settle down a step, and a soft wood thunk
  pluck(v, v.t, 71, 0.34, 0.16, 0.7);
  pluck(v, v.t + 0.085, 71, 0.3, 0.16, 0.7);
  pluck(v, v.t + 0.23, 69, 0.36, 0.45, 0.6);
  wood(v, v.t + 0.23, 220, 0.28);
};
const disaster: Voice = (v) => {
  // a soft woody thunk on a gently "wrong" low cluster; the music bed dips for half a second (see run())
  thump(v, v.t, 0.6, 120, 50, 0.3);
  wood(v, v.t, 190, 0.45);
  pluck(v, v.t + 0.01, 62, 0.3, 0.45, 0.5);
  pluck(v, v.t + 0.01, 63, 0.24, 0.45, 0.5);
  pluck(v, v.t + 0.26, 66, 0.22, 0.2, 0.6);
  pluck(v, v.t + 0.34, 62, 0.3, 0.5, 0.6);
};

const VOICES: Record<SfxName, Voice> = {
  tap: (v) => wood(v, v.t, 560 * rand(0.97, 1.03), 0.3, 0.1),
  pop: (v) => {
    blip(v, v.t, 240, 520, 0.07, 0.35, "sine", 0.1);
    air(v, v.t, 0.015, 0.06, "bandpass", 1500, undefined, 1.5, 0.001, 0);
  },
  pick: (v) => {
    wood(v, v.t, 620, 0.16);
    pluck(v, v.t + 0.01, 74, 0.36, 0.28);
  },
  vote: (v) => {
    wood(v, v.t, 330, 0.36);
    pluck(v, v.t + 0.02, 69, 0.3, 0.32);
  },
  submit: (v) => {
    whoosh(v, v.t, 0.26, 0.24, 250, 1300);
    pluck(v, v.t + 0.1, 69, 0.32, 0.3);
    pluck(v, v.t + 0.18, 74, 0.34, 0.45);
  },
  join: (v) => {
    blip(v, v.t, 220, 520, 0.06, 0.3, "sine", 0.1);
    [62, 66, 69].forEach((m, i) => pluck(v, v.t + 0.05 + i * 0.065, m, 0.32, 0.35));
    pluck(v, v.t + 0.25, 74, 0.26, 0.55);
  },
  cardFlip: (v) => {
    air(v, v.t, 0.11, 0.32, "bandpass", 500, 1800, 1.1, 0.03, 0.15, true, [-0.25, 0.25]);
    wood(v, v.t + 0.09, 300, 0.22, 0.09);
  },
  stamp: (v) => {
    thump(v, v.t, 0.8, 140, 48, 0.32);
    air(v, v.t + 0.004, 0.12, 0.25, "lowpass", 1200, 500, 0.7, 0.002, 0.1);
  },
  whoosh: (v) => whoosh(v, v.t, 0.5, 0.4, 220, 1400),
  thud: (v) => {
    thump(v, v.t, 0.7, 110, 45, 0.25);
    wood(v, v.t, 180, 0.25);
  },
  boom: (v) => {
    thump(v, v.t, 1, 90, 30, 0.9);
    air(v, v.t, 1.1, 0.4, "lowpass", 500, 90, 0.7, 0.004, 0.4);
  },
  swell: (v) => {
    pad(v, v.t, [62, 69, 74, 78], 0.22, 0.6, 1.6);
    air(v, v.t, 1.2, 0.05, "bandpass", 700, 2000, 0.8, 0.6, 0.6);
  },
  heartbeat: (v) => {
    thump(v, v.t, 0.8, 72, 44, 0.22);
    thump(v, v.t + 0.2, 0.55, 70, 42, 0.22);
  },
  countBeat: (v) => {
    const go = !!v.o.final;
    thump(v, v.t, go ? 0.9 : 0.7, go ? 160 : 130, 60, go ? 0.4 : 0.25);
    if (go) [62, 69, 74].forEach((m) => pluck(v, v.t, m, 0.28, 0.45));
    else wood(v, v.t, 400, 0.25);
  },
  drumroll: (v) => {
    const sec = Math.max(0.5, Math.min((v.o.ms ?? 2000) / 1000, 5));
    let el = 0;
    let n = 0;
    while (el < sec && n < 160) {
      const p = el / sec;
      air(v, v.t + el, 0.05, 0.08 + 0.3 * p * p, "bandpass", 1500 + rand(-200, 200), undefined, 0.9, 0.003, 0.1);
      el += 0.055 - 0.025 * p;
      n++;
    }
    thump(v, v.t + sec, 0.85, 130, 48, 0.32);
  },
  diceThrow,
  diceBounce,
  diceRoll: (v) => {
    const sec = Math.max(0.4, Math.min((v.o.ms ?? 1400) / 1000, 4));
    diceThrow(v);
    air(v, v.t + 0.2, sec - 0.2, 0.07, "lowpass", 420, 170, 0.6, 0.05, 0.05);
    [0.28, 0.5, 0.66, 0.77, 0.85, 0.91, 0.95].forEach((f, i) => diceBounce({ ...v, t: v.t + f * sec, o: { ...v.o, index: i } }));
    for (let el = 0.3; el < sec * 0.95; el += rand(0.03, 0.07)) clack(v, v.t + el, 0.05 * (1 - el / sec));
  },
  diceLand,
  legendary,
  great,
  good,
  meh,
  bad,
  disaster,
  success: good,
  partial: meh,
  fail: bad,
  nat20: legendary,
  nat1: disaster,
  turnStart: (v) => {
    wood(v, v.t, 420, 0.2);
    pluck(v, v.t, 69, 0.36, 0.4);
    pluck(v, v.t + 0.14, 74, 0.4, 0.6);
    pad(v, v.t + 0.1, [62, 69], 0.1, 0.15, 0.7);
  },
  timerTick: (v) => {
    const tock = (v.o.index ?? 0) % 2 === 1;
    const last = v.o.final || v.o.index === 1;
    wood(v, v.t, last ? 900 : tock ? 620 : 760, last ? 0.4 : 0.3, 0.1);
    if (last) pluck(v, v.t, 74, 0.2, 0.3);
  },
  reveal: (v) => {
    const t = v.t;
    air(v, t, 0.95, 0.3, "bandpass", 200, 2600, 0.9, 0.85, 0.4);
    const tb = t + 0.9;
    thump(v, tb, 0.4, 120, 40, 0.5);
    keys(v, tb, [62, 66, 69, 73, 76], 0.36, 1.8, 0.045);
    pad(v, tb, [50, 62, 69], 0.14, 0.2, 2);
    [74, 78, 81].forEach((m, i) => pluck(v, tb + 0.3 + i * 0.08, m, 0.22, 0.5));
  },
  finaleShake: (v) => {
    const sec = Math.max(0.5, Math.min((v.o.ms ?? 1500) / 1000, 5));
    let el = 0;
    let n = 0;
    while (el < sec && n < 140) {
      const p = el / sec;
      air(v, v.t + el, 0.06, 0.14 + 0.2 * p, "bandpass", 2400 + 1000 * p, undefined, 1.1, 0.012, 0.1);
      if (n % 4 === 0) thump(v, v.t + el, 0.22 + 0.3 * p, 110, 55, 0.18);
      el += 0.075 - 0.03 * p;
      n++;
    }
    air(v, v.t, sec, 0.1, "bandpass", 250, 1800, 1.5, sec * 0.8, 0.4);
  },
  keepsake: (v) => {
    const notes: [number, number][] = [
      [74, 0],
      [69, 0.2],
      [78, 0.4],
      [76, 0.6],
      [74, 0.95],
    ];
    for (const [m, off] of notes) pluck(v, v.t + off, m, 0.34, 0.6, 0.9, 0.5);
    pad(v, v.t, [62, 66, 69, 76], 0.16, 0.6, 2);
  },
};

/**
 * Loudness trims (linear), measured offline on /sound-test: every voice lands on the same loudness
 * (K-weighted, loudest 100 ms window) within +/-1 dB.
 */
const TRIM: Partial<Record<SfxName, number>> = {
  tap: 1.77, pop: 1.177, pick: 0.24, vote: 0.251, submit: 0.185, join: 0.158, cardFlip: 1.944, stamp: 0.185, whoosh: 2.456, thud: 0.279, boom: 0.122, swell: 0.204, heartbeat: 0.539, countBeat: 0.24, drumroll: 0.151, diceThrow: 3.26, diceBounce: 0.732, diceRoll: 0.772, diceLand: 0.172, legendary: 0.103, great: 0.134, good: 0.127, meh: 0.138, bad: 0.172, disaster: 0.142, turnStart: 0.142, timerTick: 1.704, reveal: 0.15, finaleShake: 0.387, keepsake: 0.139,
  success: 0.125, partial: 0.138, fail: 0.166, nat20: 0.103, nat1: 0.142,
};

const ALIASES: Record<string, SfxName> = {
  tap: "tap", press: "tap", click: "tap", button: "tap",
  pop: "pop",
  pick: "pick", select: "pick", choose: "pick",
  vote: "vote", back: "vote",
  submit: "submit", send: "submit",
  join: "join", joined: "join", playerjoined: "join", herojoin: "join", herojoined: "join",
  cardflip: "cardFlip", flip: "cardFlip", card: "cardFlip", pageturn: "cardFlip",
  stamp: "stamp", whoosh: "whoosh", thud: "thud", boom: "boom", explosion: "boom", swell: "swell",
  heartbeat: "heartbeat", countbeat: "countBeat", drumroll: "drumroll",
  dicethrow: "diceThrow", throw: "diceThrow",
  dicebounce: "diceBounce", bounce: "diceBounce",
  diceroll: "diceRoll", roll: "diceRoll", rattle: "diceRoll",
  diceland: "diceLand", land: "diceLand",
  legendary: "legendary", nat20: "legendary", natural20: "legendary", crit: "legendary", critical: "legendary",
  great: "great",
  good: "good", success: "good", win: "good",
  meh: "meh", partial: "meh", yesbut: "meh", mixed: "meh",
  bad: "bad", fail: "bad", miss: "bad", failure: "bad", sadtrombone: "bad",
  disaster: "disaster", catastrophe: "disaster", nat1: "disaster", natural1: "disaster", fumble: "disaster",
  turnstart: "turnStart", turn: "turnStart", yourturn: "turnStart",
  timertick: "timerTick", tick: "timerTick", countdown: "timerTick",
  reveal: "reveal",
  finaleshake: "finaleShake", shake: "finaleShake",
  keepsake: "keepsake",
};

/** Resolve a loose name ("Your turn", "nat_20", "yes-but", "CATASTROPHE") to a house SFX, or null. */
export function sfxName(name: string): SfxName | null {
  const k = String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ALIASES[k] ?? null;
}

/** Play a house sound effect. Unknown names are ignored. Never throws. */
export function playSfx(name: SfxName | string, opts?: SfxOpts): void {
  const n = (SFX_NAMES as string[]).includes(name) ? (name as SfxName) : sfxName(name);
  if (!n) return;
  run(n, opts);
}

/** The graded result phrase: "disaster" | "bad" | "meh" | "good" | "great" | "legendary". */
export function playResult(grade: Grade | string, opts?: SfxOpts): void {
  playSfx(String(grade), opts);
}

/**
 * Dice hooks, synced to the die animation:
 *   dice.throw()        as it leaves the hand (rattle + low whoosh)
 *   dice.bounce(n)      each table hit, n = 0, 1, 2... (softer each time); pass { pan } for stereo
 *   dice.land()         the final settle (thud + the die rocking still)
 */
export const dice = {
  throw: (opts?: SfxOpts) => playSfx("diceThrow", opts),
  bounce: (n = 0, opts?: SfxOpts) => playSfx("diceBounce", { ...opts, index: n }),
  land: (opts?: SfxOpts) => playSfx("diceLand", opts),
};

/** Test helper (sound-test page): render one voice through the real tone + room into any context. */
export function renderSfx(name: SfxName, c: BaseAudioContext, dest: AudioNode, t = 0.05, opts: SfxOpts = {}) {
  const ch = makeChain(c, dest, OUT_LEVEL);
  const vol = (TRIM[name] ?? 1) * (opts.volume ?? 1);
  const g = c.createGain();
  g.gain.value = vol;
  g.connect(ch.out);
  const rs = c.createGain();
  rs.gain.value = vol;
  rs.connect(ch.verb);
  VOICES[name]({ c, d: g, r: rs, t, p: 1, o: opts });
}
