// Story evals: simulate 3 Quick Tales on 3 real news stories, then have muse-spark-1.3 (high) grade each game.
// It drives the real API routes (/api/story/opener, /api/ai) the way host.ts does, with scripted player plans and
// fixed dice, so two prompt versions can be compared on the same plans and the same rolls.
//
// 1. Start a dev server with its own build folder (Windows cmd):
//      set NEXT_DIST_DIR=.next-story2&& npm --prefix game run dev -- -p 3101
// 2. node scripts/story-evals.mjs [--label after] [--mode new|old] [--only pumpkin] [--no-grade]
//      --mode old  = the build before graded outcomes (pass/fail DC bands, goal kept on a miss)
//      --mode new  = graded outcomes (lib/grade.ts), real_event passed in, goal follows every roll
//    env: EVAL_BASE (default http://localhost:3101), EVAL_OUT (default <os tmp>/story-evals), EVAL_BUDGET (150)
//
// Cost: openers are cached in EVAL_OUT (1-2 Muse calls per story, once). Each game is ~8 Muse calls
// (4 rulings, 3 outcomes, 1 ending) + 1 grading call. A ledger in EVAL_OUT stops the run at EVAL_BUDGET calls.
// The news stories are fixed below (taken from the cached /api/news list): no SerpApi calls, ever.
// Keys: MODEL_API_KEY is read from .env.local for the grader only and never printed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.EVAL_BASE || "http://localhost:3101";
const OUT = process.env.EVAL_OUT || path.join(os.tmpdir(), "story-evals");
const BUDGET = Number(process.env.EVAL_BUDGET || 150);
fs.mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const flag = (name, dflt = "") => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? dflt : argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
};
const LABEL = flag("label", "run");
const MODE = flag("mode", "new");
const ONLY = flag("only", "");
const GRADE = !argv.includes("--no-grade");

// ---------------------------------------------------------------- budget ledger
const LEDGER = path.join(OUT, "ledger.json");
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : { calls: 0, runs: [] };
const spend = (n, what) => {
  if (ledger.calls + n > BUDGET) throw new Error(`Muse budget reached (${ledger.calls}/${BUDGET}) before ${what}`);
  ledger.calls += n;
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
};

// ---------------------------------------------------------------- the table
const STATS = (b, c, ch) => ({ brave: b, clever: c, charming: ch });
const HEROES = [
  { id: "p1", name: "Juno", power: "Press an ear to any wire and hear what it carries.", flaw: "Tells everyone how each outlet is feeling, mid-sentence.", stats: STATS(1, 2, 0) },
  { id: "p2", name: "Gus", power: "Find anything anyone threw away nearby, in seconds.", flaw: "Abandons any post for a dropped pretzel.", stats: STATS(2, 1, 0) },
  { id: "p3", name: "Bev", power: "Raise your paddle and freeze time for exactly three seconds.", flaw: "Spends two of the three seconds deciding what to do.", stats: STATS(1, 0, 2) },
];

