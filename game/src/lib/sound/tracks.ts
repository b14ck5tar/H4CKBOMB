"use client";

import { chance, pick, rand } from "./dsp";
import type { Kit, KitOptions, Layers } from "./instruments";

/**
 * The six generative loops. Each is a little composer that is asked "what happens on this 16th note?"
 * by the scheduler. Chords, grooves and voicings are written by hand in 16-bar forms (an A half and a
 * B half with its own progression, comping and melody), with fills every 8 bars and a breath every 16.
 * Melody notes, ghost notes, velocities and micro-timing are rolled live, so nothing repeats exactly.
 * Intensity adds and removes layers (see `layersFor`) and unlocks extra parts (16th shakers, ostinatos).
 */

export type Mood = "mysterious" | "eerie" | "playful" | "warm" | "tense";
export type TrackId = "lobby" | Mood;
export const MOODS: Mood[] = ["mysterious", "eerie", "playful", "warm", "tense"];
export const TRACK_IDS: TrackId[] = ["lobby", ...MOODS];

export interface Step {
  k: Kit;
  t: number; // when this 16th sounds (already swung)
  bar: number; // bars since the track started
  s: number; // 16th within the bar, 0..15
  beat: number; // seconds per beat
  intensity: number; // 0..1
  mem: Record<string, unknown> & Mem;
}

interface Mem {
  chord?: Chord;
  next?: Chord;
  section?: string;
  last?: number; // last melody note
}

interface Chord {
  bass: number;
  v: number[];
  v2?: number[]; // voicing for the second bar of a two-bar chord
}

export interface TrackDef {
  id: TrackId;
  title: string;
  blurb: string;
  bpm: number;
  swing: number; // 0..0.5 of a 16th (16ths) or of an 8th (8ths)
  swingUnit: 8 | 16;
  level: number; // loudness trim so every track sits at the same level under a voice
  key: number; // tonic (MIDI) for the phase cues
  minor: boolean;
  kit: Omit<KitOptions, "bpm">;
  /** optional per-track layer curve (defaults to `layersFor`) */
  layers?: (i: number) => Partial<Layers>;
  step(x: Step): void;
}

