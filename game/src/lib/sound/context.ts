"use client";

/**
 * The one shared AudioContext for the whole app (music + every sound effect).
 *
 * Graph:  music bus ─┐
 *         sfx bus  ──┼─> master (global mute) ─> limiter ─> soft ceiling ─> speakers
 *         room  ─────┘   (ONE shared reverb for music and effects; lite mode disconnects it)
 *
 * Browsers block audio until a user gesture. We never create the context before one (so there is no
 * "AudioContext was not allowed to start" warning), and a one-time listener on the first
 * click / tap / keypress unlocks it automatically. Everything here is a safe no-op on the server.
 */

import { reverbIR } from "./dsp";

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
    // Headroom: every music bed sits at the same loudness (peaks ~-14 dBFS) and effects peak at -14, so the mix
    // keeps >6 dB of headroom. Behind that, a gentle compressor at -6 dBFS and a soft-clip ceiling at -1 dBFS:
    // nothing can ever clip. It almost never acts; when it does, a 6 ms attack (not 3 ms) keeps it from riding
    // single bass cycles, which clamped the bass peaks and sounded "staticky".
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.3;
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
    master.gain.value = allMuted || silenced ? 0 : 1;
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
  if (buses) ramp(buses.master.gain, allMuted || silenced ? 0 : 1, 0.12, buses.ctx);
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

/* ---------------- the shared room (one reverb for music + effects) ---------------- */

export interface Room {
  /** send into the room */
  input: GainNode;
  conv: ConvolverNode;
}

/**
 * A mono 2.0 s convolver widened to stereo by a 13 ms offset on the right, with low and high cut and a small dip
 * where speech lives. Measured offline: about a third of the CPU of the old 2.8 s stereo convolver.
 */
export function makeRoom(c: BaseAudioContext, dest: AudioNode, ret = 0.38): Room {
  const input = c.createGain();
  const conv = c.createConvolver();
  conv.channelCount = 1;
  conv.channelCountMode = "explicit";
  conv.buffer = reverbIR(c, 2.0, 0.55, 0.02, 1);
  const f = (type: BiquadFilterType, fr: number, q: number, gain = 0) => {
    const n = c.createBiquadFilter();
    n.type = type;
    n.frequency.value = fr;
    n.Q.value = q;
    n.gain.value = gain;
    return n;
  };
  const hp = f("highpass", 220, 0.6); // no reverb in the low end
  const lp = f("lowpass", 5600, 0.6); // or the fizz
  const pocket = f("peaking", 2600, 0.8, -4); // the voice pocket
  const merge = c.createChannelMerger(2);
  const wide = c.createDelay(0.05);
  wide.delayTime.value = 0.013;
  const out = c.createGain();
  out.gain.value = ret;
  input.connect(conv);
  conv.connect(hp);
  hp.connect(lp);
  lp.connect(pocket);
  pocket.connect(merge, 0, 0);
  pocket.connect(wide);
  wide.connect(merge, 0, 1);
  merge.connect(out);
  out.connect(dest);
  return { input, conv };
}

let room: Room | null = null;
let roomOn = true;
let roomTimer: ReturnType<typeof setTimeout> | null = null;

/** The app's one shared room (made on first use, after the buses). */
export function getRoom(): Room | null {
  if (room) return room;
  const b = getBuses();
  if (!b) return null;
  try {
    room = makeRoom(b.ctx, b.master);
    if (!roomOn) {
      room.input.gain.value = 0;
      room.input.disconnect();
    }
    return room;
  } catch {
    return null;
  }
}

/**
 * Lite mode's real saving: fade the room's input out, then disconnect it, so the convolver gets no input and the
 * browser stops running it (a gain that only approaches 0 never lets it idle). Back on: reconnect and fade in.
 */
export function setRoomOn(on: boolean) {
  if (roomOn === on) return;
  roomOn = on;
  if (!room || !buses) return;
  const r = room;
  const ctx = buses.ctx;
  if (roomTimer) clearTimeout(roomTimer);
  roomTimer = null;
  try {
    if (on) {
      r.input.disconnect();
      r.input.connect(r.conv);
      ramp(r.input.gain, 1, 0.4, ctx);
    } else {
      ramp(r.input.gain, 0, 0.3, ctx);
      roomTimer = setTimeout(() => {
        if (!roomOn) r.input.disconnect();
      }, 400);
    }
  } catch {
    /* never let audio break the game */
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

/* ---------------- one TV at a time (no ghost narrator) ---------------- */

// A tab becomes a TV when it plays music or narration (phones only play effects). A new TV announces itself once on
// the "tv-active" channel: the newest TV wins and every other TV tab goes silent (narration paused, master at 0, no
// pref written). A silenced TV takes over again only when someone clicks or types in it, so an abandoned tab's own
// lines never steal the room back. A hidden TV keeps playing (the CD tests with phone tabs on the same laptop).
let isTv = false;
let silenced = false;
let tvChan: BroadcastChannel | null = null;
const tabId = Math.random().toString(36).slice(2);
const narrators = new Set<HTMLAudioElement>();

export function isSilenced() {
  return silenced;
}

function setSilenced(on: boolean) {
  if (silenced === on) return;
  silenced = on;
  if (on) for (const a of narrators) a.pause();
  if (buses) ramp(buses.master.gain, allMuted || silenced ? 0 : 1, 0.15, buses.ctx);
  emitChange();
}

function announceTv() {
  try {
    tvChan?.postMessage({ type: "claim", id: tabId });
  } catch {}
  setSilenced(false);
}

/** This tab is a TV (called when it starts music or narration). Announces only the first time. */
export function claimTv() {
  if (isServer() || isTv) return;
  isTv = true;
  try {
    tvChan = new BroadcastChannel("tv-active");
    tvChan.onmessage = (e) => {
      if (e.data?.type === "claim" && e.data.id !== tabId) setSilenced(true);
    };
  } catch {
    /* no BroadcastChannel: one TV per browser is then up to the people */
  }
  const touched = () => {
    if (silenced) announceTv();
  };
  window.addEventListener("pointerdown", touched, { capture: true, passive: true });
  window.addEventListener("keydown", touched, { capture: true, passive: true });
  announceTv();
}

/** True while a narrator line is playing on this TV (time warnings never talk over her). */
export function isNarrating() {
  for (const a of narrators) if (!a.paused && !a.ended) return true;
  return false;
}

/** Track a narrator line so a silenced TV never plays it. Returns an untrack. */
export function trackNarration(a: HTMLAudioElement): () => void {
  narrators.add(a);
  const block = () => {
    if (silenced) a.pause();
  };
  a.addEventListener("play", block);
  if (silenced) a.pause();
  return () => {
    narrators.delete(a);
    a.removeEventListener("play", block);
  };
}

if (!isServer()) attachAutoUnlock();
