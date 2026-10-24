/**
 * "Real in, magic out" (partner's design/18, trimmed): two optional join questions.
 *   "What's something you're weirdly good at?" -> real.skill -> the hero's power, and the reveal's "Solved by" line.
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

/** "I'm weirdly good at parallel parking." -> "parallel parking". "" when too long or too heavy for a sentence. */
export function skillPhrase(skill: string, maxWords = 6) {
  const s = cleanText(skill, 80)
    .replace(/^(i'?m|i am|im)\s+/i, "")
    .replace(/^(weirdly|really|very|super|kind of|kinda|pretty)\s+/i, "")
    .replace(/^(good|great|amazing|decent)\s+(at|with)\s+/i, "")
    .replace(/[\s.!?,;:]+$/, "");
  return s && !HEAVY.test(s) && s.split(" ").length <= maxWords ? lowerFirst(s) : "";
}

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
export function solvedByLine(players: Pick<Player, "name" | "real">[]) {
  const parts = players
    .map((p) => {
      const s = skillPhrase(p.real?.skill ?? "");
      return s ? `${poss(p.name)} ${s}` : "";
    })
    .filter(Boolean);
  if (!parts.length) return "";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `Solved by ${list}.`;
}
