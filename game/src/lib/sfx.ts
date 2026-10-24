"use client";

/**
 * Once Upon a Roll: synthesized sound effects (Web Audio API only, no assets).
 * One lazily-created AudioContext. Every call is a safe no-op on the server,
 * when muted, or when Web Audio is unavailable.
 */

const MASTER = 0.35;
const MUTE_KEY = "ouar-muted";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let isMuted = false;
let muteLoaded = false;

function isServer() {
  return typeof window === "undefined";
}

function loadMute() {
  if (muteLoaded || isServer()) return;
  muteLoaded = true;
  try {
    isMuted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    /* storage blocked */
  }
}

function getCtx(): AudioContext | null {
  if (isServer()) return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    out = ctx.createGain();
    out.gain.value = isMuted ? 0 : MASTER;
    out.connect(comp);
    comp.connect(ctx.destination);
  } catch {
    ctx = null;
    out = null;
  }
  return ctx;
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 2);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
}

type Voice = (c: AudioContext, dest: AudioNode, t: number) => void;

/** Run a voice now if the context is live; if suspended, resume then run (only if quick). */
function run(fn: Voice) {
  if (isServer()) return;
  loadMute();
  if (isMuted) return;
  const c = getCtx();
  if (!c || !out) return;
  const o = out;
  const go = () => {
    try {
      fn(c, o, c.currentTime + 0.012);
    } catch {
      /* never let audio break the game */
    }
  };
  if (c.state === "running") {
    go();
    return;
  }
  const asked = performance.now();
  c.resume()
    .then(() => {
      if (c.state === "running" && performance.now() - asked < 400) go();
    })
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/* building blocks                                                     */
/* ------------------------------------------------------------------ */

const EPS = 0.0001;

function envGain(c: AudioContext, dest: AudioNode, t: number, peak: number, attack: number, dur: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, EPS * 2), t + Math.max(attack, 0.002));
  g.gain.exponentialRampToValueAtTime(EPS, t + dur);
  g.connect(dest);
  return g;
}

function tone(
  c: AudioContext,
  dest: AudioNode,
  o: {
    t: number;
    f0: number;
    f1?: number;
    dur: number;
    vol: number;
    type?: OscillatorType;
    attack?: number;
    glide?: number;
    detune?: number;
  },
) {
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f0, o.t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, o.t + (o.glide ?? o.dur));
  if (o.detune) osc.detune.value = o.detune;
  const g = envGain(c, dest, o.t, o.vol, o.attack ?? 0.004, o.dur);
  osc.connect(g);
  osc.start(o.t);
  osc.stop(o.t + o.dur + 0.05);
  return osc;
}

function noiseHit(
  c: AudioContext,
  dest: AudioNode,
  o: {
    t: number;
    dur: number;
    vol: number;
    filter?: BiquadFilterType;
    f0: number;
    f1?: number;
    q?: number;
    attack?: number;
    rate?: number;
  },
) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  if (o.rate) src.playbackRate.value = o.rate;
  const f = c.createBiquadFilter();
  f.type = o.filter ?? "bandpass";
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f0, o.t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, o.t + o.dur);
  const g = envGain(c, dest, o.t, o.vol, o.attack ?? 0.002, o.dur);
  src.connect(f);
  f.connect(g);
  src.start(o.t, Math.random() * 1.5);
  src.stop(o.t + o.dur + 0.05);
  return { src, f, g };
}

/** brass-ish voice: two detuned saws through a swelling lowpass */
function brass(c: AudioContext, dest: AudioNode, t: number, freq: number, dur: number, vol: number, vibrato = 0) {
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(280, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.06);
  f.frequency.exponentialRampToValueAtTime(1500, t + 0.25);
  const g = c.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.035);
  g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.06, dur - 0.1));
  g.gain.exponentialRampToValueAtTime(EPS, t + dur + 0.12);
  f.connect(g);
  g.connect(dest);
  let lfo: OscillatorNode | null = null;
  let lfoG: GainNode | null = null;
  if (vibrato > 0) {
    lfo = c.createOscillator();
    lfo.frequency.value = 5.5;
    lfoG = c.createGain();
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(vibrato, t + 0.35);
    lfo.connect(lfoG);
    lfo.start(t);
    lfo.stop(t + dur + 0.2);
  }
  for (const det of [-7, 6]) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq * 0.985, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.04);
    o.detune.value = det;
    if (lfoG) lfoG.connect(o.frequency);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.2);
  }
}

