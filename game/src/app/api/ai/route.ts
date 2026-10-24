import { NextResponse } from "next/server";
import { museJSON, museText } from "@/server/muse";
import {
  CHARACTER_SCHEMA,
  CHARACTER_SYSTEM,
  EPILOGUE_SYSTEM,
  OUTCOME_SCHEMA,
  OUTCOME_SYSTEM,
  SCENE_SCHEMA,
  SCENE_SYSTEM,
  STORYBOOK_SYSTEM,
  VERDICT_SCHEMA,
  VERDICT_SYSTEM,
  storybookSchema,
} from "@/server/prompts";
import {
  FALLBACK_EPILOGUE,
  fallbackHero,
  fallbackOutcome,
  fallbackScene,
  fallbackStorybook,
  fallbackVerdict,
} from "@/server/fallbacks";
import type { Band, Hero, Stat } from "@/lib/types";

export const maxDuration = 60;

/** Player-authored text is wrapped so the model treats it as in-world speech, never instructions. */
function wrap(id: string, text: string) {
  const clean = String(text ?? "").replace(/[<>]/g, "").slice(0, 200);
  return `<player_input id="${id}">${clean}</player_input>`;
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

async function run(task: string, input: Any) {
  switch (task) {
    case "character": {
      const hero = await museJSON<Hero>({
        task: "dm-character",
        system: CHARACTER_SYSTEM,
        schema: CHARACTER_SCHEMA,
        effort: "low",
        user: JSON.stringify({ concept: wrap("p", input.concept), party_so_far: input.partySoFar ?? [], avoid_names: input.avoidNames ?? [] }),
      });
      return fixStats(hero);
    }
    case "scene":
      return museJSON({
        task: "dm-scene",
        system: SCENE_SYSTEM,
        schema: SCENE_SCHEMA,
        effort: "low",
        user: JSON.stringify(input),
      });
    case "verdict": {
      const pitches = (input.pitches as Any[]).map((p) => ({ ...p, text: wrap(p.hero_id, p.text) }));
      return museJSON({
        task: "dm-verdict",
        system: VERDICT_SYSTEM,
        schema: VERDICT_SCHEMA,
        effort: "minimal",
        timeoutMs: 10_000,
        user: JSON.stringify({ ...input, pitches }),
      });
    }
    case "outcome":
      return museJSON({
        task: "dm-outcome",
        system: OUTCOME_SYSTEM,
        schema: OUTCOME_SCHEMA,
        effort: "minimal",
        timeoutMs: 10_000,
        user: JSON.stringify({ ...input, action: { ...input.action, pitch: wrap(input.action.hero_id, input.action.pitch) } }),
      });
    case "epilogue":
      return museText({ task: "dm-epilogue", system: EPILOGUE_SYSTEM, user: JSON.stringify(input), effort: "low" });
    case "storybook":
      return museJSON({
        task: "dm-storybook",
        system: STORYBOOK_SYSTEM,
        schema: storybookSchema(input.available_images),
        effort: "low",
        timeoutMs: 40_000,
        maxTokens: 5000,
        user: JSON.stringify(input),
      });
    default:
      throw new Error(`unknown task ${task}`);
  }
}

function fallback(task: string, input: Any) {
  switch (task) {
    case "character":
      return fallbackHero(input.concept ?? "");
    case "scene":
      return fallbackScene(input.hero_ids ?? [], input.scene_plan?.objective ?? "What do you do?");
    case "verdict":
      return { verdicts: (input.pitches as Any[]).map((p) => fallbackVerdict(p.pitch_id, p.best_stat ?? "brave")) };
    case "outcome":
      return fallbackOutcome(input.roll?.band as Band, input.hero_name ?? "Our hero");
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

const TIERS = ["clever", "solid", "risky", "absurd", "miracle"];
const STAT_NAMES = ["brave", "clever", "charming"];

/** Player-written text that rides along in other fields gets the same <player_input> wrapping. */
function wrapPlayerText(task: string, input: Any) {
  if (task === "verdict" && Array.isArray(input.other_pitches)) input.other_pitches = input.other_pitches.map((t: string, i: number) => wrap(`o${i}`, t));
  if (task === "outcome" && Array.isArray(input.supporting_pitches))
    input.supporting_pitches = input.supporting_pitches.map((s: Any, i: number) => ({ ...s, pitch: wrap(`s${i}`, s?.pitch) }));
  if (task === "storybook" && Array.isArray(input.log)) input.log = input.log.map((l: Any, i: number) => ({ ...l, pitch: wrap(`l${i}`, l?.pitch) }));
  return input;
}

export async function POST(req: Request) {
  const { task, input: rawInput } = await req.json();
  if (!["character", "scene", "verdict", "outcome", "epilogue", "storybook"].includes(task)) {
    return NextResponse.json({ error: "unknown task" }, { status: 400 });
  }
  const input = wrapPlayerText(task, rawInput ?? {});
  try {
    let data: Any = await run(task, input);
    if (task === "epilogue") {
      if (typeof data !== "string" || !data.trim()) throw new Error("empty epilogue");
    } else {
      data = conform(fallback(task, input), data);
    }
    if (task === "verdict") {
      data.verdicts = (data.verdicts as Any[]).map((v) => ({
        ...v,
        tier: TIERS.includes(v?.tier) ? v.tier : "solid",
        stat: STAT_NAMES.includes(v?.stat) ? v.stat : input.pitches?.[0]?.best_stat ?? "brave",
      }));
    }
    return NextResponse.json({ data, fallback: false });
  } catch (e) {
    console.error(`[ai] ${task} failed, using fallback:`, (e as Error).message);
    return NextResponse.json({ data: fallback(task, input), fallback: true });
  }
}
