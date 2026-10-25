"use client";
/**
 * Watching (narration, ruling, someone else's roll, outcome, the ending…): never a dark phone. The scene the TV is
 * showing (small), the one line, the plan being ruled on, the latest thing that happened, the "Right now" goal with
 * the story ladder, and big reaction buttons that pop on the TV.
 *   text = nowText(state, me.id)      onReact(emoji)  ->  send("react", { emoji })
 */
import { Goal, Kicker, ReactionBar, Say, SceneThumb } from "./kit";

export function WatchingScreen({
  text,
  kicker = "Eyes up",
  art,
  plan,
  latest,
  goal,
  nowGoal,
  ladder,
  step,
  reactions,
  onReact,
}: {
  text: string;
  kicker?: string;
  /** the plate/painting the TV is showing */
  art?: string;
  /** the plan on the table right now (ruling / someone's roll) */
  plan?: { who: string; color?: string; text: string; idea?: string };
  /** the latest thing that happened (the last outcome, the ending), with its label */
  latest?: { label: string; text: string };
  goal?: string;
  nowGoal?: string;
  ladder?: string[];
  step?: number;
  reactions: readonly string[];
  onReact: (emoji: string) => void;
}) {
  return (
    <>
      <SceneThumb art={art} />
      <div className="pk-choices" style={{ gap: 10 }}>
        <Kicker tone="pink">{kicker}</Kicker>
        <Say text={text} small />
      </div>
      {plan && (
        <p className="pk-quote" style={{ ["--c" as string]: plan.color } as React.CSSProperties}>
          <small style={plan.color ? { color: plan.color } : undefined}>
            {plan.who}’s plan{plan.idea ? ` · + ${plan.idea}’s idea` : ""}
          </small>
          “{plan.text}”
        </p>
      )}
      {latest?.text && (
        <p className="pk-quote pk-latest">
          <small>{latest.label}</small>
          {latest.text}
        </p>
      )}
      <Goal goal={goal} nowGoal={nowGoal} ladder={ladder} step={step} />
      <ReactionBar reactions={reactions} onReact={onReact} big />
    </>
  );
}
