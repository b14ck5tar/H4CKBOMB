"use client";

// The creative director's listening room: audition every loop and sound effect. Safe to delete.
import { useEffect, useRef, useState } from "react";
import { music, playSfx, SFX_NAMES, TRACK_IDS, TRACKS, useSoundPrefs, type SfxName, type TrackId } from "@/lib/sound";
import { sfx } from "@/lib/sfx";
import { getBuses } from "@/lib/sound/context";

const LEGACY = [
  "diceRoll", "diceLand", "stamp", "fanfare", "sadTrombone", "recordScratch", "choir", "pageTurn",
  "pop", "tick", "join", "heartbeat", "whoosh", "explosion", "sparkle", "thud", "splash", "thanks",
] as const;

const SFX_LABEL: Record<SfxName, string> = {
  tap: "Tap / press", pick: "Pick", vote: "Vote", submit: "Submit / send", join: "Player joined",
  diceRoll: "Dice rolling", diceLand: "Dice land", success: "Success", partial: "Partial (yes, but)",
  fail: "Fail", nat20: "Natural 20", nat1: "Natural 1", turnStart: "Your turn", timerTick: "Timer tick",
  reveal: "Reveal", finaleShake: "Finale shake", keepsake: "Keepsake",
};

const C = {
  bg: "#0A0612",
  panel: "#160E24",
  line: "#2E2145",
  text: "#EDE6F7",
  dim: "#A99BC2",
  accent: "#B48CFF",
  on: "#3B2468",
};

