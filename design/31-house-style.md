# 31 · House style: "Neon Ink"

CD call (Sun ~1:30 AM): the v3 cartoon was too close to Gravity Falls. Of three candidates (A Neon Multiverse, B Neon Noir, C painterly 3D), the CD liked A and B ("a little overly AI but not bad") and dropped C ("so unsettling"). Brief: blend A's lively color, detail and comic energy with B's bold inks, flat neon spot colors, readability and dramatic light, and cut the AI look.

**Result:** Neon Ink. Hand-inked indie comic cover, not a digital painting. Flat matte cel color, solid black shadow shapes, one hard key light plus a magenta/cyan rim, at most 3 neon spot colors on indigo-black and sodium orange, halftone only in shadows and skies, slightly imperfect hand-drawn edges. Test images and the full comparison: `game/public/style-candidates/index.html` (open at `/style-candidates/index.html` on the dev server). Final test: `H_portrait.webp`, `H_scene.webp`. All raw strings: `H_style.json`.

Anti-AI-look levers (all in the strings below): "flat matte cel colors", "no glossy gradients, no plastic shine, no airbrush, no 3D render look, no fine micro texture, no lens blur", "slightly imperfect hand-drawn edges", "limited palette ... at most three neon spot colors", "background crowds simplified into flat silhouette shapes". Not-Gravity-Falls levers: "small graphic eyes (dots, almonds or slits, no shiny highlights)", "eyebrows and mouth doing the acting", "not a TV cartoon with huge round eyes".

## 1. Strings for prompts.ts (story director drops these in)

Prompt order stays: STYLE first, then subject, then COLOR, COMPOSITION, NEGATIVE. The scene/portrait builders do not change shape.

### STYLE (replaces `STYLE`)
```
Hand-inked neon comic illustration: clean, confident brush-ink linework with bold outer contours and thinner inner lines, slightly imperfect hand-drawn edges; simple graphic shapes and big readable silhouettes; flat matte cel colors with one hard shadow tone and bold solid-black shadow shapes on the dark side of every form; one dramatic hard key light; lively comic energy with a few speed lines and a little ink spatter; sparse Ben-Day halftone dots only in shadows and skies; limited palette: deep indigo-black and warm sodium orange plus at most three neon spot colors (hot magenta, electric cyan, acid yellow). Like a hand-printed indie comic cover, not a digital painting: no glossy gradients, no plastic shine, no airbrush, no 3D render look, no fine micro texture, no lens blur
```

### CHARACTER_STYLE (replaces `CHARACTER_STYLE`)
```
Hand-inked neon comic character design: clean, confident brush-ink linework with bold outer contours and thinner inner lines, slightly imperfect hand-drawn edges, flat matte cel colors with one hard shadow tone and bold solid-black shadow shapes, a hard magenta and cyan neon rim light, sparse halftone dots in the shadows only. Consistent stylized proportions: big head, simple chunky body, strong expressive hands, one clear geometric body shape (bean, pear, rectangle or triangle). Small graphic eyes (dots, almonds or slits, no shiny highlights), expressive eyebrows and mouth doing the acting, simplified angular nose and ears, two or three bold signature features that read at avatar size. Clearly a drawn comic character, not a realistic person and not a TV cartoon with huge round eyes: no realistic faces, skin texture, pores or fur strands, no glossy gradients, no plastic shine, no 3D render look.
```

### Portrait composition (replaces the "Composition: bust portrait ..." sentence inside `portraitPrompt`)
```
Composition: bust portrait, head and shoulders fill the frame, face in the upper half, centered, strong readable silhouette with a bright magenta-cyan rim light, against a plain, flat, solid dark deep-indigo background with a very subtle darker vignette and nothing else (no streaks, speed lines, swirls, sparkles or glow); limited palette of the character's colors plus at most three neon accents; the face must read clearly as a tiny circular avatar.
```

### COLOR (replaces `COLOR`; v2, no glow)
```
Color script: the ordinary real world is flat deep indigo night and warm sodium-orange light with big solid-black shadow shapes. The impossible thing keeps its own real materials and colors and stands out by shape, scale and one flat neon accent color (only one of hot magenta, electric cyan or acid yellow), never by glowing.
```

### SCENE_RULE (NEW, every scene, lobby and moment prompt, right after the subject and before COLOR)
```
The fantasy twist is a concrete physical object made of the scene's own material (vines knitting a sweater, a mailbox with teeth, a guardrail tied in a bow), drawn solid with ink outlines and flat color, funny and a little unsettling. At most ONE glowing light source in the whole image. No energy swirls, no rings, no beams, no auras, no magic sparkles, no glowing particles, no lightning, no glowing outlines.
```

