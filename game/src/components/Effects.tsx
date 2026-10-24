"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

/* ================================================================== */
/* ScreenFlash                                                         */
/* ================================================================== */

type Leaf = { left: number; w: number; h: number; dur: number; delay: number; drift: number; spin: number; flutter: number; shape: number; hue: number };

const LEAF_SHAPES = [
  "polygon(8% 0, 100% 12%, 88% 100%, 0 84%)",
  "polygon(0 18%, 70% 0, 100% 66%, 26% 100%)",
  "polygon(14% 8%, 92% 0, 100% 90%, 6% 100%)",
  "polygon(0 0, 100% 30%, 80% 100%, 10% 70%)",
];
const LEAF_GRADS = [
  "linear-gradient(135deg, #FFF0B8 0%, #E3B652 35%, #C8952E 60%, #8A6118 100%)",
  "linear-gradient(160deg, #FBE7A6 0%, #C8952E 50%, #A67A22 100%)",
  "linear-gradient(120deg, #F6D57A 0%, #FFF6D6 40%, #C8952E 75%, #7A5418 100%)",
];

function makeLeaves(n: number): Leaf[] {
  return Array.from({ length: n }, () => ({
    left: Math.random() * 100,
    w: 8 + Math.random() * 12,
    h: 10 + Math.random() * 14,
    dur: 1.5 + Math.random() * 0.9,
    delay: Math.random() * 0.55,
    drift: Math.random() * 160 - 80,
    spin: Math.random() * 720 - 360,
    flutter: 0.35 + Math.random() * 0.4,
    shape: Math.floor(Math.random() * LEAF_SHAPES.length),
    hue: Math.floor(Math.random() * LEAF_GRADS.length),
  }));
}

type Splat = { cx: number; cy: number; r: number };

function makeSplats(): Splat[] {
  const s: Splat[] = [{ cx: 50, cy: 50, r: 17 }];
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 12 + Math.random() * 12;
    s.push({ cx: 50 + Math.cos(a) * d, cy: 50 + Math.sin(a) * d, r: 4 + Math.random() * 6 });
  }
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 22 + Math.random() * 14;
    s.push({ cx: 50 + Math.cos(a) * d, cy: 50 + Math.sin(a) * d, r: 0.8 + Math.random() * 2.2 });
  }
  return s;
}

export function ScreenFlash({ kind, trigger }: { kind: "legendary" | "catastrophe" | null; trigger: number }) {
  const [active, setActive] = useState<{ kind: "legendary" | "catastrophe"; key: number; leaves: Leaf[]; splats: Splat[] } | null>(null);
  const prev = useRef(trigger);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawId = useId();
  const gooId = "ouar-goo-" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    if (trigger === prev.current) return;
    prev.current = trigger;
    if (!kind) return;
    setActive({
      kind,
      key: trigger,
      leaves: kind === "legendary" ? makeLeaves(72) : [],
      splats: kind === "catastrophe" ? makeSplats() : [],
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
        {active.leaves.map((l, i) => (
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
                clipPath: LEAF_SHAPES[l.shape],
                background: LEAF_GRADS[l.hue],
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
      <div className="ouar-blot-wipe" style={{ position: "absolute", inset: 0 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
          <defs>
            <filter id={gooId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b" />
              <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
            </filter>
          </defs>
          <g className="ouar-blot-spread" filter={`url(#${gooId})`} fill="#2A1E16">
            {active.splats.map((s, i) => (
              <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

/* ================================================================== */
/* TypeReveal                                                          */
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
  const { cap, phrases } = useMemo(() => {
    const t = text ?? "";
    const m = /[A-Za-z0-9À-ɏ]/.exec(t);
    if (!m) return { cap: "", phrases: splitPhrases(t) };
    const idx = m.index;
    return { cap: t.slice(0, idx + 1).trimStart(), phrases: splitPhrases(t.slice(idx + 1)) };
  }, [text]);

  return (
    <div className={className} key={text}>
      {cap && <span className="ouar-dropcap">{cap}</span>}
      {phrases.map((p, i) =>
        p === "\n" ? (
          <br key={i} />
        ) : (
          <span key={i} className="ouar-phrase" style={{ animationDelay: `${0.18 + (i * phraseMs) / 1000}s` }}>
            {p}
          </span>
        ),
      )}
    </div>
  );
}

/* ================================================================== */
/* Hourglass                                                           */
/* ================================================================== */

const GLASS =
  "M20 9 C20 22 29 27 30.5 32 C29 37 20 42 20 55 L44 55 C44 42 35 37 33.5 32 C35 27 44 22 44 9 Z";

export function Hourglass({ size = 64 }: { size?: number }) {
  const uid = "ouar-hg-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const flow = { dur: "2s", repeatCount: "indefinite" as const };
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Waiting" style={{ display: "inline-block", overflow: "visible" }}>
      <defs>
        <clipPath id={uid + "-clip"}>
          <path d={GLASS} />
        </clipPath>
        <linearGradient id={uid + "-gilt"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6D57A" />
          <stop offset="0.5" stopColor="#C8952E" />
          <stop offset="1" stopColor="#8A6118" />
        </linearGradient>
        <linearGradient id={uid + "-post"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8A6118" />
          <stop offset="0.45" stopColor="#F6D57A" />
          <stop offset="1" stopColor="#7A5418" />
        </linearGradient>
      </defs>
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 32 32;0 32 32;180 32 32"
          keyTimes="0;0.8;1"
          calcMode="spline"
          keySplines="0 0 1 1;0.6 0 0.3 1"
          {...flow}
        />
        {/* glass */}
        <path d={GLASS} fill="#F4E9D0" fillOpacity="0.35" />
        <g clipPath={`url(#${uid}-clip)`} fill="#D9A441">
          <rect x="14" y="14" width="36" height="18">
            <animate attributeName="y" values="14;32;32" keyTimes="0;0.8;1" {...flow} />
            <animate attributeName="height" values="18;0;0" keyTimes="0;0.8;1" {...flow} />
          </rect>
          <rect x="14" y="55" width="36" height="0">
            <animate attributeName="y" values="55;39;39" keyTimes="0;0.8;1" {...flow} />
            <animate attributeName="height" values="0;16;16" keyTimes="0;0.8;1" {...flow} />
          </rect>
          <line x1="32" y1="31" x2="32" y2="55" stroke="#D9A441" strokeWidth="1.3" strokeDasharray="2 1.6">
            <animate attributeName="stroke-dashoffset" values="0;-7.2" dur="0.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.76;0.8;1" {...flow} />
          </line>
        </g>
        <path d={GLASS} fill="none" stroke="#2A1E16" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M23 12 C23 20 27 25 29.5 29" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
        {/* frame */}
        <rect x="12.5" y="8" width="3" height="48" rx="1" fill={`url(#${uid}-post)`} stroke="#2A1E16" strokeWidth="0.8" />
        <rect x="48.5" y="8" width="3" height="48" rx="1" fill={`url(#${uid}-post)`} stroke="#2A1E16" strokeWidth="0.8" />
        <rect x="9" y="3" width="46" height="6" rx="2" fill={`url(#${uid}-gilt)`} stroke="#2A1E16" strokeWidth="1" />
        <rect x="9" y="55" width="46" height="6" rx="2" fill={`url(#${uid}-gilt)`} stroke="#2A1E16" strokeWidth="1" />
        <circle cx="32" cy="6" r="1.1" fill="#2A1E16" opacity="0.6" />
        <circle cx="32" cy="58" r="1.1" fill="#2A1E16" opacity="0.6" />
      </g>
    </svg>
  );
}
