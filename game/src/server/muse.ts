import "server-only";

const BASE = "https://api.meta.ai/v1";
const TEXT_MODEL = "muse-spark-1.3";
const IMAGE_MODEL = "muse-image-1.0";

if (/-contributor$/.test(TEXT_MODEL)) throw new Error("Never use -contributor models: Meta trains on that data.");

function key() {
  const k = process.env.MODEL_API_KEY;
  if (!k) throw new Error("MODEL_API_KEY is not set");
  return k;
}

function headers() {
  return { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" };
}

export type Effort = "minimal" | "low" | "medium" | "high";

export async function museJSON<T>(opts: {
  task: string;
  system: string;
  user: string;
  schema: object;
  effort?: Effort;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<T> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: "developer", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: opts.task.replace(/\W/g, "_"), schema: opts.schema, strict: true } },
      reasoning_effort: opts.effort ?? "minimal",
      max_completion_tokens: opts.maxTokens ?? 2500,
      prompt_cache_key: opts.task,
    }),
  });
  if (!res.ok) throw new Error(`muse ${opts.task} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content;
  if (!content) throw new Error(`muse ${opts.task}: empty response (${j.choices?.[0]?.finish_reason})`);
  console.log(`[muse] ${opts.task} ${Date.now() - t0}ms in=${j.usage?.prompt_tokens} out=${j.usage?.completion_tokens}`);
  return JSON.parse(content) as T;
}

export async function museText(opts: { task: string; system: string; user: string; effort?: Effort; timeoutMs?: number }): Promise<string> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: "developer", content: opts.system },
        { role: "user", content: opts.user },
      ],
      reasoning_effort: opts.effort ?? "low",
      max_completion_tokens: 2000,
      prompt_cache_key: opts.task,
    }),
  });
  if (!res.ok) throw new Error(`muse ${opts.task} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  console.log(`[muse] ${opts.task} ${Date.now() - t0}ms`);
  return String(j.choices?.[0]?.message?.content ?? "").trim();
}

export async function museImage(opts: {
  prompt: string;
  size: "1920x1080" | "1024x1536";
  quality: "fast" | "best";
  refs?: string[]; // data URLs; present → edits endpoint
  timeoutMs?: number;
}): Promise<{ b64: string; mime: string }> {
  const t0 = Date.now();
  const body: Record<string, unknown> = {
    model: IMAGE_MODEL,
    n: 1,
    size: opts.size,
    response_format: "b64_json",
    output_format: "webp",
    reasoning_strength: opts.quality === "best" ? "high" : "low",
    tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
    prompt: opts.prompt,
  };
  if (opts.refs?.length) body.images = opts.refs.map((u) => ({ image_url: u }));
  const res = await fetch(`${BASE}/images/${opts.refs?.length ? "edits" : "generations"}`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`muse image HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error("muse image: no data");
  console.log(`[muse] image ${opts.size} ${opts.quality} ${Date.now() - t0}ms`);
  return { b64, mime: "image/webp" };
}