const hum = (ms = 7) => rand(-ms, ms) / 1000;
/** humanised velocity */
const hv = (v: number, spread = 0.12) => v * rand(1 - spread, 1 + spread * 0.5);
const smooth = (x: number, a: number, b: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Default adaptive layers: calm bed at 0, full groove by ~0.5, everything (and a brighter lead) at 1. */
export function layersFor(i: number): Layers {
  return {
    drums: lerp(0.5, 1, smooth(i, 0, 0.55)),
    bass: lerp(0.72, 1, smooth(i, 0, 0.4)),
    lead: lerp(0.35, 1, smooth(i, 0.1, 0.75)),
    keys: 1,
    pad: lerp(1, 0.82, smooth(i, 0.4, 1)),
  };
}

/** Walk to a nearby note of `pool`, preferring small steps (a singable line). */
function walk(pool: number[], from: number | undefined, lo: number, hi: number): number {
  const inRange = pool.filter((n) => n >= lo && n <= hi);
  if (!inRange.length) return pool[0];
  if (from == null) return pick(inRange);
  const near = inRange.map((n) => ({ n, d: Math.abs(n - from) })).filter((x) => x.d > 0 && x.d <= 5);
  if (near.length && !chance(0.12)) return pick(near).n;
  return pick(inRange);
}

/** Every octave of the given pitch classes inside [lo, hi]. */
function scale(pcs: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

const pcsOf = (v: number[]) => v.map((n) => ((n % 12) + 12) % 12);
const chordAt = (prog: Chord[], bar: number, barsPer: number) => prog[Math.floor(bar / barsPer) % prog.length];

/* ------------------------------------------------------------------ */
/* LOBBY: "Night Shift": lo-fi Rhodes in Db, swung boom-bap            */
/* ------------------------------------------------------------------ */

const LOBBY_A: Chord[] = [
  { bass: 39, v: [54, 58, 61, 65] }, // Ebm9
  { bass: 44, v: [54, 60, 65, 68] }, // Ab13
  { bass: 37, v: [53, 56, 60, 63] }, // Dbmaj9
  { bass: 34, v: [49, 53, 56, 60] }, // Bbm9
];
const LOBBY_B: Chord[] = [
  { bass: 42, v: [53, 56, 58, 61] }, // Gbmaj9
  { bass: 41, v: [51, 56, 60, 63] }, // Fm7
  { bass: 39, v: [54, 58, 61, 65] }, // Ebm9
  { bass: 44, v: [54, 58, 61, 65] }, // Ab13sus
];
const DB_PENT = [1, 3, 5, 8, 10];

const lobby: TrackDef = {
  id: "lobby",
  title: "Night Shift",
  blurb: "Lobby. Warm lo-fi Rhodes chords in Db with a lazy swung boom-bap, round sub bass that breathes with the kick, a glassy melody and a counter-line in the B half. 88 bpm.",
  bpm: 88,
  swing: 0.24,
  swingUnit: 16,
  level: 1.19, // measured on /sound-test (K-weighted, intensity 0.2): all tracks within 1 dB
  key: 61,
  minor: false,
  kit: {
    padCutoff: 850,
    padLfo: { rate: 0.05, depth: 260 },
    wobble: { rate: 0.45, depth: 0.0014 },
    echo: { beats: 0.75, feedback: 0.32, tone: 2400 },
    reverb: { keys: 0.28, drums: 0.07 },
    pump: 0.24,
    width: 0.5,
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const b16 = bar % 16;
    // set up the bar on its first 16th, or on whatever 16th comes first if a late scheduler skipped it
    if (s === 0 || mem.bar !== bar) {
      mem.bar = bar;
      if (b16 === 0 || !mem.form) mem.form = bar === 0 ? "AA" : chance(0.6) ? "AB" : "AA";
      const half = b16 < 8 ? "A" : (mem.form as string)[1];
      mem.section = half;
      const prog = half === "B" ? LOBBY_B : LOBBY_A;
      mem.chord = prog[bar % 4];
      mem.next = prog[(bar + 1) % 4];
      mem.lift = b16 >= 8 && half === "A"; // the repeat of A gets a lifted voicing
    }
    const c = mem.chord!;
    const B = mem.section === "B";
    const intro = bar < 2;
    const breath = b16 === 15 && s >= 8; // every 16 bars the drums take a breath on beats 3-4
    const T = t + hum();
    const v = mem.lift ? [...c.v.slice(1), c.v[0] + 12] : c.v;

    // harmony
    if (s === 0) {
      k.keys(v, T, beat * (B ? 1.6 : 3.2), hv(0.62), { strum: rand(0.012, 0.03) });
      k.pad(v.map((n) => n + 12), t, beat * 4, 0.24, { attack: 1.2, release: 2 });
      k.bass(c.bass, T, beat * 1.4, hv(0.85, 0.08));
    }
    if (!B && s === 7 && chance(0.35)) k.keys(v.slice(2), T, beat * 0.8, hv(0.32), { strum: 0.01 });
    if (B && (s === 6 || s === 10)) k.keys(v.slice(1), T, beat * 0.5, hv(0.38), { strum: 0.008 });
    if (s === 10 && chance(0.75)) k.bass(chance(0.3) ? c.bass + 7 : c.bass, T, beat * 0.9, hv(0.6));
    if (B && s === 7 && chance(0.3)) k.bass(c.bass + 12, T, beat * 0.3, hv(0.45));
    if (s === 14 && chance(0.32)) k.bass(mem.next!.bass + (chance(0.5) ? -1 : 2), T, beat * 0.4, hv(0.45));

    // drums
    if (!breath) {
      if (!intro) {
        if (s === 0) k.kick(T, hv(0.82, 0.06));
        if (s === 10) k.kick(T, hv(0.6));
        if (s === 7 && chance(0.2)) k.kick(T, 0.32);
        if (B && s === 14 && chance(0.25)) k.kick(T, 0.42);
        if (s === 4 || s === 12) k.snare(T + 0.014, hv(0.6, 0.08), "clap");
        if (s === 15 && chance(0.12)) k.snare(T, 0.22, "rim");
      } else if (s === 12) k.snare(T, 0.4, "rim");
      if (s % 2 === 0) k.hat(T, hv(s % 4 === 2 ? 0.55 : 0.4));
      else if (chance(0.12 + I * 0.4)) k.hat(T, 0.18);
      if (I > 0.5 && s % 2 === 1) k.shaker(T, 0.28);
      if (I > 0.75 && s === 14) k.hat(T, 0.32, true);
    }
    // fill into the next phrase
    if (bar % 8 === 7 && s >= 12 && !breath) k.snare(T, 0.18 + (s - 12) * 0.1, "rim");
    if (b16 === 0 && s === 0 && bar > 0) k.hat(T, 0.4, true);

    // melody: glass bell in A's second half, Rhodes counter-line in B
    if (!B && bar % 8 >= 4 && s % 2 === 0 && chance(0.22 + I * 0.15)) {
      const n = walk(scale(DB_PENT, 68, 82), mem.last, 68, 82);
      mem.last = n;
      k.bell(n, T, hv(0.5), { ratio: 2, index: 0.9, decay: 1.4, pan: rand(-0.4, 0.4), dest: "lead" });
    }
    if (B && s % 4 === 2 && chance(0.4)) {
      const n = walk(scale(pcsOf(c.v), 66, 77), mem.last, 66, 77);
      mem.last = n;
      k.keys([n], T, beat * 0.7, hv(0.35), { bright: 0.8 });
    }
  },
};

/* ------------------------------------------------------------------ */
/* MYSTERIOUS: "Velvet Alley": D dorian noir, glassy arps, heartbeat   */
/* ------------------------------------------------------------------ */

const MYST_A: Chord[] = [
  { bass: 38, v: [53, 57, 60, 64] }, // Dm9
  { bass: 34, v: [50, 53, 57, 64] }, // Bbmaj7#11
  { bass: 43, v: [46, 53, 57, 62] }, // Gm9
  { bass: 45, v: [50, 55, 59, 64], v2: [49, 55, 58, 64] }, // A7sus4 -> A7b9
];
const MYST_B: Chord[] = [
  { bass: 34, v: [50, 53, 57, 64] }, // Bbmaj7#11
  { bass: 43, v: [46, 53, 57, 62] }, // Gm9
  { bass: 40, v: [50, 55, 58, 64] }, // Em7b5
  { bass: 45, v: [49, 55, 58, 64], v2: [49, 53, 57, 61] }, // A7b9 -> A7(#5)
];
const D_DORIAN = [2, 4, 5, 7, 9, 11, 0];
const ARP_A = { order: [0, 2, 1, 3, 2, 4, 1, 3, 0, 2, 3, 4, 2, 1, 3, 2], mask: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1] };
const ARP_B = { order: [4, 3, 2, 1, 3, 2, 1, 0, 4, 2, 3, 1, 2, 0, 1, 3], mask: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0] };

