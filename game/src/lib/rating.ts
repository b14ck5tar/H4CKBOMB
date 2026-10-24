import type { Rating } from "./types";

/**
 * "Who's playing?" Chosen by the host in the lobby. One setting controls how gentle or heavy everything is:
 * which real stories can become quests, and the DM's tone.
 * Heavy real-world news (tragedy, victims, violence, divisive politics) is blocked at EVERY rating; that's the
 * separate, unbuilt Real World mode in design/16.
 */
export const RATINGS: Rating[] = ["kids", "teens", "adults"];
export const DEFAULT_RATING: Rating = "teens";

export const RATING_LABEL: Record<Rating, string> = {
  kids: "Kids",
  teens: "Teens",
  adults: "Adults",
};

/** One line for the lobby picker. */
export const RATING_BLURB: Record<Rating, string> = {
  kids: "Under 13 or mixed with little ones. Silly, gentle, cheerful real stories only.",
  teens: "13+. Spooky-funny, light peril, no gore or swearing. Odd, harmless real stories.",
  adults: "18+. Darker humor, spookier tone, everyday grown-up topics. Still no tragedies.",
};

/** Appended to every DM prompt. */
export const RATING_GUIDE: Record<Rating, string> = {
  kids: `AUDIENCE: KIDS (some players may be 6-12). Gentle, silly, warm. Threats are mischievous, never menacing; nobody is ever really hurt, scared for real, or in real danger. No romance, no insults, no gross-out beyond harmless silliness, no swearing, no scary imagery. Simple words and short sentences.`,
  teens: `AUDIENCE: TEENS (13+). Spooky-funny with light peril. No gore, no swearing, no sexual content, nothing cruel. Teasing stays affectionate.`,
  adults: `AUDIENCE: ADULTS (18+). Darker, drier humor and a spookier tone are fine, and grown-up everyday topics (money, work, landlords, city bureaucracy, tech) are fair game. Mild swearing only if a player uses it first. Still: no gore, no sexual content, no cruelty toward real people or groups, nothing about real tragedies.`,
};

/** Quest ratings in order of how broad the audience is. A quest is allowed if it suits this group's rating. */
const RANK: Record<Rating, number> = { kids: 0, teens: 1, adults: 2 };

/** A story rated `questRating` ("youngest group it suits") can be played by a group rated `group`. */
export function questAllowed(questRating: Rating | undefined, group: Rating) {
  return RANK[questRating ?? "teens"] <= RANK[group];
}

export function isRating(x: unknown): x is Rating {
  return x === "kids" || x === "teens" || x === "adults";
}

