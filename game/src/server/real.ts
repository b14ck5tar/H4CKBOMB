import "server-only";
import { DEFAULT_RATING, isRating } from "@/lib/rating";
import type { Rating } from "@/lib/types";

export { HEAVY, cleanText, fearPhrase, realOf, skillPhrase } from "@/lib/real";

export function ratingOf(x: unknown): Rating {
  return isRating(x) ? x : DEFAULT_RATING;
}
