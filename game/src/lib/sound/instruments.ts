"use client";

import { EPS, adEnv, asrEnv, cleanup, mtof, rand, satCurve, wave, whiteNoise, pinkNoise } from "./dsp";

/**
 * One track instance's little studio. Per instrument family a bus with its own clean-up EQ, then a
 * "layer" gain (so intensity can bring drums / bass / lead in and out smoothly), a sidechain-style
 * pump on the tonal buses (ducked by the kick for that gentle groove breathing), a stereo chorus on
 * the pads and keys for width, a ping-pong echo, and sends into the shared reverb.
 * Persistent nodes are built once per track; per-note nodes are tiny and disconnect themselves.
 */

export interface KitOptions {
  bpm: number;
  padCutoff?: number; // Hz
  padLfo?: { rate: number; depth: number }; // Hz, Hz of cutoff movement
  padQ?: number;
  wobble?: { rate: number; depth: number }; // tape wow on the keys bus (seconds of delay modulation)
  echo?: { beats: number; feedback: number; tone: number };
  bassCutoff?: number;
  bassDrive?: number;
  reverb?: { pad?: number; keys?: number; lead?: number; pluck?: number; drums?: number; fx?: number; echo?: number };
  /** sidechain pump depth when the kick (or tom) hits, 0..0.6 */
  pump?: number;
  /** stereo chorus amount on pads and keys (0 = off) */
  width?: number;
}

export interface Layers {
  drums: number;
  bass: number;
  lead: number;
  keys: number;
  pad: number;
}

export class Kit {
  readonly ctx: AudioContext;
  readonly mix: GainNode;
  readonly fade: GainNode;
  readonly fadeRev: GainNode;
  readonly beat: number; // seconds per beat
  readonly padIn: GainNode;
  readonly padLP: BiquadFilterNode;
  readonly keysIn: GainNode;
  readonly leadIn: GainNode;
  readonly pluckIn: GainNode;
  readonly bassIn: GainNode;
  readonly drumIn: GainNode;
  readonly fxIn: GainNode;
  readonly echoIn: GainNode;
  readonly pumpDepth: number;
  private readonly pumpG: GainNode;
  private readonly layer: Record<keyof Layers, GainNode>;
  private persist: AudioScheduledSourceNode[] = [];
  private nodes: AudioNode[] = [];
  private readonly revSend: GainNode;
  private readonly shaper: WaveShaperNode;
  private pans = new Map<AudioNode, Map<number, AudioNode>>();
  private load: { end: number; cost: number }[] = [];
  /** max simultaneous oscillator/noise sources this track may run (lowered in lite mode) */
  private cap = 56;
  lite = false;

