// Pull the gated stories a running server is serving into game/src/data/story_library.json (the committed library).
// Dev servers already write new gated stories to the file; use this for a deployed server (read-only disk there).
//   node scripts/story-library.mjs [https://your-deploy.vercel.app]
// Costs nothing extra: /api/news is cached for 4 h, so this never triggers a SerpApi call on a warm server.
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const FILE = new URL("../game/src/data/story_library.json", import.meta.url);

const lib = JSON.parse(readFileSync(FILE, "utf8"));
const byId = new Map(lib.stories.map((s) => [s.id, s]));

const res = await fetch(`${BASE}/api/news?rating=adults`);
if (!res.ok) throw new Error(`GET /api/news: HTTP ${res.status}`);
const { quests = [] } = await res.json();

let added = 0;
let updated = 0;
for (const q of quests) {
  if (q.origin === "curated" || !q.scores) continue; // curated seeds are already in the file
  const old = byId.get(q.id);
  if (old && old.storyability >= q.storyability) continue;
  const { origin: _o, has_opener: _h, ...rest } = q;
  byId.set(q.id, { ...(old ?? {}), ...rest, origin: "news", added_at: old?.added_at ?? new Date().toISOString() });
  old ? updated++ : added++;
}

const stories = [...byId.values()].sort((a, b) => (a.origin === b.origin ? b.storyability - a.storyability : a.origin === "news" ? -1 : 1));
writeFileSync(FILE, `${JSON.stringify({ version: 1, updated: new Date().toISOString(), stories }, null, 1)}\n`);
console.log(`story library: ${added} added, ${updated} updated, ${stories.length} total (${stories.filter((s) => s.origin === "news").length} news, ${stories.filter((s) => s.origin === "curated").length} curated)`);
