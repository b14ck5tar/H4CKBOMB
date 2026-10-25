/**
 * "Real in, magic out" (partner's design/18, trimmed): two optional join questions.
 *   "What's your secret strength?" -> real.skill -> the hero's power, and the reveal's "Solved by" line.
 *   "What's a small thing that scares you?"   -> real.fear  -> the hero's weakness, comedy in the fiction only.
 * Shared by the table (client) and the server. No side quests, no real-life suggestions.
 */
import type { Player, RealAnswers } from "./types";

/** Player text as the model sees it: no angle brackets, one line, capped. */
export function cleanText(x: unknown, max = 160) {
  return String(x ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

export function realOf(x: unknown): RealAnswers {
  const r = (x ?? {}) as Partial<RealAnswers>;
  return { skill: cleanText(r.skill, 120), fear: cleanText(r.fear, 120) };
}

/** Answers that must never become comedy, even in a canned line. The model gets a softer rule in the prompt. */
export const HEAVY =
  /\b(die|dying|death|dead|deaths|kill\w*|suicid\w*|self[- ]?harm|cutting myself|abuse\w*|rape\w*|assault\w*|cancer|illness|disease|hospital\w*|grief|grieving|funeral\w*|divorce\w*|war|guns?|shoot\w*|bomb\w*|terror\w*|losing (my|a|someone)|lose (my|someone)|alone forever|abandon\w*)\b/i;

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** "My secret strength is parallel parking." -> "parallel parking". "" when too long or too heavy for a sentence. */
export function skillPhrase(skill: string, maxWords = 6) {
  const s = cleanText(skill, 80)
    .replace(/^(my\s+)?(secret\s+)?(talents?|strengths?)\s*(is|are|for|:)\s*/i, "")
    .replace(/^(i'?m|i am|im)\s+/i, "")
    .replace(/^(weirdly|really|very|super|kind of|kinda|pretty)\s+/i, "")
    .replace(/^(good|great|amazing|decent)\s+(at|with)\s+/i, "")
    .replace(/[\s.!?,;:]+$/, "");
  return s && !HEAVY.test(s) && !JOKE.test(s) && s.split(" ").length <= maxWords ? lowerFirst(s) : "";
}

/** Bathroom humor and blowing things up aren't knacks: they never make the "Solved by" line. */
const JOKE = /\b(toilets?|poop\w*|farts?\w*|pee\w*|butts?|blow\w* (?:up|stuff)|explod\w*|bombs?|kill\w*|murder\w*|stab\w*|drunk\w*|weed|sex\w*|nothing|idk|dunno|lol)\b/i;

/** "I'm scared of geese." -> "geese". "" when too long or too heavy for a canned joke. */
export function fearPhrase(fear: string, maxWords = 6) {
  const s = cleanText(fear, 80)
    .replace(/^(i'?m|i am|im)\s+/i, "")
    .replace(/^(really|very|kind of|kinda|a little|low[- ]?key)\s+/i, "")
    .replace(/^(scared|afraid|terrified|frightened)\s+(of|by)\s+/i, "")
    .replace(/[\s.!?,;:]+$/, "");
  return s && !HEAVY.test(s) && s.split(" ").length <= maxWords ? lowerFirst(s) : "";
}

/** "Ava's", "James's". */
const poss = (name: string) => `${name}'s`;

/**
 * The reveal's hero line, built in code (never by the AI): "Solved by Ava's parallel parking and Ben's coffee."
 * Uses the players' real names. "" when nobody shared a usable skill.
 */
export function solvedByLine(players: (Pick<Player, "name" | "real"> & { hero?: string })[], won = true) {
  const parts = players
    .map((p) => {
      // Short, clean knacks only (4 words max); an answer that isn't a usable skill is skipped.
      const s = skillPhrase(p.real?.skill ?? "", 4);
      // The real player's name and knack, then their hero, so the room can connect the two.
      return s ? `${p.name} (${s})` : "";
    })
    .filter(Boolean);
  if (!parts.length) return "";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  // Only a win is "solved"; otherwise the knacks still get their credit, without contradicting the ending.
  return `${won ? "Solved by" : "Starring"} ${list}.`;
}
