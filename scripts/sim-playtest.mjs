// Playtest simulation (design/38): 100 college-student personas, ~10 full games through the REAL engine on a local
// dev server, the same pipeline the TV host runs per turn (verdict -> crypto d20 + stat + tier shift -> turn), then the
// finale (everyone proposes, everyone backs a friend's plan, one shared die -> story_end). Player plans come from Muse,
// written in each persona's voice (3 words or a paragraph, on-script or wildly off it). Saves every game's transcript
// and runs the automated checks (did the situation change, repeated objectives, off-script followed, distinct endings).
// The 1-10 ratings are done afterwards by separate reader agents from the saved transcripts (not here).
//
//   set NEWS_LIVE=0&& set NEXT_DIST_DIR=.next-sim&& npm --prefix game run dev -- -p 3121
//   node --env-file=.env.local scripts/sim-playtest.mjs --out <dir> [--label baseline] [--games 10] [--par 3]
// env SIM_BASE (default http://localhost:3121). The key is only read from process.env and sent to Meta; never logged.
// Muse calls: ~3 per turn + 3 per finale, so ~18-22 per game.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
// The game's TS files import each other without extensions (Next resolves them); teach Node the same.
registerHooks({ resolve: (spec, ctx, next) => { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(`${spec}.ts`, ctx); throw e; } } });
const { stateFromOpener } = await import("../game/src/lib/procedural.ts");
const { gradeRoll, TIER_SHIFT } = await import("../game/src/lib/grade.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.SIM_BASE || "http://localhost:3121";
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const OUT = path.resolve(arg("--out", path.join(ROOT, "sim-out")));
const LABEL = arg("--label", "baseline");
const NGAMES = Number(arg("--games", "10"));
const PAR = Number(arg("--par", "3"));
const SEED = Number(arg("--seed", "38"));
fs.mkdirSync(OUT, { recursive: true });

// --aggregate: after the reader agents wrote ratings-*.json ([{persona, game, rating, like, dislike, followable}]) and
// the auditor wrote audit.json ({turns: [{game, turn, progressed, same_objective, undid_success, offscript_followed}]}),
// print the numbers for design/38 (no game is played, no AI is called).
if (argv.includes("--aggregate")) {
  const R = fs.readdirSync(OUT).filter((f) => /^ratings-.*\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")));
  const xs = R.map((r) => Number(r.rating)).filter(Number.isFinite).sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length || 1));
  const hist = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, xs.filter((x) => x === i + 1).length]));
  const byGame = {};
  for (const r of R) (byGame[r.game] ??= []).push(Number(r.rating));
  const fol = R.filter((r) => /^y/i.test(String(r.followable))).length;
  const out = { n: xs.length, mean: +mean.toFixed(2), median: xs.length ? (xs[(xs.length - 1) >> 1] + xs[xs.length >> 1]) / 2 : 0, sd: +sd.toFixed(2), hist, followablePct: Math.round((100 * fol) / (R.length || 1)), byGame: Object.fromEntries(Object.entries(byGame).map(([g, v]) => [g, +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)])) };
  const auditFile = path.join(OUT, "audit.json");
  if (fs.existsSync(auditFile)) {
    const A = JSON.parse(fs.readFileSync(auditFile, "utf8")).turns ?? [];
    const yes = (k) => A.filter((t) => /^y/i.test(String(t[k]))).length;
    const off = A.filter((t) => /^(y|n|yes|no)$/i.test(String(t.offscript_followed)));
    out.audit = { turns: A.length, notProgressedPct: Math.round((100 * (A.length - yes("progressed"))) / (A.length || 1)), sameObjectivePct: Math.round((100 * yes("same_objective")) / (A.length || 1)), undidSuccess: yes("undid_success"), offscriptFollowed: `${off.filter((t) => /^y/i.test(t.offscript_followed)).length}/${off.length}` };
  }
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}

// ---------------------------------------------------------------- seeded randomness (personas, assignments)
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const trait = () => Math.max(1, Math.min(10, Math.round(5.5 + 2 * normal())));
const pick = (a) => a[Math.floor(rnd() * a.length)];
// The dice are crypto, like the host (never the seeded RNG).
const d20 = () => crypto.randomInt(1, 21);