const mysterious: TrackDef = {
  id: "mysterious",
  title: "Velvet Alley",
  blurb: "Mysterious. Noir in D dorian: a breathing, wide analog pad, a glassy ping-pong arp, a lub-dub heartbeat kick and a celesta that asks questions; the B half turns darker (Em7b5, A7b9). 74 bpm.",
  bpm: 74,
  swing: 0.08,
  swingUnit: 16,
  level: 0.81, // measured on /sound-test (K-weighted, intensity 0.2): all tracks within 1 dB
  key: 62,
  minor: true,
  kit: {
    padCutoff: 1000,
    padLfo: { rate: 0.045, depth: 420 },
    wobble: { rate: 0.3, depth: 0.001 },
    echo: { beats: 0.75, feedback: 0.42, tone: 2200 },
    reverb: { pad: 0.6, pluck: 0.5, lead: 0.6 },
    pump: 0.14,
    width: 0.6,
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const b16 = bar % 16;
    if (s === 0 && bar % 8 === 0) mem.section = bar === 0 ? "intro" : b16 >= 8 && chance(0.7) ? "B" : chance(0.25) ? "sparse" : "A";
    const sec = mem.section as string;
    const prog = sec === "B" ? MYST_B : MYST_A;
    const c = chordAt(prog, bar, 2);
    const second = bar % 2 === 1;
    const v = second && c.v2 ? c.v2 : c.v;
    const T = t + hum();

    if (s === 0 && !second) {
      k.pad(c.v, t, beat * 8, 0.6, { attack: 1.8, release: 2.6 });
      k.pad([c.v[3] + 12], t + beat, beat * 6, 0.22, { kind: "hollow", attack: 2.5 });
      k.bass(c.bass, T, beat * 7.6, hv(0.72, 0.06));
    }
    if (second && c.v2 && s === 0) k.pad(c.v2.slice(0, 3), t, beat * 4, 0.28, { attack: 0.8 });
    if (second && s === 8 && chance(sec === "B" ? 0.6 : 0.3)) k.bass(c.bass + 7, T, beat * 1.5, hv(0.45));

    // heartbeat: lub-dub on beat one
    if (s === 0) k.kick(T, hv(0.5 + I * 0.15, 0.06), { f0: 90, f1: 40, decay: 0.4 });
    if (s === 3) k.kick(T, hv(0.32, 0.08), { f0: 80, f1: 38, decay: 0.35 });
    if (s === 12 && chance(0.3)) k.snare(T, hv(0.35), "rim");
    if (s % 4 === 2) k.shaker(T, hv(0.5));
    else if (I > 0.45 && s % 2 === 1) k.shaker(T, hv(0.22));
    if (I > 0.6 && s === 8) k.tom(T, 0.35, 75);
    if (bar % 8 === 7 && (s === 12 || s === 14)) k.tom(T, hv(0.38), s === 12 ? 82 : 66);

    // the arp
    if (sec !== "intro") {
      const pat = sec === "B" ? ARP_B : ARP_A;
      const dense = sec !== "sparse" || I > 0.55;
      if (pat.mask[s] && chance(dense ? 0.85 : 0.35)) {
        const up = sec === "B" ? 24 : 12;
        const tones = [...v.map((n) => n + up), v[1] + up + 12];
        const n = tones[pat.order[s] % tones.length];
        k.pluck(n, T, hv(0.34 + I * 0.1), { type: "triangle", decay: 0.32, bright: 0.85, pan: s % 2 ? 0.35 : -0.35 });
      }
    }

    // a celesta phrase every 4 bars (twice as often in B)
    if ((bar % 4 === 2 || (sec === "B" && bar % 4 === 0)) && s % 2 === 0 && chance(0.4)) {
      const n = walk(scale(D_DORIAN, 74, 88), mem.last, 74, 88);
      mem.last = n;
      k.bell(n, T, hv(0.42), { ratio: 3.5, index: 1, decay: 2, pan: rand(-0.5, 0.5) });
    }
  },
};

