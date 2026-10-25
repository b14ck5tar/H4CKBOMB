"use client";
/**
 * Pick tonight's story: three fantasy quest cards dealt in (never the real headline). Tap one: it lifts, gets a
 * YOUR PICK stamp, and your color dot joins the others who picked it. Tap another to switch.
 *   onVote(id)  ->  send("vote", { id })
 */
import type { Player } from "@/lib/types";
import { Fuse, Kicker, Pips, Say, vibrate, type TimerSpec } from "./kit";

export type QuestOption = { id: string; title: string; teaser: string; art?: string };

export function QuestVoteScreen({
  options,
  votes,
  players,
  meId,
  onVote,
  timer,
}: {
  options: QuestOption[];
  /** state.votes: voter id -> option id */
  votes: Record<string, string>;
  players: Player[];
  meId: string;
  onVote: (id: string) => void;
  timer?: TimerSpec;
}) {
  const mine = votes[meId];
  const tones = ["#3de7ff", "#ff2e7e", "#ffad3b", "#c6ff2e"];
  return (
    <>
      {timer && <Fuse {...timer} />}
      <Kicker tone="cyan">Vote</Kicker>
      <Say text={mine ? "Picked! *Switch* any time" : "Pick tonight’s *quest*"} small />
      <div className={`pk-choices ${mine ? "has-pick" : ""}`}>
        {options.map((o, i) => {
          const on = mine === o.id;
          const voters = players.filter((p) => votes[p.id] === o.id);
          return (
            <button
              key={o.id}
              type="button"
              className={`pk-quest ${on ? "is-on" : ""}`}
              style={{ ["--c" as string]: tones[i % tones.length], ["--i" as string]: i } as React.CSSProperties}
              aria-pressed={on}
              onClick={() => {
                vibrate(on ? 8 : [12, 30, 18]);
                onVote(o.id);
              }}
            >
              <span className="pk-quest-in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {o.art && <img className="pk-quest-art" src={o.art} alt="" />}
                <Pips n={i + 1} color={tones[i % tones.length]} className="pk-quest-no" />
                <span className="pk-voters" aria-label={`${voters.length} picked this`}>
                  {voters.map((p) => (
                    <i key={p.id} style={{ ["--vc" as string]: p.color } as React.CSSProperties} />
                  ))}
                </span>
                <span className="pk-quest-t">{o.title}</span>
                <span className="pk-quest-d">{o.teaser}</span>
                {on && <span className="pk-stamp">Your pick</span>}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
