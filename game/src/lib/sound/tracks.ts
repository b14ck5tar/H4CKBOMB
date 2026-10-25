"use client";

import { chance, pick, rand } from "./dsp";
import type { Kit, KitOptions } from "./instruments";

/**
 * The six generative loops. Each is a little composer that is asked "what happens on this 16th note?"
 * by the scheduler. Chords, grooves and voicings are written by hand; the melody, fills, ghost notes,
 * sections (full / airy / breakdown) and humanised timing are rolled live, so nothing repeats exactly.
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
  kit: Omit<KitOptions, "bpm">;
  step(x: Step): void;
}

const hum = () => rand(-0.006, 0.006);

/** Walk to the nearest note of `pool` from `from`, preferring small steps (a singable line). */
function walk(pool: number[], from: number | undefined, lo: number, hi: number): number {
  const inRange = pool.filter((n) => n >= lo && n <= hi);
  if (!inRange.length) return pool[0];
  if (from == null) return pick(inRange);
  const near = inRange
    .map((n) => ({ n, d: Math.abs(n - from) }))
    .filter((x) => x.d > 0 && x.d <= 5);
  if (near.length && !chance(0.12)) return pick(near).n;
  return pick(inRange);
}

/** Every octave of the given pitch classes inside [lo, hi]. */
function scale(pcs: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

const chordAt = (prog: Chord[], bar: number, barsPer: number) => prog[Math.floor(bar / barsPer) % prog.length];

/* ------------------------------------------------------------------ */
/* LOBBY: "Night Shift": lo-fi Rhodes in Db, swung boom-bap, crackle  */
/* ------------------------------------------------------------------ */

const LOBBY_A: Chord[] = [
  { bass: 39, v: [54, 58, 61, 65] }, // Ebm9
  { bass: 44, v: [54, 60, 65, 70] }, // Ab13
  { bass: 37, v: [53, 56, 60, 63] }, // Dbmaj9
  { bass: 34, v: [49, 53, 56, 60] }, // Bbm9
];
const LOBBY_B: Chord[] = [
  { bass: 42, v: [53, 56, 58, 61] }, // Gbmaj9
  { bass: 41, v: [51, 56, 60, 65] }, // Fm7
  { bass: 39, v: [54, 58, 61, 65] }, // Ebm9
  { bass: 44, v: [54, 58, 61, 65] }, // Ab13sus
];
const DB_PENT = [1, 3, 5, 8, 10];

const lobby: TrackDef = {
  id: "lobby",
  title: "Night Shift",
  blurb: "Lobby. Warm lo-fi Rhodes chords in Db, a lazy swung boom-bap, round sub bass, vinyl crackle and the odd glassy melody. 88 bpm.",
  bpm: 88,
  swing: 0.24,
  swingUnit: 16,
  level: 1, // measured on /sound-test: equal loudness (K-weighted) across tracks
  kit: {
    padCutoff: 800,
    padLfo: { rate: 0.05, depth: 250 },
    wobble: { rate: 0.45, depth: 0.0016 },
    echo: { beats: 0.75, feedback: 0.32, tone: 2400 },
    crackle: 0.05,
    hiss: 0.012,
    reverb: { keys: 0.28, drums: 0.08 },
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const phraseBar = bar % 8;
    if (s === 0) {
      if (bar % 4 === 0) {
        const useB = mem.section !== "B" && bar > 0 && chance(0.35);
        mem.section = useB ? "B" : "A";
        mem.drums = bar < 2 ? "intro" : chance(0.18) ? "airy" : "groove";
      }
      const prog = mem.section === "B" ? LOBBY_B : LOBBY_A;
      mem.chord = prog[bar % 4];
      mem.next = prog[(bar + 1) % 4];
    }
    const c = mem.chord!;
    const drums = mem.drums as string;
    const T = t + hum();

    // harmony
    if (s === 0) {
      k.keys(c.v, T, beat * 3.2, rand(0.55, 0.7), { strum: rand(0.012, 0.03) });
      k.pad(c.v.map((n) => n + 12), t, beat * 4, 0.28, { attack: 1.2, release: 2 });
      k.bass(c.bass, T, beat * 1.4, 0.85);
    }
    if (s === 7 && chance(0.35)) k.keys(c.v.slice(2), T, beat * 0.8, 0.32, { strum: 0.01 });
    if (s === 10 && chance(0.75)) k.bass(chance(0.3) ? c.bass + 7 : c.bass, T, beat * 0.9, 0.6);
    if (s === 14 && chance(0.3)) k.bass(mem.next!.bass + (chance(0.5) ? -1 : 2), T, beat * 0.4, 0.45);

    // drums
    if (drums !== "intro") {
      if (drums === "groove") {
        if (s === 0) k.kick(T, 0.8 + I * 0.15);
        if (s === 10) k.kick(T, 0.6);
        if (s === 7 && chance(0.2)) k.kick(T, 0.32);
        if (s === 4 || s === 12) k.snare(T + 0.012, 0.62, "clap");
      } else if (s === 12) k.snare(T, 0.45, "rim");
      if (s % 2 === 0) k.hat(T, s % 4 === 2 ? 0.55 : 0.4);
      else if (chance(0.15 + I * 0.4)) k.hat(T, 0.2);
      if (s === 14 && chance(0.1)) k.hat(T, 0.3, true);
      if (s === 15 && chance(0.12)) k.snare(T, 0.25, "rim");
    }

    // melody in the second half of each 8-bar phrase
    if (phraseBar >= 4 && s % 2 === 0 && chance(0.2 + I * 0.15)) {
      const n = walk(scale(DB_PENT, 68, 82), mem.last, 68, 82);
      mem.last = n;
      k.bell(n, T, rand(0.4, 0.6), { ratio: 2, index: 0.9, decay: 1.4, pan: rand(-0.4, 0.4), dest: "keys" });
    }
  },
};

/* ------------------------------------------------------------------ */
/* MYSTERIOUS: "Velvet Alley": D dorian noir, glassy arps, heartbeat   */
/* ------------------------------------------------------------------ */

const MYST: Chord[] = [
  { bass: 38, v: [53, 57, 60, 64] }, // Dm9
  { bass: 34, v: [50, 53, 57, 64] }, // Bbmaj7#11
  { bass: 43, v: [46, 53, 57, 62] }, // Gm9
  { bass: 45, v: [50, 55, 59, 64], v2: [49, 55, 58, 64] }, // A7sus4 -> A7b9
];
const D_DORIAN = [2, 4, 5, 7, 9, 11, 0];
const ARP_ORDER = [0, 2, 1, 3, 2, 4, 1, 3, 0, 2, 3, 4, 2, 1, 3, 2];
const ARP_MASK = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];

