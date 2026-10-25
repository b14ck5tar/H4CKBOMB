"use client";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sound";
import type { Css } from "./shared";

export interface LadderDotsProps {
  /** Number of ladder steps (s.ladder.length). The last one is the finale. */
  steps: number;
  /** The step the table is on (s.step, 0-based). */
  at: number;
  /** "Right now" objective shown next to the dots (s.nowGoal). */
  now?: string;
  /** The big goal, small, under it (s.goal). */
  goal?: string;
}

/** Story progress: gem steps on a neon rail, the current one pulses, the last one is the finale crown. */
export function LadderDots({ steps, at, now, goal }: LadderDotsProps) {
  const n = Math.max(2, steps);
  // a spark travels along the rail from the last step to the new one (from the start on first show)
  const [pair, setPair] = useState({ from: 0, to: at });
  if (pair.to !== at) setPair({ from: pair.to, to: at }); // derive "where the spark starts" during render
  const from = pair.from;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    playSfx("reveal", { volume: 0.35, pitch: 5 });
  }, [at]);
  const travel = Math.min(1.2, 0.35 + Math.abs(at - from) * 0.28);
  const rail: Css = { "--from": from, "--to": at, "--travel": `${travel}s` };
  return (
    <div className="tvx-ladder" aria-label={`Step ${at + 1} of ${n}`}>
      <div className="tvx-ladder-rail" style={rail}>
        <span key={`${from}-${at}`} className="tvx-spark-run" aria-hidden />
        {Array.from({ length: n }, (_, i) => {
          const state = i < at ? "done" : i === at ? "here" : "next";
          const last = i === n - 1;
          return (
            <span key={i} className={`tvx-rung ${state} ${last ? "is-final" : ""}`} style={{ ["--i" as string]: i, ["--arrive" as string]: `${travel}s` } as Css}>
              {last ? (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5z" />
                </svg>
              ) : (
                <i />
              )}
            </span>
          );
        })}
      </div>
      {(now || goal) && (
        <div className="tvx-ladder-txt">
          {now && (
            <p key={now} className="tvx-ladder-now">
              <span>Right now</span> {now}
            </p>
          )}
          {goal && <p className="tvx-ladder-goal">Goal: {goal}</p>}
        </div>
      )}
    </div>
  );
}

export interface DangerBarProps {
  /** Team danger, 0..max. */
  level: number;
  max?: number;
  label?: string;
}

/** Team danger: chunky slanted cells that heat from amber to red; the bar shudders at the top two levels. */
export function DangerBar({ level, max = 5, label = "Danger" }: DangerBarProps) {
  const lv = Math.max(0, Math.min(max, level));
  const hot = lv >= max - 1;
  const words = ["Calm", "Uneasy", "Tense", "Bad", "Very bad", "Doom"];
  const word = words[Math.round((lv / max) * (words.length - 1))];
  const last = useRef(lv);
  useEffect(() => {
    if (lv > last.current) playSfx("fail", { volume: 0.4, pitch: -5 });
    last.current = lv;
  }, [lv]);
  return (
    <div className={`tvx-danger ${hot ? "is-hot" : ""}`} aria-label={`${label}: ${lv} of ${max}`}>
      <span className="tvx-danger-label">{label}</span>
      <span className="tvx-danger-cells">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < lv ? "on" : ""} style={{ ["--i" as string]: i, ["--t" as string]: max > 1 ? i / (max - 1) : 1 } as Css} />
        ))}
      </span>
      <span key={word} className="tvx-danger-word">{word}</span>
    </div>
  );
}

/** Top HUD row: ladder on the left, danger on the right. Sits just under QuickTV's top bar. */
export function HudStrip({ ladder, danger }: { ladder?: LadderDotsProps; danger?: DangerBarProps }) {
  return (
    <div className="tvx-hud">
      {ladder && <LadderDots {...ladder} />}
      {danger && <DangerBar {...danger} />}
    </div>
  );
}