// Three real stories (from the cached /api/news list), each with scripted plans (sensible, silly, power, friend's
// idea, a chained plan) and fixed dice so every version faces the same rolls. Plans stay general enough to fit
// wherever the story has gone. credit = the friend whose suggestion the owner worked in (+1).
const STORIES = [
  {
    key: "pumpkin",
    news: {
      headline: "Pumpkin named Bagheera breaks world record for Lymington grower",
      snippet: "The giant squash weighs 2,856.8lbs (1,295.8kg) and measured more than 20ft (6m) in circumference. A pumpkin grower has set a new world record after producing a giant squash. Ian Paton, from Lymington, Hampshire, entered his exceptionally large specimen into a giant vegetable weigh-off near Reading in Berkshire.",
      source: "BBC",
      url: "https://www.bbc.com/news/articles/crwyd17g48xqo",
      date: "2026-10-06T07:00:00Z",
      place: "Lymington, United Kingdom",
    },
    dice: [14, 3, 18, 11],
    turns: [
      { hero: "p1", plan: "ask the grumpy official what is going on" },
      { hero: "p2", plan: "push it really hard with everyone and then sit on it", credit: "p3" },
      { hero: "p3", plan: "freeze time and grab the thing that matters most" },
    ],
    finale: { hero: "p2", plan: "throw a giant party so it calms down" },
  },
  {
    key: "fossas",
    news: {
      headline: "Cumbria zoo welcomes 'troublesome' trio of rare baby fossas",
      snippet: "Lakeland Wildlife Oasis says the triplets' arrival is a \"very big step towards fossa conservation\". Zoo staff have been left \"over the moon\" after welcoming a trio of rare baby fossas. The triplets were born at Lakeland Wildlife Oasis in Milnthorpe, Cumbria, about three months ago and can now be seen by visitors.",
      source: "BBC",
      url: "https://www.bbc.com/news/articles/cmqln9r5dvlro",
      date: "2026-10-21T12:29:43Z",
      place: "Milnthorpe, United Kingdom",
    },
    dice: [1, 9, 12, 17],
    turns: [
      { hero: "p2", plan: "yell really loud to get everyone's attention" },
      { hero: "p3", plan: "bribe them with snacks", credit: "p1" },
      { hero: "p1", plan: "listen to the wires to find out where the problem comes from" },
    ],
    finale: { hero: "p3", plan: "lead everyone in total silence for one minute" },
  },
  {
    key: "statues",
    news: {
      headline: "2 giant Ramesses II statues, one wearing a double crown, discovered by man in Egypt",
      snippet: "The remains of two Ramesses II statues, one of which would have originally stood around 28 feet tall, were found by a villager in Egypt.",
      source: "Live Science",
      url: "https://www.livescience.com/archaeology/ancient-egyptians/2-giant-ramesses-ii-statues-one-wearing-a-double-crown-discovered-by-man-in-egypt",
      date: "2026-10-15T07:00:00Z",
      place: "Egypt",
    },
    dice: [7, 20, 5, 13],
    turns: [
      { hero: "p3", plan: "dig with my hands" },
      { hero: "p1", plan: "sing it a song lol", credit: "p2" },
      { hero: "p2", plan: "find a tool someone threw away nearby" },
    ],
    finale: { hero: "p1", plan: "get everyone to lift together on three" },
  },
];

