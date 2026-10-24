// Pre-generates the 3 scene illustrations for each seed quest (run: node scripts/pregen-scenes.mjs).
// Skips files that already exist. Hard cap of MAX_REQUESTS API calls per run (budget guard).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "game");
const MAX_REQUESTS = 18;
const CONCURRENCY = 5;
const ENDPOINT = "https://api.meta.ai/v1/images/generations";

function readKey() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const m = txt.match(/^\s*MODEL_API_KEY\s*=\s*(.*)\s*$/m);
  if (!m) throw new Error("MODEL_API_KEY not found in .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const KEY = readKey();

// ---- reproduced verbatim from game/src/server/prompts.ts ----
const STYLE =
  "storybook illustration, hand-inked sepia linework with warm gouache and watercolor washes on aged parchment, gold-leaf accents, soft golden rim light, limited palette of ochre, crimson, forest green and midnight blue, whimsical and hopeful, classic picture-book composition";
const NEGATIVE =
  "Original fictional characters only, no real people, no celebrities, no logos or brands. No text, no letters, no words, no captions, no signage, no watermark, no signature. Family-friendly, no gore.";
const MOOD = {
  hook: "bright, hopeful morning light",
  twist: "stormy dusk with dramatic clouds",
  climax: "golden sunset with dramatic clouds",
};
function scenePrompt(s) {
  return `${STYLE}. Wide cinematic storybook scene, eye-level establishing shot of ${s.location} in ${s.realm}: ${s.description}
${s.threat ? `The threat looms in the upper part of the image: ${s.threat}` : ""}
Mood and light: ${MOOD[s.kind] ?? MOOD.hook}. No heroes in the scene. Keep the lower third calm and uncluttered.
${NEGATIVE}`;
}

const seeds = JSON.parse(fs.readFileSync(path.join(GAME, "src/data/seed_quests.json"), "utf8"));
const kinds = ["hook", "twist", "climax"];

const jobs = [];
for (const seed of seeds) {
  const locs = seed.locations;
  const idx = [0, Math.floor(locs.length / 2), locs.length - 1];
  kinds.forEach((kind, i) => {
    jobs.push({
      id: seed.id,
      n: i + 1,
      file: path.join(GAME, "public", "quests", seed.id, `scene_${i + 1}.webp`),
      prompt: scenePrompt({
        kind,
        location: locs[idx[i]].name,
        description: locs[idx[i]].description,
        realm: seed.realm_name,
        threat: kind === "climax" ? seed.the_threat.description : "",
      }),
    });
  });
}

let requests = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callApi(prompt) {
  if (requests >= MAX_REQUESTS) throw new Error("request cap reached");
  requests++;
  return fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "muse-image-1.0",
      n: 1,
      size: "1920x1080",
      response_format: "b64_json",
      output_format: "webp",
      reasoning_strength: "high",
      tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
      prompt,
    }),
  });
}

async function generate(job) {
  let res = await callApi(job.prompt);
  if (res.status === 429 || res.status === 503) {
    await sleep(3000);
    res = await callApi(job.prompt); // single retry
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no b64_json in response");
  fs.mkdirSync(path.dirname(job.file), { recursive: true });
  fs.writeFileSync(job.file, Buffer.from(b64, "base64"));
}

const t0 = Date.now();
const todo = jobs.filter((j) => !fs.existsSync(j.file));
console.log(`${jobs.length - todo.length} exist, ${todo.length} to generate`);

let next = 0;
async function worker() {
  while (next < todo.length) {
    const job = todo[next++];
    const s = Date.now();
    try {
      await generate(job);
      console.log(`ok   ${job.id}/scene_${job.n} (${((Date.now() - s) / 1000).toFixed(1)}s)`);
    } catch (e) {
      console.error(`FAIL ${job.id}/scene_${job.n}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

const manifest = {};
for (const seed of seeds) {
  const list = [1, 2, 3]
    .filter((n) => fs.existsSync(path.join(GAME, "public", "quests", seed.id, `scene_${n}.webp`)))
    .map((n) => `/quests/${seed.id}/scene_${n}.webp`);
  manifest[seed.id] = list;
}
fs.writeFileSync(path.join(GAME, "src/data/quest_images.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`done: ${requests} requests, ${((Date.now() - t0) / 1000).toFixed(1)}s total`);