/* ------------------------------------------------------------------ */
/* voices                                                              */
/* ------------------------------------------------------------------ */

const vThud: Voice = (c, d, t) => {
  tone(c, d, { t, f0: 120, f1: 42, glide: 0.18, dur: 0.32, vol: 0.9, attack: 0.003 });
  noiseHit(c, d, { t, dur: 0.12, vol: 0.5, filter: "lowpass", f0: 600, f1: 120, q: 0.7 });
};

const vDiceLand: Voice = (c, d, t) => {
  vThud(c, d, t);
  // woody click on impact
  noiseHit(c, d, { t, dur: 0.04, vol: 0.55, filter: "bandpass", f0: 1500, q: 2.5 });
  tone(c, d, { t, f0: 520, f1: 380, dur: 0.06, vol: 0.18, type: "triangle" });
  // small settle bounce
  const t2 = t + 0.13;
  tone(c, d, { t: t2, f0: 95, f1: 50, dur: 0.15, vol: 0.35 });
  noiseHit(c, d, { t: t2, dur: 0.03, vol: 0.25, filter: "bandpass", f0: 1800, q: 3 });
  noiseHit(c, d, { t: t + 0.21, dur: 0.02, vol: 0.12, filter: "bandpass", f0: 2200, q: 3 });
};

function vDiceRoll(ms: number): Voice {
  return (c, d, t) => {
    const total = Math.max(0.3, Math.min(ms / 1000, 4));
    // soft felt rumble underneath
    noiseHit(c, d, { t, dur: total, vol: 0.12, filter: "lowpass", f0: 420, f1: 160, q: 0.6, attack: 0.05 });
    let el = 0;
    let n = 0;
    while (el < total && n < 70) {
      const p = el / total;
      const tt = t + el;
      const v = 0.5 * (1 - 0.45 * p) * (0.7 + Math.random() * 0.3);
      noiseHit(c, d, { t: tt, dur: 0.022 + Math.random() * 0.015, vol: v, filter: "bandpass", f0: 2200 + Math.random() * 2800, q: 3.5 });
      tone(c, d, { t: tt, f0: 650 + Math.random() * 600, dur: 0.035, vol: v * 0.25, type: "triangle" });
      // decelerating intervals (ease-out)
      el += 0.028 + 0.16 * p * p + Math.random() * 0.018;
      n++;
    }
  };
}

const vStamp: Voice = (c, d, t) => {
  tone(c, d, { t, f0: 150, f1: 38, glide: 0.2, dur: 0.38, vol: 1, attack: 0.002 });
  noiseHit(c, d, { t, dur: 0.09, vol: 0.6, filter: "lowpass", f0: 900, f1: 150 });
  tone(c, d, { t, f0: 210, f1: 120, dur: 0.05, vol: 0.2, type: "square" });
  // paper crunch
  noiseHit(c, d, { t: t + 0.005, dur: 0.16, vol: 0.35, filter: "highpass", f0: 1800, q: 0.7 });
  noiseHit(c, d, { t: t + 0.06, dur: 0.1, vol: 0.18, filter: "bandpass", f0: 3500, f1: 2200, q: 1 });
};

const vFanfare: Voice = (c, d, t) => {
  // pickup: ta-ta
  brass(c, d, t, 392, 0.09, 0.18);
  brass(c, d, t + 0.12, 392, 0.09, 0.18);
  // arpeggio into held chord: C4 E4 G4 C5
  const chord = [261.63, 329.63, 392, 523.25];
  const start = t + 0.26;
  chord.forEach((f, i) => {
    const ti = start + i * 0.09;
    brass(c, d, ti, f, 1.15 - i * 0.09, i === 3 ? 0.17 : 0.13, 3);
  });
  // a bright top sparkle on the final note
  tone(c, d, { t: start + 0.27, f0: 1046.5, dur: 0.9, vol: 0.04, type: "triangle", attack: 0.05 });
};

const vJoin: Voice = (c, d, t) => {
  brass(c, d, t, 392, 0.08, 0.14);
  brass(c, d, t + 0.1, 523.25, 0.24, 0.16, 2);
  brass(c, d, t + 0.1, 659.25, 0.24, 0.08, 2);
};

