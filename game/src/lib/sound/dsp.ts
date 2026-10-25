"use client";

/** Small DSP helpers shared by the music engine and the sound effects. All buffers are cached per context. */

export const EPS = 0.0001;

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const chance = (p: number) => Math.random() < p;
export const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

type Cache = {
  white?: AudioBuffer;
  pink?: AudioBuffer;
  crackle?: AudioBuffer;
  ir: Map<string, AudioBuffer>;
  waves: Map<string, PeriodicWave>;
  curves: Map<string, Float32Array<ArrayBuffer>>;
};
const caches = new WeakMap<BaseAudioContext, Cache>();
function cache(c: BaseAudioContext): Cache {
  let k = caches.get(c);
  if (!k) {
    k = { ir: new Map(), waves: new Map(), curves: new Map() };
    caches.set(c, k);
  }
  return k;
}

export function whiteNoise(c: BaseAudioContext): AudioBuffer {
  const k = cache(c);
  if (k.white) return k.white;
  const len = Math.floor(c.sampleRate * 2);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  k.white = b;
  return b;
}

/** Pink-ish noise (Paul Kellet's economy filter): softer, more "air" than white. */
export function pinkNoise(c: BaseAudioContext): AudioBuffer {
  const k = cache(c);
  if (k.pink) return k.pink;
  const len = Math.floor(c.sampleRate * 3);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
  }
  k.pink = b;
  return b;
}

/** Vinyl crackle: sparse little pops and ticks over a whisper of hiss. Loops seamlessly enough. */
export function crackleNoise(c: BaseAudioContext): AudioBuffer {
  const k = cache(c);
  if (k.crackle) return k.crackle;
  const sr = c.sampleRate;
  const len = Math.floor(sr * 5);
  const b = c.createBuffer(1, len, sr);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.012;
  let i = 0;
  while (i < len) {
    i += Math.floor(rand(0.004, 0.09) * sr);
    if (i >= len) break;
    const big = Math.random() < 0.08;
    const amp = (big ? rand(0.5, 1) : rand(0.08, 0.35)) * (Math.random() < 0.5 ? -1 : 1);
    const width = big ? Math.floor(rand(8, 30)) : Math.floor(rand(2, 7));
    for (let j = 0; j < width && i + j < len; j++) d[i + j] += amp * Math.exp(-j / (width * 0.35)) * (j % 2 ? -0.6 : 1);
  }
  k.crackle = b;
  return b;
}

/**
 * A stereo reverb impulse response generated in code: a pre-delay, a few early reflections, then
 * an exponentially decaying noise tail that gets darker over time (like a real room).
 */
export function reverbIR(c: BaseAudioContext, seconds = 2.6, brightness = 0.6, preDelay = 0.018, channels = 2): AudioBuffer {
  const key = `${seconds}|${brightness}|${preDelay}|${channels}`;
  const k = cache(c);
  const hit = k.ir.get(key);
  if (hit) return hit;
  const sr = c.sampleRate;
  const len = Math.floor(sr * seconds);
  const b = c.createBuffer(channels, len, sr);
  const pre = Math.floor(sr * preDelay);
  for (let ch = 0; ch < channels; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / (len - pre);
      const env = Math.exp(-6.9 * x); // -60 dB at the end
      // one-pole lowpass whose cutoff falls over time: bright onset, dark tail
      const a = Math.max(0.03, brightness * (1 - x) ** 1.6);
      lp += a * (Math.random() * 2 - 1 - lp);
      d[i] = lp * env;
    }
    // early reflections
    for (let r = 0; r < 7; r++) {
      const at = pre + Math.floor(sr * rand(0.004, 0.075));
      if (at < len) d[at] += rand(-0.6, 0.6) * (1 - r / 8);
    }
  }
  // normalise energy so different lengths sit at similar levels
  let sum = 0;
  for (let ch = 0; ch < channels; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) sum += d[i] * d[i];
  }
  const norm = 1 / Math.sqrt(sum / channels / (sr * 0.25));
  for (let ch = 0; ch < channels; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] *= norm * 0.5;
  }
  k.ir.set(key, b);
  return b;
}

/** Custom oscillator timbres (cheaper and softer than raw saws). */
export function wave(c: BaseAudioContext, kind: "warm" | "hollow" | "reed" | "organ"): PeriodicWave {
  const k = cache(c);
  const hit = k.waves.get(kind);
  if (hit) return hit;
  const n = 24;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let h = 1; h < n; h++) {
    let a = 0;
    if (kind === "warm") a = 1 / Math.pow(h, 1.7); // soft saw
    else if (kind === "hollow") a = h % 2 ? 1 / Math.pow(h, 1.3) : 0.04 / h; // clarinet-ish
    else if (kind === "reed") a = (h % 2 ? 1 : 0.55) / Math.pow(h, 1.15) * (h > 9 ? 0.4 : 1);
    else if (kind === "organ") a = [0, 1, 0.55, 0.3, 0.22, 0.05, 0.12, 0, 0.08][h] ?? 0;
    imag[h] = a;
  }
  const w = c.createPeriodicWave(real, imag, { disableNormalization: false });
  k.waves.set(kind, w);
  return w;
}

/** A gentle tanh saturation curve (adds harmonics so bass reads on laptop speakers). */
export function satCurve(c: BaseAudioContext, drive = 2): Float32Array<ArrayBuffer> {
  const key = String(drive);
  const k = cache(c);
  const hit = k.curves.get(key);
  if (hit) return hit;
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  k.curves.set(key, curve);
  return curve;
}

/** Exponential-ish envelope on a gain param: attack to `peak`, then decay to EPS by `t+dur`. */
export function adEnv(p: AudioParam, t: number, peak: number, attack: number, dur: number) {
  p.setValueAtTime(EPS, t);
  p.exponentialRampToValueAtTime(Math.max(peak, EPS * 2), t + Math.max(0.002, attack));
  p.exponentialRampToValueAtTime(EPS, t + Math.max(attack + 0.01, dur));
}

/** Attack / sustain / release envelope (for pads and held notes). */
export function asrEnv(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setValueAtTime(peak, t + attack + Math.max(0, hold));
  p.setTargetAtTime(0, t + attack + Math.max(0, hold), release / 4);
}

/** Stop and release a source when its note ends (lets the browser free the whole little graph). */
export function cleanup(src: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
  src.onended = () => {
    try {
      src.disconnect();
      for (const n of nodes) n.disconnect();
    } catch {
      /* ignore */
    }
  };
}
