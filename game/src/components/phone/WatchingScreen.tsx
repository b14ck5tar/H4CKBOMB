"use client";
/**
 * Watching (narration, ruling, someone else's roll, outcome…): a glowing TV, the one line, the current goal with the
 * story ladder, and a chunky reactions bar at the bottom.
 *   text = nowText(state, me.id)      onReact(emoji)  ->  send("react", { emoji })
 */
import { Goal, Kicker, ReactionBar, Say, TvGlyph } from "./kit";

export function WatchingScreen({
  text,
  kicker = "Eyes up",
  goal,
  nowGoal,
  ladder,
  step,
  reactions,
  onReact,
}: {
  text: string;
  kicker?: string;
  goal?: string;
  nowGoal?: string;
  ladder?: string[];
  step?: number;
  reactions: readonly string[];
  onReact: (emoji: string) => void;
}) {
  return (
    <>
      <div className="pk-choices pk-center" style={{ gap: 12, paddingTop: 4 }}>
        <TvGlyph />
        <Kicker tone="pink">{kicker}</Kicker>
        <Say text={text} small />
      </div>
      <Goal goal={goal} nowGoal={nowGoal} ladder={ladder} step={step} />
      <ReactionBar reactions={reactions} onReact={onReact} />
    </>
  );
}
