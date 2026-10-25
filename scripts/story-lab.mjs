// Story lab (story engine v2, design/30): a blind multi-model test the creative director can play through.
// For 2 real news stories it plays a full mini-game per engine config: story_bible -> 3 tailored turns -> tailored
// ending, through the real API routes (/api/story/opener, /api/ai tasks "story_bible" and "tailor"), with scripted
// plans and fixed rolls so every config faces the same table. Then it writes game/public/story-lab.html, where the
// versions show up as anonymous "Version A/B/C" with Pick buttons and a Reveal.
//
// 1. Start a dev server with its own build folder (Windows cmd):
//      set NEXT_DIST_DIR=.next-lab&& npm --prefix game run dev -- -p 3107
// 2. node scripts/story-lab.mjs [--only fossas] [--engines wonder+spark,spark-high+spark,gpt-4.1] [--fresh]
//    env: LAB_BASE (default http://localhost:3107), LAB_OUT (default <os tmp>/story-lab), LAB_BUDGET (60)
// 3. Open http://localhost:3107/story-lab.html, play it, pick, Reveal, Save (appends to design/30).
//
// Cost: every step is cached in LAB_OUT, so a re-run only pays for what is missing. A ledger stops the run at
// LAB_BUDGET text calls. The news stories are fixed below: no SerpApi calls, ever. No keys are read here.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.LAB_BASE || "http://localhost:3107";
const OUT = process.env.LAB_OUT || path.join(os.tmpdir(), "story-lab");
const BUDGET = Number(process.env.LAB_BUDGET || 60);
fs.mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const flag = (name, dflt = "") => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? dflt : argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
};
const ONLY = flag("only", "");
const ENGINES = flag("engines", "wonder+spark,spark-medium+spark,gpt-4.1").split(",").filter(Boolean);
const FRESH = argv.includes("--fresh");
// --retailor fossas:wonder+spark,...  = keep that game's cached bible, redo only its tailored turns and ending.
const RETAILOR = new Set(flag("retailor", "").split(",").filter(Boolean));

