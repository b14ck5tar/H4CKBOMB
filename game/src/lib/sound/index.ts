"use client";

/** The sound system. See README.md in this folder for the integration calls. */
export { music, getMusic } from "./music";
export type { MusicEngine } from "./music";
export { CUE_NAMES } from "./cues";
export type { CueName, CueOpts } from "./cues";
export { playSfx, playResult, dice, sfxName, SFX_NAMES, GRADES } from "./sfx";
export type { SfxName, SfxOpts, Grade } from "./sfx";
export { MOODS, TRACK_IDS, TRACKS, toMood, layersFor } from "./tracks";
export type { Mood, TrackId } from "./tracks";
export { unlockAudio, setAllMuted, isAllMuted, onSoundChange } from "./context";
export { useMusic, useDuckWhile, useSoundPrefs } from "./useMusic";
export { STORY_SFX_IDS, pickStorySfx, playStorySfx, playStorySfxCues, preloadStorySfx, stopStorySfx } from "./storySfx";
