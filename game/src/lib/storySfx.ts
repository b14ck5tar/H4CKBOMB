/**
 * Story sound effects (CD, Sun): 1-3 cues per slide, each tied to an action in the narration, in order ("Sam throws
 * the net" -> whoosh at "throws", then splash at "net"). Muse picks them in the EXISTING turn and ending calls (no
 * extra call, no wait); `word` is the 0-based index of the word the cue hangs on (the TV may also space them evenly
 * across the clip). Cues may overlap; they never interrupt or duck the narrator (the voice session owns the mix). The voice session owns the library (game/public/sfx/), this
 * id list and the playback (lib/sound/storySfx.ts); FEATURES.storySfx switches it on.
 */
// The fallback set (the house sound engine); the ElevenLabs library replaces it when its files are made.
export const STORY_SFX_IDS: readonly string[] = ["whoosh", "rumble", "crash", "heartbeat", "ticking-clock", "magic-shimmer", "drumroll"];

export type StorySfxCue = { id: string; word: number };

/** A valid id from the library, or "" (unknown ids and an empty library play nothing). */
export function pickStorySfx(x: unknown): string {
  const id = String(x ?? "").trim().toLowerCase();
  return id && STORY_SFX_IDS.includes(id) ? id : "";
}

/** The model's cues, cleaned: valid ids only, at most 3, in word order, no two on the same word. */
export function pickStorySfxCues(x: unknown): StorySfxCue[] {
  const list = Array.isArray(x) ? x : typeof x === "string" && x ? [{ id: x, word: 0 }] : [];
  const out: StorySfxCue[] = [];
  for (const c of list) {
    const id = pickStorySfx((c as StorySfxCue)?.id ?? c);
    const word = Math.max(0, Math.round(Number((c as StorySfxCue)?.word) || 0));
    if (id && !out.some((o) => o.word === word)) out.push({ id, word });
  }
  return out.sort((a, b) => a.word - b.word).slice(0, 3);
}
