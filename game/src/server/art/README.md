# Scene art: the party's heroes painted into the story

Creative director's note: "the art didn't incorporate our characters". This module takes the quest's
pre-painted scene (`public/quests/<id>/scene_N.webp`) and the heroes' portraits, then asks
`muse-image-1.0` (`/v1/images/edits`) to paint those exact cartoon heroes into that exact scene.

## API

`POST /api/scene-art`

```jsonc
// Scene: heroes painted into one story scene (1920×1080 webp)
{
  "questId": "hanging-boulder",
  "sceneIndex": 0,              // 0-based (0 → scene_1.webp), or "quick" (the Quick Tale plate = scene_3.webp)
  "heroes": [                   // max 4 (extra are dropped); order = left to right in the frame
    { "id": "raccoon", "name": "…", "portraitUrl": "/heroes/raccoon.webp", "visual": { "anchor": "…", "outfit": "…", "prop": "…" } },
    { "id": "p_7f3", "portraitUrl": "data:image/webp;base64,…", "visual": "free-text description also works" }
  ],
  "rating": "teens",            // "kids" adds "gentle, nothing scary"
  "moment": "optional: what the heroes are doing (e.g. the outcome line); changes the cache key",
  "quality": "fast",            // optional. Default: "fast" for scenes, "best" for posters
  "sceneUrl": "/…", "sceneText": "…" // optional overrides for quests without a pre-painted plate
}

// Poster: one keepsake cover, all heroes together in the climax scene (1280×1920 webp)
{ "mode": "poster", "questId": "returned-otter", "heroes": [ /* max 6 */ ], "title": "The Creek That Followed" }
```

Response (always 200 unless the input is invalid):

```jsonc
{ "url": "data:image/webp;base64,…", "cached": false, "ms": 16173, "key": "114b3c8f…" }
// on failure/timeout: the original plate, so the table never waits on a broken call
{ "url": "/quests/hanging-boulder/scene_1.webp", "fallback": true, "error": "timed out", "cached": false, "ms": 40012, "key": "…" }
```

`title` is echoed back, never painted (Muse garbles text), so overlay it in HTML.
`GET /api/scene-art` returns the cost counters: `{ calls, ok, failed, hits, shared, totalMs, cachedEntries, inflight }`.

In-process use (server only): `import { paintArt } from "@/server/art/sceneArt"`.

## How it works

- **Refs**, in order: the scene plate (downscaled to 1536×864, or 1280 for posters) followed by each portrait
  (downscaled to fit 512 px). The prompt captions them by index ("Image 1 is the scene… Image 2: a chubby cartoon raccoon…").
- **Cache key** = prompt version + mode + quest + scene + plate hash + **sorted** `heroId:portraitHash` + rating + moment.
  The same party gets the same art in any order, and a repainted hero isn't served stale art.
- **Caches**: an in-memory LRU (40 entries, on `globalThis` so it survives hot reload), then a disk copy in
  `os.tmpdir()/group-project-scene-art/` (free after a dev-server restart). Concurrent requests for the same key share
  one upstream call (`once()`), and a key that failed isn't retried for 2 minutes (each attempt may be billed).
- **Timeouts**: 40 s for a scene, 55 s for a poster. On timeout or error the response returns the plate with `fallback: true`.
- **Security**: refs are only `data:` URLs or `/public` paths (path traversal is rejected; no arbitrary http URLs, which would be an SSRF risk).
  On Vercel, where `public/` isn't on the function's disk, the static file is fetched from `VERCEL_URL`.
- **Cost log**: every upstream call is logged as `[scene-art] CALL #n … / OK … ms / FAIL …`. Each call is one image, about $0.01.

## Best prompt (v2, `prompt.ts`)

Wording that was tested (Sat night, 5 live calls, outputs reviewed by eye):

1. "Image 1 is a finished painting of a story scene (…). Images 2 to N are reference portraits of our cartoon heroes."
2. "Edit Image 1 by adding these heroes… Keep Image 1's composition, camera angle, background, lighting and color palette
   the same… the glowing impossible element still the brightest thing in the frame and not covered by anyone."
3. "The heroes, from left to right: Image 2: {anchor}, wearing {outfit}, holding {prop}. …"
4. **"standing together as a small group on solid ground in the lower middle of the frame (not at the edges)… each casting a
   soft shadow"** plus **"caught mid-reaction… expressive, funny pose… uses their signature prop (aiming it, holding it up,
   hiding behind it), and at least one of them points at it"**
5. **"Paint them into the scene, not pasted on top: the same ink linework, halftone shading and lighting as Image 1…"**
6. `STYLE`, then `NEGATIVE` (imported from `@/server/prompts`).

v1 said only "small-to-mid size… in the foreground, spread apart". With 2 heroes it pushed them to the far edges,
small and pasted on (the crossing guard was floating on a slope). v2 groups them center-frame, interacting with the
impossible element (the raccoon aims his flashlight beam at the frost hand, the barista points). It is a strict improvement.

## Results (5 calls total)

| Case | Quality | Latency | Verdict |
|---|---|---|---|
| hanging-boulder scene 0, raccoon + grandma + barista (v1) | fast | 16.2 s | Scene preserved almost pixel-for-pixel; all 3 recognizable; heroes a bit passive |
| returned-otter quick, crossing-guard + influencer (v1) | fast | 16.2 s | Scene preserved; heroes tiny, at the frame edges, pasted on |
| returned-otter poster, crossing-guard + influencer + substitute | best | 24.5 s | Great keepsake: all 3 recognizable, a real team pose, no text |
| returned-otter quick, same 2 heroes (**v2**) | fast | 17.2 s | Grouped center-frame, holding up the stop paddle and phone at the vortex |
| hanging-boulder scene 0, same 3 heroes (**v2**) | fast | 12.7 s | Best image: flashlight beam on the hand, pointing, gasping; plate intact |

No text or garbled glyphs appeared in any output (name tags and the stop paddle stayed blank). Repeat calls are cache hits
in 3–16 ms, and two simultaneous identical requests made exactly one upstream call.

**Known trade-offs.** The heroes now occupy the lower third that the art direction keeps calm for captions and dice, so
put TV captions on a dark gradient. The poster's "empty top fifth for the title" did **not** hold, because the vortex
filled the sky; put the HTML title on a scrim. Small identity drift is possible (the crossing guard's mirrored sunglasses
became plain glasses), but every hero stayed recognizable.

## Integration suggestions (for whoever owns host.ts / TV.tsx)

- Fire `/api/scene-art` for scene *i+1* as soon as scene *i* starts (about 15 s of latency, hidden). Show the plate until it lands, then cross-fade.
- Quick Tale: one call with `sceneIndex: "quick"` when the cast is locked. Fire the poster at the final roll for the keepsake.
- Send heroes in seat order so left-to-right matches the table. Use `/heroes/<id>.webp` for ready-made heroes and the portrait data URL for custom ones.

Test: `node scripts/art-test.mjs` (see header; hard budget of 6 calls, tracked in a ledger file).
