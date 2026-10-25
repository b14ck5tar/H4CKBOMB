/**
 * The procedural story engine (design/35-procedural-story-rules.md): players steer, the DM reacts.
 *
 * Pure and shared: the TV (host.ts) keeps one StoryState per game; the /api/ai "turn" task gets it, asks the model
 * for the outcome, then THIS code validates the answer and applies it (progress by grade, cast <= 3, facts <= 8,
 * one new thing per turn, no repeated Right now, clarity, game words, pronouns) and returns the next state.
 * If the model fails, fallbackTurn() still names the plan and applies its grade (rule 2), so the table never waits.
 */

import { FEATURES } from "./features";

export type Grade = "DISASTER" | "SETBACK" | "PARTIAL" | "PROGRESS" | "GREAT" | "LEGENDARY";

export type CastMember = { name: string; role: string; pronoun?: string };

/**
 * Story v3 (design/37): a thing that gets worse on its own, whatever the players do (a D&D "front"). One advances
 * every turn and shows in the scene, so the story always moves. stages = how it gets worse, in order (plain, short);
 * fix = a verb-first Right now for when the story needs a forced twist ("Keep the reporters away").
 */
export type Pressure = { name: string; stages: string[]; fix: string; level: number };

export type StoryState = {
  /** Where the heroes are right now (plain words, never a real place name). */
  where: string;
  /** The problem everyone is solving ("a lonely bison mom keeps hiding a lost dog"). */
  problem: string;
  /** What goes wrong if nobody solves it. */
  stakes: string;
  /** "What solved looks like", shown on screen all game (from the opener's goal). */
  finish_line: string;
  /** 0-100, moved by code from the grade. 100 = go to the finale early. */
  progress: number;
  /** Side characters, at most 3 (the opener's speaker first). */
  cast: CastMember[];
  /** Short true-in-this-story facts, at most 8 (oldest drop off). */
  facts: string[];
  /** At most one loose end the story can pick up ("the keeper still has the spare key"). */
  open_thread: string;
  /** The last 6 outcome lines (for flow and the never-repeat rule; a game has up to 8 turns). */
  last_moments: string[];
  /** Up to 2 funny lines or moments worth calling back. */
  memorable: string[];
  /** Each hero's pronouns by name ("Juno": "they/them"). */
  pronouns: Record<string, string>;
  /** The current "Right now" obstacle (verb-first, <= 8 words). */
  right_now: string;
  /** Every Right now used so far (the never-again guard). */
  goals_done: string[];
  /** What each hero did on their turns, for the ending's credits ("Gus: challenged the bison to a staring contest"). */
  credits: { name: string; did: string; grade: Grade }[];
  turn: number;
  /** How many turns this game has before the finale (the act clock). */
  turns_total: number;
  /** 1-3: each act is a different situation; a success that solves the step, or the clock, moves to the next. */
  act: number;
  /** The opener's fantasy hook (the one twist): it must stay in play in act 2 and in the finale. */
  hook: string;
  /** The real event behind the story (HIDDEN from players; the AI keeps it real). */
  real_event?: { place_type?: string; roles?: string[]; situation?: string; stakes?: string; arc?: string[] };
  /** v3: the story's starting problem in one plain sentence (the reveal refers back to it). */
  original_problem?: string;
  /** v3: 2-3 things that get worse on their own (one advances every turn). */
  pressures?: Pressure[];
  /** v3: every problem the table has faced so far (the never-the-same-situation-twice guard). */
  problems_seen?: string[];
};

/** What the model proposes for one turn (the "turn" task's raw answer). */
export type TurnProposal = {
  outcome: string;
  scene: string;
  right_now: string;
  /** How far this action logically moved things toward the finish line (0-100 scale, code clamps). */
  progress_gain: number;
  /** One plain line: why it moved that far (DM's Notes). */
  progress_why: string;
  new_fact: string;
  new_character: { name: string; role: string };
  where: string;
  open_thread: string;
  memorable: string;
  /** true when this plan solved the current step (only counts on a success): the act moves on. */
  step_solved: boolean;
  /** 1-3 sound cues for this slide (lib/storySfx.ts): { id, word }, in order. */
  sfx?: { id: string; word: number }[];
  /** v3: the NEW situation this turn created, in one plain sentence (what's wrong now). */
  problem_now?: string;
  /** v3: the model's own check: the earlier goal right_now is the same goal as (even reworded), or "". */
  repeat_of?: string;
  /** Lines said out loud in the outcome (FEATURES.castVoices): who says them, and the words inside the quote marks. */
  quotes?: { speaker: string; text: string }[];
};

/** What the TV shows for one turn, plus the next state. */
export type TurnResult = {
  outcome: string;
  scene: string;
  right_now: string;
  progress: number;
  progress_delta: number;
  progress_why: string;
  finale: boolean;
  act: number;
  act_changed: boolean;
  state: StoryState;
  problems: string[];
  fallback: boolean;
  /** The slide's sound cues (valid ids, in word order). */
  sfx?: { id: string; word: number }[];
  /** The outcome as narration and cast dialogue (FEATURES.castVoices), in reading order. */
  lines?: VoiceLine[];
};

