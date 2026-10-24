"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

/* ================================================================== */
/* ScreenFlash                                                         */
/*   legendary   -> electric burst: white-hot flash, rays, shockwave   */
/*                  rings and a shower of neon shards                  */
/*   catastrophe -> glitch: static, tearing bars, "SIGNAL LOST", then  */
/*                  a CRT switch-off wipe                              */
/* ================================================================== */

type Shard = { left: number; w: number; h: number; dur: number; delay: number; drift: number; spin: number; flutter: number; shape: number; hue: number };

const SHARD_SHAPES = [
  "polygon(50% 0, 100% 100%, 0 70%)",
  "polygon(0 0, 100% 20%, 60% 100%)",
  "polygon(20% 0, 100% 0, 80% 100%, 0 100%)",
  "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
];
const SHARD_COLORS = ["#3DE7FF", "#FF2E7E", "#FFB648", "#FFFFFF", "#2CF5C0", "#FF9A1F"];

function makeShards(n: number): Shard[] {
  return Array.from({ length: n }, () => ({
    left: Math.random() * 100,
    w: 6 + Math.random() * 10,
    h: 10 + Math.random() * 22,
    dur: 1.3 + Math.random() * 0.9,
    delay: Math.random() * 0.5,
    drift: Math.random() * 200 - 100,
    spin: Math.random() * 900 - 450,
    flutter: 0.25 + Math.random() * 0.35,
    shape: Math.floor(Math.random() * SHARD_SHAPES.length),
    hue: Math.floor(Math.random() * SHARD_COLORS.length),
  }));
}

type Bar = { top: number; h: number; x: number; color: string; delay: number; dur: number };
const BAR_COLORS = ["#FF2E7E", "#3DE7FF", "#FFFFFF", "#FF9A1F", "#0A0612"];

function makeBars(): Bar[] {
  return Array.from({ length: 14 }, () => ({
    top: Math.random() * 100,
    h: 0.4 + Math.random() * 4.5,
    x: Math.random() * 30 - 15,
    color: BAR_COLORS[Math.floor(Math.random() * BAR_COLORS.length)],
    delay: Math.random() * 0.5,
    dur: 0.18 + Math.random() * 0.3,
  }));
}

