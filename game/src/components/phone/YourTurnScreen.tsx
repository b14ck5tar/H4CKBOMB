"use client";
/**
 * YOUR TURN: a spotlight burst, the goal, the plan box, and your friends' ideas as cards. Tap an idea to use it: the
 * card gets a check, the box shows "Using Kai's idea ✕", and whatever you type rides along with it (+1, Kai gets the
 * credit). Tap the card again or ✕ to drop it.
 *   onPitch(text, creditId, parts)  ->  send("pitch", { text, creditId, own, idea })   text = both, joined to fit max
 *   onTyping  ->  send("typing")
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
  voice = false,
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
  onPitch: (text: string, creditId: string, parts: { own: string; idea: string }) => void;
  /** show the small "hold to speak" under the box (typing stays the default) */
  voice?: boolean;
  onTyping?: () => void;
  timer?: TimerSpec;
}) {
  const [text, setText] = useState("");
  const [credit, setCredit] = useState("");
  const [ex] = useState(() => PLAN_EXAMPLES[Math.floor(Math.random() * PLAN_EXAMPLES.length)]);
  const list = Object.entries(ideas);
  const creditPl = players.find((p) => p.id === credit);
  const creditName = shortName(creditPl?.hero?.name, 12) || "a friend";
  const picked = credit ? (ideas[credit] ?? "").trim() : "";
  const own = text.trim();
  // What the DM reads: your words plus the friend's idea (or just one of them), never more than `max`.
  const joined = picked && own && own !== picked ? `${own}, using ${creditName}'s idea: ${picked}` : own || picked;
  const plan = joined.length > max ? `${joined.slice(0, max - 1).trimEnd()}…` : joined;
  return (
    <form
      className="pk-choices"
      style={{ flex: 1, gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!plan) return;
        vibrate([20, 40, 30]);
        onPitch(plan, credit, { own, idea: picked });
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
        onChange={setText}
        max={max}
        onTyping={onTyping}
        onVoice={voice ? setText : undefined}
        placeholder={credit ? `Add your own spin (optional), or just hit GO` : `e.g. ${ex}`}
        using={credit ? { name: creditName, color: creditPl?.color, text: picked, onClear: () => setCredit("") } : undefined}
      />
      {list.length > 0 && (
        <>
          <span className="pk-sec">{credit ? "Friends suggest · using 1, +1" : "Friends suggest · tap one to use it, +1"}</span>
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
                    setCredit(on ? "" : pid);
                  }}
                >
                  <Face player={pl} src={heroImg(pl, pl ? portraitOf?.(pl) : undefined)} />
                  <span className="pk-plan-body">
                    <span className="pk-plan-who">{shortName(pl?.hero?.name) || "A friend"}</span>
                    <span className="pk-plan-txt">{idea}</span>
                  </span>
                  {on ? (
                    <span className="pk-plus pk-plus-on" aria-label="Using this idea">
                      ✓
                    </span>
                  ) : (
                    <span className="pk-plus pk-plus-ghost">+1</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="pk-bottom">
        <GameButton type="submit" tone="lime" xl disabled={!plan} sub={credit ? `+1 for ${creditName}’s idea` : undefined}>
          Go!
        </GameButton>
      </div>
    </form>
  );
}
