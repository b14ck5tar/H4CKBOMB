"use client";
/**
 * Make your hero: describe one in a line (+ the optional "What's your secret talent?"), or grab a ready-made trading
 * card from the rail (one tap, instant). Same messages as before:
 *   onCreate({ text, skill, name })  ->  send("real", { skill, fear: "" }); send("concept", { text, name })
 *   onPick(heroId, name)              ->  send("pick", { heroId, name })
 * The join screen asks for the CHARACTER's name (CD), so `name` is always that: a custom hero is built around it
 * and never renamed, and a ready-made hero takes it too.
 */
import { useState } from "react";
import type { Hero } from "@/lib/types";
import { GameButton, Kicker, PrivacyLine, Say, vibrate } from "./kit";
import { HeroMini } from "./cards";

/** Placeholder heroes, one per table (picked by room code). People, not animals in uniform, and none of the ready-mades. */
export const HERO_PLACEHOLDERS = [
  "a substitute teacher who has never once been surprised",
  "a wedding planner who can calm any storm, even real ones",
  "a retired stunt double with very loud knees",
  "a tow-truck driver who can talk any car into starting",
  "a museum night guard who knows every painting's gossip",
  "a grandpa who has won every pie contest since 1981",
  "a karaoke host who can hit any note, mostly the wrong one",
  "a lost-and-found clerk who remembers every lost thing",
];

/** The same placeholder for everyone at one table, a different one at the next. */
export function placeholderFor(seed = "") {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HERO_PLACEHOLDERS[h % HERO_PLACEHOLDERS.length];
}
const CARD_COLORS = ["#ff2e7e", "#3de7ff", "#ffad3b", "#c6ff2e", "#b46bff", "#ff6b3d"];

export type ReadyHero = { id: string; pitch: string; hero: Hero };

export function MakeHeroScreen({
  readyMade,
  takenIds = [],
  onCreate,
  onPick,
  seed,
  defaultName = "",
}: {
  /** the character's name they joined with (the hero's name) */
  defaultName?: string;
  /** the room code: picks the placeholder hero line */
  seed?: string;
  readyMade: ReadyHero[];
  /** ready-made ids other players already took */
  takenIds?: string[];
  onCreate: (a: { text: string; skill: string; name: string }) => void;
  onPick: (heroId: string, name: string) => void;
}) {
  const name = defaultName;
  const [text, setText] = useState("");
  const [skill, setSkill] = useState("");
  const [chosen, setChosen] = useState("");
  const ex = `e.g. ${placeholderFor(seed)}`;
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
          onCreate({ text: text.trim(), skill: skill.trim(), name: name.trim() });
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
              // The character's name from the join screen goes on the ready-made card too.
              onPick(id, name.trim());
            }}
          />
        ))}
      </div>
      <PrivacyLine />
    </>
  );
}
