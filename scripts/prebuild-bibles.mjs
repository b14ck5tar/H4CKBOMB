// Pre-build a story bible for every story in game/src/data/story_library.json (design/30 "Stored bibles"), so the
// judge demo never waits on bible generation. Muse can be slow at night: run this ahead of time.
//
// 1. Start a dev server (it writes the files; Vercel's disk is read-only):
//      set NEXT_DIST_DIR=.next-lab&& npm --prefix game run dev -- -p 3107
// 2. node scripts/prebuild-bibles.mjs [--turns 4] [--rating teens] [--only <story id>] [--engine wonder+spark]
//    env: LAB_BASE (default http://localhost:3107), BIBLE_BUDGET (default 45 text calls)
//
// For each story: use the library's stored opener (same rating) if it has one, else write one (POST /api/story/opener
// with no party, which the pipeline also stores in the library), then POST /api/ai story_bible with store: true.
// The server saves the bible in game/src/data/story_bibles.json, keyed by story id + opener fingerprint + rating +
// turns. A bible with 4 acts also serves 2- and 3-turn games (fitBible drops acts evenly). Skips stories that
// already have one. No keys are read here, and SerpApi is never called.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.LAB_BASE || "http://localhost:3107";
const BUDGET = Number(process.env.BIBLE_BUDGET || 45);
const argv = process.argv.slice(2);
const flag = (name, dflt = "") => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? dflt : argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
};
const TURNS = Number(flag("turns", "4"));
const RATING = flag("rating", "teens");
const ONLY = flag("only", "");
const ENGINE = flag("engine", "");
let spent = 0;
const spend = (n, what) => {
  if (spent + n > BUDGET) throw new Error(`budget reached (${spent}/${BUDGET}) before ${what}`);
  spent += n;
};

async function post(route, body) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 400_000);
  try {
    const res = await fetch(`${BASE}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`${route} HTTP ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

const lib = JSON.parse(fs.readFileSync(path.join(ROOT, "game", "src", "data", "story_library.json"), "utf8")).stories;
const storedPath = path.join(ROOT, "game", "src", "data", "story_bibles.json");
// The dev server may be mid-write: an unreadable file just means "check again later".
const have = () => {
  try {
    return JSON.parse(fs.readFileSync(storedPath, "utf8")).bibles ?? [];
  } catch {
    return [];
  }
};

async function one(s) {
  if (have().some((b) => b.story_id === s.id && b.rating === RATING && b.turns >= TURNS && b.opener)) return console.log(`[prebuild] ${s.id}: already stored`);
  // Always a fresh opener: the library's opener is overwritten by every game, so the pack stores its own copy.
  let opener = null;
  let facts = null;
  if (!opener) {
    spend(3, `opener ${s.id}`);
    const j = await post("/api/story/opener", { mode: "news", rating: RATING, party: [], source: { headline: s.headline, snippet: s.snippet, source: s.source, url: s.url, date: s.date, place: s.place } });
    if (!j.opener || j.fallback) return console.log(`[prebuild] ${s.id}: no opener (fallback ${j.fallback}), skipped`);
    opener = j.opener;
    facts = j.ending_facts;
  }
  spend(2, `bible ${s.id}`);
  const t0 = Date.now();
  const r = await post("/api/ai", {
    task: "story_bible",
    input: { opener, real_event: opener.real_setting, ending_facts: facts, news: { headline: s.headline, snippet: s.snippet, source: s.source, place: s.place }, party: [], turns: TURNS, rating: RATING, cache_key: s.id, store: true, ...(ENGINE ? { engine: ENGINE } : {}), deadline_ms: 200_000 },
  });
  const m = r.data?.meta ?? {};
  console.log(`[prebuild] ${s.id}: ${r.data?.bible ? "stored" : "NO BIBLE"} in ${Math.round((Date.now() - t0) / 1000)} s (${m.model ?? "?"}, attempts ${m.attempts ?? "?"}, problems ${(m.problems ?? []).length}) "${opener.quest_title}"`);
}

const list = lib.filter((s) => !ONLY || s.id === ONLY);
// Two at a time: Muse is slow tonight, and a wide burst only queues.
for (let i = 0; i < list.length; i += 2) {
  await Promise.all(list.slice(i, i + 2).map((s) => one(s).catch((e) => console.error(`[prebuild] ${s.id} failed: ${e.message}`))));
}
console.log(`[prebuild] done, ~${spent} text calls. Stored: ${have().length} bibles in game/src/data/story_bibles.json`);