/* ------------------------------------------------------------------ */
/* EERIE: "Hollow Hour": hexatonic minor chords, music box, theremin  */
/* ------------------------------------------------------------------ */

const EERIE_A: Chord[] = [
  { bass: 45, v: [57, 60, 64] }, // Am
  { bass: 41, v: [56, 60, 65] }, // Fm
  { bass: 37, v: [56, 61, 64] }, // C#m
  { bass: 45, v: [57, 59, 60, 64] }, // Am(add9), a little rub
];
const EERIE_B: Chord[] = [
  { bass: 41, v: [56, 60, 65] }, // Fm
  { bass: 37, v: [56, 61, 64] }, // C#m
  { bass: 45, v: [57, 60, 64, 71] }, // Am(add9)
  { bass: 40, v: [56, 59, 62, 65] }, // E7b9: pulls back home
];

const eerie: TrackDef = {
  id: "eerie",
  title: "Hollow Hour",
  blurb: "Eerie. Minor chords that slide by major thirds (A, F, C#: the haunted-house move), a slightly out-of-tune music box, tiptoeing pizzicato, a gliding drone, wind, and now and then a cheeky theremin. 62 bpm.",
  bpm: 62,
  swing: 0,
  swingUnit: 16,
  level: 0.8, // measured on /sound-test (K-weighted, intensity 0.2): all tracks within 1 dB
  key: 57,
  minor: true,
  kit: {
    padCutoff: 850,
    padLfo: { rate: 0.035, depth: 380 },
    wobble: { rate: 0.27, depth: 0.003 },
    echo: { beats: 1.5, feedback: 0.38, tone: 1800 },
    reverb: { pad: 0.7, keys: 0.6, lead: 0.7, drums: 0.3, fx: 0.8 },
    pump: 0,
    width: 0.7,
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const b16 = bar % 16;
    if (s === 0 && b16 === 0) mem.form = bar === 0 || chance(0.4) ? "AA" : "AB";
    const B = b16 >= 8 && (mem.form as string) === "AB";
    const c = chordAt(B ? EERIE_B : EERIE_A, bar, 2);
    const second = bar % 2 === 1;
    const prevBass = (mem.prevBass as number | undefined) ?? c.bass;
    const T = t + hum(5);

    if (s === 0 && !second) {
      k.pad(c.v, t, beat * 8, 0.6, { kind: "hollow", attack: 2.6, release: 3, detune: 11 });
      k.bass(c.bass, t, beat * 7.8, 0.6, "sub", prevBass !== c.bass ? prevBass : undefined);
      mem.prevBass = c.bass;
    }
    // a deep boom every 4 bars, a soft heartbeat when things heat up
    if (s === 0 && bar % 4 === 0) k.kick(T, 0.55, { f0: 70, f1: 30, decay: 1.2 });
    if (I > 0.45 && s % 4 === 0 && !(s === 0 && bar % 4 === 0)) k.kick(T, hv(0.28 + I * 0.2), { f0: 75, f1: 38, decay: 0.3 });

    // tiptoeing pizzicato on beats 1 and 3
    if (bar > 1 && (s === 0 || s === 8) && chance(0.55)) k.pluck(c.bass + 12 + (s === 8 && chance(0.4) ? 7 : 0), T, hv(0.4), { type: "triangle", decay: 0.18, bright: 0.9, pan: -0.25 });

    // music box: random walk in A, a falling motif in B
    if (bar > 0 && s % 2 === 0) {
      const tones = scale(pcsOf(c.v), 76, 91);
      if (B) {
        const motif = [tones.length - 1, tones.length - 2, tones.length - 3, tones.length - 2];
        const n = tones[Math.max(0, motif[(s / 2) % 4])];
        if (chance(0.6)) k.bell(n, T, hv(0.42), { ratio: 5, index: 0.8, decay: 2.2, detune: rand(-12, 12), pan: rand(-0.6, 0.6), dest: "keys" });
      } else if (chance(0.32 + I * 0.15)) {
        const n = walk(tones, mem.last, 76, 91);
        mem.last = n;
        k.bell(n, T, hv(0.42), { ratio: 5, index: 0.8, decay: 2.2, detune: rand(-12, 12), pan: rand(-0.6, 0.6), dest: "keys" });
      }
    }
    // unease when it heats up: a trembling minor second
    if (I > 0.7 && s % 2 === 1) k.pluck(c.v[0] + 24 + (s % 4 === 1 ? 0 : 1), T, 0.14, { type: "sine", decay: 0.12, pan: 0.4 });

    // wind
    if (s === 0 && bar % 4 === 1 && chance(0.75)) k.swell(t, beat * rand(5, 7), 0.5, rand(250, 400), rand(900, 1500), 2.2);

    // the theremin pops in for a little spooky-funny phrase
    if (s === 0 && bar % 8 === 5 && chance(0.65)) {
      const top = c.v[c.v.length - 1] + 12;
      const phrase = pick([
        [top, top - 1, top - 4],
        [top - 5, top, top - 1],
        [top - 3, top + 2, top - 1, top - 4],
      ]);
      k.theremin(phrase, t, beat * 1.5, 0.7);
    }
  },
};

