"use client";
import { D20Glyph, HeroTradingCard, possessive, type CardHero, type Css } from "./shared";

export interface TurnCardProps {
  hero: CardHero;
  /** The real person behind the hero ("played by Jay"). */
  playedBy: string;
  turn?: { n: number; of: number };
  /** One short instruction line, e.g. "Everyone else: suggest a move on your phone". */
  prompt?: string;
  /** Key the slam-in to the turn (pass the player id) so it replays each turn. */
  k?: string;
}

/** "GUS'S TURN · played by Jay": the hero trading card swings in at the left, the title slams next to it. */
export function TurnCard({ hero, playedBy, turn, prompt, k }: TurnCardProps) {
  const name = possessive(hero.name).toUpperCase();
  // Shrink long names so the title never collides with the suggestion column (title box is ~34u wide).
  const size = Math.min(8.2, 34 / Math.max(4, name.length * 0.47));
  const style: Css = { "--c": hero.color, "--ts": size };
  return (
    <section key={k} className="tvx-turn" style={style} aria-label={`${hero.name}'s turn, played by ${playedBy}`}>
      <HeroTradingCard hero={hero} size={15.5} tilt={-5} className="tvx-turn-card" />
      <div className="tvx-turn-txt">
        {turn && (
          <span className="tvx-turn-n">
            <D20Glyph label={String(turn.n)} className="tvx-turn-d20" />
            Turn {turn.n} of {turn.of}
          </span>
        )}
        <h2 className="tvx-turn-title">
          <span className="tvx-turn-name">{name}</span>
          <span className="tvx-turn-word">turn!</span>
        </h2>
        <p className="tvx-turn-by">
          played by <b>{playedBy}</b>
        </p>
        {prompt && <p className="tvx-turn-prompt">{prompt}</p>}
      </div>
    </section>
  );
}
