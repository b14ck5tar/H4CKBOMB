/**
 * Feature switches (DECISIONS.md, Sat ~6:30 PM: "simple core, silky and immersive, no new features").
 * Everything switched off keeps its code; the UI hides it and the game skips its phase cleanly.
 * Flip one to true to bring it back. Shared by the TV, the phones and the server.
 */
export const FEATURES = {
  /** Mirror, Mirror: secret guardians write one kind sentence at the end. CD: "the weak link". */
  mirror: false,
  /** 🔥 Boost a friend's plan for advantage. Breaks "no player can dominate". */
  boost: false,
  /** Catch!: spend your heart to re-roll a friend's fail. Not in real D&D. */
  catch: false,
  /** The Hope hearts on screen (the ending math still logs in DM's Notes). */
  hopeDisplay: false,
  /** Inspiration token for a creative plan (design/20). Not built yet. */
  inspiration: false,
  /** Winner takes one friend's help for +2 (design/20). Not built yet. */
  help: false,
  /** The 4-6 page storybook. Off = a short 1-2 page keepsake. */
  longStorybook: false,
  /** "Only you noticed…" secret clue box on phones. */
  clueBox: false,
  /** AI-written scene openers. Off = the hand-written scenes in seed_quests.json. */
  aiScenes: false,
  /** The narrator reads the story aloud (Gemini TTS, /api/tts). Off or failing = text only. */
  voice: true,
  /** Paint the party's heroes into each scene (server/art, muse-image edits, ~$0.01 each, cached). */
  heroArt: true,
  /** AI plan suggestions on phones (they made everyone's plans the same). */
  suggestions: false,
} as const;

export type Feature = keyof typeof FEATURES;
