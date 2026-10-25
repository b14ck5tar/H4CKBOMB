# 31 · House style: "Neon Ink"

CD call (Sun ~1:30 AM): the v3 cartoon was too close to Gravity Falls. Of three candidates (A Neon Multiverse, B Neon Noir, C painterly 3D), the CD liked A and B ("a little overly AI but not bad") and dropped C ("so unsettling"). Brief: blend A's lively color, detail and comic energy with B's bold inks, flat neon spot colors, readability and dramatic light, and cut the AI look.

**Result:** Neon Ink. Hand-inked indie comic cover, not a digital painting. Flat matte cel color, solid black shadow shapes, one hard key light plus a magenta/cyan rim, at most 3 neon spot colors on indigo-black and sodium orange, halftone only in shadows and skies, slightly imperfect hand-drawn edges. Test images and the full comparison: `game/public/style-candidates/index.html` (open at `/style-candidates/index.html` on the dev server). Final test: `H_portrait.webp`, `H_scene.webp`. All raw strings: `H_style.json`.

Anti-AI-look levers (all in the strings below): "flat matte cel colors", "no glossy gradients, no plastic shine, no airbrush, no 3D render look, no fine micro texture, no lens blur", "slightly imperfect hand-drawn edges", "limited palette ... at most three neon spot colors", "background crowds simplified into flat silhouette shapes". Not-Gravity-Falls levers: "small graphic eyes (dots, almonds or slits, no shiny highlights)", "eyebrows and mouth doing the acting", "not a TV cartoon with huge round eyes".

## 1. Strings for prompts.ts (story director drops these in)

Prompt order stays: STYLE first, then subject, then COLOR, COMPOSITION, NEGATIVE. The scene/portrait builders do not change shape.

### STYLE (replaces `STYLE`)
```
Hand-inked neon comic illustration: clean, confident brush-ink linework with bold outer contours and thinner inner lines, slightly imperfect hand-drawn edges; simple graphic shapes and big readable silhouettes; flat matte cel colors with one hard shadow tone and bold solid-black shadow shapes on the dark side of every form; one dramatic key light with a hard neon rim light; lively comic energy with a few speed lines, ink spatter and spark marks; sparse Ben-Day halftone dots only in shadows and skies; limited palette: deep indigo-black and warm sodium orange plus at most three neon spot colors (hot magenta, electric cyan, acid yellow). Like a hand-printed indie comic cover, not a digital painting: no glossy gradients, no plastic shine, no airbrush, no 3D render look, no fine micro texture, no lens blur
```

### CHARACTER_STYLE (replaces `CHARACTER_STYLE`)
```
Hand-inked neon comic character design: clean, confident brush-ink linework with bold outer contours and thinner inner lines, slightly imperfect hand-drawn edges, flat matte cel colors with one hard shadow tone and bold solid-black shadow shapes, a hard magenta and cyan neon rim light, sparse halftone dots in the shadows only. Consistent stylized proportions: big head, simple chunky body, strong expressive hands, one clear geometric body shape (bean, pear, rectangle or triangle). Small graphic eyes (dots, almonds or slits, no shiny highlights), expressive eyebrows and mouth doing the acting, simplified angular nose and ears, two or three bold signature features that read at avatar size. Clearly a drawn comic character, not a realistic person and not a TV cartoon with huge round eyes: no realistic faces, skin texture, pores or fur strands, no glossy gradients, no plastic shine, no 3D render look.
```

### Portrait composition (replaces the "Composition: bust portrait ..." sentence inside `portraitPrompt`)
```
Composition: bust portrait, head and shoulders fill the frame, face in the upper half, centered, strong readable silhouette with a bright magenta-cyan rim light, against a plain flat deep-indigo background with a few bold ink speed streaks; limited palette of the character's colors plus at most three neon accents; the face must read clearly as a tiny circular avatar.
```

### COLOR (replaces `COLOR`)
```
Color script: the ordinary real world is flat deep indigo night and warm sodium-orange streetlight with big solid-black shadow shapes. The single impossible element is the brightest thing in the frame, flat neon spot color in hot magenta and electric cyan with acid-yellow ink sparks, so the eye goes straight to it. It feels awe-inspiring and a little menacing, never cute.
```

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

12 new heroes: `game/src/data/quickstart_heroes_v2.json` (same shape as `quickstart_heroes.json`), art at `game/public/heroes/v2/<id>.webp` (512x768). The current code loads `/heroes/<id>.webp`, so wiring v2 in means switching the import and the path (or copying the files up one folder). Contact sheet: `game/public/style-candidates/heroes-v2-contact.webp`.

Stats keep the existing budget: +3/+1/-1 across brave/clever/charming (sum 3 for everyone), each of the 6 orderings used exactly twice.

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

Two heroes were re-rolled once on purpose: Ranger Wren (the first take put a feather on her hat, a stereotype) and Theo (the first take had an exaggerated high-top and gap-tooth grin that read as caricature). Both prompts now avoid that.

## 4. Budget

6 calls for candidates A/B/C + 2 for the Neon Ink test + 12 heroes + 2 re-rolls = 22 Muse image calls.
