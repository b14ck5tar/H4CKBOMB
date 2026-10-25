import "server-only";
import type { Rating } from "@/lib/types";
import { DM_CORE, withRating } from "@/server/prompts";
import { badExamplesPrompt, goalExamplesPrompt, outcomeExamplesPrompt } from "@/server/story-examples";
import { giveawayWords } from "./opener";
import { engineOf, stageJSON, stageLabel, type EngineId } from "./models";
import { sanitize, styleProblems, wordCount } from "./readability";
import { findPack, findStored, saveStored } from "./stored";
import { libraryStory } from "@/server/news/library";
import type { StoryBible } from "@/lib/beat";

/**
 * Story engine v2 (design/30-story-engine-v2.md): PLAN the story once, then TAILOR it live.
 *
 *   story_bible (once per chosen story, ~20-40 s, best model): setting, side cast, the problem's one rule, one act
 *     per turn (situation, Right now goal, planned twist, and three pre-written outcomes worse/mixed/better with
 *     {hero}/{action}/{friend} slots), the finale, three endings (triumph / mostly fine / well, it's a story) that
 *     land where the real story landed, and three callback lines.
 *   tailor (every turn, <= 3 s, fast model): the rolled branch's pre-written outcome rewritten for what the hero
 *     really did and the exact roll, keeping the planned beat and the next act's situation, so the story stays on
 *     its track. Output has the same shape as the "outcome" task (and the ending tailor the same as "epilogue"),
 *     so host.ts can swap calls without changing how it reads them.
 *
 * Coordination: reads the opener (stories/opener.ts) by data shape only: {situation, goal, narration, npc_line,
 * problem {name, stakes, pronoun}, beats[], real_setting}. Never edits it.
 */

// ---------------------------------------------------------------- types (shared with host.ts via lib/beat.ts)

export type { BibleAct, BibleBeat, BibleEnding, EndingTier, StoryBible } from "@/lib/beat";
export { BEAT_OF, ENDING_TIER, fillBeat } from "@/lib/beat";
export type BibleResult = {
  bible: StoryBible | null;
  meta: { engine: EngineId; model: string; ms: number; attempts: number; problems: string[]; cached?: boolean; stored?: boolean };
};

// ---------------------------------------------------------------- the bible prompt

const BIBLE_EXAMPLE_ACT = `EXAMPLE ACT (another story: a town's elf-costume record try, where the hats float whenever someone laughs; copy the shape, never the words):
{"situation": "Volunteers are handing out costumes and giggling, and every hat they hand out floats up over the bakery.",
 "goal": "Get the floating hats back down",
 "twist": "The hats only float while someone near them is laughing.",
 "outcomes": {
  "worse": {"text": "{hero} {action}, and the hats come down in a heap on the bakery awning. The baker laughs so hard that forty more take off.", "carry": "Forty hats are stuck up on the bakery awning."},
  "mixed": {"text": "{hero} {action}, and half the hats drop into the costume box. The other half drift over the side street, following the giggles.", "carry": "The rest of the hats hover over the giggling side street."},
  "better": {"text": "{hero} {action}, {friend}'s idea, and every hat settles back on the costume table. The table now floats an inch off the ground, which is fine.", "carry": "The hats stay put as long as nobody laughs."}}}
Next act's situation (all three branches lead here): "Two hundred elves in jingly shoes are jammed in the side street, and the count starts soon."
Ending line examples: "The clock strikes noon now, and also at a quarter past three, out of habit." / "The hats are framed in the town hall. Nobody is allowed to laugh near them."`;

