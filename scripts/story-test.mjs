// Story pipeline smoke test: /api/news once, then openers for 3 news items + 2 personal stories.
// Start a dev server first (Windows cmd):  set NEXT_DIST_DIR=.next-story&& npm --prefix game run dev -- -p 3090
// Then:  node scripts/story-test.mjs [http://localhost:3090] [rating]
// Cost: /api/news is cached 4 h (2 SerpApi calls on a cold cache, 0 after). Each opener is 1-2 Muse calls.

// --news-only skips the personal stories.
const NEWS_ONLY = process.argv.includes("--news-only");
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
const show = (label, r, ms) => {
  line(`\n=== ${label}  (${ms} ms, fallback=${r.fallback}, safe=${r.safe}, grade=${r.meta?.grade}, attempts=${r.meta?.attempts}${r.meta?.facts_fetched !== undefined ? `, article=${r.meta.facts_fetched}` : ""})`);
  if (!r.safe) return line(`  UNSAFE: ${r.message}`);
  const o = r.opener;
  line(`  TITLE:     ${o.quest_title ?? o.title}  [${o.mood ?? "?"}]`);
  if (o.teaser) line(`  TEASER:    ${o.teaser}`);
  line(`  NARRATION: ${o.narration}`);
  line(`  GOAL:      ${o.goal}`);
  line(`  SITUATION: ${o.situation}`);
  if (o.threat) line(`  THREAT:    ${o.threat.name} (${o.threat.pronoun}), ${o.threat.want}`);
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
const picks = pickArg.length
  ? pickArg.map((k) => news.quests.find((q) => q.headline.toLowerCase().includes(k.toLowerCase()))).filter(Boolean)
  : news.quests.slice(0, 3);
const jobs = [
  ...picks.map((q) => opener({ mode: "news", rating: RATING, party, source: q }).then((x) => [`NEWS: ${q.headline}`, x])),
  ...(NEWS_ONLY ? [] : personal).map((p) => opener({ mode: "personal", rating: RATING, party, source: p }).then((x) => [`PERSONAL: ${p.title}`, x])),
  // safety check: must come back safe:false
  ...(NEWS_ONLY ? [] : [0]).map(() => opener({ mode: "personal", rating: RATING, party, source: { author_id: "p3", title: "My ex", setup: "My ex cheated on me so I keyed his car and posted his address online.", steps: "", real_ending: "He called the police." } }).then((x) => ["PERSONAL (should be unsafe)", x])),
];
for (const [label, { r, ms }] of await Promise.all(jobs)) show(label, r, ms);
line(`\ntotal ${Date.now() - t0} ms`);
