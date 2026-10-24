"use client";

// TEMPORARY demo page for the juice components. Safe to delete.
import "../juice.css";
import { useState } from "react";
import { sfx } from "@/lib/sfx";
import { D20 } from "@/components/D20";
import { Stamp, WaxSeal } from "@/components/Stamp";
import { Reactions } from "@/components/Reactions";
import { ScreenFlash, TypeReveal, Hourglass } from "@/components/Effects";

const TEXTS = [
  "Once upon a roll, in a kingdom of wet cobblestones, the goose-mayor declared war on bread; the bakers, naturally, wept.\nAnd then — a knock at the door!",
  "Brave Pip lunges for the chandelier, misses entirely, and lands in the soup. The duke applauds. Nobody else does.",
];

const SOUNDS = [
  "diceRoll", "diceLand", "stamp", "fanfare", "sadTrombone", "recordScratch", "choir", "pageTurn",
  "pop", "tick", "join", "heartbeat", "whoosh", "explosion", "sparkle", "thud", "splash",
] as const;

const btn: React.CSSProperties = {
  fontFamily: "var(--font-ui, 'Alegreya Sans', sans-serif)",
  fontWeight: 700,
  padding: "6px 12px",
  borderRadius: 8,
  border: "2px solid #2A1E16",
  background: "#E6D3A8",
  color: "#2A1E16",
  cursor: "pointer",
};

const card: React.CSSProperties = {
  background: "#F4E9D0",
  color: "#2A1E16",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

export default function JuiceDemo() {
  const [rolling, setRolling] = useState(false);
  const [value, setValue] = useState<number | null>(null);
  const [stampKey, setStampKey] = useState(0);
  const [reacts, setReacts] = useState<{ id: number; emoji: string; color?: string }[]>([]);
  const [flash, setFlash] = useState<{ kind: "legendary" | "catastrophe" | null; n: number }>({ kind: null, n: 0 });
  const [textIdx, setTextIdx] = useState(0);
  const [muted, setMutedS] = useState(false);

  function roll(forced?: number) {
    sfx.unlock();
    setRolling(true);
    sfx.diceRoll(1400);
    setTimeout(() => {
      const v = forced ?? 1 + Math.floor(Math.random() * 20);
      setValue(v);
      setRolling(false);
      sfx.diceLand();
      if (v === 20) {
        setFlash((f) => ({ kind: "legendary", n: f.n + 1 }));
        sfx.choir();
        setTimeout(() => setStampKey((k) => k + 1), 350);
      } else if (v === 1) {
        sfx.recordScratch();
        setFlash((f) => ({ kind: "catastrophe", n: f.n + 1 }));
      }
    }, 1400);
  }

  function react(burst = 1) {
    const emojis = ["😂", "🔥", "😱", "🛡️", "🐉"];
    const colors = ["#C8952E", "#A3282E", "#2E5E4E", undefined];
    setReacts((r) => {
      const add = Array.from({ length: burst }, (_, i) => ({
        id: Date.now() * 100 + i + Math.floor(Math.random() * 99),
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      return [...r, ...add].slice(-60);
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #232a4d 0%, #161B33 70%)", padding: 24 }}>
      {/* demo-only font load; the lead loads these app-wide */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@500;700&family=Cinzel+Decorative:wght@700&family=Cinzel:wght@600;700;900&family=EB+Garamond:wght@500&display=swap"
        precedence="default"
      />
      <style>{`:root{--font-display:'Cinzel Decorative',serif;--font-heading:'Cinzel',serif;--font-body:'EB Garamond',serif;--font-ui:'Alegreya Sans',sans-serif}`}</style>
      <Reactions items={reacts} />
      <ScreenFlash kind={flash.kind} trigger={flash.n} />

      <h1 style={{ fontFamily: "var(--font-display)", color: "#C8952E", fontSize: 40, margin: "0 0 16px" }}>Juice Demo</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        <section style={card}>
          <h2 style={{ fontFamily: "var(--font-heading)", margin: 0 }}>D20</h2>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-end", flexWrap: "wrap" }}>
            <D20 value={value} rolling={rolling} size={260} label="Sir Reginald" />
            <D20 value={value} rolling={rolling} size={96} tone="crimson" label="Pip" />
            <D20 value={value} rolling={rolling} size={96} tone="ink" />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btn} onClick={() => roll()}>Roll</button>
            <button style={btn} onClick={() => roll(20)}>Roll nat 20</button>
            <button style={btn} onClick={() => roll(1)}>Roll nat 1</button>
            <button style={btn} onClick={() => setValue(null)}>Reset (?)</button>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ fontFamily: "var(--font-heading)", margin: 0 }}>Stamps &amp; Seals</h2>
          <div key={stampKey} style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
            <Stamp text="Legendary" size="xl" />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <Stamp text="Risky" sub="DC 15" tone="gilt" rotate={4} size="lg" />
              <Stamp text="Possible" tone="forest" size="md" rotate={-3} />
              <Stamp text="Impossible… unless" tone="ink" size="sm" rotate={2} />
            </div>
            <Stamp text="Catastrophe" size="lg" rotate={-11} />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <WaxSeal initials="SR" color="#A3282E" />
            <WaxSeal initials="P" color="#2E5E4E" size={72} pulse />
            <WaxSeal initials="Mo" color="#C8952E" size={48} />
            <WaxSeal initials="ABC" color="#3B3F8C" size={96} />
          </div>
          <button style={btn} onClick={() => { sfx.unlock(); sfx.stamp(); setStampKey((k) => k + 1); }}>Re-slam</button>
        </section>

        <section style={card}>
          <h2 style={{ fontFamily: "var(--font-heading)", margin: 0 }}>Narration</h2>
          <TypeReveal
            text={TEXTS[textIdx]}
            className="demo-narr"
          />
          <style>{`.demo-narr{font-family:var(--font-body);font-size:28px;line-height:1.35;min-height:190px}`}</style>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={btn} onClick={() => { sfx.unlock(); sfx.pageTurn(); setTextIdx((i) => (i + 1) % TEXTS.length); }}>Next text</button>
            <Hourglass />
            <Hourglass size={32} />
          </div>
        </section>

        <section style={card}>
          <h2 style={{ fontFamily: "var(--font-heading)", margin: 0 }}>Effects &amp; Reactions</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btn} onClick={() => setFlash((f) => ({ kind: "legendary", n: f.n + 1 }))}>Legendary flash</button>
            <button style={btn} onClick={() => setFlash((f) => ({ kind: "catastrophe", n: f.n + 1 }))}>Catastrophe blot</button>
            <button style={btn} onClick={() => react(1)}>React</button>
            <button style={btn} onClick={() => react(12)}>React x12</button>
          </div>
          <h3 style={{ fontFamily: "var(--font-heading)", margin: 0 }}>Sounds</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SOUNDS.map((s) => (
              <button key={s} style={btn} onClick={() => { sfx.unlock(); sfx.play(s); }}>{s}</button>
            ))}
            <button style={btn} onClick={() => { sfx.unlock(); sfx.play("sad_trombone"); }}>play(&quot;sad_trombone&quot;)</button>
            <button style={{ ...btn, background: muted ? "#A3282E" : "#2E5E4E", color: "#F4E9D0" }} onClick={() => { sfx.setMuted(!sfx.muted()); setMutedS(sfx.muted()); }}>
              {muted ? "Muted" : "Sound on"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
