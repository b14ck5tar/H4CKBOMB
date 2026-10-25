// Story pipeline smoke test: /api/news once, then openers for 3 news items + 2 personal stories.
// Start a dev server first (Windows cmd):  set NEXT_DIST_DIR=.next-story&& npm --prefix game run dev -- -p 3090
// Then:  node scripts/story-test.mjs [http://localhost:3090] [rating]
// Cost: /api/news is cached 4 h (2 SerpApi calls on a cold cache, 0 after). Each opener is 1-2 Muse calls.

// --news-only skips the personal stories.
const NEWS_ONLY = process.argv.includes("--news-only");
const PERSONAL_ONLY = process.argv.includes("--personal-only"); // skips the news openers
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const BASE = args[0] || "http://localhost:3090";
const RATING = args[1] || "teens";

const party = [
  { hero_id: "p1", name: "Ava", power: "parallel parking" },
  { hero_id: "p2", name: "Ben", power: "talking to dogs" },
  { hero_id: "p3", name: "Cam", power: "finding snacks anywhere" },
];

const personal = [
  {
    author_id: "p1",
    title: "Stuck in Lisbon",
    setup: "My flight home got cancelled in Lisbon late at night, and every hotel near the airport was full.",
    steps: ["I waited two hours in the rebooking line.", "They gave me a meal voucher that only worked at a closed cafe.", "I tried to sleep on a row of metal chairs under a bright light."],
    real_ending: "I slept at the airport on a pile of coats, a cleaner gave me a pastel de nata at 5 am, and I flew home the next afternoon.",
  },
  {
    author_id: "p2",
    title: "The Dog Ate My Keys",
    setup: "The morning of my driving test, my dog ate my car keys.",
    steps: ["I saw the empty key hook and my dog looking guilty.", "The vet said the keys would come out on their own in a day or two.", "My test was in one hour across town."],
    real_ending: "My neighbor drove me to the test in her car, I passed on the first try, and the keys showed up two days later in the backyard.",
  },
];

const line = (s = "") => console.log(s);

