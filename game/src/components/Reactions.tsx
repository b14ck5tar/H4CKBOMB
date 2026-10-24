"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Item = { id: number; emoji: string; color?: string };
type Floater = Item & { x: number; dur: number; sway: number; swayDur: number; size: number; tilt: number; born: number };

const MAX = 40;

/** Push any color (e.g. the storybook player palette) toward a bright neon glow. */
function neon(color: string) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || "").trim());
  if (!m) return color;
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
  return `hsl(${Math.round(h)} ${Math.round((d === 0 ? 0 : Math.max(s0, 0.85)) * 100)}% ${Math.round(Math.max(l0, 0.62) * 100)}%)`;
}

export function Reactions({ items }: { items: { id: number; emoji: string; color?: string }[] }) {
  const [live, setLive] = useState<Floater[]>([]);
  const seen = useRef<Set<number>>(new Set());
  const remove = useCallback(
    (id: number) => setLive((prev) => (prev.some((p) => p.id === id) ? prev.filter((p) => p.id !== id) : prev)),
    [],
  );

  useEffect(() => {
    const fresh: Floater[] = [];
    for (const it of items ?? []) {
      if (seen.current.has(it.id)) continue;
      seen.current.add(it.id);
      fresh.push({
        ...it,
        x: 4 + Math.random() * 92,
        dur: 2.2 + Math.random() * 0.45,
        sway: 18 + Math.random() * 34,
        swayDur: 0.7 + Math.random() * 0.5,
        size: 44 + Math.random() * 28,
        tilt: Math.random() * 30 - 15,
        born: Date.now(),
      });
    }
    // keep the "seen" set from growing without bound
    if (seen.current.size > 600) {
      const keep = new Set((items ?? []).map((i) => i.id));
      seen.current = keep;
    }
    if (!fresh.length) return;
    setLive((prev) => {
      const next = [...prev, ...fresh];
      return next.length > MAX ? next.slice(next.length - MAX) : next;
    });
    for (const f of fresh) {
      // backup removal (primary is onAnimationEnd); setState after unmount is a harmless no-op
      setTimeout(() => remove(f.id), f.dur * 1000 + 250);
    }
  }, [items, remove]);

  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 60 }}
    >
      {live.map((f) => (
        <div
          key={f.id}
          className="ouar-react-rise"
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) remove(f.id);
          }}
          style={
            {
              position: "absolute",
              left: `${f.x}%`,
              bottom: 0,
              animationDuration: `${f.dur}s`,
              "--ouar-tilt": `${f.tilt}deg`,
            } as CSSProperties
          }
        >
          <div
            className="ouar-react-sway"
            style={
              {
                animationDuration: `${f.swayDur}s`,
                "--ouar-sway": `${f.sway}px`,
              } as CSSProperties
            }
          >
            <span
              style={{
                display: "block",
                fontSize: f.size,
                lineHeight: 1,
                transform: "translateX(-50%)",
                filter: f.color
                  ? `drop-shadow(0 0 10px ${neon(f.color)}) drop-shadow(0 0 3px ${neon(f.color)}) drop-shadow(0 4px 6px rgba(0,0,0,0.5))`
                  : "drop-shadow(0 0 10px rgba(61,231,255,0.55)) drop-shadow(0 4px 6px rgba(0,0,0,0.5))",
              }}
            >
              {f.emoji}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Reactions;