const vSadTrombone: Voice = (c, d, t) => {
  const notes: [number, number, number][] = [
    [293.66, 0, 0.36],
    [277.18, 0.42, 0.36],
    [261.63, 0.84, 0.36],
    [246.94, 1.26, 1.15],
  ];
  notes.forEach(([freq, off, dur], i) => {
    const ti = t + off;
    const last = i === notes.length - 1;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 6;
    // "wah": mute opening and closing
    f.frequency.setValueAtTime(350, ti);
    f.frequency.exponentialRampToValueAtTime(1500, ti + 0.12);
    f.frequency.exponentialRampToValueAtTime(500, ti + dur);
    if (last) {
      // extra wah-wah on the long note
      for (let k = 0; k < 4; k++) {
        const tk = ti + 0.2 + k * 0.22;
        f.frequency.exponentialRampToValueAtTime(1300, tk + 0.08);
        f.frequency.exponentialRampToValueAtTime(420, tk + 0.2);
      }
    }
    const g = c.createGain();
    g.gain.setValueAtTime(EPS, ti);
    g.gain.exponentialRampToValueAtTime(0.28, ti + 0.05);
    g.gain.setValueAtTime(0.24, ti + dur - 0.08);
    g.gain.exponentialRampToValueAtTime(EPS, ti + dur + 0.08);
    f.connect(g);
    g.connect(d);
    const lfo = c.createOscillator();
    lfo.frequency.value = last ? 6 : 4.5;
    const lfoG = c.createGain();
    lfoG.gain.setValueAtTime(0, ti);
    lfoG.gain.linearRampToValueAtTime(last ? 9 : 2, ti + (last ? 0.3 : 0.2));
    lfo.connect(lfoG);
    lfo.start(ti);
    lfo.stop(ti + dur + 0.2);
    for (const [type, det, mul] of [
      ["sawtooth", -5, 1],
      ["square", 4, 0.5],
    ] as [OscillatorType, number, number][]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq * 1.02, ti);
      o.frequency.exponentialRampToValueAtTime(freq, ti + 0.06);
      if (last) o.frequency.exponentialRampToValueAtTime(freq * 0.93, ti + dur);
      o.detune.value = det;
      lfoG.connect(o.frequency);
      const og = c.createGain();
      og.gain.value = mul;
      o.connect(og);
      og.connect(f);
      o.start(ti);
      o.stop(ti + dur + 0.2);
    }
  });
};

const vRecordScratch: Voice = (c, d, t) => {
  const strokes: [number, number, number, number][] = [
    // offset, duration, low, high
    [0, 0.13, 300, 2800],
    [0.13, 0.17, 2800, 180],
  ];
  strokes.forEach(([off, dur, a, b]) => {
    const ti = t + off;
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    src.playbackRate.setValueAtTime(a < b ? 0.4 : 2.2, ti);
    src.playbackRate.exponentialRampToValueAtTime(a < b ? 2.2 : 0.3, ti + dur);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2.2;
    f.frequency.setValueAtTime(a, ti);
    f.frequency.exponentialRampToValueAtTime(b, ti + dur);
    const g = envGain(c, d, ti, 0.75, 0.01, dur + 0.02);
    src.connect(f);
    f.connect(g);
    src.start(ti, Math.random());
    src.stop(ti + dur + 0.05);
    // tonal "zip" of the needle
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(a / 3, ti);
    o.frequency.exponentialRampToValueAtTime(b / 3, ti + dur);
    const of = c.createBiquadFilter();
    of.type = "bandpass";
    of.frequency.value = 900;
    of.Q.value = 1.5;
    const og = envGain(c, d, ti, 0.12, 0.01, dur);
    o.connect(of);
    of.connect(og);
    o.start(ti);
    o.stop(ti + dur + 0.05);
  });
  // abrupt stop thump
  tone(c, d, { t: t + 0.3, f0: 90, f1: 50, dur: 0.12, vol: 0.3 });
};