Scene order: `STYLE. {opener}: {location}. {description} The impossible element: {threat} No people. SCENE_RULE COLOR COMPOSITION NEGATIVE`. When heroes are painted in, also say which single thing is the light source ("The only light source is the combine harvester's headlights").

### COMPOSITION (replaces `COMPOSITION`)
```
Composition: one clear focal point in the upper two-thirds, one big bold readable silhouette against a simpler background, at most three major shapes, generous negative space, background crowds simplified into flat silhouette shapes; the lower third darker and calm. Include two or three ordinary, specific modern details of this exact place so it feels like a real local-news location.
```

### NEGATIVE (unchanged from today)
```
Original fictional characters only, no real people, no celebrities, no logos or brands. No text, no letters, no words, no numbers, no captions, no readable signs, all screens and labels blank, no speech bubbles, no sound-effect lettering, no comic panels or borders, no watermark, no signature. Family-friendly, no gore.
```

## 2. art/* notes

- Heroes painted into scenes (edits with portrait refs): the refs now carry the style, so keep `STYLE` first in the edit prompt and add "keep each hero's design from their reference, drawn with the same consistent stylized proportions". Mixing old v1 portraits with new scenes will pull the look back toward v1: use `/heroes/v2/` portraits for ready-made heroes.
- Custom heroes: `portraitPrompt` with the new `CHARACTER_STYLE` + portrait composition. Old-portrait re-draws (edits) need the lead-in "Completely re-draw the character from the reference image in this style; keep only who they are, not how they were drawn."
- Pre-painted quest scenes in `public/quests/` are still v3. Re-paint the demo quest first if there is budget (3 calls).
- Timings at reasoning high: portraits 11-37 s, scenes ~23 s.

## 3. Ready-made heroes v2

18 new heroes: `game/src/data/quickstart_heroes_v2.json` (same shape as `quickstart_heroes.json`), art at `game/public/heroes/v2/<id>.webp` (512x768). The current code loads `/heroes/<id>.webp`, so wiring v2 in means switching the import and the path (or copying the files up one folder). Contact sheet: `game/public/style-candidates/heroes-v2-contact.webp`.

Stats keep the existing budget: +3/+1/-1 across brave/clever/charming (sum 3 for everyone), each of the 6 orderings used exactly three times.

| id | name | title | power | brave | clever | charming |
|---|---|---|---|---|---|---|
| night-baker | Rosa | of the 3 AM Ovens | Knead to Know: Knead any dough and it rises into the shape of whatever is hiding nearby. | 1 | -1 | 3 |
| crosswalk | Mr. Okafor | Keeper of the Crosswalk | Everybody Stop: Raise the sign and anything moving freezes for three seconds. | 3 | -1 | 1 |
| skater-grandma | Bea | the Skater Grandma | Grind Anything: Skate on any surface: walls, railings, power lines, rooftops. | 3 | 1 | -1 |
| mail-carrier | Dmitri | Neither Rain Nor Sleet | Return to Sender: Knows where any lost object belongs, and can send it back there. | 1 | 3 | -1 |
| dj | DJ Kiko | the Bass Drop | Drop the Beat: One bass drop makes walls, floors and stubborn things wobble loose. | -1 | 1 | 3 |
| nurse | Tamika | the Third-Shift Nurse | Bedside Manner: One calm sentence and anything panicking, from toddlers to poltergeists, settles down. | 1 | -1 | 3 |
| street-magician | The Great Sal | Street Magician | Pick a Card: Whatever card someone picks shows the truth about them. | -1 | 3 | 1 |
| bus-driver | Marisol | of Route 9 | Next Stop: Her bus can stop anywhere she says, even places that aren't on any map. | 3 | 1 | -1 |
| librarian | Mr. Han | Head Librarian | Shh: One shush silences any sound within a block, even ones that shouldn't exist. | 1 | 3 | -1 |
| food-truck-chef | Nadia | of the Midnight Food Truck | Secret Sauce: Anyone, or anything, that tastes her hot sauce has to tell the truth. | -1 | 1 | 3 |
| park-ranger | Ranger Wren | of the Night Trails | Track Anything: Reads footprints, even invisible ones, and knows exactly what left them. | 3 | -1 | 1 |
| chess-champ | Theo | Age 13, Grandmaster (Pending) | Seven Moves Ahead: Sees how the next minute plays out if nobody changes anything. | -1 | 3 | 1 |
| council-kid | Lupe | Councilmember, Age 9 | Motion Carries: Bang her gavel and any argument nearby has to end in a fair vote, even between ghosts. | -1 | 1 | 3 |
| lighthouse-keeper | Augustin | Keeper of the Light | Talk Back to the Fog: Argues with fog, mist or smoke until it gives up and shows what it was hiding. | 3 | 1 | -1 |
| mall-santa | Big Walt | Mall Santa (Off-Season) | Naughty or Nice: One look and he knows exactly what anyone, or anything, secretly wants. | 1 | -1 | 3 |
| beekeeper | Sunny | the Shy Beekeeper | The Hive Knows: Their bees fly anywhere and buzz back exactly what they saw. | 1 | 3 | -1 |
| pigeon | Lou | of the Night Bus | Heard It on the Bus: Knows one secret about every person, and every place, on the route. | -1 | 3 | 1 |
| retired-magician | Mrs. Tanaka | Retired Magician, One Trick | Now You Don't: Makes any one thing vanish. Getting it back depends on whether she remembers where she put it. | 3 | -1 | 1 |

