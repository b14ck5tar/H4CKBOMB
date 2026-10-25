"use client";

/** The sound system. See README.md in this folder for the integration calls. */
export { music, getMusic } from "./music";
export type { MusicEngine } from "./music";
export { playSfx, sfxName, SFX_NAMES } from "./sfx";
export type { SfxName, SfxOpts } from "./sfx";
export { MOODS, TRACK_IDS, TRACKS, toMood } from "./tracks";
export type { Mood, TrackId } from "./tracks";
export { unlockAudio, setAllMuted, isAllMuted, onSoundChange } from "./context";
export { useMusic, useDuckWhile, useSoundPrefs } from "./useMusic";
