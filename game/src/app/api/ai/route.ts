import { NextResponse } from "next/server";
import { MODELS, museJSON, type Effort } from "@/server/muse";
import {
  BOT_SCHEMA,
  BOT_SYSTEM,
  CAST_SCHEMA,
  CAST_SYSTEM,
  CHARACTER_SCHEMA,
  CHARACTER_SYSTEM,
  EPILOGUE_QUICK,
  EPILOGUE_SCHEMA,
  EPILOGUE_SYSTEM,
  KIND_SCHEMA,
  KIND_SYSTEM,
  OUTCOME_SCHEMA,
  outcomeSystem,
  ROUND_SCHEMA,
  ROUND_SYSTEM,
  SCENE_SCHEMA,
  SCENE_SYSTEM,
  RULING_SCHEMA,
  RULING_SYSTEM,
  STORYBOOK_SYSTEM,
  storybookSchema,
  withRating,
} from "@/server/prompts";
import { FALLBACK_EPILOGUE, fallbackHero, fallbackKind, fallbackOutcome, fallbackRound, fallbackRuling, fallbackScene, fallbackStorybook } from "@/server/fallbacks";
import { cleanText, ratingOf, realOf } from "@/server/real";
import type { Hero, Rating, Stat } from "@/lib/types";
import { evenStats } from "@/lib/rules";
import { runEnding, runTurn } from "@/server/stories/procedural";
import { applyTurn, fallbackProposal, stateFromOpener, type Grade } from "@/lib/procedural";
import { BEAT_OF, fillBeat, liveProblems, makeBible, pronounMap, storedPack, tailor, tailorEnding, turnsOf } from "@/server/stories/bible";

// story_bible can take 40-90 s (it runs during the vote, hidden). Fluid compute allows this on every Vercel plan.
export const maxDuration = 120;

/**
 * Model + reasoning per story-writing call type, in one place, so a model comparison is a one-line (or env var) swap
 * (STORY_MODEL=muse-wonder-1.0, BRANCH_EFFORT=medium). Another provider would also need its own client in place of
 * museJSON (same JSON-schema contract). design/26 bake-off: spark-1.3 "high" writes best but takes 13-17 s, so it
 * runs as pre-written branches (outcome_branches) while the table rolls; "low" is the live fallback.
 */