const mysterious: TrackDef = {
  id: "mysterious",
  title: "Velvet Alley",
  blurb: "Mysterious. Noir in D dorian: a breathing analog pad, a glassy 16th-note arp with echo, a lub-dub heartbeat kick and a celesta that asks questions. 74 bpm.",
  bpm: 74,
  swing: 0.08,
  swingUnit: 16,
  level: 0.71, // measured on /sound-test: equal loudness (K-weighted) across tracks
  kit: {
    padCutoff: 1000,
    padLfo: { rate: 0.045, depth: 420 },
    wobble: { rate: 0.3, depth: 0.0012 },
    echo: { beats: 0.75, feedback: 0.42, tone: 2200 },
    hiss: 0.008,
    reverb: { pad: 0.6, pluck: 0.5, lead: 0.6 },
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const c = chordAt(MYST, bar, 2);
    const second = bar % 2 === 1;
    const v = second && c.v2 ? c.v2 : c.v;
    const T = t + hum();
    if (s === 0 && bar % 8 === 0) mem.section = bar === 0 ? "intro" : chance(0.25) ? "sparse" : "arp";

    if (s === 0 && !second) {
      k.pad(c.v, t, beat * 8, 0.6, { attack: 1.8, release: 2.6 });
      k.pad([c.v[3] + 12], t + beat, beat * 6, 0.25, { kind: "hollow", attack: 2.5 });
      k.bass(c.bass, T, beat * 7.6, 0.72);
    }
    if (second && c.v2 && s === 0) k.pad(c.v2.slice(0, 3), t, beat * 4, 0.3, { attack: 0.8 });
    if (second && s === 8 && chance(0.3)) k.bass(c.bass + 7, T, beat * 1.5, 0.45);

    // heartbeat: lub-dub on beat one
    if (s === 0) k.kick(T, 0.5 + I * 0.2, { f0: 90, f1: 40, decay: 0.4 });
    if (s === 3) k.kick(T, 0.32, { f0: 80, f1: 38, decay: 0.35 });
    if (s === 12 && chance(0.3)) k.snare(T, 0.35, "rim");
    if (s % 4 === 2) k.shaker(T, 0.5);
    else if (I > 0.4 && s % 2 === 1) k.shaker(T, 0.25);

    // the arp
    const sec = mem.section as string;
    if (sec !== "intro") {
      const dense = sec === "arp" || I > 0.55;
      if (ARP_MASK[s] && chance(dense ? 0.85 : 0.35)) {
        const tones = [...v.map((n) => n + 12), v[1] + 24];
        const n = tones[ARP_ORDER[s] % tones.length];
        k.pluck(n, T, rand(0.3, 0.45) + I * 0.1, { type: "triangle", decay: 0.32, bright: 0.9, pan: s % 2 ? 0.3 : -0.3 });
      }
    }

    // a celesta phrase every 4 bars
    if (bar % 4 === 2 && s % 2 === 0 && chance(0.4)) {
      const n = walk(scale(D_DORIAN, 74, 88), mem.last, 74, 88);
      mem.last = n;
      k.bell(n, T, rand(0.35, 0.5), { ratio: 3.5, index: 1, decay: 2, pan: rand(-0.5, 0.5) });
    }
  },
};

