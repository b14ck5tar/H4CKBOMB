# 12 · Art Direction: "Neon Uncanny"

**Goal:** explosive, colorful Muse art for modern urban fantasy: today's real world, where one impossible thing secretly explains a real headline. Spooky-funny (Ghostbusters / Gravity Falls / Stranger Things / Spider-Verse).

**Winner:** **E "Neon Uncanny"**. This is direction B (Spider-Verse comic halftone) plus two rules that made the biggest difference in testing:

1. **Color discipline.** The real world is painted only in indigo night and sodium-orange streetlight. The single impossible element is the only thing that glows hot magenta and electric cyan.
2. **Composition rules.** One focal point in the upper two-thirds, one big silhouette, no more than three major shapes, and a dark, calm lower third.

The result reads from across a room, looks "explosive" without turning to mush, and keeps the supernatural element clearly separate from the ordinary world, which is the whole premise of the game.

Contact sheet: open `design/art/index.html` locally (all 22 test images, with labels and timings). Raw prompts and timings are in `design/art/_log.json`.

---

## 1. Winning strings (copy-paste)

### STYLE
```
Spider-Verse style animated comic art: bold confident ink outlines over painterly brushwork, Ben-Day halftone dots and screentone in the shadows, subtle CMYK misregistration and chromatic aberration on the edges, cinematic camera with a slight dutch tilt, crisp clean graphic shapes, high contrast
```

### COLOR (always append to scenes, covers and moments)
```
Color script: the ordinary real world is grounded and believable, deep indigo night and warm sodium-orange streetlight. The single impossible element keeps its own described materials but is the brightest, most saturated thing in the frame, edged and lit from within by hot magenta and electric cyan glow with acid-yellow sparks, so the eye goes straight to it. It feels awe-inspiring and a little menacing, never cute.
```

### COMPOSITION (scenes)
```
Composition: one clear focal point in the upper two-thirds, one big bold readable silhouette against a simpler background, at most three major shapes, generous negative space; the lower third darker, calm and uncluttered. Include two or three ordinary, specific modern details of this exact place so it feels like a real local-news location.
```

### NEGATIVE (always last)
```
Original fictional characters only, no real people, no celebrities, no logos or brands. No text, no letters, no words, no numbers, no captions, no readable signs, all screens and labels blank, no speech bubbles, no sound-effect lettering, no comic panels or borders, no watermark, no signature. Family-friendly, no gore.
```

Prompt order matters: put `STYLE` first, then the subject, then `COLOR`, `COMPOSITION` and `NEGATIVE`. Muse weights the opening clause heavily.

---

## 2. Per-image-type templates

`{...}` slots come from the quest JSON. Muse returns **2048×1152** when you request `1920x1080`, and **1280×1920** when you request `1024x1536`.

### Scene: hook (1920x1080)
```
{STYLE}. Wide establishing shot at eye level, hook scene, dusk: {location} — {location_description}. The impossible element is only beginning to reveal itself: {threat_partial, e.g. "one huge eye just opening in the shadow beneath the deck"}. No people. {COLOR} {COMPOSITION} {NEGATIVE}
```

### Scene: twist (1920x1080)
```
{STYLE}. Twist scene, midnight, low angle: {location} — {location_description}. Reveal that the impossible element is bigger and stranger than it seemed: {twist_visual}. Quiet ordinary town details below. No people. {COLOR} {COMPOSITION} {NEGATIVE}
```

### Scene: climax (1920x1080)
```
{STYLE}. Climax scene, low heroic angle looking up: {location}. The impossible element at full scale, erupting with light: {threat_description}. This is the most saturated, most explosive image of the tale. No people. {COLOR} {COMPOSITION} {NEGATIVE}
```

### Portrait / player avatar (1024x1536)
```
{STYLE}. Hero portrait: {role}, original fictional young adult with a distinctive look ({2–3 signature traits: hair color+cut, eyewear, one mark}), {expression}, holding {prop}, wearing {outfit}, {one visible supernatural tell, e.g. "tiny magenta and cyan arcs of electricity crackling near the ears"}. Composition: bust portrait, head and shoulders fill the frame, face in the upper half, centered, strong clean silhouette with a bright rim light, against a plain flat solid deep-indigo background with only a few halftone motion streaks behind; the face must read clearly even as a tiny circular avatar. {NEGATIVE}
```
Crop avatars as a circle centered at roughly 50% / 22% (face). Always give **2–3 signature traits**: they are what survive at 56 px and what the edits endpoint locks onto.

