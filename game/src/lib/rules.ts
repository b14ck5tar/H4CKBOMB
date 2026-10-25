import type { Band, Ending, Stat, Tier } from "./types";

/** d20 + stat + this. "Most reasonable plans are Solid" (design/20), and Solid should usually work. */
export const TIER_MOD: Record<Tier, number> = { clever: 4, solid: 2, risky: -1, wild: -3, miracle: 0 };

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
      return "CLEVER · +4";
    case "solid":
      return "SOLID · +2";
    case "risky":
      return "RISKY · −1";
    case "wild":
      return "WILD · −3";
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
export const VOTE_MS = 15_000;
export const STORY_VOTE_MS = 15_000;
export const RULING_MS = 4_500;
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