Two heroes were re-rolled once on purpose: Ranger Wren (the first take put a feather on her hat, a stereotype) and Theo (the first take had an exaggerated high-top and gap-tooth grin that read as caricature). Both prompts now avoid that.

## 4. Round 3 (fresh-eyes review, design/29): no more energy swirls

The review found the same glowing magenta/cyan swirl in every painting (the strongest AI tell) and the same hero trio in every lobby painting. Changes:

- **SCENE_RULE** (above): the twist is a solid object made of the scene's own material, with at most one glowing light and no swirls, rings, beams, auras or sparkles. COLOR v2 lets the impossible thing stand out by shape, scale and ONE flat neon accent, never by glowing. STYLE v2 drops the neon rim light and spark marks from scenes. Portraits keep their rim light.
- **Tests** (`game/public/style-candidates/T1_beach.webp`, `T2_laundromat.webp`, prompts in `T_prompts.json`): a bus-sized seal built from beads stacking its nest, and a laundry giant folding chairs. There are no swirls and the twist reads instantly. This is the biggest visual upgrade of the night.
- **6 more heroes** (18 total, one animal: Lou the pigeon). From the coordinator's list, two ideas overlapped with the first 12 (night-bus driver vs Marisol, retired magician vs Sal), so: the night-bus idea became Lou, a pigeon who rides the night bus and knows every rider's secret, and Mrs. Tanaka's one trick is "make one thing vanish, if she remembers where she put it" (Sal's is cards that show the truth). Lou's first prompt ("a french fry held like a cigar") was blocked by Muse's content filter, so the prop is now "carried under his wing".
- **Lobby/attract v2** (`game/public/lobby/v2/{boulder,otter,dome,array,bridge,pumpkin}.webp`, 1920 wide, prompts in `prompts.json`): each uses a different v2 trio (all 18 heroes appear once) and a different curated quest setting, painted with `/images/edits` using the 3 hero portraits as refs. Not wired in yet: `Lobby.tsx` `HERO_ART` still points to `/lobby/*.webp`.
  - boulder: Wren, Mr. Okafor, Bea at Polar Caves (a stone hand puts the boulder back)
  - otter: Augustin, Mrs. Tanaka, Dmitri at Pescadero (the creek flows uphill after an otter)
  - dome: Rosa, Theo, Big Walt in the Minnesota cornfield (the cracked dome, giant footprints)
  - array: DJ Kiko, Sunny, Mr. Han at the VLA (the dishes bend down to look; one sips coffee)
  - bridge: Marisol, Nadia, Lou in Porter, IN (a bite out of the steel railing, the old bridge curled like a tail)
  - pumpkin: Tamika, The Great Sal, Lupe in Hysham, MT (the vines knit around the hay bales)
- **Prompt lesson:** I wrote "top-left quarter calm and dark (a logo sits there)" and Muse painted small fake emblems in 5 of 6 corners. I patched them out locally with flat sky color. Never mention a logo, title or badge in an image prompt: say "the top-left quarter is plain dark sky".
- **Round 4 (CD approved Neon Ink + heroes):** all 18 portraits re-rendered via `/images/edits` on the originals, with only the background changed to plain dark indigo (no streaks). Big Walt's third eye is removed. The characters are unchanged and the filenames are the same. Edit prompt: "Keep the character exactly identical ... Change ONLY the background: plain, flat, solid dark deep-indigo ... Keep only a thin clean rim light on the character's outline." PORTRAIT_COMPOSITION above now asks for the plain background, so new custom heroes match.
- Contact sheets: `game/public/style-candidates/heroes-v2-contact.webp` (18), `lobby-v2-contact.webp`, `round3-contact.webp` (all three together).

## 5. Budget

Round 1: 6 calls (A/B/C). Round 2: 2 (Neon Ink test) + 12 heroes + 2 re-rolls. Round 3: 2 scene tests + 6 heroes (+1 filtered, no image) + 6 lobby = 15. Round 4: 18 background edits. Total 55 Muse image calls.