// ---------------------------------------------------------------- 100 personas
const FIRST = ["Aiden","Maya","Jordan","Priya","Luis","Chloe","Marcus","Sofia","Ethan","Aaliyah","Kevin","Hannah","Diego","Grace","Tyler","Fatima","Noah","Isabella","Ravi","Emily","Jamal","Olivia","Minh","Zoe","Carlos","Ava","Brandon","Leila","Sam","Natalie","Omar","Lily","Hunter","Mei","Andre","Sarah","Kai","Valeria","Josh","Nia","Ben","Ximena","Connor","Ananya","Malik","Rachel","Theo","Camila","Devin","Jasmine"];
const MAJORS = ["CS","ECE","Biology","Business","Economics","Psychology","Theatre","Mechanical Eng","Nursing","Radio-TV-Film","Math","Government","Plan II","Architecture","Chemistry","Advertising","Kinesiology","History","Music","Undeclared"];
const YEARS = ["freshman","sophomore","junior","senior","grad student"];
function makePersonas(n = 100) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = {
      id: `P${String(i + 1).padStart(3, "0")}`,
      name: `${pick(FIRST)}`,
      year: pick(YEARS),
      major: pick(MAJORS),
      creativity: trait(),
      chaos: trait(),
      engagement: trait(),
      patience: trait(),
      reading: trait(),
      gaming: trait(),
    };
    // How much they type: low engagement or patience = 3 words; high both = a paragraph.
    const v = (p.engagement + p.patience) / 2 + normal();
    p.verbosity = v < 4 ? "terse" : v > 7.5 ? "paragraph" : "sentence";
    // How often they go off-script (ignore the objective entirely and steer the story somewhere else).
    p.offscript = Math.max(0.03, Math.min(0.85, (p.chaos - 4) / 7));
    p.vibe =
      p.engagement <= 3 && p.patience <= 4 ? "bored skeptic, phone-addicted, rates harshly"
      : p.chaos >= 8 ? "chaos gremlin, wants to break the game and laugh"
      : p.creativity >= 8 ? "creative storyteller, loves a clever bit"
      : p.gaming >= 8 ? "experienced gamer (D&D, Jackbox), notices bad game design fast"
      : p.reading <= 3 ? "skims everything, hates walls of text"
      : p.engagement >= 8 ? "enthusiastic, plays along with anything"
      : "average student, plays straight, wants it to make sense";
    out.push(p);
  }
  return out;
}
const PERSONAS = makePersonas();
const personaCard = (p) => `${p.name} (${p.id}), ${p.year}, ${p.major}. ${p.vibe}. Traits 1-10: creativity ${p.creativity}, chaos/silliness ${p.chaos}, engagement ${p.engagement}, patience ${p.patience}, reading attention ${p.reading}, gaming experience ${p.gaming}. Typing style: ${p.verbosity}.`;

// ---------------------------------------------------------------- stories, heroes
const SEEDS = JSON.parse(fs.readFileSync(path.join(ROOT, "game", "src", "data", "seed_quests.json"), "utf8"));
const HEROES = JSON.parse(fs.readFileSync(path.join(ROOT, "game", "src", "data", "quickstart_heroes_v2.json"), "utf8")).map((x) => x.hero);
const JUDGE = ["canal-shark", "wall-gold", "norwich-batman"];
const LIBRARY = ["opera-snake", "rust-wyrm", "hanging-boulder", "cornfield-dome"];
// 10 games: each judge story twice, then library stories. Players/turns: 3p x 2 turns = 6, 4p x 1 = 4, 3p 5 (judge-ish).
const PLAN = [
  ["canal-shark", 3, 6], ["wall-gold", 4, 4], ["norwich-batman", 3, 5],
  ["canal-shark", 4, 4], ["wall-gold", 3, 6], ["norwich-batman", 4, 4],
  ["opera-snake", 3, 5], ["rust-wyrm", 4, 4], ["hanging-boulder", 3, 6], ["cornfield-dome", 3, 5],
].slice(0, NGAMES);

/** The host's Quick Tale opener (judge mode): host.startStory + seedScenes(seed, quick=true). */
function openerFor(seed) {
  const sc = seed.opener ? { ...seed.opener } : seed.quick_scene ? { ...seed.quick_scene } : null;
  const goal = sc?.goal ?? seed.the_goal.description;
  return {
    scene: sc,
    opener: {
      ...sc,
      goal,
      problem: { name: sc?.problem_name || seed.the_threat.name, stakes: seed.problem?.stakes ?? "" },
      real_setting: seed.real_event,
      // storyV3 (design/37): the pressures and the original problem, when the seed has them.
      pressures: sc?.pressures ?? seed.pressures,
      original_problem: sc?.original_problem ?? seed.original_problem,
      beats: sc?.first_step ? [sc.first_step] : seed.beats ?? (seed.scenes ?? []).map((s) => s.goal),
    },
  };
}

