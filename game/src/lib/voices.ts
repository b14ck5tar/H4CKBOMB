/**
 * The narrator cast: vesper, hollis and wren are cast (the CD dropped juniper on Sun AM; it stays a valid id so old
 * data still reads). ElevenLabs voices live in server/tts.ts; these are the OpenAI and Gemini fallbacks.
 * At game start the AI casts one voice for the story's mood and writes a one-line style prompt.
 */
export type VoiceId = "vesper" | "juniper" | "hollis" | "wren";

// The CD's pool (Sun): sage, coral, fable, and shimmer on tts-1-hd (very real-sounding; that model takes no
// `instructions`). onyx, ash and ballad are out. One narrator per game, cast per story.
export const VOICES: Record<VoiceId, { name: string; gemini: string; openai: string; model?: string; kind: string; fits: string }> = {
  vesper: { name: "Vesper", gemini: "Sulafat", openai: "sage", kind: "female", fits: "warm, low, intimate; mysteries, eerie stories, late-night tales" },
  juniper: { name: "Juniper", gemini: "Despina", openai: "coral", kind: "female", fits: "bright, gentle, smiling; nature, animals, kids' stories, happy news" },
  hollis: { name: "Hollis", gemini: "Algieba", openai: "fable", kind: "male", fits: "a fireside storyteller with a twinkle; fables, small-town oddities, science and nature" },
  wren: { name: "Wren", gemini: "Umbriel", openai: "shimmer", model: "tts-1-hd", kind: "female", fits: "clear, natural and real; everyday mishaps, true personal stories, comedy" },

};

export const VOICE_IDS = Object.keys(VOICES) as VoiceId[];

/**
 * The CD's direction for every OpenAI narration (after hearing samples: "a little robotic", "too slow"),
 * appended to the story's own style line.
 */
export const VOICE_DIRECTION =
  "Expressive, emotionally alive storyteller: real wonder, suspense and comic timing; leans in on surprises, lets a smile show on funny lines, drops low and tense on danger; mysterious and alluring, never flat, never announcer-like; natural pauses.";

/** The house style when the casting call fails: the CD's original brief for the narrator. */
export const DEFAULT_CAST = {
  voice: "vesper" as VoiceId,
  style: "Read this as a low, smoky, mysterious late-night storyteller: calm, a knowing half-smile, no excitement, no breaths",
};

export function isVoice(x: unknown): x is VoiceId {
  return typeof x === "string" && (VOICE_IDS as string[]).includes(x);
}
