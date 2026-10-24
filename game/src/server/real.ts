import "server-only";
import { DEFAULT_RATING, isRating, questAllowed } from "@/lib/rating";
import type { Rating, RealAnswers } from "@/lib/types";

// "Real in, magic out" (design/18): input shaping shared by the AI route and the fallbacks.
// Player text is cleaned once here, before it's wrapped for the model or quoted by a canned line.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function ratingOf(x: unknown): Rating {
  return isRating(x) ? x : DEFAULT_RATING;
}

/** Player text as the model sees it: no angle brackets, one line, capped. */
export function cleanText(x: unknown, max = 160) {
  return String(x ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/** Only skill and fear are used. `talk` (the old third question) is no longer collected and is ignored if sent. */
export function realOf(x: Any): RealAnswers {
  return { skill: cleanText(x?.skill, 120), fear: cleanText(x?.fear, 120), talk: "" };
}

/**
 * A skill as a short phrase for canned lines: "I'm weirdly good at parallel parking." becomes "parallel parking".
 * "" when it's too long to read well inside a sentence.
 */
export function skillPhrase(skill: string, maxWords = 6) {
  let s = cleanText(skill, 80)
    .replace(/^(i'?m|i am|im)\s+/i, "")
    .replace(/^(weirdly|really|very|super|kind of|kinda|pretty)\s+/i, "")
    .replace(/^(good|great|amazing|decent)\s+(at|with)\s+/i, "")
    .replace(/[\s.!?,;:]+$/, "");
  if (/^[A-Z][a-z]/.test(s)) s = s[0].toLowerCase() + s.slice(1);
  return s && s.split(" ").length <= maxWords ? s : "";
}

/** Answers that must never become comedy, even in a canned line. The model gets a softer rule in the prompt. */
export const HEAVY =
  /\b(die|dying|death|dead|deaths|kill\w*|suicid\w*|self[- ]?harm|cutting myself|abuse\w*|rape\w*|assault\w*|cancer|illness|disease|hospital\w*|grief|grieving|funeral\w*|divorce\w*|war|guns?|shoot\w*|bomb\w*|terror\w*|losing (my|a|someone)|lose (my|someone)|alone forever|abandon\w*)\b/i;

export interface PickParty {
  hero_id: string;
  name: string;
  hero_name: string;
  skill: string;
  fear: string;
}
export interface PickCandidate {
  id: string;
  title: string;
  premise: string;
  threat: string;
  goal: string;
  locations: string[];
}
export interface PickInput {
  rating: Rating;
  party: PickParty[];
  candidates: PickCandidate[];
}

function uniqueBy<T>(items: T[], key: (t: T) => string) {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = key(t);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function pickInput(raw: Any): PickInput {
  const rating = ratingOf(raw?.rating);
  const party = uniqueBy(
    (Array.isArray(raw?.party) ? raw.party : []).map((p: Any) => ({
      hero_id: cleanText(p?.hero_id, 64),
      name: cleanText(p?.name, 40),
      hero_name: cleanText(p?.hero_name, 40),
      skill: cleanText(p?.skill, 120),
      fear: cleanText(p?.fear, 120),
    })),
    (p: PickParty) => p.hero_id,
  ).slice(0, 6);
  const candidates = uniqueBy(
    (Array.isArray(raw?.candidates) ? raw.candidates : [])
      // A candidate tagged with a rating this group can't play is dropped (the client filters too).
      .filter((c: Any) => !isRating(c?.rating) || questAllowed(c.rating, rating))
      .map((c: Any) => ({
        id: cleanText(c?.id, 80),
        title: cleanText(c?.title, 80),
        premise: cleanText(c?.premise, 400),
        threat: cleanText(c?.threat, 240),
        goal: cleanText(c?.goal, 240),
        locations: (Array.isArray(c?.locations) ? c.locations : []).slice(0, 4).map((l: Any) => cleanText(l, 80)).filter(Boolean),
      })),
    (c: PickCandidate) => c.id,
  ).slice(0, 10);
  return { rating, party, candidates };
}
