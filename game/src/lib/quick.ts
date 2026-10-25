/**
 * Quick Tale: the ~3 minute judge demo. One scene from a real headline, everyone pitches, Convince the DM, roll,
 * then straight to the all-together Final Roll, a short ending slot, the reveal and the keepsake.
 * Shared by the host (timers) and the TV (choreography) so the two never drift apart.
 */

export const QUICK = {
  pitchMs: 30_000,
  appealMs: 15_000,
  rollMs: 10_000,
  /** Reading screens in Quick Tale never wait longer than this (Ready / Continue still skip sooner). */
  readCapMs: 16_000,
  beatCapMs: 10_000,
  epilogueMinMs: 9_000,
  revealMs: 10_000,
  /** The quest we preselect when Quick Tale is chosen (the 80-ton boulder: the demo script's story). */
  defaultQuest: "hanging-boulder",
} as const;

/** Cold open: fade up on the painted scene, type the real headline, then smash to the title card. */
export function coldOpenTimeline(headline: string) {
  const fadeIn = 900;
  const typeStart = 1500;
  const charMs = 30;
  const typeEnd = typeStart + headline.length * charMs;
  const titleAt = typeEnd + 1300;
  const total = titleAt + 3600;
  return { fadeIn, typeStart, charMs, typeEnd, titleAt, total };
}

/** Which pre-painted scene the TV shows behind each Quick Tale moment (0 = establishing, 2 = the climax). */
export function quickArtIndex(phase: string): number {
  if (phase === "quest") return 0;
  if (phase === "reveal") return 1;
  return 2;
}
