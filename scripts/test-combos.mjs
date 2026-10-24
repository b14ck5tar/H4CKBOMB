#!/usr/bin/env node
// test-combos.mjs: random party/story combos for "Real In, Magic Out" (design/18), judged by a human.
//
// Usage (dev server must be running; Node 20+, no dependencies):
//   node scripts/test-combos.mjs                       # 24 combos against http://localhost:3000, all ratings
//   node scripts/test-combos.mjs --n 6 --seed 42 --rating kids --out combos.md --base http://localhost:3014
// Flags: --n <count> (default 24) · --seed <int> (same seed = same parties) · --rating kids|teens|adults
//        --out <file.md> (also write the report) · --base <url> · --delay <ms between calls, default 600>
//
// What it does, per combo: builds a party of 2-5 players from real-sounding answers (some skipped), then calls
// POST /api/ai `character` for each player, gathers candidates (seed quests allowed for the rating + GET
// /api/news?rating=..., fetched once per rating), then `pick_quest`. It prints what came back
// and flags contract breaks loudly ("!! FAIL"), plus heuristic warnings ("?? CHECK") for a human to look at.
// Calls run one at a time with a pause, so it never hammers Muse. It never calls SerpApi (only /api/news, cached).
// Tasks that don't exist yet on the server (400 "unknown task") are reported as NOT AVAILABLE, not as crashes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------- args ----------
function parseArgs(argv) {
  const a = { n: 24, seed: null, rating: null, out: null, base: "http://localhost:3000", delay: 600 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--help" || k === "-h") a.help = true;
    else if (k === "--n") (a.n = parseInt(v, 10)), i++;
    else if (k === "--seed") (a.seed = parseInt(v, 10)), i++;
    else if (k === "--rating") (a.rating = v), i++;
    else if (k === "--out") (a.out = v), i++;
    else if (k === "--base") (a.base = v.replace(/\/+$/, "")), i++;
    else if (k === "--delay") (a.delay = parseInt(v, 10)), i++;
    else throw new Error(`unknown flag ${k} (try --help)`);
  }
  if (!Number.isFinite(a.n) || a.n < 1) throw new Error("--n must be a positive integer");
  if (a.seed !== null && !Number.isFinite(a.seed)) throw new Error("--seed must be an integer");
  if (a.rating && !["kids", "teens", "adults"].includes(a.rating)) throw new Error("--rating must be kids, teens or adults");
  if (!Number.isFinite(a.delay) || a.delay < 0) a.delay = 600;
  return a;
}

// ---------- seeded RNG (mulberry32) ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOne = (r, arr) => arr[Math.floor(r() * arr.length)];
function shuffle(r, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- rating rule (same as questAllowed in game/src/lib/rating.ts) ----------
const RANK = { kids: 0, teens: 1, adults: 2 };
const questAllowed = (questRating, group) => RANK[questRating ?? "teens"] <= RANK[group];

// ---------- answer pools ----------
const NAMES = ["Ava", "Ben", "Mira", "Jay", "Sam", "Priya", "Leo", "Noor", "Kai", "Rosa", "Theo", "Lin", "Omar", "Zoe", "Dev", "Ines"];
const SKILLS = [
  "parallel parking", "remembering birthdays", "making playlists", "fixing bikes", "folding fitted sheets",
  "finding four-leaf clovers", "guessing the price of groceries", "doing voices", "packing a suitcase",
  "making coffee", "untangling necklaces", "spotting typos", "whistling", "falling asleep anywhere",
  "keeping plants alive", "reading maps", "skipping stones", "remembering every birthday in my family",
  "Mario Kart", "finding lost things", "braiding hair", "baking without a recipe", "idk, napping?",
];
const FEARS = [
  "pigeons", "the dark", "voicemails", "geese", "deep water", "balloons popping", "clowns", "spiders",
  "being late", "elevators", "talking on the phone", "moths", "when the microwave beeps", "escalators",
  "silence after I tell a joke", "ducks staring at me",
];
const CONCEPTS = ["a retired knight afraid of geese", "a sleepy vampire barista", "a ghost who's bad at haunting", "a raccoon with a law degree"];

/** One player's two answers. Each is skipped ~25% of the time; a player who skips both gives a one-line concept. */
function makePlayer(r, name, id) {
  const ans = (pool) => (r() < 0.25 ? "" : pickOne(r, pool));
  const skill = ans(SKILLS);
  const fear = ans(FEARS);
  const concept = !skill && !fear ? pickOne(r, CONCEPTS) : ""; // the old one-line path
  // `talk` stays "" for type compatibility: the third question was dropped with side quests.
  return { id, name, real: { skill, fear, talk: "" }, concept };
}

function makeCombos(r, n, onlyRating) {
  const ratings = ["kids", "teens", "adults"];
  const offset = Math.floor(r() * 3);
  const combos = [];
  for (let i = 0; i < n; i++) {
    const rating = onlyRating ?? ratings[(i + offset) % 3];
    const size = 2 + Math.floor(r() * 4); // 2-5
    const names = shuffle(r, NAMES).slice(0, size);
    const players = [];
    for (let j = 0; j < size; j++) players.push(makePlayer(r, names[j], `p${j + 1}`));
    combos.push({ index: i + 1, rating, players });
  }
  return combos;
}

// ---------- HTTP ----------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
let DELAY = 600;
let museCalls = 0;

/** POST /api/ai. Returns { status: "ok" | "fallback" | "unavailable" | "error", data, note }. */
async function ai(base, task, input) {
  await sleep(DELAY);
  museCalls++;
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, input }),
      signal: AbortSignal.timeout(75_000),
    });
    const ms = Date.now() - t0;
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    if (res.status === 400 && /unknown task/i.test(String(body?.error ?? ""))) {
      museCalls--; // the server refused before calling Muse
      return { status: "unavailable", data: null, note: `400 unknown task "${task}" (not on this branch yet)`, ms };
    }
    if (!res.ok) return { status: "error", data: null, note: `HTTP ${res.status}${body?.error ? `: ${body.error}` : ""}`, ms };
    if (!body || !("data" in body)) return { status: "error", data: null, note: "response has no `data`", ms };
    return { status: body.fallback ? "fallback" : "ok", data: body.data, note: "", ms };
  } catch (e) {
    return { status: "error", data: null, note: `request failed: ${e.message}`, ms: Date.now() - t0 };
  }
}

