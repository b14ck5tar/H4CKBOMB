"use client";

import { EPS, adEnv, asrEnv, cleanup, crackleNoise, mtof, rand, satCurve, wave, whiteNoise, pinkNoise } from "./dsp";

/**
 * One track instance's little studio: a set of buses (pad, keys, lead, pluck, bass, drums, fx),
 * a tape-wobble on the keys, a tempo-synced echo, and sends into the shared reverb.
 * Persistent nodes (buses, LFOs, filters) are built once per track; per-note nodes are tiny and
 * disconnect themselves when the note ends.
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
  crackle?: number; // vinyl crackle level (0 = off)
  hiss?: number; // tape hiss level (0 = off)
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
  private persist: AudioScheduledSourceNode[] = [];
  private nodes: AudioNode[] = [];

  constructor(ctx: AudioContext, dest: AudioNode, reverbIn: AudioNode, o: KitOptions) {
    this.ctx = ctx;
    this.beat = 60 / o.bpm;
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      this.nodes.push(n);
      return n;
    };
    const send = (from: AudioNode, to: AudioNode, amt: number) => {
      if (amt <= 0) return;
      const s = g(amt);
      from.connect(s);
      s.connect(to);
    };
    const rv = { pad: 0.55, keys: 0.32, lead: 0.5, pluck: 0.4, drums: 0.1, fx: 0.7, echo: 0.4, ...(o.reverb ?? {}) };

    this.mix = g(1);
    this.fade = g(0);
    this.fadeRev = g(0);
    const revSend = g(1);
    this.mix.connect(this.fade);
    this.fade.connect(dest);
    revSend.connect(this.fadeRev);
    this.fadeRev.connect(reverbIn);

    // pad: shared lowpass with a slow LFO on the cutoff (the "breathing")
    this.padIn = g(1);
    this.padLP = ctx.createBiquadFilter();
    this.padLP.type = "lowpass";
    this.padLP.frequency.value = o.padCutoff ?? 900;
    this.padLP.Q.value = o.padQ ?? 0.7;
    this.nodes.push(this.padLP);
    this.padIn.connect(this.padLP);
    this.padLP.connect(this.mix);
    send(this.padLP, revSend, rv.pad);
    const lfo = o.padLfo ?? { rate: 0.06, depth: 280 };
    this.lfo(lfo.rate * rand(0.85, 1.15), lfo.depth, this.padLP.frequency);

    // echo: tempo-synced, darkening feedback
    const e = o.echo ?? { beats: 0.75, feedback: 0.3, tone: 2600 };
    this.echoIn = g(1);
    const dl = ctx.createDelay(2);
    dl.delayTime.value = Math.min(1.9, e.beats * this.beat);
    const ef = ctx.createBiquadFilter();
    ef.type = "lowpass";
    ef.frequency.value = e.tone;
    const eh = ctx.createBiquadFilter();
    eh.type = "highpass";
    eh.frequency.value = 280;
    const fb = g(e.feedback);
    const echoOut = g(0.55);
    this.nodes.push(dl, ef, eh);
    this.echoIn.connect(dl);
    dl.connect(ef);
    ef.connect(eh);
    eh.connect(fb);
    fb.connect(dl);
    eh.connect(echoOut);
    if (typeof ctx.createStereoPanner === "function") {
      const ep = ctx.createStereoPanner();
      ep.pan.value = 0.35;
      this.nodes.push(ep);
      echoOut.connect(ep);
      ep.connect(this.mix);
    } else echoOut.connect(this.mix);
    send(echoOut, revSend, rv.echo);

    // keys: tape wobble (a modulated short delay = gentle pitch wow, like an old cassette)
    this.keysIn = g(1);
    const keysOut = g(1);
    const w = o.wobble ?? { rate: 0.4, depth: 0.0015 };
    if (w.depth > 0) {
      const wd = ctx.createDelay(0.1);
      wd.delayTime.value = 0.012;
      this.nodes.push(wd);
      this.keysIn.connect(wd);
      wd.connect(keysOut);
      this.lfo(w.rate, w.depth, wd.delayTime);
    } else this.keysIn.connect(keysOut);
    keysOut.connect(this.mix);
    send(keysOut, revSend, rv.keys);
    send(keysOut, this.echoIn, 0.12);

    this.leadIn = g(1);
    this.leadIn.connect(this.mix);
    send(this.leadIn, revSend, rv.lead);
    send(this.leadIn, this.echoIn, 0.35);

    this.pluckIn = g(1);
    this.pluckIn.connect(this.mix);
    send(this.pluckIn, revSend, rv.pluck);
    send(this.pluckIn, this.echoIn, 0.45);

    // bass: warm saturation (so it reads on laptop speakers) then a lowpass
    this.bassIn = g(1);
    const sh = ctx.createWaveShaper();
    sh.curve = satCurve(ctx, o.bassDrive ?? 1.8);
    sh.oversample = "2x";
    const bl = ctx.createBiquadFilter();
    bl.type = "lowpass";
    bl.frequency.value = o.bassCutoff ?? 520;
    bl.Q.value = 0.6;
    this.nodes.push(sh, bl);
    this.bassIn.connect(sh);
    sh.connect(bl);
    bl.connect(this.mix);

    this.drumIn = g(1);
    this.drumIn.connect(this.mix);
    send(this.drumIn, revSend, rv.drums);

    this.fxIn = g(1);
    this.fxIn.connect(this.mix);
    send(this.fxIn, revSend, rv.fx);

    // bed noise (vinyl crackle / tape hiss), looped
    if (o.crackle) this.bed(crackleNoise(ctx), o.crackle, "highpass", 900);
    if (o.hiss) this.bed(pinkNoise(ctx), o.hiss, "bandpass", 5000);
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

  private bed(buf: AudioBuffer, level: number, type: BiquadFilterType, f: number) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = 0.5;
    const gg = ctx.createGain();
    gg.gain.value = level;
    s.connect(fl);
    fl.connect(gg);
    gg.connect(this.mix);
    s.start(ctx.currentTime + 0.02, Math.random() * buf.duration);
    this.persist.push(s);
    this.nodes.push(fl, gg);
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

  private pan(dest: AudioNode, p: number): AudioNode {
    if (!p || typeof this.ctx.createStereoPanner !== "function") return dest;
    const sp = this.ctx.createStereoPanner();
    sp.pan.value = Math.max(-1, Math.min(1, p));
    sp.connect(dest);
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
    for (const n of notes) {
      const f = mtof(n);
      const env = ctx.createGain();
      asrEnv(env.gain, t, per, attack, Math.max(0, dur - attack), release);
      const p = this.pan(this.padIn, rand(-0.45, 0.45));
      env.connect(p);
      const det = o.detune ?? 7;
      [-det, det].forEach((d, i) => {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(w);
        osc.frequency.value = f;
        osc.detune.value = d + rand(-2, 2);
        osc.connect(env);
        osc.start(t);
        osc.stop(t + dur + release + 0.1);
        if (i === 0) cleanup(osc, env, p);
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
      const tine = ctx.createOscillator();
      tine.frequency.value = f * 4;
      const tg = ctx.createGain();
      adEnv(tg.gain, tt, v * 0.18, 0.002, 0.25);
      tine.connect(tg);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(EPS, tt);
      amp.gain.exponentialRampToValueAtTime(v, tt + 0.006);
      amp.gain.exponentialRampToValueAtTime(v * 0.35, tt + 1.2);
      amp.gain.setTargetAtTime(EPS, tt + Math.max(1.2, dur), 0.18);
      car.connect(amp);
      const p = this.pan(this.keysIn, (i / Math.max(1, notes.length - 1) - 0.5) * 0.5);
      amp.connect(p);
      tg.connect(p);
      const end = tt + Math.max(1.2, dur) + 1;
      for (const s of [car, mod, tine]) {
        s.start(tt);
        s.stop(end);
      }
      cleanup(car, amp, p, mg);
      cleanup(tine, tg);
      cleanup(mod);
    });
  }

  /** FM bell / music box / celesta. ratio 3.5 = bell, 5 = music box, 2 = glass. */
  bell(n: number, t: number, vel: number, o: { ratio?: number; index?: number; decay?: number; pan?: number; detune?: number; dest?: "lead" | "pluck" | "keys" } = {}) {
    const ctx = this.ctx;
    const f = mtof(n) * Math.pow(2, (o.detune ?? 0) / 1200);
    const decay = o.decay ?? 1.6;
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
    cleanup(car, amp, p, mg);
    cleanup(mod);
  }

  /** Subtractive pluck (pizzicato / arp): a bright filter snap that closes fast. */
  pluck(n: number, t: number, vel: number, o: { decay?: number; bright?: number; pan?: number; type?: OscillatorType; q?: number } = {}) {
    const ctx = this.ctx;
    const f = mtof(n);
    const decay = o.decay ?? 0.35;
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
    cleanup(osc, lp, amp, p);
    cleanup(osc2);
  }

  /** Bass: "sub" (round), "pluck" (upright-ish), "saw" (filtered synth pulse). */
  bass(n: number, t: number, dur: number, vel: number, kind: "sub" | "pluck" | "saw" = "sub", glideFrom?: number) {
    const ctx = this.ctx;
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

  private noise(t: number, dur: number, dest: AudioNode, type: BiquadFilterType, f0: number, q: number, vol: number, attack = 0.001, f1?: number) {
    const ctx = this.ctx;
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
    amp.connect(dest);
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
    this.noise(t, open ? 0.22 : 0.035, this.drumIn, "highpass", 7500, 0.8, vel * 0.09);
  }

  shaker(t: number, vel: number) {
    this.noise(t, 0.075, this.drumIn, "bandpass", 6200, 0.9, vel * 0.07, 0.018);
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
  }

  /** A filtered-noise swell (wind, riser, breath). */
  swell(t: number, dur: number, vel: number, f0: number, f1: number, q = 1.2) {
    const ctx = this.ctx;
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
    cleanup(s, fl, amp, p);
  }

  /** A theremin-ish sine with vibrato that glides between notes (spooky-funny). */
  theremin(notes: number[], t: number, noteDur: number, vel: number) {
    const ctx = this.ctx;
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
