import type { Band, Ending, Stat, Tier } from "./types";

export const TIER_MOD: Record<Tier, number> = { clever: 3, solid: 0, risky: -3, absurd: -6, miracle: 0 };

export const TIER_LABEL: Record<Tier, string> = {
  clever: "CLEVER",
  solid: "SOLID",
  risky: "RISKY",
  absurd: "ABSURD",
  miracle: "ONLY A MIRACLE",
};

/** "Convince the DM": clever plans just work, no roll. Everything else is uncertain, so the dice decide. */
export function autoSucceeds(tier: Tier) {
  return tier === "clever";
}

/** Plain-language label on the stamp (no DC jargon for non-gamers). */
export function stampText(tier: Tier): string {
  switch (tier) {
    case "clever":
      return "THAT WORKS · NO ROLL";
    case "solid":
      return "SOLID · ROLL IT";
    case "risky":
      return "RISKY · ROLL IT";
    case "absurd":
      return "ABSURD · GOOD LUCK";
    case "miracle":
      return "ONLY A MIRACLE · NEED A 20";
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
  if (total >= 15) return tier === "absurd" ? "LEGENDARY" : "SUCCESS";
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
export const APPEAL_MS = 20_000;
export const ROLL_MS = 12_000;
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
