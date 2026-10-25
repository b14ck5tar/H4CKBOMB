"use client";

import {
  MUSIC_MUTE_KEY,
  MUSIC_VOL_KEY,
  emitChange,
  expRamp,
  getBuses,
  getRoom,
  isRunning,
  isServer,
  onUnlock,
  peekCtx,
  ramp,
  readPref,
  setRoomOn,
  writePref,
} from "./context";
import { CUE_NAMES, cueLength, playCue, type CueName, type CueOpts } from "./cues";
import { dbToGain } from "./dsp";
import { Kit, type Layers } from "./instruments";
import { MOODS, TRACKS, layersFor, toMood, type Mood, type TrackDef, type TrackId } from "./tracks";

/**
 * The music engine (one per page). Generative loops scheduled with a lookahead clock, crossfaded,
 * ducked under narration, shaped by `setIntensity` (adaptive layers) and punctuated by phase cues.
 *
 * Signal chain:
 *   track kits (crossfading) ──┬─> low cut ─> mud dip ─> voice-pocket dip ─> soft top ─> brightness LP ─> intensity gain ─┐
 *   shared reverb  <─ sends ───┘                                                                                           │
 *   cue kits (riser, hit, ...) ─────────────────────────────────────────────────────────────────────────> duck ─> volume ─> music bus
 * The EQ dips 2.6 kHz a little so narration always sits on top of the music.
 */

