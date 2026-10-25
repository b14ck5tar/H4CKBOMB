import type { ArtHero } from "./types";
import { colorFor, HERO_CONSISTENCY, NEGATIVE, SCENE_RULE, styleFor } from "./style";

// Edit prompts for /v1/images/edits. Images are captioned by index (Muse reads parts in order).
// Bump PROMPT_VERSION whenever the wording changes: it is part of the cache key.
export const PROMPT_VERSION = "v4"; // v4: Neon Ink + per-story themes + SCENE_RULE (design/31)

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") : s);

/** Short visual description: the anchor (signature traits) + outfit + prop. */
export function describeHero(h: ArtHero): string {
  const v = h.visual;
  if (!v) return "a cartoon hero";
  if (typeof v === "string") return clip(v, 220);
  const parts = [v.anchor, v.outfit && `wearing ${v.outfit}`, v.prop && `holding ${v.prop}`].filter(Boolean);
  return clip(parts.join(", "), 320);
}

function ratingLine(rating?: string) {
  if (rating === "kids") return " Keep the mood gentle, silly and wondrous, nothing scary.";
  return "";
}

function heroList(heroes: ArtHero[]) {
  // The name ties a hero in the story brief ("Gus shoves the cart") to their portrait.
  return heroes.map((h, i) => `Image ${i + 2}: ${h.name ? `${clip(h.name, 30)}, ` : ""}${describeHero(h)}.`).join(" ");
}

export function sceneEditPrompt(o: { heroes: ArtHero[]; sceneText: string; moment?: string; rating?: string; style?: string }) {
  // One ink base for every story; the story's theme (cast.art) sets palette, light and mood (design/31).
  const n = o.heroes.length;
  const last = n + 1;
  const place = o.sceneText ? ` (${o.sceneText})` : "";
  const action = o.moment
    ? `They are in the middle of this moment: ${clip(o.moment, 260)}`
    : "Each hero is caught mid-reaction to the impossible thing in an expressive, funny pose that fits their personality and uses their signature prop (aiming it, holding it up, hiding behind it), and at least one of them points at it";
  return [
    `${styleFor(o.style)}.`,
    `Image 1 is a finished picture of a story scene${place}. Image${n > 1 ? `s 2 to ${last} are reference portraits` : " 2 is a reference portrait"} of our hero${n > 1 ? "es" : ""}.`,
    `Redraw Image 1 in this style, keeping its place, composition and camera angle, and add ${n === 1 ? "this hero" : `these ${n} heroes`} into it. The impossible thing stays the focal point and is not covered by anyone.`,
    `The heroes, from left to right: ${heroList(o.heroes)}`,
    `Draw each hero full body, about a third of the frame height, standing together as a small group on solid ground in the lower middle of the frame (not at the edges), a little apart so they don't overlap, each casting a hard ink shadow on the ground. ${action}.`,
    `${HERO_CONSISTENCY} Draw them into the scene, not pasted on top.${ratingLine(o.rating)}`,
    `${SCENE_RULE} ${colorFor(o.style)} ${NEGATIVE}`,
  ].join("\n");
}

/**
 * design/24 P4 v3 (story director): a decision's painting is a NEW shot of what just happened, set in the real kind
 * of place the story is happening in. The previous picture and the portraits are references for character only.
 * `moment` is the outcome's scene brief (where, who does what, the visible result), `sceneText` the new situation,
 * `setting` the real event's place_type (spoiler-free, e.g. "a giant vegetable weigh-in at a county show").
 */
export function newScenePrompt(o: { heroes: ArtHero[]; sceneText: string; moment?: string; setting?: string; rating?: string; style?: string }) {
  const n = o.heroes.length;
  return [
    `${styleFor(o.style)}.`,
    `Image 1 is the PREVIOUS picture of our story: use it only for the look of the world and the impossible thing. Image${n > 1 ? `s 2 to ${n + 1} are reference portraits` : " 2 is a reference portrait"} of our hero${n > 1 ? "es" : ""}.`,
    `Draw a NEW illustration of the moment that just happened${o.moment ? `: ${clip(o.moment, 300)}` : ""}.`,
    o.setting ? `The place is ${clip(o.setting, 120)}, drawn as a real, specific modern location of that kind, with two or three ordinary details that make it believable, and the one impossible thing of our story in it.` : "",
    o.sceneText ? `What the picture must show right now: ${clip(o.sceneText, 240)}` : "",
    `Show the RESULT clearly: what changed because of what the heroes did (something lifted, spilled, stuck, toppled, running away) is the focal point and easy to read at a glance. A new camera angle and a new composition that fit this moment; if the story moved somewhere new, draw that place. Do not copy Image 1's layout.`,
    `The heroes, from left to right: ${heroList(o.heroes)} Show them in the middle of the action, full body, big enough to read. ${HERO_CONSISTENCY} Any other people are background figures in plain clothes, simplified into flat shapes.${ratingLine(o.rating)}`,
    `${SCENE_RULE} ${colorFor(o.style)} ${NEGATIVE}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function posterEditPrompt(o: { heroes: ArtHero[]; sceneText: string; rating?: string; style?: string }) {
  const n = o.heroes.length;
  const place = o.sceneText ? ` (${o.sceneText})` : "";
  return [
    `${styleFor(o.style)}.`,
    `Image 1 is the climax scene of our story${place}. Images 2 to ${n + 1} are reference portraits of the ${n} heroes who saved the day.`,
    `Draw a vertical storybook keepsake cover: all ${n} heroes together as one team in the lower half, posed heroically and a little comically, shoulder to shoulder, in front of the same place, with the impossible thing from Image 1 looming huge behind them. Keep Image 1's location and palette.`,
    `The heroes, from left to right: ${heroList(o.heroes)}`,
    `${HERO_CONSISTENCY} The top fifth is plain, empty dark sky.${ratingLine(o.rating)}`,
    `${SCENE_RULE} ${colorFor(o.style)} ${NEGATIVE}`,
  ].join("\n");
}
