"use client";

import {
  MUSIC_MUTE_KEY,
  MUSIC_VOL_KEY,
  emitChange,
  expRamp,
  getBuses,
  isRunning,
  isServer,
  onUnlock,
  peekCtx,
  ramp,
  readPref,
  writePref,
} from "./context";
import { dbToGain, reverbIR } from "./dsp";
import { Kit } from "./instruments";
import { MOODS, TRACKS, toMood, type Mood, type TrackDef, type TrackId } from "./tracks";

/**
 * The music engine (one per page). Generative loops scheduled with a lookahead clock, crossfaded,
 * ducked under narration, and pushed by `setIntensity` for big moments.
 *
 * Signal chain:
 *   track kits (crossfading) ──┬─> voice-pocket EQ ─> brightness LP ─> intensity gain ─> duck ─> volume ─> music bus
 *   shared reverb  <─ sends ───┘
 * The EQ cuts 2-4 kHz a little so narration always sits on top of the music.
 */

const BASE_LEVEL = dbToGain(-11); // ~-27 dBFS (K-weighted) at the default volume: well under a narrator at ~-18
const DUCK_DB = -12;
const DUCK_ATTACK = 0.25; // seconds, linear in dB
const DUCK_RELEASE = 0.6;
const CROSSFADE_SEC = 2.6;
const LOOKAHEAD = 0.35; // seconds scheduled ahead
const TICK_MS = 50;
const ROTATE_KEY = "gp-music-rotate";

interface Playing {
  def: TrackDef;
  kit: Kit;
  next: number; // time of the next 16th
  step: number; // 16ths since start
  mem: Record<string, unknown>;
  dying: number; // ctx time after which it is disposed (0 = alive)
}

class MusicEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private bright: BiquadFilterNode | null = null;
  private lift: GainNode | null = null;
  private duckG: GainNode | null = null;
  private vol: GainNode | null = null;
  private meter: AnalyserNode | null = null;
  private playing: Playing[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private want: TrackId | null = null;
  private intensity = 0;
  private swellTimer: ReturnType<typeof setTimeout> | null = null;
  private duckers = new Set<string>();
  private muted = false;
  private volume = 0.8;
  private prefsLoaded = false;
  private schedMs = 0;
  private schedTicks = 0;

  constructor() {
    if (!isServer()) onUnlock(() => this.resumeWanted());
  }

  /* ---------------- public API ---------------- */

  /** Lobby music ("Night Shift"). Safe to call before audio is unlocked: it starts on the first gesture. */
  startLobby() {
    this.play("lobby");
  }

  /** Story music. Pass a mood (or any mood-ish word such as the AI's "calm"/"epic"); omit it to rotate. */
  startStory(mood?: Mood | string | null) {
    this.play(toMood(mood) ?? this.rotate());
  }

  /** Play any track by id. Re-requesting the current track is a no-op (no restart). */
  play(id: TrackId) {
    if (isServer() || !TRACKS[id]) return;
    this.loadPrefs();
    this.want = id;
    emitChange();
    if (!isRunning()) return; // starts in resumeWanted() once unlocked
    this.switchTo(id);
  }

  /** Fade everything out (default 1.5 s). */
  stop(fadeSec = 1.5) {
    this.want = null;
    emitChange();
    const ctx = this.ctx;
    if (!ctx) return;
    for (const p of this.playing) this.kill(p, fadeSec);
  }

  /** 0..1. Brightens the mix, lifts it ~3 dB and makes every track busier. Glides over `sec`. */
  setIntensity(v: number, sec = 1.2) {
    this.intensity = Math.max(0, Math.min(1, Number(v) || 0));
    this.applyIntensity(sec);
  }

  /** A temporary swell (big roll, finale): go to `amount`, hold, then glide back to where it was. */
  swell(amount = 1, holdMs = 4000) {
    const base = this.intensity;
    if (this.swellTimer) clearTimeout(this.swellTimer);
    this.intensity = Math.max(base, amount);
    this.applyIntensity(0.4);
    this.swellTimer = setTimeout(() => {
      this.swellTimer = null;
      this.intensity = base;
      this.applyIntensity(2.5);
    }, holdMs);
  }

  /** Duck under narration: -12 dB, ~250 ms down, ~600 ms back up. Keyed, so overlapping clips are fine. */
  duck(on: boolean, key = "default") {
    if (on) this.duckers.add(key);
    else this.duckers.delete(key);
    this.applyDuck();
  }

  /** Duck while an <audio> element is playing. Returns a cleanup function (call it when you drop the element). */
  duckWhile(audio: HTMLAudioElement): () => void {
    const key = `a${Math.random().toString(36).slice(2)}`;
    const down = () => this.duck(true, key);
    const up = () => this.duck(false, key);
    const evs = ["play", "playing"] as const;
    const offs = ["pause", "ended", "error", "emptied"] as const;
    evs.forEach((e) => audio.addEventListener(e, down));
    offs.forEach((e) => audio.addEventListener(e, up));
    if (!audio.paused) down();
    return () => {
      evs.forEach((e) => audio.removeEventListener(e, down));
      offs.forEach((e) => audio.removeEventListener(e, up));
      up();
    };
  }

  /** Music volume 0..1 (persisted). */
  setMasterVolume(v: number) {
    this.loadPrefs();
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    writePref(MUSIC_VOL_KEY, String(this.volume));
    this.applyVolume(0.25);
    emitChange();
  }

  /** Music-only mute (persisted). The TV's global mute (sfx.setMuted) silences music too. */
  setMuted(m: boolean) {
    this.loadPrefs();
    this.muted = !!m;
    writePref(MUSIC_MUTE_KEY, this.muted ? "1" : "0");
    this.applyVolume(0.35);
    emitChange();
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMuted());
    return this.muted;
  }

  isMuted() {
    this.loadPrefs();
    return this.muted;
  }

  getVolume() {
    this.loadPrefs();
    return this.volume;
  }

  /** What is (or will be, once unlocked) playing. */
  current(): TrackId | null {
    return this.want;
  }

  getIntensity() {
    return this.intensity;
  }

  isDucked() {
    return this.duckers.size > 0;
  }

  /** For meters / debugging: an analyser on the music output (after volume). */
  analyser(): AnalyserNode | null {
    if (!this.ensureGraph() || !this.ctx || !this.vol) return null;
    if (!this.meter) {
      this.meter = this.ctx.createAnalyser();
      this.meter.fftSize = 2048;
      this.vol.connect(this.meter);
    }
    return this.meter;
  }

  /** Average main-thread cost of one scheduler tick (ms), for the sound-test page. */
  stats() {
    return {
      tickMs: this.schedTicks ? this.schedMs / this.schedTicks : 0,
      ticks: this.schedTicks,
      voices: this.playing.length,
      state: peekCtx()?.state ?? "none",
    };
  }

  /* ---------------- internals ---------------- */

  private loadPrefs() {
    if (this.prefsLoaded || isServer()) return;
    this.prefsLoaded = true;
    this.muted = readPref(MUSIC_MUTE_KEY) === "1";
    const v = parseFloat(readPref(MUSIC_VOL_KEY) ?? "");
    if (Number.isFinite(v)) this.volume = Math.max(0, Math.min(1, v));
  }

  private rotate(): Mood {
    let i = parseInt(readPref(ROTATE_KEY) ?? "", 10);
    if (!Number.isFinite(i)) i = Math.floor(Math.random() * MOODS.length);
    const m = MOODS[((i % MOODS.length) + MOODS.length) % MOODS.length];
    writePref(ROTATE_KEY, String(i + 1));
    return m;
  }

  private ensureGraph(): boolean {
    if (this.ctx) return true;
    const b = getBuses();
    if (!b) return false;
    this.loadPrefs();
    const ctx = b.ctx;
    try {
      this.input = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 32;
      // the "voice pocket": a gentle dip where speech intelligibility lives
      const pocket = ctx.createBiquadFilter();
      pocket.type = "peaking";
      pocket.frequency.value = 2600;
      pocket.Q.value = 0.8;
      pocket.gain.value = -4;
      this.bright = ctx.createBiquadFilter();
      this.bright.type = "lowpass";
      this.bright.Q.value = 0.5;
      this.bright.frequency.value = 5200;
      this.lift = ctx.createGain();
      this.duckG = ctx.createGain();
      this.vol = ctx.createGain();
      this.vol.gain.value = 0;
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = reverbIR(ctx, 2.8, 0.55, 0.02);
      const revRet = ctx.createGain();
      revRet.gain.value = 0.38;
      this.reverb.connect(revRet);
      revRet.connect(this.input);
      this.input.connect(hp);
      hp.connect(pocket);
      pocket.connect(this.bright);
      this.bright.connect(this.lift);
      this.lift.connect(this.duckG);
      this.duckG.connect(this.vol);
      this.vol.connect(b.music);
      this.ctx = ctx;
      this.applyIntensity(0.01);
      this.applyVolume(0.6);
      this.applyDuck();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  private resumeWanted() {
    if (this.want && isRunning()) this.switchTo(this.want);
  }

  private switchTo(id: TrackId) {
    if (!this.ensureGraph() || !this.ctx || !this.input || !this.reverb) return;
    const live = this.playing.find((p) => !p.dying);
    if (live && live.def.id === id) return;
    const ctx = this.ctx;
    for (const p of this.playing) if (!p.dying) this.kill(p, CROSSFADE_SEC);
    const def = TRACKS[id];
    try {
      const kit = new Kit(ctx, this.input, this.reverb, { bpm: def.bpm, ...def.kit });
      kit.mix.gain.value = def.level;
      // a fresh track waits a beat so the old one has started to fade
      const start = ctx.currentTime + (live ? 0.35 : 0.08);
      kit.setFade(1, live ? CROSSFADE_SEC : 1.2);
      this.playing.push({ def, kit, next: start, step: 0, mem: {}, dying: 0 });
    } catch {
      /* never let audio break the game */
    }
    this.applyVolume(0.6);
    this.startClock();
  }

  private kill(p: Playing, sec: number) {
    if (!this.ctx) return;
    p.kit.setFade(0, sec);
    p.dying = this.ctx.currentTime + sec + 3.5; // keep scheduling a little so tails ring out naturally
  }

  private startClock() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = performance.now();
    const now = ctx.currentTime;
    const until = now + LOOKAHEAD;
    for (const p of this.playing) {
      if (p.dying && now > p.dying) continue;
      const sp16 = 60 / p.def.bpm / 4;
      // fell behind (tab hidden, laptop slept): skip ahead instead of machine-gunning old notes
      if (p.next < now - 0.1) {
        const skip = Math.ceil((now - p.next) / sp16);
        p.next += skip * sp16;
        p.step += skip;
      }
      // stop composing new notes once the fade is nearly done (tails still ring)
      const composing = !p.dying || now < p.dying - 3.5;
      while (p.next < until) {
        if (composing) {
          const s = p.step % 16;
          let t = p.next;
          const def = p.def;
          if (def.swing) {
            if (def.swingUnit === 16 && s % 2 === 1) t += def.swing * sp16;
            if (def.swingUnit === 8 && s % 4 === 2) t += def.swing * sp16;
          }
          try {
            def.step({
              k: p.kit,
              t: Math.max(t, now + 0.005),
              bar: Math.floor(p.step / 16),
              s,
              beat: sp16 * 4,
              intensity: this.intensity,
              mem: p.mem as Step["mem"],
            });
          } catch {
            /* a bad note must never stop the music */
          }
        }
        p.next += sp16;
        p.step++;
      }
    }
    // dispose finished tracks
    const done = this.playing.filter((p) => p.dying && now > p.dying);
    if (done.length) {
      for (const p of done) p.kit.dispose();
      this.playing = this.playing.filter((p) => !done.includes(p));
    }
    if (!this.playing.length && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.schedMs += performance.now() - t0;
    this.schedTicks++;
  }

  private applyIntensity(sec: number) {
    const ctx = this.ctx;
    if (!ctx || !this.bright || !this.lift) return;
    const i = this.intensity;
    ramp(this.bright.frequency, 5200 * Math.pow(12000 / 5200, i), sec, ctx);
    ramp(this.lift.gain, dbToGain(3.5 * i), sec, ctx);
  }

  private applyDuck() {
    const ctx = this.ctx;
    if (!ctx || !this.duckG) return;
    const on = this.duckers.size > 0;
    expRamp(this.duckG.gain, on ? dbToGain(DUCK_DB) : 1, on ? DUCK_ATTACK : DUCK_RELEASE, ctx);
  }

  private applyVolume(sec: number) {
    const ctx = this.ctx;
    if (!ctx || !this.vol) return;
    const v = this.muted ? 0 : BASE_LEVEL * this.volume * this.volume; // squared: a natural-feeling slider
    ramp(this.vol.gain, v, sec, ctx);
  }
}

type Step = Parameters<TrackDef["step"]>[0];

/** The singleton. Import { music } and call music.startLobby(), music.startStory("eerie"), ... */
export const music = new MusicEngine();
export const getMusic = () => music;

export type { MusicEngine };