const BASE_LEVEL = dbToGain(-11); // ~-27 dBFS (K-weighted) at the default volume: well under a narrator at ~-18
const DUCK_DB = -12;
const DUCK_ATTACK = 0.25; // seconds, linear in dB
const DUCK_RELEASE = 0.6;
const CROSSFADE_SEC = 2.6;
const LOOKAHEAD = 0.35; // seconds scheduled ahead (0.5 in lite mode, to ride out a busy main thread)
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
  private revIn: GainNode | null = null; // music's send into the shared room
  private revDuck: GainNode | null = null;
  private revVol: GainNode | null = null;
  private bright: BiquadFilterNode | null = null;
  private lift: GainNode | null = null;
  private duckG: GainNode | null = null;
  private vol: GainNode | null = null;
  private meter: AnalyserNode | null = null;
  private playing: Playing[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private want: TrackId | null = null;
  private intensity = 0.2;
  private swellTimer: ReturnType<typeof setTimeout> | null = null;
  private cueIn: GainNode | null = null;
  private cues = new Map<CueName, { kit: Kit; timer: ReturnType<typeof setTimeout> }>();
  private mode: "normal" | "suspense" | "tension" = "normal";
  private modeTimer: ReturnType<typeof setTimeout> | null = null;
  private duckers = new Set<string>();
  private muted = false;
  private volume = 0.8;
  private prefsLoaded = false;
  private schedMs = 0;
  private schedTicks = 0;
  private lite = false;
  private lastTickAt = 0;
  private slowTicks = 0;
  private underrunsSeen = -1;
  private nextHealthCheck = 0;

  constructor() {
    if (isServer()) return;
    onUnlock(() => this.resumeWanted());
    // very small machines start light
    if ((navigator.hardwareConcurrency ?? 8) <= 2) this.lite = true;
  }

  /**
   * Lite mode: half the polyphony, single-oscillator pads, no reverb send, a longer lookahead. It turns on
   * by itself if the browser reports audio underruns or the page's timers are starved, and stays on.
   */
  setLite(on: boolean) {
    this.lite = !!on;
    if (this.ctx) setRoomOn(!this.lite); // the real saving: the shared reverb is disconnected
    for (const p of this.playing) p.kit.setLite(this.lite);
    for (const c of this.cues.values()) c.kit.setLite(this.lite);
    emitChange();
  }

  isLite() {
    return this.lite;
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

  /**
   * A phase cue in the key of the current track (works with no track too):
   *   cue("riser", { ms })   suspense build into a roll; the drums step back while it rises
   *   cue("hit", { grade })  the landing ("up" | "down" | "neutral"): boom + crash + chord, ends a riser/finale
   *   cue("finale", { ms })  a short tension bed under the final roll (drone, heartbeat, ticking)
   *   cue("resolve")         the reveal: a warm major bloom; ends any tension
   *   cue("yourTurn")        a bright two-note sting
   * Before the first gesture this is a no-op.
   */
  cue(name: CueName | string, opts: CueOpts = {}) {
    const n = cueName(name);
    if (!n || isServer() || !isRunning() || !this.ensureGraph() || !this.ctx || !this.cueIn || !this.revIn) return;
    const ctx = this.ctx;
    const live = this.playing.find((p) => !p.dying)?.def;
    const key = live?.key ?? 62;
    const minor = live?.minor ?? true;
    if (n === "hit" || n === "resolve") {
      this.endCue("riser", 0.12);
      this.endCue("finale", n === "hit" ? 0.25 : 1.2);
      this.setMode("normal", 0, n === "hit" ? 0.25 : 1.5);
    }
    this.endCue(n, 0.08); // a repeated cue restarts
    try {
      const kit = new Kit(ctx, this.cueIn, this.revIn, { bpm: live?.bpm ?? 100, pump: 0, width: 0.5, echo: { beats: 0.75, feedback: 0.28, tone: 2600 } });
      if (this.lite) kit.setLite(true);
      kit.setFade(1, 0.02);
      const t0 = ctx.currentTime + 0.03;
      playCue(n, kit, t0, key, minor, opts);
      const len = cueLength(n, opts);
      const timer = setTimeout(() => this.endCue(n, 0.6), len);
      this.cues.set(n, { kit, timer });
      if (n === "hit") for (const p of this.playing) if (!p.dying) p.kit.pump(t0, 0.6, 0.6);
      if (n === "yourTurn") for (const p of this.playing) if (!p.dying) p.kit.pump(t0, 0.35, 0.4);
      if (n === "riser") {
        this.setMode("suspense", len + 600, 0.8);
        ramp(this.bright!.frequency, 9500, len / 1000, ctx);
      }
      if (n === "finale") this.setMode("tension", len, 1.2);
    } catch {
      /* never let audio break the game */
    }
  }

  /** Cut any running cue (riser, finale bed) and return to the normal mix. */
  cueStop(fadeSec = 0.5) {
    for (const n of CUE_NAMES) this.endCue(n, fadeSec);
    this.setMode("normal", 0, 1);
  }

  /** 0..1. Adds layers (drums, bass, lead), brightens the mix and lifts it ~3.5 dB. Glides over `sec`. */
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

  /**
   * A gentle "tape-slow" stumble for comic fails: the bed sinks (dark filter, -6 dB) for `sec`,
   * then recovers. Used by the disaster sting; never stops the music.
   */
  stumble(sec = 0.5) {
    const ctx = this.ctx;
    if (!ctx || !this.bright || !this.lift || !this.playing.some((p) => !p.dying)) return;
    const now = ctx.currentTime;
    const f = this.bright.frequency;
    const g = this.lift.gain;
    for (const p of [f, g]) {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
    }
    f.exponentialRampToValueAtTime(450, now + sec * 0.4);
    g.linearRampToValueAtTime(g.value * dbToGain(-6), now + sec * 0.4);
    setTimeout(() => this.applyIntensity(0.6), sec * 1000);
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
    // Hold the dip ~0.9 s after a line ends, so back-to-back lines duck ONCE instead of pumping in and out.
    let hold: ReturnType<typeof setTimeout> | null = null;
    const down = () => {
      if (hold) clearTimeout(hold);
      hold = null;
      this.duck(true, key);
    };
    const up = () => {
      if (hold) clearTimeout(hold);
      hold = setTimeout(() => this.duck(false, key), 900);
    };
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

  /** Key of the track that is playing (the sound effects follow it), or null. */
  keyInfo(): { key: number; minor: boolean } | null {
    const def = this.playing.find((p) => !p.dying)?.def;
    return def ? { key: def.key, minor: def.minor } : null;
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
      lite: this.lite,
      state: peekCtx()?.state ?? "none",
    };
  }

  /* ---------------- internals ---------------- */

  private endCue(n: CueName, fadeSec: number) {
    const c = this.cues.get(n);
    if (!c) return;
    this.cues.delete(n);
    clearTimeout(c.timer);
    c.kit.setFade(0, fadeSec);
    setTimeout(() => c.kit.dispose(), fadeSec * 1000 + 3500); // let reverb / echo tails ring out
  }

  /** suspense (riser): drums and lead step back; tension (finale bed): only a dark bed of the track remains. */
  private setMode(m: "normal" | "suspense" | "tension", holdMs: number, sec: number) {
    if (this.modeTimer) clearTimeout(this.modeTimer);
    this.modeTimer = null;
    this.mode = m;
    if (m !== "normal" && holdMs > 0) this.modeTimer = setTimeout(() => this.setMode("normal", 0, 1.5), holdMs);
    if (m === "tension" && this.ctx && this.bright) ramp(this.bright.frequency, 1600, sec, this.ctx);
    if (m === "normal") this.applyIntensity(sec);
    else this.applyLayers(sec);
  }

  private layersNow(def: TrackDef): Layers {
    const l = { ...layersFor(this.intensity), ...(def.layers?.(this.intensity) ?? {}) };
    if (this.mode === "suspense") {
      l.drums *= 0.3;
      l.lead *= 0.6;
    } else if (this.mode === "tension") {
      l.drums *= 0.12;
      l.lead *= 0.1;
      l.keys *= 0.5;
      l.bass *= 0.6;
    }
    return l;
  }

  private applyLayers(sec: number) {
    for (const p of this.playing) if (!p.dying) p.kit.setLayers(this.layersNow(p.def), sec);
  }

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
      const eq = (type: BiquadFilterType, f: number, q: number, gain = 0) => {
        const n = ctx.createBiquadFilter();
        n.type = type;
        n.frequency.value = f;
        n.Q.value = q;
        n.gain.value = gain;
        return n;
      };
      const hp = eq("highpass", 32, 0.7);
      const mud = eq("peaking", 300, 1, -2); // no boxy low-mids
      const pocket = eq("peaking", 2600, 0.8, -4); // the "voice pocket": where speech intelligibility lives
      const top = eq("highshelf", 9000, 0.7, -2.5); // no harsh highs
      hp.connect(mud);
      mud.connect(pocket);
      pocket.connect(top);
      this.bright = ctx.createBiquadFilter();
      this.bright.type = "lowpass";
      this.bright.Q.value = 0.5;
      this.bright.frequency.value = 5200;
      this.lift = ctx.createGain();
      this.duckG = ctx.createGain();
      this.vol = ctx.createGain();
      this.vol.gain.value = 0;
      // the send into the app's ONE shared room (context.ts), ducked and volumed like the dry music
      const room = getRoom();
      if (!room) return false;
      setRoomOn(!this.lite);
      this.revIn = ctx.createGain();
      this.revDuck = ctx.createGain();
      this.revVol = ctx.createGain();
      this.revVol.gain.value = 0;
      this.revIn.connect(this.revDuck);
      this.revDuck.connect(this.revVol);
      this.revVol.connect(room.input);
      this.input.connect(hp);
      top.connect(this.bright);
      this.bright.connect(this.lift);
      this.lift.connect(this.duckG);
      this.cueIn = ctx.createGain();
      this.cueIn.gain.value = 0.85;
      this.cueIn.connect(this.duckG);
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
    if (!this.ensureGraph() || !this.ctx || !this.input || !this.revIn) return;
    const live = this.playing.find((p) => !p.dying);
    if (live && live.def.id === id) return;
    const ctx = this.ctx;
    for (const p of this.playing) if (!p.dying) this.kill(p, CROSSFADE_SEC);
    const def = TRACKS[id];
    try {
      const kit = new Kit(ctx, this.input, this.revIn, { bpm: def.bpm, ...def.kit });
      if (this.lite) kit.setLite(true);
      kit.mix.gain.value = def.level;
      kit.setLayers(this.layersNow(def), 0.05);
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
    this.healthCheck(ctx, t0);
    const now = ctx.currentTime;
    const until = now + (this.lite ? 0.5 : LOOKAHEAD);
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
          } catch (e) {
            // a bad note must never stop the music
            if (process.env.NODE_ENV !== "production") console.warn("[sound] music step failed", e);
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

  /** Auto-engage lite mode when the browser is struggling (audio underruns, starved timers, slow scheduling). */
  private healthCheck(ctx: AudioContext, nowMs: number) {
    if (this.lite) return;
    const visible = typeof document === "undefined" || document.visibilityState === "visible";
    if (visible && this.lastTickAt && nowMs - this.lastTickAt > 200) this.slowTicks++;
    else if (this.slowTicks > 0 && nowMs - this.lastTickAt < 80) this.slowTicks -= 0.25;
    this.lastTickAt = nowMs;
    let why = "";
    if (this.slowTicks >= 4) why = "starved timers";
    if (this.schedTicks > 40 && this.schedMs / this.schedTicks > 4) why = "slow scheduling";
    if (nowMs >= this.nextHealthCheck) {
      this.nextHealthCheck = nowMs + 1000;
      const stats = (ctx as AudioContext & { playbackStats?: { underrunEvents?: number } }).playbackStats;
      const u = stats?.underrunEvents;
      if (typeof u === "number") {
        if (this.underrunsSeen >= 0 && u - this.underrunsSeen >= 3) why = "audio underruns";
        this.underrunsSeen = u;
      }
    }
    if (why) {
      if (process.env.NODE_ENV !== "production") console.info(`[sound] lite mode on (${why})`);
      this.setLite(true);
    }
  }

  private applyIntensity(sec: number) {
    const ctx = this.ctx;
    if (!ctx || !this.bright || !this.lift) return;
    const i = this.intensity;
    if (this.mode === "normal") ramp(this.bright.frequency, 5200 * Math.pow(12000 / 5200, i), sec, ctx);
    ramp(this.lift.gain, dbToGain(3.5 * i), sec, ctx);
    this.applyLayers(sec);
  }

  private applyDuck() {
    const ctx = this.ctx;
    if (!ctx || !this.duckG) return;
    const on = this.duckers.size > 0;
    expRamp(this.duckG.gain, on ? dbToGain(DUCK_DB) : 1, on ? DUCK_ATTACK : DUCK_RELEASE, ctx);
    if (this.revDuck) expRamp(this.revDuck.gain, on ? dbToGain(DUCK_DB) : 1, on ? DUCK_ATTACK : DUCK_RELEASE, ctx);
  }

  private applyVolume(sec: number) {
    const ctx = this.ctx;
    if (!ctx || !this.vol) return;
    const v = this.muted ? 0 : BASE_LEVEL * this.volume * this.volume; // squared: a natural-feeling slider
    ramp(this.vol.gain, v, sec, ctx);
    if (this.revVol) ramp(this.revVol.gain, v, sec, ctx);
  }
}

type Step = Parameters<TrackDef["step"]>[0];

const CUE_ALIASES: Record<string, CueName> = {
  riser: "riser", roll: "riser", suspense: "riser", build: "riser",
  hit: "hit", land: "hit", landing: "hit", impact: "hit",
  finale: "finale", tension: "finale", finalroll: "finale",
  resolve: "resolve", reveal: "resolve",
  yourturn: "yourTurn", turn: "yourTurn", turnstart: "yourTurn",
};
function cueName(x: string): CueName | null {
  return CUE_ALIASES[String(x ?? "").toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

/** The singleton. Import { music } and call music.startLobby(), music.startStory("eerie"), ... */
export const music = new MusicEngine();
export const getMusic = () => music;

export type { MusicEngine };
