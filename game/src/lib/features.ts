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
  /** Odd news: the story vote offers live headlines (GET /api/news). Off = curated stories only. */
  liveNews: true,
  /** AI-written scene openers. Off = the hand-written scenes in seed_quests.json. */
  aiScenes: false,
  /** The narrator reads the story aloud (OpenAI TTS, Gemini as backup; server/tts.ts, /api/tts). Off or failing = text only. */
  voice: true,
  /** One AI-picked painting style per story (lib/artStyles.ts). Off = always the Neon Ink house style. */
  artStyles: true,
  /** Paint the party's heroes into each scene (server/art, muse-image edits, ~$0.01 each, cached). */
  heroArt: true,
  /** Story characters speak their quoted lines in their own ElevenLabs voices; Sarah narrates (server/tts.ts). */
  characterVoices: false,
  /** AI plan suggestions on phones (they made everyone's plans the same). */
  suggestions: false,
  /** One AI-picked sound effect per story slide (lib/storySfx.ts, game/public/sfx/). Voice owns it; ships off unless solid. */
  storySfx: true,
  /** The finale talk (CD): 60 s to convince each other before the final vote (phase "convince"). Off until the screens exist. */
  finaleTalk: true, // look: TV FinaleTalk + phone TalkScreen are in (6c6dbb8, c684ff7); off again if the real run shows a problem
  /**
   * Story v3 (design/37, after Meta's judges): a success resolves the situation for good and the story moves to the
   * NEW circumstance it created; 2-3 pressures worsen on their own each turn; the meter is a story clock by turns;
   * the finish line is only a suggested goal. Off = the design/35 engine (one fixed finish line).
   */
  storyV3: process.env.NEXT_PUBLIC_STORY_V2 !== "1",
  /** CD (Sun AM): the TV host can remove a player or bot from the lobby (host.kick); their phone offers Rejoin. */
  kick: true,
  /** CD (Sun AM): after the ending, "Back to lobby" keeps the room, the players and their heroes (host.playAgain). */
  playAgain: true,
  /** CD after Meta (design/37 §4): the ending never auto-advances; ←/→, Space or ‹ › move the slides (look). */
  manualEnding: true,
  /** CD (Sun AM): cast dialogue in its own voice (outcome `lines`, speaker "" = the narrator). Voice owns /api/tts. */
  castVoices: process.env.NEXT_PUBLIC_CAST_VOICES === "1", // off unless a build sets NEXT_PUBLIC_CAST_VOICES=1 (test builds)
} as const;

export type Feature = keyof typeof FEATURES;
