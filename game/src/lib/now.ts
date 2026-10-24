/**
 * The ONE instruction for each moment: the TV's "Now:" banner and the big line on every phone come from here,
 * so the room always hears the same thing. `me` is the phone's player id (omit it for the TV).
 */
import type { GameState } from "./types";

export function heroFirst(s: GameState, pid: string) {
  return s.players.find((p) => p.id === pid)?.hero?.name.split(" ")[0] ?? "Someone";
}

export function winnerPid(s: GameState) {
  return s.pitches.find((p) => p.id === s.winnerId)?.playerId ?? s.rolls[0]?.playerId ?? "";
}

export function nowText(s: GameState, me?: string): string {
  const w = winnerPid(s);
  const mine = !!me && w === me;
  switch (s.phase) {
    case "story_vote":
      return me && s.votes[me] ? "Story picked. Waiting for the others" : "Pick tonight's story on your phone";
    case "quest":
      return s.mode === "quick" ? "Eyes on the TV. This really happened" : "Here's tonight's story";
    case "narrating":
      return "Listen up. Plans in a moment";
    case "pitch":
      if (me && s.pitches.some((p) => p.playerId === me)) return "Plan in. Talk it over with the table";
      return "Type what your hero does on your phone";
    case "vote":
      if (me && s.votes[me]) return "Backed. Tap another to switch";
      return me ? "Back a friend's plan" : "Back a friend's plan on your phone";
    case "ruling":
      return mine ? "Your plan won! The DM is ruling on it" : `The DM rules on ${heroFirst(s, w)}'s plan`;
    case "roll":
      if (s.revealed.length) return "Here it comes";
      return mine ? "Tap ROLL!" : `${heroFirst(s, w)}, tap ROLL on your phone`;
    case "outcome":
      return "Here's what happened";
    case "final_roll": {
      const st = s.final?.stage;
      if (st === "arm") return me && s.final?.armed?.includes(me) ? "Armed. Wait for SHAKE" : "Everyone: tap ARM on your phone";
      if (st === "count") return "Get ready to shake";
      if (st === "shake") return "SHAKE your phone!";
      return "Here it comes";
    }
    case "final_result":
      return "The final roll";
    case "epilogue":
      return "How it ended";
    case "reveal":
      return "This really happened";
    case "storybook":
      return me ? "Your keepsake" : "Scan to take your tale home";
    default:
      return "Eyes on the TV";
  }
}
