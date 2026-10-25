// Procedural engine test (design/35): 3 simulated Quick Tales through the real /api/ai "turn" and "story_end" tasks,
// with scripted plans (sensible ones and creative tangents like "challenge it to chess") and fixed grades. Checks that
// every outcome follows the chosen plan (the plan's own key word is in it), names the hero, credits the friend only on
// a success, never repeats a Right now, stays inside 2 sentences / 30 words, and that progress reaches the finale.
//
//   set NEXT_DIST_DIR=.next-lab&& npm --prefix game run dev -- -p 3107
//   node scripts/procedural-test.mjs [--only bison]      (env LAB_BASE, default http://localhost:3107)
// ~4 text calls per game (3 turns + the ending), plus at most one retry per turn. No keys are read here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateFromOpener, usesPlan, sentences } from "../game/src/lib/procedural.ts";

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
};
const DEPTH = { DISASTER: 1, SETBACK: 0.5, PARTIAL: 0.5, PROGRESS: 0.5, GREAT: 0.5, LEGENDARY: 1 };

const GAMES = [
  {
    key: "bison",
    id: "news-7f3160a2ba",
    turns: [
      { hero: "Gus", plan: "challenge the bison mom to a game of chess", attempt: "Gus challenges the bison mom to a game of chess", grade: "GREAT" },
      { hero: "Bev", plan: "freeze time and put a tiny sweater on the dog so she looks like a calf", attempt: "Bev freezes time and puts a tiny sweater on the dog", grade: "SETBACK", idea_from: "Juno" },
      { hero: "Juno", plan: "listen to the lodge phone line to find the family's cabin", attempt: "Juno listens to the lodge phone line for the family's cabin", grade: "PROGRESS", idea_from: "Gus" },
    ],
    finale: { hero: "Gus", plan: "lead a parade of everyone back to the cabin with snacks", attempt: "Gus leads a snack parade back to the cabin", grade: "GREAT", won: true },
  },
  {
    key: "crab",
    id: "billion-pearls",
    turns: [
      { hero: "Juno", plan: "ask the crab nicely to empty its pockets", attempt: "Juno asks the crab to empty its pockets", grade: "PARTIAL" },
      { hero: "Bev", plan: "start a beach volleyball game to distract everyone", attempt: "Bev starts a beach volleyball game", grade: "DISASTER" },
      { hero: "Gus", plan: "find an old fishing net in the trash and scoop the beads", attempt: "Gus finds an old fishing net and scoops the beads", grade: "LEGENDARY", idea_from: "Bev" },
    ],
    finale: { hero: "Juno", plan: "give the crab a job as the beach cleaner", attempt: "Juno gives the crab a job cleaning the beach", grade: "PARTIAL", won: false },
  },
  {
    key: "bridge",
    id: "rust-wyrm",
    turns: [
      { hero: "Bev", plan: "sing the bridge a lullaby lol", attempt: "Bev sings to the bridge", grade: "PROGRESS" },
      { hero: "Gus", plan: "hire the turtle as the official bridge inspector", attempt: "Gus offers the turtle a job as bridge inspector", grade: "GREAT", idea_from: "Juno" },
      { hero: "Juno", plan: "tape the wobbly railing with duct tape", attempt: "Juno tapes the wobbly railing", grade: "SETBACK" },
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
for (const g of GAMES.filter((x) => !ONLY || x.key === ONLY)) {
  const o = opener(g.id);
  if (!o) {
    console.log(`no stored opener for ${g.id}`);
    continue;
  }
  const party = Object.entries(HEROES).map(([name, h]) => ({ name, pronouns: h.pronouns }));
  let state = stateFromOpener(o, party, g.turns.length);
  console.log(`\n=== ${o.quest_title} (${g.id}) ===\n${o.narration}\nFinish line: ${state.finish_line} | Right now: ${state.right_now}`);
  for (let k = 0; k < g.turns.length; k++) {
    const t = g.turns[k];
    const next = g.turns[k + 1]?.hero ?? "";
    const won = ["PROGRESS", "GREAT", "LEGENDARY"].includes(t.grade);
    const r = await ai("turn", { state, hero: { name: t.hero, ...HEROES[t.hero] }, plan: t.plan, attempt: t.attempt, idea_from: t.idea_from ?? "", grade: t.grade, depth: DEPTH[t.grade], next_player: next, turns_left: g.turns.length - k - 1 });
    const d = r.data;
    const prevRight = state.right_now;
    state = d.state;
    console.log(`\nT${k + 1} ${t.hero} "${t.plan}" ${t.grade}${t.idea_from ? ` (${t.idea_from}'s idea)` : ""} ${r.ms} ms${d.fallback ? " FALLBACK" : ""}${d.problems?.length ? ` [${d.problems.join(" | ")}]` : ""}`);
    console.log(`  ${d.outcome}\n  ${d.scene}\n  Right now: ${d.right_now} | progress ${state.progress} (+${d.progress_delta}: ${d.progress_why}) | act ${d.act}${d.act_changed ? " (new act)" : ""}${d.finale ? " -> FINALE" : ""}`);
    const words = d.outcome.trim().split(/\s+/).length;
    if (!usesPlan(d.outcome, t.plan)) issues.push(`${g.key} T${k + 1}: outcome does not use the plan`);
    if (!d.outcome.includes(t.hero)) issues.push(`${g.key} T${k + 1}: hero not named`);
    if (t.idea_from && won && !`${d.outcome} ${d.scene}`.includes(t.idea_from)) issues.push(`${g.key} T${k + 1}: friend not credited`);
    if (t.idea_from && !won && d.outcome.includes(t.idea_from)) issues.push(`${g.key} T${k + 1}: friend named on a miss`);
    if (sentences(d.outcome).length > 2 || words > 32) issues.push(`${g.key} T${k + 1}: too long (${words} words)`);
    if (d.right_now.toLowerCase() === prevRight.toLowerCase()) issues.push(`${g.key} T${k + 1}: Right now repeated`);
    if (next && !d.scene.includes(next)) issues.push(`${g.key} T${k + 1}: no hand-off to ${next}`);
    if (d.fallback) issues.push(`${g.key} T${k + 1}: fallback`);
  }
  const f = g.finale;
  const e = await ai("story_end", { state, winner: { name: f.hero, pronouns: HEROES[f.hero].pronouns }, attempt: f.attempt, plan: f.plan, grade: f.grade, won: f.won, players: [] });
  console.log(`\nFINALE ${f.hero} "${f.plan}" ${f.grade} (won ${f.won}) ${e.ms} ms${e.fallback ? " FALLBACK" : ""}\n  ${e.data.ending}\n  "${e.data.line}"\n  Recap: ${e.data.recap}`);
  for (const h of Object.keys(HEROES)) if (!e.data.recap.includes(h)) issues.push(`${g.key} ending: recap misses ${h}`);
  if (state.act < 3) issues.push(`${g.key}: only reached act ${state.act} before the finale`);
}
console.log(`\n${issues.length ? `ISSUES (${issues.length}):\n- ${issues.join("\n- ")}` : "No issues."}`);
