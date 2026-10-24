"use client";

import { useId, useMemo, type CSSProperties } from "react";

const STAMP_TONES = {
  crimson: "#A3282E",
  gilt: "#B98523",
  forest: "#2E5E4E",
  ink: "#2A1E16",
} as const;

const SIZES = {
  sm: { font: 14, sub: 9, padX: 10, padY: 4, border: 2, gap: 2, inset: 3 },
  md: { font: 22, sub: 11, padX: 16, padY: 6, border: 3, gap: 3, inset: 4 },
  lg: { font: 38, sub: 15, padX: 26, padY: 10, border: 4, gap: 4, inset: 6 },
  xl: { font: 64, sub: 22, padX: 40, padY: 14, border: 6, gap: 6, inset: 9 },
} as const;

function cleanId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function Stamp({
  text,
  sub,
  tone = "crimson",
  rotate = -6,
  size = "lg",
  slam = true,
}: {
  text: string;
  sub?: string;
  tone?: "crimson" | "gilt" | "forest" | "ink";
  rotate?: number;
  size?: "sm" | "md" | "lg" | "xl";
  slam?: boolean;
}) {
  const fid = "ouar-distress-" + cleanId(useId());
  const color = STAMP_TONES[tone] ?? STAMP_TONES.crimson;
  const s = SIZES[size] ?? SIZES.lg;
  const seed = hash(text + (sub ?? "")) % 97;

  const style = {
    "--ouar-rot": `${rotate}deg`,
    transform: `rotate(${rotate}deg)`,
    display: "inline-block",
    position: "relative",
    color,
    padding: s.inset,
    border: `${s.border}px solid ${color}`,
    borderRadius: Math.max(4, s.font * 0.18),
    filter: `url(#${fid})`,
    opacity: 0.93,
    lineHeight: 1,
    whiteSpace: "nowrap",
    userSelect: "none",
  } as CSSProperties;

  return (
    <span className={slam ? "ouar-stamp ouar-stamp-slam" : "ouar-stamp"} style={style} role="img" aria-label={sub ? `${text}, ${sub}` : text}>
      <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }} aria-hidden focusable="false">
        <filter id={fid} x="-10%" y="-20%" width="120%" height="140%">
          {/* rough, inky edges */}
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed={seed} result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale={Math.max(2, s.border * 0.9)} xChannelSelector="R" yChannelSelector="G" result="rough" />
          {/* worn speckles where ink didn't take */}
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed={seed + 3} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -12 8.6" result="holes" />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
      </svg>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: s.gap,
          padding: `${s.padY}px ${s.padX}px`,
          border: `${Math.max(1, s.border * 0.5)}px solid ${color}`,
          borderRadius: Math.max(2, s.font * 0.12),
          background: `color-mix(in srgb, ${color} 7%, transparent)`,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heading, 'Cinzel', 'Trajan Pro', Georgia, serif)",
            fontWeight: 900,
            fontSize: s.font,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            paddingLeft: "0.09em",
          }}
        >
          {text}
        </span>
        {sub && (
          <span
            style={{
              fontFamily: "var(--font-ui, 'Alegreya Sans', system-ui, sans-serif)",
              fontWeight: 700,
              fontSize: s.sub,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              borderTop: `${Math.max(1, s.border * 0.4)}px solid ${color}`,
              paddingTop: s.gap,
              paddingLeft: "0.22em",
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}

/** irregular blob rim, deterministic from a seed */
function blobPath(seed: number, r: number, wobble: number, lobes = 11) {
  const n = 48;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k =
      Math.sin(a * lobes + seed) * 0.55 +
      Math.sin(a * (lobes - 4) + seed * 1.7) * 0.3 +
      Math.sin(a * 3 + seed * 0.3) * 0.35;
    const rr = r + k * wobble;
    const x = 50 + Math.cos(a) * rr;
    const y = 50 + Math.sin(a) * rr;
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  return d + "Z";
}

export function WaxSeal({
  initials,
  color,
  size = 56,
  pulse = false,
}: {
  initials: string;
  color: string;
  size?: number;
  pulse?: boolean;
}) {
  const uid = "ouar-seal-" + cleanId(useId());
  const letters = (initials || "?").slice(0, 3).toUpperCase();
  const seed = (hash(letters + color) % 1000) / 37;
  const rim = useMemo(() => blobPath(seed, 44, 3.2), [seed]);
  const inner = useMemo(() => blobPath(seed + 2, 33, 0.9, 9), [seed]);
  const fs = letters.length >= 3 ? 20 : letters.length === 2 ? 26 : 32;

  return (
    <span
      className={pulse ? "ouar-seal ouar-seal-pulse" : "ouar-seal"}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0, ["--ouar-seal" as string]: color } as CSSProperties}
      role="img"
      aria-label={`Wax seal ${letters}`}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={uid + "-hl"} cx="0.34" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="0.7" stopColor="#000" stopOpacity="0.05" />
            <stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
          <radialGradient id={uid + "-well"} cx="0.6" cy="0.65" r="0.7">
            <stop offset="0" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="0.7" stopColor="#000" stopOpacity="0.05" />
            <stop offset="1" stopColor="#000" stopOpacity="0.38" />
          </radialGradient>
        </defs>
        {/* drop shadow on the page */}
        <path d={rim} fill="#000" opacity="0.28" transform="translate(1.5 3)" />
        {/* wax body */}
        <path d={rim} fill={color} />
        <path d={rim} fill={`url(#${uid}-hl)`} />
        {/* pressed well */}
        <path d={inner} fill={color} />
        <path d={inner} fill={`url(#${uid}-well)`} />
        <path d={inner} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1.6" transform="translate(-0.6 -0.8)" />
        <path d={inner} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2" transform="translate(0.7 0.9)" />
        {/* tiny ring of dots like a signet */}
        <circle cx="50" cy="50" r="28.5" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="0.5 3.2" strokeLinecap="round" />
        {/* embossed initials */}
        <g
          textAnchor="middle"
          style={{ fontFamily: "var(--font-display, 'Cinzel Decorative', 'Cinzel', Georgia, serif)", fontWeight: 700 }}
          fontSize={fs}
        >
          <text x="50" y="50" dy="0.36em" fill="#000" fillOpacity="0.5" transform="translate(1 1.3)">
            {letters}
          </text>
          <text x="50" y="50" dy="0.36em" fill="#fff" fillOpacity="0.4" transform="translate(-0.8 -1)">
            {letters}
          </text>
          <text x="50" y="50" dy="0.36em" fill={color}>
            {letters}
          </text>
        </g>
        {/* specular glint */}
        <ellipse cx="33" cy="27" rx="8" ry="3.5" fill="#fff" opacity="0.35" transform="rotate(-35 33 27)" />
      </svg>
    </span>
  );
}

export default Stamp;
