import type { Band, Ending, Tier } from "./types";

/**
 * Graded outcomes, fail forward (CD, Sun): no pass/fail threshold and no "stay on the same step". Every roll moves the
 * story to a NEW situation: the ladder always advances one act per turn, and the roll decides whether that act arrives
 * as a worse, mixed, better or legendary branch (and, in the finale, the ending). Pure functions, shared by host.ts
 * (ladder), the UI (label) and the outcome prompt (grade, branch, meaning, depth).
 *
 *   final = d20 + stat + bonuses + tier shift, never below 1 (no upper cap: 20+ is legendary)
 *   a natural 1 is always DISASTER, a natural 20 always LEGENDARY (design/24: a great roll can save a dumb plan).
 *
 *   total   grade      branch     the next act arrives...
 *   1       DISASTER   worse      as a spectacular, funny disaster: the problem jumps somewhere worse
 *   2-5     SETBACK    worse      worse: the problem escalates (a new place or complication, higher stakes)
 *   6-9     PARTIAL    mixed      with a catch: half of it works, and a twist comes with it
 *   10-14   PROGRESS   better     on a good path: it works
 *   15-19   GREAT      better     on a great path, plus a small bonus the next hero can use
 *   20+     LEGENDARY  legendary  as a leap: better than anyone hoped, and the world reacts
 */

export type Grade = "DISASTER" | "SETBACK" | "PARTIAL" | "PROGRESS" | "GREAT" | "LEGENDARY";
export type Branch = "worse" | "mixed" | "better" | "legendary";

/** The tier shift the AI's ruling adds to the roll (a miracle needs a perfect roll in practice). */
// Sim (design/38): wild -5 made a die of 2-6 a DISASTER (21% of turns) and off-script plans missed 10 of 11, which
// breaks "the story follows you". The penalty for a far-fetched plan is capped at -3 (a miracle -4).
export const TIER_SHIFT: Record<Tier, number> = { clever: 3, solid: 0, risky: -2, wild: -3, miracle: -4 };

export type GradeResult = {
  grade: Grade;
  branch: Branch;
  /** Ladder steps to advance: always 1 (one act per turn; host clamps below the top step, which is the finale). */
  ladderDelta: 1;
  /** Short stamp for the TV ("SETBACK"). */
  label: string;
  /** One plain line on what this number means, for DM's Notes and the outcome prompt. */
  meaning: string;
  /** Where the total sits inside its range, 0 = bottom, 1 = top (the narrator shades the outcome with it). */
  depth: number;
  total: number;
  /** The older 5-band name, for code that still reads Band (isFailure, BAND_LABEL, fallbacks). */
  band: Band;
  /** The ending tier if this was the finale roll. */
  ending: Ending;
};

type Row = { grade: Grade; min: number; max: number; branch: Branch; band: Band; ending: Ending; label: string; meaning: string };
const ROWS: Row[] = [
  { grade: "DISASTER", min: 1, max: 1, branch: "worse", band: "CATASTROPHE", ending: "GRIM_BUT_HILARIOUS", label: "DISASTER", meaning: "a spectacular, funny disaster: the problem jumps somewhere worse" },
  { grade: "SETBACK", min: 2, max: 5, branch: "worse", band: "FAIL", ending: "GRIM_BUT_HILARIOUS", label: "UH OH", meaning: "it backfires: the problem escalates into a new place or complication, and the stakes rise" },
  { grade: "PARTIAL", min: 6, max: 9, branch: "mixed", band: "FAIL", ending: "BITTERSWEET", label: "SORT OF", meaning: "half of it works, and a twist comes with it" },
  { grade: "PROGRESS", min: 10, max: 14, branch: "better", band: "YES_BUT", ending: "TRIUMPHANT", label: "IT WORKS", meaning: "it works: a good path opens" },
  { grade: "GREAT", min: 15, max: 19, branch: "better", band: "SUCCESS", ending: "TRIUMPHANT", label: "GREAT", meaning: "it works really well: a great path opens, plus a small bonus the next hero can use" },
  { grade: "LEGENDARY", min: 20, max: Infinity, branch: "legendary", band: "LEGENDARY", ending: "TRIUMPHANT", label: "LEGENDARY", meaning: "better than anyone hoped: a leap forward, and the world reacts" },
];

/** d20 + stat + bonuses + the tier shift, never below 1. */
export function finalTotal(o: { die: number; stat: number; bonus?: number; tier: Tier }) {
  return Math.max(1, o.die + o.stat + (o.bonus ?? 0) + TIER_SHIFT[o.tier]);
}

/** The outcome for a final total. Pass the natural die to apply the natural 1 / natural 20 rule. */
export function gradeRoll(totalIn: number, natural?: number): GradeResult {
  let total = Math.max(1, Math.round(Number.isFinite(totalIn) ? totalIn : 1));
  if (natural === 20) total = Math.max(20, total);
  // DISASTER only on a natural 1 (sim, design/38): a low total from modifiers is a SETBACK at worst.
  if (natural === 1) total = 1;
  else if (total <= 1) total = 2;
  const row = ROWS.find((r) => total >= r.min && total <= r.max) ?? ROWS[ROWS.length - 1];
  const span = Number.isFinite(row.max) ? row.max - row.min : 0;
  const depth = span ? (total - row.min) / span : 1;
  return { grade: row.grade, branch: row.branch, ladderDelta: 1, label: row.label, meaning: row.meaning, depth, total, band: row.band, ending: row.ending };
}

/** The bad branches (the narrator never credits a friend's idea on these: a failure belongs to the hero who acted). */
export function isMiss(g: Grade) {
  return g === "DISASTER" || g === "SETBACK" || g === "PARTIAL";
}

/** The ladder step after a turn: one act forward, clamped below the top step (the top step is the grand finale). */
export function nextStep(step: number, ladderLength: number) {
  if (ladderLength < 2) return 0;
  return Math.min(ladderLength - 2, step + 1);
}
