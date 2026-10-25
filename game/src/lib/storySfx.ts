/**
 * One sound effect per story slide (CD, Sun): Muse picks an id from this list in the EXISTING turn and ending calls
 * (no extra call, no wait), the TV plays /sfx/<id>.mp3 when the line shows, and DM's Notes logs the pick.
 * The voice session owns the library (game/public/sfx/) and this list; FEATURES.storySfx switches it on.
 */
export const STORY_SFX_IDS: readonly string[] = [];

/** A valid id from the library, or "" (unknown ids and an empty library play nothing). */
export function pickStorySfx(x: unknown): string {
  const id = String(x ?? "").trim().toLowerCase();
  return id && STORY_SFX_IDS.includes(id) ? id : "";
}