// ---------------------------------------------------------------- calls
let museCalls = 0;
const recentEndings = []; // v3: the ending prompt avoids the TV's last endings (host: gp-endings)
async function ai(task, input) {
  museCalls++;
  const t0 = Date.now();
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(`${BASE}/api/ai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, input: { rating: "teens", ...input } }), signal: AbortSignal.timeout(60_000) });
      const j = await r.json();
      return { ...j, ms: Date.now() - t0 };
    } catch (e) {
      if (a) return { data: null, fallback: true, error: String(e), ms: Date.now() - t0 };
    }
  }
}
async function muse(task, system, user, schema) {
  museCalls++;
  const key = process.env.MODEL_API_KEY;
  if (!key) throw new Error("MODEL_API_KEY missing (run with node --env-file=.env.local)");
  for (let a = 0; a < 2; a++) {
    try {
      const res = await fetch("https://api.meta.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: "muse-spark-1.3",
          messages: [{ role: "developer", content: system }, { role: "user", content: user }],
          response_format: { type: "json_schema", json_schema: { name: task, schema, strict: true } },
          reasoning_effort: "low",
          temperature: 1,
          max_completion_tokens: 1500,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      return JSON.parse(j.choices[0].message.content);
    } catch (e) {
      if (a) throw e;
    }
  }
}

const PLAYER_SYS = `You simulate ONE real college student playing a party game at a hackathon table. The laptop screen is the table; the student types their hero's move on their phone. Write ONLY what this student would actually type into the phone box, in their own voice (lowercase, typos, slang and "lol" are fine for casual students; a paragraph only if they are that type). Never mention dice, rolls or game mechanics. Stay in character: a bored student types something minimal or dumb, a chaos gremlin tries to break the story for laughs, a storyteller tries a clever bit, a straight player tries to solve what's on screen.`;
const LEN = { terse: "1 to 5 words, no punctuation needed", sentence: "one sentence, 8 to 18 words", paragraph: "a full paragraph, 35 to 70 words, with a multi-step scheme" };

function screenText(g) {
  const last = g.turns.at(-1);
  return [
    `STORY: ${g.title}. ${g.openerText}`,
    `FINISH LINE on screen: ${g.state.finish_line}`,
    ...g.turns.slice(-3).map((t) => `${t.hero} tried: "${t.plan}" -> ${t.gradeLabel}. ${t.outcome}`),
    last?.scene ? `Scene now: ${last.scene}` : "",
    `RIGHT NOW on screen: ${g.state.right_now || "(none shown)"}`,
  ].filter(Boolean).join("\n");
}

async function playerPlan(g, seat, offscript) {
  const p = seat.persona;
  const style = LEN[p.verbosity];
  const off = offscript
    ? `THIS TURN ${p.name} goes OFF-SCRIPT: ignore the Right now and the finish line completely and steer the story somewhere new and unrelated that a real student might type to test the game, e.g. "I quit and become a private detective", "I invest my savings in gold", "start a band with the guard", "open a food truck", "run for mayor", "fake my own death and move to Ohio". Pick something fitting this student, not those exact examples.`
    : `This turn ${p.name} tries to deal with what's on screen (the Right now), in their own way.`;
  const user = `${personaCard(p)}\nTheir hero: ${seat.hero.name} (${seat.hero.pronouns}). Power: ${seat.hero.ability.text} Weakness: ${seat.hero.flaw}\n\nWHAT THE TABLE SEES:\n${screenText(g)}\n\n${off}\nLength: ${style}.\nReturn JSON {"plan": "..."} with exactly what they type.`;
  const r = await muse("sim_player_plan", PLAYER_SYS, user, { type: "object", additionalProperties: false, properties: { plan: { type: "string" } }, required: ["plan"] });
  return String(r.plan || "").trim().slice(0, 400);
}

async function finalePlans(g) {
  const seats = g.seats.map((s, i) => `${i + 1}. ${personaCard(s.persona)} Hero: ${s.hero.name}. Power: ${s.hero.ability.text}`).join("\n");
  const user = `It's the GRAND FINALE: every player types the final move for the whole group, then everyone backs a friend's plan.\n\nWHAT THE TABLE SEES:\n${screenText(g)}\n\nPLAYERS:\n${seats}\n\nFor each player (in order), write exactly what they type as the final move, in their own voice and length style (terse = 1-5 words, sentence = 8-18 words, paragraph = 35-70 words). Chaotic players may still go off-script. Return JSON {"plans": ["...", "..."]} with one entry per player.`;
  const r = await muse("sim_finale_plans", PLAYER_SYS.replace("ONE real college student", "several real college students"), user, { type: "object", additionalProperties: false, properties: { plans: { type: "array", items: { type: "string" } } }, required: ["plans"] });
  return g.seats.map((_, i) => String(r.plans?.[i] ?? r.plans?.[0] ?? "do the thing").trim().slice(0, 400));
}

// ---------------------------------------------------------------- one game
const STOP = new Set("the a an to of and or in on at for with from by is it its this that be get got make put keep their his her they them our your you we i me my into out off up down over before after as so all any every one just now then back".split(" "));
const content = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ies|es|s)$/, ""));
const jacc = (a, b) => { const A = new Set(content(a)), B = new Set(content(b)); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n); };
const shared = (a, b) => { const B = new Set(content(b)); return [...new Set(content(a))].filter((x) => B.has(x)); };

