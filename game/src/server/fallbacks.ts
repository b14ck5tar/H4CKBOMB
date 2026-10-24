import "server-only";
import type { Band, Hero, Outcome, SceneOpen, Storybook, Verdict } from "@/lib/types";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function fallbackHero(concept: string): Hero {
  return {
    name: pick(["Pip Thistlewick", "Mira Mossfoot", "Bramble Oakhart", "Wren Featherbell"]),
    epithet: "the Unexpected",
    pronouns: "they/them",
    concept_status: "ok",
    concept_note: "",
    stats: { brave: 1, clever: 3, charming: -1 },
    ability: { name: "Lucky Pocket", text: "Pull exactly the right odd object from a pocket." },
    flaw: "Narrates their own actions out loud, badly.",
    roast: `The scribes heard "${concept.slice(0, 40)}" and simply did their best.`,
    visual: {
      anchor: "a small cheerful adventurer with a patched cloak and wild hair",
      outfit: "patched green cloak, too-big boots",
      palette: ["forest green", "ochre", "crimson"],
      prop: "a bulging satchel",
      expression: "eager grin",
    },
  };
}

export function fallbackScene(heroIds: string[], situation: string): SceneOpen {
  return {
    recap_of_previous: "",
    narration: `The path bends, the wind shifts, and trouble arrives right on schedule. ${situation}`,
    situation,
    banner: "TROUBLE AHEAD",
    npc_line: { speaker: "", line: "" },
    suggestions: heroIds.map((id) => ({ hero_id: id, ideas: ["Charge in bravely", "Look for a clever trick", "Sing at it, loudly"] })),
    music: "tense",
  };
}

export function fallbackVerdict(pitchId: string, bestStat: Verdict["stat"]): Verdict & { pitch_id: string } {
  return {
    pitch_id: pitchId,
    interpretation: "Attempts something bold and slightly unclear.",
    stat: bestStat,
    tier: "solid",
    ability_fits: false,
    flaw_walk_in: false,
    quip: pick(["The DM squints… fine.", "Sure, why not.", "The scribes allow it."]),
    on_success: "It works.",
    on_failure: "It doesn't.",
    moderation: "ok",
  };
}

const BAND_LINES: Record<Band, string[]> = {
  CATASTROPHE: [
    "{name} attempts greatness. Greatness declines, loudly, with smoke. {name} is now dangling somewhere very inconvenient.",
    "With a heroic shout, {name} leaps — and lands in exactly the wrong place, upside down, as things start to circle.",
  ],
  FAIL: ["{name}'s plan unravels like a cheap scarf. The realm notices.", "It goes wrong in a way everyone saw coming except {name}."],
  YES_BUT: ["It works! Mostly. {name} wins the moment but loses a boot.", "{name} pulls it off, at a price nobody wanted to pay."],
  SUCCESS: ["{name} makes it look easy. The crowd of squirrels applauds.", "Clean, bold, and only slightly showing off — well done, {name}."],
  LEGENDARY: ["A natural twenty! {name} becomes a legend on the spot.", "Bards will argue for centuries about how {name} did that."],
};

export function fallbackOutcome(b: Band, name: string): Outcome {
  const fail = b === "FAIL" || b === "CATASTROPHE";
  return {
    headline: { CATASTROPHE: "Oh No.", FAIL: "Not Quite!", YES_BUT: "Sort Of!", SUCCESS: "Nailed It!", LEGENDARY: "LEGEND!" }[b],
    narration: pick(BAND_LINES[b]).replaceAll("{name}", name),
    yes_but_cost: b === "YES_BUT" ? "hope" : "none",
    complication: fail ? "The commotion has attracted unwanted attention." : "",
    shame_title: b === "CATASTROPHE" ? "the Upside-Down" : "",
    glory_title: b === "LEGENDARY" ? "the Legendary" : "",
    savior_title: "",
    peril: b === "CATASTROPHE" ? "stuck upside down while things circle below" : "",
    new_canon: [],
    threat_mood: "",
    highlight_score: b === "CATASTROPHE" || b === "LEGENDARY" ? 8 : 4,
    sfx: { CATASTROPHE: "record_scratch", FAIL: "sad_trombone", YES_BUT: "thud", SUCCESS: "fanfare", LEGENDARY: "choir" }[b],
  };
}

export const FALLBACK_EPILOGUE =
  "The dice land, the realm holds its breath, and the heroes do what heroes do: improvise wildly. Somehow, against all sensible odds, it works out. The threat is sent off with a stern talking-to and a packed lunch. And that is how it really happened... more or less.";

export function fallbackStorybook(title: string, heroes: { id: string; name: string }[], images: string[]): Storybook {
  return {
    title,
    dedication: `For ${heroes.map((h) => h.name).join(", ")}, who were there.`,
    pages: [
      { text: "Once upon a time, trouble came to the realm, and a most unlikely party answered the call.", image_ref: images[0] },
      { text: "They tried things. Some of those things worked. Others are now legends for the wrong reasons.", image_ref: images[1] ?? images[0] },
      { text: "But when it mattered, they rolled together.", image_ref: images[images.length - 1] },
      { text: "And the realm was, against all odds, a little better than before.", image_ref: images[images.length - 1] },
    ],
    hero_pages: heroes.map((h) => ({ hero_id: h.id, best_moment: `${h.name} showed up, which is half of any adventure.`, award: "Brave Showing-Up" })),
    moral: "Always roll with friends.",
    real_story_bridge: "Every tale has a true story underneath. Here is this one's.",
  };
}
