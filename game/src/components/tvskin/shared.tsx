"use client";
/**
 * Shared bits for the in-game TV skin (the lobby's Jackbox x neon club x D&D look): the 16:9 stage, the painted
 * backdrop, the hero trading card, the d20 glyph and credit chips. All sizes are in --u (1/100 of a 16:9 stage).
 */
import { Fragment, useEffect, useRef, useState } from "react";
import type { Tier } from "@/lib/types";
import "@/app/tv-theme.css";
import { Particles } from "./motion";

export type Css = React.CSSProperties & Record<`--${string}`, string | number>;

/** Full-bleed overlay layer with a centered 16:9 stage. Put it over the painted scene; pieces position themselves. */
export function TvStage({ children, interactive = false, className = "" }: { children: React.ReactNode; interactive?: boolean; className?: string }) {
  return (
    <div className={`tvx tvx-layer ${interactive ? "is-live" : ""} ${className}`}>
      <div className="tvx-stage">{children}</div>
    </div>
  );
}

/**
 * The painted scene behind everything: a 2-layer parallax (the far layer drifts slowly; a near copy of the bottom of the
 * painting drifts faster), crossfade on change, club grade, grain, floating dust and sparks. (QuickTV has its own
 * Backdrop; this one is optional, or use <Particles/> on its own over QuickTV's.)
 */
export function SceneArt({ src, dim = 0.35, particles = true }: { src?: string; dim?: number; particles?: boolean }) {
  const [layers, setLayers] = useState<{ src: string; k: number }[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setLayers((ls) => (ls[ls.length - 1]?.src === src ? ls : [...ls.slice(-1), { src, k: ++seq.current }]));
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return (
    <div className="tvx tvx-art" aria-hidden>
      {layers.map((l) => (
        <div key={l.k} className="tvx-art-set" style={{ ["--kb" as string]: l.k % 2 ? "tvx-kb-b" : "tvx-kb-a" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={l.src} alt="" className="tvx-art-img" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={l.src} alt="" className="tvx-art-near" />
        </div>
      ))}
      <div className="tvx-art-grade" style={{ opacity: dim } as Css} />
      <div className="tvx-art-vig" />
      {particles && <Particles />}
      <div className="tvx-grain" />
    </div>
  );
}

/** Difficulty tiers: color + the words on the stamp. Shift values mirror lib/grade.ts TIER_SHIFT. */
export const TIER_LOOK: Record<Tier, { color: string; word: string }> = {
  clever: { color: "#2cf5c0", word: "Clever plan" },
  solid: { color: "#f7f3ff", word: "Solid plan" },
  risky: { color: "#ffad3b", word: "Bold plan" },
  wild: { color: "#ff2e7e", word: "Long shot" },
  miracle: { color: "#b46bff", word: "Only a miracle" },
};

export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

/** Possessive for big titles: "GUS'S", "JAMES'S" (the style the game already uses on screen). */
export const possessive = (name: string) => `${name}’s`;

// ---------- d20 glyph (front view of an icosahedron) ----------
const H = [[100, 8], [179.7, 54], [179.7, 146], [100, 192], [20.3, 146], [20.3, 54]] as const;
const T = [[100, 42], [151, 130], [49, 130]] as const;
const pt = (p: readonly number[]) => p.join(",");
const SPOKES: [readonly number[], readonly number[]][] = [
  [H[0], T[0]], [H[1], T[0]], [H[1], T[1]], [H[2], T[1]], [H[3], T[1]], [H[3], T[2]], [H[4], T[2]], [H[5], T[2]], [H[5], T[0]],
];
export function D20Glyph({ className, label = "20", style }: { className?: string; label?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 200" className={`tvx-d20 ${className ?? ""}`} style={style} aria-hidden>
      <polygon points={H.map(pt).join(" ")} className="tvx-d20-body" />
      <polygon points={T.map(pt).join(" ")} className="tvx-d20-face" />
      {SPOKES.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      ))}
      {label && (
        <text x="100" y="112" textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      )}
    </svg>
  );
}

// ---------- hero trading card (same family as the lobby cards, bigger) ----------
export interface CardHero {
  name: string;
  epithet?: string;
  stats?: { label: string; value: number }[];
  color: string;
  portrait?: string;
}

export function HeroTradingCard({ hero, size = 16, tilt = -4, className = "", badge }: { hero: CardHero; size?: number; tilt?: number; className?: string; badge?: string }) {
  const style: Css = { "--c": hero.color, "--w": size, "--tilt": `${tilt}deg` };
  return (
    <div className={`tvx-card ${className}`} style={style}>
      <div className="tvx-card-art">
        {hero.portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.portrait} alt="" />
        ) : (
          <svg viewBox="0 0 64 80" className="tvx-card-sil" aria-hidden>
            <circle cx="32" cy="28" r="13" />
            <path d="M6 80c1-17 11-27 26-27s25 10 26 27z" />
          </svg>
        )}
        <span className="tvx-card-sheen" aria-hidden />
        {badge && <span className="tvx-card-badge">{badge}</span>}
      </div>
      <div className="tvx-card-plate">
        <span>{hero.name}</span>
      </div>
      {(hero.epithet || hero.stats) && (
        <div className="tvx-card-sheet">
          {hero.epithet && <span className="tvx-card-epi">{hero.epithet}</span>}
          {hero.stats && (
            <span className="tvx-card-stats">
              {hero.stats.map((s) => (
                <span key={s.label} className={s.value >= 2 ? "best" : s.value < 0 ? "low" : ""}>
                  <b>{fmtSigned(s.value)}</b>
                  {s.label}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** "+ SAM'S IDEA +1": who gets credit for a friend's suggestion. */
export function CreditChip({ name, color, bonus = 1, className = "", style }: { name: string; color: string; bonus?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`tvx-credit ${className}`} style={{ ...(style ?? {}), ["--c" as string]: color }}>
      <span className="tvx-credit-plus">+</span>
      <span className="tvx-credit-name">{possessive(name)} idea</span>
      {bonus !== 0 && <span className="tvx-credit-bonus">{fmtSigned(bonus)}</span>}
    </span>
  );
}

/** Small round portrait (falls back to an initial in the player's color). */
export function Face({ src, name, color, size = 3 }: { src?: string; name: string; color: string; size?: number }) {
  const style: Css = { "--c": color, "--s": size };
  return (
    <span className="tvx-face" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

/** Splits text into word spans with a stagger index, for word-by-word reveals (opacity/transform only). */
export function Words({ text, start = 0, step = 0.06, className = "" }: { text: string; start?: number; step?: number; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className={`tvx-word ${className}`} style={{ animationDelay: `${start + i * step}s` }}>
            {w}
          </span>{" "}
        </Fragment>
      ))}
    </>
  );
}