// --rate: muse-spark-1.3 scores each news opener 1-5 on "does this feel like being inside the real event?".
// --rate-before=<file.json>: also score an older set [{headline, quest_title, teaser, narration, goal}] for comparison.
// The key is read from .env.local and never printed.
import { readFileSync } from "node:fs";
const RATE = process.argv.includes("--rate");
const BEFORE = process.argv.find((a) => a.startsWith("--rate-before="))?.slice(14);
function museKey() {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return env.match(/^MODEL_API_KEY=(.*)$/m)?.[1]?.trim();
}
async function rateOpener(news, o) {
  const body = {
    model: "muse-spark-1.3",
    reasoning_effort: "low",
    messages: [
      { role: "developer", content: "You judge a party game. Players play a fantasy story based on a real news event, then learn the real story at the end. Rate 1-5: does playing this opener feel like being INSIDE the real event (the same kind of place, the same kinds of people, the same situation and stakes), with only one fantasy twist? 1 = an unrelated metaphor, 3 = loosely related, 5 = clearly the real event plus one twist. Also say if it gives away the headline's surprising fact before the end. Return JSON." },
      { role: "user", content: `REAL HEADLINE: ${news.headline}
REAL SNIPPET: ${news.snippet}

OPENER
title: ${o.quest_title ?? o.title}
teaser: ${o.teaser}
narration: ${o.narration}
goal: ${o.goal}` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "rate", strict: true, schema: { type: "object", additionalProperties: false, required: ["score", "spoils_punchline", "reason"], properties: { score: { type: "integer", enum: [1, 2, 3, 4, 5] }, spoils_punchline: { type: "boolean" }, reason: { type: "string" } } } } },
    max_completion_tokens: 3000,
  };
  const res = await fetch("https://api.meta.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${museKey()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return { score: 0, spoils_punchline: false, reason: `HTTP ${res.status}` };
  return JSON.parse((await res.json()).choices[0].message.content);
}
const show = (label, r, ms) => {
  line(`\n=== ${label}  (${ms} ms, fallback=${r.fallback}, safe=${r.safe}, grade=${r.meta?.grade}, attempts=${r.meta?.attempts}${r.meta?.facts_fetched !== undefined ? `, article=${r.meta.facts_fetched}` : ""})`);
  if (!r.safe) return line(`  UNSAFE: ${r.message}`);
  const o = r.opener;
  line(`  TITLE:     ${o.quest_title ?? o.title}  [${o.mood ?? "?"}]`);
  if (o.teaser) line(`  TEASER:    ${o.teaser}`);
  line(`  NARRATION: ${o.narration}`);
  line(`  GOAL:      ${o.goal}`);
  line(`  SITUATION: ${o.situation}`);
  if (o.problem) line(`  PROBLEM:   ${o.problem.name} (${o.problem.pronoun ?? "no pronoun"}), stakes: ${o.problem.stakes}`);
  if (o.real_setting) line(`  REAL:      ${o.real_setting.place_type} | ${o.real_setting.roles.join(", ")} | ${o.real_setting.situation} | stakes: ${o.real_setting.stakes}
  REAL ARC:  ${o.real_setting.arc.join(" > ")}`);
  if (o.beats?.length) line(`  BEATS:     ${o.beats.join(" > ")}`);
  if (o.npc_line) line(`  NPC:       ${o.npc_line.speaker}: "${o.npc_line.line}"`);
  const e = r.ending_facts;
  if (e?.kind === "news") {
    line(`  OFFICIAL:  ${e.official_line}`);
    line(`  NOW:       ${e.whats_happening_now}`);
  } else if (e) line(`  REAL END:  ${e.real_ending}`);
  if (r.meta?.problems?.length) line(`  PROBLEMS:  ${r.meta.problems.join(" | ")}`);
};

async function opener(body) {
  const t = Date.now();
  const res = await fetch(`${BASE}/api/story/opener`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { r: await res.json(), ms: Date.now() - t };
}

const t0 = Date.now();
const news = await (await fetch(`${BASE}/api/news?rating=${RATING}&debug=1`)).json();
const st = news.stats;
line(`/api/news (${RATING}): ${news.quests.length} quests in ${Date.now() - t0} ms, generatedAt ${news.generatedAt}`);
if (st) line(`  serpapi calls this run: ${st.serpCalls} (editions ${st.editions?.join(",")}), fetched ${st.fetched}, regex ok ${st.regexOk}, enriched ${st.enriched}, classified ${st.classified}, picked ${st.picked}`);
for (const q of news.all ?? news.quests) line(`  - [${q.rating ?? "?"} ${q.oddness ?? ""}] ${q.headline} (${q.place || "?"}; ${q.source}, ${String(q.date).slice(0, 10)})`);
if (st?.rejected?.length) line(`  rejected sample: ${st.rejected.slice(0, 8).map((r) => `${r.title.slice(0, 50)} [${r.reason}]`).join("; ")}`);

// --pick=fossil,elf,moon picks cached headlines by substring (no extra SerpApi calls).
const pickArg = process.argv.find((a) => a.startsWith("--pick="))?.slice(7).split(",").filter(Boolean) ?? [];
const picks = PERSONAL_ONLY ? [] : pickArg.length
  ? pickArg.map((k) => news.quests.find((q) => q.headline.toLowerCase().includes(k.toLowerCase()))).filter(Boolean)
  : news.quests.slice(0, 3);
const jobs = [
  ...picks.map((q) => opener({ mode: "news", rating: RATING, party, source: q }).then((x) => [`NEWS: ${q.headline}`, x])),
  ...(NEWS_ONLY ? [] : personal).map((p) => opener({ mode: "personal", rating: RATING, party, source: p }).then((x) => [`PERSONAL: ${p.title}`, x])),
  // safety check: must come back safe:false
  ...(NEWS_ONLY ? [] : [0]).map(() => opener({ mode: "personal", rating: RATING, party, source: { author_id: "p3", title: "My ex", setup: "My ex cheated on me so I keyed his car and posted his address online.", steps: "", real_ending: "He called the police." } }).then((x) => ["PERSONAL (should be unsafe)", x])),
];
const results = await Promise.all(jobs);
for (const [label, { r, ms }] of results) show(label, r, ms);

if (RATE || BEFORE) {
  const find = (h) => news.quests.find((q) => q.headline === h) ?? { headline: h, snippet: "" };
  const sets = [];
  if (BEFORE) sets.push(["BEFORE", JSON.parse(readFileSync(BEFORE, "utf8")).map((o) => [find(o.headline), o])]);
  if (RATE) sets.push(["AFTER", results.filter(([l, { r }]) => l.startsWith("NEWS") && r.opener).map(([l, { r }]) => [find(l.slice(6)), r.opener])]);
  for (const [name, list] of sets) {
    const scores = await Promise.all(list.map(([n, o]) => rateOpener(n, o)));
    line(`
--- inside-the-real-event rating, ${name} (avg ${(scores.reduce((a, x) => a + x.score, 0) / Math.max(1, scores.length)).toFixed(1)})`);
    scores.forEach((x, i) => line(`  ${x.score}/5 ${x.spoils_punchline ? "[SPOILS]" : ""} ${list[i][0].headline.slice(0, 60)}: ${x.reason}`));
  }
}
line(`\ntotal ${Date.now() - t0} ms`);