async function playGame(gi, [storyId, nPlayers, nTurns], seatPersonas) {
  const seed = SEEDS.find((s) => s.id === storyId);
  const { scene, opener } = openerFor(seed);
  const heroes = [...HEROES].sort(() => rnd() - 0.5).slice(0, nPlayers);
  const seats = seatPersonas.map((persona, i) => ({ persona, hero: heroes[i] }));
  const g = {
    game: gi + 1,
    label: LABEL,
    story: storyId,
    title: seed.quest_title,
    openerText: `${scene?.narration ?? ""} ${scene?.npc_line?.speaker ? `${scene.npc_line.speaker}: "${scene.npc_line.line}"` : ""}`.trim(),
    seats,
    turns: [],
    log: [],
    state: stateFromOpener(opener, seats.map((s) => ({ name: s.hero.name, pronouns: s.hero.pronouns })), nTurns),
  };
  g.start = { right_now: g.state.right_now, finish_line: g.state.finish_line };
  const order = Array.from({ length: nTurns }, (_, k) => k % nPlayers);
  for (let k = 0; k < nTurns; k++) {
    const seat = seats[order[k]];
    const h = seat.hero;
    const off = rnd() < seat.persona.offscript;
    const plan = await playerPlan(g, seat, off).catch(() => "do something");
    const vr = await ai("verdict", {
      scene: { title: g.title, goal: g.state.right_now || g.state.finish_line, final_goal: g.state.finish_line, situation: g.turns.at(-1)?.scene || scene?.situation || "", who_is_there: scene?.npc_line?.speaker ?? "" },
      finale: false,
      hero: { name: h.name, best_stat: Object.entries(h.stats).sort((a, b) => b[1] - a[1])[0][0], stats: h.stats, power: h.ability.text, weakness: h.flaw },
      plan, own_words: plan, friend_idea: "",
      earlier: g.log.slice(-4),
      story_so_far: storySoFar(g.state),
      real_event: seed.real_event,
      pronouns: g.state.pronouns,
      quips_so_far: [],
    });
    const v = vr?.data?.tier ? vr.data : { tier: "solid", stat: "clever", interpretation: `${h.name} tries their plan`, fallback: true };
    const die = d20();
    const statBonus = h.stats[v.stat] ?? 0;
    const shift = TIER_SHIFT[v.tier] ?? 0;
    const gr = gradeRoll(die + statBonus + shift, die);
    const next = seats[order[k + 1]]?.hero.name ?? "";
    const prevRight = g.state.right_now;
    const tr = await ai("turn", {
      state: g.state,
      hero: { name: h.name, power: h.ability.text, pronouns: h.pronouns, concept: "" },
      plan, own: plan, idea: "",
      attempt: v.fallback ? "" : v.interpretation ?? "",
      idea_from: "",
      grade: gr.grade, total: gr.total, depth: Math.round(gr.depth * 100) / 100,
      next_player: next,
      turns_left: Math.max(0, nTurns - k - 1),
    });
    const d = tr?.data ?? {};
    if (d.state) g.state = d.state;
    const t = {
      k: k + 1, player: seat.persona.id, persona: seat.persona.name, verbosity: seat.persona.verbosity, hero: h.name, offscript: off, plan,
      tier: v.tier, stat: v.stat, interpretation: v.interpretation, verdictFallback: !!v.fallback,
      die, statBonus, shift, total: gr.total, grade: gr.grade, gradeLabel: gr.label,
      outcome: d.outcome ?? "(no outcome)", scene: d.scene ?? "", lines: d.lines ?? [],
      rightBefore: prevRight, rightNow: d.right_now ?? g.state.right_now, problemNow: d.problem_now ?? d.state?.problem ?? "",
      progress: d.progress, delta: d.progress_delta, why: d.progress_why, act: d.act, finale: !!d.finale,
      fallback: !!(tr?.fallback || d.fallback), problems: d.problems ?? [], ms: tr?.ms,
    };
    g.turns.push(t);
    g.log.push(`${h.name} (${gr.band}): ${t.outcome}`);
    console.log(`[g${g.game} ${storyId}] T${k + 1} ${h.name}${off ? " OFF" : ""} "${plan.slice(0, 60)}" ${v.tier} d${die}=${gr.total} ${gr.grade} | ${t.outcome.slice(0, 90)} | RN: ${t.rightNow}`);
    if (d.finale && k < nTurns - 1) { g.earlyFinale = k + 1; break; }
  }
  // ----- finale: everyone proposes, everyone backs a friend's plan (never their own), one shared die
  const plans = await finalePlans(g).catch(() => g.seats.map(() => "save the day"));
  const votes = g.seats.map((_, i) => { const others = g.seats.map((__, j) => j).filter((j) => j !== i); return others[Math.floor(rnd() * others.length)]; });
  const count = (j) => votes.filter((x) => x === j).length;
  const top = Math.max(...plans.map((_, j) => count(j)));
  const best = plans.map((_, j) => j).filter((j) => count(j) === top);
  const w = best[Math.floor(rnd() * best.length)];
  const ws = g.seats[w];
  const vr = await ai("verdict", {
    scene: { title: g.title, goal: g.state.right_now || g.state.finish_line, final_goal: g.state.finish_line, situation: g.turns.at(-1)?.scene || "", who_is_there: scene?.npc_line?.speaker ?? "" },
    finale: true,
    hero: { name: ws.hero.name, best_stat: "clever", stats: ws.hero.stats, power: ws.hero.ability.text, weakness: ws.hero.flaw },
    plan: plans[w], own_words: plans[w], friend_idea: "",
    earlier: g.log.slice(-4), story_so_far: storySoFar(g.state), real_event: seed.real_event, pronouns: g.state.pronouns, quips_so_far: [],
  });
  const v = vr?.data?.tier ? vr.data : { tier: "solid", stat: "clever", interpretation: "", fallback: true };
  const die = d20();
  const backed = Math.min(2, count(w));
  const shift = Math.max(-3, TIER_SHIFT[v.tier] ?? 0);
  const gr = gradeRoll(die + (ws.hero.stats[v.stat] ?? 0) + backed + shift, die);
  const won = gr.ending !== "GRIM_BUT_HILARIOUS";
  const er = await ai("story_end", {
    state: g.state,
    winner_hero: { name: ws.hero.name, pronouns: ws.hero.pronouns },
    real_story: seed.the_real_story ? { headline: seed.the_real_story.headline, summary: seed.the_real_story.summary, now: seed.the_real_story.now ?? "" } : undefined,
    plan: plans[w], grade: gr.grade, scene: { title: scene?.title, goal: scene?.goal },
    winner: ws.hero.name, attempt: v.interpretation ?? "", band: gr.band, ending: gr.ending, won,
    story_so_far: storySoFar(g.state), real_event: seed.real_event, pronouns: g.state.pronouns,
    players: g.seats.map((s) => ({ id: s.persona.id, said: "<player_input></player_input>" })),
    heroes: g.seats.map((s) => s.hero.name), situation: g.turns.at(-1)?.scene || "", earlier: g.log, finale_plan: v.interpretation ?? "", recent_endings: recentEndings.slice(0, 5), quick_tale: true,
  });
  const e = er?.data ?? {};
  if (e.ending) recentEndings.unshift(e.ending);
  g.finale = {
    plans: g.seats.map((s, i) => ({ hero: s.hero.name, player: s.persona.id, plan: plans[i], backs: count(i) })),
    winner: ws.hero.name, plan: plans[w], tier: v.tier, interpretation: v.interpretation, die, backed, total: gr.total, grade: gr.grade, gradeLabel: gr.label, won,
    ending: e.ending ?? "(no ending)", line: e.line ?? "", recap: e.recap ?? "", bridge: e.bridge ?? "", fallback: !!(er?.fallback || e.fallback),
  };
  g.realStory = seed.the_real_story ?? null;
  console.log(`[g${g.game} ${storyId}] FINALE ${ws.hero.name} ${gr.grade} won=${won} | ${String(g.finale.ending).slice(0, 120)}`);
  return g;
}
function storySoFar(st) {
  return { where: st.where, problem: st.problem, at_stake: st.stakes, finish_line: st.finish_line, progress: st.progress, act: st.act, cast: st.cast, facts: st.facts, open_thread: st.open_thread, last_moments: st.last_moments, memorable: st.memorable, pronouns: st.pronouns, hook: st.hook, right_now: st.right_now, ...(st.pressures ? { pressures: st.pressures } : {}) };
}

