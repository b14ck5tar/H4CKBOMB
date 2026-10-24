"use client";

import { useEffect, useId, useRef, useState } from "react";

type Tone = "gold" | "crimson" | "ink";

// Smoked-glass bodies with neon edges. "gold" (the main die) is the holographic one.
const TONES: Record<Tone, { hi: string; mid: string; lo: string; line: string; text: string; glow: string; holo: boolean }> = {
  gold: { hi: "#33205A", mid: "#170D2C", lo: "#06030D", line: "#3DE7FF", text: "#FFFFFF", glow: "#3DE7FF", holo: true },
  crimson: { hi: "#6A1238", mid: "#2C0719", lo: "#0D0208", line: "#FF2E7E", text: "#FFE9F2", glow: "#FF2E7E", holo: false },
  ink: { hi: "#2C2538", mid: "#15101C", lo: "#050407", line: "#FF9A1F", text: "#FFC56A", glow: "#FF9A1F", holo: false },
};

const FAIL = TONES.crimson;

// Geometry (viewBox 0 0 200 200): pointy-top hexagon + central up-triangle.
const H = [
  [100, 8],
  [179.7, 54],
  [179.7, 146],
  [100, 192],
  [20.3, 146],
  [20.3, 54],
] as const;
const T = [
  [100, 42],
  [151, 130],
  [49, 130],
] as const;
type P = readonly [number, number];
const pts = (...p: P[]) => p.map((q) => q.join(",")).join(" ");

// facets with a light amount (-1 dark .. +1 bright), light from top-left
const FACETS: { p: string; l: number }[] = [
  { p: pts(H[0], H[5], T[0]), l: 0.75 },
  { p: pts(H[0], H[1], T[0]), l: 0.35 },
  { p: pts(H[1], T[0], T[1]), l: -0.05 },
  { p: pts(H[1], H[2], T[1]), l: -0.45 },
  { p: pts(H[2], H[3], T[1]), l: -0.65 },
  { p: pts(H[3], T[1], T[2]), l: -0.35 },
  { p: pts(H[3], H[4], T[2]), l: -0.2 },
  { p: pts(H[4], H[5], T[2]), l: 0.25 },
  { p: pts(H[5], T[0], T[2]), l: 0.5 },
];
// iridescent tint per facet for the holo die
const HOLO = ["#3DE7FF", "#FF2E7E", "#FF9A1F", "#B46BFF", "#3DE7FF", "#FF2E7E", "#2CF5C0", "#FF9A1F", "#B46BFF"];

const CRACKS = [
  "M100 42 L104 66 L96 82 L106 101 L99 118 L103 130",
  "M96 82 L80 90 L70 104",
  "M106 101 L124 108 L138 104",
  "M179.7 54 L160 70 L151 76",
  "M49 130 L40 150 L28 156",
];

function randFace(prev: number) {
  let n = prev;
  while (n === prev) n = 1 + Math.floor(Math.random() * 20);
  return n;
}

