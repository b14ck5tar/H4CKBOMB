import type { Band, Ending, Stat, Tier } from "./types";

/** d20 + stat + this. "Most reasonable plans are Solid" (design/20), and Solid should usually work. */
export const TIER_MOD: Record<Tier, number> = { clever: 4, solid: 2, risky: -1, wild: -3, miracle: 0 };

/**
 * design/24: the AI rates the plan at face value and the table sees the target before the roll ("Needs 12+").
 * The total (d20 + stat + bonuses) has to reach this. A miracle only works on a natural 20.
 */
export const TIER_DC: Record<Tier, number> = { clever: 9, solid: 11, risky: 14, wild: 17, miracle: 21 };

/** What the die itself has to show for the plan to fully work (2..20; a miracle always needs a 20). */
export function needOnDie(tier: Tier, mods: number) {
  if (tier === "miracle") return 20;
  return Math.max(2, Math.min(20, TIER_DC[tier] - mods));
}

/** Natural 20 always works (in the funniest way). Natural 1 always flops. Close misses work with a cost. */
export function judge(die: number, total: number, tier: Tier): Band {
  if (die === 1) return "CATASTROPHE";
  if (die === 20) return "LEGENDARY";
  if (tier === "miracle") return "FAIL";
  const dc = TIER_DC[tier];
  if (total >= dc) return "SUCCESS";
  if (total >= dc - 3) return "YES_BUT";
  return "FAIL";
}

export const TIER_LABEL: Record<Tier, string> = {
  clever: "CLEVER",
  solid: "SOLID",
  risky: "RISKY",
  wild: "WILD",
  miracle: "ONLY A MIRACLE",
};

/** "Clever = no roll" is gone (design/20): every winning plan rolls, clever is just the best modifier. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autoSucceeds(_tier: Tier) {
  return false;
}

/** Plain-language label on the stamp (no DC jargon for non-gamers). */
export function stampText(tier: Tier): string {
  switch (tier) {
    case "clever":
      return "CLEVER";
    case "solid":
      return "SOLID";
    case "risky":
      return "RISKY";
    case "wild":
      return "WILD";
    case "miracle":
      return "ONLY A MIRACLE";
  }
}

/** Stats keep their schema keys; players see modern names. */
export const STAT_LABEL: Record<Stat, string> = { brave: "Guts", clever: "Brains", charming: "Charm" };

export const BAND_LABEL: Record<Band, string> = {
  CATASTROPHE: "DISASTER",
  FAIL: "NOPE",
  YES_BUT: "YES, BUT…",
  SUCCESS: "IT WORKS",
  LEGENDARY: "LEGENDARY",
};

export function d20(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 20) + 1;
}

export function band(kept: number, total: number, tier: Tier): Band {
  if (kept === 1) return "CATASTROPHE";
  if (kept === 20) return "LEGENDARY";
  if (tier === "miracle") return "FAIL";
  if (total >= 15) return tier === "wild" ? "LEGENDARY" : "SUCCESS";
  if (total >= 10) return "YES_BUT";
  return "FAIL";
}

export function isFailure(b: Band) {
  return b === "FAIL" || b === "CATASTROPHE";
}

export function ending(total: number, hope: number): Ending {
  if (hope <= 0) return "GRIM_BUT_HILARIOUS";
  if (total >= 20) return "TRIUMPHANT";
  if (total >= 12) return "BITTERSWEET";
  return "GRIM_BUT_HILARIOUS";
}

/** The Final Roll's one shared die decides the ending the same way any roll does. */
export function endingFromBand(b: Band): Ending {
  if (b === "LEGENDARY" || b === "SUCCESS") return "TRIUMPHANT";
  if (b === "YES_BUT") return "BITTERSWEET";
  return "GRIM_BUT_HILARIOUS";
}

export const ENDING_LABEL: Record<Ending, string> = {
  TRIUMPHANT: "YOU DID IT",
  BITTERSWEET: "MOSTLY FINE",
  GRIM_BUT_HILARIOUS: "WELL, IT'S A STORY",
};

/** Neon set, readable on the dark UI. */
export const PLAYER_COLORS = ["#FF2E7E", "#3DE7FF", "#FFB648", "#2CF5C0", "#B98CFF", "#FF7A45"];

export const REACTIONS = ["😂", "🔥", "😱", "👏", "👀", "❤️"];

// Timers. Action phases end early when everyone has acted; reading phases advance on Continue or all-Ready.
export const PITCH_MS = 40_000;
/** One player's turn: everyone else suggests, the owner picks (design/24). */
export const TURN_MS = 60_000;
export const QUICK_TURN_MS = 40_000;
/** One action, ~140 characters. */
export const PLAN_MAX = 140;
export const VOTE_MS = 15_000;
export const STORY_VOTE_MS = 15_000;
export const RULING_MS = 3_500;
export const APPEAL_MS = 20_000;
export const ROLL_MS = 10_000;
export const CATCH_MS = 8_000;
export const FINAL_ROLL_MS = 14_000;
export const ROLL_ANIM_MS = 1_600;
export const HOPE_START = 3;
export const HOPE_MAX = 6;

/** Safety auto-advance for reading screens: ~150 wpm plus slack for laughing, never shorter than 7 s. */
export function readMs(text: string, min = 7000) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(min, words * 400 + 5000);
}

/** Narration reveals line by line at reading speed (~200 wpm). Shared by the table's timer and the TV's reveal. */
export const LINE_GAP_MS = 500;
/** Each scene opens on the art alone (plus its title) before the first line of narration. */
export const TITLE_BEAT_MS = 2500;
export function narrationLines(text: string) {
  return (text ?? "").split(/(?<=[.!?]["”]?)\s+/).map((l) => l.trim()).filter(Boolean);
}
export function lineMs(line: string) {
  const words = line.split(/\s+/).filter(Boolean).length;
  return Math.max(1400, words * 300) + LINE_GAP_MS;
}
/** How long the whole scene opener takes to reveal, plus a beat to finish reading the last line. */
export function narrationMs(narration: string, npcLine = "") {
  const lines = [...narrationLines(narration), ...(npcLine ? [npcLine] : [])];
  return lines.reduce((t, l) => t + lineMs(l), TITLE_BEAT_MS + 600) + 2200;
}
