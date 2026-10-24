import { NextResponse } from "next/server";
import { museJSON, museText } from "@/server/muse";
import {
  CHARACTER_SCHEMA,
  CHARACTER_SYSTEM,
  EPILOGUE_QUICK,
  EPILOGUE_SYSTEM,
  KIND_SCHEMA,
  KIND_SYSTEM,
  ROUND_SCHEMA,
  ROUND_SYSTEM,
  SCENE_SCHEMA,
  SCENE_SYSTEM,
  STORYBOOK_SYSTEM,
  VERDICT_SCHEMA,
  VERDICT_SYSTEM,
  storybookSchema,
  withRating,
} from "@/server/prompts";
import { FALLBACK_EPILOGUE, fallbackHero, fallbackKind, fallbackRound, fallbackScene, fallbackStorybook, fallbackVerdict } from "@/server/fallbacks";
import { cleanText, ratingOf, realOf } from "@/server/real";
import type { Hero, Rating, Stat } from "@/lib/types";

export const maxDuration = 60;

const TASKS = ["character", "scene", "verdict", "round", "epilogue", "storybook", "kind"];

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

function fixStats(h: Hero): Hero {
  const vals = STATS.map((s) => h.stats[s]).sort((a, b) => a - b).join(",");
  if (vals === "-1,1,3") return h;
  const ranked = [...STATS].sort((a, b) => h.stats[b] - h.stats[a]);
  return { ...h, stats: { [ranked[0]]: 3, [ranked[1]]: 1, [ranked[2]]: -1 } as Hero["stats"] };
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
      return museJSON({ task: t("verdict"), system: withRating(VERDICT_SYSTEM, rating), schema: VERDICT_SCHEMA, effort: "minimal", timeoutMs: 10_000, user: JSON.stringify(input) });
    case "round":
      return museJSON({ task: t("round"), system: withRating(ROUND_SYSTEM, rating), schema: ROUND_SCHEMA, effort: "low", timeoutMs: 14_000, user: JSON.stringify(input) });
    case "kind":
      return museJSON({ task: t("kind"), system: withRating(KIND_SYSTEM, rating), schema: KIND_SCHEMA, effort: "minimal", timeoutMs: 9000, maxTokens: 1200, user: JSON.stringify(input) });
    case "epilogue":
      return museText({ task: t("epilogue"), system: withRating(input?.quick_tale ? EPILOGUE_SYSTEM + EPILOGUE_QUICK : EPILOGUE_SYSTEM, rating), user: JSON.stringify(input), effort: "low" });
    case "storybook":
      return museJSON({
        task: t("storybook"),
        system: withRating(STORYBOOK_SYSTEM, rating),
        schema: storybookSchema(input.available_images),
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
      return { verdicts: ((input.pitches as Any[]) ?? []).map((p) => fallbackVerdict(p.pitch_id, p.best_stat ?? "brave")) };
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

const TIERS = ["clever", "solid", "risky", "absurd", "miracle"];

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
  if (task === "verdict") {
    input.pitches = ((input.pitches as Any[]) ?? []).map((p) => ({ ...p, text: wrap(p.hero_id, p.text), appeal: p.appeal ? wrap(`${p.hero_id}-appeal`, p.appeal) : "" }));
    if (Array.isArray(input.other_pitches)) input.other_pitches = input.other_pitches.map((t: string, i: number) => wrap(`o${i}`, t));
  }
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
    if (task === "epilogue") {
      if (typeof data !== "string" || !data.trim()) throw new Error("empty epilogue");
      data = scrub(data);
    } else {
      data = scrubDeep(conform(fallback(task, fbInput), data));
    }
    if (task === "kind") {
      // The sentence must finish the frame and stay a sentence; otherwise use the safe local version.
      const frame = String(rawInput?.frame ?? "").trim().toLowerCase();
      const sentence = String(data.sentence ?? "").replace(/!/g, ".").trim();
      if (!sentence || (frame && !sentence.toLowerCase().startsWith(frame)) || sentence.length > 260) throw new Error("kind sentence off-frame");
      data = { ok: !!data.ok, sentence: /[.?"”]$/.test(sentence) ? sentence : `${sentence}.` };
    }
    if (task === "verdict") {
      data.verdicts = (data.verdicts as Any[]).map((v) => ({
        ...v,
        tier: TIERS.includes(v?.tier) ? v.tier : "solid",
        stat: STATS.includes(v?.stat) ? v.stat : input.pitches?.[0]?.best_stat ?? "brave",
        // DM's Notes: one short plain line, never a wall of text.
        reason: String(v?.reason ?? "").replace(/<\/?player_input[^>]*>/g, "").split(/\s+/).slice(0, 20).join(" ").slice(0, 140),
      }));
    }
    return NextResponse.json({ data, fallback: false });
  } catch (e) {
    console.error(`[ai] ${task} failed, using fallback:`, (e as Error).message);
    return NextResponse.json({ data: fallback(task, fbInput), fallback: true });
  }
}