const newsCache = {};
async function news(base, rating) {
  if (newsCache[rating]) return newsCache[rating];
  await sleep(DELAY);
  let out;
  try {
    const res = await fetch(`${base}/api/news?rating=${rating}`, { signal: AbortSignal.timeout(130_000) });
    const body = await res.json();
    out = { ok: res.ok, quests: Array.isArray(body?.quests) ? body.quests : [], note: res.ok ? "" : `HTTP ${res.status}` };
  } catch (e) {
    out = { ok: false, quests: [], note: `request failed: ${e.message}` };
  }
  newsCache[rating] = out;
  return out;
}

// ---------- candidates ----------
function toCandidate(q) {
  return {
    id: q.id,
    title: q.quest_title,
    premise: q.fairytale_premise,
    threat: q.the_threat?.name ? `${q.the_threat.name}: ${q.the_threat.description ?? ""}` : String(q.the_threat ?? ""),
    goal: q.the_goal?.description ?? String(q.the_goal ?? ""),
    locations: (q.locations ?? []).map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean),
  };
}

// ---------- checks ----------
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
const DARE = /\b(you (must|have to|need to|should|will have to)|in real life|irl|for real|dares?|the player (must|has to|should)|(go|actually) (and )?(touch|pet|hold|call|phone|answer|face|eat|sing|speak|stand|ride|jump))\b/i;

function checkCombo(c) {
  const fails = []; // contract breaks
  const checks = []; // heuristics for a human
  const byId = Object.fromEntries(c.players.map((p) => [p.id, p]));

  // Heroes
  for (const p of c.players) {
    const h = p.hero?.data;
    if (!h) continue;
    for (const [label, txt] of [["flaw", h.flaw], ["ability", h.ability?.text]]) {
      if (DARE.test(String(txt ?? ""))) fails.push(`${p.name}'s ${label} reads like a real-life dare: "${txt}"`);
    }
  }

  // Quest pick
  const pick = c.pick?.data;
  if (c.pick?.status === "ok" || c.pick?.status === "fallback") {
    const ids = new Set(c.candidates.map((q) => q.id));
    if (!pick || !ids.has(pick.quest_id)) fails.push(`pick_quest id "${pick?.quest_id}" is not one of the ${ids.size} candidates`);
    const picked = c.allKnown[pick?.quest_id];
    if (picked && !questAllowed(picked.rating, c.rating)) fails.push(`${c.rating} group got "${pick.quest_id}", rated ${picked.rating ?? "teens (missing)"}`);
    const counts = {};
    for (const s of pick?.spotlights ?? []) {
      counts[s.hero_id] = (counts[s.hero_id] ?? 0) + 1;
      if (!byId[s.hero_id]) fails.push(`spotlight for unknown hero_id "${s.hero_id}"`);
      if (![0, 1, 2].includes(s.scene)) fails.push(`spotlight scene ${JSON.stringify(s.scene)} is not 0-2`);
      const fear = byId[s.hero_id]?.real.fear;
      if (fear && norm(s.how).includes(norm(fear))) checks.push(`${byId[s.hero_id].name}'s spotlight mentions their fear ("${fear}"); spotlights should use the skill`);
    }
    for (const p of c.players) {
      if (!counts[p.id]) fails.push(`${p.name} (${p.id}) has no spotlight`);
      else if (counts[p.id] > 1) fails.push(`${p.name} (${p.id}) is spotlighted ${counts[p.id]} times`);
    }
  }

  return { fails, checks };
}