/* ------------------------------------------------------------------ */
/* PLAYFUL: "Sneaky Business": swung pizzicato caper in E minor        */
/* ------------------------------------------------------------------ */

const PLAY_A: Chord[] = [
  { bass: 40, v: [64, 67, 71] }, // Em
  { bass: 45, v: [60, 64, 66, 69] }, // Am6
  { bass: 40, v: [64, 67, 71] }, // Em
  { bass: 47, v: [63, 66, 69, 71] }, // B7
];
const PLAY_B: Chord[] = [
  { bass: 40, v: [64, 67, 71] }, // Em
  { bass: 48, v: [64, 67, 70, 72] }, // C7
  { bass: 45, v: [60, 64, 69] }, // Am
  { bass: 47, v: [63, 66, 69, 71] }, // B7
];
const RHYTHMS = [
  [0, 2, 3, 4, 6],
  [0, 3, 4, 7],
  [2, 3, 4, 6, 7],
  [0, 1, 2, 4],
];

const playful: TrackDef = {
  id: "playful",
  title: "Sneaky Business",
  blurb: "Playful. A tiptoeing caper in E minor: swung pizzicato stabs, a walking upright bass, finger snaps, a glockenspiel that sneaks up on its notes chromatically, and pizzicato answers when it rests. 108 bpm.",
  bpm: 108,
  swing: 0.6,
  swingUnit: 8,
  level: 1.53, // measured on /sound-test (K-weighted, intensity 0.2): all tracks within 1 dB
  key: 64,
  minor: true,
  kit: {
    padCutoff: 700,
    padLfo: { rate: 0.07, depth: 200 },
    wobble: { rate: 0.5, depth: 0 },
    echo: { beats: 0.5, feedback: 0.22, tone: 3000 },
    bassCutoff: 900,
    bassDrive: 1.4,
    reverb: { pluck: 0.3, lead: 0.4, drums: 0.1 },
    pump: 0.12,
    width: 0.4,
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const b16 = bar % 16;
    if (s === 0 || mem.bar !== bar) {
      mem.bar = bar;
      if (bar % 4 === 0 || !mem.rhythm) {
        mem.section = b16 >= 8 ? (chance(0.7) ? "B" : "A") : "A";
        mem.tune = bar >= 2 && (mem.section === "B" || chance(0.55));
        mem.rhythm = pick(RHYTHMS);
      }
      const prog = mem.section === "B" ? PLAY_B : PLAY_A;
      mem.chord = prog[bar % 4];
      mem.next = prog[(bar + 1) % 4];
    }
    if (s % 2 === 1) return; // swung 8ths only
    const c = mem.chord!;
    const T = t + hum(6);
    const e8 = s / 2;

    // walking bass on the beats
    if (s % 4 === 0) {
      const b = s / 4;
      const nextRoot = mem.next!.bass;
      const third = c.v.some((n) => (n - c.bass) % 12 === 3) ? 3 : 4;
      const line = [c.bass, c.bass + (chance(0.5) ? 7 : third), c.bass + (chance(0.5) ? 12 : 7), nextRoot + (chance(0.5) ? -1 : 1)];
      k.bass(line[b], T, beat * 0.78, hv(b === 0 ? 0.8 : 0.62, 0.08), "pluck");
    }
    // pizzicato chord stabs on 2 and 4, tiptoes on the offbeats
    if (s === 4 || s === 12) for (const n of c.v) k.pluck(n, T + rand(0, 0.012), hv(0.42), { type: "triangle", decay: 0.13, bright: 1.3, pan: rand(-0.35, 0.35) });
    if ((s === 2 || s === 10) && chance(0.45)) k.pluck(c.v[0] + 12, T, hv(0.3), { type: "triangle", decay: 0.1, bright: 1.4, pan: 0.4 });

    // snaps + brushes + a soft kick
    if (s === 4 || s === 12) k.snare(T, hv(0.6, 0.08), "snap");
    k.hat(T, hv(s % 4 === 2 ? 0.38 : 0.25));
    if (s === 0 || s === 8) k.kick(T, hv(0.4 + I * 0.25, 0.06), { f0: 100, f1: 50, decay: 0.25 });
    if (I > 0.6 && s === 14) k.kick(T, 0.38, { f0: 100, f1: 50, decay: 0.2 });
    if (bar % 8 === 7 && s >= 8) k.pluck(c.v[(s - 8) / 2 % c.v.length] + 12, T, 0.3 + (s - 8) * 0.03, { type: "triangle", decay: 0.12, bright: 1.4, pan: 0.2 });

    // glockenspiel tune with chromatic grace notes; pizzicato answers when it rests
    const rhythm = mem.rhythm as number[];
    if (mem.tune && rhythm.includes(e8)) {
      const n = walk(scale(pcsOf(c.v), 72, 88), mem.last, 72, 88);
      mem.last = n;
      if (chance(0.3)) k.bell(n - 1, T - beat * 0.12, 0.26, { ratio: 3.5, index: 1.1, decay: 0.4, pan: 0.2 });
      k.bell(n, T, hv(0.5), { ratio: 3.5, index: 1.2, decay: 0.9, pan: 0.2 });
    } else if (!mem.tune && bar % 2 === 1 && rhythm.includes(e8) && chance(0.7)) {
      const n = walk(scale(pcsOf(c.v), 64, 76), mem.last, 64, 76);
      mem.last = n;
      k.pluck(n, T, hv(0.34), { type: "triangle", decay: 0.12, bright: 1.3, pan: -0.3 });
    }
  },
};

