"use client";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sound";

/**
 * A one-line announcement slammed across the TV for ~2.5 s whenever `text` changes (the finale tie: "Tie! Mo's plan
 * wins the coin flip."). Never blocks: no pointer events, gone on its own.
 */
export function Banner({ text, ms = 2600 }: { text?: string; ms?: number }) {
  const [shown, setShown] = useState("");
  const last = useRef(text ?? "");
  useEffect(() => {
    const t = (text ?? "").trim();
    if (!t || t === last.current) {
      last.current = t;
      return;
    }
    last.current = t;
    setShown(t);
    playSfx("stamp", { volume: 0.7 });
    const h = setTimeout(() => setShown(""), ms);
    return () => clearTimeout(h);
  }, [text, ms]);
  if (!shown) return null;
  return (
    <div className="tvx-banner" role="status" aria-live="polite">
      <span key={shown} className="tvx-banner-txt">
        {shown}
      </span>
    </div>
  );
}

/** "10 s!": a small timer nudge near the top for ~2.2 s when `at` changes (state.nudge), naming the slow hero if any. */
export function NudgeChip({ at, name }: { at?: number; name?: string }) {
  const [on, setOn] = useState(0);
  const seen = useRef(0);
  useEffect(() => {
    if (!at || at === seen.current || Date.now() - at > 3000) return;
    seen.current = at;
    setOn(at);
    const h = setTimeout(() => setOn(0), 2200);
    return () => clearTimeout(h);
  }, [at]);
  if (!on) return null;
  return (
    <div className="tvx-nudge" role="status" aria-live="polite">
      <span key={on} className="tvx-nudge-txt">
        <b>10 s!</b>
        {name ? ` ${name}, lock it in` : " Lock it in"}
      </span>
    </div>
  );
}
