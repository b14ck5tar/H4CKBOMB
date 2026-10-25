"use client";
import { useEffect, useRef } from "react";
import { playSfx } from "@/lib/sound";
import { CreditChip, Face, possessive, type Css } from "./shared";

export interface Suggestion {
  id: string;
  text: string;
  /** Who suggested it (the person's name, not the hero's). */
  by: string;
  color: string;
  portrait?: string;
}

export interface SuggestionBubblesProps {
  items: Suggestion[];
  /** The suggestion the turn owner used: it lights up and gets a credit chip. */
  pickedId?: string;
  /** Bonus for using a friend's idea (default +1). */
  bonus?: number;
  /** Optional heading above the column, e.g. "Ideas from the table". */
  title?: string;
  /** Play a pop when a new idea lands (default true). */
  sound?: boolean;
}

const TILT = [-3, 2.5, -1.5, 3];
const MAX = 4;

/** Friends' ideas fly in from the right as comic speech bubbles; the one that gets used earns "+ Sam's idea +1". */
export function SuggestionBubbles({ items, pickedId, bonus = 1, title = "Ideas from the table", sound = true }: SuggestionBubblesProps) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(items.map((x) => x.id));
      return;
    }
    items.forEach((x) => {
      if (!seen.current!.has(x.id)) {
        seen.current!.add(x.id);
        if (sound) playSfx("pick", { volume: 0.8 });
      }
    });
  }, [items, sound]);
  useEffect(() => {
    if (pickedId && sound) playSfx("success", { volume: 0.5 });
  }, [pickedId, sound]);
  const shown = items.slice(-MAX);
  return (
    <section className={`tvx-ideas ${pickedId ? "has-pick" : ""}`} aria-label={title}>
      {title && <p className="tvx-ideas-title">{title}</p>}
      {shown.map((x, i) => {
        const picked = x.id === pickedId;
        const style: Css = { "--c": x.color, "--tilt": `${TILT[i % TILT.length]}deg`, "--i": i };
        return (
          <div key={x.id} className={`tvx-bubble ${picked ? "is-picked" : ""}`} style={style}>
            <div className="tvx-bubble-body">
              <span className="tvx-bubble-who">
                <Face src={x.portrait} name={x.by} color={x.color} size={2.6} />
                {possessive(x.by)} idea
              </span>
              <p className="tvx-bubble-txt">&ldquo;{x.text}&rdquo;</p>
            </div>
            {picked && <CreditChip name={x.by} color={x.color} bonus={bonus} className="tvx-bubble-credit" />}
          </div>
        );
      })}
    </section>
  );
}