const btn = (on = false): React.CSSProperties => ({
  fontFamily: "var(--font-ui, ui-monospace, monospace)",
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${on ? C.accent : C.line}`,
  background: on ? C.on : C.panel,
  color: C.text,
  cursor: "pointer",
  textAlign: "left",
});

const NARRATION =
  "The streetlights on Fifth flickered twice, and the pigeons all turned to look at the same door. Somebody inside was humming a song nobody had written yet.";

export default function SoundTest() {
  const prefs = useSoundPrefs();
  const [intensity, setIntensity] = useState(0);
  const [ducked, setDucked] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [meter, setMeter] = useState({ rms: -99, peak: -99, tickMs: 0, state: "none" });
  const [ticks, setTicks] = useState(5);
  const raf = useRef(0);

  useEffect(() => {
    (window as unknown as { __sound: unknown }).__sound = { music, playSfx, sfx, getBuses };
    const buf = new Float32Array(2048);
    let last = 0;
    const loop = (now: number) => {
      raf.current = requestAnimationFrame(loop);
      if (now - last < 120) return;
      last = now;
      const st = music.stats();
      const a = st.state === "running" ? music.analyser() : null;
      let rms = -99;
      let peak = -99;
      if (a) {
        a.getFloatTimeDomainData(buf);
        let s = 0;
        let p = 0;
        for (let i = 0; i < buf.length; i++) {
          s += buf[i] * buf[i];
          p = Math.max(p, Math.abs(buf[i]));
        }
        rms = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-9);
        peak = 20 * Math.log10(p + 1e-9);
      }
      setMeter({ rms, peak, tickMs: st.tickMs, state: st.state });
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const play = (id: TrackId) => (id === "lobby" ? music.startLobby() : music.startStory(id));

  const toggleDuck = () => {
    music.duck(!ducked, "sound-test");
    setDucked(!ducked);
  };

  const speak = () => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      return;
    }
    const u = new SpeechSynthesisUtterance(NARRATION);
    u.rate = 1.05;
    u.pitch = 0.9;
    u.onstart = () => {
      setSpeaking(true);
      music.duck(true, "speech");
    };
    const end = () => {
      setSpeaking(false);
      music.duck(false, "speech");
    };
    u.onend = end;
    u.onerror = end;
    synth.speak(u);
  };

  const countdown = () => {
    for (let i = 5; i >= 1; i--) setTimeout(() => {
      setTicks(i);
      playSfx("timerTick", { index: i, final: i === 1 });
    }, (5 - i) * 1000);
  };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "var(--font-body, system-ui, sans-serif)", padding: "24px 16px 64px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <h1 style={{ fontFamily: "var(--font-display, Impact, sans-serif)", fontSize: 40, letterSpacing: 1, margin: 0 }}>Sound test</h1>
          <p style={{ color: C.dim, margin: "6px 0 0" }}>
            Every sound is generated live in the browser (Web Audio, no files). Click anything to enable audio.
            Audio: <b style={{ color: meter.state === "running" ? "#7CF2B0" : "#FFB86B" }}>{meter.state === "running" ? "on" : "locked (click anywhere)"}</b>
          </p>
        </header>

        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Music</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 10 }}>
            {TRACK_IDS.map((id) => (
              <button key={id} style={{ ...btn(prefs.track === id), display: "grid", gap: 4 }} onClick={() => play(id)}>
                <span style={{ fontSize: 15 }}>
                  {id === "lobby" ? "Lobby" : id[0].toUpperCase() + id.slice(1)}: {TRACKS[id].title}
                </span>
                <span style={{ fontWeight: 400, color: C.dim, fontSize: 12, fontFamily: "var(--font-body, system-ui)" }}>{TRACKS[id].blurb}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button style={btn()} onClick={() => music.startStory()}>Next story track (rotation)</button>
            <button style={btn()} onClick={() => music.stop()}>Stop (fade)</button>
            <button style={btn(ducked)} onClick={toggleDuck}>{ducked ? "Ducked (-12 dB)" : "Duck"}</button>
            <button style={btn(speaking)} onClick={speak}>{speaking ? "Stop narration" : "Test narration (auto-duck)"}</button>
            <button style={btn()} onClick={() => music.swell(1, 4000)}>Swell (big roll)</button>
          </div>
          <label style={{ display: "grid", gap: 4, maxWidth: 420 }}>
            <span style={{ color: C.dim, fontSize: 13 }}>Intensity: {intensity.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.01} value={intensity} onChange={(e) => { const v = +e.target.value; setIntensity(v); music.setIntensity(v); }} />
          </label>
          <label style={{ display: "grid", gap: 4, maxWidth: 420 }}>
            <span style={{ color: C.dim, fontSize: 13 }}>Music volume: {Math.round(prefs.volume * 100)}%</span>
            <input type="range" min={0} max={1} step={0.01} value={prefs.volume} onChange={(e) => prefs.setVolume(+e.target.value)} />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button style={btn(prefs.musicMuted)} onClick={prefs.toggleMusic}>{prefs.musicMuted ? "Music muted" : "Mute music"}</button>
            <button style={btn(prefs.muted)} onClick={prefs.toggleMuted}>{prefs.muted ? "Everything muted" : "Mute everything"}</button>
          </div>
          <div style={{ fontFamily: "var(--font-ui, monospace)", fontSize: 12, color: C.dim }}>
            music out: RMS {meter.rms.toFixed(1)} dBFS · peak {meter.peak.toFixed(1)} dBFS · scheduler {meter.tickMs.toFixed(2)} ms/tick
          </div>
        </section>

        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Sound effects (house family)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {SFX_NAMES.map((n) => (
              <button key={n} style={btn()} onClick={() => playSfx(n, n === "diceRoll" ? { ms: 1400 } : n === "finaleShake" ? { ms: 1800 } : undefined)}>
                {SFX_LABEL[n]}
              </button>
            ))}
            <button style={btn()} onClick={() => { playSfx("diceRoll", { ms: 1400 }); setTimeout(() => playSfx("diceLand"), 1400); }}>Roll + land</button>
            <button style={btn()} onClick={countdown}>5 s countdown ({ticks})</button>
          </div>
        </section>

        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Current game sounds (lib/sfx.ts)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {LEGACY.map((n) => (
              <button key={n} style={btn()} onClick={() => (sfx[n] as () => void)()}>{n}</button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
