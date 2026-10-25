import { sanitize } from "@/server/stories/readability";

/**
 * Story engine v2 (design/30): the story bible's shapes and the slot filler, shared by the server (stories/bible.ts)
 * and the TV (host.ts). Pure: no server-only imports, so host.ts can use it for an instant, AI-free fallback.
 */

export type BibleBeat = { text: string; carry: string };
export type BibleAct = {
  situation: string;
  goal: string;
  twist: string;
  outcomes: { worse: BibleBeat; mixed: BibleBeat; better: BibleBeat };
};
export type BibleEnding = { text: string; line: string };
export type EndingTier = "triumph" | "mostly_fine" | "well_its_a_story";
export type StoryBible = {
  setting: string;
  problem: { name: string; stakes: string; pronoun: string; rule: string };
  cast: { role: string; name: string; want: string; voice: string; line: string }[];
  acts: BibleAct[];
  finale: { situation: string; goal: string; twist: string };
  endings: Record<EndingTier, BibleEnding>;
  callbacks: string[];
};

/** lib/grade.ts ending names → the bible's ending tiers. */
export const ENDING_TIER: Record<string, EndingTier> = { TRIUMPHANT: "triumph", BITTERSWEET: "mostly_fine", GRIM_BUT_HILARIOUS: "well_its_a_story" };
/** lib/grade.ts branch → the pre-written beat (legendary rides the better beat, bigger). */
export const BEAT_OF: Record<string, keyof BibleAct["outcomes"]> = { worse: "worse", mixed: "mixed", better: "better", legendary: "better" };

const clip = (s: unknown, n: number) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

/** Drop the comma-delimited credit clause (", just like {friend} said,"), or say "a friend" if it is woven in. */
function dropFriend(s: string) {
  const out = s.replace(/,\s*([^,.]*\{friend\}[^,.]*)(?=[,.])/g, (m, seg: string) => (seg.split(/\s+/).length <= 6 ? "" : m));
  return out.replace(/\{friend\}'s/g, "a friend's").replace(/\{friend\}/g, "a friend");
}

/**
 * The beat with its slots filled in code: {hero} = the acting hero, {action} = the ruling's plain-words attempt
 * (minus the leading name), {friend} = the credited friend on better/legendary, otherwise the credit is dropped.
 */
export function fillBeat(text: string, o: { hero: string; attempt?: string; idea_from?: string; branch?: string }) {
  const hero = clip(o.hero, 40) || "The hero";
  let action = clip(o.attempt, 140).replace(/[.!]+$/, "");
  if (action.toLowerCase().startsWith(hero.toLowerCase())) action = action.slice(hero.length).trim();
  if (!action) action = "goes for it";
  const won = o.branch === "better" || o.branch === "legendary";
  let s = String(text ?? "").replace("{hero}", hero).replace("{action}", action).replace(/\{hero\}/g, hero).replace(/\{action\}/g, "");
  s = won && o.idea_from ? s.replace(/\{friend\}/g, clip(o.idea_from, 40)) : dropFriend(s);
  return sanitize(s.replace(/,\s*,/g, ",").replace(/\s+,/g, ","));
}