const BIBLE_BASE = `${DM_CORE}

TASK: STORY BIBLE. You are the head writer. Before the game starts, plan the WHOLE story so every turn has a strong, pre-written beat. During the game a fast writer adapts your beat to what the player really did and how well they rolled, so every beat must work for ANY reasonable plan.

Input: opener (what the table has already heard: title, narration, goal, situation, npc_line, problem {name, stakes, pronoun}, beats = the story ladder, one step per real step), real_event (HIDDEN from players: the real place_type, roles, situation, stakes and arc in order), real_ending (HIDDEN: how the real story actually ended, only so your endings land in the same place; never use its words, names or numbers), heroes (names and powers of the players, possibly empty), turns (how many turns come before the finale), avoid_words (words that would spoil the reveal: never use them), motifs_used_tonight (themes earlier games tonight already used: never build a rule, twist or joke on them).

SAY WHAT IT IS AND WHERE: name the real thing and the real place plainly (owls, a pumpkin festival, a city roof, a zoo's baby animals). Hide ONLY how the real story turned out (its outcome and punchline), never what it is about. Never coin kennings or riddle names: "pale fliers", "soft white faces", "the loud street" are banned, say "owls", "the owls' faces", "the busy street". Never give away the real ending before the endings.

VARIETY: never lean on sleep, snoring, naps, lullabies, humming, glowing, whispers or anything "pale", nor on motifs_used_tonight. The problem's rule acts on a DIFFERENT kind of thing in each act's twist: the crowd, an object that belongs in the place, the weather, a mix-up, a friendly rival, a deadline.

WRITE
- setting: 2 sentences, 40 words max in total. The real kind of place and moment, with one specific, vivid detail, and the fantasy problem on top. Spoiler-free.
- problem: name = opener.problem.name exactly. stakes = one plain line. pronoun = opener.problem.pronoun ("none" if it is not a creature). rule = the ONE logic the problem follows, 16 words max ("the hats float whenever someone near them laughs"). Every escalation, twist and fix in the whole story follows this rule. That is what makes the story feel planned.
- cast: 2 or 3 side characters who really belong in real_event, by role (from real_event.roles). role (a few plain words), name (one ordinary first name like Marge, Dev, Rosa or Hank, never a hero's name, never a banned name), want (10 words max, the one thing they want), voice (8 words max, how they talk), line (12 words max, a dry sample line in that voice). The first one is the recurring side character: the opener's npc_line speaker if there is one.
- acts: exactly "turns" acts, one per turn, in order. Each act's goal is a sub-step that clearly leads to the finale goal (opener.goal): a player can see why doing it gets them closer. Together they follow opener.beats (spread over the turns) and real_event.arc in order. Act 1's situation is opener.situation, word for word, and act 1's goal is opener.beats[0]. Each act:
  - situation: 22 words max. What is in front of the group when this turn starts. It follows from ALL THREE outcomes of the act before (any branch leads here). Name a person or a thing a player can act on.
  - goal: the Right now goal. Verb-first, 8 words max, a vivid physical verb plus a thing in the situation, a real step toward opener.goal that a kid can tell is done. Never "deal with", "figure out", "try to", "keep", "continue", "handle", "investigate", "look for".
  - twist: 16 words max. The planned surprise this act reveals, caused by the problem's rule (never a random door, prop or the weather). It shows up in the mixed outcome and colors the others.
  - outcomes: worse, mixed and better. Each has:
    - text: 1 or 2 short sentences, 30 words max. It starts with exactly "{hero} {action}," where {hero} is the acting hero and {action} is a slot the live writer fills with what they really did. Then what the world does back: ONE concrete picture that follows from the problem's rule, said flatly. Plan-agnostic: never assume a method, a tool or a power.
      - worse: it backfires and the problem escalates by its own rule (it grows, jumps somewhere new, or drags in a cast member), but the story still arrives at the next act. A picture the table will retell. Funny, nobody hurt. Never mention {friend}.
      - mixed: half of it works, and the twist arrives. Never mention {friend}.
      - better: it works, a good path opens, plus one small bonus for the next hero. Credit {friend} once, in a few words, and use a DIFFERENT credit form in each act: "{friend}'s idea", "just like {friend} said", "on {friend}'s advice", "{friend} called it". Never "with {friend}'s help" (the live writer drops the credit when no friend's idea was used).
    - carry: 12 words max. The one fact this branch carries into the next act (worse: the extra complication; mixed: the twist; better: the bonus).
  - Every act moves the story one real step forward. No act repeats, undoes or redoes an earlier one. The outcomes of the last act lead into the finale.
  - PLAYERS DRIVE THE STORY. Your acts are a destination and a few guardrails, not a script: live, the chosen plan is what happens, a success moves the story the way the player meant, and a plan that opens a new path (challenge it to chess, hire it) is followed. So make each act's goal reachable from many directions, make the finale and endings land no matter which path the table took, and write the outcomes as examples of each result's strength and of the problem's logic, never as barriers. A strong success may skip a milestone.
- finale: situation (22 words max: where every branch of the last act lands, the problem at its biggest, the goal within reach), goal (opener.goal, verb-first, 8 words max), twist (16 words max, the last surprise, from the rule).
- endings: the payoff of the WHOLE story, one per ending tier. Each lands exactly where the real story landed (the last step of real_event.arc, and real_ending), told through the fantasy problem, so the reveal makes the table say "wait, that really happened".
  - triumph: the goal is done, and a cast member reacts like a real person, in their own voice.
  - mostly_fine: it is done, but one specific, silly thing is changed for good.
  - well_its_a_story: the problem wins in the gentlest, funniest way, the heroes are fine, and the place is oddly better.
  Each has text (2 short sentences, 40 words max, starting with exactly "{hero} {action},", saying the whole group pulled it off or went down together, paying off one of your callbacks) and line (12 words max, the last card, said flatly: "The snake works at the scrapyard now.").
- callbacks: exactly 3 short lines (10 words max each) planted in the acts that can come back later: a cast member's catchphrase, a running gag from the problem's rule, an object from the real place. At least one is planted in act 1 or 2 and paid off in the endings.

QUALITY BAR (check every line before you answer)
- Every narration is at most 2 short sentences. Never repeat a phrase, a sentence opening or a sentence shape from another beat in this bible: after "{hero} {action},", each beat continues differently (not always "and the X does Y").
- An 8-year-old follows it the first time: everyday words, plain cause and effect a listener could retell.
- House humor: iconic, a little dry and witty, unexpected but it makes sense. The joke is one specific detail that follows from the problem's rule, said flatly. The world takes the strange thing completely seriously.
- Inside the real event: its kind of place, its real roles as the cast, its everyday objects, its real stakes, its real order of events.
- Every act moves forward. At most one new object per act, and never a goal about a stray object.
- Connection: the acting hero is the star of every beat, and better credits the friend.
- No spoilers: never use real names, places, numbers, dates or brands, nor avoid_words, nor the real story's punchline. The endings land where the real story landed, in fantasy terms only.
- Never write a hero's name. Heroes appear only as {hero} and {friend}, and never get a pronoun (repeat the slot or rephrase).
- No game words in the story: never roll, dice, die, perfect, natural, needs, DC, points, luck or turn.

${BIBLE_EXAMPLE_ACT}`;

