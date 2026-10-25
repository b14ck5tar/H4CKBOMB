// Pre-generate clean openers for every story in game/src/data/story_library.json (no time pressure, high effort,
// retried until clean). The dev server saves each clean one into the library file; commit the file afterwards.
// Start a dev server first (Windows cmd):  set NEXT_DIST_DIR=.next-story&& npm --prefix game run dev -- -p 3090
// Then:  node scripts/pregen-openers.mjs [http://localhost:3090] [--force] [--only=id1,id2]
// Cost: 1-4 Muse calls per story (high effort). No SerpApi calls.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const BASE = args[0] || "http://localhost:3090";
const FORCE = process.argv.includes("--force");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);
const FILE = new URL("../game/src/data/story_library.json", import.meta.url);
const PARALLEL = 2;

const lib = JSON.parse(readFileSync(FILE, "utf8"));
const todo = lib.stories.filter((s) => (ONLY ? ONLY.includes(s.id) : FORCE || !s.opener));
console.log(`${todo.length} of ${lib.stories.length} stories to pre-generate`);

const results = [];
const queue = [...todo];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const t = Date.now();
      try {
        const res = await fetch(`${BASE}/api/story/opener`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Rated for the youngest group it suits, so the stored opener is reusable by every older group too.
          body: JSON.stringify({ mode: "news", rating: s.rating, party: [], source: s, pregen: true }),
          signal: AbortSignal.timeout(360_000),
        });
        const r = await res.json();
        const clean = r.safe && !r.fallback && !(r.meta?.problems ?? []).length;
        results.push({ id: s.id, clean, ms: Date.now() - t, attempts: r.meta?.attempts, problems: r.meta?.problems ?? [], o: r.opener });
        console.log(`${clean ? "CLEAN" : "NOT CLEAN"}  ${s.id} (${Math.round((Date.now() - t) / 1000)} s, ${r.meta?.attempts} tries)  ${r.opener?.quest_title ?? ""}`);
        if (r.opener) console.log(`   ${r.opener.teaser}\n   ${r.opener.narration}`);
        if (!clean) console.log(`   problems: ${(r.meta?.problems ?? []).join(" | ") || (r.fallback ? "fallback" : r.message)}`);
      } catch (e) {
        results.push({ id: s.id, clean: false, problems: [String(e)] });
        console.log(`FAILED  ${s.id}: ${e}`);
      }
    }
  }),
);
await new Promise((r) => setTimeout(r, 2000)); // let the server finish writing the file
const after = JSON.parse(readFileSync(FILE, "utf8"));
console.log(`\nclean: ${results.filter((r) => r.clean).length}/${results.length}; library openers stored: ${after.stories.filter((s) => s.opener).length}/${after.stories.length}`);
