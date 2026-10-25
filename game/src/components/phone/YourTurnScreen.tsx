"use client";
/**
 * YOUR TURN: a spotlight burst, the goal, the plan box, and your friends' ideas as cards. Tap an idea to drop it in
 * the box: a "+1" chip pops and GO! credits them. Editing the text keeps the credit; clearing it drops it.
 *   onPitch(text, creditId)  ->  send("pitch", { text, creditId })        onTyping  ->  send("typing")
 */
import { useState } from "react";
import type { Player } from "@/lib/types";
import { shortName } from "@/lib/now";
import { Face, Fuse, GameButton, Goal, Kicker, PlanBox, Say, heroImg, vibrate, type TimerSpec } from "./kit";

const PLAN_EXAMPLES = [
  "I distract it with something it wants more",
  "I ask the person in charge for help",
  "I sneak around the back and look for a weak spot",
  "I use my knack for this, of course",
  "I make a deal with it",
];

export function YourTurnScreen({
  ideas,
  players,
  portraitOf,
  goal,
  nowGoal,
  ladder,
  step,
  max,
  onPitch,
  onTyping,
  timer,
}: {
  /** state.ideas: suggester id -> idea */
  ideas: Record<string, string>;
  players: Player[];
  /** painted portrait for a player without a ready-made pick (optional) */
  portraitOf?: (p: Player) => string | undefined;
  goal?: string;
  nowGoal?: string;
  ladder?: string[];
  step?: number;
  max: number;
  onPitch: (text: string, creditId: string) => void;
  onTyping?: () => void;
  timer?: TimerSpec;
}) {
  const [text, setText] = useState("");
  const [credit, setCredit] = useState("");
  const [ex] = useState(() => PLAN_EXAMPLES[Math.floor(Math.random() * PLAN_EXAMPLES.length)]);
  const list = Object.entries(ideas);
  const creditName = shortName(players.find((p) => p.id === credit)?.hero?.name, 12);
  return (
    <form
      className="pk-choices"
      style={{ flex: 1, gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        vibrate([20, 40, 30]);
        onPitch(text.trim(), credit);
      }}
    >
      {timer && <Fuse {...timer} />}
      <div className="pk-burst" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Kicker>Spotlight on you</Kicker>
        <Say text="*Your turn!* What do you do?" />
      </div>
      <Goal goal={goal} nowGoal={nowGoal} ladder={ladder} step={step} />
      <PlanBox
        value={text}
        onChange={(t) => {
          setText(t);
          if (!t.trim()) setCredit("");
        }}
        max={max}
        onTyping={onTyping}
        placeholder={`e.g. ${ex}`}
      />
      {list.length > 0 && (
        <>
          <span className="pk-sec">Friends suggest · tap to use, +1</span>
          <div className="pk-choices" style={{ gap: 10 }}>
            {list.map(([pid, idea], i) => {
              const pl = players.find((p) => p.id === pid);
              const on = credit === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  className={`pk-plan ${on ? "is-on" : ""}`}
                  style={{ ["--c" as string]: pl?.color ?? "#3de7ff", ["--i" as string]: i } as React.CSSProperties}
                  aria-pressed={on}
                  onClick={() => {
                    vibrate(on ? 8 : [10, 25, 10]);
                    if (on) {
                      setCredit("");
                      return;
                    }
                    setText(idea.slice(0, max));
                    setCredit(pid);
                  }}
                >
                  <Face player={pl} src={heroImg(pl, pl ? portraitOf?.(pl) : undefined)} />
                  <span className="pk-plan-body">
                    <span className="pk-plan-who">{shortName(pl?.hero?.name) || "A friend"}</span>
                    <span className="pk-plan-txt">{idea}</span>
                  </span>
                  {on ? <span className="pk-plus">+1</span> : <span className="pk-plus pk-plus-ghost">+1</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="pk-bottom">
        <GameButton type="submit" tone="lime" xl disabled={!text.trim()} sub={credit ? `+1 for ${creditName}’s idea` : undefined}>
          Go!
        </GameButton>
      </div>
    </form>
  );
}