// ---------------------------------------------------------------- budget ledger + cache
const LEDGER = path.join(OUT, "ledger.json");
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : { calls: 0, log: [] };
const spend = (n, what) => {
  if (ledger.calls + n > BUDGET) throw new Error(`budget reached (${ledger.calls}/${BUDGET}) before ${what}`);
  ledger.calls += n;
  ledger.log.push(`${new Date().toISOString()} +${n} ${what}`);
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
};
const cacheFile = (name) => path.join(OUT, `${name.replace(/[^a-z0-9.+-]/gi, "_")}.json`);
const cached = async (name, fn) => {
  const f = cacheFile(name);
  if (!FRESH && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const v = await fn();
  fs.writeFileSync(f, JSON.stringify(v, null, 2));
  return v;
};

async function post(route, body) {
  const t0 = Date.now();
  // A plain controller (not AbortSignal.timeout): a timer that fires after the body is read must not crash the run.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 300_000);
  try {
    const res = await fetch(`${BASE}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`${route} HTTP ${res.status}: ${text.slice(0, 200)}`);
    return { j: JSON.parse(text), ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- the table
const STATS = (b, c, ch) => ({ brave: b, clever: c, charming: ch });
const HEROES = {
  p1: { id: "p1", name: "Juno", power: "Press an ear to any wire and hear what it carries.", flaw: "Tells everyone how each outlet is feeling, mid-sentence.", pronouns: "they/them", stats: STATS(1, 2, 0) },
  p2: { id: "p2", name: "Gus", power: "Find anything anyone threw away nearby, in seconds.", flaw: "Abandons any post for a dropped pretzel.", pronouns: "he/him", stats: STATS(2, 1, 0) },
  p3: { id: "p3", name: "Bev", power: "Raise your paddle and freeze time for exactly three seconds.", flaw: "Spends two of the three seconds deciding what to do.", pronouns: "she/her", stats: STATS(1, 0, 2) },
};
const party = Object.values(HEROES).map((h) => ({ hero_id: h.id, name: h.name, power: h.power }));
const PRONOUNS = Object.fromEntries(Object.values(HEROES).map((h) => [h.name, h.pronouns]));
// design/29 #6: the house's overused motifs, always avoided (the TV adds each earlier game's problem noun).
const MOTIFS = ["sleep", "hum", "glow", "whisper", "pale"];

// Two real stories (from the cached /api/news list, the same ones scripts/story-evals.mjs uses). Plans are casual
// phone typing; attempt = what the ruling would say. total = the final number after stat, credit and tier shift.
const STORIES = [
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
    turns: [
      { hero: "p2", plan: "yell really loud to get everyone's attention", attempt: "Gus yells as loud as he can to get everyone's attention", total: 4, natural: null },
      { hero: "p3", plan: "bribe them with snacks", attempt: "Bev offers them a pile of snacks", credit: "p1", total: 17, natural: null },
      { hero: "p1", plan: "listen to the wires to find out where the problem comes from", attempt: "Juno presses her ear to a wire to hear where the trouble comes from", total: 8, natural: null },
    ],
    finale: { hero: "p3", plan: "lead everyone in total silence for one minute", attempt: "Bev leads the whole group in one minute of total silence", total: 13, natural: null },
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
    turns: [
      { hero: "p3", plan: "dig with my hands", attempt: "Bev digs into the ground with her bare hands", total: 1, natural: 1 },
      { hero: "p1", plan: "sing it a song lol", attempt: "Juno sings it a song", credit: "p2", total: 11, natural: null },
      { hero: "p2", plan: "find a tool someone threw away nearby", attempt: "Gus finds a tool someone threw away nearby", total: 22, natural: 20 },
    ],
    finale: { hero: "p1", plan: "get everyone to lift together on three", attempt: "Juno gets everyone to lift together on three", total: 7, natural: null },
  },
];

// lib/grade.ts, mirrored.
const ROWS = [
  ["DISASTER", 1, 1, "worse", "a spectacular, funny disaster: the problem jumps somewhere worse", "GRIM_BUT_HILARIOUS"],
  ["SETBACK", 2, 5, "worse", "it backfires: the problem escalates into a new place or complication, and the stakes rise", "GRIM_BUT_HILARIOUS"],
  ["PARTIAL", 6, 9, "mixed", "half of it works, and a twist comes with it", "BITTERSWEET"],
  ["PROGRESS", 10, 14, "better", "it works: a good path opens", "TRIUMPHANT"],
  ["GREAT", 15, 19, "better", "it works really well: a great path opens, plus a small bonus the next hero can use", "TRIUMPHANT"],
  ["LEGENDARY", 20, Infinity, "legendary", "better than anyone hoped: a leap forward, and the world reacts", "TRIUMPHANT"],
];
function gradeRoll(t, natural) {
  let total = Math.max(1, Math.round(t));
  if (natural === 1) total = 1;
  if (natural === 20) total = Math.max(20, total);
  const r = ROWS.find((x) => total >= x[1] && total <= x[2]);
  const span = Number.isFinite(r[2]) ? r[2] - r[1] : 0;
  return { grade: r[0], branch: r[3], meaning: r[4], ending: r[5], depth: span ? Math.round(((total - r[1]) / span) * 100) / 100 : 1, total };
}
const BEAT_OF = { worse: "worse", mixed: "mixed", better: "better", legendary: "better" };
const TIER_OF = { TRIUMPHANT: "triumph", BITTERSWEET: "mostly_fine", GRIM_BUT_HILARIOUS: "well_its_a_story" };

// ---------------------------------------------------------------- one story
async function opener(story) {
  return cached(`opener-${story.key}`, async () => {
    spend(3, `opener ${story.key}`); // high + low backup (+ maybe a retry)
    const { j, ms } = await post("/api/story/opener", { mode: "news", rating: "teens", party, source: story.news });
    if (!j.opener) throw new Error(`no opener for ${story.key}`);
    console.log(`[lab] opener ${story.key}: "${j.opener.quest_title}" in ${ms} ms (fallback ${j.fallback})`);
    return { ...j, ms };
  });
}

async function playEngine(story, op, engine) {
  const name = `game-${story.key}-${engine}`;
  let keep = null;
  if (RETAILOR.has(`${story.key}:${engine}`) && fs.existsSync(cacheFile(name))) {
    keep = JSON.parse(fs.readFileSync(cacheFile(name), "utf8"));
    fs.unlinkSync(cacheFile(name));
  }
  return cached(name, async () => {
    const o = op.opener;
    const real_event = o.real_setting;
    if (!keep?.bible) spend(1, `bible ${story.key} ${engine}`);
    const b = keep?.bible ? { j: { data: { bible: keep.bible, meta: keep.bibleMeta } }, ms: keep.bibleMs } : await post("/api/ai", { task: "story_bible", input: { opener: o, real_event, ending_facts: op.ending_facts, news: { headline: story.news.headline, snippet: story.news.snippet, source: story.news.source, place: story.news.place }, party, turns: story.turns.length, rating: "teens", engine, cache_key: `lab-${story.key}`, motifs_used_tonight: MOTIFS } });
    const bible = b.j.data?.bible;
    const bmeta = b.j.data?.meta ?? {};
    if ((bmeta.attempts ?? 1) > 1) spend(bmeta.attempts - 1, `bible retry ${story.key} ${engine}`);
    console.log(`[lab] bible ${story.key} ${engine}: ${b.ms} ms, attempts ${bmeta.attempts}, problems ${(bmeta.problems ?? []).length}${bible ? "" : " (NO BIBLE)"}`);
    if (!bible) return { engine, bible: null, bibleMs: b.ms, bibleMeta: bmeta, turns: [], ending: null };

    const sp = { problem: o.problem?.name ?? "", at_stake: o.problem?.stakes ?? "", ...(o.problem?.pronoun ? { pronoun: o.problem.pronoun } : {}), where: real_event?.place_type ?? "", what_changed: [], memorable: [] };
    let situation = o.situation;
    const turns = [];
    const log = [];
    for (let k = 0; k < story.turns.length; k++) {
      const t = story.turns[k];
      const hero = HEROES[t.hero];
      const g = gradeRoll(t.total, t.natural);
      const act = bible.acts[k];
      const beatKey = BEAT_OF[g.branch];
      const beat = act.outcomes[beatKey];
      const next = k + 1 < bible.acts.length ? bible.acts[k + 1] : bible.finale;
      const won = g.branch === "better" || g.branch === "legendary";
      const nextHero = HEROES[(story.turns[k + 1] ?? story.finale).hero].name;
      spend(1, `tailor ${story.key} ${engine} t${k + 1}`);
      const r = await post("/api/ai", {
        task: "tailor",
        input: {
          engine,
          rating: "teens",
          hero: { name: hero.name, power: hero.power, weakness: hero.flaw, pronouns: hero.pronouns },
          pronouns: PRONOUNS,
          motifs_used_tonight: MOTIFS,
          attempt: t.attempt,
          plan: t.plan,
          idea_from: t.credit && won ? HEROES[t.credit].name : "",
          roll: { total: g.total, grade: g.grade, branch: g.branch, meaning: g.meaning, depth: g.depth, natural: t.natural },
          band: g.grade === "DISASTER" ? "CATASTROPHE" : won ? "SUCCESS" : "FAIL",
          beat,
          act: { situation, goal: act.goal, twist: act.twist },
          next: { situation: next.situation, goal: next.goal },
          next_hero: nextHero,
          problem: bible.problem,
          cast: bible.cast,
          callbacks: bible.callbacks,
          story_so_far: sp,
          earlier: log.slice(-4),
          dont_reuse: log.slice(-6),
          real_event,
        },
      });
      const d = r.j.data ?? {};
      console.log(`[lab]   t${k + 1} ${engine} ${g.grade}: ${r.ms} ms${r.j.fallback ? " (FALLBACK)" : ""}`);
      turns.push({ hero: hero.name, plan: t.plan, credit: t.credit ? HEROES[t.credit].name : "", grade: g.grade, total: g.total, situation, right_now: act.goal, twist: act.twist, beatKey, beat, text: d.text, next_situation: d.situation, now_goal: d.now_goal, why: d.why, ms: r.ms, fallback: !!r.j.fallback });
      log.push(`${hero.name}: ${d.text}`);
      if (d.where) sp.where = d.where;
      if (d.changed) sp.what_changed = [...sp.what_changed, d.changed].slice(-3);
      if (d.memorable) sp.memorable = [...sp.memorable, d.memorable].slice(-3);
      situation = d.situation || next.situation;
    }

    const f = story.finale;
    const fh = HEROES[f.hero];
    const fg = gradeRoll(f.total, f.natural);
    const tier = TIER_OF[fg.ending];
    spend(1, `ending ${story.key} ${engine}`);
    const e = await post("/api/ai", {
      task: "tailor",
      input: {
        kind: "ending",
        engine,
        rating: "teens",
        winner: { name: fh.name, power: fh.power, pronouns: fh.pronouns },
        pronouns: PRONOUNS,
        attempt: f.attempt,
        plan: f.plan,
        roll: { grade: fg.grade, depth: fg.depth },
        tier,
        beat: bible.endings[tier],
        heroes: Object.values(HEROES).map((h) => h.name),
        log,
        problem: bible.problem,
        cast: bible.cast,
        callbacks: bible.callbacks,
        story_so_far: sp,
        real_event,
        players: Object.values(HEROES).map((h) => ({ id: h.id, said: "<player_input></player_input>" })),
      },
    });
    console.log(`[lab]   ending ${engine} ${tier}: ${e.ms} ms${e.j.fallback ? " (FALLBACK)" : ""}`);
    const ed = e.j.data ?? {};
    return {
      engine,
      bible,
      bibleMs: b.ms,
      bibleMeta: bmeta,
      turns,
      finale: { hero: fh.name, plan: f.plan, grade: fg.grade, total: fg.total, tier, situation, right_now: bible.finale.goal, beat: bible.endings[tier] },
      ending: { text: ed.ending, line: ed.line, recap: ed.recap, ms: e.ms, fallback: !!e.j.fallback },
    };
  });
}

// ---------------------------------------------------------------- page + notes
function shuffle(xs) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function writePage(results) {
  const tpl = fs.readFileSync(path.join(ROOT, "scripts", "story-lab.template.html"), "utf8");
  const data = results.map((r) => ({ ...r, order: shuffle(r.games.map((g) => g.engine)) }));
  const html = tpl.replace("/*__LAB_DATA__*/null", JSON.stringify(data).replace(/</g, "\\u003c"));
  fs.writeFileSync(path.join(ROOT, "game", "public", "story-lab.html"), html);
  console.log(`[lab] wrote game/public/story-lab.html`);
}

function writeNotes(results) {
  const md = [];
  for (const r of results) {
    md.push(`\n## ${r.opener.opener.quest_title} (${r.key})\n- Real news: ${r.news.headline} (${r.news.source})\n- Opener: ${r.opener.opener.narration}\n- Situation: ${r.opener.opener.situation} | Goal: ${r.opener.opener.goal} | Beats: ${(r.opener.opener.beats ?? []).join(" > ")}`);
    for (const g of r.games) {
      md.push(`\n### ${g.engine}: bible ${(g.bibleMs / 1000).toFixed(1)} s (${g.bibleMeta?.model ?? "?"}, attempts ${g.bibleMeta?.attempts ?? "?"}, code-check problems ${(g.bibleMeta?.problems ?? []).length})`);
      if (!g.bible) {
        md.push("- NO BIBLE");
        continue;
      }
      md.push(`- Setting: ${g.bible.setting}\n- Rule: ${g.bible.problem.rule}\n- Cast: ${g.bible.cast.map((c) => `${c.name} (${c.role}): "${c.line}"`).join(" / ")}\n- Callbacks: ${g.bible.callbacks.join(" / ")}`);
      g.turns.forEach((t, i) => md.push(`- T${i + 1} ${t.hero} "${t.plan}"${t.credit ? ` (${t.credit}'s idea)` : ""}, ${t.grade} ${t.total}, tailor ${(t.ms / 1000).toFixed(1)} s${t.fallback ? " FALLBACK" : ""}\n  - beat (${t.beatKey}): ${t.beat.text}\n  - **${t.text}**\n  - next: ${t.next_situation} | Right now: ${t.now_goal}`));
      if (g.ending) md.push(`- Finale ${g.finale.hero} "${g.finale.plan}", ${g.finale.grade} ${g.finale.total} -> ${g.finale.tier}, tailor ${(g.ending.ms / 1000).toFixed(1)} s${g.ending.fallback ? " FALLBACK" : ""}\n  - **${g.ending.text}**\n  - Line: ${g.ending.line}\n  - Recap: ${g.ending.recap}`);
    }
  }
  fs.writeFileSync(path.join(OUT, "results.md"), md.join("\n"));
  console.log(`[lab] wrote ${path.join(OUT, "results.md")} (ledger: ${ledger.calls}/${BUDGET} calls)`);
}

// ---------------------------------------------------------------- main
const results = [];
for (const story of STORIES.filter((s) => !ONLY || s.key === ONLY)) {
  const op = await opener(story);
  const games = await Promise.all(
    ENGINES.map((e) =>
      playEngine(story, op, e).catch((err) => {
        console.error(`[lab] ${story.key} ${e} failed: ${err.message}`);
        return null;
      }),
    ),
  );
  results.push({ key: story.key, news: story.news, opener: op, games: games.filter(Boolean) });
}
writePage(results);
writeNotes(results);