/* ------------------------------------------------------------------ */
/* WARM: "Hearthlight": fingerpicked Rhodes in Eb, brushes, shaker     */
/* ------------------------------------------------------------------ */

const WARM_A: Chord[] = [
  { bass: 39, v: [55, 58, 62, 65] }, // Ebmaj9
  { bass: 38, v: [53, 58, 60, 65] }, // Bb(add9)/D
  { bass: 36, v: [51, 58, 62, 67] }, // Cm9
  { bass: 44, v: [55, 60, 63, 70] }, // Abmaj9
];
const WARM_B: Chord[] = [
  { bass: 44, v: [55, 60, 63, 70] }, // Abmaj9
  { bass: 46, v: [53, 58, 60, 65] }, // Bbsus2
  { bass: 43, v: [53, 58, 62, 65] }, // Gm7
  { bass: 36, v: [51, 58, 62, 67] }, // Cm9
];
const EB_PENT = [3, 5, 7, 10, 0];
const PICK_A = [0, 1, 2, 3, 4, 3, 2, 1];
const PICK_B = [0, 2, 1, 3, 2, 4, 3, 2];
// the recurring hook (A half only): [16th position, note]
const HOOK: Record<number, [number, number][]> = {
  4: [[0, 70], [2, 72], [4, 75], [7, 74], [10, 70]],
  6: [[0, 67], [3, 70], [4, 72], [8, 70]],
};

