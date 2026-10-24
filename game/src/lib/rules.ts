import type { Band, Ending, Stat, Tier } from "./types";

export const TIER_MOD: Record<Tier, number> = { clever: 3, solid: 0, risky: -3, absurd: -6, miracle: 0 };

export const TIER_LABEL: Record<Tier, string> = {
  clever: "CLEVER",
  solid: "SOLID",
  risky: "RISKY",
  absurd: "ABSURD",
  miracle: "ONLY A MIRACLE",
};

/** DC shown on the stamp: the d20 + stat needed for a clean success. */
export function stampText(tier: Tier): string {
  if (tier === "miracle") return "ONLY A MIRACLE · NAT 20";
  return `${TIER_LABEL[tier]} · DC ${15 - TIER_MOD[tier]}`;
}

export const STAT_LABEL: Record<Stat, string> = { brave: "Brave", clever: "Clever", charming: "Charming" };

export const BAND_LABEL: Record<Band, string> = {
  CATASTROPHE: "CATASTROPHE",
  FAIL: "FAILURE",
  YES_BUT: "YES, BUT…",
  SUCCESS: "SUCCESS",
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
  TRIUMPHANT: "A TRIUMPHANT ENDING",
  BITTERSWEET: "A BITTERSWEET ENDING",
  GRIM_BUT_HILARIOUS: "A GRIM (BUT HILARIOUS) ENDING",
};

export const PLAYER_COLORS = ["#A3282E", "#2E5E4E", "#C8952E", "#3B4A8C", "#7A3E8E", "#B5602A"];

export const REACTIONS = ["😂", "🔥", "😱", "🛡️", "🐉", "❤️"];

export const PITCH_MS = 25_000;
export const RESCUE_PITCH_MS = 30_000;
export const VOTE_MS = 12_000;
export const ROLL_MS = 10_000;
export const CATCH_MS = 6_000;
export const FINAL_ROLL_MS = 12_000;
export const ROLL_ANIM_MS = 1_800;
export const HOPE_START = 3;
export const HOPE_MAX = 6;