// ---------------------------------------------------------------- the rules (mirrors lib/rules.ts + lib/grade.ts)
const TIER_DC = { clever: 9, solid: 11, risky: 14, wild: 17, miracle: 21 };
function judgeOld(die, total, tier) {
  if (die === 1) return "CATASTROPHE";
  if (die === 20) return "LEGENDARY";
  if (tier === "miracle") return "FAIL";
  const dc = TIER_DC[tier];
  if (total < dc) return "FAIL";
  return total >= dc + 3 ? "SUCCESS" : "YES_BUT";
}
const TIER_SHIFT = { clever: 3, solid: 0, risky: -3, wild: -5, miracle: -8 };
// lib/grade.ts (fail forward): every roll moves one act on; the grade picks the branch.
const ROWS = [
  ["DISASTER", 1, 1, "CATASTROPHE", "worse", "a spectacular, funny disaster: the problem jumps somewhere worse"],
  ["SETBACK", 2, 5, "FAIL", "worse", "it backfires: the problem escalates into a new place or complication, and the stakes rise"],
  ["PARTIAL", 6, 9, "FAIL", "mixed", "half of it works, and a twist comes with it"],
  ["PROGRESS", 10, 14, "YES_BUT", "better", "it works: a good path opens"],
  ["GREAT", 15, 19, "SUCCESS", "better", "it works really well: a great path opens, plus a small bonus the next hero can use"],
  ["LEGENDARY", 20, Infinity, "LEGENDARY", "legendary", "better than anyone hoped: a leap forward, and the world reacts"],
];
function gradeRoll(t, natural) {
  let total = Math.max(1, Math.round(t));
  if (natural === 1) total = 1;
  if (natural === 20) total = Math.max(20, total);
  const r = ROWS.find((x) => total >= x[1] && total <= x[2]);
  const span = Number.isFinite(r[2]) ? r[2] - r[1] : 0;
  return { grade: r[0], band: r[3], branch: r[4], meaning: r[5], depth: span ? (total - r[1]) / span : 1, total };
}
const ENDING_OF = { DISASTER: "GRIM_BUT_HILARIOUS", SETBACK: "GRIM_BUT_HILARIOUS", PARTIAL: "BITTERSWEET", PROGRESS: "TRIUMPHANT", GREAT: "TRIUMPHANT", LEGENDARY: "TRIUMPHANT" };
const ENDING = (b) => (b === "LEGENDARY" || b === "SUCCESS" ? "TRIUMPHANT" : b === "YES_BUT" ? "BITTERSWEET" : "GRIM_BUT_HILARIOUS");
const firstAction = (text) => {
  const m = text.match(/(.+?)(?:\s*[,;.]?\s*(?:\b(?:and|or|but)\s+)?\b(?:then|after that|afterwards|if (?:that|it) (?:fails|doesn't work|does not work)|if not|otherwise|else)\b)/i);
  const a = m ? m[1].trim().replace(/[,;.\s]+$/, "") : "";
  return a.split(/\s+/).length >= 2 ? a : text;
};

// ---------------------------------------------------------------- API
async function post(route, body, timeout = 60_000) {
  const r = await fetch(`${BASE}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${route} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function ai(task, input) {
  spend(1, task);
  const t0 = Date.now();
  const r = await post("/api/ai", { task, input: { ...input, rating: "kids" } });
  if (r.fallback) console.warn(`  ! ${task} fell back (${Date.now() - t0} ms)`);
  return r;
}

async function getOpener(s) {
  const file = path.join(OUT, `opener-${s.key}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  spend(2, `opener ${s.key}`);
  const r = await post("/api/story/opener", { mode: "news", rating: "kids", party: HEROES.map((h) => ({ hero_id: h.id, name: h.name, power: h.power })), source: s.news });
  if (!r.opener) throw new Error(`no opener for ${s.key}: ${JSON.stringify(r).slice(0, 200)}`);
  if (!r.fallback) fs.writeFileSync(file, JSON.stringify(r, null, 2));
  return r;
}

// ---------------------------------------------------------------- one Quick Tale, the way host.ts plays it
async function playGame(s) {
  const o = await getOpener(s);
  const op = o.opener;
  const facts = o.ending_facts ?? {};
  const name = (id) => HEROES.find((h) => h.id === id).name;
  const goal = String(op.goal).replace(/[.!]+$/, "");
  const beats = (op.beats ?? []).map((b) => String(b).replace(/[.!]+$/, "").trim()).filter(Boolean);
  const ladder = beats.length >= 2 ? [...beats.slice(0, -1).slice(0, HEROES.length - 1), goal] : [];
  const problem = op.problem ?? { name: op.title, stakes: "", pronoun: null };
  // host.ts today: spine.where = opener.location = the news place (a real place name; see the report).
  const spine = { problem: problem.name, stakes: problem.stakes ?? "", pronoun: problem.pronoun ?? "", where: MODE === "old" ? s.news.place : "", facts: [], prop: "", memorable: [] };
  const storySoFar = () => ({ problem: spine.problem, at_stake: spine.stakes, ...(spine.pronoun ? { pronoun: spine.pronoun } : {}), where: spine.where, what_changed: spine.facts.slice(-3), ...(MODE === "new" ? { memorable: spine.memorable.slice(-3) } : {}) });
  // The real event behind the story, spoiler-free (no names, numbers or punchline): the writer's real_setting.
  const realEvent = op.real_setting ?? null;
  const st = { situation: op.situation, nowGoal: ladder.length > 1 ? ladder[0] : goal, step: 0, log: [] };
  const turns = [];
  const order = s.turns;
  for (let k = 0; k < order.length; k++) {
    const t = order[k];
    const h = HEROES.find((x) => x.id === t.hero);
    const plan = firstAction(t.plan);
    const v = (
      await ai("verdict", {
        scene: { title: op.title, goal: st.nowGoal || goal, final_goal: goal, situation: st.situation, who_is_there: op.npc_line?.speaker ?? "" },
        finale: false,
        hero: { name: h.name, best_stat: "clever", stats: h.stats, power: h.power, weakness: h.flaw },
        plan,
        earlier: st.log.map((l) => `${l.hero} (${l.band}): ${l.narration}`).slice(-4),
        story_so_far: storySoFar(),
        ...(MODE === "new" ? { real_event: realEvent } : {}),
      })
    ).data;
    const die = s.dice[k];
    const bonus = t.credit ? 1 : 0;
    const raw = die + (h.stats[v.stat] ?? 0) + bonus;
    const g = MODE === "new" ? gradeRoll(raw + TIER_SHIFT[v.tier], die) : null;
    const band = g ? g.band : judgeOld(die, raw, v.tier);
    const won = g ? !["DISASTER", "SETBACK", "PARTIAL"].includes(g.grade) : !["FAIL", "CATASTROPHE"].includes(band);
    const next = order[k + 1]?.hero;
    // Fail forward: every turn moves one act on (never onto the top step, the finale); "" = the writer invents the act.
    const target = g && ladder.length > 1 ? Math.min(ladder.length - 2, st.step + 1) : st.step;
    const nextAct = g && target > st.step ? ladder[target] : "";
    const input = {
      story: { title: op.title, goal },
      story_so_far: storySoFar(),
      situation: st.situation,
      right_now: st.nowGoal || goal,
      last_prop: spine.prop,
      ladder: ladder.length
        ? MODE === "new"
          ? { steps: ladder, current: ladder[st.step] ?? "", next: nextAct, target: nextAct }
          : { steps: ladder, current: ladder[st.step] ?? "", next: st.step + 1 < ladder.length - 1 ? ladder[st.step + 1] : "" }
        : undefined,
      hero: { name: h.name, power: h.power, weakness: h.flaw },
      attempt: v.interpretation ?? "",
      plan,
      helped_by: t.credit && won ? name(t.credit) : "",
      band,
      natural: die === 1 || die === 20 ? die : null,
      earlier: st.log.map((l) => l.narration).slice(-4),
      turns_left: Math.max(0, order.length - k - 1),
      short: true,
      ...(MODE === "new"
        ? {
            roll: { total: g.total, grade: g.grade, branch: g.branch, meaning: g.meaning, depth: Number(g.depth.toFixed(2)) },
            real_event: realEvent,
            idea_from: t.credit ? name(t.credit) : "",
            heroes: HEROES.map((x) => x.name),
            next_hero: next ? name(next) : "",
            side_character: op.npc_line?.speaker ? op.npc_line : undefined,
          }
        : {}),
    };
    const out = (await ai("outcome", input)).data;
    const before = st.nowGoal;
    let step = st.step;
    let nowGoal;
    const backward = /\b(again|start over|back to square)\b/i.test(out.now_goal ?? "");
    if (MODE === "new") {
      step = target;
      nowGoal = !backward && out.now_goal ? out.now_goal : nextAct || st.nowGoal;
    } else {
      const missed = band === "FAIL" || band === "CATASTROPHE";
      const climb = !missed && ladder.length > 1 && st.step + 1 < ladder.length - 1;
      step = climb ? st.step + 1 : st.step;
      nowGoal = missed || backward ? st.nowGoal : out.now_goal || (climb ? ladder[step] : "");
    }
    if (out.where) spine.where = out.where;
    if (out.changed) spine.facts = [...spine.facts, out.changed].slice(-3);
    spine.prop = out.new_prop ?? "";
    if (out.memorable) spine.memorable.push(out.memorable);
    st.log.push({ hero: h.name, band, narration: out.text });
    turns.push({ hero: h.name, plan: t.plan, credit: t.credit ? name(t.credit) : "", tier: v.tier, reason: v.reason, die, total: g ? g.total : raw, grade: g ? g.grade : band, goal_before: before, text: out.text, situation: out.situation, goal_after: nowGoal || st.nowGoal, scene: out.scene ?? "" });
    st.situation = out.situation || st.situation;
    st.nowGoal = nowGoal || st.nowGoal;
    st.step = step;
  }
  // The grand finale: one ruling, one shared die, the ending.
  const f = s.finale;
  const fh = HEROES.find((x) => x.id === f.hero);
  const fv = (
    await ai("verdict", {
      scene: { title: op.title, goal, final_goal: goal, situation: st.situation, who_is_there: op.npc_line?.speaker ?? "" },
      finale: true,
      hero: { name: fh.name, best_stat: "clever", stats: fh.stats, power: fh.power, weakness: fh.flaw },
      plan: f.plan,
      earlier: st.log.map((l) => `${l.hero} (${l.band}): ${l.narration}`).slice(-4),
      story_so_far: storySoFar(),
      ...(MODE === "new" ? { real_event: realEvent } : {}),
    })
  ).data;
  const fdie = s.dice[3];
  const fraw = fdie + (fh.stats[fv.stat] ?? 0) + 2;
  const fg = MODE === "new" ? gradeRoll(fraw + TIER_SHIFT[fv.tier], fdie) : null;
  const fband = fg ? fg.band : judgeOld(fdie, fraw, fv.tier);
  const ending = fg ? ENDING_OF[fg.grade] : ENDING(fband);
  const e = (
    await ai("epilogue", {
      scene: { title: op.title, goal },
      winner: fh.name,
      attempt: fv.interpretation ?? "",
      band: fband,
      ending,
      won: ending !== "GRIM_BUT_HILARIOUS",
      story_so_far: storySoFar(),
      players: HEROES.map((h) => ({ id: h.id, said: "<player_input></player_input>" })),
      heroes: HEROES.map((h) => h.name),
      situation: st.situation,
      earlier: st.log.map((l) => l.narration),
      finale_plan: fv.interpretation ?? "",
      quick_tale: true,
      ...(MODE === "new" ? { real_event: realEvent, roll: { total: fg.total, grade: fg.grade, branch: fg.branch, meaning: fg.meaning }, side_character: op.npc_line?.speaker ? op.npc_line : undefined } : {}),
    })
  ).data;
  return {
    key: s.key,
    mode: MODE,
    real: { headline: s.news.headline, snippet: s.news.snippet, official_line: facts.official_line, now: facts.whats_happening_now, real_setting: op.real_setting },
    opener: { title: op.title, narration: op.narration, goal, situation: op.situation, problem, ladder, npc: op.npc_line },
    turns,
    finale: { hero: fh.name, plan: f.plan, tier: fv.tier, die: fdie, total: fg ? fg.total : fraw, grade: fg ? fg.grade : fband, ending: e.ending, line: e.line, recap: e.recap },
  };
}

// ---------------------------------------------------------------- the grader
function envKey() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const m = txt.match(/^MODEL_API_KEY=(.*)$/m);
  if (!m || !m[1].trim()) throw new Error("MODEL_API_KEY missing in .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const RUBRIC = `You are a tough story editor grading ONE playthrough of a party game. Friends play heroes in a short co-op story.
The story is a real, odd news event re-imagined as modern urban fantasy: the players should feel they are INSIDE the real event
(its kind of place, the kinds of people there, what is really at stake, how it really unfolds) with one fantasy twist.
Real names, places and numbers stay hidden until a reveal at the end. Each turn one hero acts, a die is rolled, and the narrator
writes the outcome, the new situation, and a new "Right now" goal (the next step toward solving the problem).
FAIL FORWARD: every turn, win or lose, must move the story to a NEW situation (the next act); the roll picks the branch:
1 = spectacular funny disaster (worse branch); 2-5 = backfires, the problem escalates (worse); 6-9 = half works with a twist (mixed);
10-14 = works (better); 15-19 = works well plus a small bonus (better); 20+ = legendary leap. A story that stalls on a fail is broken.
(Older builds used pass/fail bands; grade intensity against the band or grade given.)

Score 1-5 each (5 = excellent, 3 = okay, 1 = broken). Be strict, use the whole scale.
- goal_relevance: every "Right now" goal is a concrete, vivid, verb-first step (8 words max) that solves THIS problem, follows from
  what just happened, never goes backward, and is never about a stray object.
- fidelity: it feels like being inside the real event (setting, roles, stakes, timeline) with a fantasy twist; no real names/places/numbers leak.
- coherence: cause and effect a listener could retell; the story stays on one problem; every turn moves to a new situation; nothing contradicts what came before.
- clarity: an 8-year-old follows every line read aloud once; 1-2 sentences; no jargon; no word salad.
- fun: dry, witty, iconic, creative, unexpected but makes sense; a table would laugh. Penalize generic or try-hard jokes.
- connectedness: friends whose ideas were used are named and credited; heroes react to each other; the table has reasons to talk.
- craft: callbacks to earlier moments pay off (especially in the ending); a recurring side character reacts in a distinct voice; each outcome makes the acting hero look cool or hilariously human.
- intensity: each outcome matches its roll's degree exactly (a 14 is not a 19; a 2 is a real setback; a 1 is spectacular).
Then list the 3 WORST lines (quote exactly) with a short reason each, and one concrete prompt fix.`;

const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["goal_relevance", "fidelity", "coherence", "clarity", "fun", "connectedness", "craft", "intensity", "worst_lines", "fix"],
  properties: {
    goal_relevance: { type: "integer" },
    fidelity: { type: "integer" },
    coherence: { type: "integer" },
    clarity: { type: "integer" },
    fun: { type: "integer" },
    connectedness: { type: "integer" },
    craft: { type: "integer" },
    intensity: { type: "integer" },
    worst_lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["line", "why"], properties: { line: { type: "string" }, why: { type: "string" } } } },
    fix: { type: "string" },
  },
};

async function grade(game) {
  spend(1, `grade ${game.key}`);
  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${envKey()}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: "muse-spark-1.3",
      messages: [
        { role: "developer", content: RUBRIC },
        { role: "user", content: JSON.stringify(game) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "story_grade", schema: GRADE_SCHEMA, strict: true } },
      reasoning_effort: "high",
      max_completion_tokens: 8000,
    }),
  });
  if (!res.ok) throw new Error(`grader HTTP ${res.status}`);
  const j = await res.json();
  return JSON.parse(j.choices[0].message.content);
}

// ---------------------------------------------------------------- run

const DIMS = ["goal_relevance", "fidelity", "coherence", "clarity", "fun", "connectedness", "craft", "intensity"];
const CORE = DIMS.filter((d) => d !== "craft"); // craft was added in round 3: overall7 compares with older runs
const results = [];
for (const s of STORIES.filter((x) => !ONLY || x.key === ONLY)) {
  console.log(`\n=== ${s.key} (${MODE})`);
  const game = await playGame(s);
  console.log(`  OPENER: ${game.opener.narration}\n  GOAL: ${game.opener.goal}  LADDER: ${game.opener.ladder.join(" > ")}`);
  for (const t of game.turns) {
    console.log(`  [${t.hero} | ${t.tier} | d${t.die} -> ${t.total} ${t.grade}] "${t.plan}"${t.credit ? ` (+ ${t.credit}'s idea)` : ""}`);
    console.log(`     right now: ${t.goal_before}\n     OUT: ${t.text}\n     NOW: ${t.situation}\n     NEXT GOAL: ${t.goal_after}${t.scene ? `\n     ART: ${t.scene}` : ""}`);
  }
  console.log(`  FINALE [${game.finale.hero} | ${game.finale.tier} | ${game.finale.total} ${game.finale.grade}] ${game.finale.ending}\n  RECAP: ${game.finale.recap}`);
  if (GRADE) {
    game.grade = await grade(game);
    console.log(`  GRADE: ${DIMS.map((d) => `${d} ${game.grade[d]}`).join(", ")}`);
    for (const w of game.grade.worst_lines) console.log(`   - "${w.line}": ${w.why}`);
    console.log(`  FIX: ${game.grade.fix}`);
  }
  results.push(game);
}
if (GRADE && results.length) {
  const avg = Object.fromEntries(DIMS.map((d) => [d, +(results.reduce((a, g) => a + g.grade[d], 0) / results.length).toFixed(2)]));
  const overall = +(DIMS.reduce((a, d) => a + avg[d], 0) / DIMS.length).toFixed(2);
  const overall7 = +(CORE.reduce((a, d) => a + avg[d], 0) / CORE.length).toFixed(2);
  console.log(`\n=== ${LABEL} (${MODE}) average: ${DIMS.map((d) => `${d} ${avg[d]}`).join(", ")}  overall ${overall} (overall7 ${overall7})`);
  ledger.runs.push({ label: LABEL, mode: MODE, at: new Date().toISOString(), avg, overall, overall7 });
}
fs.writeFileSync(path.join(OUT, `games-${LABEL}.json`), JSON.stringify(results, null, 2));
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
console.log(`Muse calls so far: ${ledger.calls}/${BUDGET}. Transcripts: ${path.join(OUT, `games-${LABEL}.json`)}`);
