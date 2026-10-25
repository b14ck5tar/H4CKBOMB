"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { GameHost } from "@/lib/host";
import { isVoiceMuted, setVoiceMuted, speak, stopVoice } from "@/lib/narrate";
import type { GameState } from "@/lib/types";

/** What the narrator reads aloud for this moment ("" = nothing). Only the big moments: everything stays on screen. */
function lineFor(s: GameState) {
  if (s.busy) return "";
  switch (s.phase) {
    case "quest":
      return s.quest?.premise ?? "";
    case "narrating":
      return s.narration;
    case "epilogue":
      return s.epilogue;
    case "reveal":
      return s.reveal ? `This really happened. ${s.reveal.headline}. ${s.solvedBy}` : "";
    default:
      return "";
  }
}

/** Reads the story aloud on the device that hosts the game (the TV, or the host's phone), with an on/off toggle. */
export function Narrator({ host }: { host: GameHost }) {
  const s = useSyncExternalStore(host.subscribe, host.getState, host.getState);
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(isVoiceMuted()), []);

  const line = lineFor(s);
  const key = line ? `${s.phase}:${s.sceneIndex}:${line.slice(0, 60)}` : "";
  useEffect(() => {
    if (key && !muted) speak(line, s.rating);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- speak once per moment, not on every state change
  }, [key, muted]);
  useEffect(() => {
    if (s.phase === "lobby") stopVoice();
  }, [s.phase]);
  useEffect(() => () => stopVoice(), []);

  return (
    <button
      className="fixed bottom-3 left-16 z-40 btn btn-ghost !py-1 !px-3 text-sm"
      onClick={() => {
        setVoiceMuted(!muted);
        setMuted(!muted);
      }}
      aria-label={muted ? "Turn the narrator voice on" : "Turn the narrator voice off"}
    >
      {muted ? "🔇 Voice off" : "🗣️ Voice on"}
    </button>
  );
}
