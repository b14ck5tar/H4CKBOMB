"use client";
/**
 * Phone kit: the shared pieces every phone screen is built from (frame, fuse timer, the one big instruction,
 * goal card, chunky buttons, plan box, reactions, d20/d6 glyphs). Pure props, no GameHost or transport import,
 * so every screen previews at /phone-preview. Styles: app/phone-theme.css (imported here, pk-* classes).
 */
import { heroPortrait } from "@/lib/heroArt";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "@/lib/types";
import "@/app/phone-theme.css";

export type Send = (t: string, d?: Record<string, unknown>) => void;
export type TimerSpec = { deadlineAt: number; total: number };

export function vibrate(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {}
}

/** The picture for a player's hero: the ready-made card art, else the painted portrait (if any). */
export function heroImg(p?: Player | null, portrait?: string) {
  if (!p) return undefined;
  return p.pick ? heroPortrait(p.pick) : portrait || undefined;
}

/** ms left until deadlineAt, re-rendering every 250 ms while it runs. */
export function useLeft(deadlineAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineAt) return;
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [deadlineAt]);
  return deadlineAt ? Math.max(0, deadlineAt - now) : 0;
}

// ---------- glyphs ----------
const H = [[100, 8], [179.7, 54], [179.7, 146], [100, 192], [20.3, 146], [20.3, 54]] as const;
const T = [[100, 42], [151, 130], [49, 130]] as const;
const pt = (p: readonly number[]) => p.join(",");
const SPOKES: [readonly number[], readonly number[]][] = [
  [H[0], T[0]], [H[1], T[0]], [H[1], T[1]], [H[2], T[1]], [H[3], T[1]], [H[3], T[2]], [H[4], T[2]], [H[5], T[2]], [H[5], T[0]],
];

export function D20Glyph({ className = "", label = "20", style }: { className?: string; label?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 200" className={`pk-glyph ${className}`} style={style} aria-hidden>
      <polygon points={H.map(pt).join(" ")} className="pk-glyph-body" />
      <polygon points={T.map(pt).join(" ")} className="pk-glyph-face" />
      {SPOKES.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      ))}
      {label && (
        <text x="100" y="104" textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      )}
    </svg>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};
/** A d6 face (1-6): the "step" numbers and little list markers. */
export function Pips({ n, color, className = "" }: { n: number; color?: string; className?: string }) {
  const k = Math.max(1, Math.min(6, Math.round(n)));
  return (
    <svg viewBox="0 0 100 100" className={`pk-pips ${className}`} style={color ? ({ ["--pc" as string]: color } as React.CSSProperties) : undefined} aria-hidden>
      <rect x="6" y="6" width="88" height="88" rx="20" />
      {PIPS[k].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="10" />
      ))}
    </svg>
  );
}

export function TvGlyph() {
  return (
    <div className="pk-tv" aria-hidden>
      <div className="pk-tv-glow" />
      <svg viewBox="0 0 200 170">
        <defs>
          <linearGradient id="pk-tv-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3de7ff" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#b46bff" stopOpacity="0.25" />
            <stop offset="1" stopColor="#ff2e7e" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path className="pk-tv-ant" d="M74 8 L100 38 L132 4" />
        <rect className="pk-tv-body" x="10" y="38" width="180" height="116" rx="22" />
        <rect className="pk-tv-screen" x="28" y="52" width="144" height="86" rx="14" />
        <g transform="translate(100 95) scale(0.27) translate(-100 -100)">
          <D20Inline />
        </g>
        <path className="pk-tv-ant" d="M52 156 L44 166 M148 156 L156 166" />
      </svg>
      <div className="pk-tv-scan" />
    </div>
  );
}
function D20Inline() {
  return (
    <g fill="none" stroke="#fff" strokeWidth="8" strokeLinejoin="round">
      <polygon points={H.map(pt).join(" ")} />
      <polygon points={T.map(pt).join(" ")} />
      {SPOKES.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      ))}
    </g>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** "Your words go to Meta's Muse AI…": kept on every screen where people type something personal. */
export function PrivacyLine({ children }: { children?: React.ReactNode }) {
  return (
    <p className="pk-privacy">
      <LockIcon />
      <span>{children ?? "Your words go to Meta’s Muse AI to run tonight’s game. Nothing is saved after."}</span>
    </p>
  );
}

// ---------- frame ----------
/** A hexagon portrait in the player's color (or a silhouette while the hero is still being painted). */
export function Face({ player, src, large = false }: { player?: Player | null; src?: string; large?: boolean }) {
  const style = { ["--c" as string]: player?.color ?? "#ff2e7e" } as React.CSSProperties;
  return (
    <span className={`pk-face ${large ? "pk-face-lg" : ""}`} style={style} aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span />
      )}
    </span>
  );
}

