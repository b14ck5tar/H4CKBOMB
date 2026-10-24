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

export async function POST(req: Request) {
  const { task, input } = await req.json();
  try {
    const data = await run(task, input);
    return NextResponse.json({ data, fallback: false });
  } catch (e) {
    console.error(`[ai] ${task} failed, using fallback:`, (e as Error).message);
    return NextResponse.json({ data: fallback(task, input), fallback: true });
  }
}
