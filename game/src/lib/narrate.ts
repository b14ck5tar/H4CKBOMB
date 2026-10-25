"use client";
import type { Rating } from "./types";

// The narrator's voice: OpenAI TTS through /api/tts, falling back to the browser's built-in voice when there's
// no key, it's rate-limited or slow. One line at a time: a new line cuts off the old one.

const MUTE_KEY = "ouar-voice-muted";
const FETCH_MS = 9000;

let audio: HTMLAudioElement | null = null;
let audioUrl = "";
let token = 0;

export function isVoiceMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
  if (muted) stopVoice();
}

export function stopVoice() {
  token++;
  if (audio) {
    audio.pause();
    audio = null;
  }
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = "";
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

function browserSpeak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 0.95;
    synth.speak(u);
  } catch {}
}

export async function speak(text: string, rating: Rating) {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line || isVoiceMuted()) return;
  stopVoice();
  const mine = token;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: line, rating }),
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (mine !== token) return; // a newer line (or mute) arrived while this one was generating
    if (!res.ok) return browserSpeak(line);
    const blob = await res.blob();
    if (mine !== token) return;
    audioUrl = URL.createObjectURL(blob);
    audio = new Audio(audioUrl);
    await audio.play().catch(() => {}); // autoplay blocked until someone taps the page: stay silent, text is on screen
  } catch {
    if (mine === token) browserSpeak(line);
  }
}
