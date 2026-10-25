"use client";
/**
 * Motion kit for the TV skin. Everything runs on the compositor: CSS keyframes with spring easings (linear()),
 * plus the Web Animations API for one-shot hits (screen shake, flash). No libraries.
 *   <Particles/>      floating dust + rising sparks (idle life)
 *   <PhaseSwap k>     paint-smear wipe between phases; holds the old screen until the smear covers it
 *   <Letters text/>   letter-by-letter punch-in
 *   shakeStage(el), flashScreen(el, color)   one-shot hits
 */
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Css } from "./shared";

const RM = "(prefers-reduced-motion: reduce)";
function subRM(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const m = window.matchMedia(RM);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
/** True when the viewer asked the OS for less motion. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subRM,
    () => window.matchMedia(RM).matches,
    () => false,
  );
}
const reduced = () => typeof window !== "undefined" && window.matchMedia(RM).matches;

/** A short camera shake on the 16:9 stage that contains `el` (nat 1, big hits). */
export function shakeStage(el: Element | null, strength = 1) {
  if (!el || reduced()) return;
  const stage = el.closest(".tvx-stage") as HTMLElement | null;
  if (!stage?.animate) return;
  const s = (n: number) => `${n * strength}px`;
  stage.animate(
    [
      { transform: "translate3d(0,0,0)" },
      { transform: `translate3d(${s(-14)},${s(6)},0) rotate(-0.6deg)` },
      { transform: `translate3d(${s(12)},${s(-8)},0) rotate(0.5deg)` },
      { transform: `translate3d(${s(-9)},${s(4)},0) rotate(-0.3deg)` },
      { transform: `translate3d(${s(6)},${s(-3)},0)` },
      { transform: `translate3d(${s(-3)},${s(2)},0)` },
      { transform: "translate3d(0,0,0)" },
    ],
    { duration: 520, easing: "ease-out" },
  );
}

/** A full-screen light flash (impact frames). */
export function flashScreen(el: Element | null, color = "rgba(255,255,255,0.7)", ms = 420) {
  if (!el || typeof document === "undefined") return;
  const layer = (el.closest(".tvx-layer") as HTMLElement | null) ?? document.body;
  const f = document.createElement("div");
  f.className = "tvx-flash";
  f.style.background = `radial-gradient(70% 70% at 50% 50%, ${color}, transparent 75%)`;
  layer.appendChild(f);
  const a = f.animate([{ opacity: 0 }, { opacity: reduced() ? 0.25 : 1, offset: 0.12 }, { opacity: 0 }], { duration: ms, easing: "ease-out" });
  a.onfinish = () => f.remove();
}

// ---------- idle particles ----------
type P = { x: number; y: number; s: number; d: number; dl: number; dx: number; c: string; spark: boolean };
function makeParticles(n: number, seed: number): P[] {
  const r = (i: number, k: number) => ((Math.sin((i + 1) * 12.9898 + k * 78.233 + seed) * 43758.5453) % 1 + 1) % 1;
  const colors = ["#3de7ff", "#ff2e7e", "#ffd23f", "#c6ff2e", "#ffffff"];
  return Array.from({ length: n }, (_, i) => {
    const spark = r(i, 7) > 0.62;
    return {
      x: r(i, 1) * 100,
      y: 30 + r(i, 2) * 75,
      s: spark ? 0.22 + r(i, 3) * 0.25 : 0.12 + r(i, 3) * 0.2,
      d: spark ? 7 + r(i, 4) * 7 : 16 + r(i, 4) * 16,
      dl: -r(i, 5) * 30,
      dx: (r(i, 6) - 0.5) * 12,
      c: spark ? colors[i % 4] : "#fff",
      spark,
    };
  });
}
/** Floating dust and rising neon sparks. Pure CSS loops; ~30 tiny layers. */
export function Particles({ count = 30, seed = 1, className = "" }: { count?: number; seed?: number; className?: string }) {
  const [ps] = useState(() => makeParticles(count, seed));
  return (
    <div className={`tvx-particles ${className}`} aria-hidden>
      {ps.map((p, i) => {
        const st: Css = { "--x": `${p.x}%`, "--y": `${p.y}%`, "--s": p.s, "--d": `${p.d}s`, "--dl": `${p.dl}s`, "--dx": p.dx, "--pc": p.c };
        return <i key={i} className={p.spark ? "spark" : "dust"} style={st} />;
      })}
    </div>
  );
}

// ---------- letters ----------
/** Splits a word into letter spans that punch in one by one (keeps spaces). */
export function Letters({ text, start = 0, step = 0.045, className = "" }: { text: string; start?: number; step?: number; className?: string }) {
  return (
    <>
      {Array.from(text).map((ch, i) =>
        ch === " " ? (
          <Fragment key={i}> </Fragment>
        ) : (
          <span key={i} className={`tvx-letter ${className}`} style={{ animationDelay: `${start + i * step}s` }}>
            {ch}
          </span>
        ),
      )}
    </>
  );
}

// ---------- phase transitions ----------
const WIPE_COVER_MS = 560;

/** The paint smear itself (three neon strokes and an ink stroke sweeping across). Keyed: remount to replay. */
export function InkWipe() {
  return (
    <div className="tvx-wipe" aria-hidden>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="none" className="tvx-wipe-s s1">
        <path d={SMEAR} />
      </svg>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="none" className="tvx-wipe-s s2">
        <path d={SMEAR} />
      </svg>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="none" className="tvx-wipe-s s3">
        <path d={SMEAR} />
      </svg>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="none" className="tvx-wipe-s s4">
        <path d={SMEAR} />
      </svg>
    </div>
  );
}
// a ragged brush stroke: flat body, frayed leading edge, drips
const SMEAR =
  "M0 40 C200 10 420 30 640 18 C880 6 1100 26 1320 14 L1420 8 L1470 30 L1440 52 L1520 64 L1470 92 L1560 118 L1490 140 L1600 168 L1500 196 L1550 226 L1450 248 L1480 280 L1320 286 C1100 300 880 276 640 292 C420 300 200 280 0 290 Z M380 286 C384 330 396 340 402 300 Z M960 280 C966 340 980 344 986 288 Z";

/**
 * Swap screens behind a paint-smear wipe. While `k` stays the same the children render live; when `k` changes,
 * the old screen eases out, the smear covers it, and the new children appear underneath as it clears.
 */
export function PhaseSwap({ k, children, wipe = true }: { k: string | number; children: React.ReactNode; wipe?: boolean }) {
  const [shownK, setShownK] = useState(k);
  const [wipes, setWipes] = useState(0);
  const held = useRef<React.ReactNode>(children);
  if (k === shownK) held.current = children;
  const leaving = k !== shownK;
  useEffect(() => {
    if (k === shownK) return;
    if (!wipe || reduced()) {
      setShownK(k);
      return;
    }
    setWipes((n) => n + 1);
    const t = setTimeout(() => setShownK(k), WIPE_COVER_MS);
    return () => clearTimeout(t);
  }, [k, shownK, wipe]);
  return (
    <>
      <div key={String(shownK)} className={`tvx-phase ${leaving ? "is-leaving" : ""}`}>
        {held.current}
      </div>
      {wipes > 0 && <InkWipe key={wipes} />}
    </>
  );
}