  constructor(ctx: AudioContext, dest: AudioNode, reverbIn: AudioNode, o: KitOptions) {
    this.ctx = ctx;
    this.beat = 60 / o.bpm;
    this.pumpDepth = o.pump ?? 0;
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      this.nodes.push(n);
      return n;
    };
    const filt = (type: BiquadFilterType, f: number, q = 0.7, gain = 0) => {
      const n = ctx.createBiquadFilter();
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      n.gain.value = gain;
      this.nodes.push(n);
      return n;
    };
    const chain = (...ns: AudioNode[]) => {
      for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]);
      return ns[ns.length - 1];
    };
    const send = (from: AudioNode, to: AudioNode, amt: number) => {
      if (amt <= 0) return;
      const s = g(amt);
      from.connect(s);
      s.connect(to);
    };
    const rv = { pad: 0.5, keys: 0.3, lead: 0.45, pluck: 0.35, drums: 0.08, fx: 0.7, echo: 0.35, ...(o.reverb ?? {}) };

    this.mix = g(1);
    this.fade = g(0);
    this.fadeRev = g(0);
    const revSend = g(1);
    this.revSend = revSend;
    this.mix.connect(this.fade);
    this.fade.connect(dest);
    revSend.connect(this.fadeRev);
    this.fadeRev.connect(reverbIn);

    this.layer = { drums: g(1), bass: g(1), lead: g(1), keys: g(1), pad: g(1) };
    this.pumpG = g(1);
    this.pumpG.connect(this.mix);

    // stereo chorus (two modulated short delays panned wide around the dry signal)
    const width = o.width ?? 0.45;
    const chorus = g(1);
    chorus.connect(this.pumpG);
    if (width > 0 && typeof ctx.createStereoPanner === "function") {
      [
        { base: 0.0072, rate: 0.31, pan: -0.85 },
        { base: 0.0109, rate: 0.37, pan: 0.85 },
      ].forEach((c) => {
        const d = ctx.createDelay(0.05);
        d.delayTime.value = c.base;
        const p = ctx.createStereoPanner();
        p.pan.value = c.pan;
        const wg = g(width);
        this.nodes.push(d, p);
        chain(chorus, d, wg, p, this.pumpG);
        this.lfo(c.rate, 0.0018, d.delayTime);
      });
    }

    // ping-pong echo
    const e = o.echo ?? { beats: 0.75, feedback: 0.3, tone: 2600 };
    this.echoIn = g(1);
    const dl = ctx.createDelay(2);
    const dr = ctx.createDelay(2);
    dl.delayTime.value = dr.delayTime.value = Math.min(1.9, e.beats * this.beat);
    const etone = filt("lowpass", e.tone);
    const ehp = filt("highpass", 300);
    const fb = g(e.feedback);
    this.nodes.push(dl, dr);
    chain(this.echoIn, ehp, etone, dl, dr, fb, dl);
    const echoOut = g(0.5);
    if (typeof ctx.createChannelMerger === "function") {
      const m = ctx.createChannelMerger(2);
      this.nodes.push(m);
      dl.connect(m, 0, 0);
      dr.connect(m, 0, 1);
      m.connect(echoOut);
    } else dl.connect(echoOut);
    echoOut.connect(this.mix);
    send(echoOut, revSend, rv.echo);

    // pad: low cut (no mud under the bass), breathing lowpass, chorus
    this.padIn = g(1);
    this.padLP = filt("lowpass", o.padCutoff ?? 900, o.padQ ?? 0.7);
    chain(this.padIn, filt("highpass", 170, 0.6), this.padLP, this.layer.pad, chorus);
    send(this.layer.pad, revSend, rv.pad);
    const lfo = o.padLfo ?? { rate: 0.06, depth: 280 };
    this.lfo(lfo.rate * rand(0.85, 1.15), lfo.depth, this.padLP.frequency);

    // keys: tape wobble, low cut, a soft top (FM keys can get glassy)
    this.keysIn = g(1);
    const w = o.wobble ?? { rate: 0.4, depth: 0.0013 };
    let keysHead: AudioNode = this.keysIn;
    if (w.depth > 0) {
      const wd = ctx.createDelay(0.1);
      wd.delayTime.value = 0.012;
      this.nodes.push(wd);
      this.keysIn.connect(wd);
      this.lfo(w.rate, w.depth, wd.delayTime);
      keysHead = wd;
    }
    chain(keysHead, filt("highpass", 120, 0.6), filt("highshelf", 5000, 0.7, -4), this.layer.keys);
    this.layer.keys.connect(chorus);
    send(this.layer.keys, revSend, rv.keys);
    send(this.layer.keys, this.echoIn, 0.1);

    // lead + pluck share the "lead" layer
    this.leadIn = g(1);
    this.pluckIn = g(1);
    const leadHP = filt("highpass", 260, 0.6);
    const leadTop = filt("highshelf", 7000, 0.7, -3);
    const pluckHP = filt("highpass", 200, 0.6);
    this.leadIn.connect(leadHP);
    this.pluckIn.connect(pluckHP);
    pluckHP.connect(leadTop);
    chain(leadHP, leadTop, this.layer.lead, this.mix);
    send(this.layer.lead, revSend, (rv.lead + rv.pluck) / 2);
    send(this.layer.lead, this.echoIn, 0.38);

    // bass: warm saturation (reads on laptop speakers), then a lowpass, then the pump
    this.bassIn = g(1);
    const sh = ctx.createWaveShaper();
    sh.curve = satCurve(ctx, o.bassDrive ?? 1.8);
    sh.oversample = "2x";
    this.shaper = sh;
    this.nodes.push(sh);
    chain(this.bassIn, sh, filt("lowpass", o.bassCutoff ?? 520, 0.6), filt("highpass", 34, 0.7), this.layer.bass, this.pumpG);

    this.drumIn = g(1);
    chain(this.drumIn, filt("highshelf", 8000, 0.7, -3), this.layer.drums, this.mix);
    send(this.layer.drums, revSend, rv.drums);

    this.fxIn = g(1);
    this.fxIn.connect(this.mix);
    send(this.fxIn, revSend, rv.fx);
  }

  private lfo(rate: number, depth: number, target: AudioParam) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = rate;
    const d = ctx.createGain();
    d.gain.value = depth;
    o.connect(d);
    d.connect(target);
    o.start(ctx.currentTime + 0.01);
    this.persist.push(o);
    this.nodes.push(d);
  }

  /** Crossfade this track in or out (an exponential approach: smooth, no audible "corner"). */
  setFade(v: number, sec: number) {
    const now = this.ctx.currentTime;
    for (const p of [this.fade.gain, this.fadeRev.gain]) {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.setTargetAtTime(v, now, sec / 3.2);
    }
  }

  /** Bring layers in or out smoothly (0..1 each). */
  setLayers(l: Partial<Layers>, sec: number) {
    const now = this.ctx.currentTime;
    for (const k of Object.keys(l) as (keyof Layers)[]) {
      const v = l[k];
      if (v == null) continue;
      const p = this.layer[k].gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.setTargetAtTime(Math.max(0, v), now, Math.max(0.02, sec / 3));
    }
  }

  /**
   * Lite mode (busy or slow machines): about half the polyphony, one oscillator per pad note, no
   * reverb send (the convolver then idles), no oversampling on the bass saturation.
   */
  setLite(on: boolean) {
    this.lite = on;
    this.cap = on ? 26 : 56;
    this.shaper.oversample = on ? "none" : "2x";
    const now = this.ctx.currentTime;
    this.revSend.gain.cancelScheduledValues(now);
    this.revSend.gain.setTargetAtTime(on ? 0 : 1, now, 0.3);
  }

  /** Polyphony budget: reserve `cost` sources until `end`; non-essential notes are dropped when full. */
  private room(cost: number, end: number, essential = false): boolean {
    const now = this.ctx.currentTime;
    let used = 0;
    this.load = this.load.filter((x) => x.end > now);
    for (const x of this.load) used += x.cost;
    if (!essential && used + cost > this.cap) return false;
    this.load.push({ end, cost });
    return true;
  }

  /** Sidechain-style breathing: the tonal buses dip when the kick hits and swell back. */
  pump(t: number, depth = this.pumpDepth, release = 0.2) {
    if (depth <= 0) return;
    const p = this.pumpG.gain;
    p.setTargetAtTime(1 - Math.min(0.8, depth), t, 0.006);
    p.setTargetAtTime(1, t + 0.035, release / 3);
  }

  dispose() {
    for (const s of this.persist) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.persist = [];
    this.nodes = [];
  }

  /** A reused panner per destination and position (quantised to 9 positions): no per-note panner nodes. */
  private pan(dest: AudioNode, p: number): AudioNode {
    const q = Math.round(Math.max(-1, Math.min(1, p || 0)) * 4) / 4;
    if (!q || typeof this.ctx.createStereoPanner !== "function") return dest;
    let m = this.pans.get(dest);
    if (!m) {
      m = new Map();
      this.pans.set(dest, m);
    }
    let sp = m.get(q);
    if (!sp) {
      const n = this.ctx.createStereoPanner();
      n.pan.value = q;
      n.connect(dest);
      this.nodes.push(n);
      m.set(q, n);
      sp = n;
    }
    return sp;
  }

  /* ================================================================ */
  /* instruments                                                       */
  /* ================================================================ */

  /** Soft analog pad: two detuned soft-saw voices per note, slow swell. */
  pad(notes: number[], t: number, dur: number, vel: number, o: { attack?: number; release?: number; detune?: number; kind?: "warm" | "hollow" | "organ" } = {}) {
    const ctx = this.ctx;
    const attack = o.attack ?? 1.4;
    const release = o.release ?? 2.2;
    const per = (vel * 0.16) / Math.sqrt(Math.max(1, notes.length));
    const w = wave(ctx, o.kind ?? "warm");
    const voices = this.lite ? 1 : 2;
    for (const n of notes) {
      this.room(voices, t + dur + release, true);
      const f = mtof(n);
      const env = ctx.createGain();
      asrEnv(env.gain, t, per, attack, Math.max(0, dur - attack), release);
      const p = this.pan(this.padIn, rand(-0.45, 0.45));
      env.connect(p);
      const det = o.detune ?? 7;
      (voices === 1 ? [0] : [-det, det]).forEach((d, i) => {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(w);
        osc.frequency.value = f;
        osc.detune.value = d + rand(-2, 2);
        osc.connect(env);
        osc.start(t);
        osc.stop(t + dur + release + 0.1);
        if (i === 0) cleanup(osc, env);
        else cleanup(osc);
      });
    }
  }

  /** FM electric piano (Rhodes-ish): bell-y attack that mellows, plus a tiny tine. */
  keys(notes: number[], t: number, dur: number, vel: number, o: { strum?: number; bright?: number } = {}) {
    const ctx = this.ctx;
    const per = (vel * 0.2) / Math.sqrt(Math.max(1, notes.length));
    notes.forEach((n, i) => {
      const tt = t + i * (o.strum ?? 0.018) + rand(0, 0.008);
      if (!this.room(2, tt + Math.max(1.2, dur) + 0.7, i === 0)) return;
      const f = mtof(n);
      const v = per * rand(0.85, 1.05);
      const car = ctx.createOscillator();
      car.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.frequency.value = f;
      const mg = ctx.createGain();
      const bright = (o.bright ?? 1) * (0.6 + vel * 0.6);
      mg.gain.setValueAtTime(f * 2.4 * bright, tt);
      mg.gain.exponentialRampToValueAtTime(f * 0.35 * bright + 1, tt + 0.5);
      mod.connect(mg);
      mg.connect(car.frequency);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(EPS, tt);
      amp.gain.exponentialRampToValueAtTime(v, tt + 0.006);
      amp.gain.exponentialRampToValueAtTime(v * 0.35, tt + 1.2);
      amp.gain.setTargetAtTime(EPS, tt + Math.max(1.2, dur), 0.18);
      car.connect(amp);
      const p = this.pan(this.keysIn, (i / Math.max(1, notes.length - 1) - 0.5) * 0.5);
      amp.connect(p);
      const end = tt + Math.max(1.2, dur) + 0.7;
      for (const s of [car, mod]) {
        s.start(tt);
        s.stop(end);
      }
      cleanup(car, amp, mg);
      cleanup(mod);
    });
  }

  /** FM bell / music box / celesta. ratio 3.5 = bell, 5 = music box, 2 = glass. */
  bell(n: number, t: number, vel: number, o: { ratio?: number; index?: number; decay?: number; pan?: number; detune?: number; dest?: "lead" | "pluck" | "keys" } = {}) {
    const ctx = this.ctx;
    const decay = o.decay ?? 1.6;
    if (!this.room(2, t + decay)) return;
    const f = mtof(n) * Math.pow(2, (o.detune ?? 0) / 1200);
    const ratio = o.ratio ?? 3.5;
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * ratio;
    const mg = ctx.createGain();
    const idx = (o.index ?? 1.6) * f * ratio;
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(idx * 0.04 + 0.5, t + decay * 0.35);
    mod.connect(mg);
    mg.connect(car.frequency);
    const amp = ctx.createGain();
    adEnv(amp.gain, t, vel * 0.14, 0.003, decay);
    car.connect(amp);
    const p = this.pan(o.dest === "pluck" ? this.pluckIn : o.dest === "keys" ? this.keysIn : this.leadIn, o.pan ?? 0);
    amp.connect(p);
    car.start(t);
    mod.start(t);
    car.stop(t + decay + 0.05);
    mod.stop(t + decay + 0.05);
    cleanup(car, amp, mg);
    cleanup(mod);
  }

  /** Subtractive pluck (pizzicato / arp): a bright filter snap that closes fast. */
  pluck(n: number, t: number, vel: number, o: { decay?: number; bright?: number; pan?: number; type?: OscillatorType; q?: number } = {}) {
    const ctx = this.ctx;
    const decay = o.decay ?? 0.35;
    if (!this.room(2, t + decay)) return;
    const f = mtof(n);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sawtooth";
    osc.frequency.value = f;
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = f;
    osc2.detune.value = rand(4, 9);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = o.q ?? 1.5;
    const top = Math.min(9000, f * 7 * (o.bright ?? 1));
    lp.frequency.setValueAtTime(top, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, f * 1.2), t + decay * 0.7);
    const amp = ctx.createGain();
    adEnv(amp.gain, t, vel * 0.12, 0.003, decay);
    osc.connect(lp);
    osc2.connect(lp);
    lp.connect(amp);
    const p = this.pan(this.pluckIn, o.pan ?? 0);
    amp.connect(p);
    for (const s of [osc, osc2]) {
      s.start(t);
      s.stop(t + decay + 0.05);
    }
    cleanup(osc, lp, amp);
    cleanup(osc2);
  }

  /** Bass: "sub" (round), "pluck" (upright-ish), "saw" (filtered synth pulse). */
  bass(n: number, t: number, dur: number, vel: number, kind: "sub" | "pluck" | "saw" = "sub", glideFrom?: number) {
    const ctx = this.ctx;
    this.room(2, t + dur + 0.3, true);
    const f = mtof(n);
    const amp = ctx.createGain();
    const a = vel * 0.32;
    if (kind === "pluck") {
      amp.gain.setValueAtTime(EPS, t);
      amp.gain.exponentialRampToValueAtTime(a, t + 0.006);
      amp.gain.exponentialRampToValueAtTime(a * 0.25, t + Math.min(dur, 0.35));
      amp.gain.setTargetAtTime(EPS, t + dur, 0.04);
    } else {
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(a, t + (kind === "sub" ? 0.02 : 0.008));
      amp.gain.setValueAtTime(a * 0.9, t + Math.max(0.03, dur - 0.05));
      amp.gain.setTargetAtTime(0, t + Math.max(0.03, dur - 0.05), 0.05);
    }
    amp.connect(this.bassIn);
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const mk = (type: OscillatorType, gain: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      if (glideFrom != null) {
        o.frequency.setValueAtTime(mtof(glideFrom), t);
        o.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.6, dur * 0.5));
      } else o.frequency.value = f;
      const gg = ctx.createGain();
      gg.gain.value = gain;
      o.connect(gg);
      oscs.push(o);
      gains.push(gg);
      return gg;
    };
    let lp: BiquadFilterNode | null = null;
    if (kind === "saw") {
      lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 3;
      lp.frequency.setValueAtTime(180, t);
      lp.frequency.exponentialRampToValueAtTime(900 + vel * 700, t + 0.025);
      lp.frequency.exponentialRampToValueAtTime(220, t + Math.min(0.3, dur));
      lp.connect(amp);
      mk("sawtooth", 0.55).connect(lp);
      mk("sine", 0.8).connect(amp);
    } else {
      mk("sine", 1).connect(amp);
      mk("triangle", kind === "pluck" ? 0.55 : 0.25).connect(amp);
    }
    for (const o of oscs) {
      o.start(t);
      o.stop(t + dur + 0.3);
    }
    cleanup(oscs[0], amp, ...gains, ...(lp ? [lp] : []));
    cleanup(oscs[1]);
  }

  private noise(t: number, dur: number, dest: AudioNode, type: BiquadFilterType, f0: number, q: number, vol: number, attack = 0.001, f1?: number, pan = 0) {
    const ctx = this.ctx;
    this.room(1, t + dur, true);
    const s = ctx.createBufferSource();
    s.buffer = whiteNoise(ctx);
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    fl.Q.value = q;
    const amp = ctx.createGain();
    adEnv(amp.gain, t, vol, attack, dur);
    s.connect(fl);
    fl.connect(amp);
    const p = this.pan(dest, pan);
    amp.connect(p);
    s.start(t, rand(0, 1.5));
    s.stop(t + dur + 0.02);
    cleanup(s, fl, amp);
  }

  /** Soft lo-fi kick. */
  kick(t: number, vel: number, o: { f0?: number; f1?: number; decay?: number } = {}) {
    const ctx = this.ctx;
    const decay = o.decay ?? 0.32;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(o.f0 ?? 120, t);
    osc.frequency.exponentialRampToValueAtTime(o.f1 ?? 46, t + 0.11);
    const amp = ctx.createGain();
    adEnv(amp.gain, t, vel * 0.5, 0.003, decay);
    osc.connect(amp);
    amp.connect(this.drumIn);
    osc.start(t);
    osc.stop(t + decay + 0.05);
    cleanup(osc, amp);
    this.noise(t, 0.02, this.drumIn, "lowpass", 1400, 0.7, vel * 0.08);
    this.pump(t, this.pumpDepth * Math.min(1, vel + 0.2));
  }

  /** "rim" (cross-stick), "brush" (soft swish), "snap" (finger snap), "clap" (soft lo-fi clap). */
  snare(t: number, vel: number, kind: "rim" | "brush" | "snap" | "clap" = "rim") {
    const d = this.drumIn;
    if (kind === "rim") {
      this.noise(t, 0.06, d, "bandpass", 1900, 1.6, vel * 0.22);
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 340;
      const a = ctx.createGain();
      adEnv(a.gain, t, vel * 0.12, 0.001, 0.035);
      o.connect(a);
      a.connect(d);
      o.start(t);
      o.stop(t + 0.06);
      cleanup(o, a);
    } else if (kind === "brush") {
      this.noise(t, 0.2, d, "bandpass", 3200, 0.6, vel * 0.11, 0.012, 2000);
    } else if (kind === "snap") {
      this.noise(t, 0.045, d, "bandpass", 2600, 3.2, vel * 0.32);
      this.noise(t + 0.004, 0.012, d, "highpass", 5000, 0.7, vel * 0.12);
    } else {
      for (const off of [0, 0.011, 0.023]) this.noise(t + off, 0.03, d, "bandpass", 1500, 1.1, vel * 0.13);
      this.noise(t + 0.025, 0.18, d, "bandpass", 1300, 0.9, vel * 0.1);
    }
  }

  hat(t: number, vel: number, open = false) {
    this.noise(t, open ? 0.22 : 0.035, this.drumIn, "highpass", 7200, 0.8, vel * 0.09, 0.001, undefined, 0.28);
  }

  shaker(t: number, vel: number) {
    this.noise(t, 0.075, this.drumIn, "bandpass", 5600, 0.9, vel * 0.07, 0.018, undefined, -0.32);
  }

  /** A soft crash / cymbal swell tail. */
  crash(t: number, vel: number, dur = 1.6) {
    this.noise(t, dur, this.drumIn, "highpass", 5200, 0.6, vel * 0.08, 0.004, 3800, 0.1);
    this.noise(t, dur * 0.6, this.drumIn, "bandpass", 3200, 0.8, vel * 0.04, 0.004, undefined, -0.2);
  }

  /** A rising synth tone (for risers): detuned saws gliding up through an opening filter. */
  riseTone(n0: number, n1: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(3200, t + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel * 0.05, t + dur * 0.85);
    amp.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    lp.connect(amp);
    amp.connect(this.fxIn);
    const oscs = [-9, 9].map((det) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(mtof(n0), t);
      o.frequency.exponentialRampToValueAtTime(mtof(n1), t + dur);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
      return o;
    });
    cleanup(oscs[0], lp, amp);
  }

  tom(t: number, vel: number, f = 90) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    const amp = ctx.createGain();
    adEnv(amp.gain, t, vel * 0.42, 0.004, 0.55);
    osc.connect(amp);
    amp.connect(this.drumIn);
    osc.start(t);
    osc.stop(t + 0.6);
    cleanup(osc, amp);
    this.noise(t, 0.08, this.drumIn, "lowpass", 600, 0.7, vel * 0.06);
    this.pump(t, this.pumpDepth * vel);
  }

  /** A filtered-noise swell (wind, riser, breath). */
  swell(t: number, dur: number, vel: number, f0: number, f1: number, q = 1.2) {
    const ctx = this.ctx;
    if (!this.room(1, t + dur)) return;
    const s = ctx.createBufferSource();
    s.buffer = pinkNoise(ctx);
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = "bandpass";
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel * 0.25, t + dur * 0.6);
    amp.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(fl);
    fl.connect(amp);
    const p = this.pan(this.fxIn, rand(-0.5, 0.5));
    amp.connect(p);
    s.start(t, rand(0, 2));
    s.stop(t + dur + 0.05);
    cleanup(s, fl, amp);
  }

  /** A theremin-ish sine with vibrato that glides between notes (spooky-funny). */
  theremin(notes: number[], t: number, noteDur: number, vel: number) {
    const ctx = this.ctx;
    if (!this.room(2, t + notes.length * noteDur + 0.7)) return;
    const osc = ctx.createOscillator();
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.3;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(14, t + 0.5);
    vib.connect(vg);
    vg.connect(osc.detune);
    notes.forEach((n, i) => {
      const tt = t + i * noteDur;
      if (i === 0) osc.frequency.setValueAtTime(mtof(n), tt);
      else osc.frequency.setTargetAtTime(mtof(n), tt, 0.09);
    });
    const total = notes.length * noteDur;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel * 0.06, t + 0.35);
    amp.gain.setValueAtTime(vel * 0.06, t + total - 0.2);
    amp.gain.linearRampToValueAtTime(0, t + total + 0.6);
    osc.connect(amp);
    amp.connect(this.leadIn);
    osc.start(t);
    vib.start(t);
    osc.stop(t + total + 0.7);
    vib.stop(t + total + 0.7);
    cleanup(osc, amp);
    cleanup(vib, vg);
  }
}