/**
 * The whole phone: the scene's art blurred behind club light, your hero chip on top, one screen below.
 * `screenKey` re-runs the screen's entrance (pass the phase); `art` = the plate the TV is showing.
 */
export function PhoneFrame({
  children,
  me,
  portrait,
  art,
  code,
  screenKey,
  onPointerDown,
}: {
  children: React.ReactNode;
  me?: Player | null;
  portrait?: string;
  art?: string;
  code?: string;
  screenKey?: string | number;
  onPointerDown?: () => void;
}) {
  const img = heroImg(me, portrait);
  return (
    <div className="pk" onPointerDown={onPointerDown}>
      <div className="pk-bg" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {art && <img key={art} src={art} alt="" className="pk-art" />}
        <div className="pk-tint" />
        <div className="pk-blob pk-blob-a" />
        <div className="pk-blob pk-blob-b" />
        <div className="pk-beam" />
        <div className="pk-halftone" />
        <div className="pk-grain" />
        <div className="pk-vignette" />
      </div>
      <main className="pk-main">
        {(me?.hero || code) && (
          <header className="pk-hud">
            {me?.hero && (
              <>
                <Face player={me} src={img} />
                <span className="pk-me" style={{ ["--c" as string]: me.color } as React.CSSProperties}>
                  <span className="pk-me-name">{me.hero.name}</span>
                  <span className="pk-me-epi">{me.hero.epithet}</span>
                </span>
              </>
            )}
            <span className="pk-hud-r">
              {code && <span className="pk-room">{code}</span>}
              <D20Glyph className="pk-hud-d20" label="" />
            </span>
          </header>
        )}
        <div key={screenKey} className="pk-screen">
          {children}
        </div>
      </main>
    </div>
  );
}

// ---------- the fuse (timer) ----------
/**
 * A burning fuse: the bar drains on the compositor (one CSS animation per deadline, no per-frame React work), a
 * spark rides its end, and the last 8 seconds turn red with a buzz.
 */
export function Fuse({ deadlineAt, total }: TimerSpec) {
  const left = useLeft(deadlineAt);
  const buzzed = useRef(false);
  const low = left > 0 && left < 8000;
  useEffect(() => {
    buzzed.current = false;
  }, [deadlineAt]);
  useEffect(() => {
    if (low && !buzzed.current) {
      buzzed.current = true;
      vibrate(30);
    }
  }, [low]);
  // The drain animation is set up once per deadline, from the time left at that moment.
  const base = useMemo(() => (deadlineAt ? Math.max(0, deadlineAt - Date.now()) : 0), [deadlineAt]);
  if (!deadlineAt || !left) return <div style={{ height: 34 }} aria-hidden />;
  const f = Math.max(0, Math.min(1, base / Math.max(1, total)));
  const style = { ["--f" as string]: f, ["--ms" as string]: `${base}ms` } as React.CSSProperties;
  return (
    <div className={`pk-fuse ${low ? "is-low" : ""}`} role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <div className="pk-fuse-track" key={deadlineAt} style={style}>
        <div className="pk-fuse-fill" />
        <div className="pk-fuse-run">
          <span className="pk-spark" />
        </div>
      </div>
      <span className="pk-secs">{Math.ceil(left / 1000)}s</span>
    </div>
  );
}

// ---------- the one instruction ----------
/** A small skewed label above the headline ("YOUR TURN", "STEP 2"). */
export function Kicker({ children, tone }: { children: React.ReactNode; tone?: "lime" | "pink" | "cyan" | "amber" }) {
  return (
    <span className="pk-kick" data-tone={tone}>
      {children}
    </span>
  );
}

/**
 * The ONE big instruction, words springing in one by one. Wrap words in *stars* to light them lime:
 * "Suggest a move for *Gus*".
 */