// ---------------------------------------------------------------- the readable transcript (what a player saw)
function transcript(g) {
  const L = [`# Game ${g.game}: ${g.title} (${g.seats.length} players, ${g.turns.length} turns + finale)`, ``, `Players: ${g.seats.map((s) => `${s.hero.name} (played by ${s.persona.name} ${s.persona.id}; power: ${s.hero.ability.text})`).join("; ")}`, ``, `OPENING: ${g.openerText}`, `Finish line on screen: ${g.start.finish_line}`, `Right now: ${g.start.right_now}`, ``];
  for (const t of g.turns) {
    L.push(`## Turn ${t.k}: ${t.hero} (${t.persona})`, `Plan typed: "${t.plan}"`, `DM ruling: ${t.tier}${t.interpretation ? ` ("${t.interpretation}")` : ""}. d20 = ${t.die} (+${t.statBonus} stat, ${t.shift >= 0 ? "+" : ""}${t.shift} difficulty) = ${t.total}: ${t.gradeLabel}`, `Outcome: ${t.outcome}`, t.scene ? `Scene: ${t.scene}` : "", t.problemNow && t.problemNow !== g.turns[t.k - 2]?.problemNow ? `Problem now: ${t.problemNow}` : "", `Right now: ${t.rightNow}`, ``);
  }
  const f = g.finale;
  L.push(`## GRAND FINALE`, ...f.plans.map((p) => `- ${p.hero}: "${p.plan}" (${p.backs} backed it)`), `Winning plan: ${f.winner}'s. Ruling ${f.tier}. One shared die: ${f.die} (+${f.backed} backing) = ${f.total}: ${f.gradeLabel}`, `Ending: ${f.ending}`, f.line ? `Last line: "${f.line}"` : "", f.recap ? `Recap: ${f.recap}` : "", ``);
  if (g.realStory) L.push(`## Based on a true story`, `${g.realStory.headline ?? ""}: ${g.realStory.summary ?? ""}`, f.bridge ? `Bridge: ${f.bridge}` : "");
  return L.filter((x) => x !== "").join("\n");
}

