/**
 * One art theme per story (design/24 P5b, design/31): the AI picks one at game start. Every theme is a VARIATION of
 * the house style "Neon Ink" (server/art/style.ts INK_BASE): same hand-inked linework, flat matte cel color, solid
 * black shadows and the same hero designs, so heroes stay recognizable; the theme changes only palette, light,
 * texture and mood. `prompt` is appended to the ink base (neon uses the house STYLE + COLOR as is).
 */
export type ArtStyleId = "neon" | "comic" | "watercolor" | "retro" | "noir" | "gouache";

export const ART_STYLES: Record<ArtStyleId, { name: string; fits: string; prompt: string }> = {
  neon: {
    name: "Neon Ink",
    fits: "the default: strange news at night in town, streets, shops, odd things after dark",
    prompt: "", // the house style: server/art/style.ts STYLE + COLOR
  },
  noir: {
    name: "noir night",
    fits: "mysteries, disappearances, secrets, the unexplained, anything hidden",
    prompt:
      "Theme, noir night: near-monochrome palette of ink black, cool slate gray and pale moonlight, with ONE flat acid-yellow spot color on the impossible thing only; one hard side light raking through blinds or a doorway, long cast shadows, a wet rain sheen on the ground; hushed, secretive mood",
  },
  gouache: {
    name: "warm storybook",
    fits: "gentle and kids' stories, festivals, farms, animals being born, happy news, small towns",
    prompt:
      "Theme, warm storybook: limited palette of honey yellow, sage green, rose and sky blue on warm cream, flat matte colors with a faint dry-brush paper texture under the ink; one soft golden late-afternoon key light with warm shadows; cozy, friendly mood like a classic picture book",
  },
  retro: {
    name: "retro sci-fi poster",
    fits: "space, signals, science, the sky, technology, discoveries",
    prompt:
      "Theme, retro sci-fi poster: limited palette of teal, burnt orange, cream and deep navy, grainy screen-print texture with slight color misregistration, flat graphic stars and planets in a dark sky, a low dramatic horizon; one hard key light from the horizon; bold mid-century space-age mood",
  },
  watercolor: {
    name: "moody watercolor-ink",
    fits: "nature, rivers, coasts, forests, weather, the sea",
    prompt:
      "Theme, moody watercolor-ink: loose, transparent watercolor washes in muted moss green, slate blue and ochre inside the same confident ink lines, soft bleeding edges only in the background, mist and rain; one soft overcast key light; quiet, damp, wondering mood",
  },
  comic: {
    name: "sunny comic",
    fits: "daytime silliness, contests, records, crowds, sports, town events",
    prompt:
      "Theme, sunny comic: bright daylight palette of sunny yellow, sky blue, tomato red and mint on white, crisp solid-black shadows and bold Ben-Day dots in the sky; one hard noon sun key light; upbeat, slapstick mood like a Sunday comic cover",
  },
};

export const ART_STYLE_IDS = Object.keys(ART_STYLES) as ArtStyleId[];

export function isArtStyle(x: unknown): x is ArtStyleId {
  return typeof x === "string" && (ART_STYLE_IDS as string[]).includes(x);
}