const clip = (s: unknown, n: number) => String(s ?? "").replace(/[<>{}]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();

/** One piece of a line read aloud (FEATURES.castVoices): speaker "" = the narrator, else a cast member or a hero. */
export type VoiceLine = { speaker: string; text: string };

/**
 * Split a line into narration and quoted dialogue, for character voices. `quotes` is the model's own list
 * ([{speaker, text}]); a quote counts only if its speaker is known and its words sit inside quote marks in `text`,
 * so the pieces always add back up to the line. Anything else is the narrator's.
 */
export function voiceLines(text: string, quotes: unknown, speakers: string[]): VoiceLine[] {
  const known = new Map(speakers.filter(Boolean).map((n) => [norm(n), n]));
  const out: VoiceLine[] = [];
  let rest = text;
  for (const q of Array.isArray(quotes) ? quotes.slice(0, 3) : []) {
    const who = known.get(norm(String(q?.speaker ?? "")));
    const said = String(q?.text ?? "").replace(/^["“”\s]+|["“”\s]+$/g, "").trim();
    const at = who && said.length > 1 ? rest.indexOf(said) : -1;
    if (at < 1 || !/["“]/.test(rest[at - 1])) continue;
    // The closing mark may come after the quote's own punctuation: "Not again," says the warden.
    let end = at + said.length;
    while (end < rest.length && /[.!?,…]/.test(rest[end])) end++;
    if (!/["”]/.test(rest[end] ?? "")) continue;
    const before = rest.slice(0, at - 1).trim();
    if (before) out.push({ speaker: "", text: before });
    out.push({ speaker: who!, text: rest.slice(at - 1, end + 1).trim() });
    rest = rest.slice(end + 1);
  }
  if (rest.trim()) out.push({ speaker: "", text: rest.trim() });
  return out.length ? out : [{ speaker: "", text }];
}

// ---------------------------------------------------------------- progress (CD refinement: the AI judges, code clamps)

/**
 * HYBRID PROGRESS (CD, Sun): each grade has a guaranteed range, the AI picks inside it by logic (progress_gain +
 * progress_why), and code clamps. Ranges are multiples of "par" = 100 / turns, so a 2-turn and a 6-turn game both
 * land at the finale on time. Tuned with scripts/progress-sim.mjs (design/35 "Progress tuning").
 *   LEGENDARY 1.7-2.3 par (always big)   GREAT 1.3-1.7 par (always feels big)   PROGRESS 0.8-1.2 par
 *   PARTIAL 0.4-0.7 par                  SETBACK 0.1-0.25 par (momentum: small, never nothing)   DISASTER -0.25-0 par
 */
export const PROGRESS_PAR: Record<Grade, [number, number]> = {
  LEGENDARY: [1.7, 2.3],
  GREAT: [1.3, 1.7],
  PROGRESS: [0.8, 1.2],
  PARTIAL: [0.4, 0.7],
  SETBACK: [0.1, 0.25],
  DISASTER: [-0.25, 0],
};

/** The guaranteed [min, max] progress for a grade in a game of `turns` turns (whole numbers). */
export function progressRange(grade: Grade, turns: number): [number, number] {
  const par = 100 / Math.max(1, turns || 1);
  const [a, b] = PROGRESS_PAR[grade] ?? [0, 0];
  return [Math.round(a * par), Math.round(b * par)];
}

/** The AI's gain clamped into the grade's range (no number from the AI -> the middle of the range). */
export function progressDelta(grade: Grade, gain: unknown, turns = 4) {
  const [lo, hi] = progressRange(grade, turns);
  const g = Math.round(Number(gain));
  return Math.max(lo, Math.min(hi, Number.isFinite(g) ? g : Math.round((lo + hi) / 2)));
}

/**
 * Pacing, so the finale lands on time. Early finale: at most one turn early, and only in games of 4+ turns (the
 * meter stops at 90 before that, so a hot streak never ends the game on turn 2). Never stalled: when a turn goes
 * forward on PARTIAL or better, the meter is at least 35% of the way after turn t of T, and at least 75 after the
 * last turn (a backfire is never pushed forward). Returns the new progress after `turn` turns (1-based).
 */
export function paceProgress(prev: number, delta: number, turn: number, turns: number, grade?: Grade) {
  const T = Math.max(1, turns || 1);
  let p = Math.max(0, Math.min(100, prev + delta));
  const earliest = T >= 4 ? T - 1 : T;
  if (turn < earliest) p = Math.min(p, 90);
  const miss = grade === "SETBACK" || grade === "DISASTER";
  if (delta > 0 && !miss) p = Math.max(p, prev, turn >= T ? 75 : Math.round((35 * turn) / T));
  return p;
}

const WON = (g: Grade) => g === "PROGRESS" || g === "GREAT" || g === "LEGENDARY";

// ---------------------------------------------------------------- the opener -> the first state

/** The first state from an opener (/api/story/opener or a stored library opener). finish_line = the opener's goal. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stateFromOpener(opener: any, party: { name: string; pronouns?: string }[] = [], turnsTotal = 3): StoryState {
  const o = opener ?? {};
  const real = o.real_setting ?? {};
  const speaker = clip(o.npc_line?.speaker, 40);
  const problemName = clip(o.problem?.name ?? o.threat?.name, 60);
  const lines = String(o.narration ?? "").split(/(?<=[.!?])\s+/).map((x: string) => clip(x, 160)).filter(Boolean);
  const first = clip((Array.isArray(o.beats) && o.beats[0]) || "", 60).replace(/[.!]+$/, "");
  return {
    where: clip(real.place_type || o.situation, 120),
    problem: [problemName, lines[1] ?? ""].filter(Boolean).join(": ").slice(0, 200),
    stakes: clip(o.problem?.stakes ?? o.threat?.want, 160),
    finish_line: clip(o.goal, 80).replace(/[.!]+$/, ""),
    progress: 0,
    cast: speaker ? [{ name: speaker, role: speaker }] : [],
    facts: lines.slice(0, 2),
    open_thread: "",
    last_moments: [],
    memorable: [],
    pronouns: Object.fromEntries(party.filter((p) => p?.name).map((p) => [clip(p.name, 40), clip(p.pronouns || "they/them", 20)])),
    right_now: first,
    goals_done: first ? [first] : [],
    credits: [],
    turn: 0,
    turns_total: Math.max(1, Math.min(8, Math.round(turnsTotal) || 3)),
    act: 1,
    hook: lines[1] || clip(o.problem_line, 200) || problemName,
    real_event: o.real_setting ? { place_type: clip(real.place_type, 120), roles: (real.roles ?? []).slice(0, 4).map((r: unknown) => clip(r, 60)), situation: clip(real.situation, 200), stakes: clip(real.stakes, 160), arc: (real.arc ?? []).slice(0, 5).map((r: unknown) => clip(r, 100)) } : undefined,
    ...(FEATURES.storyV3
      ? {
          // The REAL starting problem (no fantasy twist): the opener's first line is the real place and situation.
          original_problem: clip(o.original_problem, 200) || lines[0] || "",
          pressures: cleanPressures(o.pressures, clip(real.place_type || o.situation, 60)),
          problems_seen: [first].filter(Boolean),
        }
      : {}),
  };
}

// ---------------------------------------------------------------- v3: pressures and the never-the-same-situation guard

/**
 * The opener's pressures, cleaned (2-3). A story without any gets two generic ones that fit anywhere, so the
 * clock still moves: a crowd that grows, and the day running out.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cleanPressures(x: any, where = ""): Pressure[] {
  const got = (Array.isArray(x) ? x : [])
    .map((p) => ({
      name: clip(p?.name, 40),
      stages: (Array.isArray(p?.stages) ? p.stages : []).map((s: unknown) => clip(s, 110)).filter(Boolean).slice(0, 4),
      fix: clip(p?.fix, 60).replace(/[.!]+$/, ""),
      level: 0,
    }))
    .filter((p) => p.name && p.stages.length && p.fix)
    .slice(0, 3);
  if (got.length >= 2) return got;
  const place = where ? ` at the ${where.replace(/^(the|a|an)\s+/i, "")}` : "";
  return [
    ...got,
    { name: "the crowd", stages: [`A few people stop to watch${place}.`, "The crowd is filming everything now.", "The crowd starts shouting advice."], fix: "Get the crowd to back off", level: 0 },
    { name: "the clock", stages: ["The light starts to fade.", "Someone says there's an hour left, tops.", "It's nearly dark, and nobody is going home."], fix: "Beat the dark", level: 0 },
  ].slice(0, 3);
}

/**
 * Content-word overlap of two lines: shared stems over all stems in either (0-1). "Get the bag" vs "Get the bag off
 * the ledge" = 0.5 (a repeat); "Catch the thief" vs "Chase the thief through the old lanes" = 0.17 (a new step).
 */
export function overlap(text: string, other: string) {
  const a = planWords(text);
  const b = planWords(other);
  if (!a.length || !b.length) return 0;
  const shared = a.filter((w) => b.includes(w)).length;
  return shared / new Set([...a, ...b]).size;
}

/** The earlier goal or problem this one repeats (content-word overlap >= 0.5), or "". */
export function repeatsEarlier(text: string, earlier: string[]) {
  return text.trim() ? earlier.find((e) => e && overlap(text, e) >= 0.5) ?? "" : "";
}

/**
 * One-and-done goals (CD): a goal's target object (the first content word after its verb: "Stop the handbag thief" ->
 * "handbag") is retired once offered, whatever happened. Returns the retired goal it matches, or "".
 */
export function retiredTarget(rn: string, state: StoryState) {
  const target = (g: string) => planWords(g)[1] ?? "";
  const t = target(rn);
  return t ? [...state.goals_done, state.right_now].find((g) => g && target(g) === t) ?? "" : "";
}

/**
 * Circling (Meta's judges: "4 turns to get a bag"): the next step shares a key word with BOTH of the last two steps
 * ("Catch the bag on the wall", "Stop the bag on the ledge", "Catch the coated bag"). Returns that word, or "".
 * Heroes' names don't count.
 */
export function circles(rn: string, state: StoryState) {
  const last = state.goals_done.slice(-2);
  if (last.length < 2) return "";
  const names = new Set(Object.keys(state.pronouns).flatMap((n) => planWords(n)));
  const [a, b] = last.map((g) => new Set(planWords(g)));
  return planWords(rn).find((w) => !names.has(w) && a.has(w) && b.has(w)) ?? "";
}

/** The pressure that advances this turn (they take turns), with its next stage. null = none. */
export function pressureNow(state: StoryState) {
  const ps = state.pressures ?? [];
  if (!ps.length) return null;
  // Never the pressure the players are acting on right now ("Clear the crowd" + "more tourists arrive" contradicts
  // the outcome on screen): the next one in turn takes its place.
  const order = ps.map((_, k) => (state.turn + k) % ps.length);
  const i = order.find((k) => !usesPlan(state.right_now, ps[k].name)) ?? order[0];
  const p = ps[i];
  return { i, name: p.name, stage: p.stages[Math.min(p.level, p.stages.length - 1)], fix: p.fix };
}

/**
 * Every Right now so far (v3's never-again list for the next step). Problems are checked against earlier problems
 * only: the story's core thing (the bag, the shark) naturally stays in a step, so a step is never compared with a
 * whole problem sentence.
 */
export function earlierSituations(state: StoryState) {
  return [...state.goals_done, state.right_now].filter(Boolean);
}

// ---------------------------------------------------------------- checks (rules 7, 9, pronouns, game words)

// "roll" alone stays legal in the fiction (a boulder rolls): the prompt bans it as a game word, code catches the rest.
export const GAME_WORDS = /\b(dice|die roll|natural (1|20|one|twenty)|nat ?(1|20)|perfect roll|(a|the|good|bad|great|lucky|high|low) roll|needs? \d+\+?|DC)\b/i;
const NOT_VERB_START = /^(the|a|an|to|you|your|we|our|they|their|it|its|this|that|there|now|then|before|after|if|when|everyone|someone|nobody|heroes?)\b/i;
const VAGUE = /\b(deal with|figure out|try to|keep|continue|handle|investigate|look for)\b/i;
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function sentences(s: string) {
  // "Mr. Han" and "Mrs. Tanaka" are ready-made heroes: a title's period never ends a sentence.
  return s.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr)\.)(?<=[.!?])\s+/).filter((x) => x.trim());
}

/** A they/them hero next to he/she in a sentence where nobody else is named. */
export function pronounProblems(text: string, pronouns: Record<string, string>) {
  const out: string[] = [];
  for (const [name, p] of Object.entries(pronouns)) {
    if (!/^they/i.test(p) || !name) continue;
    const re = new RegExp(`\\b${esc(name)}\\b`);
    for (const sent of sentences(text)) {
      if (!re.test(sent) || !/\b(he|him|his|she|her|hers)\b/i.test(sent)) continue;
      const others = (sent.match(/\b[A-Z][a-z]+\b/g) ?? []).filter((w) => w !== name && !/^(The|A|An|And|But|So|Then|When|If|It|She|He|Her|His|They|Their|This|That|There|Now|One|Every|All)$/.test(w));
      if (!others.length) out.push(`wrong pronoun for ${name} (${p})`);
    }
  }
  return out;
}

const STOP = new Set(
  "the a an and or but to of in on at by for with from into onto over under up down out off it its it's this that these those them they their there then than so very really just lol lmao omg haha pls please gonna wanna let lets let's get got make made use using try tries trying go goes going do does did have has had be is are was were am will would can could should my me i im i'm we our you your he she his her him who what when where why how all some any every one two three thing things stuff like about around back again more much big little real".split(" "),
);
const stem = (w: string) => w.toLowerCase().replace(/[^a-z]/g, "").replace(/(ing|ed|es|s)$/, "");

/** The plan's own key words (nouns and verbs the player chose), for the "the plan is the cause" check. */
export function planWords(plan: string) {
  return [...new Set(String(plan ?? "").replace(/<[^>]*>/g, " ").split(/[^A-Za-z']+/).filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase())).map(stem).filter((w) => w.length >= 3))];
}

/** At least one of the plan's key words appears in the text (stems, so "chess" matches "chessboard"). */
export function usesPlan(text: string, plan: string) {
  const want = planWords(plan);
  if (!want.length) return true;
  const have = String(text).split(/[^A-Za-z']+/).map(stem);
  return want.some((w) => have.some((h) => h.startsWith(w) || w.startsWith(h) && h.length >= 4));
}

/**
 * Repair a they/them hero's pronouns in place: in a sentence where that hero is the only person named, he/she
 * become they, his/her become their, him/her become them. Cheaper than a retry; the meaning never changes.
 */
export function fixPronouns(text: string, pronouns: Record<string, string>) {
  let out = text;
  for (const [name, p] of Object.entries(pronouns)) {
    if (!/^they/i.test(p) || !name) continue;
    const re = new RegExp(`\\b${esc(name)}\\b`);
    out = sentences(out)
      .map((sent) => {
        if (!re.test(sent)) return sent;
        const others = (sent.match(/\b[A-Z][a-z]+\b/g) ?? []).filter((w) => w !== name && !/^(The|A|An|And|But|So|Then|When|If|It|She|He|Her|His|They|Their|This|That|There|Now|One|Every|All)$/.test(w));
        if (others.length) return sent;
        return sent
          .replace(/\b(he|she)\b/g, "they")
          .replace(/\b(He|She)\b/g, "They")
          .replace(/\bhis\b/g, "their")
          .replace(/\bHis\b/g, "Their")
          .replace(/\bhim\b/g, "them")
          .replace(/\bher\b(?=\s+[a-z])/g, "their")
          .replace(/\bher\b/g, "them")
          .replace(/\bthey (is|was|has|does)\b/g, (_, v: string) => `they ${{ is: "are", was: "were", has: "have", does: "do" }[v]}`);
      })
      .join(" ");
  }
  return out;
}

const FUNCTION_WORDS = new Set(
  "the a an and or but to of in on at by for with from into onto over under up down out off its it his her their them they he she him this that these those so as than then before after until while past near by toward towards around through across behind beside between is are was were be been has have had will can just not no".split(" "),
);

/** The longest run of words with no little word between them ("cone juggling ice hand" = 4), skipping the first. */
export function longestStack(s: string, skipFirst = false) {
  const w = s.replace(/[^A-Za-z' -]/g, " ").split(/\s+/).filter(Boolean);
  let best = 0;
  let run = 0;
  w.forEach((x, i) => {
    if ((skipFirst && i === 0) || FUNCTION_WORDS.has(x.toLowerCase()) || /^[A-Z]/.test(x)) run = 0;
    else best = Math.max(best, ++run);
  });
  return best;
}

// ---------------------------------------------------------------- followable on first hearing (CD: simple beats clever)

const DETERMINERS = new Set("the a an his her their its my your our this that every".split(" "));
// Size, color and feeling words a kid uses every day never count as "odd describers".
const PLAIN_ADJ = new Set(
  "big little small tiny huge giant old new red blue green yellow black white pink orange purple gold silver brown gray grey long short tall wet dry hot cold warm soft hard loud quiet lost sleepy angry happy sad scared baby mom dad good bad last first next whole same other only real empty full".split(" "),
);
const TAIL = new Set("away back home out off down up over around now here there too fast slowly till asleep awake still safe free inside outside together alone without toward towards behind beneath beside across along".split(" "));

/**
 * The most odd describing words piled onto one thing after "the/a/his…": "the cone juggling ice hand" = 3 (cone,
 * juggling, ice before "hand"). Plain size/color/feeling words don't count, and a verb ("the sky turtle snores")
 * ends the phrase.
 */
export function modifierPile(s: string) {
  const w = s.replace(/[^A-Za-z' -]/g, " ").split(/[\s-]+/).filter(Boolean);
  let best = 0;
  for (let i = 0; i < w.length; i++) {
    if (!DETERMINERS.has(w[i].toLowerCase())) continue;
    const run: string[] = [];
    for (let j = i + 1; j < w.length; j++) {
      const x = w[j].toLowerCase();
      if (FUNCTION_WORDS.has(x) || DETERMINERS.has(x) || TAIL.has(x) || /^[A-Z]/.test(w[j])) break;
      if (run.length >= 1 && /([^s]s|ed)$/.test(x)) break; // "turtle snores", "dog trotted": the verb ends the phrase
      run.push(x);
    }
    best = Math.max(best, run.slice(0, -1).filter((x) => !PLAIN_ADJ.has(x)).length);
  }
  return best;
}

/** Repair a piled-up Right now in code: keep only the last describer and the thing ("Shut the open warm cabin doors" -> "Shut the cabin doors"). */
export function trimPile(s: string) {
  const w = s.trim().split(/\s+/);
  for (let i = 0; i < w.length; i++) {
    if (!DETERMINERS.has(w[i].toLowerCase())) continue;
    let j = i + 1;
    while (j < w.length && !FUNCTION_WORDS.has(w[j].toLowerCase()) && !DETERMINERS.has(w[j].toLowerCase()) && !TAIL.has(w[j].toLowerCase()) && !/^[A-Z]/.test(w[j])) j++;
    const run = w.slice(i + 1, j);
    if (run.slice(0, -1).filter((x) => !PLAIN_ADJ.has(x.toLowerCase())).length >= 3) return [...w.slice(0, i + 1), ...run.slice(-2), ...w.slice(j)].join(" ");
  }
  return s.trim();
}

const syl = (word: string) => {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return w ? 1 : 0;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, (m) => m[0]).replace(/^y/, "");
  return Math.max(1, (w.match(/[aeiouy]+/g) ?? []).length);
};

/**
 * What code can catch about a line that needs a second read (the misses: "the cone juggling ice hand", "blinks wide
 * and holds it", "the blink fits zero past cases in the tapes"). `known` = words the table already knows (the plan,
 * names), which never count as hard words.
 */
export function plainProblems(text: string, known = ""): string[] {
  const out: string[] = [];
  const t = String(text ?? "");
  if (!t.trim()) return out;
  if (modifierPile(t) >= 3) out.push("too many describing words on one thing: call it by its plain name (\"the ice hand\", not \"the cone juggling ice hand\")");
  const long = sentences(t).find((s) => words(s) > 18);
  if (long) out.push(`a sentence is ${words(long)} words: 18 max, one idea each`);
  if (/\b(as if|as though)\b/i.test(t) || /(?<!\b(look|looks|looked|looking|feel|feels|felt|sound|sounds|smell|smells|just|would|not|nothing|anything|something))\s+like (a|an|the|some)\b/i.test(t)) out.push("no similes (\"like popcorn\"): say what happens");
  if (/\b(zero|percent|cases|data|statistics|records show|in theory|technically|officially|literally)\b/i.test(t)) out.push("no counting, measuring or official talk (\"fits zero past cases\"): say what someone sees or does");
  if (/\bhear(s|d)?\b[^.]{0,24}\b(blink|glow|light|color|colour|flash)\b|\bsees?\b[^.]{0,24}\b(hum|sound|noise|song|beep)\b|\bmid (?!air\b)[a-z]+\b/i.test(t)) out.push("say only what someone could really see, hear or do (you hear a sound, you see a light), in plain words");
  const knownSet = new Set(String(known).toLowerCase().split(/[^a-z]+/).filter(Boolean));
  const hard = t.split(/[^A-Za-z']+/).filter((w) => w && !/^[A-Z]/.test(w) && syl(w) >= 4 && !/(ly|ing|ed|s)$/.test(w) && !knownSet.has(w.toLowerCase()));
  if (hard.length >= 2) out.push(`hard words (${hard.slice(0, 3).join(", ")}): use short everyday words`);
  return out;
}

/** A 5-word run of the outcome that already happened in an earlier moment ("admits she hid the dog because"), or "". */
export function repeatsMoment(text: string, moments: string[], plan = "") {
  const w = norm(text).split(" ");
  const own = new Set(planWords(plan));
  const past = moments.map((m) => ` ${norm(m)} `);
  for (let i = 0; i + 5 <= w.length; i++) {
    const run = w.slice(i, i + 5);
    const content = run.filter((x) => !FUNCTION_WORDS.has(x));
    // The player's own words may come back (they chose them again); the DM's own beats may not.
    if (content.length >= 3 && !content.every((x) => own.has(stem(x))) && past.some((m) => m.includes(` ${run.join(" ")} `))) return run.join(" ");
  }
  return "";
}

const REVERSE = /\b(again|lost|loses?|gone|broke|breaks?|broken|undo(es|ne)?|wiped?|wipes|ruin(s|ed)?|escapes?|escaped|slips?|slipped|falls? (off|out|apart)|comes? (off|loose|undone)|unravels?|leaks?|empty|empties)\b/i;

/**
 * A win the outcome takes back ("Done: build a pen for the pig" + "the pig breaks out of the pen"): a sentence with a
 * reversal word and a word that only that win has (the problem's own words don't count, they are everywhere).
 */
export function undoesDone(text: string, state: StoryState) {
  const common = new Set(planWords(`${state.problem} ${state.finish_line} ${state.where}`));
  for (const f of state.facts.filter((x) => x.startsWith("Done:"))) {
    const own = planWords(f.slice(5)).filter((w) => !common.has(w) && w.length >= 3);
    for (const sent of sentences(text)) {
      if (!REVERSE.test(sent)) continue;
      const have = sent.split(/[^A-Za-z']+/).map(stem);
      const hit = own.find((w) => have.some((h) => h === w || (h.startsWith(w) && h.length <= w.length + 3)));
      if (hit) return `${f.slice(5).trim()} / ${sent.trim()}`.slice(0, 120);
    }
  }
  return "";
}

/** The ruling's quip is spoken only if it is short, names the hero, and reads plainly; otherwise silence. */
export function quipOk(quip: string, hero: string) {
  const q = String(quip ?? "").trim();
  if (!q || words(q) > 14 || !new RegExp(`\\b${esc(hero)}\\b`, "i").test(q)) return false;
  if (/!/.test(q) || GAME_WORDS.test(q) || /\b(epic|amazing|awesome|legendary|insane|crazy)\b/i.test(q)) return false;
  return plainProblems(q, hero).length === 0;
}

/** Everything code can check about a proposal. Each string is a problem the retry is told to fix. */
export function checkTurn(p: TurnProposal, ctx: { state: StoryState; hero: string; idea_from?: string; grade: Grade; next_player?: string; plan?: string; hook_due?: boolean }): string[] {
  const out: string[] = [];
  const o = p.outcome.trim();
  if (!o) return ["outcome is empty"];
  if (ctx.plan && !usesPlan(o, ctx.plan)) out.push(`the plan is the cause: the outcome must use the player's own key word (one of: ${planWords(ctx.plan).slice(0, 5).join(", ")})`);
  if (ctx.hook_due && ctx.state.hook && !usesPlan(`${o} ${p.scene}`, ctx.state.hook)) out.push("keep the opener's hook in play (state.hook) in this act");
  // A forward grade must change something: "plan happens, but the old obstacle still holds" stalls the story.
  const second = sentences(o)[1] ?? "";
  if (!["SETBACK", "DISASTER"].includes(ctx.grade) && /\b(?<!(hold|holds|held|stand|stands|stay|stays|sit|sits|keep|keeps|lie|lies|lay|lays) )(still|tighter|closer|anyway)\b/i.test(second)) out.push("the plan must change something for good: sentence 2 is one NEW snag the plan caused, never the old obstacle still holding on");
  // The "...and nobody mentions X" tic (reviewer: 5 of 18 turns): the joke must be the consequence itself.
  if (/\b(nobody|no one) (mentions?|pays|asks|says|notices|talks)\b|\bfor once\b/i.test(o)) out.push("nobody-tag: drop the '...and nobody mentions X' tag; let the consequence be the joke");
  const retold = repeatsMoment(o, [...ctx.state.last_moments, ...ctx.state.facts.filter((f) => !f.startsWith("Done:")), ...ctx.state.memorable], ctx.plan);
  const undone = undoesDone(o, ctx.state);
  if (undone) out.push(`undoes an earlier win ("${undone}"): nothing achieved is ever undone, so the snag must be something new`);
  if (retold) out.push(`repeats an earlier moment ("${retold}"): something new happens now, and what was learned stays learned`);
  if (/\b(still right there|isn't solved yet|is not solved yet)\b/i.test(o)) out.push("banned filler: never 'still right there' or 'isn't solved yet'; say what the action did");
  if (sentences(o).length > 2) out.push(`outcome has ${sentences(o).length} sentences (2 max)`);
  if (words(o) > 30) out.push(`outcome is ${words(o)} words (30 max)`);
  if (!new RegExp(`\\b${esc(ctx.hero)}\\b`).test(o)) out.push(`outcome must name the acting hero, ${ctx.hero}`);
  if (ctx.idea_from && WON(ctx.grade) && !new RegExp(`\\b${esc(ctx.idea_from)}\\b`).test(`${o} ${p.scene}`)) out.push(`credit ${ctx.idea_from}: it was their idea`);
  if (ctx.idea_from && !WON(ctx.grade) && new RegExp(`\\b${esc(ctx.idea_from)}\\b`).test(o)) out.push(`never name ${ctx.idea_from} on a miss: the miss belongs to ${ctx.hero}`);
  const g = `${o} ${p.scene}`.match(GAME_WORDS);
  if (g) out.push(`no game words ("${g[0]}")`);
  out.push(...pronounProblems(`${o} ${p.scene}`, ctx.state.pronouns));
  const known = `${ctx.plan ?? ""} ${ctx.hero} ${ctx.state.finish_line}`;
  out.push(...plainProblems(o, known).map((x) => `outcome: ${x}`));
  out.push(...plainProblems(p.scene, known).map((x) => `scene: ${x}`));
  const rn = p.right_now.trim().replace(/[.!]+$/, "");
  if (!rn) out.push("right_now is empty");
  else {
    if (words(rn) > 8) out.push(`right_now is ${words(rn)} words (8 max)`);
    if (longestStack(rn, true) >= 4 || modifierPile(rn) >= 2) out.push(`right_now "${rn}" stacks too many words: a verb, then one plain thing ("Tuck the ice hand into the snow")`);
    if (NOT_VERB_START.test(rn) || VAGUE.test(rn)) out.push(`right_now "${rn}" must start with a concrete verb (no vague verbs)`);
    if (FEATURES.storyV3) {
      // v3 (design/37): never the same objective twice, success or miss: the story is always somewhere new.
      const was = repeatsEarlier(rn, earlierSituations(ctx.state));
      if (was || /\bagain\b/i.test(rn)) out.push(`repeats an earlier moment: right_now "${rn}" is an earlier goal ("${was || rn}") reworded; give the NEW situation's next step`);
      // Rewording hides most repeats from a word check (sim: 40% repeats, 9% caught): the model's own answer counts too.
      if (String(p.repeat_of ?? "").trim() && !was) out.push(`repeats an earlier moment: right_now "${rn}" is the same goal as "${String(p.repeat_of).trim()}"; give a NEW goal`);
      // After a miss, the next step is never cleaning up the plan's own mess (sim: "free the bus from the dough").
      if (!WON(ctx.grade) && ctx.plan) {
        const names = new Set(Object.keys(ctx.state.pronouns).flatMap((n) => planWords(n)));
        const own = planWords(rn).filter((w) => !names.has(w) && planWords(ctx.plan!).includes(w));
        if (own.length) out.push(`repeats an earlier moment: after a miss, right_now "${rn}" is about the plan's own mess ("${own.join(", ")}"); make a pressure worse or start a NEW problem instead`);
      }
      const rt = retiredTarget(rn, ctx.state);
      if (rt && !was) out.push(`repeats an earlier moment: right_now "${rn}" goes after the same thing as a retired goal ("${rt}"); every goal is offered once, so give a DIFFERENT goal`);
      const c = circles(rn, ctx.state);
      if (c && !was) out.push(`repeats an earlier moment: the story has circled "${c}" for three turns; the next situation is about something ELSE (a pressure, a person, a new problem)`);
    } else {
      const stays = !WON(ctx.grade) && norm(rn) === norm(ctx.state.right_now); // a miss may keep the same step
      // A success moves on: a reworded copy of the step just worked on ("Scoop beads before high tide" x3) is a repeat.
      const rw = planWords(rn);
      const near = (g: string) => rw.length > 0 && rw.filter((w) => planWords(g).includes(w)).length / rw.length >= 0.6;
      if (WON(ctx.grade) && near(ctx.state.right_now)) out.push(`right_now "${rn}" is the step they just did, reworded: give the NEXT step`);
      if (/\bagain\b/i.test(rn) || (!stays && ctx.state.goals_done.some((x) => norm(x) === norm(rn)))) out.push(`right_now "${rn}" repeats an earlier goal: give the NEXT step`);
    }
  }
  if (FEATURES.storyV3) {
    const pn = String(p.problem_now ?? "").trim();
    if (!pn) out.push("problem_now is empty: say the NEW situation in one plain sentence");
    else {
      if (words(pn) > 22) out.push(`problem_now is ${words(pn)} words (20 max)`);
      const was = repeatsEarlier(pn, [...(ctx.state.problems_seen ?? []), ctx.state.problem]);
      if (was) out.push(`repeats an earlier moment: problem_now is the old situation ("${was}") again; a success resolved it for good, a miss made something NEW go wrong`);
    }
  }
  if (ctx.next_player && p.scene && !new RegExp(`\\b${esc(ctx.next_player)}\\b`).test(p.scene)) out.push(`scene must hand the moment to ${ctx.next_player} by name`);
  if (FEATURES.storyV3 ? sentences(p.scene).length > 1 || words(p.scene) > 10 : sentences(p.scene).length > 1 || words(p.scene) > 24) out.push(FEATURES.storyV3 ? "scene is ONE short sentence, 10 words max with the name" : "scene is 1 sentence, 24 words max");
  if (p.new_character?.name && ctx.state.cast.length >= 3 && !ctx.state.cast.some((c) => norm(c.name) === norm(p.new_character.name))) out.push("no new named characters: the cast is full (3)");
  const newThings = [p.new_fact, p.new_character?.name].filter((x) => x && x.trim()).length;
  if (newThings > 1) out.push("one new thing per turn at most (a fact OR a character)");
  return out;
}

// ---------------------------------------------------------------- apply (code decides)

/** Trim a line to at most 2 sentences and 30 words (last resort after the retry). */
export function clampOutcome(s: string) {
  let t = sentences(s).slice(0, 2).join(" ");
  if (words(t) > 32) t = `${t.split(/\s+/).slice(0, 30).join(" ").replace(/[,;:]$/, "")}.`;
  return t;
}

/** The act a progress value belongs to: 0-33 act 1, 34-66 act 2, 67-99 act 3 (100 = the finale). */
export function actOf(progress: number) {
  return progress >= 67 ? 3 : progress >= 34 ? 2 : 1;
}


/**
 * The act after `turn` turns of `turns`: the turns split as evenly as they can over 3 acts, act 1 never longer than
 * the others (3 turns: 1/1/1; 4: 1/2/1; 5: 1/2/2; 6: 2/2/2; 8: 2/3/3).
 */
export function actClock(turn: number, turns: number) {
  const T = Math.max(1, turns || 1);
  const a2 = Math.max(1, Math.floor(T / 3));
  const a3 = Math.max(a2 + 1, a2 + Math.ceil((T - a2) / 2));
  return turn >= a3 ? 3 : turn >= a2 ? 2 : 1;
}

export function applyTurn(
  state: StoryState,
  p: TurnProposal,
  ctx: { hero: string; attempt?: string; grade: Grade; depth?: number },
): { state: StoryState; delta: number; finale: boolean; act_changed: boolean } {
  if (FEATURES.storyV3) return applyTurnV3(state, p, ctx);
  const turn = state.turn + 1;
  let delta = progressDelta(ctx.grade, p.progress_gain, state.turns_total);
  // A success that solves the current step takes the top of its grade's range (a bigger roll is always a bigger step).
  if (WON(ctx.grade) && p.step_solved) delta = Math.max(delta, progressRange(ctx.grade, state.turns_total)[1]);
  // Nothing achieved is undone (wins become facts); a backfire only dips the meter a little (its range).
  let progress = paceProgress(state.progress, delta, turn, state.turns_total, ctx.grade);
  // The act clock moves the act dots on time (it never adds progress by itself).
  const act = Math.max(state.act, actOf(progress), actClock(turn, state.turns_total));
  progress = Math.min(100, progress);
  delta = progress - state.progress;
  let rn = clip(p.right_now, 80).replace(/[.!]+$/, "");
  // A miss stays on the current step (that is what a miss means); only a success may move on to the finish line.
  const stays = !WON(ctx.grade) && !!rn && norm(rn) === norm(state.right_now);
  if (!rn || /\bagain\b/i.test(rn) || (!stays && state.goals_done.some((x) => norm(x) === norm(rn)))) rn = WON(ctx.grade) ? state.finish_line : state.right_now || state.finish_line;
  const cast = [...state.cast];
  if (p.new_character?.name && cast.length < 3 && !cast.some((c) => norm(c.name) === norm(p.new_character.name)) && !p.new_fact?.trim()) cast.push({ name: clip(p.new_character.name, 30), role: clip(p.new_character.role, 50) });
  // Wins become facts, so they can never be undone; plus the one new fact the model proposed.
  const win = WON(ctx.grade) && state.right_now ? `Done: ${clip(state.right_now, 80)}` : "";
  const facts = [...state.facts, ...(p.new_fact?.trim() ? [clip(p.new_fact, 120)] : []), ...(win ? [win] : [])].slice(-8);
  const mem = p.memorable?.trim() ? [...state.memorable, clip(p.memorable, 100)].slice(-2) : state.memorable;
  const next: StoryState = {
    ...state,
    where: clip(p.where, 120) || state.where,
    progress,
    cast,
    facts,
    open_thread: clip(p.open_thread, 120) || state.open_thread,
    last_moments: [...state.last_moments, clip(p.outcome, 240)].slice(-6),
    memorable: mem,
    right_now: progress >= 100 ? state.finish_line : rn,
    goals_done: [...state.goals_done, rn].slice(-12),
    credits: [...state.credits, { name: ctx.hero, did: clip(ctx.attempt, 120) || "had a go", grade: ctx.grade }],
    turn,
    act,
  };
  return { state: next, delta, finale: progress >= 100, act_changed: act !== state.act };
}

/**
 * v3 (design/37): the meter is a story clock (turns, not task %), the finale comes when the turns run out, and every
 * turn lands somewhere NEW: a success resolves the situation for good (it becomes a fact), a miss makes a new thing
 * go wrong. If the model's next situation still repeats an earlier one after the retry, code forces a twist from the
 * pressure that advanced this turn. That pressure moves one stage on whatever happened.
 */
function applyTurnV3(state: StoryState, p: TurnProposal, ctx: { hero: string; attempt?: string; grade: Grade; depth?: number }) {
  const turn = state.turn + 1;
  const T = Math.max(1, state.turns_total || 1);
  const progress = Math.min(100, Math.round((100 * turn) / T));
  const act = Math.max(state.act, actClock(turn, T));
  const won = WON(ctx.grade);
  const pr = pressureNow(state);
  const earlier = earlierSituations(state);
  let rn = clip(p.right_now, 80).replace(/[.!]+$/, "");
  let problem = clip(p.problem_now, 200);
  const stale = !rn || /\bagain\b/i.test(rn) || !!repeatsEarlier(rn, earlier) || !!circles(rn, state) || !!retiredTarget(rn, state) || !problem || !!repeatsEarlier(problem, [...(state.problems_seen ?? []), state.problem]);
  // The forced twist: the pressure itself becomes the situation (never "try again").
  if (stale && pr) {
    problem = pr.stage;
    rn = pr.fix;
  } else if (stale && !rn) rn = state.right_now;
  // The finale: the CURRENT situation plus the biggest pressure. Never a snap back to the suggested goal (sim: "the
  // shark exits at turn 5 yet the goal stays 'get the shark out'"), which may already be met or left behind.
  if (turn >= T) {
    const big = [...(state.pressures ?? [])].sort((a, b) => b.level - a.level)[0];
    const bigNow = big ? big.stages[Math.min(big.level + (pr?.name === big.name ? 1 : 0), big.stages.length - 1)] : "";
    if (bigNow && !problem.includes(bigNow)) problem = [problem, bigNow].filter(Boolean).join(" ");
  }
  const pressures = (state.pressures ?? []).map((x, i) => (pr && i === pr.i ? { ...x, level: Math.min(x.level + 1, x.stages.length - 1) } : x));
  const cast = [...state.cast];
  if (p.new_character?.name && cast.length < 3 && !cast.some((c) => norm(c.name) === norm(p.new_character.name)) && !p.new_fact?.trim()) cast.push({ name: clip(p.new_character.name, 30), role: clip(p.new_character.role, 50) });
  // What the plan did is a fact, success or miss; a success also closes the old situation for good.
  const did = won && state.right_now ? `Done: ${clip(state.right_now, 80)}` : "";
  const facts = [...state.facts, ...(p.new_fact?.trim() ? [clip(p.new_fact, 120)] : []), ...(did ? [did] : [])].slice(-8);
  const mem = p.memorable?.trim() ? [...state.memorable, clip(p.memorable, 100)].slice(-2) : state.memorable;
  const next: StoryState = {
    ...state,
    where: clip(p.where, 120) || state.where,
    problem: problem || state.problem,
    progress,
    cast,
    facts,
    open_thread: clip(p.open_thread, 120) || state.open_thread,
    last_moments: [...state.last_moments, clip(p.outcome, 240)].slice(-6),
    memorable: mem,
    right_now: rn,
    goals_done: [...state.goals_done, rn].slice(-12),
    problems_seen: [...(state.problems_seen ?? []), state.problem, problem].filter(Boolean).slice(-12),
    pressures,
    credits: [...state.credits, { name: ctx.hero, did: clip(ctx.attempt, 120) || "had a go", grade: ctx.grade }],
    turn,
    act,
  };
  return { state: next, delta: progress - state.progress, finale: turn >= T, act_changed: act !== state.act };
}

// ---------------------------------------------------------------- fallback (still names the plan, rule 2)

/** The AI-free turn: names the plan, applies its grade generically, keeps the story moving. */
export function fallbackProposal(state: StoryState, o: { hero: string; attempt?: string; idea_from?: string; grade: Grade; next_player?: string }): TurnProposal {
  let action = clip(o.attempt, 140).replace(/[.!]+$/, "");
  if (action.toLowerCase().startsWith(o.hero.toLowerCase())) action = action.slice(o.hero.length).trim();
  if (!action) action = "goes for it";
  const credit = o.idea_from && WON(o.grade) ? `, ${o.idea_from}'s idea,` : ",";
  const how: Record<Grade, string> = {
    LEGENDARY: "and it works better than anyone hoped.",
    GREAT: "and it works even better than planned.",
    PROGRESS: "and it works, mostly.",
    PARTIAL: "and it half works.",
    SETBACK: "but it backfires, and the problem gets a little bigger.",
    DISASTER: "but it backfires in the most spectacular way, and the problem gets bigger.",
  };
  // The canned turn still carries the story: the scene names what the plan did (by its own key word), and the
  // Right now is a fresh step built from it, never the big goal twice in a row.
  // The key word: the plan's last content word, usually its object ("chess", "toy", "net").
  const content = action.split(/\s+/).map((w) => w.replace(/[^A-Za-z'-]/g, "")).filter((w) => planWords(w).length);
  const key = (content[content.length - 1] ?? "big").toLowerCase();
  const won = WON(o.grade);
  const result = won ? "worked" : o.grade === "PARTIAL" ? "half worked" : "made things harder";
  // A miss keeps the current step; a success heads for the finish line (plain, never "Build on X's plan").
  const fresh = won ? state.finish_line : state.right_now || state.finish_line;
  // v3: the canned turn still moves the story: the pressure that advances this turn becomes the new situation.
  const pr = FEATURES.storyV3 ? pressureNow(state) : null;
  if (pr) {
    const v3how: Record<Grade, string> = { ...how, SETBACK: "but it backfires.", DISASTER: "but it backfires spectacularly." };
    return {
      outcome: `${o.hero} ${action}${credit} ${v3how[o.grade]}`.replace(/\s+/g, " ").trim(),
      scene: o.next_player ? `${o.next_player}, ${pr.stage.charAt(0).toLowerCase()}${pr.stage.slice(1).replace(/[.!]+$/, "")}, so what now?` : `Everyone, the grand finale is next.`,
      right_now: pr.fix,
      problem_now: pr.stage,
      progress_gain: Number.NaN,
      progress_why: "",
      new_fact: "",
      new_character: { name: "", role: "" },
      where: "",
      open_thread: "",
      memorable: "",
      step_solved: won,
    };
  }
  return {
    outcome: `${o.hero} ${action}${credit} ${how[o.grade]}`.replace(/\s+/g, " ").trim(),
    scene: o.next_player ? `${o.next_player}, ${o.hero}'s ${key} plan ${result}, so what now?` : `Everyone, ${o.hero}'s ${key} plan ${result}, and the grand finale is next.`,
    right_now: fresh,
    progress_gain: Number.NaN, // the middle of the grade's range (progressDelta)
    progress_why: "",
    new_fact: "",
    new_character: { name: "", role: "" },
    where: "",
    open_thread: "",
    memorable: "",
    step_solved: false,
  };
}
