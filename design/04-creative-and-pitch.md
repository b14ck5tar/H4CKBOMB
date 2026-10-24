# 04 — Creative Direction & Pitch

## 1. Name

Quick web check on 2026-10-24. "Clear" means no big game or product turned up under that name. Domain availability was NOT checked, so confirm on get.tech before you commit.

| # | Name | Collision check | Notes |
|---|---|---|---|
| 1 | **Once Upon a Roll** | Clear. Only a Twinkl classroom worksheet. | Fits the event theme exactly. Dice + fairytale in one breath. |
| 2 | **Roundtale** | Clear | Round table + tale. Short, ownable. |
| 3 | **Taletable** | Clear. Avoid "Table of Tales" (Tin Man Games owns it). | "Your table, our tales." |
| 4 | Hearthtale | Clear, but sounds like *Hearthstone*. | Cozy. Some trademark-adjacency risk. |
| 5 | Fablecast | No product found, but sits close to Fable Studio (AI TV). | Good for a narrator brand. |
| 6 | Couch Quest | Clear (small Twine folder only) | Very honest, a bit generic. |
| 7 | Hear Ye! | Not checked; probably generic | The town crier tells the news. Clever, hard to search. |
| 8 | Questmates | "Questmate" task app exists | Social, but murky. |
| 9 | Dicebound | **Taken** (Steam roguelike, Q4 2026, plus a dice maker) | Reject. |
| 10 | Nat Twenty Tales | Not checked | Insider-y. Novices won't get "nat." |

**Top 3**
1. **Once Upon a Roll**. *"Tonight's news. Tonight's legend. Roll for it."* Domain: `onceuponaroll.tech`. Long but you can read it out loud, and it's a natural Best Domain pun. Hashtag combo: #OnceUponAHack #OnceUponARoll.
2. **Roundtale**. *"Pull up a chair. The Dungeon Master is already here."* Domain: `roundtale.tech`. Short, looks clean on a QR card.
3. **Taletable**. *"Every table becomes a tale."* Domain: `taletable.tech`.

**Pick: Once Upon a Roll.** Judges at a "Once Upon a Hack" event will smile before you say a word.

---

## 2. Art Direction

### A. "Illuminated Storybook" (RECOMMENDED)
The vibe: a hand-inked manuscript that comes alive. Warm, gold, tactile.

- **Palette:** Parchment `#F4E9D0` · Parchment shade `#E6D3A8` · Iron-gall ink `#2A1E16` · Gilt `#C8952E` · Wax crimson `#A3282E` · Forest `#2E5E4E` · Midnight frame `#161B33`
- **Fonts (Google):** **Cinzel Decorative** for the logo and stamps · **Cinzel** 700 for headings · **EB Garamond** 500 for narration · **Alegreya Sans** 700 for phone buttons and numbers
- **Motifs:** illuminated drop caps, red wax seals (join, success, fail stamps), ribbon bookmarks as turn indicators, quill underlines, gilt corner filigree, deckled page edges, a gold-leaf d20.
- **TV:** a single parchment "page" floating on a midnight vignette. Text is always dark ink on parchment. Minimum sizes are 40px for narration and 64px for headings, readable from about 3 m. The scene art sits on the left page, narration on the right, and player wax seals run along the bottom edge. Max 3 lines of narration on screen at once.
- **Phone:** a "letter" layout. Parchment card, one huge action button (Speak / Type / Roll), and your character's portrait in a gilt oval at the top. Midnight background, so it's comfortable in a dark room.
- **The reveal twist:** the final page tears away and underneath is a stark modern **newsprint clipping** (`#F7F5EF` background, **Libre Caslon Text** headline, **Inter** byline and source). The jump from storybook to real world is itself the punchline.
- **AI image style string** (append to every Muse Image prompt):
  > `storybook illustration, hand-inked sepia linework with warm gouache and watercolor washes on aged parchment, gold-leaf accents, illuminated-manuscript border motifs, soft golden rim light, limited palette of ochre, crimson, forest green and midnight blue, whimsical and hopeful, picture-book composition, no text, no letters, no watermark`
  Add-ons: portraits get `bust portrait inside a gilded oval frame, plain parchment background`. The map gets `top-down hand-drawn fantasy realm map, rivers, forests, tiny villages, compass rose`.

