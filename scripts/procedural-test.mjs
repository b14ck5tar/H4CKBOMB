// Procedural engine test (design/35): simulated games at 2, 3 and 4 players through the real /api/ai "turn" and
// "story_end" tasks (scripted plans incl. tangents like "challenge it to chess", fixed grades), plus a wild-plan and a
// power-abuse case through the real ruling ("verdict"). Checks that every outcome follows the chosen plan (the plan's
// own key word is in it), names the hero, credits the friend only on a success, never repeats a Right now, stays
// inside 2 sentences / 30 words, and prints the per-turn progress trace for each table size.
//
//   set NEXT_DIST_DIR=.next-lab&& npm --prefix game run dev -- -p 3107
//   node scripts/procedural-test.mjs [--only 2p|3p|4p|rulings]      (env LAB_BASE, default http://localhost:3107)
// About 1 text call per turn (+ at most one retry), 1 per ending, 2 rulings. No keys are read here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateFromOpener, usesPlan, sentences, longestStack } from "../game/src/lib/procedural.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.LAB_BASE || "http://localhost:3107";
const argv = process.argv.slice(2);
const ONLY = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : "";

const packs = JSON.parse(fs.readFileSync(path.join(ROOT, "game", "src", "data", "story_bibles.json"), "utf8")).bibles;
const opener = (id) => packs.find((b) => b.story_id === id && b.opener)?.opener;

const HEROES = {
  Juno: { power: "Press an ear to any wire and hear what it carries.", pronouns: "they/them" },
  Gus: { power: "Find anything anyone threw away nearby, in seconds.", pronouns: "he/him" },
  Bev: { power: "Raise your paddle and freeze time for three seconds.", pronouns: "she/her" },
  Mo: { power: "Talk any animal into one small favor.", pronouns: "he/him" },
};
const DEPTH = { DISASTER: 1, SETBACK: 0.5, PARTIAL: 0.5, PROGRESS: 0.5, GREAT: 0.5, LEGENDARY: 1 };

// 1 human = 2 turns (the builder's live Quick Tale), 2 players = 2 turns each (4), 3 players = 2 each (6),
// 4 players = 1 each (4)  (design/35 "Turns").
const GAMES = [
  {
    key: "1p-good", // two good rolls in a 2-turn game must be able to finish
    id: "galactic-signal",
    turns: [
      { hero: "Juno", plan: "listen to the radio dish wire to find where the signal comes from", attempt: "Juno listens to the radio dish wire for the signal", grade: "PROGRESS", tier: "clever" },
      { hero: "Juno", plan: "play the signal back to the sky turtle so it knows we heard it", attempt: "Juno plays the signal back to the sky turtle", grade: "GREAT", tier: "solid" },
    ],
    expectFinish: true,
    finale: { hero: "Juno", plan: "wave goodbye with the dish lights", attempt: "Juno waves goodbye with the dish lights", grade: "PROGRESS", won: true },
  },
  {
    key: "1p-meh", // a so-so 2-turn game still reaches the finale looking earned (>= 75 on a forward last turn)
    id: "hanging-boulder",
    turns: [
      { hero: "Mo", plan: "ask the turtle to scoot over a little", attempt: "Mo asks the turtle to scoot over a little", grade: "PARTIAL", tier: "solid" },
      { hero: "Mo", plan: "build a soft hay pile under the rock", attempt: "Mo builds a soft hay pile under the rock", grade: "PARTIAL", tier: "solid" },
    ],
    minEnd: 75,
    finale: { hero: "Mo", plan: "talk the turtle into lowering it slowly", attempt: "Mo talks the turtle into lowering the rock slowly", grade: "GREAT", won: true },
  },
  {
    key: "2p",
    id: "news-7f3160a2ba",
    turns: [
      { hero: "Gus", plan: "challenge the bison mom to a game of chess", attempt: "Gus challenges the bison mom to a game of chess", grade: "GREAT", tier: "wild" },
      { hero: "Bev", plan: "freeze time and put a tiny sweater on the dog so she looks like a calf", attempt: "Bev freezes time and puts a tiny sweater on the dog", grade: "SETBACK", idea_from: "Gus", tier: "risky" },
      { hero: "Gus", plan: "throw hay the other way so the bison walks off", attempt: "Gus throws hay away from the dog to lure the bison", grade: "PROGRESS", tier: "solid" },
      { hero: "Bev", plan: "call the dog by her name with a squeaky toy", attempt: "Bev calls the dog by name with a squeaky toy", grade: "PARTIAL", idea_from: "Gus", tier: "clever" },
    ],
    finale: { hero: "Gus", plan: "lead a parade of everyone back to the cabin with snacks", attempt: "Gus leads a snack parade back to the cabin", grade: "GREAT", won: true },
  },
  {
    key: "3p",
    id: "billion-pearls",
    turns: [
      { hero: "Juno", plan: "ask the crab nicely to empty its pockets", attempt: "Juno asks the crab to empty its pockets", grade: "PARTIAL", tier: "solid" },
      { hero: "Gus", plan: "find duct tape in the trash and patch the sack", attempt: "Gus finds duct tape in the trash and patches the sack", grade: "GREAT", idea_from: "Juno", tier: "clever" },
      { hero: "Bev", plan: "start a beach volleyball game to distract everyone", attempt: "Bev starts a beach volleyball game", grade: "DISASTER", tier: "wild" },
      { hero: "Juno", plan: "teach the crab to sweep with its claws", attempt: "Juno teaches the crab to sweep with its claws", grade: "PROGRESS", tier: "risky" },
      { hero: "Gus", plan: "scoop beads with an old fishing net", attempt: "Gus scoops beads with an old fishing net", grade: "LEGENDARY", idea_from: "Bev", tier: "solid" },
      { hero: "Bev", plan: "hold a sandcastle contest that uses the beads", attempt: "Bev holds a sandcastle contest with the beads", grade: "SETBACK", tier: "wild" },
    ],
    finale: { hero: "Juno", plan: "give the crab a job as the beach cleaner", attempt: "Juno gives the crab a job cleaning the beach", grade: "PARTIAL", won: false },
  },
  {
    key: "4p",
    id: "rust-wyrm",
    turns: [
      { hero: "Bev", plan: "sing the bridge a lullaby lol", attempt: "Bev sings the bridge a lullaby", grade: "PROGRESS", tier: "wild" },
      { hero: "Gus", plan: "hire the turtle as the official bridge inspector", attempt: "Gus offers the turtle a job as bridge inspector", grade: "GREAT", idea_from: "Juno", tier: "wild" },
      { hero: "Juno", plan: "tape the wobbly railing with duct tape", attempt: "Juno tapes the wobbly railing", grade: "SETBACK", tier: "risky" },
      { hero: "Mo", plan: "ask the turtle to hold his breath for one minute", attempt: "Mo asks the turtle to hold his breath for a minute", grade: "PARTIAL", idea_from: "Bev", tier: "clever" },
    ],
    finale: { hero: "Bev", plan: "freeze time and carry the inspector across", attempt: "Bev freezes time and carries the inspector across", grade: "LEGENDARY", won: true },
  },
];