export function D20({
  value,
  rolling,
  size = 220,
  tone = "gold",
  label,
}: {
  value: number | null;
  rolling: boolean;
  size?: number;
  tone?: "gold" | "crimson" | "ink";
  label?: string;
}) {
  const rawId = useId();
  const uid = "d20" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const spinRef = useRef<HTMLDivElement>(null);
  const [flicker, setFlicker] = useState<number>(() => 1 + Math.floor(Math.random() * 20));
  const [landKey, setLandKey] = useState(0);
  const wasRolling = useRef(rolling);

  // tumble + number flicker while rolling, with ease-out deceleration
  useEffect(() => {
    if (!rolling) return;
    const node = spinRef.current;
    const start = performance.now();
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let angle = 0;
    let last = start;
    const spin = () => {
      const now = performance.now();
      const el = now - start;
      const dt = (now - last) / 1000;
      last = now;
      const vel = Math.max(160, 1300 * Math.exp(-el / 700)); // deg/s
      angle += vel * dt;
      const s = 1 + 0.07 * Math.sin(el / 55) * Math.max(0.3, Math.exp(-el / 1200));
      const hop = -Math.abs(Math.sin(el / 120)) * size * 0.07 * Math.max(0.25, Math.exp(-el / 900));
      if (node) node.style.transform = `translateY(${hop.toFixed(1)}px) rotate(${angle.toFixed(1)}deg) scale(${s.toFixed(3)})`;
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    const flick = () => {
      const el = performance.now() - start;
      setFlicker((p) => randFace(p));
      const p = Math.min(el / 1400, 1);
      timer = setTimeout(flick, 45 + 190 * p * p);
    };
    flick();
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      if (node) node.style.transform = "";
    };
  }, [rolling, size]);

  // detect the rolling -> landed transition
  useEffect(() => {
    if (wasRolling.current && !rolling) setLandKey((k) => k + 1);
    wasRolling.current = rolling;
  }, [rolling]);

  const landed = !rolling && value != null;
  const nat20 = landed && value === 20;
  const nat1 = landed && value === 1;
  const c = nat1 ? FAIL : TONES[tone] ?? TONES.gold;
  const shown = rolling ? String(flicker) : value == null ? "?" : String(value);
  const justLanded = landKey > 0 && landed;
  const landClass = !justLanded ? "" : nat1 ? "ouar-d20-land-fail" : nat20 ? "ouar-d20-land-crit" : "ouar-d20-land";
  const fontSize = shown.length > 1 ? 50 : 60;
  const svgClass = nat20 ? "ouar-d20-glow" : nat1 ? "ouar-d20-dim" : rolling && c.holo ? "ouar-d20-holo" : undefined;

  return (
    <div
      className="ouar-d20"
      style={{ width: size, display: "inline-flex", flexDirection: "column", alignItems: "center", position: "relative" }}
      role="img"
      aria-label={rolling ? "Rolling d20" : value == null ? "d20, not rolled" : `d20 shows ${value}`}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        {nat20 && (
          <div key={"burst" + landKey} className="ouar-d20-burst" aria-hidden>
            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ overflow: "visible" }}>
              <defs>
                <radialGradient id={uid + "-burst"}>
                  <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="0.3" stopColor="#3DE7FF" stopOpacity="0.6" />
                  <stop offset="0.65" stopColor="#FF2E7E" stopOpacity="0.25" />
                  <stop offset="1" stopColor="#FF2E7E" stopOpacity="0" />
                </radialGradient>
              </defs>
              <g className="ouar-d20-rays">
                {Array.from({ length: 18 }).map((_, i) => (
                  <polygon
                    key={i}
                    points={i % 3 === 0 ? "100,100 97,-40 103,-40" : "100,100 98.6,-10 101.4,-10"}
                    fill={i % 2 ? "#FF9A1F" : "#3DE7FF"}
                    opacity={i % 3 === 0 ? 0.9 : 0.6}
                    transform={`rotate(${i * 20} 100 100)`}
                  />
                ))}
              </g>
              <circle cx="100" cy="100" r="105" fill={`url(#${uid}-burst)`} />
              <circle className="ouar-d20-shock" cx="100" cy="100" r="80" fill="none" stroke="#3DE7FF" strokeWidth="3" />
            </svg>
          </div>
        )}
        <div
          key={"land" + landKey}
          className={landClass}
          style={{ width: "100%", height: "100%", transform: nat1 ? "rotate(17deg) translate(4%, 3%)" : undefined }}
        >
          <div ref={spinRef} style={{ width: "100%", height: "100%", willChange: rolling ? "transform" : undefined }}>
            <svg
              viewBox="0 0 200 200"
              width={size}
              height={size}
              className={svgClass}
              style={{
                display: "block",
                overflow: "visible",
                filter: nat20 || nat1 ? undefined : `drop-shadow(0 0 ${Math.round(size * 0.05)}px ${c.glow}66) drop-shadow(0 8px 10px rgba(0,0,0,0.6))`,
              }}
            >
              <defs>
                <linearGradient id={uid + "-g"} x1="0.15" y1="0" x2="0.85" y2="1">
                  <stop offset="0" stopColor={c.hi} />
                  <stop offset="0.45" stopColor={c.mid} />
                  <stop offset="1" stopColor={c.lo} />
                </linearGradient>
                <linearGradient id={uid + "-holo"} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#3DE7FF" stopOpacity="0.35" />
                  <stop offset="0.35" stopColor="#B46BFF" stopOpacity="0.18" />
                  <stop offset="0.65" stopColor="#FF2E7E" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#FF9A1F" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id={uid + "-sheen"} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.47" stopColor="#fff" stopOpacity="0.4" />
                  <stop offset="0.53" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <filter id={uid + "-neon"} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* glass body */}
              <polygon points={pts(...H)} fill={`url(#${uid}-g)`} />
              {FACETS.map((f, i) => (
                <polygon
                  key={i}
                  points={f.p}
                  fill={c.holo ? HOLO[i] : f.l > 0 ? "#FFFFFF" : "#000"}
                  fillOpacity={c.holo ? 0.1 + Math.max(0, f.l) * 0.22 : Math.abs(f.l) * (f.l > 0 ? 0.16 : 0.4)}
                />
              ))}
              {c.holo && <polygon points={pts(...H)} fill={`url(#${uid}-holo)`} />}
              <polygon points={pts(...T)} fill="#07040C" fillOpacity={0.55} />
              <polygon points={pts(...T)} fill={`url(#${uid}-sheen)`} />
              {/* neon facet edges */}
              <g fill="none" stroke={c.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" filter={`url(#${uid}-neon)`}>
                <polygon points={pts(...H)} strokeWidth={3.6} />
                <polygon points={pts(...T)} strokeWidth={2.6} />
                <g strokeOpacity={0.7}>
                  <polyline points={pts(H[5], T[0], H[0])} />
                  <polyline points={pts(T[0], H[1], T[1])} />
                  <polyline points={pts(H[2], T[1], H[3])} />
                  <polyline points={pts(H[3], T[2], H[4])} />
                  <line x1={T[2][0]} y1={T[2][1]} x2={H[5][0]} y2={H[5][1]} />
                </g>
              </g>
              {/* the number */}
              <g
                style={{ fontFamily: "var(--font-display, 'Anton', Impact, sans-serif)", fontWeight: 400 }}
                textAnchor="middle"
                fontSize={fontSize}
              >
                <text x="100" y="104" dy="0.36em" fill={c.glow} fillOpacity={0.9} filter={`url(#${uid}-neon)`} className={rolling ? "ouar-d20-flick" : undefined}>
                  {shown}
                </text>
                <text x="100" y="104" dy="0.36em" fill={c.text} className={rolling ? "ouar-d20-flick" : undefined}>
                  {shown}
                </text>
              </g>
              {nat1 && (
                <g fill="none" stroke="#FFD3E4" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${uid}-neon)`}>
                  {CRACKS.map((d, i) => (
                    <path key={i} d={d} pathLength={1} className="ouar-d20-crack" style={{ animationDelay: `${0.35 + i * 0.08}s` }} />
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
      {label && (
        <div
          className="ouar-d20-label"
          style={{
            marginTop: Math.max(4, size * 0.05),
            fontSize: Math.max(11, Math.round(size * 0.07)),
            fontFamily: "var(--font-ui, 'IBM Plex Mono', ui-monospace, monospace)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "currentColor",
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: size * 1.2,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export default D20;
