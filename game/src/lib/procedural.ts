/**
 * The procedural story engine (design/35-procedural-story-rules.md): players steer, the DM reacts.
 *
 * Pure and shared: the TV (host.ts) keeps one StoryState per game; the /api/ai "turn" task gets it, asks the model
 * for the outcome, then THIS code validates the answer and applies it (progress by grade, cast <= 3, facts <= 8,
 * one new thing per turn, no repeated Right now, clarity, game words, pronouns) and returns the next state.
 * If the model fails, fallbackTurn() still names the plan and applies its grade (rule 2), so the table never waits.
 */

export type Grade = "DISASTER" | "SETBACK" | "PARTIAL" | "PROGRESS" | "GREAT" | "LEGENDARY";

export type CastMember = { name: string; role: string; pronoun?: string };

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
  /** The last 3 outcome lines (for flow and the never-repeat rule). */
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
};

const clip = (s: unknown, n: number) => String(s ?? "").replace(/[<>{}]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();

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
  };
}

// ---------------------------------------------------------------- checks (rules 7, 9, pronouns, game words)

// "roll" alone stays legal in the fiction (a boulder rolls): the prompt bans it as a game word, code catches the rest.
export const GAME_WORDS = /\b(dice|die roll|natural (1|20|one|twenty)|nat ?(1|20)|perfect roll|(a|the|good|bad|great|lucky|high|low) roll|needs? \d+\+?|DC)\b/i;
const NOT_VERB_START = /^(the|a|an|to|you|your|we|our|they|their|it|its|this|that|there|now|then|before|after|if|when|everyone|someone|nobody|heroes?)\b/i;
const VAGUE = /\b(deal with|figure out|try to|keep|continue|handle|investigate|look for)\b/i;
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function sentences(s: string) {
  return s.split(/(?<=[.!?])\s+/).filter((x) => x.trim());
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

/** Everything code can check about a proposal. Each string is a problem the retry is told to fix. */
export function checkTurn(p: TurnProposal, ctx: { state: StoryState; hero: string; idea_from?: string; grade: Grade; next_player?: string; plan?: string; hook_due?: boolean }): string[] {
  const out: string[] = [];
  const o = p.outcome.trim();
  if (!o) return ["outcome is empty"];
  if (ctx.plan && !usesPlan(o, ctx.plan)) out.push(`the plan is the cause: the outcome must use the player's own key word (one of: ${planWords(ctx.plan).slice(0, 5).join(", ")})`);
  if (ctx.hook_due && ctx.state.hook && !usesPlan(`${o} ${p.scene}`, ctx.state.hook)) out.push("keep the opener's hook in play (state.hook) in this act");
  if (/\b(still right there|isn't solved yet|is not solved yet)\b/i.test(o)) out.push("banned filler: never 'still right there' or 'isn't solved yet'; say what the action did");
  if (sentences(o).length > 2) out.push(`outcome has ${sentences(o).length} sentences (2 max)`);
  if (words(o) > 30) out.push(`outcome is ${words(o)} words (30 max)`);
  if (!new RegExp(`\\b${esc(ctx.hero)}\\b`).test(o)) out.push(`outcome must name the acting hero, ${ctx.hero}`);
  if (ctx.idea_from && WON(ctx.grade) && !new RegExp(`\\b${esc(ctx.idea_from)}\\b`).test(`${o} ${p.scene}`)) out.push(`credit ${ctx.idea_from}: it was their idea`);
  if (ctx.idea_from && !WON(ctx.grade) && new RegExp(`\\b${esc(ctx.idea_from)}\\b`).test(o)) out.push(`never name ${ctx.idea_from} on a miss: the miss belongs to ${ctx.hero}`);
  const g = `${o} ${p.scene}`.match(GAME_WORDS);
  if (g) out.push(`no game words ("${g[0]}")`);
  out.push(...pronounProblems(`${o} ${p.scene}`, ctx.state.pronouns));
  const rn = p.right_now.trim().replace(/[.!]+$/, "");
  if (!rn) out.push("right_now is empty");
  else {
    if (words(rn) > 8) out.push(`right_now is ${words(rn)} words (8 max)`);
    if (longestStack(rn, true) >= 4) out.push(`right_now "${rn}" stacks too many words: a verb, then one plain thing ("Tuck the ice hand into the snow")`);
    if (NOT_VERB_START.test(rn) || VAGUE.test(rn)) out.push(`right_now "${rn}" must start with a concrete verb (no vague verbs)`);
    if (/\bagain\b/i.test(rn) || ctx.state.goals_done.some((x) => norm(x) === norm(rn))) out.push(`right_now "${rn}" repeats an earlier goal: give the NEXT step`);
  }
  if (ctx.next_player && p.scene && !new RegExp(`\\b${esc(ctx.next_player)}\\b`).test(p.scene)) out.push(`scene must hand the moment to ${ctx.next_player} by name`);
  if (sentences(p.scene).length > 1 || words(p.scene) > 24) out.push("scene is 1 sentence, 24 words max");
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


export function applyTurn(
  state: StoryState,
  p: TurnProposal,
  ctx: { hero: string; attempt?: string; grade: Grade; depth?: number },
): { state: StoryState; delta: number; finale: boolean; act_changed: boolean } {
  const turn = state.turn + 1;
  let delta = progressDelta(ctx.grade, p.progress_gain, state.turns_total);
  // A success that solves the current step takes the top of its grade's range (a bigger roll is always a bigger step).
  if (WON(ctx.grade) && p.step_solved) delta = Math.max(delta, progressRange(ctx.grade, state.turns_total)[1]);
  // Nothing achieved is undone (wins become facts); a backfire only dips the meter a little (its range).
  let progress = paceProgress(state.progress, delta, turn, state.turns_total, ctx.grade);
  // The act clock moves the act dots on time (it never adds progress by itself).
  const clockAct = turn >= Math.ceil((state.turns_total * 2) / 3) ? 3 : turn >= Math.ceil(state.turns_total / 3) ? 2 : 1;
  const act = Math.max(state.act, actOf(progress), Math.min(3, clockAct));
  progress = Math.min(100, progress);
  delta = progress - state.progress;
  let rn = clip(p.right_now, 80).replace(/[.!]+$/, "");
  if (!rn || /\bagain\b/i.test(rn) || state.goals_done.some((x) => norm(x) === norm(rn))) rn = state.finish_line;
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
    last_moments: [...state.last_moments, clip(p.outcome, 240)].slice(-3),
    memorable: mem,
    right_now: progress >= 100 ? state.finish_line : rn,
    goals_done: [...state.goals_done, rn].slice(-12),
    credits: [...state.credits, { name: ctx.hero, did: clip(ctx.attempt, 120) || "had a go", grade: ctx.grade }],
    turn,
    act,
  };
  return { state: next, delta, finale: progress >= 100, act_changed: act !== state.act };
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
  const fresh = [won ? `Finish what ${o.hero} started` : `Fix what the ${key} plan shook loose`, `Build on ${o.hero}'s ${key} plan`, state.finish_line].find((g) => !state.goals_done.some((x) => norm(x) === norm(g))) ?? state.finish_line;
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