// ---------------------------------------------------------------- automated checks
const WINS = new Set(["PROGRESS", "GREAT", "LEGENDARY"]);
function checks(games) {
  const rows = [];
  let turns = 0, stuck = 0, repeatAny = 0, offN = 0, offFollowed = 0, fallbacks = 0, winsN = 0, winRepeat = 0;
  for (const g of games) {
    const seen = [g.start.right_now];
    for (const t of g.turns) {
      turns++;
      if (t.fallback) fallbacks++;
      const sim = jacc(t.rightNow, t.rightBefore);
      const sh = shared(t.rightNow, t.rightBefore);
      const same = sim >= 0.34 || sh.length >= 2;
      const earlier = seen.find((x) => jacc(t.rightNow, x) >= 0.5);
      if (same) stuck++;
      if (earlier && !same) repeatAny++;
      if (WINS.has(t.grade)) { winsN++; if (same) winRepeat++; }
      seen.push(t.rightNow);
      if (t.offscript) {
        offN++;
        const words = content(t.plan).filter((w) => w.length > 3);
        const hit = words.filter((w) => content(`${t.outcome} ${t.scene}`).includes(w));
        t.offFollowedLex = hit.length >= Math.min(2, words.length);
        if (t.offFollowedLex) offFollowed++;
      }
      t.stuckLex = same;
      t.sharedWords = sh;
      rows.push({ game: g.game, k: t.k, grade: t.grade, before: t.rightBefore, after: t.rightNow, same, sh: sh.join(",") });
    }
  }
  // Endings: pairwise similarity, same story and across all.
  const ends = games.map((g) => ({ game: g.game, story: g.story, text: g.finale.ending }));
  let pairs = 0, simSum = 0, maxSim = 0, maxPair = "";
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    if (ends[i].story !== ends[j].story) continue;
    const s = jacc(ends[i].text, ends[j].text); pairs++; simSum += s;
    if (s > maxSim) { maxSim = s; maxPair = `g${ends[i].game}/g${ends[j].game}`; }
  }
  return { turns, stuck, stuckPct: turns ? Math.round((100 * stuck) / turns) : 0, repeatEarlier: repeatAny, winsN, winRepeat, offN, offFollowed, fallbacks, endingSameStoryPairs: pairs, endingMeanJaccard: pairs ? +(simSum / pairs).toFixed(2) : 0, endingMaxJaccard: +maxSim.toFixed(2), endingMaxPair: maxPair, earlyFinales: games.filter((g) => g.earlyFinale).map((g) => `g${g.game}@T${g.earlyFinale}`), rows };
}

