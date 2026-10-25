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
