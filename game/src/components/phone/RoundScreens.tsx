"use client";
/**
 * Between games, on the phone.
 *   RemovedScreen  the host took you out of the lobby (state.kicked has your id): say so, offer Rejoin.
 *   AgainScreen    back in the lobby after a finished story, still holding your hero: ready for another round, or
 *                  make a new hero ("newhero" intent).
 */
import type { Player } from "@/lib/types";
import { Face, GameButton, Kicker, Say, vibrate } from "./kit";

export function RemovedScreen({ onRejoin }: { onRejoin: () => void }) {
  return (
    <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 16 }}>
      <Kicker tone="pink">The lobby</Kicker>
      <Say text="You were *removed* from the lobby" />
      <p className="pk-hint pk-hint-bright">No hard feelings. Tap to jump back in.</p>
      <GameButton
        tone="lime"
        xl
        onClick={() => {
          vibrate(20);
          onRejoin();
        }}
      >
        Rejoin
      </GameButton>
    </div>
  );
}

export function AgainScreen({ me, portrait, onNewHero }: { me: Player; portrait?: string; onNewHero: () => void }) {
  return (
    <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 16 }}>
      <Kicker tone="lime">Back at the table</Kicker>
      <Say text="Ready for *another round*!" />
      {me.hero && (
        <p className="pk-again-hero">
          <Face player={me} src={portrait} />
          <span>
            Playing as <b>{me.hero.name}</b>
          </span>
        </p>
      )}
      <p className="pk-hint pk-hint-bright">The TV starts the next story.</p>
      <GameButton
        tone="cyan"
        onClick={() => {
          vibrate(15);
          onNewHero();
        }}
      >
        Make a new hero
      </GameButton>
    </div>
  );
}