### Storybook cover (1024x1536)
```
{STYLE}. Storybook cover art, vertical poster composition, looking up from {vantage}: {iconic image of the tale}. Keep the top fifth as clean empty dark sky for a title to be added later in HTML, and the bottom fifth calm and dark. {COLOR} {NEGATIVE}
```
Never let Muse render the title. Overlay it in HTML/CSS.

### "Moment" art (1920x1080, the uncanny beat)
```
{STYLE}. Uncanny moment, close-up: {ordinary place at an exact odd hour}, where {ordinary objects} behave impossibly: {the one impossible behavior, stated concretely and visually — e.g. "the tumbling clothes form the identical glowing swirl in every round window, the overhead tube lights pulsing like a heartbeat"}. {1–2 abandoned human traces: empty chair, forgotten basket}. No people. {COLOR} {COMPOSITION} {NEGATIVE}
```

### Character placed into a scene (consistency): `/v1/images/edits`
```
images: [{ image_url: "data:image/webp;base64,<portrait>" }]
prompt: Keep the exact same character from the reference image: same face, {signature traits}, same art style. Now show this character in a new wide scene: {scene}. The character stands in the left third of the frame, three-quarter body, {pose}. {STYLE}. {COLOR} {NEGATIVE}
```

---

## 3. Composition and color rules (what testing showed)