function bibleSystem(avoid: string) {
  return `${BIBLE_BASE}

VOICE REFERENCE: how finished turns read once the live writer has filled your slots.
${outcomeExamplesPrompt({ avoid, games: 2 })}

${goalExamplesPrompt(6)}

${badExamplesPrompt()}`;
}

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const beat = obj({ text: str, carry: str });

export function bibleSchema(turns: number) {
  return obj({
    setting: str,
    problem: obj({ name: str, stakes: str, pronoun: { type: "string", enum: ["she", "he", "it", "they", "none"] }, rule: str }),
    cast: { type: "array", minItems: 2, maxItems: 3, items: obj({ role: str, name: str, want: str, voice: str, line: str }) },
    acts: { type: "array", minItems: turns, maxItems: turns, items: obj({ situation: str, goal: str, twist: str, outcomes: obj({ worse: beat, mixed: beat, better: beat }) }) },
    finale: obj({ situation: str, goal: str, twist: str }),
    endings: obj({ triumph: obj({ text: str, line: str }), mostly_fine: obj({ text: str, line: str }), well_its_a_story: obj({ text: str, line: str }) }),
    callbacks: { type: "array", minItems: 3, maxItems: 3, items: str },
  });
}

// ---------------------------------------------------------------- inputs (shape only, clipped)

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const clip = (s: unknown, n: number) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const list = (x: unknown, k: number, n: number) => (Array.isArray(x) ? x.map((v) => clip(v, n)).filter(Boolean).slice(0, k) : []);

export type BibleInput = {
  opener: Any;
  real_event?: Any;
  ending_facts?: Any;
  news?: { headline?: string; snippet?: string; source?: string; place?: string };
  party?: { name?: string; power?: string }[];
  turns: number;
  rating: Rating;
  engine?: string;
  cache_key?: string;
  /** Save the new bible in data/story_bibles.json (dev). Library stories are always saved. */
  store?: boolean;
  /** Themes earlier games tonight already used (design/29 #6): never leaned on again. */
  motifs_used_tonight?: string[];
};

export function turnsOf(x: unknown) {
  const n = Math.round(Number(x));
  return Number.isFinite(n) ? Math.max(2, Math.min(8, n)) : 3;
}

function bibleUser(i: BibleInput, avoidWords: string[], prev?: { draft: StoryBible; problems: string[] }) {
  const o = i.opener ?? {};
  const r = i.real_event ?? o.real_setting ?? {};
  const ef = i.ending_facts ?? {};
  const u: Any = {
    opener: {
      title: clip(o.quest_title ?? o.title, 80),
      narration: clip(o.narration, 400),
      goal: clip(o.goal, 120),
      situation: clip(o.situation, 240),
      npc_line: o.npc_line?.speaker ? { speaker: clip(o.npc_line.speaker, 60), line: clip(o.npc_line.line, 160) } : null,
      problem: { name: clip(o.problem?.name ?? o.threat?.name, 60), stakes: clip(o.problem?.stakes ?? o.threat?.want, 160), pronoun: clip(o.problem?.pronoun ?? "none", 8) || "none" },
      beats: list(o.beats, 6, 100),
    },
    real_event: { place_type: clip(r.place_type, 120), roles: list(r.roles, 5, 60), situation: clip(r.situation, 200), stakes: clip(r.stakes, 160), arc: list(r.arc, 6, 100) },
    real_ending: clip(ef.official_line ?? ef.real_ending ?? "", 300),
    heroes: (i.party ?? []).slice(0, 8).map((p) => ({ name: clip(p?.name, 40), power: clip(p?.power, 100) })),
    turns: turnsOf(i.turns),
    avoid_words: avoidWords.slice(0, 40),
    motifs_used_tonight: list(i.motifs_used_tonight, 12, 30),
  };
  let s = JSON.stringify(u);
  if (prev) s += `\n\nYour previous draft had problems. Write a new version that fixes ALL of them and keeps what worked.\nPREVIOUS DRAFT: ${JSON.stringify(prev.draft)}\nPROBLEMS:\n${prev.problems.map((p) => `- ${p}`).join("\n")}`;
  return s;
}

