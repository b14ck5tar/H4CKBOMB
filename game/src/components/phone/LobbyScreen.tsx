"use client";
/**
 * Waiting in the lobby: your hero as a holo trading card (flips in), "Look at the TV", and who else is in.
 * While a described hero is still being written/painted, the card shows its back.
 *   onRedraw  ->  send("redraw")
 */
import type { Player } from "@/lib/types";
import { Kicker, LinkButton, Say } from "./kit";
import { HeroTCG } from "./cards";

export function LobbyScreen({
  me,
  portrait,
  players = [],
  onRedraw,
}: {
  me: Player;
  portrait?: string;
  /** everyone at the table (dots along the bottom) */
  players?: Player[];
  onRedraw?: () => void;
}) {
  const building = !me.hero;
  const n = Math.max(1, players.findIndex((p) => p.id === me.id) + 1);
  return (
    <>
      <Kicker tone={building ? "amber" : "lime"}>{building ? "Hang tight" : "You’re in!"}</Kicker>
      <Say text={building ? "Your hero is being *drawn*" : "Look at the *TV*"} small />
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "6px 0 10px" }}>
        <HeroTCG player={me} portrait={me.hero ? portrait : undefined} number={n} tag={me.pick ? "Ready-made" : "Original"} />
      </div>
      {players.length > 0 && (
        <div className="pk-goal" style={{ boxShadow: "inset 4px 0 0 #3de7ff, 0 10px 24px rgba(0,0,0,.45)" }}>
          <span className="pk-goal-top" style={{ color: "#3de7ff" }}>
            At the table
            <span className="pk-table-dots">
              {players.map((p) => (
                <i key={p.id} style={{ ["--vc" as string]: p.color } as React.CSSProperties} title={p.name} />
              ))}
            </span>
          </span>
          <span className="pk-goal-txt" style={{ fontSize: "1.05rem" }}>
            {players.length} {players.length === 1 ? "hero" : "heroes"}. The story starts from the TV.
          </span>
        </div>
      )}
      {onRedraw && !building && <LinkButton onClick={onRedraw}>Pick a different hero</LinkButton>}
    </>
  );
}
