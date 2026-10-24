// Pre-generates the 3 scene illustrations for each seed quest (run: node scripts/pregen-scenes.mjs).
// Skips files that already exist (delete a file to repaint it). Hard cap of MAX_REQUESTS API calls per run (budget guard).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "game");
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS ?? 20);
const CONCURRENCY = 5;
const ENDPOINT = "https://api.meta.ai/v1/images/generations";

function readKey() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const m = txt.match(/^\s*MODEL_API_KEY\s*=\s*(.*)\s*$/m);
  if (!m) throw new Error("MODEL_API_KEY not found in .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const KEY = readKey();

// ---- "Neon Uncanny" art direction (design/12-art-direction.md; the lead mirrors these strings in game/src/server/prompts.ts) ----
const STYLE =
  "Spider-Verse style animated comic art: bold confident ink outlines over painterly brushwork, Ben-Day halftone dots and screentone in the shadows, subtle CMYK misregistration and chromatic aberration on the edges, cinematic camera with a slight dutch tilt, crisp clean graphic shapes, high contrast";
const COLOR =
  "Color script: the ordinary real world is grounded and believable, deep indigo night and warm sodium-orange streetlight. The single impossible element keeps its own described materials but is the brightest, most saturated thing in the frame, edged and lit from within by hot magenta and electric cyan glow with acid-yellow sparks, so the eye goes straight to it. It feels awe-inspiring and a little menacing, never cute.";
const COMPOSITION =
  "Composition: one clear focal point in the upper two-thirds, one big bold readable silhouette against a simpler background, at most three major shapes, generous negative space; the lower third darker, calm and uncluttered. Include two or three ordinary, specific modern details of this exact place so it feels like a real local-news location.";
const NEGATIVE =
  "Original fictional characters only, no real people, no celebrities, no logos or brands. No text, no letters, no words, no numbers, no captions, no readable signs, all screens and labels blank, no speech bubbles, no sound-effect lettering, no comic panels or borders, no watermark, no signature. Family-friendly, no gore.";

const KIND_SENTENCE = {
  hook: "Wide establishing shot at eye level, hook scene, dusk.",
  twist: "Twist scene, midnight, low angle. Reveal that the impossible element is bigger and stranger than it seemed.",
  climax: "Climax scene, low heroic angle looking up. The impossible element at full scale, erupting with light. This is the most saturated, most explosive image of the tale.",
};
// Short, specific, ordinary sky/background detail per location, so scenes do not all share one glowing vortex sky.
const SKY = {
  "The Closed Bridge": "overcast dusk sky of flat violet clouds above a bare cottonwood treeline",
  "The Three-Year Detour": "clear starry midnight sky over dark farm fields, one lit gas-station canopy in the distance",
  "The New Span Work Site": "black night sky with a few thin clouds, tall construction cranes silhouetted against it",
  "Mandø White Strand": "wide pale-orange dusk horizon over the flat grey sea, a thin band of low cloud",
  "The Pellet Lab at Aarhus": "midnight outside tall lab windows: a plain dark city sky with a few lit office windows across the street",
  "Tyne Spill Dock": "heavy low rain clouds glowing dull orange from the city lights, a rusty crane silhouette",
  "The Hollow Where It Hung": "narrow strip of dusky blue sky between granite walls, bare birch branches overhead",
  "The Talus Caves": "pitch-black midnight rock ceiling with a thin crack of starry sky far above, frost on the stones",
  "The Smashed Boardwalk": "clear cold midnight with a bright full moon behind pine treetops",
  "Night-Shift Control Room": "dark window showing a plain desert night with a scatter of ordinary stars, a lit desk lamp inside",
  "Listening Shed": "dusk desert sky fading from orange to indigo behind a flat mesa, a lone fence post",
  "The Dish Field": "huge ordinary Milky Way star field over flat desert scrub, no clouds",
  "The Toddler's Pumpkin Patch": "soft dusk sky of peach and blue behind a wooden backyard fence and a porch light",
  "The Weigh-Off Scale": "dark blue evening sky above a white festival tent hung with string lights",
  "Hayride Field at Dusk": "wide Montana dusk sky of streaky orange clouds over a flat stubble field and a far-off grain silo",
  "The Heart on the Beach": "dusk sky fading from orange to indigo over a flat calm sea, the island's single jagged spire far behind",
  "The Tallest Spire": "clear midnight sky with a scatter of ordinary stars and a thin crescent moon behind the rock tower",
  "The Respawn Cliff": "wide black night sea and sky meeting at a low horizon, a few thin silver clouds",
  "The Trail Camera Oak": "dusky blue sky through bare oak branches above rolling coastal grass hills",
  "Pescadero Creek Culvert": "the round culvert mouth framing a strip of foggy midnight sky and black redwood silhouettes",
  "Pigeon Point Bluff": "cold clear midnight over the Pacific with the white lighthouse tower dark against the stars",
  "The Cut Cornfield": "wide flat Minnesota dusk sky of streaky orange and violet over half-harvested corn rows",
  "The Gravel Road Overlook": "huge clear midnight prairie sky full of ordinary stars over flat dark fields",
  "The Grain Elevator": "black night sky with a few low clouds lit dull orange from a distant small-town glow",
};
// Partial reveals for the hook scene (the impossible element only beginning to show itself).
const HOOK_REVEAL = {
  "rust-wyrm": "one huge rust-red eye just opening in the black water beneath the new bridge, a few rust-red teeth glinting at the waterline",
  "billion-pearls": "a few pale glowing beads rolling by themselves up the sand toward a long dark ripple in the shallows, a vast shape only faintly visible under the water",
  "hanging-boulder": "a pale ghostly frost-hand just beginning to unfurl from the granite crack beside the empty socket, thin cold light leaking from the stone",
  "galactic-signal": "a single thin shimmering beam of light just beginning to fall from one patch of sky, a dark hungry ring only faintly visible around a bright star",
  "littlest-gardener": "one green vine tendril glowing faintly as it creeps across the ground toward a single pumpkin, soft light starting to seep from its seams",
  "idle-island": "a single gold ring rising by itself out of the dark surf just beyond the heart of stones, a faint square grid pattern rippling through the waves as if the sea were made of tiles",
  "returned-otter": "two small glowing eyes and a long ribbon of glowing creek water slipping along the muddy bank below the camera, a sleek otter shape only faintly visible inside it",
  "cornfield-dome": "a giant scorched metal dome cracked open like an eggshell in the flattened stalks, a thin light leaking from the crack, a narrow path of bent corn leading away from it",
};

function scenePrompt(s) {
  const hookTwist = s.kind !== "climax";
  const element =
    s.kind === "hook"
      ? `The impossible element is only beginning to reveal itself: ${s.hookReveal}.`
      : s.threat;
  return [
    `${STYLE}.`,
    KIND_SENTENCE[s.kind],
    `${s.location}: ${s.description} Setting: ${s.realm}. Sky and background: ${s.sky}${hookTwist ? ", no swirling vortex in the sky" : ""}.`,
    element,
    "No people.",
    COLOR,
    COMPOSITION,
    NEGATIVE,
  ].join(" ");
}

const seeds = JSON.parse(fs.readFileSync(path.join(GAME, "src/data/seed_quests.json"), "utf8"));
const kinds = ["hook", "twist", "climax"];

const jobs = [];
for (const seed of seeds) {
  const locs = seed.locations;
  const idx = [0, Math.floor(locs.length / 2), locs.length - 1];
  kinds.forEach((kind, i) => {
    jobs.push({
      id: seed.id,
      n: i + 1,
      file: path.join(GAME, "public", "quests", seed.id, `scene_${i + 1}.webp`),
      prompt: scenePrompt({
        kind,
        location: locs[idx[i]].name,
        description: locs[idx[i]].description,
        realm: seed.realm_name,
        threat: seed.the_threat.description,
        sky: SKY[locs[idx[i]].name],
        hookReveal: HOOK_REVEAL[seed.id],
      }),
    });
  });
}

let requests = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callApi(prompt) {
  if (requests >= MAX_REQUESTS) throw new Error("request cap reached");
  requests++;
  return fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "muse-image-1.0",
      n: 1,
      size: "1920x1080",
      response_format: "b64_json",
      output_format: "webp",
      reasoning_strength: "high",
      tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
      prompt,
    }),
  });
}

