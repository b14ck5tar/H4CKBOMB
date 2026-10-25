"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isAllMuted, onSoundChange, setAllMuted } from "./context";
import { music } from "./music";
import type { Mood, TrackId } from "./tracks";

/**
 * Keep the music in step with the screen. Pass "lobby", a mood, any mood-ish word, or null to fade out.
 *   useMusic(s.phase === "lobby" ? "lobby" : storyMood);
 * Changing the value crossfades; the same value never restarts. Unmounting does NOT stop the music
 * (so a route change doesn't cause a gap); pass null for silence.
 */
export function useMusic(track: TrackId | Mood | string | null | undefined, intensity?: number) {
  useEffect(() => {
    if (track == null || track === "") return void music.stop();
    if (track === "lobby") music.startLobby();
    else music.startStory(track);
  }, [track]);
  useEffect(() => {
    if (intensity != null) music.setIntensity(intensity);
  }, [intensity]);
}

/** Duck the music while an <audio> element (the narrator) plays. */
export function useDuckWhile(audio: HTMLAudioElement | null | undefined) {
  useEffect(() => (audio ? music.duckWhile(audio) : undefined), [audio]);
}

type Prefs = { muted: boolean; musicMuted: boolean; volume: number; track: TrackId | null };
let snap: Prefs = { muted: false, musicMuted: false, volume: 0.8, track: null };
const serverSnap: Prefs = { muted: false, musicMuted: false, volume: 0.8, track: null };
function read(): Prefs {
  const next: Prefs = { muted: isAllMuted(), musicMuted: music.isMuted(), volume: music.getVolume(), track: music.current() };
  if (next.muted !== snap.muted || next.musicMuted !== snap.musicMuted || next.volume !== snap.volume || next.track !== snap.track) snap = next;
  return snap;
}

/** Live sound settings for a mute button / volume slider. */
export function useSoundPrefs() {
  const p = useSyncExternalStore(onSoundChange, read, () => serverSnap);
  return {
    ...p,
    toggleMuted: () => setAllMuted(!isAllMuted()),
    toggleMusic: () => music.toggleMute(),
    setVolume: (v: number) => music.setMasterVolume(v),
  };
}