const vChoir: Voice = (c, d, t) => {
  const attack = 0.7;
  const hold = 1.6;
  const rel = 1.3;
  const bus = c.createGain();
  bus.gain.setValueAtTime(EPS, t);
  bus.gain.exponentialRampToValueAtTime(0.5, t + attack);
  bus.gain.setValueAtTime(0.5, t + attack + hold);
  bus.gain.exponentialRampToValueAtTime(EPS, t + attack + hold + rel);
  bus.connect(d);
  // "ahh" formants for the buzzier voices
  const formants: [number, number, number][] = [
    [800, 7, 1],
    [1150, 8, 0.55],
    [2900, 10, 0.22],
  ];
  const fIn = c.createGain();
  fIn.gain.value = 0.35;
  formants.forEach(([fr, q, gain]) => {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = fr;
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.value = gain * 3;
    fIn.connect(bp);
    bp.connect(g);
    g.connect(bus);
  });
  const end = t + attack + hold + rel + 0.1;
  const lfo = c.createOscillator();
  lfo.frequency.value = 4.8;
  const lfoG = c.createGain();
  lfoG.gain.value = 2.2;
  lfo.connect(lfoG);
  lfo.start(t);
  lfo.stop(end);
  // A major, open voicing
  const chord = [220, 329.63, 440, 554.37, 659.25];
  chord.forEach((freq, i) => {
    for (const det of [-11, 0, 10]) {
      const s = c.createOscillator();
      s.type = "sine";
      s.frequency.value = freq;
      s.detune.value = det + (Math.random() * 4 - 2);
      lfoG.connect(s.frequency);
      const sg = c.createGain();
      sg.gain.value = (i === 0 ? 0.11 : 0.075) * (det === 0 ? 1 : 0.7);
      s.connect(sg);
      sg.connect(bus);
      s.start(t);
      s.stop(end);
    }
    const saw = c.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = freq;
    saw.detune.value = Math.random() * 10 - 5;
    lfoG.connect(saw.frequency);
    const swg = c.createGain();
    swg.gain.value = 0.05;
    saw.connect(swg);
    swg.connect(fIn);
    saw.start(t);
    saw.stop(end);
  });
  // breathy air
  noiseHit(c, bus, { t, dur: attack + hold + rel, vol: 0.05, filter: "bandpass", f0: 1100, q: 1.5, attack });
};

const vPageTurn: Voice = (c, d, t) => {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 450;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(3800, t + 0.18);
  bp.frequency.exponentialRampToValueAtTime(1500, t + 0.45);
  const g = c.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.7, t + 0.22);
  g.gain.exponentialRampToValueAtTime(EPS, t + 0.5);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(d);
  src.start(t, Math.random());
  src.stop(t + 0.55);
  // paper flap at the end
  noiseHit(c, d, { t: t + 0.24, dur: 0.06, vol: 0.2, filter: "lowpass", f0: 900, q: 0.8 });
};

const vPop: Voice = (c, d, t) => {
  tone(c, d, { t, f0: 320, f1: 1100, glide: 0.05, dur: 0.11, vol: 0.5 });
  noiseHit(c, d, { t, dur: 0.015, vol: 0.2, filter: "highpass", f0: 2500 });
};

const vTick: Voice = (c, d, t) => {
  const p = 0.9 + Math.random() * 0.25;
  noiseHit(c, d, { t, dur: 0.014, vol: 0.4, filter: "highpass", f0: 3200 * p, q: 0.8 });
  tone(c, d, { t, f0: 1700 * p, dur: 0.018, vol: 0.07, type: "square" });
};

const vHeartbeat: Voice = (c, d, t) => {
  for (const [off, vol] of [
    [0, 1],
    [0.2, 0.7],
  ] as [number, number][]) {
    tone(c, d, { t: t + off, f0: 72, f1: 44, glide: 0.12, dur: 0.22, vol, attack: 0.008 });
    noiseHit(c, d, { t: t + off, dur: 0.08, vol: vol * 0.3, filter: "lowpass", f0: 220, q: 0.8 });
  }
};

const vWhoosh: Voice = (c, d, t) => {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.3;
  bp.frequency.setValueAtTime(260, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + 0.28);
  bp.frequency.exponentialRampToValueAtTime(420, t + 0.62);
  const g = c.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.8, t + 0.28);
  g.gain.exponentialRampToValueAtTime(EPS, t + 0.66);
  src.connect(bp);
  bp.connect(g);
  if (typeof c.createStereoPanner === "function") {
    const pan = c.createStereoPanner();
    pan.pan.setValueAtTime(-0.7, t);
    pan.pan.linearRampToValueAtTime(0.7, t + 0.62);
    g.connect(pan);
    pan.connect(d);
  } else g.connect(d);
  src.start(t, Math.random());
  src.stop(t + 0.7);
};

const vExplosion: Voice = (c, d, t) => {
  noiseHit(c, d, { t, dur: 1.5, vol: 1, filter: "lowpass", f0: 4200, f1: 70, q: 0.9, attack: 0.004 });
  tone(c, d, { t, f0: 85, f1: 26, glide: 0.9, dur: 1.1, vol: 0.9, attack: 0.004 });
  for (let i = 0; i < 9; i++) {
    const ti = t + 0.08 + Math.random() * 0.7;
    noiseHit(c, d, { t: ti, dur: 0.03, vol: 0.15 + Math.random() * 0.2, filter: "bandpass", f0: 1500 + Math.random() * 3000, q: 3 });
  }
};

