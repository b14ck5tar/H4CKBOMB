"use client";
/**
 * Someone else's turn: suggest ONE move for them, with their hero card on top so you play to their strengths.
 * After sending it becomes a sticky note you can change until they pick.
 *   onIdea(text)  ->  send("idea", { text })        onTyping  ->  send("typing")
 */
import { useState } from "react";
import type { Player } from "@/lib/types";
import { shortName } from "@/lib/now";
import { Fuse, GameButton, Goal, Kicker, LinkButton, PlanBox, Say, vibrate, type TimerSpec } from "./kit";
import { HeroRow } from "./cards";

export function SuggestScreen({
  owner,
  ownerPortrait,
  sent,
  goal,
  nowGoal,
  ladder,
  step,
  max,
  onIdea,
  onTyping,
  voice = false,
  timer,
}: {
  /** the turn owner (turnOwner(state)) */
  owner?: Player;
  ownerPortrait?: string;
  /** state.ideas[me.id] */
  sent?: string;
  goal?: string;
  nowGoal?: string;
  ladder?: string[];
  step?: number;
  /** TYPE_MAX */
  max: number;
  onIdea: (text: string) => void;
  onTyping?: () => void;
  /** show the small "hold to speak" under the box (typing stays the default) */
  voice?: boolean;
  timer?: TimerSpec;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const first = shortName(owner?.hero?.name) || "them";
  const showSent = !!sent && !editing;
  return (
    <>
      {timer && <Fuse {...timer} />}
      <Kicker tone="pink">{showSent ? "Idea sent" : `${first}’s turn`}</Kicker>
      <Say text={showSent ? `Now *${first}* picks` : `Suggest a move for *${first}*`} small />
      {owner && <HeroRow player={owner} portrait={ownerPortrait} label="You’re helping" />}
      {owner?.hero?.ability?.name && (
        <p className="pk-power">
          <b>{first}’s power:</b> {owner.hero.ability.name}
          {owner.hero.ability.text ? ` · ${owner.hero.ability.text}` : ""}
        </p>
      )}
      <Goal goal={goal} nowGoal={nowGoal} ladder={ladder} step={step} />
      {showSent ? (
        <>
          <p className="pk-note">
            <small>Your idea for {first}</small>“{sent}”
          </p>
          <p className="pk-hint" style={{ textAlign: "center" }}>
            If {first} uses it, their roll gets +1 and you get the credit.
          </p>
          <div className="pk-bottom">
            <LinkButton
              onClick={() => {
                setText(sent ?? "");
                setEditing(true);
              }}
            >
              Change it
            </LinkButton>
          </div>
        </>
      ) : (
        <form
          className="pk-choices"
          style={{ flex: 1 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            vibrate([15, 30, 15]);
            onIdea(text.trim());
            setEditing(false);
          }}
        >
          <PlanBox value={text} onChange={setText} max={max} onTyping={onTyping} placeholder={`What should ${first} do?`} hint="One action. Make it fit their hero." onVoice={voice ? setText : undefined} />
          <div className="pk-bottom">
            <GameButton type="submit" tone="cyan" disabled={!text.trim()}>
              Send my idea
            </GameButton>
          </div>
        </form>
      )}
    </>
  );
}
