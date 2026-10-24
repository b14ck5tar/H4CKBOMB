"use client";

import { useEffect, useId, useRef, useState } from "react";

type Tone = "gold" | "crimson" | "ink";

const TONES: Record<Tone, { hi: string; mid: string; lo: string; line: string; text: string; engrave: string }> = {
  gold: { hi: "#FBE7A6", mid: "#C8952E", lo: "#6B4612", line: "#4A3210", text: "#2A1E16", engrave: "rgba(255,244,200,0.75)" },
  crimson: { hi: "#E26A70", mid: "#A3282E", lo: "#4A0D12", line: "#2B080B", text: "#F4E9D0", engrave: "rgba(0,0,0,0.55)" },
  ink: { hi: "#6A5543", mid: "#2A1E16", lo: "#0D0806", line: "#C8952E", text: "#E6C063", engrave: "rgba(0,0,0,0.7)" },
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
      const node = spinRef.current;
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
      const node = spinRef.current;
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
  const c = nat1 ? FAIL : TONES[tone];
  const shown = rolling ? String(flicker) : value == null ? "?" : String(value);
  const justLanded = landKey > 0 && landed;
  const landClass = !justLanded ? "" : nat1 ? "ouar-d20-land-fail" : nat20 ? "ouar-d20-land-crit" : "ouar-d20-land";
  const fontSize = shown.length > 1 ? 44 : 52;

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
                  <stop offset="0" stopColor="#FFF6D6" stopOpacity="0.95" />
                  <stop offset="0.45" stopColor="#F2C85B" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#C8952E" stopOpacity="0" />
                </radialGradient>
              </defs>
              <g className="ouar-d20-rays">
                {Array.from({ length: 16 }).map((_, i) => (
                  <polygon
                    key={i}
                    points="100,100 96,-30 104,-30"
                    fill="#F6D57A"
                    opacity={i % 2 ? 0.45 : 0.8}
                    transform={`rotate(${i * 22.5} 100 100)`}
                  />
                ))}
              </g>
              <circle cx="100" cy="100" r="105" fill={`url(#${uid}-burst)`} />
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
              className={nat20 ? "ouar-d20-glow" : nat1 ? "ouar-d20-dim" : undefined}
              style={{ display: "block", overflow: "visible", filter: nat20 || nat1 ? undefined : "drop-shadow(0 6px 8px rgba(22,27,51,0.35))" }}
            >
              <defs>
                <linearGradient id={uid + "-g"} x1="0.15" y1="0" x2="0.85" y2="1">
                  <stop offset="0" stopColor={c.hi} />
                  <stop offset="0.45" stopColor={c.mid} />
                  <stop offset="1" stopColor={c.lo} />
                </linearGradient>
                <linearGradient id={uid + "-sheen"} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.48" stopColor="#fff" stopOpacity="0.55" />
                  <stop offset="0.56" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <filter id={uid + "-leaf"} x="-5%" y="-5%" width="110%" height="110%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
                  <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.8  0 0 0 -2.2 1.25" result="speck" />
                  <feComposite in="speck" in2="SourceGraphic" operator="in" result="specks" />
                  <feMerge>
                    <feMergeNode in="SourceGraphic" />
                    <feMergeNode in="specks" />
                  </feMerge>
                </filter>
              </defs>
              <g filter={tone === "gold" && !nat1 ? `url(#${uid}-leaf)` : undefined}>
                <polygon points={pts(...H)} fill={`url(#${uid}-g)`} />
                {FACETS.map((f, i) => (
                  <polygon
                    key={i}
                    points={f.p}
                    fill={f.l > 0 ? "#FFF8E0" : "#000"}
                    fillOpacity={Math.abs(f.l) * (f.l > 0 ? 0.32 : 0.38)}
                  />
                ))}
                <polygon points={pts(...T)} fill={`url(#${uid}-g)`} />
                <polygon points={pts(...T)} fill="#FFF8E0" fillOpacity={0.12} />
                <polygon points={pts(...T)} fill={`url(#${uid}-sheen)`} />
              </g>
              {/* facet edges */}
              <g fill="none" stroke={c.line} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
                <polygon points={pts(...H)} strokeWidth={4} />
                <polygon points={pts(...T)} />
                <polyline points={pts(H[5], T[0], H[0])} />
                <polyline points={pts(T[0], H[1], T[1])} />
                <polyline points={pts(H[2], T[1], H[3])} />
                <polyline points={pts(H[3], T[2], H[4])} />
                <line x1={T[2][0]} y1={T[2][1]} x2={H[5][0]} y2={H[5][1]} />
              </g>
              {/* engraved number */}
              <g
                style={{ fontFamily: "var(--font-heading, 'Cinzel', 'Trajan Pro', Georgia, serif)", fontWeight: 700 }}
                textAnchor="middle"
                fontSize={fontSize}
              >
                <text x="100" y="101.5" dy="0.35em" fill={c.engrave}>
                  {shown}
                </text>
                <text x="100" y="100" dy="0.35em" fill={c.text} className={rolling ? "ouar-d20-flick" : undefined}>
                  {shown}
                </text>
              </g>
              {nat1 && (
                <g fill="none" stroke="#1A0C08" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
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
            marginTop: Math.max(4, size * 0.04),
            fontSize: Math.max(11, Math.round(size * 0.075)),
            fontFamily: "var(--font-heading, 'Cinzel', Georgia, serif)",
            fontVariant: "small-caps",
            letterSpacing: "0.08em",
            color: "currentColor",
            textAlign: "center",
            lineHeight: 1.1,
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
