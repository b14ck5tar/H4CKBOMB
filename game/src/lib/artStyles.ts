/**
 * One art style per story (design/24 P5b). The AI picks one at game start; every scene painting (and the heroes
 * painted into it) uses it. The pre-painted fallback plates stay Neon Uncanny.
 * Each style was test-painted once on the same scene before it went in this list (see the P5b commit).
 */
export type ArtStyleId = "neon" | "comic" | "watercolor" | "retro" | "noir" | "gouache";

export const ART_STYLES: Record<ArtStyleId, { name: string; fits: string; prompt: string }> = {
  neon: {
    name: "Neon Uncanny",
    fits: "the default: strange news at night, glowing impossible things",
    prompt: "", // the house style: prompts.ts STYLE + COLOR, already in every scene prompt
  },
  comic: {
    name: "neon comic",
    fits: "city weirdness, urban legends, tech gone strange",
    prompt:
      "bold modern comic-book art: thick black ink outlines, flat saturated neon colors, Ben-Day halftone dots, dramatic speed lines and a punchy pop-art palette of hot pink, cyan and yellow",
  },
  watercolor: {
    name: "moody watercolor",
    fits: "nature, animals, rivers, forests, weather",
    prompt:
      "moody loose watercolor painting on textured paper: soft wet-on-wet washes, gentle bleeding edges, muted greens, blues and warm ochres, delicate ink linework, misty atmosphere",
  },
  retro: {
    name: "retro sci-fi poster",
    fits: "space, signals, science, the sky, technology",
    prompt:
      "1960s retro science-fiction poster art: bold simple shapes, grainy screen-print texture, limited palette of teal, orange, cream and deep navy, dramatic stars and rays, mid-century illustration",
  },
  noir: {
    name: "film noir",
    fits: "mysteries, disappearances, secrets, the unexplained",
    prompt:
      "film noir illustration: high-contrast black and white with deep shadows and hard rim light, venetian-blind light stripes, rain sheen, one small accent of glowing color on the impossible element only",
  },
  gouache: {
    name: "storybook gouache",
    fits: "gentle and kids' stories, festivals, happy news, small towns",
    prompt:
      "warm storybook gouache illustration: soft matte brushstrokes, rounded friendly shapes, cozy warm palette of honey, sage, rose and sky blue, gentle light, like a classic children's picture book",
  },
};

export const ART_STYLE_IDS = Object.keys(ART_STYLES) as ArtStyleId[];

export function isArtStyle(x: unknown): x is ArtStyleId {
  return typeof x === "string" && (ART_STYLE_IDS as string[]).includes(x);
}