/* ------------------------------------------------------------------ */
/* EERIE: "Hollow Hour": hexatonic minor chords, music box, theremin  */
/* ------------------------------------------------------------------ */

const EERIE: Chord[] = [
  { bass: 45, v: [57, 60, 64] }, // Am
  { bass: 41, v: [56, 60, 65] }, // Fm
  { bass: 37, v: [56, 61, 64] }, // C#m
  { bass: 45, v: [57, 59, 60, 64] }, // Am(add9), a little rub
];

const eerie: TrackDef = {
  id: "eerie",
  title: "Hollow Hour",
  blurb: "Eerie. Minor chords that slide by major thirds (A, F, C#: the classic haunted-house move), a slightly out-of-tune music box, a gliding drone, wind, and now and then a cheeky theremin. 62 bpm.",
  bpm: 62,
  swing: 0,
  swingUnit: 16,
  level: 0.96, // measured on /sound-test: equal loudness (K-weighted) across tracks
  kit: {
    padCutoff: 850,
    padLfo: { rate: 0.035, depth: 380 },
    wobble: { rate: 0.27, depth: 0.0032 },
    echo: { beats: 1.5, feedback: 0.38, tone: 1800 },
    hiss: 0.01,
    reverb: { pad: 0.7, keys: 0.6, lead: 0.7, drums: 0.35, fx: 0.8 },
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    const c = chordAt(EERIE, bar, 2);
    const second = bar % 2 === 1;
    const prevBass = (mem.prevBass as number | undefined) ?? c.bass;
    const T = t + hum();

    if (s === 0 && !second) {
      k.pad(c.v, t, beat * 8, 0.6, { kind: "hollow", attack: 2.6, release: 3, detune: 11 });
      k.bass(c.bass, t, beat * 7.8, 0.6, "sub", prevBass !== c.bass ? prevBass : undefined);
      mem.prevBass = c.bass;
    }
    // a deep boom every 4 bars, a soft heartbeat when things heat up
    if (s === 0 && bar % 4 === 0) k.kick(T, 0.55, { f0: 70, f1: 30, decay: 1.2 });
    if (I > 0.45 && s % 4 === 0 && !(s === 0 && bar % 4 === 0)) k.kick(T, 0.3 + I * 0.2, { f0: 75, f1: 38, decay: 0.3 });

    // music box: chord tones two octaves up, a touch out of tune
    if (bar > 0 && s % 2 === 0 && chance(0.32 + I * 0.15)) {
      const pool = scale(c.v.map((n) => n % 12), 76, 91);
      const n = walk(pool, mem.last, 76, 91);
      mem.last = n;
      k.bell(n, T, rand(0.35, 0.5), { ratio: 5, index: 0.8, decay: 2.2, detune: rand(-12, 12), pan: rand(-0.6, 0.6), dest: "keys" });
    }

    // wind
    if (s === 0 && bar % 4 === 1 && chance(0.75)) k.swell(t, beat * rand(5, 7), 0.5, rand(250, 400), rand(900, 1500), 2.2);

    // the theremin pops in for a little spooky-funny phrase
    if (s === 0 && bar % 8 === 5 && chance(0.6)) {
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
  blurb: "Playful. A tiptoeing caper in E minor: swung pizzicato stabs, a walking upright bass, finger snaps, and a glockenspiel that sneaks up on its notes chromatically. 108 bpm.",
  bpm: 108,
  swing: 0.6,
  swingUnit: 8,
  level: 1.45, // measured on /sound-test: equal loudness (K-weighted) across tracks
  kit: {
    padCutoff: 700,
    padLfo: { rate: 0.07, depth: 200 },
    wobble: { rate: 0.5, depth: 0 },
    echo: { beats: 0.5, feedback: 0.22, tone: 3000 },
    bassCutoff: 900,
    bassDrive: 1.4,
    reverb: { pluck: 0.3, lead: 0.4, drums: 0.12 },
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    if (s === 0) {
      if (bar % 4 === 0) {
        mem.section = chance(0.4) ? "B" : "A";
        mem.tune = bar >= 2 && chance(0.6);
        mem.rhythm = pick(RHYTHMS);
      }
      const prog = mem.section === "B" ? PLAY_B : PLAY_A;
      mem.chord = prog[bar % 4];
      mem.next = prog[(bar + 1) % 4];
    }
    if (s % 2 === 1) return; // swung 8ths only
    const c = mem.chord!;
    const T = t + hum();
    const e8 = s / 2; // 8th within the bar

    // walking bass on the beats
    if (s % 4 === 0) {
      const b = s / 4;
      const nextRoot = mem.next!.bass;
      const third = c.v.includes(c.bass + 24 + 3) || c.v.includes(c.bass + 12 + 3) ? 3 : 4;
      const line = [c.bass, c.bass + (chance(0.5) ? 7 : third), c.bass + (chance(0.5) ? 12 : 7), nextRoot + (chance(0.5) ? -1 : 1)];
      k.bass(line[b], T, beat * 0.78, b === 0 ? 0.8 : 0.62, "pluck");
    }
    // pizzicato chord stabs on 2 and 4, tiptoes on the offbeats
    if (s === 4 || s === 12) for (const n of c.v) k.pluck(n, T + rand(0, 0.01), 0.42, { type: "triangle", decay: 0.13, bright: 1.3, pan: rand(-0.3, 0.3) });
    if ((s === 2 || s === 10) && chance(0.45)) k.pluck(c.v[0] + 12, T, 0.3, { type: "triangle", decay: 0.1, bright: 1.4, pan: 0.4 });

    // snaps + brushes (+ a kick when it heats up)
    if (s === 4 || s === 12) k.snare(T, 0.6, "snap");
    k.hat(T, s % 4 === 2 ? 0.38 : 0.25);
    if (s === 0 && I > 0.35) k.kick(T, 0.45 + I * 0.25, { f0: 100, f1: 50, decay: 0.25 });
    if (s === 8 && I > 0.6) k.kick(T, 0.45, { f0: 100, f1: 50, decay: 0.25 });

    // glockenspiel tune with chromatic grace notes
    if (mem.tune && (mem.rhythm as number[]).includes(e8)) {
      const n = walk(scale(c.v.map((x) => x % 12), 72, 88), mem.last, 72, 88);
      mem.last = n;
      if (chance(0.3)) k.bell(n - 1, T - beat * 0.12, 0.28, { ratio: 3.5, index: 1.1, decay: 0.4, pan: 0.2 });
      k.bell(n, T, rand(0.4, 0.55), { ratio: 3.5, index: 1.2, decay: 0.9, pan: 0.2 });
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
const PICK = [0, 1, 2, 3, 4, 3, 2, 1];

const warm: TrackDef = {
  id: "warm",
  title: "Hearthlight",
  blurb: "Warm. A cozy campfire tale in Eb major: fingerpicked Rhodes, a soft pad, brushes and shaker, and a gentle bell melody that comes and goes. 78 bpm.",
  bpm: 78,
  swing: 0.14,
  swingUnit: 16,
  level: 0.95, // measured on /sound-test: equal loudness (K-weighted) across tracks
  kit: {
    padCutoff: 1100,
    padLfo: { rate: 0.05, depth: 300 },
    wobble: { rate: 0.35, depth: 0.0011 },
    echo: { beats: 0.75, feedback: 0.25, tone: 2600 },
    hiss: 0.007,
    reverb: { keys: 0.38 },
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    if (s === 0 && bar % 8 === 0) {
      mem.section = bar > 0 && chance(0.4) ? "B" : "A";
      mem.drums = bar === 0 ? "none" : chance(0.25) ? "light" : "full";
    }
    const c = chordAt(mem.section === "B" ? WARM_B : WARM_A, bar, 2);
    const second = bar % 2 === 1;
    const T = t + hum();

    if (s === 0 && !second) {
      k.pad(c.v, t, beat * 8, 0.45, { attack: 1.6 });
      k.keys(c.v, T, beat * 2, 0.5, { strum: 0.03, bright: 0.8 });
    }
    if (s === 0) k.bass(c.bass, T, beat * 2.5, second ? 0.6 : 0.78);
    if (s === 10 && chance(0.5)) k.bass(c.bass + 7, T, beat * 1.2, 0.5);

    // fingerpicked broken chord
    if (s % 2 === 0 && (second || s >= 4) && chance(0.85)) {
      const tones = [c.bass + 12, ...c.v];
      const n = tones[PICK[(s / 2) % PICK.length] % tones.length];
      k.keys([n + (s / 2 >= 4 && chance(0.25) ? 12 : 0)], T, beat * 1.2, s % 8 === 0 ? 0.45 : 0.32, { bright: 0.7 });
    }

    const drums = mem.drums as string;
    if (drums !== "none") {
      if (s % 2 === 0) k.shaker(T, s % 4 === 2 ? 0.5 : 0.32);
      else if (I > 0.4) k.shaker(T, 0.2);
      if (drums === "full") {
        if (s === 0) k.kick(T, 0.45 + I * 0.2, { f0: 100, f1: 45 });
        if (s === 10 && chance(0.6)) k.kick(T, 0.32, { f0: 100, f1: 45 });
        if (s === 4 || s === 12) k.snare(T, 0.55, "brush");
      }
    }

    if (bar % 8 >= 4 && s % 2 === 0 && chance(0.16 + I * 0.12)) {
      const n = walk(scale(EB_PENT, 70, 84), mem.last, 70, 84);
      mem.last = n;
      k.bell(n, T, rand(0.35, 0.5), { ratio: 2, index: 0.7, decay: 1.8, pan: rand(-0.4, 0.4) });
    }
  },
};

/* ------------------------------------------------------------------ */
/* TENSE: "Undercurrent": pulsing C minor, taiko toms, ticking hats    */
/* ------------------------------------------------------------------ */

const TENSE: Chord[] = [
  { bass: 36, v: [51, 55, 60, 62] }, // Cm(add9)
  { bass: 44, v: [51, 55, 56, 60] }, // Abmaj7
  { bass: 41, v: [51, 55, 56, 60] }, // Fm9
  { bass: 43, v: [50, 53, 55, 60], v2: [50, 53, 56, 59] }, // Gsus4 -> G7b9
];
const OSTINATO = [0, 1, 2, 1, 0, 1, 3, 1, 0, 1, 2, 1, 3, 2, 1, 2];

const tense: TrackDef = {
  id: "tense",
  title: "Undercurrent",
  blurb: "Tense. A pulsing filtered-saw bass in C minor, low taiko-style toms, ticking hats, a dark pad, and a riser into every eighth bar. Opens up and gets busier with intensity. 100 bpm.",
  bpm: 100,
  swing: 0,
  swingUnit: 16,
  level: 0.92, // measured on /sound-test: equal loudness (K-weighted) across tracks
  kit: {
    padCutoff: 650,
    padLfo: { rate: 0.08, depth: 220 },
    wobble: { rate: 0.4, depth: 0 },
    echo: { beats: 0.75, feedback: 0.3, tone: 2000 },
    bassCutoff: 700,
    bassDrive: 2.2,
    reverb: { drums: 0.18, pluck: 0.3 },
  },
  step({ k, t, bar, s, beat, intensity: I, mem }) {
    if (s === 0 && bar % 8 === 0) mem.section = bar === 0 ? "intro" : chance(0.5) ? "drive" : "pulse";
    const c = chordAt(TENSE, bar, 2);
    const second = bar % 2 === 1;
    const v = second && c.v2 ? c.v2 : c.v;
    const T = t + hum() * 0.5;
    const sec = mem.section as string;

    if (s === 0 && !second) k.pad(c.v, t, beat * 8, 0.5, { attack: 1.2, release: 2 });
    if (second && c.v2 && s === 0) k.pad(c.v2, t, beat * 4, 0.3, { attack: 0.5 });

    // the pulse
    if (s % 2 === 0) {
      const accent = s % 4 === 0;
      const n = s === 14 && chance(0.3) ? c.bass + 12 : c.bass;
      k.bass(n, T, beat * 0.42, (accent ? 0.62 : 0.45) + I * 0.15, "saw");
    }

    // drums
    if (sec !== "intro") {
      if (s === 0 || s === 6) k.tom(T, 0.55 + I * 0.2, 68);
      if (s === 8 && chance(0.5)) k.tom(T, 0.4, 82);
      if (s === 12 && I > 0.6) k.snare(T, 0.5, "clap");
    }
    k.hat(T, s % 4 === 2 ? 0.34 : 0.2 + (I > 0.5 ? 0.08 : 0));

    // ostinato strings when it drives (or the table is on the edge of its seat)
    if ((sec === "drive" || I > 0.45) && chance(0.9)) {
      const tones = v.map((n) => n + 12);
      k.pluck(tones[OSTINATO[s] % tones.length], T, 0.22 + I * 0.12, { type: "sawtooth", decay: 0.1, bright: 0.7, pan: s % 2 ? 0.25 : -0.25 });
    }

    // riser into each 8-bar phrase
    if (bar % 8 === 7 && s === 0) k.swell(t, beat * 4, 0.55, 300, 4200, 1.6);
    if (bar % 8 === 0 && bar > 0 && s === 0) k.hat(T, 0.6, true);
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
