// Display-only safety net for player-typed text shown on the shared TV (pitch cards, quotes, notes).
// The AI moderates what it reads; this catches the obvious words when a call failed or text skipped the AI.
// Phones show a player's own text to themselves unmasked. Short on purpose: obvious slurs and profanity only.

const WORDS = [
  "fuck\\w*", "motherfuck\\w*", "shit\\w*", "bullshit", "bitch\\w*", "bastards?", "cunts?", "dicks?", "cocks?", "pussy", "pussies",
  "assholes?", "dumbass\\w*", "jackass\\w*", "wank\\w*", "twats?", "whores?", "sluts?", "porn\\w*", "rape\\w*", "rapist\\w*",
  "nigg\\w*", "fag\\w*", "retard\\w*", "spics?", "chinks?", "kikes?", "trann(y|ies)", "dykes?", "wetbacks?", "gooks?", "coons?",
  "nazis?", "hitler", "kys",
];

const RE = new RegExp(`\\b(${WORDS.join("|")})\\b`, "gi");

/** Replace obvious slurs and profanity with a block, keeping everything else as typed. */
export function mask(text: string | undefined | null): string {
  if (!text) return "";
  return String(text).replace(RE, "▇▇▇");
}
