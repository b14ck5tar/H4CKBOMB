/**
 * The narrator cast (the CD's final four): OpenAI voices first, Gemini as the fallback. Persona names are placeholders.
 * At game start the AI casts one voice for the story's mood and writes a one-line style prompt.
 */
export type VoiceId = "vesper" | "juniper" | "hollis" | "wren";

export const VOICES: Record<VoiceId, { name: string; gemini: string; openai: string; kind: string; fits: string }> = {
  vesper: { name: "Vesper", gemini: "Sulafat", openai: "sage", kind: "female", fits: "warm, low, intimate; mysteries, eerie stories, late-night tales" },
  juniper: { name: "Juniper", gemini: "Despina", openai: "coral", kind: "female", fits: "bright, gentle, smiling; nature, animals, kids' stories, happy news" },
  hollis: { name: "Hollis", gemini: "Algieba", openai: "ash", kind: "male", fits: "smooth, dry, documentary; science, space, nature documentaries" },
  wren: { name: "Wren", gemini: "Umbriel", openai: "ballad", kind: "neutral", fits: "easygoing, playful, light; silly stories, odd news, comedy" },

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
