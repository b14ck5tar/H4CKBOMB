"use client";
import { useEffect, useRef, useState } from "react";
import type { Css } from "./shared";
import { flashScreen, shakeStage } from "./motion";

export type PayoffTone = "up" | "mixed" | "down";

export interface PayoffPunchProps {
  /** When the finale's payoff hit lands (ms epoch). The punch fires each time this changes; 0/undefined = nothing. */
  at?: number;
  tone?: PayoffTone;
  /** The ending word slammed for a beat, e.g. "TRIUMPHANT". */
  word?: string;
}

const LOOK: Record<PayoffTone, { flash: string; colors: string[]; shake: number }> = {
  up: { flash: "rgba(255,214,80,0.42)", colors: ["#ffd23f", "#3de7ff", "#c6ff2e", "#ff2e7e"], shake: 1 },
  mixed: { flash: "rgba(44,245,192,0.34)", colors: ["#2cf5c0", "#3de7ff", "#ffad3b"], shake: 0.6 },
  down: { flash: "rgba(255,46,126,0.4)", colors: ["#ff2e7e", "#ff6b3d", "#b46bff"], shake: 1.2 },
};
const BITS = 22;

/**
 * The finale's payoff, on the TV: a flash, a shake, the ending word slammed big and a burst in the ending's colors,
 * all in ~1.1 s and then gone (the narration underneath is covered only for that beat). Synced to the payoff sound:
 * the host stamps `at` when the hit plays. Render inside <TvStage> so the shake reaches the stage.
 */
export function PayoffPunch({ at, tone = "up", word }: PayoffPunchProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState(0);
  const seen = useRef(0);
  useEffect(() => {
    // Only a fresh hit (a TV that joins late or re-renders never replays an old one).
    if (!at || at === seen.current || Date.now() - at > 3000) return;
    seen.current = at;
    const look = LOOK[tone];
    setShot((n) => n + 1);
    flashScreen(ref.current, look.flash, 500);
    shakeStage(ref.current, look.shake);
    const t = setTimeout(() => setShot(0), 1150);
    return () => clearTimeout(t);
  }, [at, tone]);
  const look = LOOK[tone];
  return (
    <div ref={ref} className="tvx-payoff" aria-hidden>
      {shot > 0 && (
        <div key={shot} className={`tvx-payoff-in is-${tone}`}>
          {word && (
            <span className="tvx-payoff-word" style={{ ["--pc" as string]: look.colors[0] } as Css}>
              {word}
            </span>
          )}
          <span className="tvx-payoff-burst">
            {Array.from({ length: BITS }, (_, k) => (
              <i key={k} style={{ ["--a" as string]: `${(k * 360) / BITS + (k % 3) * 6}deg`, ["--r" as string]: 14 + (k % 5) * 5, ["--cc" as string]: look.colors[k % look.colors.length] } as Css} />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
