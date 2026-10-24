// Live test for /api/scene-art (paints ready-made heroes into pre-painted quest scenes). Costs real money:
// every uncached case is ONE muse-image call (~$0.01). Hard budget: 6 image calls total, tracked in a ledger file
// in the output dir across runs (override with ART_BUDGET=n only if the team says so).
//
// 1. Start a dev server on a spare port with its own build folder (never 3000/3080):
//      cd game && NEXT_DIST_DIR=.next-art npx next dev -p 3085
// 2. node scripts/art-test.mjs [boulder] [otter] [poster]      (default: all three + cache/de-dupe checks)
//    env: ART_BASE (default http://localhost:3085), ART_OUT (default <os tmp>/art-test)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.ART_BASE || "http://localhost:3085";
const OUT = process.env.ART_OUT || path.join(os.tmpdir(), "art-test");
const BUDGET = Number(process.env.ART_BUDGET || 6);
fs.mkdirSync(OUT, { recursive: true });

const LEDGER = path.join(OUT, "art-test-ledger.json");
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : { calls: 0, runs: [] };
const saveLedger = () => fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));

const quick = JSON.parse(fs.readFileSync(path.join(ROOT, "game/src/data/quickstart_heroes.json"), "utf8"));
const hero = (id) => {
  const q = quick.find((h) => h.id === id);
  if (!q) throw new Error(`no ready-made hero ${id}`);
  return { id, name: q.hero.name, portraitUrl: `/heroes/${id}.webp`, visual: q.hero.visual };
};

const CASES = {
  boulder: { questId: "hanging-boulder", sceneIndex: 0, heroes: ["raccoon", "grandma", "barista"].map(hero), rating: "teens" },
  otter: { questId: "returned-otter", sceneIndex: "quick", heroes: ["crossing-guard", "influencer"].map(hero), rating: "teens" },
  poster: { mode: "poster", questId: "returned-otter", heroes: ["crossing-guard", "influencer", "substitute"].map(hero), title: "The Creek That Followed", rating: "teens" },
};

async function stats() {
  const r = await fetch(`${BASE}/api/scene-art`);
  if (!r.ok) throw new Error(`stats HTTP ${r.status} (is the dev server on ${BASE}?)`);
  return r.json();
}

async function post(body) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/scene-art`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  return { ...j, wallMs: Date.now() - t0, status: r.status };
}

function save(name, res) {
  if (!res.url?.startsWith("data:")) return null;
  const file = path.join(OUT, `${name}_${res.key}.webp`);
  fs.writeFileSync(file, Buffer.from(res.url.split(",")[1], "base64"));
  return file;
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES);
const before = await stats();
const run = { at: new Date().toISOString(), results: [] };

for (const name of wanted) {
  const body = CASES[name];
  if (!body) throw new Error(`unknown case ${name}`);
  if (ledger.calls >= BUDGET) {
    console.log(`BUDGET: ${ledger.calls}/${BUDGET} image calls already used. Skipping ${name}.`);
    continue;
  }
  const s0 = await stats();
  // Fire the same request twice at once: the server must make ONE upstream call (in-flight de-dupe).
  const [a, b] = await Promise.all([post(body), post(body)]);
  const s1 = await stats();
  const newCalls = s1.calls - s0.calls;
  ledger.calls += newCalls;
  saveLedger();
  const file = save(name, a);
  // Repeat: must be a cache hit and fast.
  const c = await post(body);
  const line = {
    case: name,
    upstreamCalls: newCalls,
    ms: a.ms,
    fallback: !!a.fallback,
    error: a.error,
    dedupe: b.cached === true || newCalls <= 1,
    repeatCached: c.cached,
    repeatMs: c.ms,
    file,
  };
  run.results.push(line);
  console.log(JSON.stringify(line));
}

const after = await stats();
run.calls = after.calls - before.calls;
ledger.runs.push(run);
saveLedger();
console.log(`\nThis run: ${run.calls} image call(s). Ledger total: ${ledger.calls}/${BUDGET}. Outputs in ${OUT}`);
console.log(`Server stats: ${JSON.stringify(after)}`);