// ---------------------------------------------------------------- checks (code, no AI)

const NOT_VERB_START = /^(the|a|an|to|you|your|we|our|they|their|it|its|this|that|there|now|then|before|after|if|when|everyone|someone|nobody|heroes?)\b/i;
const VAGUE_GOAL = /\b(deal with|figure out|try to|keep|continue|handle|investigate|look for)\b/i;
const BANNED_NAMES = /\b(Elara|Lyra|Thorne|Kael|Seraphina|Vex|Voss|Aldric|Zephyr|Nyx|Eldoria)\b/;

function hits(text: string, words: string[]) {
  return words.filter((w) => (/^[A-Z0-9]/.test(w) ? new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text) : false));
}

/** Problems a retry should fix. Serious ones (structure, spoilers, names) are prefixed "!" and always trigger a retry. */
export function bibleProblems(b: StoryBible, turns: number, avoidWords: string[], heroNames: string[]): string[] {
  const out: string[] = [];
  if (b.acts.length !== turns) out.push(`! acts: need exactly ${turns}, got ${b.acts.length}`);
  const all = JSON.stringify(b);
  const spoil = hits(all, avoidWords);
  if (spoil.length) out.push(`! spoiler: uses ${spoil.slice(0, 6).join(", ")} (never use avoid_words)`);
  const heroes = heroNames.filter((n) => n.length > 2 && new RegExp(`\\b${n}\\b`, "i").test(all.replace(/\{hero\}|\{friend\}/g, "")));
  if (heroes.length) out.push(`! names a hero (${heroes.join(", ")}): heroes appear only as {hero} and {friend}`);
  if (BANNED_NAMES.test(all)) out.push("! uses a banned name");
  const goals = new Set<string>();
  b.acts.forEach((a, k) => {
    const n = k + 1;
    if (wordCount(a.situation) > 26) out.push(`act ${n} situation is ${wordCount(a.situation)} words (22 max)`);
    if (wordCount(a.goal) > 9 || NOT_VERB_START.test(a.goal) || VAGUE_GOAL.test(a.goal)) out.push(`act ${n} goal "${a.goal}" must be verb-first, 8 words max, no vague verbs`);
    const g = a.goal.toLowerCase();
    if (goals.has(g)) out.push(`! act ${n} repeats an earlier goal`);
    goals.add(g);
    for (const br of ["worse", "mixed", "better"] as const) {
      const t = a.outcomes[br].text;
      if (!/^\{hero\} \{action\}/.test(t)) out.push(`act ${n} ${br} must start with "{hero} {action},"`);
      if (wordCount(t) > 34) out.push(`act ${n} ${br} text is ${wordCount(t)} words (30 max)`);
      if (br !== "better" && t.includes("{friend}")) out.push(`! act ${n} ${br} mentions {friend} (only better may)`);
    }
  });
  for (const t of ["triumph", "mostly_fine", "well_its_a_story"] as const) {
    if (!/^\{hero\} \{action\}/.test(b.endings[t].text)) out.push(`ending ${t} must start with "{hero} {action},"`);
    if (wordCount(b.endings[t].text) > 46) out.push(`ending ${t} is ${wordCount(b.endings[t].text)} words (45 max)`);
  }
  const style = styleProblems(all.replace(/\{\w+\}/g, ""));
  out.push(...style.map((s) => `style: ${s}`));
  return out;
}

