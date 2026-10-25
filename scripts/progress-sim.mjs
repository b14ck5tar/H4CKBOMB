// Progress tuning (design/35 "Progress tuning"): Monte Carlo of whole games through lib/procedural.ts's real
// progress code (progressRange, paceProgress, applyTurn), with the game's real dice math (lib/grade.ts) and a
// realistic mix of plan difficulties. No AI calls. Prints, per table size, where the finale lands, how full the
// meter is at the finale, how big a GREAT feels, and a few per-turn traces.
//   node scripts/progress-sim.mjs [--games 20000]
import { applyTurn, progressRange, stateFromOpener } from "../game/src/lib/procedural.ts";

const argv = process.argv.slice(2);
const GAMES = Number(argv.includes("--games") ? argv[argv.indexOf("--games") + 1] : 20000);

// lib/grade.ts: d20 + stat + bonuses + tier shift; natural 1 = DISASTER, natural 20 = at least LEGENDARY.
const TIER_SHIFT = { clever: 3, solid: 0, risky: -3, wild: -5, miracle: -8 };
// What tables actually pick (from playtests): mostly sensible plans, some bold, a few long shots.
const TIER_MIX = [["clever", 0.25], ["solid", 0.4], ["risky", 0.17], ["wild", 0.13], ["miracle", 0.05]];
const pick = (mix) => { let r = Math.random(); for (const [k, w] of mix) { if ((r -= w) <= 0) return k; } return mix[mix.length - 1][0]; };
function grade(total, nat) {
  if (nat === 1) return "DISASTER";
  if (nat === 20) return "LEGENDARY";
  const t = Math.max(1, total);
  return t <= 1 ? "DISASTER" : t <= 5 ? "SETBACK" : t <= 9 ? "PARTIAL" : t <= 14 ? "PROGRESS" : t <= 19 ? "GREAT" : "LEGENDARY";
}
function rollGrade() {
  const die = 1 + Math.floor(Math.random() * 20);
  const stat = [0, 1, 2][Math.floor(Math.random() * 3)];
  const credit = Math.random() < 0.5 ? 1 : 0;
  return grade(die + stat + credit + TIER_SHIFT[pick(TIER_MIX)], die);
}
const WON = (g) => g === "PROGRESS" || g === "GREAT" || g === "LEGENDARY";

// Table sizes -> turns before the finale (design/35: 1 turn each at 4+ players, 2 each at 2-3, max 6;
// Quick Tale: 1 each).
const TABLES = [
  ["2 players, Full (4 turns)", 4],
  ["3 players, Full (6 turns)", 6],
  ["4 players, Full or Quick (4 turns)", 4],
  ["2 players, Quick (2 turns)", 2],
  ["3 players, Quick (3 turns)", 3],
];

const opener = { situation: "x", goal: "Bring the dog home", problem: { name: "The Worried Bison" }, narration: "a. b. c." };
const proposal = (lo, hi, solved) => ({ outcome: "x", scene: "", right_now: `step ${Math.random()}`, progress_gain: lo + Math.random() * (hi - lo), progress_why: "", new_fact: "", new_character: { name: "", role: "" }, where: "", open_thread: "", memorable: "", step_solved: solved });

for (const [label, T] of TABLES) {
  const ends = {}; let atFinale = 0; let lowFinale = 0; const greats = []; const traces = [];
  let stalledMid = 0;
  for (let n = 0; n < GAMES; n++) {
    let s = stateFromOpener(opener, [], T);
    const trace = [];
    let endTurn = T;
    for (let t = 1; t <= T; t++) {
      const g = rollGrade();
      const [lo, hi] = progressRange(g, T);
      // The AI says "this solved the step" on about a third of the successes.
      const r = applyTurn(s, proposal(lo, hi, WON(g) && Math.random() < 0.33), { hero: "H", attempt: "x", grade: g });
      if (g === "GREAT") greats.push(r.delta);
      s = r.state;
      trace.push(`${g.slice(0, 4)} ${r.delta >= 0 ? "+" : ""}${r.delta}=${s.progress}`);
      if (t === Math.ceil(T / 2) && s.progress < 25) stalledMid++;
      if (r.finale) { endTurn = t; break; }
    }
    ends[endTurn] = (ends[endTurn] ?? 0) + 1;
    atFinale += s.progress;
    if (s.progress < 80) lowFinale++;
    if (n < 4) traces.push(trace.join(" | "));
  }
  const pct = (x) => `${Math.round((100 * x) / GAMES)}%`;
  const [glo, ghi] = progressRange("GREAT", T);
  console.log(`\n${label}: par ${Math.round(100 / T)} per turn. Ranges: ${["LEGENDARY", "GREAT", "PROGRESS", "PARTIAL", "SETBACK", "DISASTER"].map((g) => `${g} ${progressRange(g, T).join("..")}`).join(", ")}`);
  console.log(`  finale after turn: ${Object.entries(ends).sort().map(([k, v]) => `${k}: ${pct(v)}`).join(", ")} (planned ${T})`);
  console.log(`  meter at the finale: avg ${Math.round(atFinale / GAMES)}, under 80: ${pct(lowFinale)}; under 25 at half time: ${pct(stalledMid)}`);
  console.log(`  a GREAT adds ${glo}..${ghi} (+${Math.round(greats.reduce((a, b) => a + b, 0) / Math.max(1, greats.length))} on average, step-solved jumps included)`);
  traces.forEach((t) => console.log(`  trace: ${t}`));
}
