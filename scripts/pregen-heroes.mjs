// Pre-paints the ready-made characters' portraits (run once: node scripts/pregen-heroes.mjs).
// Reads game/src/data/quickstart_heroes.json, writes game/public/heroes/<id>.webp.
// Skips files that already exist (delete one to repaint it). Hard cap of MAX_REQUESTS API calls per run (budget guard).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "game");
const MAX_REQUESTS = 8;
const CONCURRENCY = 3;
const ENDPOINT = "https://api.meta.ai/v1/images/generations";

function readKey() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const m = txt.match(/^\s*MODEL_API_KEY\s*=\s*(.*)\s*$/m);
  if (!m) throw new Error("MODEL_API_KEY not found in .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const KEY = readKey();

// ---- mirrors CHARACTER_STYLE, NEGATIVE and portraitPrompt in game/src/server/prompts.ts ----
const NEGATIVE =
  "Original fictional characters only, no real people, no celebrities, no logos or brands. No text, no letters, no words, no numbers, no captions, no readable signs, all screens and labels blank, no speech bubbles, no sound-effect lettering, no comic panels or borders, no watermark, no signature. Family-friendly, no gore.";
const CHARACTER_STYLE =
  "Stylized cartoon character design in the style of a modern animated series (Gravity Falls, Hilda, Spider-Verse's Spider-Ham energy): big simple graphic shapes, exaggerated proportions with an oversized head, a simple expressive face with clean cartoon eyes, bold ink outlines, flat colors with halftone shading. Clearly a drawn character, NOT a realistic person: no realistic faces, skin texture, pores, or photographic anatomy.";

function portraitPrompt(v, flaw, ability = "") {
  return `${CHARACTER_STYLE} Character: ${v.anchor}, ${v.expression}, holding ${v.prop}, wearing ${v.outfit}, color accents ${v.palette.join(", ")}.${ability ? ` One small visible supernatural tell of their strange edge (${ability}), glowing faint magenta and cyan.` : ""} Their flaw is visible in a funny way: ${flaw}. Composition: bust portrait, head and shoulders fill the frame, face in the upper half, centered, strong readable silhouette with a bright magenta-cyan rim light, against a plain flat solid deep-indigo background with a few halftone streaks; the face must read clearly as a tiny circular avatar. ${NEGATIVE}`;
}

// Optional: shrink to 512x768 with sharp (ships with Next) so phones load the picker fast.
let sharp = null;
try {
  sharp = createRequire(path.join(GAME, "package.json"))("sharp");
} catch {}

const heroes = JSON.parse(fs.readFileSync(path.join(GAME, "src/data/quickstart_heroes.json"), "utf8"));
const jobs = heroes.map((q) => ({
  id: q.id,
  file: path.join(GAME, "public", "heroes", `${q.id}.webp`),
  prompt: portraitPrompt(q.hero.visual, q.hero.flaw, q.hero.ability.text),
}));

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
      size: "1024x1536",
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
  let buf = Buffer.from(b64, "base64");
  if (sharp) buf = await sharp(buf).resize(512, 768, { fit: "cover" }).webp({ quality: 84 }).toBuffer();
  fs.mkdirSync(path.dirname(job.file), { recursive: true });
  fs.writeFileSync(job.file, buf);
}

const t0 = Date.now();
const todo = jobs.filter((j) => !fs.existsSync(j.file));
console.log(`${jobs.length - todo.length} exist, ${todo.length} to generate${sharp ? " (resizing with sharp)" : ""}`);

let next = 0;
async function worker() {
  while (next < todo.length) {
    const job = todo[next++];
    const s = Date.now();
    try {
      await generate(job);
      console.log(`ok   ${job.id} (${((Date.now() - s) / 1000).toFixed(1)}s)`);
    } catch (e) {
      console.error(`FAIL ${job.id}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
console.log(`done: ${requests} requests, ${((Date.now() - t0) / 1000).toFixed(1)}s total`);
