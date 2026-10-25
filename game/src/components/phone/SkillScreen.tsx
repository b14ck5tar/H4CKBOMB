"use client";
/**
 * The one join question (for a ready-made hero): "What's your secret talent?" It becomes the hero's power and
 * stays private until the reveal.   onAnswer(skill)  ->  send("real", { skill, fear: "" })   (Skip sends "").
 */
import { useState } from "react";
import type { Player } from "@/lib/types";
import { GameButton, Kicker, LinkButton, PrivacyLine, Say, vibrate } from "./kit";
import { HeroRow } from "./cards";

const IDEAS = ["parallel parking", "finding lost things", "talking to dogs", "remembering birthdays", "fixing printers"];

export function SkillScreen({ me, portrait, onAnswer }: { me?: Player | null; portrait?: string; onAnswer: (skill: string) => void }) {
  const [skill, setSkill] = useState("");
  return (
    <form
      className="pk-choices"
      style={{ gap: 16, flex: 1 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!skill.trim()) return;
        vibrate(15);
        onAnswer(skill.trim());
      }}
    >
      <Kicker tone="cyan">One quick question</Kicker>
      <Say text="What’s your *secret talent?*" />
      {me?.hero && <HeroRow player={me} portrait={portrait} label="Your hero gets your talent" />}
      <label className="pk-field">
        <input className="pk-input" value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={80} placeholder={IDEAS[0]} autoComplete="off" aria-label="Your secret talent" />
        <span className="pk-bonus" style={{ marginTop: 4 }}>
          {IDEAS.slice(1).map((x, i) => (
            <button key={x} type="button" className="pk-chip" style={{ ["--i" as string]: i, ["--c" as string]: "#b46bff", cursor: "pointer", border: 0 } as React.CSSProperties} onClick={() => setSkill(x)}>
              {x}
            </button>
          ))}
        </span>
      </label>
      <p className="pk-hint">It stays secret until the very end, when the TV reveals who solved it.</p>
      <div className="pk-bottom">
        <GameButton type="submit" tone="lime" disabled={!skill.trim()}>
          Save my talent
        </GameButton>
        <LinkButton onClick={() => onAnswer("")}>Skip</LinkButton>
        <PrivacyLine />
      </div>
    </form>
  );
}
