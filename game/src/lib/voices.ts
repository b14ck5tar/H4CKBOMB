/**
 * The narrator cast (design/24 P5): five Gemini voices with placeholder persona names (TBD by the CD).
 * At game start the AI casts one voice for the story's mood and writes a one-line style prompt.
 */
export type VoiceId = "vesper" | "ash" | "juniper" | "hollis" | "wren" | "lark" | "rook";

export const VOICES: Record<VoiceId, { name: string; gemini: string; openai: string; kind: string; fits: string }> = {
  vesper: { name: "Vesper", gemini: "Sulafat", openai: "sage", kind: "female", fits: "warm, low, intimate; mysteries, eerie stories, late-night tales" },
  ash: { name: "Ash", gemini: "Charon", openai: "onyx", kind: "male", fits: "deep, smoky, calm; creepy stories, legends, big strange things" },
  juniper: { name: "Juniper", gemini: "Despina", openai: "coral", kind: "female", fits: "bright, gentle, smiling; nature, animals, kids' stories, happy news" },
  hollis: { name: "Hollis", gemini: "Algieba", openai: "ash", kind: "male", fits: "smooth, dry, documentary; science, space, nature documentaries" },
  wren: { name: "Wren", gemini: "Umbriel", openai: "ballad", kind: "neutral", fits: "easygoing, playful, light; silly stories, odd news, comedy" },
  lark: { name: "Lark", gemini: "Aoede", openai: "nova", kind: "female", fits: "clear, quick, warm; adventures, discoveries, strange science" },
  rook: { name: "Rook", gemini: "Fenrir", openai: "fable", kind: "male", fits: "storybook, expressive, knowing; folk tales, small towns, odd legends" },
};

export const VOICE_IDS = Object.keys(VOICES) as VoiceId[];

/**
 * The CD's direction for every OpenAI narration (after hearing samples: "a little robotic", "too slow"),
 * appended to the story's own style line.
 */
export const VOICE_DIRECTION =
  "Voice: low, velvety and intimate, like a late-night radio host telling a secret to a few people leaning in close. Tone: mysterious and alluring, quietly knowing, a hint of danger and a slow half-smile; never cheerful, never bubbly, never announcer-like. Delivery: a real human storyteller, not someone reading; vary pitch and rhythm naturally; lean softly on key words and let tension tighten on the last line. Pacing: BRISK, quick conversational speed, only tiny pauses, never slow.";

/** The house style when the casting call fails: the CD's original brief for the narrator. */
export const DEFAULT_CAST = {
  voice: "ash" as VoiceId,
  style: "Read this as a low, smoky, mysterious late-night storyteller: calm, a knowing half-smile, no excitement, no breaths",
};

export function isVoice(x: unknown): x is VoiceId {
  return typeof x === "string" && (VOICE_IDS as string[]).includes(x);
}