// ---------------------------------------------------------------- run
// Seats: 36-40 personas play; all 100 later rate (each game's players rate their own game, the rest are spread evenly).
const order = [...PERSONAS].sort(() => rnd() - 0.5);
let cursor = 0;
const seatsFor = PLAN.map(([, n]) => order.slice(cursor, (cursor += n)));
const raters = PLAN.map((_, i) => [...seatsFor[i]]);
for (const p of order.slice(cursor)) { const i = raters.reduce((m, r, j) => (r.length < raters[m].length ? j : m), 0); raters[i].push(p); }

const t0 = Date.now();
const games = new Array(PLAN.length);
let next = 0;
await Promise.all(Array.from({ length: Math.min(PAR, PLAN.length) }, async () => {
  while (next < PLAN.length) {
    const i = next++;
    try { games[i] = await playGame(i, PLAN[i], seatsFor[i]); } catch (e) { console.log(`game ${i + 1} failed: ${e}`); }
    if (games[i]) {
      fs.writeFileSync(path.join(OUT, `game-${String(i + 1).padStart(2, "0")}.json`), JSON.stringify(games[i], null, 1));
      fs.writeFileSync(path.join(OUT, `game-${String(i + 1).padStart(2, "0")}.md`), transcript(games[i]));
    }
  }
}));
const done = games.filter(Boolean);
const c = checks(done);
fs.writeFileSync(path.join(OUT, "personas.json"), JSON.stringify(PERSONAS, null, 1));
fs.writeFileSync(path.join(OUT, "raters.json"), JSON.stringify(raters.map((r, i) => ({ game: i + 1, raters: r.map((p) => ({ ...p, card: personaCard(p), played: seatsFor[i].includes(p) })) })), null, 1));
fs.writeFileSync(path.join(OUT, "checks.json"), JSON.stringify({ label: LABEL, museCalls, minutes: +((Date.now() - t0) / 60000).toFixed(1), ...c }, null, 1));
for (const g of done) fs.writeFileSync(path.join(OUT, `game-${String(g.game).padStart(2, "0")}.json`), JSON.stringify(g, null, 1));
console.log(`\n${LABEL}: ${done.length} games, ${c.turns} turns, stuck (lexical) ${c.stuck} (${c.stuckPct}%), wins that repeated the objective ${c.winRepeat}/${c.winsN}, off-script followed ${c.offFollowed}/${c.offN}, fallbacks ${c.fallbacks}, same-story ending Jaccard mean ${c.endingMeanJaccard} max ${c.endingMaxJaccard} (${c.endingMaxPair}), Muse calls ~${museCalls}, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