// ---------- report ----------
const label = (r) => (r?.status === "ok" ? "AI" : r?.status === "fallback" ? "FALLBACK" : r?.status === "unavailable" ? "NOT AVAILABLE" : r ? "ERROR" : "skipped");
const q = (s) => (s ? `"${s}"` : "(skipped)");
const SCENES = ["hook", "twist", "climax"];

function comboReport(c) {
  const L = [];
  L.push(`## Combo ${c.index} · ${c.rating} · ${c.players.length} players`, "");
  L.push("**Party (real answers)**");
  for (const p of c.players) L.push(`- ${p.name} (${p.id}): good at ${q(p.real.skill)} · scared of ${q(p.real.fear)}${p.concept ? ` · concept "${p.concept}"` : ""}`);
  L.push("", "**Heroes** (`character`)");
  for (const p of c.players) {
    const r = p.hero;
    if (r?.data) L.push(`- [${label(r)}] ${p.name} → ${r.data.name} ${r.data.epithet ?? ""}: ability "${r.data.ability?.name}: ${r.data.ability?.text}" · flaw "${r.data.flaw}"`);
    else L.push(`- [${label(r)}] ${p.name}: ${r?.note || "no hero"}`);
  }
  L.push("", `**Candidates** (${c.candidates.length}): ${c.candidates.map((x) => x.id).join(", ") || "none"}`);
  if (c.newsNote) L.push(`- news: ${c.newsNote}`);
  L.push("", `**Quest pick** (\`pick_quest\`) [${label(c.pick)}]${c.pick?.note ? ` ${c.pick.note}` : ""}`);
  if (c.pick?.data) {
    const t = c.candidates.find((x) => x.id === c.pick.data.quest_id)?.title ?? c.allKnown[c.pick.data.quest_id]?.quest_title ?? "?";
    L.push(`- ${c.pick.data.quest_id} "${t}"`, `- why: ${c.pick.data.why}`);
    for (const s of c.pick.data.spotlights ?? []) {
      const p = c.players.find((x) => x.id === s.hero_id);
      L.push(`- spotlight: scene ${s.scene} (${SCENES[s.scene] ?? "?"}) ${p?.name ?? s.hero_id} [${p?.real.skill || "no skill"}]: ${s.how}`);
    }
  }
  L.push("");
  const { fails, checks } = c.result;
  if (!fails.length && !checks.length) L.push("Checks: all passed");
  for (const f of fails) L.push(`!! FAIL: ${f}`);
  for (const k of checks) L.push(`?? CHECK: ${k}`);
  L.push("");
  return L;
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    const src = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split(/\r?\n/).slice(1);
    const top = src.slice(0, src.findIndex((l) => !l.startsWith("//")));
    console.log(top.map((l) => l.slice(3)).join("\n"));
    return;
  }
  DELAY = args.delay;
  const seed = args.seed ?? (Date.now() % 1_000_000);
  const r = rng(seed);
  const combos = makeCombos(r, args.n, args.rating);
  const seeds = JSON.parse(fs.readFileSync(path.join(ROOT, "game", "src", "data", "seed_quests.json"), "utf8"));

  const playerCount = combos.reduce((a, c) => a + c.players.length, 0);
  const est = playerCount + combos.length;
  const head = [
    "# Real In, Magic Out: combo test",
    "",
    `- server: ${args.base} · combos: ${combos.length} · seed: ${seed} (rerun with \`--seed ${seed}\`) · rating: ${args.rating ?? "all three"}`,
    `- cost: about ${est} Muse calls (${playerCount} characters + ${combos.length} quest picks), one at a time, ${DELAY} ms apart.`,
    "  Plus up to 3 `/api/news` calls (cached 4 h; a cold cache runs the news classifier). SerpApi is never called directly.",
    "- `!! FAIL` = breaks the design/18 contract. `?? CHECK` = heuristic, a human should look. Judge the rest by eye: does each fit feel natural or forced?",
    "",
  ];
  console.log(head.join("\n"));

  // Is the server up? (Any HTTP answer counts; a cold dev server compiles the route first, so be patient.)
  try {
    await fetch(`${args.base}/api/ai`, { method: "GET", signal: AbortSignal.timeout(90_000) });
  } catch (e) {
    console.error(`Dev server not reachable at ${args.base} (${e.message}). Start it first, e.g. npm --prefix game run dev -- -p 3000`);
    process.exit(1);
  }

  const lines = [...head];
  const tally = {};
  const bump = (task, s) => ((tally[task] ??= { AI: 0, FALLBACK: 0, "NOT AVAILABLE": 0, ERROR: 0, skipped: 0 })[s]++);
  const unavailable = new Set();

  for (const c of combos) {
    // Characters
    for (const p of c.players) {
      const others = c.players.filter((o) => o.hero?.data);
      if (unavailable.has("character")) p.hero = { status: "unavailable", data: null, note: "skipped (task not available)" };
      else
        p.hero = await ai(args.base, "character", {
          real: p.real,
          concept: p.concept,
          rating: c.rating,
          partySoFar: others.map((o) => o.hero.data.visual?.anchor ?? ""),
          avoidNames: others.map((o) => o.hero.data.name),
        });
      if (p.hero.status === "unavailable") unavailable.add("character");
      bump("character", label(p.hero));
    }

    // Candidates: allowed seeds + this rating's news, shuffled (so position bias shows), capped at 10.
    const n = await news(args.base, c.rating);
    const newsQuests = n.quests;
    const disallowedNews = newsQuests.filter((x) => !questAllowed(x.rating, c.rating));
    const untagged = newsQuests.filter((x) => !x.rating).length;
    c.allKnown = Object.fromEntries([...seeds, ...newsQuests].map((x) => [x.id, x]));
    const pool = [...seeds, ...newsQuests].filter((x) => questAllowed(x.rating, c.rating));
    c.candidates = shuffle(r, pool).slice(0, 10).map(toCandidate);
    c.newsNote = [
      n.note && `/api/news failed (${n.note})`,
      `${newsQuests.length} news quest(s) for ${c.rating}`,
      untagged && `${untagged} without a rating tag (treated as teens)`,
      seeds.some((x) => !x.rating) && `${seeds.filter((x) => !x.rating).length}/${seeds.length} seed quests have no rating (treated as teens)`,
    ].filter(Boolean).join("; ");

    const party = c.players.map((p) => ({
      hero_id: p.id,
      name: p.name,
      hero_name: p.hero?.data?.name ?? p.name,
      skill: p.real.skill,
      fear: p.real.fear,
    }));

    // Pick
    if (!c.candidates.length) c.pick = { status: "error", data: null, note: `no candidate quests allowed for ${c.rating}` };
    else if (unavailable.has("pick_quest")) c.pick = { status: "unavailable", data: null, note: "(task not available, skipped)" };
    else c.pick = await ai(args.base, "pick_quest", { rating: c.rating, party, candidates: c.candidates });
    if (c.pick.status === "unavailable") unavailable.add("pick_quest");
    bump("pick_quest", label(c.pick));

    c.result = checkCombo(c);
    if (disallowedNews.length) c.result.fails.push(`/api/news?rating=${c.rating} returned ${disallowedNews.length} quest(s) not allowed for ${c.rating}: ${disallowedNews.map((x) => x.id).join(", ")}`);
    if (!c.candidates.length) c.result.fails.push(`no candidate quests for ${c.rating} (seed quests need a \`rating\`, or /api/news returned none)`);

    const block = comboReport(c);
    console.log(block.join("\n"));
    lines.push(...block);
  }

  // Summary
  const S = ["# Summary", "", "| task | AI | fallback | not available | error | skipped |", "|---|---|---|---|---|---|"];
  for (const [task, t] of Object.entries(tally)) S.push(`| ${task} | ${t.AI} | ${t.FALLBACK} | ${t["NOT AVAILABLE"]} | ${t.ERROR} | ${t.skipped} |`);
  S.push("");
  if (unavailable.size) S.push(`Not available on this server: ${[...unavailable].join(", ")} (400 unknown task). Those checks did not run; rerun once the task ships.`, "");
  const failing = combos.filter((c) => c.result.fails.length);
  const checking = combos.filter((c) => c.result.checks.length);
  S.push(`!! FAIL in ${failing.length}/${combos.length} combos${failing.length ? `: ${failing.map((c) => `#${c.index} (${c.result.fails.length})`).join(", ")}` : ""}`);
  S.push(`?? CHECK in ${checking.length}/${combos.length} combos${checking.length ? `: ${checking.map((c) => `#${c.index}`).join(", ")}` : ""}`);
  const allFallback = Object.values(tally).every((t) => t.AI === 0);
  if (allFallback) S.push("", "Every response was a fallback or unavailable (no Muse key, or Muse down). Fallbacks were still checked against the contract, but fit can't be judged.");
  S.push("", `AI requests sent: ${museCalls} (each one reaches Muse only when the server has a key).`);
  console.log(S.join("\n"));
  lines.push(...S);

  if (args.out) {
    fs.writeFileSync(path.resolve(process.cwd(), args.out), lines.join("\n") + "\n", "utf8");
    console.log(`\nReport written to ${path.resolve(process.cwd(), args.out)}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
