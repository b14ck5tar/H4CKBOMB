import "server-only";
import { museJSON, type Effort } from "@/server/muse";

/**
 * Story engine v2 (design/30): ONE place that says which model writes which stage.
 *   bible  = the whole story planned once, with no time pressure (lobby/vote, ~20-40 s): best quality.
 *   tailor = each turn's pre-written outcome rewritten for what the player really did (live, <= 3 s): fastest good.
 *
 * A config is a named pair. The live game uses STORY_ENGINE (env) or DEFAULT_ENGINE. The story lab
 * (scripts/story-lab.mjs) compares configs blind; in dev, /api/ai accepts input.engine to pick one per call.
 * OpenAI configs only work when OPENAI_API_KEY is set (read here, never logged).
 */

export type Provider = "meta" | "openai";
export type StageModel = { provider: Provider; model: string; effort?: Effort; timeoutMs: number; maxTokens: number; temperature?: number };
export type Engine = { label: string; bible: StageModel; tailor: StageModel };

const SPARK = "muse-spark-1.3";
const WONDER = "muse-wonder-1.0";

/**
 * Tailor on Spark at "minimal": the story lab measured "low" at 7-9 s per tailor (1.3-1.6k reasoning tokens), over
 * the 3 s budget; minimal was 2.9 s in the outcome bake-off (design/26).
 */
// The host starts the tailor when the die is decided (right after the ruling), so the swipe and the tumble hide
// ~4-6 s of it; after the die lands it waits at most 3 s more, then shows the stored beat filled in code.
const SPARK_TAILOR: StageModel = { provider: "meta", model: SPARK, effort: "minimal", timeoutMs: 8_000, maxTokens: 2_500 };

export const ENGINES = {
  "wonder+spark": {
    label: "muse-wonder-1.0 (medium) bible + muse-spark-1.3 (minimal) tailor",
    // Wonder took 33-39 s in the lab; Muse can run ~4x slower at peak, and bibles are pre-built or hidden in the vote.
    bible: { provider: "meta", model: WONDER, effort: "medium", timeoutMs: 180_000, maxTokens: 16_000 },
    tailor: SPARK_TAILOR,
  },
  "spark-medium+spark": {
    label: "muse-spark-1.3 (medium) bible + muse-spark-1.3 (minimal) tailor",
    // 16k ran out of room ("empty response (length)"): Spark spends 10-18k tokens reasoning on a bible.
    bible: { provider: "meta", model: SPARK, effort: "medium", timeoutMs: 180_000, maxTokens: 32_000 },
    tailor: SPARK_TAILOR,
  },
  /** Too slow for a bible: 78 s with 18k output tokens once, then timeouts and "length" failures (kept for reference). */
  "spark-high+spark": {
    label: "muse-spark-1.3 (high) bible + muse-spark-1.3 (minimal) tailor",
    bible: { provider: "meta", model: SPARK, effort: "high", timeoutMs: 110_000, maxTokens: 24_000 },
    tailor: SPARK_TAILOR,
  },
  "gpt-4.1": {
    label: "gpt-4.1 bible + gpt-4.1 tailor",
    bible: { provider: "openai", model: "gpt-4.1", timeoutMs: 60_000, maxTokens: 6_000, temperature: 0.8 },
    tailor: { provider: "openai", model: "gpt-4.1", timeoutMs: 8_000, maxTokens: 900, temperature: 0.7 },
  },
} satisfies Record<string, Engine>;

export type EngineId = keyof typeof ENGINES;
export const DEFAULT_ENGINE: EngineId = "wonder+spark";

export function hasOpenAI() {
  return !!process.env.OPENAI_API_KEY;
}

/** The engine for this call: an explicit id (dev / story lab only), else STORY_ENGINE, else the default. */
export function engineOf(id?: unknown): EngineId {
  const dev = process.env.NODE_ENV !== "production";
  const pick = (x: unknown) => (typeof x === "string" && x in ENGINES ? (x as EngineId) : null);
  const want = (dev && pick(id)) || pick(process.env.STORY_ENGINE) || DEFAULT_ENGINE;
  return ENGINES[want].bible.provider === "openai" && !hasOpenAI() ? DEFAULT_ENGINE : want;
}

async function openaiJSON<T>(m: StageModel, o: { task: string; system: string; user: string; schema: object }): Promise<T> {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("OPENAI_API_KEY is not set");
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(m.timeoutMs),
    body: JSON.stringify({
      model: m.model,
      messages: [
        { role: "system", content: o.system },
        { role: "user", content: o.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: o.task.replace(/\W/g, "_"), schema: o.schema, strict: true } },
      max_completion_tokens: m.maxTokens,
      ...(m.temperature != null ? { temperature: m.temperature } : {}),
      ...(m.effort && /^(o\d|gpt-5)/.test(m.model) ? { reasoning_effort: m.effort } : {}),
    }),
  });
  if (!res.ok) throw new Error(`openai ${o.task} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content;
  if (!content) throw new Error(`openai ${o.task}: empty response (${j.choices?.[0]?.finish_reason})`);
  console.log(`[openai] ${o.task} ${m.model} ${Date.now() - t0}ms in=${j.usage?.prompt_tokens} out=${j.usage?.completion_tokens}`);
  return JSON.parse(content) as T;
}

/** One JSON call for a stage of an engine, on whichever provider that stage uses. */
export function stageJSON<T>(engine: EngineId, stage: "bible" | "tailor", o: { task: string; system: string; user: string; schema: object; timeoutMs?: number }): Promise<T> {
  const m: StageModel = ENGINES[engine][stage];
  const mm = o.timeoutMs ? { ...m, timeoutMs: o.timeoutMs } : m;
  if (mm.provider === "openai") return openaiJSON<T>(mm, o);
  return museJSON<T>({ task: o.task, system: o.system, user: o.user, schema: o.schema, model: mm.model, effort: mm.effort, timeoutMs: mm.timeoutMs, maxTokens: mm.maxTokens, temperature: mm.temperature });
}

/** For DM's Notes and the story lab: which model wrote a stage. */
export function stageLabel(engine: EngineId, stage: "bible" | "tailor") {
  const m: StageModel = ENGINES[engine][stage];
  return `${m.model}${m.effort ? ` (${m.effort})` : ""}`;
}
