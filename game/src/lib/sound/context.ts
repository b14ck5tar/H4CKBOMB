"use client";

/**
 * The one shared AudioContext for the whole app (music + every sound effect).
 *
 * Graph:  music bus ─┐
 *                    ├─> master (global mute) ─> limiter ─> speakers
 *         sfx bus  ──┘
 *
 * Browsers block audio until a user gesture. We never create the context before one (so there is no
 * "AudioContext was not allowed to start" warning), and a one-time listener on the first
 * click / tap / keypress unlocks it automatically. Everything here is a safe no-op on the server.
 */

export const ALL_MUTE_KEY = "ouar-muted"; // the existing TV mute button (sfx.setMuted) uses this key
export const MUSIC_MUTE_KEY = "gp-music-muted";
export const MUSIC_VOL_KEY = "gp-music-vol";

export interface Buses {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
}

let buses: Buses | null = null;
let allMuted = false;
let prefsLoaded = false;
const unlockCbs = new Set<() => void>();
const changeCbs = new Set<() => void>();
let autoAttached = false;

export const isServer = () => typeof window === "undefined";

export function readPref(key: string): string | null {
  if (isServer()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string) {
  if (isServer()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked (private mode etc.) */
  }
}

function loadPrefs() {
  if (prefsLoaded || isServer()) return;
  prefsLoaded = true;
  allMuted = readPref(ALL_MUTE_KEY) === "1";
}

/** The context if it already exists (never creates one). */
export function peekCtx(): AudioContext | null {
  return buses?.ctx ?? null;
}

/** Create the context + buses (call inside a gesture if you can). */
export function getBuses(): Buses | null {
  if (isServer()) return null;
  if (buses) return buses;
  loadPrefs();
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    const ctx = new Ctor({ latencyHint: "playback" } as AudioContextOptions);
    // Headroom: music sits around -27 dBFS (peaks ~-15) and effects peak at -14, so the mix keeps >6 dB of
    // headroom. Behind that, a gentle compressor at -8 dBFS and a soft-clip ceiling at -1 dBFS: nothing can
    // ever clip the output, even with everything at once.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    const ceiling = ctx.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    // perfectly linear up to -6 dBFS, then a soft knee into a -1 dBFS ceiling
    const lin = 0.5;
    const room = 0.89 - lin;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const ax = Math.abs(x);
      curve[i] = Math.sign(x) * (ax <= lin ? ax : lin + room * Math.tanh((ax - lin) / room));
    }
    ceiling.curve = curve;
    const master = ctx.createGain();
    master.gain.value = allMuted ? 0 : 1;
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    music.connect(master);
    sfx.connect(master);
    master.connect(limiter);
    limiter.connect(ceiling);
    ceiling.connect(ctx.destination);
    buses = { ctx, master, music, sfx };
    ctx.addEventListener("statechange", () => {
      if (ctx.state === "running") fireUnlock();
      emitChange();
    });
    // some browsers (or a page that already had a gesture) start "running" with no statechange event
    setTimeout(() => {
      if (ctx.state === "running") fireUnlock();
      emitChange();
    }, 0);
    return buses;
  } catch {
    return null;
  }
}

/**
 * False only when we can tell the page has never had a user gesture (so creating a context now would
 * just log an autoplay warning). Unknown (older browsers) counts as true.
 */
export function canStart(): boolean {
  if (isServer()) return false;
  if (buses) return true;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

export function isRunning(): boolean {
  return buses?.ctx.state === "running";
}

function fireUnlock() {
  for (const cb of [...unlockCbs]) {
    try {
      cb();
    } catch {
      /* never let audio break the game */
    }
  }
}

/** Run `cb` every time the context starts running (now, if it already is). Returns an unsubscribe. */
export function onUnlock(cb: () => void): () => void {
  unlockCbs.add(cb);
  if (isRunning()) cb();
  return () => unlockCbs.delete(cb);
}

/** Call from any user gesture. Safe to call many times. */
export function unlockAudio(): void {
  const b = getBuses();
  if (!b) return;
  const { ctx } = b;
  try {
    if (ctx.state !== "running") {
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === "running") fireUnlock();
        })
        .catch(() => {});
    }
    // iOS: a silent one-sample buffer inside the gesture fully unlocks output
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

const GESTURES = ["pointerdown", "touchend", "keydown", "mousedown", "click"] as const;

function onGesture() {
  unlockAudio();
  if (isRunning()) detachAuto();
}

function detachAuto() {
  if (!autoAttached || isServer()) return;
  for (const g of GESTURES) window.removeEventListener(g, onGesture, true);
  autoAttached = false;
}

/** Attach the one-time "first gesture unlocks audio" listeners (idempotent, called on import). */
export function attachAutoUnlock() {
  if (autoAttached || isServer()) return;
  autoAttached = true;
  for (const g of GESTURES) window.addEventListener(g, onGesture, { capture: true, passive: true });
}

/* ---------------- global mute (music + sfx) ---------------- */

export function isAllMuted(): boolean {
  loadPrefs();
  return allMuted;
}

export function setAllMuted(m: boolean) {
  if (isServer()) return;
  loadPrefs();
  allMuted = !!m;
  writePref(ALL_MUTE_KEY, allMuted ? "1" : "0");
  if (buses) ramp(buses.master.gain, allMuted ? 0 : 1, 0.12, buses.ctx);
  emitChange();
}

/* ---------------- change notifications (for UI hooks) ---------------- */

export function onSoundChange(cb: () => void): () => void {
  changeCbs.add(cb);
  return () => changeCbs.delete(cb);
}

export function emitChange() {
  for (const cb of [...changeCbs]) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

/* ---------------- param helpers ---------------- */

/** Hold a param at its current value, then glide linearly to `v` over `sec`. */
export function ramp(p: AudioParam, v: number, sec: number, ctx: BaseAudioContext, at?: number) {
  const now = Math.max(ctx.currentTime, at ?? 0);
  hold(p, now);
  p.linearRampToValueAtTime(v, now + Math.max(0.005, sec));
}

/** Hold, then ramp exponentially (a straight line in dB: the most natural-sounding fade for ducking). */
export function expRamp(p: AudioParam, v: number, sec: number, ctx: BaseAudioContext) {
  const now = ctx.currentTime;
  const v0 = Math.max(0.0001, p.value);
  p.cancelScheduledValues(now);
  p.setValueAtTime(v0, now);
  p.exponentialRampToValueAtTime(Math.max(0.0001, v), now + Math.max(0.005, sec));
}

/** Glide toward `v` with time constant `tau` (smooth, click-free). */
export function glide(p: AudioParam, v: number, tau: number, ctx: BaseAudioContext) {
  const now = ctx.currentTime;
  hold(p, now);
  p.setTargetAtTime(v, now, Math.max(0.001, tau));
}

function hold(p: AudioParam, now: number) {
  // cancelAndHoldAtTime adds no anchor when nothing is scheduled (a following ramp would then start at t=0),
  // so always anchor explicitly at the current value.
  const v = p.value;
  p.cancelScheduledValues(now);
  p.setValueAtTime(v, now);
}

if (!isServer()) attachAutoUnlock();
