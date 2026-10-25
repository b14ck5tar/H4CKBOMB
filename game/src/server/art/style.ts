import { ART_STYLES, isArtStyle, type ArtStyleId } from "@/lib/artStyles";

// House style "Neon Ink" (design/31-house-style.md) and the per-story themes built on it.
// Prompt order matters: STYLE first, then subject, then SCENE_RULE, COLOR, COMPOSITION, NEGATIVE.
// One ink base for every story so heroes stay recognizable; each story's theme (lib/artStyles.ts) only changes the
// palette, light, texture and mood. Never mention a logo, title or badge in an image prompt (Muse paints fake ones).

/** The shared linework and anti-AI-look levers, without a palette (the theme supplies it). */
export const INK_BASE =
  "Hand-inked comic illustration: clean, confident brush-ink linework with bold outer contours and thinner inner lines, slightly imperfect hand-drawn edges; simple graphic shapes and big readable silhouettes; flat matte cel colors with one hard shadow tone and bold solid-black shadow shapes on the dark side of every form; one dramatic hard key light; lively comic energy with a few speed lines and a little ink spatter; sparse Ben-Day halftone dots only in shadows and skies. Like a hand-printed indie comic cover, not a digital painting: no glossy gradients, no plastic shine, no airbrush, no 3D render look, no fine micro texture, no lens blur";

/** design/31 STYLE: the base with the house (Neon Ink) palette. */
export const STYLE =
  "Hand-inked neon comic illustration: clean, confident brush-ink linework with bold outer contours and thinner inner lines, slightly imperfect hand-drawn edges; simple graphic shapes and big readable silhouettes; flat matte cel colors with one hard shadow tone and bold solid-black shadow shapes on the dark side of every form; one dramatic hard key light; lively comic energy with a few speed lines and a little ink spatter; sparse Ben-Day halftone dots only in shadows and skies; limited palette: deep indigo-black and warm sodium orange plus at most three neon spot colors (hot magenta, electric cyan, acid yellow). Like a hand-printed indie comic cover, not a digital painting: no glossy gradients, no plastic shine, no airbrush, no 3D render look, no fine micro texture, no lens blur";

/** design/31 COLOR v2 (Neon Ink): no glow; the impossible thing stands out by shape, scale and one flat accent. */
export const COLOR =
  "Color script: the ordinary real world is flat deep indigo night and warm sodium-orange light with big solid-black shadow shapes. The impossible thing keeps its own real materials and colors and stands out by shape, scale and one flat neon accent color (only one of hot magenta, electric cyan or acid yellow), never by glowing.";

/** design/31 SCENE_RULE: every scene, lobby and moment prompt, right after the subject. */
export const SCENE_RULE =
  "The fantasy twist is the story's own creature or object, drawn as a concrete, solid physical thing in the scene with ink outlines and flat color, funny and a little unsettling. At most ONE glowing light source in the whole image. No energy swirls, no rings, no beams, no auras, no magic sparkles, no glowing particles, no lightning, no glowing outlines.";

export const COMPOSITION =
  "Composition: one clear focal point in the upper two-thirds, one big bold readable silhouette against a simpler background, at most three major shapes, generous negative space, background crowds simplified into flat silhouette shapes; the lower third darker and calm. Include two or three ordinary, specific modern details of this exact place so it feels like a real local-news location.";

export const NEGATIVE =
  "Original fictional characters only, no real people, no celebrities, no logos or brands. No text, no letters, no words, no numbers, no captions, no readable signs, all screens and labels blank, no speech bubbles, no sound-effect lettering, no comic panels or borders, no watermark, no signature. Family-friendly, no gore.";

/** Heroes are drawn comic characters, never realistic people. The same design in every story theme. */
export const CHARACTER_STYLE =
  "Hand-inked neon comic character design: clean, confident brush-ink linework with bold outer contours and thinner inner lines, slightly imperfect hand-drawn edges, flat matte cel colors with one hard shadow tone and bold solid-black shadow shapes, a hard magenta and cyan neon rim light, sparse halftone dots in the shadows only. Consistent stylized proportions: big head, simple chunky body, strong expressive hands, one clear geometric body shape (bean, pear, rectangle or triangle). Small graphic eyes (dots, almonds or slits, no shiny highlights), expressive eyebrows and mouth doing the acting, simplified angular nose and ears, two or three bold signature features that read at avatar size. Clearly a drawn comic character, not a realistic person and not a TV cartoon with huge round eyes: no realistic faces, skin texture, pores or fur strands, no glossy gradients, no plastic shine, no 3D render look.";

/** Heroes painted into scenes keep their reference design; only the story's palette and light change. */
export const HERO_CONSISTENCY =
  "Keep each hero's design from their reference portrait (face shape, body shape, colors, outfit and prop), drawn with the same consistent stylized proportions and ink linework as the rest of the picture; only this story's palette and light touch them.";

export function themeOf(style?: string): ArtStyleId {
  return isArtStyle(style) ? style : "neon";
}

/** STYLE for a story theme: the ink base plus the theme's palette, light, texture and mood. */
export function styleFor(style?: string) {
  const id = themeOf(style);
  return id === "neon" ? STYLE : `${INK_BASE}. ${ART_STYLES[id].prompt}`;
}

/** COLOR for a story theme (the theme's palette sentence already rides in styleFor; this keeps the no-glow rule). */
export function colorFor(style?: string) {
  return themeOf(style) === "neon"
    ? COLOR
    : "Color script: use only this story's palette, with big solid-black shadow shapes. The impossible thing keeps its own real materials and colors and stands out by shape, scale and one flat accent color from the palette, never by glowing.";
}

export function portraitPrompt(v: { anchor: string; outfit: string; palette: string[]; prop: string; expression: string }, flaw: string, ability = "") {
  return `${CHARACTER_STYLE} Character: ${v.anchor}, ${v.expression}, holding ${v.prop}, wearing ${v.outfit}, color accents ${v.palette.join(", ")}.${ability ? ` One small visible tell of their strange edge (${ability}), drawn as a solid detail with ink outlines, no glow and no sparkles.` : ""} Their flaw is visible in a funny way: ${flaw}. Composition: bust portrait, head and shoulders fill the frame, face in the upper half, centered, strong readable silhouette with a bright magenta-cyan rim light, against a plain flat dark deep-indigo background with no streaks, no patterns and no effects; limited palette of the character's colors plus at most three neon accents; the face must read clearly as a tiny circular avatar. ${NEGATIVE}`;
}

const SCENE_OPENERS: Record<string, string> = {
  hook: "Wide establishing shot at eye level, hook scene, dusk",
  twist: "Twist scene, midnight, low angle, the impossible element bigger and stranger than it seemed",
  climax: "Climax scene, low heroic angle looking up, the impossible element at full scale, the biggest and strangest it gets",
};

/** A scene with no people (opening plates, lobby): the story theme (cast.art) when known, else Neon Ink. */
export function scenePrompt(s: { kind: string; location: string; description: string; realm: string; threat?: string; style?: string }) {
  const where = [s.location, s.realm].filter(Boolean).join(" in ");
  return `${styleFor(s.style)}. ${SCENE_OPENERS[s.kind] ?? SCENE_OPENERS.hook}: ${where}. ${s.description}${s.threat ? ` The impossible element: ${s.threat}` : ""} No people. ${SCENE_RULE} ${colorFor(s.style)} ${COMPOSITION} ${NEGATIVE}`;
}