### B. "Neon Grimm" (bold, Jackbox energy)
- **Palette:** Night `#120E2A` · Plum `#2B1B5A` · Hot pink `#FF4F9A` · Cyan `#2EE6D6` · Sun gold `#FFC93C` · Cream `#FFF3DD`
- **Fonts:** **Bungee** for the logo · **Lilita One** for headings · **Rubik** for body
- **Motifs:** sticker-outlined chunky panels with 6px offset shadows, a glossy candy-colored d20, scrolls drawn as speech bubbles, wax seals reimagined as pop badges.
- **TV:** dark plum stage, big cream text, neon glow on the active player. **Phone:** full-bleed color per player (each player gets their own hue) and giant rounded buttons.
- **Image string:** `bold flat vector storybook illustration, thick clean outlines, cel shading, saturated jewel tones, playful exaggerated proportions, glowing magenta and cyan rim light on dark plum, no text, no watermark`

**Why A wins:** the storybook *is* the shareable keepsake, so the whole UI should already look like it. It also makes the newsprint reveal hit hard, it sets you apart from every neon hackathon demo, and dark ink on a light card holds up on a washed-out projector better than neon on near-black does.

---

## 3. Juice: Top 10 Feel Moments

1. **The d20 roll.** The player taps or shakes the phone (DeviceMotion, with a tap fallback) and a gold d20 tumbles on the TV for about 1.4 s. Numbers flicker fast, then slow down (ease-out), and it lands with a *thunk*. The phone buzzes with `navigator.vibrate([20,40,20])` (Android only; iOS gets a visual shake instead). Use real RNG (`crypto.getRandomValues`), never the LLM.
2. **Nat 20.** The screen flashes white-gold, everything goes 0.5 s slow-mo, a choir "ahh" sting plays, gold-leaf confetti falls, and a crimson **LEGENDARY** wax seal slams down with a little camera shake. Long phone buzz: `[100,50,300]`.
3. **Nat 1.** A record scratch, then the die bounces *off the table* out of frame. An ink blot spreads across the screen, wipes away, and a **CATASTROPHE** stamp lands crooked. Everyone laughs. This is your Most Entertaining moment.
4. **Narrator reveal.** The first letter blooms into an illuminated drop cap, then text fades in phrase by phrase (not character by character, which is too slow to read across a table) with soft quill scratches. A "Skip ▸" control stays visible.
5. **Page-turn transitions** between scenes: CSS 3D `rotateY` on the page plus a paper rustle sound.
6. **Emoji reactions** 😂🔥😱🛡️🐉 from the phone bar float up across the TV with wobble and fade. Cap it at 3 per second per player.
7. **Join ceremony.** Each player who joins gets a wax seal stamped with their name and a short trumpet blip. Their portrait then "develops" from a sepia pencil sketch (the placeholder shown while Muse Image renders) to full color, using a blur-to-sharp effect.
8. **Map pin drop.** The realm map unrolls, a pin drops onto the quest site, and a dotted ink trail draws the party's route (SVG `stroke-dashoffset`).
9. **The DM's ruling.** An hourglass flips while Muse Spark thinks, then a stamp lands: **POSSIBLE**, **RISKY · DC 15**, or **IMPOSSIBLE… unless**. The pause before the stamp is the drama.
10. **The headline reveal.** The book closes and the room goes silent for 1 second. The final page tears, the newsprint clipping appears, and the real headline types out with typewriter ticks, followed by the source and date. Then a QR code: "Take your storybook home."

**Free audio:**
- **Kenney.nl** (CC0, no attribution). Use the *Casino Audio* pack for dice, *RPG Audio* for book and page sounds, *Interface Sounds*, and *Impact Sounds*.
- **Freesound.org.** Filter to CC0. CC-BY is fine if you credit it on Devpost. Searches: "paper page turn", "quill writing", "wax seal", "record scratch", "choir ahh".
- **Pixabay Sound Effects** (Pixabay License, no attribution required).
- **Music:** Kevin MacLeod / incompetech, CC-BY 4.0, credit required. Medieval-flavored tracks such as "Master of the Feast", looped quietly at -18 dB.

**Narrator voice (optional, 20 minutes of work):** the browser's built-in `speechSynthesis` (Web Speech API) is free and needs no keys. In Chrome, pick the voice "Google UK English Male" and set `rate 0.95, pitch 0.9`. Add a 🔇 toggle, because the hall is loud and captions are the real channel. Voice *input* is where **Muse Voice Transcribe** comes in: a "🎙 Speak your deed" button on the phone.

---

## 4. Pitch

**Roles:** **CD** = Creative Director, talks and hosts as the "Herald." **ENG** = Engineer, drives the laptop and keeps a hidden hotkey panel (skip to finale, force nat 20/1 for testing only, reroll quest).
**Table setup:** laptop as the TV, a printed QR tent card, a physical giant foam d20 as a prop, and a pre-warmed room already at the quest intro.

### (a) 4-Minute Table Demo