const warm: TrackDef = {
  id: "warm",
  title: "Hearthlight",
  blurb: "Warm. A cozy campfire tale in Eb major: fingerpicked Rhodes, a soft wide pad, brushes and shaker, and a little bell hook that comes back every 16 bars like a theme. 78 bpm.",
  bpm: 78,
  swing: 0.14,
  swingUnit: 16,
  level: 1.07, // measured on /sound-test (K-weighted, intensity 0.2): all tracks within 1 dB
  key: 63,
  minor: false,
  kit: {
    padCutoff: 1100,
    padLfo: { rate: 0.05, depth: 300 },
    wobble: { rate: 0.35, depth: 0.001 },
    echo: { beats: 0.75, feedback: 0.25, tone: 2600 },
    reverb: { keys: 0.38 },
    pump: 0.14,
    width: 0.55,
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const b16 = bar % 16;
    if (s === 0 && bar % 8 === 0) {
      mem.section = b16 >= 8 && chance(0.65) ? "B" : "A";
      mem.drums = bar === 0 ? "none" : chance(0.2) ? "light" : "full";
    }
    const B = mem.section === "B";
    const c = chordAt(B ? WARM_B : WARM_A, bar, 2);
    const second = bar % 2 === 1;
    const T = t + hum();

    if (s === 0 && !second) {
      k.pad(c.v, t, beat * 8, 0.45, { attack: 1.6 });
      k.keys(c.v, T, beat * 2, hv(0.5), { strum: 0.03, bright: 0.8 });
    }
    if (s === 0) k.bass(c.bass, T, beat * 2.5, hv(second ? 0.6 : 0.78, 0.06));
    if (s === 10 && chance(0.5)) k.bass(c.bass + 7, T, beat * 1.2, hv(0.5));

    // fingerpicked broken chord
    if (s % 2 === 0 && (second || s >= 4) && chance(0.85)) {
      const tones = [c.bass + 12, ...c.v];
      const order = B ? PICK_B : PICK_A;
      const n = tones[order[(s / 2) % order.length] % tones.length];
      k.keys([n + (s / 2 >= 4 && chance(0.25) ? 12 : 0)], T, beat * 1.2, hv(s % 8 === 0 ? 0.45 : 0.32), { bright: 0.7 });
    }

    const drums = mem.drums as string;
    if (drums !== "none") {
      if (s % 2 === 0) k.shaker(T, hv(s % 4 === 2 ? 0.5 : 0.32));
      else if (I > 0.4) k.shaker(T, hv(0.2));
      if (drums === "full") {
        if (s === 0) k.kick(T, hv(0.45 + I * 0.2, 0.06), { f0: 100, f1: 45 });
        if (s === 10 && chance(0.6)) k.kick(T, hv(0.32), { f0: 100, f1: 45 });
        if (s === 4 || s === 12) k.snare(T, hv(0.55, 0.08), "brush");
      }
      if (bar % 8 === 7 && s >= 12 && s % 2 === 0) k.snare(T, 0.35, "brush");
    }

    // the hook (A), a free pentatonic bell line (B)
    const hook = !B ? HOOK[bar % 8] : undefined;
    if (hook) {
      for (const [pos, n] of hook) if (pos === s) k.bell(n, T, hv(0.48, 0.08), { ratio: 2, index: 0.7, decay: 1.8, pan: 0.15 });
    } else if (B && s % 2 === 0 && chance(0.18 + I * 0.12)) {
      const n = walk(scale(EB_PENT, 70, 84), mem.last, 70, 84);
      mem.last = n;
      k.bell(n, T, hv(0.42), { ratio: 2, index: 0.7, decay: 1.8, pan: rand(-0.4, 0.4) });
    }
  },
};

/* ------------------------------------------------------------------ */
/* TENSE: "Undercurrent": pulsing C minor, taiko toms, ticking hats    */
/* ------------------------------------------------------------------ */

const TENSE_A: Chord[] = [
  { bass: 36, v: [51, 55, 60, 62] }, // Cm(add9)
  { bass: 44, v: [51, 55, 56, 60] }, // Abmaj7
  { bass: 41, v: [51, 55, 56, 60] }, // Fm9
  { bass: 43, v: [50, 53, 55, 60], v2: [50, 53, 56, 59] }, // Gsus4 -> G7b9
];
const TENSE_B: Chord[] = [
  { bass: 44, v: [51, 55, 56, 60] }, // Abmaj7
  { bass: 46, v: [50, 53, 58, 62] }, // Bb
  { bass: 36, v: [51, 55, 60, 62] }, // Cm(add9)
  { bass: 43, v: [50, 53, 55, 60], v2: [50, 53, 56, 59] }, // Gsus4 -> G7b9
];
const OSTINATO = [0, 1, 2, 1, 0, 1, 3, 1, 0, 1, 2, 1, 3, 2, 1, 2];

