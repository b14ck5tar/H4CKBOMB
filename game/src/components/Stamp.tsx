"use client";

import { useId, useMemo, type CSSProperties } from "react";

// Neon ink colors. Each stamp sits on its own near-black plate, so it reads on any background.
const STAMP_TONES = {
  crimson: "#FF2E7E",
  gilt: "#FFB13B",
  forest: "#2CF5C0",
  ink: "#EDE8FA",
} as const;

const SIZES = {
  sm: { font: 16, sub: 9, padX: 9, padY: 3, border: 2, gap: 3, inset: 2 },
  md: { font: 26, sub: 11, padX: 14, padY: 5, border: 3, gap: 4, inset: 3 },
  lg: { font: 44, sub: 14, padX: 22, padY: 8, border: 4, gap: 5, inset: 4 },
  xl: { font: 74, sub: 20, padX: 34, padY: 12, border: 6, gap: 7, inset: 6 },
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

/** Push any color (e.g. the storybook player palette) toward a bright neon that glows on dark. */
function neon(color: string) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || "").trim());
  if (!m) return color || "#3DE7FF";
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l0 = (max + min) / 2;
  const s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
  const s = d === 0 ? 0 : Math.max(s0, 0.85);
  const l = Math.max(l0, 0.64);
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
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
  const glow = Math.max(4, Math.round(s.font * 0.28));

  const style = {
    "--ouar-rot": `${rotate}deg`,
    "--ouar-stamp": color,
    transform: `rotate(${rotate}deg)`,
    display: "inline-block",
    position: "relative",
    color,
    padding: s.inset,
    border: `${s.border}px solid ${color}`,
    borderRadius: 2,
    background: `color-mix(in srgb, ${color} 9%, #07040C)`,
    filter: `url(#${fid}) drop-shadow(0 0 ${glow}px color-mix(in srgb, ${color} 55%, transparent))`,
    lineHeight: 1,
    whiteSpace: "nowrap",
    userSelect: "none",
  } as CSSProperties;

  return (
    <span className={slam ? "ouar-stamp ouar-stamp-slam" : "ouar-stamp"} style={style} role="img" aria-label={sub ? `${text}, ${sub}` : text}>
      <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }} aria-hidden focusable="false">
        <filter id={fid} x="-10%" y="-20%" width="120%" height="140%">
          {/* slightly rough, rubber-stamp edges */}
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed={seed} result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale={Math.max(1.5, s.border * 0.55)} xChannelSelector="R" yChannelSelector="G" result="rough" />
          {/* a few worn specks where the ink didn't take */}
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={seed + 3} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -24 19.6" result="holes" />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
      </svg>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: s.gap,
          padding: `${s.padY}px ${s.padX}px`,
          // hazard ticks on the left and right edges of the plate
          backgroundImage: `repeating-linear-gradient(180deg, ${color} 0 ${Math.max(2, s.border)}px, transparent ${Math.max(2, s.border)}px ${Math.max(4, s.border * 2.5)}px)`,
          backgroundSize: `${Math.max(2, s.border)}px 100%`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left center",
        }}
      >
        <span
          className={slam ? "ouar-stamp-glitch" : undefined}
          style={{
            fontFamily: "var(--font-display, 'Anton', Impact, sans-serif)",
            fontWeight: 400,
            fontSize: s.font,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            textAlign: "center",
            paddingLeft: "0.05em",
            textShadow: `-0.03em 0 0 rgba(61,231,255,0.45), 0.03em 0 0 rgba(255,46,126,0.45), 0 0 0.35em color-mix(in srgb, ${color} 60%, transparent)`,
          }}
        >
          {text}
        </span>
        {sub && (
          <span
            style={{
              fontFamily: "var(--font-ui, 'IBM Plex Mono', ui-monospace, monospace)",
              fontWeight: 700,
              fontSize: s.sub,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              textAlign: "center",
              color: "#07040C",
              background: color,
              padding: `${Math.max(1, s.gap * 0.5)}px ${s.gap * 1.5}px`,
              paddingLeft: `calc(${s.gap * 1.5}px + 0.2em)`,
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}

/** Glowing sigil badge with initials (formerly a wax seal; same props). */
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
  const c = useMemo(() => neon(color), [color]);
  const seed = hash(letters + color);
  const spin = (seed % 60) - 30; // each player's sigil sits at its own angle
  const fs = letters.length >= 3 ? 25 : letters.length === 2 ? 32 : 40;
  const hex = "50,16 79.4,33 79.4,67 50,84 20.6,67 20.6,33";

  return (
    <span
      className={pulse ? "ouar-seal ouar-seal-pulse" : "ouar-seal"}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0, ["--ouar-seal" as string]: c } as CSSProperties}
      role="img"
      aria-label={`Badge ${letters}`}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={uid + "-core"} cx="0.5" cy="0.42" r="0.6">
            <stop offset="0" stopColor={c} stopOpacity="0.32" />
            <stop offset="0.65" stopColor="#0B0714" stopOpacity="1" />
            <stop offset="1" stopColor="#05030A" stopOpacity="1" />
          </radialGradient>
          <filter id={uid + "-glow"} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* dark backing so the sigil reads on any surface */}
        <circle cx="50" cy="50" r="47" fill="#07040C" />
        {/* outer broken ring (spins while pulsing) */}
        <g className={pulse ? "ouar-sigil-spin" : undefined} style={{ transformOrigin: "50px 50px" }}>
          <g transform={`rotate(${spin} 50 50)`}>
            <circle cx="50" cy="50" r="45" fill="none" stroke={c} strokeWidth="3.2" strokeDasharray="48 9 14 9" filter={`url(#${uid}-glow)`} />
          </g>
        </g>
        {/* tick ring */}
        <circle cx="50" cy="50" r="39" fill="none" stroke={c} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="1 4.1" />
        {/* hex core */}
        <polygon points={hex} transform="translate(50 50) scale(1.12) translate(-50 -50)" fill={`url(#${uid}-core)`} stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
        {/* initials */}
        <text
          x="50"
          y="50"
          dy="0.36em"
          textAnchor="middle"
          fontSize={fs}
          fill="#FFFFFF"
          filter={`url(#${uid}-glow)`}
          style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', 'Arial Narrow', sans-serif)", fontWeight: 800, letterSpacing: "0.02em" }}
        >
          {letters}
        </text>
        <text
          x="50"
          y="50"
          dy="0.36em"
          textAnchor="middle"
          fontSize={fs}
          fill="none"
          stroke={c}
          strokeOpacity="0.9"
          strokeWidth="0.9"
          style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', 'Arial Narrow', sans-serif)", fontWeight: 800, letterSpacing: "0.02em" }}
        >
          {letters}
        </text>
      </svg>
    </span>
  );
}

export default Stamp;