| Time | Who | Beat |
|---|---|---|
| 0:00–0:20 | CD | "Quick question: when did you last play D&D? …Right. It's one of the best ways friends bond, but someone has to spend hours prepping as Dungeon Master, so most groups never play. **We made the AI the Dungeon Master.** Scan this. You're in the party." *(hands over QR card)* |
| 0:20–0:50 | Judges | Scan, then type a one-line hero, e.g. "a retired knight who's afraid of geese." |
| | CD | While portraits develop: "Muse Spark is building your stat card right now, and Muse Image is painting you." *(portraits bloom on TV, judges react)* |
| 0:50–1:25 | ENG | Hits Begin. The map unrolls and the pin drops. |
| | CD | "Every quest is born from **real news this week**. We pull Google News with SerpApi and filter out anything tragic, and then Muse turns it into a fairytale. You won't know what really happened until the end." *(narration: the quest hook)* |
| 1:25–2:25 | Judge | Proposes an action by speaking it (Voice Transcribe) or typing it. |
| | CD | "The DM decides if that's even possible…" *(RISKY · DC 14 stamp)* "…and fate decides the rest. Shake your phone." *(d20 tumbles, result, narrated outcome plus scene illustration)* Everyone throws emoji. |
| 2:25–2:55 | ENG | Skips to the finale with the hotkey. |
| | CD | "Normally the party goes through three escalating twists. We'll fast-forward to the ending." |
| 2:55–3:30 | ENG | The storybook flips through its pages. |
| | CD | "Here's the part people screenshot." *(the page tears, the newsprint appears)* "**This tale was inspired by real events.**" *(the real headline types out)* Pause and let them read it. |
| 3:30–4:00 | CD | "Thirty seconds to start, no DM, no prep, and you just played the news with a stranger. Muse Spark runs the DM brain and the safety filter, Muse Image paints every scene, Muse Voice Transcribe lets you just speak, and SerpApi finds the story. Scan the storybook. It's yours." |

**Rules for the demo:** never type for the judge. If generation stalls past 6 s, CD fills the gap with the Herald voice: "The scribes are inking your likeness…" If Wi-Fi dies, play the backup video and keep narrating over it.

### (b) 60-Second Version (stage)
"D&D is one of the best ways friends bond, but someone has to spend hours prepping as Dungeon Master, so most groups never play. We're **Once Upon a Roll**, and we made the AI the Dungeon Master. Open the laptop, everyone scans a code, type one line like 'a knight afraid of geese,' and Meta's Muse builds your character and paints your portrait. Then the twist: every quest is a real headline from this week's news, filtered for anything tragic and reimagined as a fairytale. A collapsed bridge becomes a dragon nesting in the rubble. You propose anything, the AI rules whether it's possible, and a d20 decides. Roll a 1 and it's chaos. Roll a 20 and it's legend. At the end you get an illustrated storybook, and on its last page: *'This tale was inspired by real events,'* plus the real headline. Game night in thirty seconds, from the couch. Nobody has to be the DM anymore."

### (c) Three Lines to Remember
1. **"Nobody has to be the Dungeon Master anymore."**
2. **"Every quest is today's news, told as a fairytale."**
3. **"Game night in thirty seconds, from the couch."**

### (d) Judge Q&A

