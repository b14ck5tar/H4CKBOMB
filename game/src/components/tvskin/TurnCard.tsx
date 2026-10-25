"use client";
import { useEffect, useRef } from "react";
import { playSfx } from "@/lib/sound";
import { D20Glyph, HeroTradingCard, possessive, type CardHero, type Css } from "./shared";
import { Letters, flashScreen } from "./motion";

export interface TurnCardProps {
  hero: CardHero;
  /** The real person behind the hero ("played by Jay"). */
  playedBy: string;
  turn?: { n: number; of: number };
  /** One short instruction line, e.g. "Everyone else: suggest a move on your phone". */
  prompt?: string;
  /** Key the slam-in to the turn (pass the player id) so it replays each turn. */
  k?: string;
  /** Play the slam sound (default true). */
  sound?: boolean;
}

const IMPACT_MS = 470; // when the card lands (52% of the 0.9 s tvx-card-slam)

/**
 * "GUS'S TURN · played by Jay". The trading card drops in with squash-and-stretch and a light flash on impact, the
 * name punches in letter by letter, "TURN!" stamps, "played by" slides, then the card idles with a gentle float.
 */
export function TurnCard(props: TurnCardProps) {
  return <TurnCardInner key={props.k ?? props.hero.name} {...props} />;
}

function TurnCardInner({ hero, playedBy, turn, prompt, sound = true }: TurnCardProps) {
  const name = possessive(hero.name).toUpperCase();
  // Shrink long names so the title never collides with the suggestion column (title box is ~30u wide, in the
  // bottom-left corner so the middle of the painting stays clear).
  const size = Math.min(5.6, 29 / Math.max(4, name.length * 0.47));
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      flashScreen(ref.current, `color-mix(in srgb, ${hero.color} 55%, white)`, 480);
      if (sound) playSfx("turnStart");
    }, IMPACT_MS);
    return () => clearTimeout(t);
  }, [hero.color, sound]);
  const style: Css = { "--c": hero.color, "--ts": size };
  const nameStart = 0.5;
  const step = 0.045;
  const wordAt = nameStart + name.length * step + 0.05;
  return (
    <section ref={ref} className="tvx-turn" style={style} aria-label={`${hero.name}'s turn, played by ${playedBy}`}>
      <div className="tvx-turn-drop">
        <div className="tvx-float">
          <HeroTradingCard hero={hero} size={11} tilt={-5} className="tvx-turn-card" />
        </div>
        <span className="tvx-turn-dust" aria-hidden />
      </div>
      <div className="tvx-turn-txt">
        {turn && (
          <span className="tvx-turn-n">
            <D20Glyph label={String(turn.n)} className="tvx-turn-d20" />
            Turn {turn.n} of {turn.of}
          </span>
        )}
        <h2 className="tvx-turn-title" aria-hidden>
          <span className="tvx-turn-name">
            <Letters text={name} start={nameStart} step={step} />
          </span>
          <span className="tvx-turn-word" style={{ animationDelay: `${wordAt}s` }}>
            turn!
          </span>
        </h2>
        <p className="tvx-turn-by" style={{ animationDelay: `${wordAt + 0.25}s` }}>
          played by <b>{playedBy}</b>
        </p>
        {prompt && (
          <p className="tvx-turn-prompt" style={{ animationDelay: `${wordAt + 0.5}s` }}>
            {prompt}
          </p>
        )}
      </div>
    </section>
  );
}