const tense: TrackDef = {
  id: "tense",
  title: "Undercurrent",
  blurb: "Tense. A pulsing filtered-saw bass in C minor that pumps with the low taiko toms, ticking hats, a dark pad, string-like ostinatos in the B half and a riser into every eighth bar. Opens up hard with intensity. 100 bpm.",
  bpm: 100,
  swing: 0,
  swingUnit: 16,
  level: 0.87, // measured on /sound-test (K-weighted, intensity 0.2): all tracks within 1 dB
  key: 60,
  minor: true,
  kit: {
    padCutoff: 650,
    padLfo: { rate: 0.08, depth: 220 },
    wobble: { rate: 0.4, depth: 0 },
    echo: { beats: 0.75, feedback: 0.3, tone: 2000 },
    bassCutoff: 700,
    bassDrive: 2.2,
    reverb: { drums: 0.16, pluck: 0.3 },
    pump: 0.3,
    width: 0.4,
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const b16 = bar % 16;
    if (s === 0 && bar % 8 === 0) mem.section = bar === 0 ? "intro" : b16 >= 8 ? "B" : chance(0.5) ? "drive" : "pulse";
    const sec = mem.section as string;
    const c = chordAt(sec === "B" ? TENSE_B : TENSE_A, bar, 2);
    const second = bar % 2 === 1;
    const v = second && c.v2 ? c.v2 : c.v;
    const T = t + hum(3);

    if (s === 0 && !second) k.pad(c.v, t, beat * 8, 0.5, { attack: 1.2, release: 2 });
    if (second && c.v2 && s === 0) k.pad(c.v2, t, beat * 4, 0.3, { attack: 0.5 });

    // the pulse
    if (s % 2 === 0) {
      const accent = s % 4 === 0;
      const n = s === 14 && chance(0.3) ? c.bass + 12 : c.bass;
      k.bass(n, T, beat * 0.42, hv((accent ? 0.62 : 0.45) + I * 0.15, 0.06), "saw");
    }

    // drums
    if (sec !== "intro") {
      if (s === 0 || s === 6) k.tom(T, hv(0.55 + I * 0.2, 0.06), 68);
      if (s === 8 && chance(0.5)) k.tom(T, hv(0.4), 82);
      if (s === 12 && I > 0.6) k.snare(T, hv(0.5), "clap");
      if (I > 0.8 && s % 4 === 0) k.kick(T, 0.5, { f0: 110, f1: 45, decay: 0.25 });
      if (bar % 8 === 6 && s >= 8 && s % 2 === 0) k.tom(T, 0.3 + (s - 8) * 0.04, 90 - (s - 8) * 3);
    }
    k.hat(T, hv(s % 4 === 2 ? 0.34 : 0.2 + (I > 0.5 ? 0.08 : 0)));

    // ostinato strings (B half, or when the table is on the edge of its seat)
    if ((sec === "drive" || sec === "B" || I > 0.45) && chance(0.9)) {
      const tones = v.map((n) => n + 12);
      k.pluck(tones[OSTINATO[s] % tones.length], T, hv(0.22 + I * 0.12), { type: "sawtooth", decay: 0.1, bright: 0.7, pan: s % 2 ? 0.3 : -0.3 });
    }

    // riser into each 8-bar phrase, a crash on the downbeat
    if (bar % 8 === 7 && s === 0) k.swell(t, beat * 4, 0.55, 300, 4200, 1.6);
    if (bar % 8 === 0 && bar > 0 && s === 0) k.crash(T, 0.6);
  },
};

export const TRACKS: Record<TrackId, TrackDef> = { lobby, mysterious, eerie, playful, warm, tense };

/**
 * Map any mood-ish word (the AI's scene.music enum is calm | eerie | tense | epic; story tags,
 * threat_mood text, etc.) onto one of our five story moods.
 */
export function toMood(x: unknown): Mood | null {
  const s = String(x ?? "").toLowerCase();
  if (!s) return null;
  if ((MOODS as string[]).includes(s)) return s as Mood;
  if (/(eerie|spook|ghost|haunt|creep|uncanny|weird|strange|odd)/.test(s)) return "eerie";
  if (/(tense|danger|chase|urgent|epic|battle|fight|final|threat|storm|panic)/.test(s)) return "tense";
  if (/(play|silly|funny|comed|goof|whims|absurd|chaos|prank|mischie|kid)/.test(s)) return "playful";
  if (/(warm|calm|cozy|hope|gentle|kind|heart|happy|sweet|peace|animal|nature)/.test(s)) return "warm";
  if (/(myster|secret|noir|clue|riddle|dark|night|quiet|curious|wonder|magic)/.test(s)) return "mysterious";
  return null;
}
