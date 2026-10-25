// Player-driven tailor test (design/30): does the chosen plan drive the story? Uses a stored story pack (no bible
// call), then runs a few turn-1 plans at different grades through /api/ai "tailor" and prints the result.
//   node scripts/tailor-test.mjs [--story news-7f3160a2ba] [--engine wonder+spark|gpt-4.1]
//   env: LAB_BASE (default http://localhost:3107). ~5 text calls per engine. No keys are read here.
const BASE = process.env.LAB_BASE || "http://localhost:3107";
const argv = process.argv.slice(2);
const flag = (n, d = "") => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const STORY = flag("story", "news-7f3160a2ba");
const ENGINE = flag("engine", "wonder+spark");

const post = async (body) => {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/ai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ...(await r.json()), ms: Date.now() - t0 };
};

const HEROES = { Juno: { power: "Press an ear to any wire and hear what it carries.", weakness: "Tells everyone how each outlet is feeling.", pronouns: "they/them" }, Gus: { power: "Find anything anyone threw away nearby, in seconds.", weakness: "Abandons any post for a dropped pretzel.", pronouns: "he/him" }, Bev: { power: "Raise your paddle and freeze time for three seconds.", weakness: "Spends two of the three seconds deciding.", pronouns: "she/her" } };
const ROWS = { DISASTER: ["worse", 1], SETBACK: ["worse", 3], PARTIAL: ["mixed", 7], PROGRESS: ["better", 12], GREAT: ["better", 18], LEGENDARY: ["legendary", 22] };
const CASES = [
  { hero: "Gus", plan: "challenge the bison mom to a staring contest", attempt: "Gus challenges the bison mom to a staring contest", grade: "PROGRESS", idea_from: "" },
  { hero: "Bev", plan: "freeze time and scoop the dog up", attempt: "Bev freezes time and scoops up the little dog", grade: "GREAT", idea_from: "Juno" },
  { hero: "Juno", plan: "call the family on the lodge phone so they come get her", attempt: "Juno calls the family on the lodge phone", grade: "LEGENDARY", idea_from: "Gus" },
  { hero: "Gus", plan: "climb on the food bin to see better", attempt: "Gus climbs on the food bin for a better look", grade: "SETBACK", idea_from: "Bev" },
  { hero: "Bev", plan: "offer the bison a pile of hay as a trade", attempt: "Bev offers the bison mom a pile of hay as a trade", grade: "PARTIAL", idea_from: "" },
];

const pack = (await post({ task: "story_bible", input: { stored_only: true, cache_key: STORY, turns: 4, rating: "teens" } })).data;
if (!pack?.bible) throw new Error(`no stored pack for ${STORY}`);
const { opener, bible } = pack;
console.log(`STORY ${opener.quest_title}: ${opener.situation} | goal ${opener.goal}\n`);
const ONLY = flag("only", "");
for (const c of CASES.filter((x) => !ONLY || x.grade === ONLY)) {
  const [branch, total] = ROWS[c.grade];
  const won = branch === "better" || branch === "legendary";
  const r = await post({
    task: "tailor",
    input: {
      engine: ENGINE, rating: "teens",
      hero: { name: c.hero, ...HEROES[c.hero] }, attempt: c.attempt, plan: c.plan, idea_from: won ? c.idea_from : "",
      roll: { total, grade: c.grade, branch, depth: 0.5, natural: null },
      situation: opener.situation, right_now: bible.acts[0].goal,
      destination: { goal: bible.finale.goal, lands: bible.endings.triumph.line },
      ahead: [...bible.acts.slice(1).map((a) => a.goal), bible.finale.goal],
      beat: bible.acts[0].outcomes[branch === "legendary" ? "better" : branch],
      next_hero: "Juno", problem: bible.problem, cast: bible.cast, callbacks: bible.callbacks,
      pronouns: Object.fromEntries(Object.entries(HEROES).map(([n, h]) => [n, h.pronouns])),
      real_event: opener.real_setting, motifs_used_tonight: ["sleep", "hum", "glow", "whisper", "pale"],
    },
  });
  const d = r.data ?? {};
  console.log(`${c.grade} ${c.hero}: "${c.plan}" (${r.ms} ms${r.fallback ? ", FALLBACK" : ""})\n  ${d.text}\n  -> ${d.situation}\n  -> now: ${d.now_goal} | steps ${d.steps} | goal_reached ${d.goal_reached}\n`);
}
