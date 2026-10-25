"use client";

import { isAllMuted, isNarrating, isServer, isSilenced } from "./context";
import { music } from "./music";

/**
 * Time warnings (CD): about 10 s before a timer ends, the narrator nudges the table, pre-voiced in Sarah's Combo
 * voice (game/public/voice/nudge-N.mp3). Never the same one twice in a row; skipped if the narrator is already
 * speaking. With a name, a live "<Name>, ten seconds." reads first (Flash, ~0.3 s), else the next nudge.
 */
export const NUDGES = [
  "Now's the time to send what you've got.",
  "Not much time left. Make it quick.",
  "Ten seconds. Whatever you've got, send it.",
  "Clock's ticking, friends.",
  "Last call for brilliant ideas.",
  "Quick now. The story's waiting.",
];
let last = -1;

function play(src: string) {
  if (isNarrating() || isAllMuted() || isSilenced()) return;
  const a = new Audio(src);
  const undo = music.duckWhile(a); // the music dips under her, like any narrator line
  a.addEventListener("ended", undo, { once: true });
  a.addEventListener("error", undo, { once: true });
  a.play().catch(undo);
}

export async function playTimeWarning(name?: string) {
  if (isServer() || isNarrating() || isAllMuted() || isSilenced()) return;
  if (name) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${name}, ten seconds.`, voice: "vesper", style: "" }),
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) return play(URL.createObjectURL(await res.blob()));
    } catch {
      /* fall through to a pre-voiced nudge */
    }
  }
  let i = Math.floor(Math.random() * NUDGES.length);
  if (i === last) i = (i + 1) % NUDGES.length;
  last = i;
  play(`/voice/nudge-${i + 1}.mp3`);
}