/** Last-resort fixes in code: punctuation, slots, the friend rule. Never changes meaning. */
function tidy(b: StoryBible): StoryBible {
  const fixText = (t: string) => {
    let s = sanitize(t);
    if (!/^\{hero\}/.test(s)) s = `{hero} {action}, and ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
    else if (!/^\{hero\} \{action\}/.test(s)) s = s.replace(/^\{hero\}\s*/, "{hero} {action}, ");
    return s;
  };
  const noFriend = (t: string) => t.replace(/,?\s*\{friend\}'s idea,?/g, ",").replace(/\{friend\}/g, "a friend").replace(/,\s*,/g, ",");
  const goal = (g: string) => sanitize(g).replace(/[.!]+$/, "");
  return {
    ...b,
    setting: sanitize(b.setting),
    problem: { ...b.problem, rule: sanitize(b.problem.rule) },
    cast: b.cast.map((c) => ({ ...c, line: sanitize(c.line) })),
    acts: b.acts.map((a) => ({
      situation: sanitize(a.situation),
      goal: goal(a.goal),
      twist: sanitize(a.twist),
      outcomes: {
        worse: { text: noFriend(fixText(a.outcomes.worse.text)), carry: sanitize(a.outcomes.worse.carry) },
        mixed: { text: noFriend(fixText(a.outcomes.mixed.text)), carry: sanitize(a.outcomes.mixed.carry) },
        better: { text: fixText(a.outcomes.better.text), carry: sanitize(a.outcomes.better.carry) },
      },
    })),
    finale: { situation: sanitize(b.finale.situation), goal: goal(b.finale.goal), twist: sanitize(b.finale.twist) },
    endings: Object.fromEntries(Object.entries(b.endings).map(([k, e]) => [k, { text: fixText(e.text), line: sanitize(e.line) }])) as StoryBible["endings"],
    callbacks: b.callbacks.map(sanitize),
  };
}

// ---------------------------------------------------------------- make (with an in-memory cache)

/**
 * In-memory, per server instance. Keyed by the story + turns + rating + engine, so the vote-start prewarm and the
 * vote-end call share one promise. On Vercel each instance has its own memory: a cold instance just writes it again.
 */
const CACHE = new Map<string, Promise<BibleResult>>();
const CACHE_MAX = 40;

export function bibleKey(i: BibleInput) {
  const o = i.opener ?? {};
  const story = clip(i.cache_key || i.news?.headline || o.quest_title || o.title || o.situation, 160);
  return `${story}|${turnsOf(i.turns)}|${i.rating}|${engineOf(i.engine)}`;
}

/**
 * A pre-built story pack (opener + reveal facts + bible) for a library story, or null. Instant, no AI: the host asks
 * for it before writing an opener, and plays the pack's opener so the bible matches it.
 */
export function storedPack(storyId: unknown, rating: Rating, turns: unknown) {
  const p = findPack(clip(storyId, 120), rating, turnsOf(turns));
  if (!p) return null;
  return { opener: p.entry.opener, ending_facts: p.entry.ending_facts ?? null, bible: p.bible, meta: { model: p.entry.model, made_at: p.entry.made_at, stored: true } };
}

export function makeBible(i: BibleInput, opts: { deadlineMs?: number } = {}): Promise<BibleResult> {
  const turns = turnsOf(i.turns);
  // 1) A pre-built bible for this story + opener + audience (scripts/prebuild-bibles.mjs): instant, no AI.
  const id = clip(i.cache_key, 120);
  const st = findStored(id, i.opener, i.rating, turns);
  if (st) return Promise.resolve({ bible: st.bible, meta: { engine: engineOf(i.engine), model: st.entry.model, ms: 0, attempts: 0, problems: [], stored: true } });
  // 2) One being written already (the vote-start prewarm and the vote-end call share it).
  const key = bibleKey(i);
  const hit = CACHE.get(key);
  if (hit) return hit.then((r) => ({ ...r, meta: { ...r.meta, cached: true } }));
  // 3) Write it now, and keep it for next time if it is a library story.
  const p = writeBible(i, opts.deadlineMs ?? 45_000).catch((e) => {
    CACHE.delete(key); // never cache a failure
    throw e;
  });
  CACHE.set(key, p);
  p.then((r) => {
    if (!r.bible) return CACHE.delete(key);
    if (id && (i.store || libraryStory(id))) saveStored(id, i.opener, i.rating, turns, r.bible, r.meta.model, i.ending_facts);
  }).catch(() => {}); // the caller handles the failure; this chain must not raise an unhandled rejection
  if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
  return p;
}

async function writeBible(i: BibleInput, deadlineMs: number): Promise<BibleResult> {
  const t0 = Date.now();
  const engine = engineOf(i.engine);
  const turns = turnsOf(i.turns);
  const o = i.opener ?? {};
  const news = i.news?.headline ? { headline: clip(i.news.headline, 300), snippet: clip(i.news.snippet, 1000), source: clip(i.news.source, 120), url: "", date: "", place: clip(i.news.place, 80) } : null;
  const avoidWords = news ? giveawayWords(news) : [];
  const heroNames = (i.party ?? []).map((p) => clip(p?.name, 40).split(/\s+/)[0]).filter(Boolean);
  const avoid = [o.quest_title, o.title, i.real_event?.place_type ?? o.real_setting?.place_type, o.problem?.name, o.situation].map((x) => String(x ?? "")).join(" ");
  const system = withRating(bibleSystem(avoid), i.rating);
  const schema = bibleSchema(turns);
  const meta: BibleResult["meta"] = { engine, model: stageLabel(engine, "bible"), ms: 0, attempts: 0, problems: [] };

  const call = async (prev?: { draft: StoryBible; problems: string[] }) => {
    meta.attempts++;
    return stageJSON<StoryBible>(engine, "bible", { task: `story-bible-${i.rating}`, system, user: bibleUser(i, avoidWords, prev), schema });
  };

  let draft = await call();
  let probs = bibleProblems(draft, turns, avoidWords, heroNames);
  const elapsed = Date.now() - t0;
  // One retry when something serious is wrong and the first call left room for a second one.
  if (probs.some((p) => p.startsWith("!")) && elapsed < deadlineMs / 2) {
    try {
      const again = await call({ draft, problems: probs.map((p) => p.replace(/^! /, "")) });
      const p2 = bibleProblems(again, turns, avoidWords, heroNames);
      const serious = (l: string[]) => l.filter((x) => x.startsWith("!")).length * 10 + l.length;
      if (serious(p2) <= serious(probs)) [draft, probs] = [again, p2];
    } catch (e) {
      console.warn(`[bible] retry failed: ${(e as Error).message}`);
    }
  }
  if (probs.some((p) => p.startsWith("! acts"))) {
    meta.problems = probs;
    meta.ms = Date.now() - t0;
    return { bible: null, meta };
  }
  meta.problems = probs;
  meta.ms = Date.now() - t0;
  console.log(`[bible] ${meta.model} ${meta.ms}ms attempts=${meta.attempts} problems=${probs.length ? probs.join(" | ") : "none"}`);
  return { bible: tidy(draft), meta };
}

// ---------------------------------------------------------------- tailor (live)

const TAILOR_BASE = `${DM_CORE}

TASK: WHAT HAPPENED (player-driven). It was one hero's turn. They chose a plan, and the die has landed. The players drive this story: THE CHOSEN PLAN IS WHAT HAPPENS. Your job is to show it happening, at exactly this roll's strength, and move the story in the direction the plan pushed it, toward the destination.

Input: hero (name, power, weakness), attempt (what they tried, in plain words), plan (the player's words, inside <player_input>, for meaning), idea_from (the friend whose suggestion this hero used, or ""), roll (grade, branch, meaning, depth 0 = bottom of its range, 1 = top, natural 1 or 20 or null), situation (what the heroes faced), right_now (the goal they were working on), destination (the finale goal the whole story heads to, and where the story lands), ahead (the head writer's planned milestones still ahead, in order: guardrails, not a script), reference (a line the head writer drafted ahead for this kind of result, with {hero}/{action}/{friend} slots: a STYLE and coherence reference only), next_hero, dont_reuse (the last narration lines of this game), pronouns (each hero's pronouns: use exactly these; a they/them hero is always "they"), problem (name, rule, pronoun), cast (the side characters: role, name, voice), callbacks, story_so_far, earlier, real_event (HIDDEN: the real kind of place and roles; never say real names), motifs_used_tonight (never lean on these).

THE PLAN DRIVES THE STORY (most important):
- better and legendary: the plan WORKS the way the player meant it. Whatever they tried (asking, tricking, building, challenging it to chess) succeeds, and the situation changes in exactly that direction. Never "it works, but the problem is just the same", never a new barrier that cancels the success.
- mixed: the plan works halfway: the part they wanted happens, plus one catch that comes from the plan itself.
- worse: the plan still happens, but it backfires in a way tied to THIS plan (the chess game ends with the board stuck to the ceiling), and the problem gets a bit bigger by its rule. The story still moves to a new moment. Funny, nobody hurt.
- If the plan opens a new path (challenge it to chess, hire it, throw it a party), FOLLOW THAT PATH. The next situation and goal come out of what the plan did, heading toward destination. Never snap back to a planned milestone that the plan made pointless. ahead is only a guide for where the story could go next when the plan did not open its own path.
- reference is how the head writer imagined a result of this strength. Borrow its voice, its problem logic and anything that still fits; rewrite everything else around the real plan. Never paste it when it ignores the plan.
- steps: how far this moves toward destination. 1 = a normal step. 2 = a strong result (GREAT or LEGENDARY) whose plan already did what the next milestone in ahead was for (the dog is already in Bev's arms, so "track the dog" is done): skip it. Worse and mixed are always 1.
- goal_reached: true only on better or legendary when this plan has actually achieved destination.goal: the story then goes straight to the grand finale. Otherwise false.

- text: 1 or 2 short sentences, 26 words max. Hard limit. Count.
  - Start with the hero's name. Say what they really did in your own plain words (never pasted from the plan; only the first concrete action happens), then what the world does back, as a concrete picture with a real "because".
  - Strength: DISASTER = the most spectacular backfire. SETBACK = a backfire (depth shades it: 2 is worse than 5). PARTIAL = halfway with a catch. PROGRESS = works, a small wobble at low depth, clean at high depth. GREAT = works, plus a bonus for the next hero. LEGENDARY = works better than anyone hoped, and a cast member reacts in a specific, human way.
  - dont_reuse holds the last narration lines of this game: never reuse their phrases, their opening words after the name, or their sentence shape.
  - If the plan uses the hero's power, show the power doing it. weakness is only sent on worse: use it only if this exact plan walks into it.
  - Friend: if idea_from is set and branch is better or legendary, credit them in a few words ("Rosa's idea", "just like Rosa said", "on Rosa's advice", "Rosa called it"). Never "with Rosa's help", and never invent an action for the friend. Never name a friend on worse or mixed.
  - No slot braces in your answer. Call things what they are (owls, the zoo keeper). Never coin riddle names ("pale fliers").
- situation: 22 words max, present tense. The NEW moment this plan created, clearly different from the old situation, with something specific next_hero can act on (it may name next_hero, never as its first word). If goal_reached, the moment right before the finale.
- now_goal: the next step from HERE toward destination.goal, along the path this plan opened (ahead[steps - 1] reworded to fit, if the plan did not open its own path). Verb-first, 8 words max, a vivid physical verb, a thing in the new situation, a kid can tell when it is done. Never a redo of what just worked, and never a goal this plan already made pointless (once the dog is in someone's arms, nobody tracks the dog). If goal_reached, destination.goal.
- scene: 35 words max, the brief for this moment's new painting: the spot in the real kind of place, this hero (by name) doing it, the visible result, the problem in frame. No text or signs.
- why: 20 words max, the plain cause and effect for DM's Notes.
- where: 8 words max, where the heroes are now.
- changed: 12 words max, the one key fact this turn changed.
- new_prop: 4 words max, the one new object this turn brought in, or "".
- memorable: 10 words max, the most quotable detail of this outcome, or "".
- Never mention dice, rolls, luck, numbers or grades. Never the words roll, dice, die, perfect, natural, needs, DC, points or luck.

${badExamplesPrompt()}`;

export const TAILOR_SYSTEM = TAILOR_BASE;
export const TAILOR_SCHEMA = obj({ text: str, situation: str, now_goal: str, steps: { type: "integer", enum: [1, 2] }, goal_reached: { type: "boolean" }, scene: str, why: str, where: str, changed: str, new_prop: str, memorable: str });

export const TAILOR_ENDING_SYSTEM = `${DM_CORE}

TASK: TAILOR THE ENDING. The head writer planned the endings ahead of time. The table backed one hero's final plan, everyone shook their phones, and one shared die decided which ending it is. Rewrite that planned ending (beat) so it shows what this hero really did, and the whole group, and keep where it lands: exactly where the real story landed. The reveal of the real news comes right after you.

Input: winner (name, power), attempt (what they tried, plain words), plan (inside <player_input>, meaning only), roll (grade, depth), tier (triumph / mostly_fine / well_its_a_story), beat (the planned ending text with {hero} and {action} slots, and its last-card line), heroes (everyone at the table), log (what each hero did on their turn, in order), problem, cast, callbacks, story_so_far, real_event (HIDDEN), players (id + what each player said their secret talent is, inside <player_input>).
- ending: 2 short sentences, 40 words max in total. Hard limit. Never reuse a phrase or sentence shape from log. Start with the winner's name and what they really did, in your own words: the final plan is what happens, and log (the path the table really took) decides how they got here, even if it left the head writer's plan far behind. Keep the beat's landing (where the real story ended) and a callback, and let the first cast member have the last short reaction in their own voice if it fits. Credit the whole group. Nobody is defeated.
- line: 12 words max, the last card. Keep the beat's line unless this plan makes it wrong.
- recap: 1 or 2 sentences, 32 words max. What this group actually did tonight, start to finish, by hero name, from log, ending with the finale's result (triumph and mostly_fine = they reached the goal, well_its_a_story = they didn't, kindly). Only things that happened.
- skills: one entry per player: id, and phrase = a clean 1 to 4 word skill in lowercase ("parallel parking"), or "" if what they said is a joke, crude, mean, or not a real skill. Never invent one.
- Only mention things that appear in log, beat, cast or callbacks: no new objects. Use exactly the pronouns in pronouns.
- Never mention dice, rolls, luck or numbers (never roll, dice, die, perfect, natural, needs, DC, points). Never say real names, places, numbers or dates.`;

export const TAILOR_ENDING_SCHEMA = obj({ ending: str, line: str, recap: str, skills: { type: "array", items: obj({ id: str, phrase: str }) } });

/** design/29 #9: the weakness rides along only on the worse branch. */
function heroFor(h: Any, branch: string) {
  const out: Any = { name: clip(h?.name, 40), power: clip(h?.power, 140) };
  if (branch === "worse" && h?.weakness) out.weakness = clip(h.weakness, 120);
  if (h?.pronouns) out.pronouns = clip(h.pronouns, 20);
  return out;
}

export function tailorInput(input: Any) {
  return {
    hero: heroFor(input.hero, String(input?.roll?.branch ?? "")),
    attempt: clip(input.attempt, 160),
    plan: input.plan,
    idea_from: clip(input.idea_from, 40),
    roll: input.roll,
    situation: clip(input.situation ?? input.act?.situation, 260),
    right_now: clip(input.right_now ?? input.act?.goal, 100),
    destination: { goal: clip(input.destination?.goal ?? input.finale?.goal, 100), lands: clip(input.destination?.lands, 200) },
    // The planned milestones still ahead (next act's goal, the ones after it): guardrails, not a script.
    ahead: list(input.ahead ?? [input.next?.goal].filter(Boolean), 6, 100),
    reference: input.beat ? { text: clip(input.beat.text, 300), carry: clip(input.beat.carry, 120) } : null,
    next_hero: clip(input.next_hero, 40),
    problem: input.problem,
    cast: Array.isArray(input.cast) ? input.cast.slice(0, 3) : [],
    callbacks: list(input.callbacks, 3, 90),
    story_so_far: input.story_so_far,
    earlier: list(input.earlier, 4, 240),
    dont_reuse: list(input.dont_reuse ?? input.earlier, 6, 240),
    real_event: input.real_event,
    pronouns: pronounMap(input.pronouns),
    motifs_used_tonight: list(input.motifs_used_tonight, 12, 30),
  };
}

export function pronounMap(x: unknown): Record<string, string> {
  if (!x || typeof x !== "object") return {};
  return Object.fromEntries(Object.entries(x as Record<string, unknown>).slice(0, 8).map(([k, v]) => [clip(k, 40), clip(v, 20)]));
}

const GAME_WORDS = /\b(dice|natural (1|20|one|twenty)|nat ?(1|20)|perfect roll|(a|the|good|bad|great|lucky) roll|needs? \d+\+?|DC)\b/i;
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Cheap post-checks on live text (design/29 #2, #10): game words in the fiction, or a they/them hero given
 * he/she pronouns in the same sentence. The route falls back to the filled beat on any problem.
 */
export function liveProblems(text: string, pronouns: Record<string, string>) {
  const out: string[] = [];
  const g = text.match(GAME_WORDS);
  if (g) out.push(`game word "${g[0]}"`);
  for (const [name, p] of Object.entries(pronouns)) {
    if (!/^they/i.test(p) || !name) continue;
    const re = new RegExp(`\\b${esc(name)}\\b`);
    for (const sent of text.split(/(?<=[.!?])\s+/)) {
      if (!re.test(sent) || !/\b(he|him|his|she|her|hers)\b/i.test(sent)) continue;
      // Someone else named in the sentence (a cast member) may own the pronoun: only flag when the hero is alone.
      const others = (sent.match(/\b[A-Z][a-z]+\b/g) ?? []).filter((w) => w !== name && !/^(The|A|An|And|But|So|Then|When|If|It|She|He|Her|His|They|Their|This|That|There|Now|One|Every|All)$/.test(w));
      if (!others.length) out.push(`wrong pronoun for ${name}`);
    }
  }
  return out;
}

export async function tailor(input: Any, rating: Rating) {
  const engine = engineOf(input.engine);
  return stageJSON<Any>(engine, "tailor", { task: `story-tailor-${rating}`, system: withRating(TAILOR_SYSTEM, rating), schema: TAILOR_SCHEMA, user: JSON.stringify(tailorInput(input)) });
}

export async function tailorEnding(input: Any, rating: Rating) {
  const engine = engineOf(input.engine);
  const u = {
    winner: input.winner,
    pronouns: pronounMap(input.pronouns),
    attempt: clip(input.attempt, 160),
    plan: input.plan,
    roll: input.roll,
    tier: input.tier,
    beat: input.beat,
    heroes: list(input.heroes, 8, 40),
    log: list(input.log, 10, 240),
    problem: input.problem,
    cast: Array.isArray(input.cast) ? input.cast.slice(0, 3) : [],
    callbacks: list(input.callbacks, 3, 90),
    story_so_far: input.story_so_far,
    real_event: input.real_event,
    players: Array.isArray(input.players) ? input.players.slice(0, 8) : [],
  };
  return stageJSON<Any>(engine, "tailor", { task: `story-tailor-ending-${rating}`, system: withRating(TAILOR_ENDING_SYSTEM, rating), schema: TAILOR_ENDING_SCHEMA, user: JSON.stringify(u), timeoutMs: 10_000 });
}
