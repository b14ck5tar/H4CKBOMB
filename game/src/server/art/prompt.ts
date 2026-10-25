import { COLOR, NEGATIVE, STYLE } from "@/server/prompts";
import type { ArtHero } from "./types";
import { ART_STYLES, isArtStyle } from "@/lib/artStyles";

// Edit prompts for /v1/images/edits. Images are captioned by index (Muse reads parts in order).
// Bump PROMPT_VERSION whenever the wording changes: it is part of the cache key.
export const PROMPT_VERSION = "v3";

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
  // design/24 P5b: a story can be painted in its own style. Neon Uncanny (the plates' style) keeps the original wording.
  const st = isArtStyle(o.style) && o.style !== "neon" ? ART_STYLES[o.style] : null;
  const n = o.heroes.length;
  const last = n + 1;
  const place = o.sceneText ? ` (${o.sceneText})` : "";
  const action = o.moment
    ? `They are in the middle of this moment: ${clip(o.moment, 260)}`
    : "Each hero is caught mid-reaction to the glowing impossible element in an expressive, funny pose that fits their personality and uses their signature prop (aiming it, holding it up, hiding behind it), and at least one of them points at it";
  return [
    `Image 1 is a finished painting of a story scene${place}. Image${n > 1 ? `s 2 to ${last} are reference portraits` : " 2 is a reference portrait"} of our cartoon hero${n > 1 ? "es" : ""}.`,
    st
      ? `Repaint Image 1 completely in this style: ${st.prompt}. Keep Image 1's place, composition and camera angle, and add ${n === 1 ? "this hero" : `these ${n} heroes`} into it. The impossible element stays the focal point and is not covered by anyone.`
      : `Edit Image 1 by adding ${n === 1 ? "this hero" : `these ${n} heroes`} into it. Keep Image 1's composition, camera angle, background, lighting and color palette the same: deep indigo night, warm sodium-orange lamplight, and the glowing magenta-and-cyan impossible element still the brightest thing in the frame and not covered by anyone.`,
    `The heroes, from left to right: ${heroList(o.heroes)}`,
    `Draw each hero full body, about a third of the frame height, standing together as a small group on solid ground in the lower middle of the frame (not at the edges), a little apart so they don't overlap, each casting a soft shadow on the ground. ${action}.`,
    st
      ? `Each hero must be clearly recognizable from their portrait: same face, body shape, proportions, colors, outfit and prop, but painted in the same style as the whole picture, not pasted on top.${ratingLine(o.rating)}`
      : `Each hero must look exactly like their portrait: same face, body shape, proportions, colors, outfit and prop, in the same flat cartoon style with bold ink outlines. Paint them into the scene, not pasted on top: the same ink linework, halftone shading and lighting as Image 1, warm orange lamplight on one side and a magenta-cyan rim light from the impossible element on the other.${ratingLine(o.rating)}`,
    st ? `Style: ${st.prompt}. ${NEGATIVE}` : `${STYLE}. ${NEGATIVE}`,
  ].join("\n");
}

/**
 * design/24 P4 v3 (story director): a decision's painting is a NEW shot of what just happened, set in the real kind
 * of place the story is happening in. The previous picture and the portraits are references for style and character
 * only. `moment` is the outcome's scene brief (where, who does what, the visible result), `sceneText` the new
 * situation, `setting` the real event's place_type (spoiler-free, e.g. "a giant vegetable weigh-in at a county show").
 */
export function newScenePrompt(o: { heroes: ArtHero[]; sceneText: string; moment?: string; setting?: string; rating?: string; style?: string }) {
  const st = isArtStyle(o.style) && o.style !== "neon" ? ART_STYLES[o.style] : null;
  const n = o.heroes.length;
  return [
    `Image 1 is the PREVIOUS picture of our story: use it ONLY for the art style, color mood and the look of the world. Image${n > 1 ? `s 2 to ${n + 1} are reference portraits` : " 2 is a reference portrait"} of our cartoon hero${n > 1 ? "es" : ""}.`,
    `Paint a NEW illustration of the moment that just happened${o.moment ? `: ${clip(o.moment, 300)}` : ""}.`,
    o.setting ? `The place is ${clip(o.setting, 120)}, painted as a real, specific modern location of that kind, with two or three ordinary details that make it believable, and the one impossible thing of our story in it.` : "",
    o.sceneText ? `What the picture must show right now: ${clip(o.sceneText, 240)}` : "",
    `Show the RESULT clearly: what changed because of what the heroes did (something lifted, spilled, stuck, glowing, running away) is the focal point and easy to read at a glance. A new camera angle and a new composition that fit this moment; if the story moved somewhere new, paint that place. Do not copy Image 1's layout.`,
    `The heroes, from left to right: ${heroList(o.heroes)} Show them in the middle of the action, full body, big enough to read, each clearly recognizable from their portrait by face shape, body shape, colors, outfit and prop, drawn in this picture's graphic style. Any other people are background figures in plain clothes.${ratingLine(o.rating)}`,
    st ? `Style: ${st.prompt}. ${NEGATIVE}` : `${STYLE}. ${COLOR} ${NEGATIVE}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function posterEditPrompt(o: { heroes: ArtHero[]; sceneText: string; rating?: string }) {
  const n = o.heroes.length;
  const place = o.sceneText ? ` (${o.sceneText})` : "";
  return [
    `Image 1 is the climax scene of our story${place}. Images 2 to ${n + 1} are reference portraits of the ${n} cartoon heroes who saved the day.`,
    `Paint a vertical storybook keepsake cover: all ${n} heroes together as one team in the lower half, posed heroically and a little comically, shoulder to shoulder, in front of the same place, with the glowing magenta-and-cyan impossible element from Image 1 looming huge behind them. Keep Image 1's location, deep indigo night, sodium-orange lamplight and color palette.`,
    `The heroes, from left to right: ${heroList(o.heroes)}`,
    `Each hero must look exactly like their portrait: same face, body shape, proportions, colors, outfit and prop, in the same flat cartoon style with bold ink outlines. Keep the top fifth as clean, empty dark night sky (a title is added later outside the image).${ratingLine(o.rating)}`,
    `${STYLE}. ${NEGATIVE}`,
  ].join("\n");
}