export function Say({ text, small = false }: { text: string; small?: boolean }) {
  let hot = false;
  const words = text.split(/\s+/).filter(Boolean).map((raw) => {
    let w = raw;
    const open = w.startsWith("*");
    if (open) {
      hot = true;
      w = w.slice(1);
    }
    const close = w.endsWith("*") || w.replace(/[!?.,…]+$/, "").endsWith("*");
    w = w.replace(/\*/g, "");
    const out = { w, hot };
    if (close) hot = false;
    return out;
  });
  return (
    <h1 key={text} className={`pk-say ${small ? "pk-say-sm" : ""}`} aria-label={text.replace(/\*/g, "")}>
      {words.map((x, i) => (
        <span key={i} aria-hidden>
          <span className={`w ${x.hot ? "hot" : ""}`} style={{ ["--i" as string]: i } as React.CSSProperties}>
            {x.w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </h1>
  );
}

/** "Right now" (the step the table is on) with the story ladder as lit diamonds; the big goal underneath. */
export function Goal({ goal, nowGoal, ladder, step }: { goal?: string; nowGoal?: string; ladder?: string[]; step?: number }) {
  if (!goal && !nowGoal) return null;
  const now = nowGoal && nowGoal !== goal ? nowGoal : "";
  const steps = ladder?.length ?? 0;
  return (
    <div className="pk-goal">
      <span className="pk-goal-top">
        {now ? "Right now" : "The goal"}
        {steps > 1 && (
          <span className="pk-ladder" aria-label={`Step ${(step ?? 0) + 1} of ${steps}`}>
            {Array.from({ length: steps }, (_, i) => (
              <i key={i} className={i < (step ?? 0) ? "on" : i === (step ?? 0) ? "cur" : ""} />
            ))}
          </span>
        )}
      </span>
      <span className="pk-goal-txt">{now || goal}</span>
      {now && goal && (
        <span className="pk-goal-big">
          <b>BIG GOAL</b>
          {goal}
        </span>
      )}
    </div>
  );
}

// ---------- buttons ----------
type Tone = "pink" | "lime" | "cyan" | "amber" | "violet";

/** A chunky arcade button: squashes on press, springs back, throws a ring, and buzzes. */
export function GameButton({
  children,
  sub,
  tone = "pink",
  xl = false,
  type = "button",
  disabled,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  xl?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const [rings, setRings] = useState<number[]>([]);
  return (
    <button
      type={type}
      className={`pk-btn ${xl ? "pk-btn-xl" : ""} ${className}`}
      data-tone={tone === "pink" ? undefined : tone}
      disabled={disabled}
      onPointerDown={() => {
        if (disabled) return;
        vibrate(12);
        const id = Date.now();
        setRings((r) => [...r.slice(-2), id]);
        setTimeout(() => setRings((r) => r.filter((x) => x !== id)), 600);
      }}
      onClick={onClick}
    >
      {rings.map((id) => (
        <span key={id} className="pk-ring" aria-hidden />
      ))}
      <span className="pk-btn-in">
        <span>{children}</span>
        {sub && <small>{sub}</small>}
      </span>
    </button>
  );
}

export function LinkButton({ children, onClick, type = "button" }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button type={type} className="pk-link" onClick={onClick}>
      {children}
    </button>
  );
}

// ---------- typing ----------
/**
 * The plan box: one action, PLAN_MAX characters, a filling meter. `onTyping` fires at most every 1.5 s
 * (the TV shows "… is typing").
 */
export function PlanBox({
  value,
  onChange,
  placeholder,
  max,
  onTyping,
  label,
  hint = "One action. The DM takes it literally.",
  autoFocus,
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  max: number;
  onTyping?: () => void;
  label?: React.ReactNode;
  hint?: string;
  autoFocus?: boolean;
}) {
  const last = useRef(0);
  const f = Math.min(1, value.length / max);
  return (
    <label className="pk-field">
      {label && <span className="pk-label">{label}</span>}
      <textarea
        className="pk-input"
        value={value}
        maxLength={max}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value.slice(0, max));
          if (onTyping && Date.now() - last.current > 1500) {
            last.current = Date.now();
            onTyping();
          }
        }}
      />
      <span className="pk-meta">
        <span>{hint}</span>
        <span className={`pk-count ${f >= 1 ? "is-full" : ""}`} aria-hidden>
          <i style={{ transform: `scaleX(${f})` }} />
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {value.length}/{max}
        </span>
      </span>
    </label>
  );
}

// ---------- reactions ----------
/** Six chunky emoji tokens; each tap squashes the token and floats the emoji up (throttled like the old bar). */
export function ReactionBar({ reactions, onReact }: { reactions: readonly string[]; onReact: (emoji: string) => void }) {
  const last = useRef(0);
  const [flies, setFlies] = useState<{ id: number; e: string; i: number; dx: number; rot: number }[]>([]);
  return (
    <div className="pk-bottom">
      <span className="pk-reacts-cap">Tap to react on the TV</span>
      <div className="pk-reacts">
        {reactions.map((e, i) => (
          <button
            key={e}
            className="pk-tok"
            aria-label={`React ${e}`}
            onClick={() => {
              const id = Date.now() + i;
              setFlies((f) => [...f.slice(-5), { id, e, i, dx: Math.round((Math.random() - 0.5) * 80), rot: Math.round((Math.random() - 0.5) * 50) }]);
              setTimeout(() => setFlies((f) => f.filter((x) => x.id !== id)), 1150);
              vibrate(10);
              if (Date.now() - last.current < 450) return;
              last.current = Date.now();
              onReact(e);
            }}
          >
            {e}
            {flies
              .filter((f) => f.i === i)
              .map((f) => (
                <span key={f.id} className="pk-fly" style={{ ["--dx" as string]: `${f.dx}px`, ["--rot" as string]: `${f.rot}deg` } as React.CSSProperties} aria-hidden>
                  {f.e}
                </span>
              ))}
          </button>
        ))}
      </div>
    </div>
  );
}