async function ai(task, input) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/ai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, input: { rating: "teens", ...input } }) });
  const j = await r.json();
  return { ...j, ms: Date.now() - t0 };
}

const issues = [];
const lines = []; // every outcome line, for the "followable on first hearing" read
const latencies = [];
for (const g of GAMES.filter((x) => !ONLY || x.key === ONLY)) {
  const o = opener(g.id);
  if (!o) {
    console.log(`no stored opener for ${g.id}`);
    continue;
  }
  const names = [...new Set(g.turns.map((t) => t.hero))];
  const party = names.map((name) => ({ name, pronouns: HEROES[name].pronouns }));
  let state = stateFromOpener(o, party, g.turns.length);
  const trace = [];
  console.log(`\n=== ${g.key}: ${o.quest_title} (${g.turns.length} turns) ===\nFinish line: ${state.finish_line} | Right now: ${state.right_now}`);
  for (let k = 0; k < g.turns.length; k++) {
    const t = g.turns[k];
    const next = g.turns[k + 1]?.hero ?? "";
    const won = ["PROGRESS", "GREAT", "LEGENDARY"].includes(t.grade);
    const r = await ai("turn", { state, hero: { name: t.hero, ...HEROES[t.hero] }, plan: t.plan, attempt: t.attempt, idea_from: t.idea_from ?? "", grade: t.grade, tier: t.tier, depth: DEPTH[t.grade], next_player: next, turns_left: g.turns.length - k - 1 });
    const d = r.data;
    latencies.push(r.ms);
    const actBefore = state.act;
    const prevRight = state.right_now;
    state = d.state;
    trace.push(`${t.grade} ${d.progress_delta >= 0 ? "+" : ""}${d.progress_delta}=${d.progress}${d.finale ? " FINALE" : ""}`);
    lines.push({ where: `${g.key} T${k + 1}`, text: d.outcome });
    console.log(`\nT${k + 1} ${t.hero} "${t.plan}" ${t.grade} (${t.tier})${t.idea_from ? ` (${t.idea_from}'s idea)` : ""} ${r.ms} ms${d.fallback ? " FALLBACK" : ""}${d.problems?.length ? ` [${d.problems.join(" | ")}]` : ""}`);
    console.log(`  ${d.outcome}\n  ${d.scene}\n  Right now: ${d.right_now} | progress ${d.progress} (${d.progress_delta >= 0 ? "+" : ""}${d.progress_delta}: ${d.progress_why}) | act ${d.act}${d.finale ? " -> FINALE" : ""}`);
    const words = d.outcome.trim().split(/\s+/).length;
    if (!usesPlan(d.outcome, t.plan)) issues.push(`${g.key} T${k + 1}: outcome does not use the plan`);
    if (!d.outcome.includes(t.hero)) issues.push(`${g.key} T${k + 1}: hero not named`);
    if (t.idea_from && won && !`${d.outcome} ${d.scene}`.includes(t.idea_from)) issues.push(`${g.key} T${k + 1}: friend not credited`);
    if (t.idea_from && !won && d.outcome.includes(t.idea_from)) issues.push(`${g.key} T${k + 1}: friend named on a miss`);
    if (sentences(d.outcome).length > 2 || words > 32) issues.push(`${g.key} T${k + 1}: too long (${words} words)`);
    if (d.right_now.toLowerCase() === prevRight.toLowerCase() && !d.finale) issues.push(`${g.key} T${k + 1}: Right now repeated`);
    if (d.fallback) issues.push(`${g.key} T${k + 1}: fallback`);
    if (longestStack(d.right_now, true) >= 4) issues.push(`${g.key} T${k + 1}: Right now not plain ("${d.right_now}")`);
    if (actBefore >= 2) g.hookSeen = g.hookSeen || usesPlan(`${d.outcome} ${d.scene}`, state.hook);
    if (d.finale && k < g.turns.length - 2) issues.push(`${g.key}: finale too early (turn ${k + 1} of ${g.turns.length})`);
    if (d.finale) break;
  }
  const f = g.finale;
  const e = await ai("story_end", { state, winner: { name: f.hero, pronouns: HEROES[f.hero].pronouns }, attempt: f.attempt, plan: f.plan, grade: f.grade, won: f.won, players: [] });
  lines.push({ where: `${g.key} ending`, text: e.data.ending });
  console.log(`\nFINALE ${f.hero} "${f.plan}" ${f.grade} (won ${f.won}) ${e.ms} ms${e.fallback ? " FALLBACK" : ""}\n  ${e.data.ending}\n  "${e.data.line}"\n  Recap: ${e.data.recap}`);
  console.log(`\nPROGRESS TRACE ${g.key}: ${trace.join(" | ")}`);
  if (g.expectFinish && state.progress < 100) issues.push(`${g.key}: two good rolls did not finish (${state.progress})`);
  if (g.minEnd && state.progress < g.minEnd) issues.push(`${g.key}: finale at ${state.progress}, expected at least ${g.minEnd}`);
  if (g.turns.length >= 3 && g.hookSeen === false) issues.push(`${g.key}: the opener's hook never showed up after act 1`);
  if (g.turns.length >= 3 && g.hookSeen === undefined) issues.push(`${g.key}: the story never played a turn after act 1`);
  for (const h of names) if (!e.data.recap.includes(h)) issues.push(`${g.key} ending: recap misses ${h}`);
}

// Wild plans need big rolls; powers help at most one step (the real ruling).
if (!ONLY || ONLY === "rulings") {
  const o = opener("news-7f3160a2ba");
  const scene = { title: o.quest_title, goal: "Get the little dog away from the bison mom", final_goal: o.goal, situation: o.situation, who_is_there: o.npc_line?.speaker ?? "" };
  const cases = [
    { name: "wild plan", hero: "Mo", plan: "I teleport the bison home", expect: ["miracle"] },
    { name: "power abuse", hero: "Bev", plan: "freeze time forever and carry the dog, the bison and everyone home", expect: ["miracle", "wild"] },
    { name: "power, fair use", hero: "Gus", plan: "find a dog treat someone threw away and toss it to the dog", expect: ["solid", "clever"] },
  ];
  console.log("\n=== Rulings ===");
  for (const c of cases) {
    const h = HEROES[c.hero];
    const r = await ai("verdict", { scene, finale: false, hero: { name: c.hero, stats: { brave: 1, clever: 2, charming: 0 }, power: h.power, weakness: "" }, plan: c.plan, earlier: [], story_so_far: { problem: o.problem?.name } });
    const v = r.data;
    console.log(`${c.name}: "${c.plan}" -> ${v.tier} (${v.reason}) | ${v.interpretation}`);
    if (!c.expect.includes(v.tier)) issues.push(`ruling ${c.name}: ${v.tier}, expected ${c.expect.join(" or ")}`);
  }
}

const sorted = [...latencies].sort((a, b) => a - b);
const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
if (sorted.length) console.log(`\nTURN LATENCY (${sorted.length} calls, client side, incl. retries): p50 ${(q(0.5) / 1000).toFixed(1)} s, p90 ${(q(0.9) / 1000).toFixed(1)} s, max ${(sorted[sorted.length - 1] / 1000).toFixed(1)} s`);
console.log(`\nOUTCOME LINES (${lines.length}) for the followable read:\n${lines.map((l) => `- [${l.where}] ${l.text}`).join("\n")}`);
console.log(`\n${issues.length ? `ISSUES (${issues.length}):\n- ${issues.join("\n- ")}` : "No issues."}`);