const vSparkle: Voice = (c, d, t) => {
  const pent = [1568, 1760, 2093, 2349, 2637, 3136, 3520, 4186];
  for (let i = 0; i < 8; i++) {
    const f = pent[Math.floor(Math.random() * pent.length)];
    const ti = t + i * 0.055 + Math.random() * 0.02;
    tone(c, d, { t: ti, f0: f, dur: 0.38, vol: 0.13, attack: 0.003 });
    tone(c, d, { t: ti, f0: f * 2.01, dur: 0.18, vol: 0.035, type: "triangle", attack: 0.003 });
  }
};

const vSplash: Voice = (c, d, t) => {
  noiseHit(c, d, { t, dur: 0.6, vol: 0.8, filter: "bandpass", f0: 2400, f1: 380, q: 0.7, attack: 0.008 });
  noiseHit(c, d, { t, dur: 0.12, vol: 0.4, filter: "lowpass", f0: 500 });
  for (let i = 0; i < 7; i++) {
    const ti = t + 0.08 + Math.random() * 0.45;
    const f = 380 + Math.random() * 500;
    tone(c, d, { t: ti, f0: f, f1: f * 2.6, dur: 0.06, vol: 0.12 });
  }
};

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

function play(name: string) {
  const key = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  switch (key) {
    case "":
    case "none":
      return;
    case "diceroll":
    case "roll":
      return sfx.diceRoll();
    case "diceland":
    case "land":
      return sfx.diceLand();
    case "stamp":
      return sfx.stamp();
    case "fanfare":
    case "trumpet":
      return sfx.fanfare();
    case "sadtrombone":
    case "trombone":
      return sfx.sadTrombone();
    case "recordscratch":
    case "scratch":
      return sfx.recordScratch();
    case "choir":
      return sfx.choir();
    case "pageturn":
    case "page":
      return sfx.pageTurn();
    case "pop":
      return sfx.pop();
    case "tick":
      return sfx.tick();
    case "join":
      return sfx.join();
    case "heartbeat":
      return sfx.heartbeat();
    case "whoosh":
      return sfx.whoosh();
    case "explosion":
    case "boom":
      return sfx.explosion();
    case "sparkle":
    case "magic":
      return sfx.sparkle();
    case "thud":
      return sfx.thud();
    case "splash":
      return sfx.splash();
    default:
      return;
  }
}

export const sfx = {
  /** Call from a user gesture (tap/click) to unlock audio on mobile + Chrome autoplay policy. */
  unlock(): void {
    if (isServer()) return;
    loadMute();
    const c = getCtx();
    if (!c) return;
    try {
      if (c.state !== "running") void c.resume().catch(() => {});
      // iOS: play one silent sample inside the gesture
      const b = c.createBuffer(1, 1, c.sampleRate);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
  },
  setMuted(m: boolean): void {
    if (isServer()) return;
    muteLoaded = true;
    isMuted = !!m;
    try {
      window.localStorage.setItem(MUTE_KEY, isMuted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (ctx && out) {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(isMuted ? 0 : MASTER, now + 0.05);
    }
  },
  muted(): boolean {
    loadMute();
    return isMuted;
  },
  diceRoll(ms: number = 1400): void {
    run(vDiceRoll(ms));
  },
  diceLand(): void {
    run(vDiceLand);
  },
  stamp(): void {
    run(vStamp);
  },
  fanfare(): void {
    run(vFanfare);
  },
  sadTrombone(): void {
    run(vSadTrombone);
  },
  recordScratch(): void {
    run(vRecordScratch);
  },
  choir(): void {
    run(vChoir);
  },
  pageTurn(): void {
    run(vPageTurn);
  },
  pop(): void {
    run(vPop);
  },
  tick(): void {
    run(vTick);
  },
  join(): void {
    run(vJoin);
  },
  heartbeat(): void {
    run(vHeartbeat);
  },
  whoosh(): void {
    run(vWhoosh);
  },
  /* extras used by play(): the DM's sfx enum */
  explosion(): void {
    run(vExplosion);
  },
  sparkle(): void {
    run(vSparkle);
  },
  thud(): void {
    run(vThud);
  },
  splash(): void {
    run(vSplash);
  },
  play(name: string): void {
    play(name);
  },
};

export default sfx;