- **How do you keep tragic news out?** It's a two-stage filter. First, SerpApi pulls Google News from "lighter" topics (science, infrastructure, animals, community, oddities). Then Muse Spark classifies each story and rejects anything involving deaths, injuries, violence, war, crime victims, disasters with casualties, or divisive politics. It only keeps *repairable* stories: something broke, and a party could fix it. Real people never appear by name; they become archetypes. There's a one-tap "new quest" if anything feels off, and the reveal always links to the source.
- **What about players typing offensive stuff?** Muse Spark screens player input, and the DM steers inappropriate actions back into the story in character instead of repeating them.
- **Why not just use ChatGPT?** ChatGPT is one person talking to a chatbot. This is a *room*. There's shared game state, a turn order, a TV plus phones, real dice randomness (the AI sets the difficulty, it doesn't fake the dice), portraits, a living map, and a keepsake storybook. Nobody at a party wants to pass one laptop around.
- **Where's the connection?** It's co-op, so nobody wins alone. Every turn is a social moment: the room reacts and laughs at a nat 1 together. It removes the biggest barrier to the hobby (the DM's prep time), and the news reveal becomes a conversation starter about the real world.
- **How is Muse used?** **Spark** handles quest generation from the headline, escalating complications, feasibility rulings and DCs, narration, stat cards, and safety screening. **Image** paints portraits, scenes, the realm map, and the storybook cover. **Voice Transcribe** turns speech on the phone into actions. All three are on the critical path of every turn.
- **Business potential?** Party games are a proven category. Revenue options: themed quest packs (holidays, sports season), classroom mode (news literacy for students), and remote play inside Messenger or WhatsApp video calls with storybooks shared to Instagram Stories. Every shared storybook is a free ad.
- **Hallucinations or broken rules?** The game engine owns the HP, turns, and dice. The model only proposes narrative and difficulty, inside a strict JSON schema.
- **What was hardest?** Latency. We hide it with sketch-to-color placeholders and narrated pauses.

### (e) Devpost Outline

**Inspiration (draft):** D&D is one of the best ways friends bond, but it has a bottleneck: somebody has to be the Dungeon Master. That means hours of prep, rules lookups, and voices for every goblin. Most friend groups say "we should play sometime" and never do. Meanwhile we all scroll past the news alone. We wondered: what if the AI took the DM's chair, and what if every adventure came from something that really happened this week? "Once Upon a Hack" gave us the frame. Every headline is a fairytale waiting to happen.

**What it does (draft):** Once Upon a Roll turns any laptop or TV into a game table and every phone into a controller. Players join with a room code and describe a hero in one line. Meta's Muse Spark builds a stat card and Muse Image paints a portrait. The AI Dungeon Master then pulls a real, non-tragic headline via SerpApi's Google News API and reimagines it as a fairytale quest, with escalating complications. Players speak (Muse Voice Transcribe) or type any action, the DM rules on whether it's feasible and sets a difficulty, and a big d20 roll decides the outcome. Nat 1s are spectacular disasters and nat 20s are legendary. The realm map, scene paintings, and narration build up into an illustrated storybook the group can share. Its final page reveals: "This tale was inspired by real events…" along with the real headline.

**Remaining sections (bullets to fill):**
- **How we built it:** stack, room sync, the Muse pipeline, SerpApi plus the filter, real RNG.
- **Challenges:** latency, keeping the narrative coherent, calibrating the safety filter.
- **Accomplishments:** first hackathon for our creative director; strangers laughing at a nat 1.
- **What we learned:** the technical lessons, plus what the CD learned as a first-timer.
- **What's next:** Messenger video-call mode, multi-session campaigns, classroom mode, quest packs.
- Credits: list the CC-BY audio here.

---

## 5. First-Hackathon Survival List (next ~22 h)

**Tonight (Sat)**
- **By 7 PM:** lock the name. Claim the `.tech` domain through the MLH offer (code in the MLH or HackTX Discord). Create the Devpost project draft and add teammates.
- **By 8 PM:** deliver the brand kit to ENG: palette CSS variables, the fonts link, the image style string, the logo set in Cinzel Decorative.
- **Discord:** read #announcements for the **stage-pitch signup** and the **Devpost deadline** (they may come before 2 PM). Post in the team thread: *"Once Upon a Roll: AI Dungeon Master party game where real news becomes fairytale quests. Signing up for 5:30 stage pitch. Targeting Meta, Most Entertaining, Best Pitch, SerpApi, Best Novice."* Ask a mentor or organizer to confirm that both teams' novice status counts.
- Visit the Meta and SerpApi sponsor tables tonight. Ask what impresses them, then use their words in the pitch.
- **11 PM:** first rough read-through of the 4-minute script, even if half the app is mocked.
- Download the sound files, and do a quick pass on each one before wiring it in.

**Sleep:** take a real **4.5 h** (about 1:30 to 6 AM). Stagger it with ENG so someone is always awake. Sleep-deprived pitching is worse than one missing feature.

**Sunday**
- **9 AM:** print 3 QR tent cards, set the phone font sizes, and test on a real projector or TV if one is around.
- **10 AM: FEATURE FREEZE.** Only bug fixes after this.
- **10:30–11:30:** record the **backup demo video** (2:30, screen plus phone picture-in-picture). Make sure it shows: a join, a portrait bloom, a ruling stamp, one nat 20 and one nat 1 (forced via the test hotkey), and the headline reveal. Store it offline on the laptop and on a phone.
- **11:30:** submit to Devpost (video, screenshots, credits). Keep editing until the deadline.
- **12–1:30:** rehearse 5 times. Run 2 with a stranger as the "judge," time every run, and cut anything over 4:00. Then do 2 runs of the 60-second stage version.
- **1:30:** eat, charge everything, bring a phone hotspot as Wi-Fi backup, set out the foam d20 prop. A paper crown or wizard hat for the CD is optional but works for Most Entertaining.
- **2–5 PM judging:** greet every judge with "Want to play?" and hand them the QR first, talk second. Reset the room between judges (ENG keeps the warm room ready). Drink water between tables.
- **5:30:** stage pitch. Deliver the three lines slowly, then end on the reveal screenshot.
