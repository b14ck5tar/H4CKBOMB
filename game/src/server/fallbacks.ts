import "server-only";
import type { Band, Hero, RealAnswers, RoundOutcome, SceneOpen, Storybook, Verdict } from "@/lib/types";
import { HEAVY, fearPhrase, skillPhrase } from "@/lib/real";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// Safety: canned content never echoes player text (a failed call must not put an unreviewed concept on the TV).
export function fallbackHero(real: RealAnswers = { skill: "", fear: "" }): Hero {
  // The real answers are the player's own words about themselves, shown back only as their hero's power and weakness.
  const skill = skillPhrase(real.skill);
  const fear = fearPhrase(real.fear);
  const heavy = HEAVY.test(real.skill) || HEAVY.test(real.fear);
  return {
    name: pick(["Doug", "Marigold", "Wendell", "Priya", "Sal"]),
    epithet: "the Unexpected",
    pronouns: "they/them",
    concept_status: heavy ? "redirected" : "ok",
    concept_note: heavy ? "The notes got a little smudged, so the DM filled in the gaps." : "",
    stats: { brave: 1, clever: 3, charming: -1 },
    ability: skill
      ? { name: "Weirdly Good At It", text: `Bring your ${skill} to any problem, and it helps.` }
      : { name: "Pocket Full of Stuff", text: "Pull exactly the right odd object from a pocket." },
    // Comedy in the fiction only: the hero has bad luck with it. Nobody is asked to do anything for real.
    flaw: fear ? `Has the worst luck with ${fear}, at the worst moments.` : "Narrates their own actions out loud, badly.",
    roast: pick(["The DM's notes on this one are mostly a coffee stain.", "Nobody is sure what they do. Including them.", "Showed up with a backpack and no plan. Perfect."]),
    visual: {
      anchor: "a small round cartoon character with a giant hoodie and wild hair",
      outfit: "oversized hoodie, mismatched sneakers",
      palette: ["teal", "orange", "magenta"],
      prop: "a bulging backpack",
      expression: "eager grin",
    },
  };
}

type PartyHero = { id?: string; ability?: { name?: string; text?: string } };

/** A clue that still comes from the hero's own edge when the AI is down. Mirrored in host.ts (fallbackClue). */
export function fallbackClue(h: PartyHero, location = "this place") {
  const name = String(h.ability?.name ?? "").trim();
  const text = String(h.ability?.text ?? "").trim().replace(/[.!]+$/, "");
  return {
    hero_id: String(h.id ?? ""),
    clue: name ? `Your ${name} picks up the one weak spot in ${location} that nobody else sees.` : `You spot the one weak spot in ${location} that nobody else sees.`,
    because: text ? `you can ${text[0].toLowerCase()}${text.slice(1)}` : "you were paying attention",
  };
}

export function fallbackScene(heroIds: string[], plan: { location?: string; seeded_twist?: string; kind?: string }, party: PartyHero[] = []): SceneOpen {
  const where = plan.location ?? "The next stop";
  return {
    recap: "",
    narration: `${where}. ${plan.seeded_twist ?? "Something here is wrong, and it's getting worse."}`,
    question: plan.kind === "climax" ? "Can you end this tonight?" : "Can you get past this?",
    situation: plan.kind === "climax" ? "This is it. What's your final move?" : "What do you do?",
    banner: "Trouble",
    npc_line: { speaker: "", line: "" },
    clues: heroIds.map((id) => fallbackClue(party.find((p) => p.id === id) ?? { id }, where)),
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
    reason: "Backup ruling: the AI didn't answer, so every plan counts as Solid",
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

export const FALLBACK_EPILOGUE = {
  ending: "The die lands, and somehow the plan holds. Everyone goes home with a story nobody will believe.",
  line: "Nobody will believe it, but it happened.",
  recap: "",
};

/** Ruling backup: no AI, so the plan counts as Solid (and DM's Notes says the plan was never reviewed). */
export function fallbackRuling(bestStat: Verdict["stat"]) {
  return { interpretation: "", stat: bestStat, tier: "solid" as const, reason: "Backup ruling: the AI didn't answer, so the plan counts as Solid", moderation: "ok" as const };
}

/** Outcome backup. Never quotes the plan: it was never reviewed. */
export function fallbackOutcome(name: string, band: Band) {
  const n = name || "The hero";
  const lines: Record<Band, string> = {
    CATASTROPHE: `${n} tries it, and it goes wrong fast. Nobody is hurt, but the problem is now a little bigger.`,
    FAIL: `${n} gives it a real try, but it doesn't work this time. The problem is still right there.`,
    YES_BUT: `${n}'s plan helps a little, but it costs something. The problem isn't solved yet.`,
    SUCCESS: `${n}'s plan works, and the heroes get one step closer. The problem isn't solved yet.`,
    LEGENDARY: `${n}'s plan works better than anyone hoped, and the heroes get a big step closer.`,
  };
  return { text: lines[band] ?? lines.YES_BUT, situation: "", why: "", now_goal: "" };
}

export interface KindInput {
  ward_name?: string;
  pronouns?: string;
  frame?: string;
  moments?: { pitch?: string; what_happened?: string }[];
  draft?: string;
}

/**
 * Mirror, Mirror without Muse. Safety: unchecked text is never shown, so neither the guardian's draft nor the
 * ward's raw lines are echoed. A warm canned line stands in, picked from whether the ward had a moment tonight.
 */
export function fallbackKind(input: KindInput): { ok: boolean; sentence: string } {
  const frame = String(input.frame || `${input.ward_name || "They"} was at their best when`).trim();
  const subj = input.pronouns === "he/him" ? "he" : input.pronouns === "she/her" ? "she" : "they";
  const had = (input.moments ?? []).length > 0;
  return {
    ok: false,
    sentence: had ? `${frame} ${subj} went all in on a plan and made the whole table lean closer.` : `${frame} ${subj} stayed in it with everyone, start to finish.`,
  };
}

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
