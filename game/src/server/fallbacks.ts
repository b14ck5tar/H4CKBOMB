import "server-only";
import type { Band, Hero, RoundOutcome, SceneOpen, Storybook, Verdict } from "@/lib/types";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function fallbackHero(concept: string): Hero {
  return {
    name: pick(["Doug", "Marigold", "Wendell", "Priya", "Sal"]),
    epithet: "the Unexpected",
    pronouns: "they/them",
    concept_status: "ok",
    concept_note: "",
    stats: { brave: 1, clever: 3, charming: -1 },
    ability: { name: "Pocket Full of Stuff", text: "Pull exactly the right odd object from a pocket." },
    flaw: "Narrates their own actions out loud, badly.",
    roast: `The notes just say "${concept.slice(0, 40)}" and a coffee stain.`,
    visual: {
      anchor: "a small round cartoon character with a giant hoodie and wild hair",
      outfit: "oversized hoodie, mismatched sneakers",
      palette: ["teal", "orange", "magenta"],
      prop: "a bulging backpack",
      expression: "eager grin",
    },
  };
}

export function fallbackScene(heroIds: string[], plan: { location?: string; seeded_twist?: string; kind?: string }): SceneOpen {
  const where = plan.location ?? "The next stop";
  return {
    recap: "",
    narration: `${where}. ${plan.seeded_twist ?? "Something here is wrong, and it's getting worse."}`,
    question: plan.kind === "climax" ? "Can you end this tonight?" : "Can you get past this?",
    situation: plan.kind === "climax" ? "This is it. What's your final move?" : "What do you do?",
    banner: "Trouble",
    npc_line: { speaker: "", line: "" },
    clues: [],
    suggestions: heroIds.map((id) => ({ hero_id: id, ideas: ["Go straight at it", "Look for another way in", "Ask whoever's in charge"] })),
    music: "eerie",
  };
}

export function fallbackVerdict(pitchId: string, bestStat: Verdict["stat"]): Verdict & { pitch_id: string } {
  return {
    pitch_id: pitchId,
    interpretation: "Tries something bold and slightly unclear.",
    stat: bestStat,
    tier: "solid",
    ability_fits: false,
    flaw_walk_in: false,
    quip: pick(["Sure. Roll for it.", "The DM allows it.", "Fine. Dice, please."]),
    on_success: "It works.",
    on_failure: "It doesn't.",
    moderation: "ok",
  };
}

const BEAT: Record<Band, string> = {
  CATASTROPHE: "{name}, it goes wrong fast and in an order nobody predicted. You end up stuck somewhere you really shouldn't be.",
  FAIL: "{name}, you try it. The world declines, politely, and makes it a little worse.",
  YES_BUT: "{name}, it works. It also costs you something you'll miss later.",
  SUCCESS: "{name}, it works the way you said it would. Nobody is more surprised than you.",
  LEGENDARY: "{name}, it works better than it has any right to. Someone nearby starts clapping and can't stop.",
};

export function fallbackRound(actions: { hero_id: string; hero_name?: string; band?: Band }[]): RoundOutcome {
  const worst = actions.find((a) => a.band === "CATASTROPHE");
  return {
    headline: "Well, That Happened",
    beats: actions.map((a) => ({ hero_id: a.hero_id, text: BEAT[a.band ?? "FAIL"].replaceAll("{name}", a.hero_name ?? "You") })),
    now: "Everyone is still here, which counts for something.",
    complication: actions.some((a) => a.band === "FAIL" || a.band === "CATASTROPHE") ? "Somebody definitely noticed all that." : "",
    titles: [],
    peril: worst ? { hero_id: worst.hero_id, text: "stuck somewhere very inconvenient" } : { hero_id: "", text: "" },
    new_canon: [],
    threat_mood: "",
    highlight_score: 5,
    sfx: "none",
  };
}

export const FALLBACK_EPILOGUE =
  "The dice land and, somehow, it holds. Everyone goes home with a story nobody will believe. And that's the version they'll never print.";

export function fallbackStorybook(title: string, heroes: { id: string; name: string }[], images: string[]): Storybook {
  return {
    title,
    dedication: `For ${heroes.map((h) => h.name).join(", ")}, who were there.`,
    pages: [
      { text: "It started like any other night, which is how these things always start.", image_ref: images[0] },
      { text: "They tried things. Some of those things worked. Others are now stories for the wrong reasons.", image_ref: images[1] ?? images[0] },
      { text: "But when it mattered, they rolled together.", image_ref: images[images.length - 1] },
      { text: "The town was, against every reasonable expectation, a little better than before.", image_ref: images[images.length - 1] },
    ],
    hero_pages: heroes.map((h) => ({ hero_id: h.id, best_moment: `${h.name} showed up, which is half of anything.`, award: "Showed Up" })),
    moral: "Go together or don't go.",
    real_story_bridge: "Every story has a real one underneath. Here's this one.",
  };
}
