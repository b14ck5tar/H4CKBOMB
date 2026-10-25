"use client";
/**
 * SWIPE UP TO THROW. The die sits on a glowing launch pad at the bottom; chevrons climb above it. Drag it (it follows
 * your thumb and leans), flick up to throw (it rockets off the top with a flash), or tap. Same contract as the
 * builder's SwipeThrow in Phone.tsx: onThrow(power 0.15..1, angle -1..1), rounded to 2 decimals, fired once.
 * The swipe only shapes the flight on the TV; the number was already decided in code.
 *   onThrow  ->  sfx.unlock(); send("roll", { power, angle }); vibrate([20, 40, 20])
 */
import { useRef, useState } from "react";
import { D20 } from "../D20";
import { Fuse, Kicker, vibrate, type TimerSpec } from "./kit";

export type Bonus = { label: string; value: number };

function Chevron() {
  return (
    <svg viewBox="0 0 96 46" aria-hidden>
      <path d="M10 38 L48 10 L86 38" />
    </svg>
  );
}

export function ThrowScreen({
  onThrow,
  plan,
  bonuses = [],
  timer,
  dieSize = 190,
}: {
  onThrow: (power: number, angle: number) => void;
  /** the winning plan, shown small at the top */
  plan?: string;
  /** e.g. [{label:"Brains", value:2}, {label:"Kai's idea", value:1}] */
  bonuses?: Bonus[];
  timer?: TimerSpec;
  dieSize?: number;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [thrown, setThrown] = useState<{ x: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const trail = useRef<{ x: number; y: number; t: number }[]>([]);
  const fire = (power: number, angle: number) => {
    if (thrown) return;
    setThrown({ x: angle * 140 });
    setDragging(false);
    onThrow(Math.round(power * 100) / 100, Math.round(angle * 100) / 100);
  };
  // stretch toward the throw while you pull it up
  const pull = Math.min(1, -drag.y / 160);
  const dieTransform = thrown
    ? `translate3d(${thrown.x}px, -95vh, 0) rotate(${thrown.x >= 0 ? 620 : -620}deg) scale(0.55)`
    : `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${drag.x / 4}deg) scale(${1 - pull * 0.06}, ${1 + pull * 0.1})`;
  return (
    <>
      {timer && !thrown && <Fuse {...timer} />}
      {!thrown && (
        <div className="pk-choices" style={{ gap: 10 }}>
          <Kicker tone="cyan">Your plan won</Kicker>
          {plan && (
            <p className="pk-quote">
              <small>The plan</small>“{plan}”
            </p>
          )}
          {bonuses.length > 0 && (
            <span className="pk-bonus">
              {bonuses.map((b, i) => (
                <span key={b.label} className="pk-chip" style={{ ["--i" as string]: i, ["--c" as string]: i % 2 ? "#c6ff2e" : "#3de7ff" } as React.CSSProperties}>
                  <b>{b.value >= 0 ? `+${b.value}` : `−${-b.value}`}</b> {b.label}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
      <div
        className={`pk-throw ${thrown ? "is-thrown" : ""}`}
        onPointerDown={(e) => {
          if (thrown) return;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          start.current = { x: e.clientX, y: e.clientY };
          trail.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
          setDragging(true);
          vibrate(8);
        }}
        onPointerMove={(e) => {
          if (!start.current || thrown) return;
          setDrag({ x: e.clientX - start.current.x, y: Math.min(0, e.clientY - start.current.y) });
          trail.current = [...trail.current.slice(-6), { x: e.clientX, y: e.clientY, t: performance.now() }];
        }}
        onPointerUp={(e) => {
          const s0 = start.current;
          start.current = null;
          setDragging(false);
          if (!s0 || thrown) return;
          const dx = e.clientX - s0.x;
          const dy = e.clientY - s0.y;
          const tr = trail.current;
          const a = tr[0];
          const b = tr[tr.length - 1];
          const dt = Math.max(16, (b?.t ?? 0) - (a?.t ?? 0));
          const vy = b && a ? (b.y - a.y) / dt : 0; // px per ms, negative = up
          if (Math.hypot(dx, dy) < 12) return fire(0.5, 0); // a tap still throws
          if (dy < -40 || vy < -0.35) return fire(Math.min(1, Math.max(0.15, -vy / 2.2)), Math.max(-1, Math.min(1, dx / (Math.abs(dy) + 60))));
          setDrag({ x: 0, y: 0 }); // too small: the die slides back
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDrag({ x: 0, y: 0 });
        }}
      >
        {thrown && <div className="pk-flash" aria-hidden />}
        {thrown && (
          <p className="pk-thrown-msg" role="status">
            Thrown!
            <small>Watch it land on the TV</small>
          </p>
        )}
        <p className="pk-throw-call">
          Swipe <b>up</b>
          <br />
          to throw
        </p>
        <div className="pk-chevs" aria-hidden>
          <Chevron />
          <Chevron />
          <Chevron />
        </div>
        <div className="pk-pad">
          <span className="pk-pad-glow" aria-hidden />
          <span className="pk-pad-ring" aria-hidden />
          <span className="pk-pad-ring" aria-hidden />
          <span className="pk-pad-ring" aria-hidden />
          <div
            className="pk-die"
            style={{
              transform: dieTransform,
              transition: thrown ? "transform 520ms cubic-bezier(0.2, 0.7, 0.3, 1)" : dragging ? "none" : "transform 380ms cubic-bezier(0.3, 1.8, 0.5, 1)",
            }}
          >
            <div className={thrown || dragging ? "" : "pk-die-bob"}>
              <D20 value={null} rolling={false} size={dieSize} />
            </div>
          </div>
        </div>
        <button className="pk-tapthrow" onClick={() => fire(0.5, 0)} disabled={!!thrown} style={{ opacity: thrown ? 0 : 1 }}>
          or tap to throw
        </button>
      </div>
    </>
  );
}