- **One glow, one focal point.** When everything was neon (rounds A–D), the impossible element had to compete with the setting. When only the impossible element glows (E), it pops at TV size and the scene reads in under a second.
- **State the material of the impossible element.** The color script alone turned the "copper" serpent pink-red (`E_r2/hook_bridge`). Adding "keeps its own described materials… edged and lit from within" brought the copper and verdigris back (`E_r3/hook_bridge_v3`, `E_r3/twist_watertower`). The round-2 cover serpent came out cartoon-cute, so the final COLOR string adds "awe-inspiring and a little menacing, never cute". That clause has **not been tested yet**, so check it on the first real batch.
- **Don't list example props.** The round-2 phrase "(traffic cones, a parked pickup)" put cones and a pickup into *every* image. Ask instead for "two or three ordinary, specific details of this exact place".
- **The lower third stays dark and calm** for captions and the dice UI. Ask for it explicitly every time. It held in about 80% of the E images.
- **Keep it to three major shapes or fewer**, plus "crisp clean graphic shapes". This is what keeps "explosive" from turning to mush. Direction B's laundromat, which had no such limit, got busy.
- **Make the impossible behavior concrete and visual.** "Lights pulsing like a heartbeat" became literal EKG-shaped light tubes, which is great. Vague phrases produce generic glow.
- **Text leakage.** Machine control panels and signs are where garbled glyphs appear (A and D laundromats, C's neon sign, the edit test). "All screens and labels blank" plus "no readable signs" reduced it. Avoid storefronts and signage-heavy subjects in hooks.
- **Photoreal people (direction C) look like real individuals.** That creates real-person risk for player avatars, so it is avoided.

---

## 4. Contact sheet and scores

Every criterion is scored 1–10: **Wow** (at TV size), **Read** (readability from across a room), **Cons** (style consistency across subjects), **Uncanny** ("could be real but isn't"), **NoText** (absence of text or garbled glyphs), **Avatar** (how well the portrait works as a small phone avatar).

| Dir | What it looked like | Wow | Read | Cons | Uncanny | NoText | Avatar | **Avg** |
|---|---|---|---|---|---|---|---|---|
| **A** Graphic novel (baseline) | Polished neon comic. The bridge has huge copper coils and a cat-eye; the laundromat shows a vortex in every dryer under cyan ripple lights; the barista is a sweaty, panicked comic face on violet. Solid, but magenta is spread over everything, so the impossible element doesn't separate from the world. | 8 | 8 | 8 | 6 | 7 | 8 | **7.5** |
| **B** Spider-Verse halftone | Most energetic. Dutch angles and paint streaks; the bridge serpent floats *around* the bridge rather than beneath it; the laundromat shows star-shaped clothes with burst lines (busy); the barista portrait is excellent, with clear features. | 9 | 8 | 7 | 6 | 9 | 9 | **8.0** |
| **C** Photoreal film still | Most "could be real". Dark serpent coils around a pier, with an eye in the shadow; the laundromat's star-shaped laundry is genuinely eerie. But the images are dark and murky at TV size, there is a garbled neon sign, and the barista looks like a real stranger (avatar and privacy risk). | 6 | 6 | 7 | 9 | 6 | 5 | **6.5** |
| **D** Risograph poster | Gorgeous limited-ink posters with very strong silhouettes. The serpent wraps the bridge in yellow and pink; the laundromat shows yellow star laundry. The grungy texture muddies the portrait at small size; it reads as merch/poster art rather than "this happened". | 8 | 9 | 9 | 6 | 7 | 7 | **7.7** |
| **E** Neon Uncanny (winner) | B plus color script plus composition rules. The glowing eye under an orange truss; a giant electric jellyfish rising from a suburban substation; synchronized galaxy dryers under EKG lights; the water tower hatching like a copper egg; a teal-undercut barista. | 10 | 9 | 9 | 8 | 8 | 9 | **8.8** |

**Runner-up worth keeping:** D (risograph) for the **end-of-game "real headline" reveal card** or merch/share images. Its limited inks contrast nicely with the in-game art.

### Character consistency (edits endpoint)

- **Reference edit** (`E_r3/edit_barista_in_laundromat`, portrait passed as `images[0]`): **identity holds strongly**. The face shape, round glasses, teal undercut with shaved side, freckle pattern, green apron, black headphones and kraft to-go cup all match; it reads as the same person. There was slight style drift: warmer orange fluorescent light, more rendered detail, tiny pseudo-glyphs on the dryer panels.
- **Control, text only** (`E_r3/control_barista_in_laundromat_noref`): the same *costume* (teal undercut, glasses, apron, headphones), but a **different face**: older and gaunter.
- **Recommendation:** generate each player's portrait once, then pass it as the reference to `/images/edits` for any scene featuring that player. Re-state the 2–3 signature traits in the edit prompt and end with the full NEGATIVE.

---

## 5. Recommendations: sizes, speed, cost

**Sizes**

| Request | Muse returns | Use |
|---|---|---|
| `1920x1080` | 2048×1152 webp, ~0.5–1.0 MB | Scenes (hook / twist / climax), moments |
| `1024x1536` | 1280×1920 webp, ~0.5–0.95 MB | Portraits/avatars, storybook cover |

For phones, serve avatars downscaled (for example 256 px) through Next/Image or a pre-resize. A 1 MB original sent per player costs real time on venue Wi-Fi.

**Measured latency** (22 calls, run up to 6 in parallel, no 429s)

| Mode | n | min | median | mean | max |
|---|---|---|---|---|---|
| generations, high, 16:9 | 14 | 11.7 s | 24.9 s | 24.0 s | 36.4 s |
| generations, high, 2:3 | 6 | 15.3 s | 18.0 s | 22.0 s | 37.5 s |
| generations, **low**, 16:9 | 1 | 10.8 s | – | – | – |
| edits (1 reference), high | 1 | 32.0 s | – | – | – |

Latency tracks reasoning output tokens, which ranged from about 1.7k to 4.0k on high and 1.8k on low. "High" is adaptive: simple prompts sometimes finish in about 12 s.

**High vs low reasoning strength.** On the same laundromat prompt, low took 10.8 s and high took 21.7 s. Low gave a clean, on-style, attractive image, but **dropped the specific uncanny idea**: there were no heartbeat lights, and it showed 3 dryers instead of a synchronized row. High rendered the concept literally (EKG-shaped light tubes).

- Use **high** for pre-generated assets: quest scenes, covers, demo content.
- Use **low** only for in-game live generation when the player is waiting (for example portraits at join time, or a "moment" triggered mid-round), and keep those prompts very concrete.
- Kick off live generations early (at the previous beat) so high-strength latency is hidden.

**Cost:** this exploration used 22 images, about $0.22. A full quest (3 scenes, 1 cover, 1 moment, plus 4 portraits) is 9 images, about $0.09.

**Other notes**

- `tool_enablement` was all false and `output_format` was webp throughout. No `revised_prompt` came back, so log your own prompts.
- Overlay all titles and captions in HTML. Never ask Muse for text.
