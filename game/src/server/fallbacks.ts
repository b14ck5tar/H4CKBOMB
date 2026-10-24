import "server-only";
import type { Band, Hero, QuestPick, Rating, RealAnswers, RoundOutcome, SceneOpen, Storybook, Verdict } from "@/lib/types";
import { HEAVY, cleanText, skillPhrase, type PickInput } from "@/server/real";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** "I'm scared of the dark." becomes "the dark". "" when it's too long or too heavy for a canned joke. */
function fearPhrase(fear: string) {
  const s = cleanText(fear, 80)
    .replace(/^(i'?m|i am|im)\s+/i, "")
    .replace(/^(really|very|kind of|kinda|a little|low[- ]?key)\s+/i, "")
    .replace(/^(scared|afraid|terrified|frightened)\s+(of|by)\s+/i, "")
    .replace(/[\s.!?,;:]+$/, "");
  return s && !HEAVY.test(s) && s.split(" ").length <= 6 ? (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s) : "";
}

export function fallbackHero(concept: string, real: RealAnswers = { skill: "", fear: "", talk: "" }): Hero {
  const skill = HEAVY.test(real.skill) ? "" : skillPhrase(real.skill);
  const fear = fearPhrase(real.fear);
  const heavy = HEAVY.test(real.skill) || HEAVY.test(real.fear);
  const note = String(concept || skill || "a hero who showed up").slice(0, 40);
  return {
    name: pick(["Doug", "Marigold", "Wendell", "Priya", "Sal"]),
    epithet: "the Unexpected",
    pronouns: "they/them",
    concept_status: heavy ? "redirected" : "ok",
    concept_note: heavy ? "The notes got a little smudged, so the DM filled in the gaps." : "",
    stats: { brave: 1, clever: 3, charming: -1 },
    ability: skill
      ? { name: "Weirdly Good At It", text: `Bring your ${skill} to any problem, once, and it helps.` }
      : { name: "Pocket Full of Stuff", text: "Pull exactly the right odd object from a pocket." },
    // Comedy in the fiction only: the hero has bad luck with it. Nobody is asked to do anything for real.
    flaw: fear ? `Has the worst luck with ${fear}, at the worst moments.` : "Narrates their own actions out loud, badly.",
    roast: `The notes just say "${note}" and a coffee stain.`,
    visual: {
      anchor: "a small round cartoon character with a giant hoodie and wild hair",
      outfit: "oversized hoodie, mismatched sneakers",
      palette: ["teal", "orange", "magenta"],
      prop: "a bulging backpack",
      expression: "eager grin",
    },
  };
}

export function fallbackScene(
  heroIds: string[],
  plan: { location?: string; seeded_twist?: string; kind?: string },
  real: { partyReal?: { hero_id?: string; skill?: string }[]; spotlight?: { hero_id?: string }[] } = {},
): SceneOpen {
  const where = plan.location ?? "The next stop";
  // A spotlighted hero who shared a skill gets a clue and one idea that invite it (never require it).
  const lit = new Set((Array.isArray(real.spotlight) ? real.spotlight : []).map((s) => String(s?.hero_id ?? "")));
  const skillOf = (id: string) => {
    const r = (Array.isArray(real.partyReal) ? real.partyReal : []).find((p) => p?.hero_id === id);
    return r && !HEAVY.test(String(r.skill ?? "")) ? skillPhrase(String(r.skill ?? ""), 5) : "";
  };
  return {
    recap: "",
    narration: `${where}. ${plan.seeded_twist ?? "Something here is wrong, and it's getting worse."}`,
    question: plan.kind === "climax" ? "Can you end this tonight?" : "Can you get past this?",
    situation: plan.kind === "climax" ? "This is it. What's your final move?" : "What do you do?",
    banner: "Trouble",
    npc_line: { speaker: "", line: "" },
    clues: heroIds.filter((id) => lit.has(id) && skillOf(id)).map((id) => ({ hero_id: id, clue: `Your knack for ${skillOf(id)} might be the way in here.` })),
    suggestions: heroIds.map((id) => {
      const skill = lit.has(id) ? skillOf(id) : "";
      return { hero_id: id, ideas: ["Go straight at it", skill ? `Use my knack for ${skill}` : "Look for another way in", "Ask whoever's in charge"] };
    }),
    music: "eerie",
  };
}

/** Possessive for a name: "Ava's", "James's". */
const poss = (name: string) => `${name}'s`;

/** One line for the DM's notes: when a hero's real skill could matter. Used by the fallback and to patch bad picks. */
export function spotlightHow(heroName: string, skill: string, scene: 0 | 1 | 2, rating: Rating) {
  const name = heroName || "This hero";
  const s = HEAVY.test(skill) ? "" : skillPhrase(skill);
  if (!s)
    return rating === "kids" ? `${name} gets a turn to spot something nobody else saw.` : `${name} gets a moment to spot what everyone else missed.`;
  if (rating === "kids")
    return [`${poss(name)} ${s} could help get things started.`, `${poss(name)} ${s} might help when things get tricky.`, `${poss(name)} ${s} could save the day at the end.`][scene];
  return [`${poss(name)} ${s} could be the way in here.`, `When the twist hits, ${poss(name)} ${s} might be the way around it.`, `At the very end, ${poss(name)} ${s} could tip it.`][scene];
}

/** "Pick the best story for us" without Muse: the first candidate, spotlights round-robin over the 3 scenes. */
export function fallbackPickQuest(inp: PickInput): QuestPick {
  const first = inp.candidates[0];
  const title = first?.title || "this one";
  const why = {
    kids: `Let's start with ${title}. Everyone gets a turn to shine.`,
    teens: `The quick pick is ${title}, with a moment for each of you.`,
    adults: `The DM's backup pick is ${title}, with a moment for each of you.`,
  }[inp.rating];
  return {
    quest_id: first?.id ?? "",
    why,
    spotlights: inp.party.map((p, i) => {
      const scene = (i % 3) as 0 | 1 | 2;
      return { hero_id: p.hero_id, scene, how: spotlightHow(p.hero_name || p.name, p.skill, scene, inp.rating) };
    }),
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

/** Words that mean a draft can't be shown as written when the kindness pass is unavailable. */
const UNKIND = /\b(stupid|dumb|idiot|moron|ugly|fat|hate|hated|sucks?|sucked|loser|worst|annoying|useless|lame|trash|garbage|pathetic|shut up|creep|weirdo|fuck\w*|shit\w*|bitch\w*|ass|asshole|crap)\b/i;

export interface KindInput {
  ward_name?: string;
  pronouns?: string;
  frame?: string;
  moments?: { pitch?: string; what_happened?: string }[];
  draft?: string;
}

/** Mirror, Mirror without Muse: keep a kind draft, otherwise write a warm line from the ward's own best moment. */
export function fallbackKind(input: KindInput): { ok: boolean; sentence: string } {
  const frame = String(input.frame || `${input.ward_name || "They"} was at their best when`).trim();
  const subj = input.pronouns === "he/him" ? "he" : input.pronouns === "she/her" ? "she" : "they";
  const draft = String(input.draft ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  let rest = draft.toLowerCase().startsWith(frame.toLowerCase()) ? draft.slice(frame.length).trim() : draft;
  rest = rest.replace(/^(when|…|\.\.\.)\s*/i, "").replace(/[\s.!?,]+$/, "");
  if (rest.split(/\s+/).length >= 2 && !UNKIND.test(rest)) return { ok: true, sentence: `${frame} ${rest}.` };
  const pitch = String(input.moments?.[0]?.pitch ?? "").replace(/[<>"“”]/g, "").replace(/[\s.!?]+$/, "").slice(0, 70);
  return {
    ok: !draft,
    sentence: pitch ? `${frame} ${subj} said "${pitch}" and went all in.` : `${frame} ${subj} stayed in it with everyone, start to finish.`,
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