const STORY_MODEL = process.env.STORY_MODEL || MODELS.writing;
const STORY_CALLS = {
  // "high" reasoning needs room: at 3000 tokens it ran out ("empty response (length)") on every call.
  outcome: { model: STORY_MODEL, effort: (process.env.OUTCOME_EFFORT || "low") as Effort, timeoutMs: Number(process.env.OUTCOME_TIMEOUT_MS) || 20_000, // design/33: the host waits until the die lands + 4 s maxTokens: process.env.OUTCOME_EFFORT === "high" ? 9000 : 3000 },
  branch: { model: process.env.BRANCH_MODEL || STORY_MODEL, effort: (process.env.BRANCH_EFFORT || "high") as Effort, timeoutMs: 28_000, maxTokens: 9000 },
  epilogue: { model: STORY_MODEL, effort: (process.env.EPILOGUE_EFFORT || "low") as Effort, timeoutMs: 15_000, maxTokens: 4000 },
};

/**
 * outcome_branches: the three fail-forward branches written ahead, each with a representative roll. The die picks one
 * when it lands: DISASTER/SETBACK -> worse, PARTIAL -> mixed, PROGRESS/GREAT/LEGENDARY -> better (lib/grade.ts branch).
 */
const BRANCH_ROLLS = {
  worse: { total: 4, grade: "SETBACK", branch: "worse", band: "FAIL" },
  mixed: { total: 8, grade: "PARTIAL", branch: "mixed", band: "FAIL" },
  better: { total: 14, grade: "PROGRESS", branch: "better", band: "YES_BUT" },
} as const;
const GRADE_MEANING: Record<string, string> = {
  SETBACK: "it backfires: the problem escalates into a new place or complication, and the stakes rise",
  PARTIAL: "half of it works, and a twist comes with it",
  PROGRESS: "it works: a good path opens",
};

const TASKS = ["character", "scene", "verdict", "outcome", "outcome_branches", "round", "epilogue", "storybook", "kind", "cast", "bot", "story_bible", "tailor", "turn", "story_end", "story_state"];

/** Player-authored text is wrapped so the model treats it as in-world speech, never instructions. */
function wrap(id: string, text: string, max = 240) {
  const clean = String(text ?? "").replace(/[<>]/g, "").slice(0, max);
  return `<player_input id="${id}">${clean}</player_input>`;
}

/** Like wrap, but a skipped answer stays "" so the model can see it was skipped. */
function wrapOpt(id: string, text: string, max = 240) {
  return text ? wrap(id, text, max) : "";
}

const STATS: Stat[] = ["brave", "clever", "charming"];

/** Same stat budget for everyone (+2 / +1 / 0), whatever the model returned. */
function fixStats(h: Hero): Hero {
  return { ...h, stats: evenStats(h.stats ?? { brave: 0, clever: 0, charming: 0 }) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/**
 * The system prompt ends with the group's AUDIENCE note, so each task has 3 prompt variants. The rating goes in the
 * Muse task name (also the prompt cache key), so each variant keeps its own warm cache.
 */
async function run(task: string, input: Any, rating: Rating) {
  const t = (name: string) => `dm-${name}-${rating}`;
  switch (task) {
    case "character": {
      const real = realOf(input.real);
      const hero = await museJSON<Hero>({
        task: t("character"),
        system: withRating(CHARACTER_SYSTEM, rating),
        schema: CHARACTER_SCHEMA,
        effort: "low",
        user: JSON.stringify({
          concept: wrapOpt("p", cleanText(input.concept, 200), 200),
          real: { skill: wrapOpt("skill", real.skill, 120), fear: wrapOpt("fear", real.fear, 120) },
          party_so_far: input.partySoFar ?? [],
          avoid_names: input.avoidNames ?? [],
        }),
      });
      return fixStats(hero);
    }
    case "scene":
      // Scene openers run ~1.7-2k tokens with reasoning; 2.5k truncated one mid-JSON in a playtest.
      return museJSON({ task: t("scene"), system: withRating(SCENE_SYSTEM, rating), schema: SCENE_SCHEMA, effort: "low", maxTokens: 4000, user: JSON.stringify(input) });
    case "verdict":
      // One winning plan per call: spark-1.3 at minimal effort answers in 1-2 s (design/23).
      return museJSON({ task: t("ruling"), model: MODELS.ruling, system: withRating(RULING_SYSTEM, rating), schema: RULING_SCHEMA, effort: "minimal", temperature: 0, timeoutMs: 9000, maxTokens: 1500, user: JSON.stringify(input) });
    case "bot":
      return museJSON({ task: t("bot"), model: MODELS.ruling, system: withRating(BOT_SYSTEM, rating), schema: BOT_SCHEMA, effort: "minimal", timeoutMs: 6000, maxTokens: 400, user: JSON.stringify(input) });
    case "cast":
      return museJSON({ task: t("cast"), model: MODELS.ruling, system: withRating(CAST_SYSTEM, rating), schema: CAST_SCHEMA, effort: "minimal", timeoutMs: 8000, maxTokens: 1200, user: JSON.stringify(input) });
    case "outcome":
      return museJSON({ task: t("outcome"), ...STORY_CALLS.outcome, system: withRating(outcomeSystem({ avoid: avoidOf(input) }), rating), schema: OUTCOME_SCHEMA, user: JSON.stringify(input) });
    case "outcome_branches": {
      // Three parallel calls; a branch that fails or times out comes back null (host then uses the live "outcome" call).
      const helped = input.helped_by || input.idea_from || "";
      const keys = Object.keys(BRANCH_ROLLS) as (keyof typeof BRANCH_ROLLS)[];
      const entries = await Promise.all(
        keys.map(async (b) => {
          const r = BRANCH_ROLLS[b];
          const roll = { total: r.total, grade: r.grade, branch: r.branch, meaning: GRADE_MEANING[r.grade], depth: 0.5 };
          const one = { ...input, band: r.band, natural: null, roll, helped_by: b === "better" ? helped : "" };
          try {
            const d = await museJSON({ task: t("outcome"), ...STORY_CALLS.branch, system: withRating(outcomeSystem({ avoid: avoidOf(input), full: true }), rating), schema: OUTCOME_SCHEMA, user: JSON.stringify(one) });
            return [b, cleanOutcome(scrubDeep(d))] as const;
          } catch (e) {
            console.error(`[ai] outcome branch ${b} failed:`, (e as Error).message);
            return [b, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    }
    case "turn":
      // The procedural engine (design/35): one call per turn; code checks and applies it to the StoryState.
      return runTurn(input, rating);
    case "story_end":
      return runEnding(input, rating);
    case "story_state":
      // The opener -> the first StoryState (pure; also importable from lib/procedural on the TV).
      return stateFromOpener(input.opener, input.party ?? [], Number(input.turns) || 3);
    case "story_bible":
      // Story engine v2 (design/30): the whole story planned once, while the table votes. Cached per story.
      // stored_only: just the pre-built story pack (opener + ending_facts + bible) for a library story, or null.
      if (input.stored_only) return storedPack(input.cache_key, rating, input.turns) ?? { bible: null, opener: null, meta: {} };
      return makeBible({ ...input, turns: turnsOf(input.turns), rating }, { deadlineMs: Number(input.deadline_ms) || 45_000 });
    case "tailor":
      // Story engine v2: the rolled branch's pre-written beat, rewritten for what the hero really did.
      return input.kind === "ending" ? tailorEnding(input, rating) : tailor(input, rating);
    case "round":
      return museJSON({ task: t("round"), system: withRating(ROUND_SYSTEM, rating), schema: ROUND_SCHEMA, effort: "low", timeoutMs: 14_000, user: JSON.stringify(input) });
    case "kind":
      return museJSON({ task: t("kind"), system: withRating(KIND_SYSTEM, rating), schema: KIND_SCHEMA, effort: "minimal", timeoutMs: 9000, maxTokens: 1200, user: JSON.stringify(input) });
    case "epilogue":
      return museJSON({ task: t("epilogue"), ...STORY_CALLS.epilogue, system: withRating(input?.quick_tale ? EPILOGUE_SYSTEM + EPILOGUE_QUICK : EPILOGUE_SYSTEM, rating), schema: EPILOGUE_SCHEMA, user: JSON.stringify(input) });
    case "storybook":
      return museJSON({
        task: t("storybook"),
        system: withRating(STORYBOOK_SYSTEM, rating),
        schema: storybookSchema(input.available_images, !!input.long),
        effort: "low",
        timeoutMs: 40_000,
        maxTokens: 5000,
        user: JSON.stringify(input),
      });
  }
  throw new Error(`unknown task ${task}`);
}

function fallback(task: string, input: Any) {
  switch (task) {
    case "character":
      return fallbackHero(realOf(input.real));
    case "scene":
      return fallbackScene(input.hero_ids ?? [], input.scene_plan ?? {}, input.state?.party ?? []);
    case "verdict":
      return fallbackRuling(STATS.includes(input?.hero?.best_stat) ? input.hero.best_stat : "brave");
    case "bot":
      return { text: "" };
    case "cast":
      return { voice: "vesper", style: "Read this as a low, smoky, mysterious late-night storyteller", kind: "a strange true story", art: "neon", music: "mysterious" };
    case "outcome":
      return fallbackOutcome(cleanText(input?.hero?.name, 40), input?.band);
    case "outcome_branches":
      return { worse: null, mixed: null, better: null };
    case "turn": {
      // Plan-respecting fallback (design/35): names the plan, applies its grade, keeps the story moving.
      const st = input.state ?? stateFromOpener({}, []);
      const grade = (input.grade ?? "PROGRESS") as Grade;
      const hero = cleanText(input?.hero?.name, 40) || "The hero";
      const p = fallbackProposal(st, { hero, attempt: input.attempt, idea_from: input.idea_from, grade, next_player: input.next_player });
      const a = applyTurn(st, p, { hero, attempt: input.attempt, grade });
      return { outcome: p.outcome, scene: p.scene, right_now: a.state.right_now, progress: a.state.progress, progress_delta: a.delta, progress_why: "", finale: a.finale, act: a.state.act, act_changed: a.act_changed, state: a.state, problems: [], fallback: true };
    }
    case "story_end": {
      const w = cleanText(input?.winner?.name ?? input?.winner, 40) || "The heroes";
      const att = cleanText(input?.attempt, 140).replace(/[.!]+$/, "");
      const did = att.toLowerCase().startsWith(w.toLowerCase()) ? att.slice(w.length).trim() : att;
      const credits = (input?.state?.credits ?? []).map((c: Any) => `${c.name} ${c.did}`.trim()).slice(0, 6);
      return {
        ending: `${w} ${did || "makes the final move"}, and ${input?.won ? "it works, for everyone" : "it almost works, which still counts for something"}.`,
        line: input?.won ? "They pulled it off together." : "Well, it's a story.",
        recap: credits.length ? `${credits.join(", then ")}.` : "",
        skills: [],
      };
    }
    case "story_state":
      return stateFromOpener(input.opener, input.party ?? [], Number(input.turns) || 3);
    case "story_bible":
      return { bible: null, meta: {} };
    case "tailor":
      return fallbackTailor(input);
    case "round":
      return fallbackRound(input.actions ?? []);
    case "kind":
      return fallbackKind(input);
    case "epilogue":
      return FALLBACK_EPILOGUE;
    case "storybook":
      return fallbackStorybook(input.title ?? "A Tale", input.heroes ?? [], input.available_images ?? ["scene_1"]);
  }
}

/**
 * Strict schemas should guarantee shape, but a demo can't bet on it: every field the game reads is checked
 * against the fallback's shape, and anything missing or the wrong type is filled from the fallback.
 */
function conform(shape: Any, data: Any): Any {
  if (Array.isArray(shape)) return Array.isArray(data) ? data : shape;
  if (shape && typeof shape === "object") {
    if (!data || typeof data !== "object" || Array.isArray(data)) return shape;
    const out: Any = { ...data };
    for (const k of Object.keys(shape)) out[k] = conform(shape[k], data[k]);
    return out;
  }
  return typeof data === typeof shape ? data : shape;
}

/** Backstop for the most recognizable AI-writing tells, applied to every string the DM writes. */
function scrub(text: string): string {
  let s = text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s*(\.\.\.|…)\s*/g, ". ")
    .replace(/\b([A-Z]{3,})\b/g, (w) => (["NPC", "USA", "ATM", "UFO", "DJ", "TV", "AI", "OK"].includes(w) ? w : w[0] + w.slice(1).toLowerCase()))
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ");
  // At most one exclamation mark per string.
  let seen = false;
  s = s.replace(/!+/g, () => (seen ? "." : ((seen = true), "!")));
  return s.trim();
}

function scrubDeep(v: Any, key = ""): Any {
  if (typeof v === "string") return ["hero_id", "pitch_id", "image_ref", "stat", "tier", "kind", "moderation", "sfx", "music", "pronouns", "concept_status"].includes(key) ? v : scrub(v);
  if (Array.isArray(v)) return v.map((x) => scrubDeep(x, key));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrubDeep(x, k)]));
  return v;
}

const TIERS = ["clever", "solid", "risky", "wild", "miracle"];

/** The live story's words, so a Writers' Room example game that overlaps it is left out of the prompt. */
function avoidOf(input: Any) {
  return [input?.story?.title, input?.real_event?.place_type, input?.story_so_far?.problem, input?.situation].map((x) => String(x ?? "")).join(" ");
}

/** The outcome fields the host reads, cleaned; null when there is no text. */
function cleanOutcome(data: Any) {
  const clean = (x: unknown) => String(x ?? "").replace(/<\/?player_input[^>]*>/g, "").trim();
  const text = clean(data?.text);
  if (!text) return null;
  return {
    text,
    situation: clean(data.situation).slice(0, 220),
    why: clean(data.why).slice(0, 180),
    now_goal: clean(data.now_goal).replace(/[.!]+$/, "").slice(0, 70),
    // The story spine (host.ts storySoFar), the decision's painting brief and a line for callbacks.
    where: clean(data.where).slice(0, 80),
    changed: clean(data.changed).slice(0, 120),
    new_prop: clean(data.new_prop).slice(0, 40),
    scene: clean(data.scene).slice(0, 260),
    memorable: clean(data.memorable).slice(0, 90),
  };
}

/** opener.real_setting {place_type, roles, situation, stakes, arc}, clipped; undefined when missing. */
function realEvent(r: Any) {
  if (!r || typeof r !== "object") return undefined;
  const s = (x: unknown, n: number) => String(x ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  const list = (x: unknown, k: number, n: number) => (Array.isArray(x) ? x.map((v) => s(v, n)).filter(Boolean).slice(0, k) : []);
  const out = { place_type: s(r.place_type, 120), roles: list(r.roles, 5, 60), situation: s(r.situation, 200), stakes: s(r.stakes, 160), arc: list(r.arc, 5, 100) };
  return out.place_type || out.situation ? out : undefined;
}

/**
 * The tailor's instant fallback: the bible's beat with its slots filled in code (no AI). Same shape as the
 * "outcome" task (turns) or the "epilogue" task (kind "ending"), so host.ts reads it the same way.
 */
function fallbackTailor(input: Any) {
  const hero = cleanText(input?.hero?.name ?? input?.winner?.name ?? input?.winner, 40);
  const branch = String(input?.roll?.branch ?? "");
  const beatText = String(input?.beat?.text ?? "");
  if (input?.kind === "ending") {
    return { ending: beatText ? fillBeat(beatText, { hero, attempt: input?.attempt, branch: "worse" }) : FALLBACK_EPILOGUE.ending, line: String(input?.beat?.line ?? FALLBACK_EPILOGUE.line ?? ""), recap: "", skills: [] };
  }
  // Player-driven (CD): the fallback says the chosen plan happened, at its strength. The head writer's reference
  // line is not pasted, because it was written without knowing the plan.
  const won = branch === "better" || branch === "legendary";
  const how = ({ legendary: "and it works better than anyone hoped", better: "and it works", mixed: "and it half works", worse: "and it backfires" } as Record<string, string>)[branch] ?? "";
  const text = how ? fillBeat(`{hero} {action}${won && input?.idea_from ? ", {friend}'s idea," : ","} ${how}.`, { hero, attempt: input?.attempt, idea_from: input?.idea_from, branch }) : beatText ? fillBeat(beatText, { hero, attempt: input?.attempt, idea_from: input?.idea_from, branch }) : fallbackOutcome(hero, input?.band).text;
  const carry = String(input?.beat?.carry ?? "").trim();
  const nextSit = String(input?.next?.situation ?? "").trim();
  return { text, situation: (nextSit || String(input?.situation ?? "")).slice(0, 220), now_goal: String(input?.next?.goal ?? input?.ahead?.[0] ?? ""), steps: 1, goal_reached: false, scene: "", why: carry, where: "", changed: carry, new_prop: "", memorable: "" };
}

/** Every piece of player-written text is wrapped as <player_input>, wherever it rides along. */
function wrapPlayerText(task: string, input: Any) {
  if (task === "kind") {
    // A fresh object: the fallback needs the raw draft.
    return {
      ...input,
      ward_name: String(input.ward_name ?? "").slice(0, 40),
      frame: String(input.frame ?? "").slice(0, 80),
      draft: input.draft ? wrap("draft", input.draft, 240) : "",
      moments: ((input.moments as Any[]) ?? []).slice(0, 4).map((m, i) => ({ pitch: wrap(`m${i}`, m?.pitch, 200), what_happened: String(m?.what_happened ?? "").slice(0, 240) })),
    };
  }
  if (task === "turn") input.plan_raw = String(input.plan ?? "").slice(0, 200);
  if (task === "verdict" || task === "outcome" || task === "outcome_branches" || task === "tailor" || task === "turn" || task === "story_end") input.plan = wrap("plan", input.plan, 200);
  // The real event behind the story (opener.real_setting, spoiler-free): only its known fields, clipped.
  if (["verdict", "outcome", "outcome_branches", "epilogue", "tailor", "story_bible"].includes(task)) input.real_event = realEvent(input.real_event ?? input.story_so_far?.real_event);
  if (input.story_so_far?.real_event) delete input.story_so_far.real_event;
  if (task === "round" && Array.isArray(input.actions))
    input.actions = input.actions.map((a: Any) => ({ ...a, pitch: wrap(a.hero_id, a.pitch), appeal: a.appeal ? wrap(`${a.hero_id}-appeal`, a.appeal) : "" }));
  if ((task === "storybook" || task === "epilogue") && Array.isArray(input.log))
    input.log = input.log.map((l: Any, i: number) => (typeof l === "string" ? wrap(`l${i}`, l) : { ...l, pitch: wrap(`l${i}`, l?.pitch) }));
  if (task === "epilogue" && input.final?.final_moves)
    input.final.final_moves = Object.fromEntries(Object.entries(input.final.final_moves).map(([k, v]) => [k, wrap(`f-${k}`, String(v))]));
  if (task === "storybook" && input.final_moves)
    input.final_moves = Object.fromEntries(Object.entries(input.final_moves).map(([k, v]) => [k, wrap(`f-${k}`, String(v))]));
  // "One true thing about the real you": private context for one gentle nod in a scene opener only; every other task never sees it.
  if (Array.isArray(input.state?.party))
    input.state.party = input.state.party.map((p: Any) => {
      const { truth_hint, ...rest } = p ?? {};
      return task === "scene" && truth_hint ? { ...rest, truth_hint: wrap(`${p.id}-truth`, truth_hint, 80) } : rest;
    });
  return input;
}

export async function POST(req: Request) {
  const { task, input: rawInput } = await req.json();
  if (!TASKS.includes(task)) return NextResponse.json({ error: "unknown task" }, { status: 400 });
  const input = wrapPlayerText(task, rawInput ?? {});
  const fbInput = task === "kind" ? rawInput ?? {} : input;
  try {
    let data: Any = await run(task, input, ratingOf(rawInput?.rating));
    data = scrubDeep(conform(fallback(task, fbInput), data));
    if (task === "epilogue" && !String(data.ending ?? "").trim()) throw new Error("empty ending");
    if (task === "outcome" || (task === "tailor" && input.kind !== "ending")) {
      const raw = data;
      data = cleanOutcome(data);
      if (!data) throw new Error(`empty ${task}`);
      if (task === "tailor" && /[{}]/.test(data.text)) throw new Error("tailor left a slot unfilled");
      if (task === "tailor") {
        const pm = { ...pronounMap(input.pronouns), ...(input?.hero?.name && input?.hero?.pronouns ? { [String(input.hero.name)]: String(input.hero.pronouns) } : {}) };
        const probs = liveProblems(`${data.text} ${data.situation}`, pm);
        if (probs.length) throw new Error(`tailor: ${probs.join(", ")}`);
      }
      if (task === "tailor") {
        // Player-driven progress: a strong success may skip a milestone or reach the goal (then: the finale).
        const won = ["better", "legendary"].includes(String(input?.roll?.branch ?? ""));
        data.beat = BEAT_OF[String(input?.roll?.branch ?? "")] ?? "";
        data.steps = won && raw?.steps === 2 ? 2 : 1;
        data.goal_reached = won && raw?.goal_reached === true;
      }
    }
    if (task === "tailor" && input.kind === "ending") {
      if (!String(data.ending ?? "").trim() || /[{}]/.test(data.ending)) throw new Error("empty or unfilled ending");
      const probs = liveProblems(`${data.ending} ${data.line} ${data.recap}`, pronounMap(input.pronouns));
      if (probs.length) throw new Error(`ending: ${probs.join(", ")}`);
    }
    if (task === "story_bible" && !data?.bible) return NextResponse.json({ data, fallback: true });
    if (task === "outcome_branches" && !data.worse && !data.mixed && !data.better) throw new Error("no branches");
    if (task === "kind") {
      // The sentence must finish the frame and stay a sentence; otherwise use the safe local version.
      const frame = String(rawInput?.frame ?? "").trim().toLowerCase();
      const sentence = String(data.sentence ?? "").replace(/!/g, ".").trim();
      if (!sentence || (frame && !sentence.toLowerCase().startsWith(frame)) || sentence.length > 260) throw new Error("kind sentence off-frame");
      data = { ok: !!data.ok, sentence: /[.?"”]$/.test(sentence) ? sentence : `${sentence}.` };
    }
    if (task === "verdict") {
      data = {
        ...data,
        tier: TIERS.includes(data?.tier) ? data.tier : "solid",
        stat: STATS.includes(data?.stat) ? data.stat : input?.hero?.best_stat ?? "brave",
        interpretation: String(data?.interpretation ?? "").replace(/<\/?player_input[^>]*>/g, "").slice(0, 120),
        // DM's Notes: one short plain line, never a wall of text.
        reason: String(data?.reason ?? "").replace(/<\/?player_input[^>]*>/g, "").split(/\s+/).slice(0, 20).join(" ").slice(0, 140),
      };
    }
    return NextResponse.json({ data, fallback: false });
  } catch (e) {
    console.error(`[ai] ${task} failed, using fallback:`, (e as Error).message);
    return NextResponse.json({ data: fallback(task, fbInput), fallback: true });
  }
}
