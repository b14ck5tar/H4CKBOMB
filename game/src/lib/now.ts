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
    case "story_write":
      if (me) return s.written.includes(me) ? "Sent. It stays secret until the end" : "Write a small true story from your life";
      return "Everyone: write a small true story on your phone";
    case "story_vote":
      return me && s.votes[me] ? "Story picked. Waiting for the others" : "Pick tonight's story on your phone";
    case "quest":
      return s.mode === "quick" ? "Eyes on the TV. This really happened" : "Here's tonight's story";
    case "narrating":
      return "Listen up. Plans in a moment";
    case "turn": {
      const owner = s.turnOrder[s.turnIndex] ?? "";
      if (me === owner) return "Your turn! What do you do?";
      if (me) return s.ideas[me] ? `Idea sent. ${heroFirst(s, owner)} picks` : `Suggest a move for ${heroFirst(s, owner)}`;
      return `${heroFirst(s, owner)}'s turn. Everyone else: suggest a move on your phone`;
    }
    case "pitch":
      if (me && s.pitches.some((p) => p.playerId === me)) return "Final move in. Talk it over";
      return s.finale ? "Grand finale: everyone types the final move" : "Type what your hero does on your phone";
    case "vote":
      if (me && s.votes[me]) return "Backed. Tap another to switch";
      return me ? "Back a friend's plan" : "Back a friend's plan on your phone";
    case "ruling":
      return mine ? "The DM is ruling on your plan" : `The DM rules on ${heroFirst(s, w)}'s plan`;
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
      return "This really happened. Look at the TV";
    case "storybook":
      return me ? "Your keepsake" : "Scan to take your tale home";
    default:
      return "Eyes on the TV";
  }
}

/** Finale plans anyone can back: every plan someone actually made (never your own, enforced by the phone). */
export function eligibleIds(s: GameState) {
  const real = s.pitches.filter((p) => !p.auto);
  return new Set((real.length ? real : s.pitches).map((p) => p.id));
}

/** Which pre-painted plate (0, 1, 2) is behind this moment: the story moves through them as the turns go by. */
export function plateFor(s: GameState) {
  if (s.mode === "quick") return 2;
  if (s.phase === "quest" || s.phase === "narrating") return 0;
  if (s.finale || ["final_roll", "final_result", "epilogue", "reveal", "storybook"].includes(s.phase)) return 2;
  const n = Math.max(1, s.turnOrder.length);
  return Math.min(2, Math.floor((s.turnIndex * 3) / (n + 1)));
}

export function turnOwner(s: GameState) {
  return s.turnOrder[s.turnIndex] ?? "";
}