export function ScreenFlash({ kind, trigger }: { kind: "legendary" | "catastrophe" | null; trigger: number }) {
  const [active, setActive] = useState<{ kind: "legendary" | "catastrophe"; key: number; shards: Shard[]; bars: Bar[] } | null>(null);
  const prev = useRef(trigger);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawId = useId();
  const noiseId = "ouar-static-" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    if (trigger === prev.current) return;
    prev.current = trigger;
    if (!kind) return;
    setActive({
      kind,
      key: trigger,
      shards: kind === "legendary" ? makeShards(70) : [],
      bars: kind === "catastrophe" ? makeBars() : [],
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(null), kind === "legendary" ? 2700 : 1700);
  }, [trigger, kind]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!active) return null;

  const base: CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 70, overflow: "hidden" };

  if (active.kind === "legendary") {
    return (
      <div key={active.key} style={base} aria-hidden>
        <div className="ouar-flash-rays" />
        <div className="ouar-flash-white" />
        <div className="ouar-flash-ring" />
        <div className="ouar-flash-ring ouar-flash-ring-2" />
        {active.shards.map((l, i) => (
          <div
            key={i}
            className="ouar-leaf-fall"
            style={
              {
                left: `${l.left}%`,
                animationDuration: `${l.dur}s`,
                animationDelay: `${l.delay}s`,
                "--ouar-drift": `${l.drift}px`,
                "--ouar-spin": `${l.spin}deg`,
              } as CSSProperties
            }
          >
            <div
              className="ouar-leaf-flutter"
              style={{
                width: l.w,
                height: l.h,
                clipPath: SHARD_SHAPES[l.shape],
                background: SHARD_COLORS[l.hue],
                animationDuration: `${l.flutter}s`,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div key={active.key} style={base} aria-hidden>
      <div className="ouar-glitch-wipe" style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(10, 6, 18, 0.72)" }} />
        <svg className="ouar-static" width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: "-60px", width: "calc(100% + 120px)", height: "calc(100% + 120px)" }}>
          <defs>
            <filter id={noiseId} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={active.key % 50} />
              <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -0.55" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
        </svg>
        {active.bars.map((b, i) => (
          <div
            key={i}
            className="ouar-glitch-bar"
            style={
              {
                top: `${b.top}%`,
                height: `${b.h}%`,
                background: b.color,
                animationDelay: `${b.delay}s`,
                animationDuration: `${b.dur}s`,
                "--ouar-bar-x": `${b.x}%`,
              } as CSSProperties
            }
          />
        ))}
        <div className="ouar-signal-lost">
          <span>Signal lost</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* TypeReveal                                                          */
/*   phrase-by-phrase reveal; the first word is a caption-box          */
/*   highlight and a cursor blinks once the line is fully transmitted  */
/* ================================================================== */

const BREAKS = ",.;!?—";
const TRAIL = ",.;!?—…\"'”’)]";

function splitPhrases(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\n") {
      if (cur) out.push(cur);
      out.push("\n");
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
    if (BREAKS.includes(ch)) {
      while (i < s.length && TRAIL.includes(s[i])) cur += s[i++];
      while (i < s.length && s[i] === " ") cur += s[i++];
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function TypeReveal({ text, phraseMs = 380, className }: { text: string; phraseMs?: number; className?: string }) {
  const { lead, gap, phrases } = useMemo(() => {
    const t = text ?? "";
    // first word (must contain a letter or digit), keeping any punctuation glued to it
    const m = /^\s*([^\s]*[A-Za-z0-9À-ɏ][^\s]*)([ \t]*)/.exec(t);
    if (!m) return { lead: "", gap: "", phrases: splitPhrases(t) };
    return { lead: m[1], gap: m[2], phrases: splitPhrases(t.slice(m[0].length)) };
  }, [text]);

  const visible = phrases.filter((p) => p !== "\n").length;
  const done = 0.18 + (phrases.length * phraseMs) / 1000 + 0.3;

  return (
    <div className={className} key={text}>
      {lead && (
        <>
          <span className="ouar-lead">{lead}</span>
          {gap ? " " : ""}
        </>
      )}
      {phrases.map((p, i) =>
        p === "\n" ? (
          <br key={i} />
        ) : (
          <span key={i} className="ouar-phrase" style={{ animationDelay: `${0.18 + (i * phraseMs) / 1000}s` }}>
            {p}
          </span>
        ),
      )}
      {(lead || visible > 0) && <span className="ouar-cursor" aria-hidden style={{ animationDelay: `${done}s, ${done}s` }} />}
    </div>
  );
}

/* ================================================================== */
/* Hourglass -> signal scan (radar sweep with blips). Same props.      */
/* ================================================================== */

export function Hourglass({ size = 64 }: { size?: number }) {
  const uid = "ouar-hg-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const loop = { dur: "2.4s", repeatCount: "indefinite" as const };
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Waiting" style={{ display: "inline-block", overflow: "visible" }}>
      <defs>
        <linearGradient id={uid + "-sweep"} gradientUnits="userSpaceOnUse" x1="32" y1="3" x2="57.1" y2="17.5">
          <stop offset="0" stopColor="#3DE7FF" stopOpacity="0" />
          <stop offset="1" stopColor="#3DE7FF" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id={uid + "-bg"} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#14213A" />
          <stop offset="1" stopColor="#07040C" />
        </radialGradient>
        <clipPath id={uid + "-clip"}>
          <circle cx="32" cy="32" r="29" />
        </clipPath>
      </defs>
      {/* scope */}
      <circle cx="32" cy="32" r="29" fill={`url(#${uid}-bg)`} />
      <g fill="none" stroke="#3DE7FF">
        <circle cx="32" cy="32" r="29" strokeWidth="1.6" strokeOpacity="0.9" />
        <circle cx="32" cy="32" r="19.5" strokeWidth="0.8" strokeOpacity="0.35" />
        <circle cx="32" cy="32" r="10" strokeWidth="0.8" strokeOpacity="0.35" />
        <path d="M32 3 V61 M3 32 H61" strokeWidth="0.6" strokeOpacity="0.3" />
        <circle cx="32" cy="32" r="31.5" strokeWidth="1.4" strokeOpacity="0.6" strokeDasharray="0.8 3.1" />
      </g>
      {/* sweep */}
      <g clipPath={`url(#${uid}-clip)`}>
        <g>
          <animateTransform attributeName="transform" type="rotate" values="0 32 32;360 32 32" {...loop} />
          <path d="M32 32 L32 3 A29 29 0 0 1 57.1 17.5 Z" fill={`url(#${uid}-sweep)`} />
          <line x1="32" y1="32" x2="57.1" y2="17.5" stroke="#3DE7FF" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </g>
      {/* blips light up as the sweep passes */}
      <circle cx="43.3" cy="20.7" r="2.6" fill="#FF2E7E">
        <animate attributeName="opacity" values="0.6;0;0;1" keyTimes="0;0.5;0.955;1" {...loop} />
      </circle>
      <circle cx="25.2" cy="50.6" r="2.1" fill="#FFB648">
        <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.38;0.4;1" {...loop} />
      </circle>
      <circle cx="32" cy="32" r="1.8" fill="#FFFFFF" />
    </svg>
  );
}