async function generate(job) {
  let res = await callApi(job.prompt);
  if (res.status === 429 || res.status === 503) {
    await sleep(3000);
    res = await callApi(job.prompt); // single retry
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no b64_json in response");
  fs.mkdirSync(path.dirname(job.file), { recursive: true });
  fs.writeFileSync(job.file, Buffer.from(b64, "base64"));
}

const t0 = Date.now();
const todo = jobs.filter((j) => !fs.existsSync(j.file));
console.log(`${jobs.length - todo.length} exist, ${todo.length} to generate`);

let next = 0;
async function worker() {
  while (next < todo.length) {
    const job = todo[next++];
    const s = Date.now();
    try {
      await generate(job);
      console.log(`ok   ${job.id}/scene_${job.n} (${((Date.now() - s) / 1000).toFixed(1)}s)`);
    } catch (e) {
      console.error(`FAIL ${job.id}/scene_${job.n}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

const manifest = {};
for (const seed of seeds) {
  const list = [1, 2, 3]
    .filter((n) => fs.existsSync(path.join(GAME, "public", "quests", seed.id, `scene_${n}.webp`)))
    .map((n) => `/quests/${seed.id}/scene_${n}.webp`);
  manifest[seed.id] = list;
}
fs.writeFileSync(path.join(GAME, "src/data/quest_images.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`done: ${requests} requests, ${((Date.now() - t0) / 1000).toFixed(1)}s total`);
