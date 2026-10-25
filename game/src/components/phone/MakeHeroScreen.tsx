"use client";
/**
 * Make your hero: describe one in a line (+ the optional "What's your secret talent?"), or grab a ready-made trading
 * card from the rail (one tap, instant). Same messages as before:
 *   onCreate({ text, skill })  ->  send("real", { skill, fear: "" }); send("concept", { text })
 *   onPick(heroId)             ->  send("pick", { heroId })
 */
import { useState } from "react";
import type { Hero } from "@/lib/types";
import { GameButton, Kicker, PrivacyLine, Say, vibrate } from "./kit";
import { HeroMini } from "./cards";

const EXAMPLES = [
  "a night-shift barista who can hear electricity",
  "a raccoon who works security at the mall",
  "a grandma who's been a ghost hunter since 1974",
  "a substitute teacher who is secretly a cryptid",
  "an influencer whose phone sees the future, badly",
];
const CARD_COLORS = ["#ff2e7e", "#3de7ff", "#ffad3b", "#c6ff2e", "#b46bff", "#ff6b3d"];

export type ReadyHero = { id: string; pitch: string; hero: Hero };

export function MakeHeroScreen({
  readyMade,
  takenIds = [],
  onCreate,
  onPick,
}: {
  readyMade: ReadyHero[];
  /** ready-made ids other players already took */
  takenIds?: string[];
  onCreate: (a: { text: string; skill: string }) => void;
  onPick: (heroId: string) => void;
}) {
  const [text, setText] = useState("");
  const [skill, setSkill] = useState("");
  const [chosen, setChosen] = useState("");
  const [ex] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
  return (
    <>
      <Kicker>Before the story</Kicker>
      <Say text="Make your *hero*" />
      <form
        className="pk-choices"
        style={{ gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          vibrate(20);
          onCreate({ text: text.trim(), skill: skill.trim() });
        }}
      >
        <label className="pk-field">
          <span className="pk-label">Describe them in one line</span>
          <textarea className="pk-input" style={{ minHeight: 92 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder={ex} />
        </label>
        <label className="pk-field">
          <span className="pk-label">
            What’s your secret talent? <small>optional</small>
          </span>
          <input className="pk-input" value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={80} placeholder="parallel parking, finding lost things" autoComplete="off" />
          <span className="pk-hint">It becomes your hero’s power. Your real answer stays secret until the end.</span>
        </label>
        <GameButton type="submit" disabled={!text.trim()}>
          Make my hero
        </GameButton>
      </form>

      <span className="pk-sec">Or grab a ready-made hero</span>
      <div className="pk-rail" role="list">
        {readyMade.map((q, i) => (
          <HeroMini
            key={q.id}
            id={q.id}
            hero={q.hero}
            pitch={q.pitch}
            color={CARD_COLORS[i % CARD_COLORS.length]}
            index={i}
            taken={takenIds.includes(q.id)}
            chosen={chosen === q.id}
            onPick={(id) => {
              vibrate(15);
              setChosen(id);
              onPick(id);
            }}
          />
        ))}
      </div>
      <PrivacyLine />
    </>
  );
}
