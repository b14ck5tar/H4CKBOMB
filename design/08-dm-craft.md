# 08 — DM Craft: What Great DMs Do, and What Our AI DM Should Do Instead

**Playtest (creative director):** *"The character creation is nice, but otherwise the story is way too hard to follow, neither of my answers were selected, it moved too fast, and the AI narration is obvious."*

**Short version.** All four complaints trace to our code, not to Muse: a vote loop where only one action counts per round, auto-advance faster than read-aloud speed, overloaded scene openers with no on-screen goal, and a "storybook narrator" prompt whose examples teach AI rhythm. Fix: **Around the Table** rounds (everyone acts), host-paced reading, a **Quest Board**, and a new VOICE + CRAFT block.

---

## A. Research

### A1. Why people love D&D

- **The fun is social, not the rules.** Gary Alan Fine's ethnography *Shared Fantasy* (U. Chicago Press, 1983) describes gaming groups as social worlds. Players constantly move between the fiction, the game, and being friends at a table. That makes banter and laughter part of the activity, not a distraction from it. [UChicago Press](https://press.uchicago.edu/ucp/books/book/chicago/S/bo5949823.html)
- **Agency, competence, belonging.** In a recent James Cook University qualitative study, 16 practitioners who run therapeutic TTRPG programs tied the benefits to *player agency, creativity and collaborative storytelling*. Those map onto self-determination theory's autonomy, competence and relatedness. [JCU Research Online](https://researchonline.jcu.edu.au/91163/)
- **Different players want different fun.** *Robin's Laws of Good Game Mastering* names seven player types: power gamer, butt-kicker, tactician, specialist, method actor, storyteller, and casual gamer. His "keep it simple" advice: players want only what they need to know, plus a few clearly named NPCs. Quiz them on what they remember, and cut detail when they can't recall it. [Sly Flourish summary](https://slyflourish.com/four_tips_from_robins_laws.html)
  - The D&D DMG's "Know Your Players" section lists eight motivations: acting, exploring, fighting, instigating, optimizing, problem-solving, socializing, and storytelling. [BoLS on the 2024 DMG](https://belloflostsouls.net/?p=555805)
  - Quantic Foundry's 12-motivation model (400k+ gamers) separates *Community*, *Fantasy/Story* and *Design/Discovery*. [GDC Vault](https://gdcvault.com/play/1025742/A-Deep-Dive-into-the) I found no validated Quantic Foundry TTRPG-specific model; their tabletop work was a pilot.
  - For a party game, the audience is mostly Laws' *casual gamer*, *method actor* and *instigator*. They want a laugh, a moment of their own, and to see their idea land.
- **Owning a moment.** Matt Mercer's signature line *"How do you want to do this?"* hands narration to the player at their big moment. [Critical Role wiki](https://criticalrole.fandom.com/wiki/How_do_you_want_to_do_this%3F) Sly Flourish likewise tells GMs to invite players into the narration: killing blows, monster traits, travel events. [Lazy GM Resource Document](https://slyflourish.com/lazy_gm_resource_document.html)
- **Prose isn't what makes it fun.** Sakellaridis (Utrecht MSc thesis, 2024) compared an LLM DM with human DMs. The AI scored *higher* on immersive description, yet players rated humans better on competence and narrative flow. Players also reported that the AI conveyed adventure details unclearly, railroaded, and lacked real threat. [Thesis](https://studenttheses.uu.nl/handle/20.500.12932/47209) · [Wargamer summary](https://www.wargamer.com/dnd/ai-railroads-players)

### A2. What the best DMs actually do

**Keep the story easy to follow**
- **Start in the middle of the action.** "A strong start kicks your game off in the middle of the action." [Sly Flourish](https://slyflourish.com/lazy_gm_resource_document.html)
- **One dramatic question per scene.** The Angry GM defines an encounter as a sequence of actions that answers a dramatic question by resolving conflicts. The question restates the heroes' objective as a yes/no question, e.g. "Does Indy escape the temple?". [The Angry GM](https://theangrygm.com/how-to-build-awesome-encounters/)
- **Short, concrete descriptions.** A fantastic location is an evocative title plus **three short aspects**, not a paragraph. [Sly Flourish](https://slyflourish.com/lazy_gm_resource_document.html)
- **Redundancy beats elegance.** The Three Clue Rule exists because players "will probably miss the first; ignore the second; and misinterpret the third." [The Alexandrian](https://thealexandrian.net/wordpress/1101/roleplaying-games/three-clue-rule-part-3-the-three-clue-rule) Apply that to the goal: say it in the setup, in an NPC line, and on a panel that stays on screen.
- **Name every person and give every monster life.** Ask questions and use the answers. Address the characters, not the players. These are Dungeon World GM principles. [Dungeon World SRD](https://roll20.net/compendium/dw/The%20GM)
- **Plain language helps DMs too.** CALYPSO's DMs wanted plain language; "complex and long prose" overwhelmed them. [Zhu et al., AIIDE 2023](https://arxiv.org/abs/2308.07540)

**Adjudicate so every result means something**
- The Angry GM's procedure:
  1. Get the **intention** (what you want) and the **approach** (how you do it).
  2. Roll only if failure is possible and would change things.
  3. Consequences follow logically from the approach.
  4. Describe the result by restating the player's action, then adding the outcome with "and" or "but." [The Angry GM](https://theangrygm.com/adjudicate-actions-like-a-boss/)
- *Make a move that follows* and *be a fan of the characters* (Dungeon World). Failure changes the situation; it never means "nothing happens."
- Brennan Lee Mulligan: "Rules are important, but they're in service of you and your friends." [Inverse](https://www.inverse.com/article/57426-dimension-20-brennan-lee-mulligan-interview-dungeons-dragons-d-d) He calls his style "80% improv and 20% planning," and prefers an NPC "with a personality ready to go." [TheGamer](https://www.thegamer.com/brennan-lee-mulligan-dm-style-dimension-20-improv-planning/)

**Share the spotlight fairly**
- D&D's core loop: the DM describes, the players say what they do, the DM narrates results. Outside combat, *"the DM ensures that every character has a chance to act."* [D&D Free Rules 2024](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game) **In real D&D, nobody's action gets "not selected."**
- Sly Flourish moves a turn token clockwise, even outside combat, because it "helps you avoid accidentally ignoring quiet players over loud ones." [Sly Flourish](https://slyflourish.com/track_turns_the_shadowdark_way.html)

**Pace it**
- Alternate tension and relaxation, and expect 1–2 scenes per hour of play. [Sly Flourish](https://slyflourish.com/lazy_gm_resource_document.html) A real table is slow by design: the pauses are where the jokes happen.
- **Reading speed:** adults average 238 wpm reading non-fiction silently, 260 wpm for fiction, and only **183 wpm reading aloud**. [Brysbaert 2019, J. Memory & Language](https://doi.org/10.1016/j.jml.2019.104047) A TV that people read to each other runs at read-aloud speed or slower.

### A3. Why AI DMs sound like AI

| Tell | Evidence |
|---|---|
| "AI vocabulary": *tapestry, testament, delve, intricate, vibrant, pivotal, nestled, in the heart of, stands as* | Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing). Measured "excess vocabulary" surge after ChatGPT in 14M abstracts: [Kobak et al.](https://arxiv.org/abs/2406.07016) |
| Rule of three, "not X but Y" negative parallelism, em-dash rhythm | [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) |
| Ending every turn with a prompt or question | User complaints: [OpenAI forum](https://community.openai.com/t/anyone-get-annoyed-at-chatgpts-insisent-prompting-at-the-end-of-messages/972796) |
| Same names everywhere: *Elara* (surname often *Vex*) | [TODAY via Yahoo, Dec 2025](https://www.yahoo.com/lifestyle/articles/ai-generated-baby-name-rolls-195619667.html) |
| Sycophancy, which means no stakes and the players always get their way | [Sharma et al., ICLR 2024](https://arxiv.org/abs/2310.13548). D&D agents: "excessive agreement or player flattery" ([CEUR paper](https://ceur-ws.org/Vol-4097/paper7.pdf)). Players found too little threat ([Sakellaridis](https://studenttheses.uu.nl/handle/20.500.12932/47209)) |
| Unclear details, railroading | [Sakellaridis](https://studenttheses.uu.nl/handle/20.500.12932/47209) |

Other common tells (practitioner observation, not formally measured):
- Narrating the heroes' feelings ("courage swells in your heart").
- Stacked adjectives and similes.
- Every paragraph ending on a comic "button" line.
- Paraphrasing a player's idea into fancier words instead of using their words.
- Every line the same length.

**A human DM sounds different:**
- Talks *to* people: present tense, "you," by name.
- Uses plain words and varies the length. Sometimes the whole ruling is "Yeah. It works."
- Reacts to *exactly* what the player said, often quoting it back.
- Uses one specific concrete detail, then lets the NPC react.
- Lets the joke land and moves on.

---

## B. Diagnosis: why the playtest felt the way it did

| Complaint | Cause in our code |
|---|---|
| **"Neither of my answers were selected"** | `host.ts` runs Pitch → Vote → **one winner** → Roll (`endVote()`), and Quick Tale has only **two** pitch rounds (hook and twist; the climax is the Final Roll). With 4 players, the chance that a given player never has their action resolved is (3/4)² ≈ **56%**. With 5 players it is 64%. Losers get "≤8 words each" as a side-beat in `OUTCOME_SYSTEM`, which is a garnish rather than a turn. The vote is "not your own," so you can't even vote yourself back in. |
| **"Moved too fast"** | Every phase runs on a timer: `PITCH_MS` 25 s, `VOTE_MS` 12 s, `ROLL_MS` 10 s, `CATCH_MS` 6 s. Reading time comes from `readMs()` at 330 ms/word (182 wpm) and is **capped at 16 s**, so a 75-word outcome with side-beats shows at **≈280 wpm**. That is faster than average silent reading and 1.5× read-aloud speed. `TypeReveal` spends 380 ms per phrase revealing text *inside* that window. "Continue ▸" can only skip forward; nothing holds, and phones have no Ready button. The Pitch Wall puts up to 4 pitches, stamps and quips on screen for 12 s. |
| **"Too hard to follow"** | `SCENE_SYSTEM` asks for recap + arrival + obstacle + newest complication + seeded twist + NPC line + "end on a question," all in ≤55 words. After narration, the TV shows only an 18-word `situation`. The **quest goal is never on screen during play**: `quest.goal` appears only in the premise, and the top bar shows just the title, Hope and pips. The outcome is in second person to the roller while weaving up to 3 other heroes in third person, so whose turn is it? Each scene introduces new proper nouns (realm, threat, location, NPC). |
| **"AI narration is obvious"** | `DM_CORE` asks for a "cozy grandparent reading a storybook who also does excellent stand-up... Vivid." That is a writing persona, not a person at a table. The few-shot examples use em dashes, "against all odds," hyperbolic similes, and a fixed setup → dash → reversal → button cadence, which the model copies. "Use hero names often" leads to name-stuffing. "End on a question" produces rhetorical questions. `recent_lines` stores only *headlines* (`recentLines.push(out.headline)`), so narration repetition is never checked. There is no banned-word list and no instruction to use the player's own words. |

---

## C. Redesign: **Around the Table**

### C1. The loop (chosen)

**Everyone acts every round.** Each player pitches. Each pitch gets its own verdict and its **own die**. All dice are rolled together, and **one narration** resolves them as a sequence of short per-hero beats.

1. **Set the scene (TV, host-paced).** A recap line, then three short lines: *where you are*, *who's in the way and what they want*, and *what happens if nobody acts*. The Quest Board updates.
2. **Pitch (phones, 30 s, ends the moment everyone's in).** Verdict stamps land on the TV as pitches arrive (unchanged). The **vote becomes Boost:** while waiting, each player can 🔥 one *other* pitch. The most-boosted pitch (≥2 boosts) gets advantage ("The Party Believes!"). That keeps the "no, mine's better" table talk without excluding anyone.
3. **Roll together (phones, 8 s).** Everyone taps ROLL and every die tumbles on the TV at once, the way the Final Roll already works. The host pre-rolls with `d20()` as today, so the outcome call can start while the dice animate.
4. **Catch! (5 s, only if any die failed).** A friend with a Heart can save **one** failed die per round. Pre-roll a reroll for each failed hero, and request an `if_caught` beat in the same call so there's no extra latency.
5. **Around the table (TV, host-paced).** One beat card per hero, revealed one at a time. Each card shows the portrait, **the player's own words in quotes**, the die and band, then a beat of ≤22 words. Order is lowest result to highest, so the round ends on its best moment. Last comes a one-line **wrap** that becomes the new "Right now" on the Quest Board.

**Mechanics per round** (four dice must not drain Hope four times):
- Hope −1 if failures outnumber successes.
- −1 more per *uncaught* natural 1, with a maximum of −2 per round.
- +1 for any natural 20.
- The scene counts as won if any die lands SUCCESS or better.
- Peril and Rescue still work: the next setup centers on the hero in peril, the others' actions count as rescue attempts, and the hero in peril still acts by shouting something desperate.

**Why this design and not the alternatives**
- **Rotating spotlight hero:** with only 2 rounds in the demo and 3–5 players, rotation still leaves 1–3 people without a turn, which is exactly the complaint.
- **AI-assembled "party plan":** the AI paraphrases everyone into one plan. Paraphrase is the strongest AI tell, it blurs authorship, and one die means one owner.
- **Around the Table** is how D&D's own loop works ("every character has a chance to act"). Every player gets a die moment, and every player hears their exact words in the story. It also *removes* a phase (vote → roll) instead of adding one.

### C2. Four-minute demo budget (4 players)

The judging Quick Tale becomes **two Around-the-Table rounds**, and every player acts in both:
- **Hook round.** The seeded twist is revealed in its wrap ("…and that's when the river starts rising").
- **Climax round.** Everyone types a *final move* (20 s), then the existing Final Roll. The epilogue gives each hero one clause built from their final move.

Full Tale keeps Hook, Twist and Climax.

| Segment | Time |
|---|---|
| Join and concepts | 0:45 |
| Card reveal | 0:20 |
| Quest premise (≤35 words, plus Quest Board) | 0:12 |
| Hook: setup 12 s, pitch ~20 s, roll 6 s, 4 beats × 6 s, wrap 4 s | 1:10 |
| Climax: setup 10 s, final move 20 s, Final Roll 8 s, epilogue 20 s | 0:58 |
| Reveal and storybook | 0:20 |
| **Total** | **≈3:45** |

### C3. Pacing rules

1. **Reading phases are host-paced.** These are the premise, setup, beat cards, wrap and epilogue. They advance when the host presses **Continue** (TV button, spacebar or clicker) **or** when every phone taps **Ready ✓** (names tick on the TV).
   - The safety auto-advance is words × 400 ms + 5 s (≈150 wpm with slack for laughing), with no 16 s cap.
   - If ≥2 reactions arrive in the last 2 s, extend 3 s so laughter is never cut off.
2. **Action phases are timed but end early.** Pitch and roll end as soon as everyone has acted. Show "Waiting on Pip…" chips, and buzz the phone at 10 s left.
   - **Nobody is skipped.** A player who times out acts with their top suggestion: "Pip panics and does the first thing that comes to mind."
3. **Narration length:**
   - Setup ≤40 words (3 lines).
   - Beat ≤22 words, about 7 s at read-aloud speed.
   - Wrap ≤15 words.
   - Nothing on the TV should ever need scrolling or need more than 3 lines at once.
4. **Text appears whole**, or fades in line by line in ≤1 s total. If we keep the typewriter, start the timer *after* the reveal finishes.
5. **One focus at a time.** The current beat card is big and the rest are dimmed.

### C4. The Quest Board (always on screen: a TV side strip and the top of the phone)

```
THE QUEST   Get the first bread cart across the bridge.        (≤10 words, set per tale)
RIGHT NOW   Can you get the Wyrm off the last beam?            (dramatic question, per scene)
LAST TIME   Reginald sang. The Wyrm burped rust on him.        (≤12 words)
♥♥♥ Hope    Scene 1 of 2    In peril: Reginald (dangling from the rail)
```

New fields:
- `goal_short` on the quest seed (precomputed).
- `dramatic_question` and `recap` from the scene opener.
- `now` (the wrap) from the outcome.

This is the Three Clue Rule applied to the goal: the setup states it, the NPC line repeats it, and the board keeps it on screen.

### C5. Code changes

- **`rules.ts`:** drop `VOTE_MS`; add `READY_WORD_MS = 400`, `READY_PAD_MS = 5000`; `PITCH_MS = 30_000` with early end.
- **`host.ts`:** `endPitch()` → `startPartyRoll()` (one `makeRoll()` per pitcher); retire `endVote()`/`combine()`; `fetchOutcome()` sends `actions[]` in seat order; `applyOutcome()` aggregates Hope per C1; reading timers go through `advance()` (Continue, all-Ready, or safety timeout); `recentLines` stores narration, not headlines.
- **Phone:** Ready ✓ during reading phases; Boost during pitch.
- **`OUTCOME_SCHEMA`:** `beats: [{hero_id, text, if_caught}]` + `now`; titles and peril per hero.

---

## D. DM prompt rules

### D1. Drop-in VOICE + CRAFT block

This replaces the VOICE section of `DM_CORE`. Keep WORLD and SAFETY. Delete the OUTCOME few-shot examples, or replace them with D2's "after" lines.

```
VOICE: you are a DM talking to friends at a table, not an author writing a book.
- Present tense. Talk to heroes as "you", by name: "Mira, you grab the rope."
- Plain words a ten-year-old knows. Mostly short sentences. Contractions. Vary length; sometimes one word is the whole line.
- Funny like a good DM: deadpan, understatement, NPCs reacting badly, one oddly specific detail. Never explain a joke. Not every beat needs a punchline.
- Use the player's own words. Quote or reuse their key phrase ("You said 'politely.' You are extremely polite."). Never swap their idea for a fancier one.
- Describe only what can be seen, heard or smelled. Never say what a hero feels or thinks; show the world reacting.
- One concrete detail beats three adjectives. At most one adjective per noun. No stacked similes.

CRAFT
- Each scene has ONE goal and ONE obstacle. Say plainly: where you are, who is in the way and what they want, what happens if nobody acts. A player should be able to repeat the goal in one sentence.
- Reuse existing names exactly. At most one new name per scene: short, funny, easy to say aloud ("Gus the Toll-Troll").
- Everyone acts. Give each hero one beat, in the order given, of similar length. Each beat: what they tried, what happened, what changed. Follow with "and" or "but", never "nothing happens".
- Results obey the band exactly. Failure comes from what they tried and changes the situation. Success looks like their plan working the way they said it.
- Keep score: what broke stays broken. Call back earlier moments using the words from canon.
- NPCs want something and say it in their own voice, in one short line.
- End on the situation, not a question. The phones ask the questions.

FORMAT
- No em dashes, semicolons or ellipses (an NPC trailing off is the one exception). No lists of three adjectives. No "not X, but Y". No rhetorical questions.
- Never use any word or phrase in BANNED.
```

*(Block ≈ 340 words.)*

### D2. Before → after

**1. Scene setup**
- **Before (AI):** "The ancient bridge groans beneath a tapestry of rust, its once-proud beams whispering tales of decay. The Rust-Wyrm stirs—a testament to centuries of hunger—its eyes gleaming with otherworldly light. The air is thick with anticipation. What will you do, brave heroes?"
- **After (DM):** "You're at the bridge. It's orange. The whole thing, like a cheese puff. Under it, the Rust-Wyrm is chewing a beam like a breadstick. It sees you. It keeps chewing. One beam left before the bread cart arrives."

**2. A failed roll**
- **Before:** "Undeterred, Reginald's heart swells with courage as he raises his voice in song, a melody that dances through the air like a shimmering ribbon. Alas, the Wyrm is unmoved, and a wave of disappointment washes over him."
- **After:** "Reginald, you sing. Loud. The Wyrm stops chewing and listens to the whole first verse. Then it burps rust in your face. You're orange now. It wants an encore."

**3. A success, using the player's words** (the pitch: "offer the troll a job")
- **Before:** "With a flourish of unparalleled wit, Pip weaves a tapestry of persuasion, and the troll, captivated, grants passage. Their newfound bond stands as a testament to the power of kindness."
- **After:** "Pip, you offer him a job. He takes it. Immediately. The troll is now your intern. He holds the gate open and asks where the snacks are."

### D3. BANNED list (put it in the prompt *and* enforce it in code)

- **Words:** tapestry, testament, delve, intricate, vibrant, pivotal, nestled, ethereal, otherworldly, shimmering, palpable, cacophony, symphony, unwavering, indomitable, undeterred, embark, realm-shaking, ancient (as filler), alas, suddenly.
- **Phrases:** "in the heart of," "the air is thick/heavy with," "a sense of," "a wave of ___ washes over," "heart swells/pounds," "eyes gleaming," "whispers of," "echoes through," "dances (light/shadow)," "little did they know," "against all odds," "fate hangs in the balance," "only time will tell," "stands as," "brave heroes," "adventurers," "What will you do?", "Let's see what happens," "It's not just X, it's Y."
- **Names:** Elara, Lyra, Thorne, Kael, Seraphina, Vex, Voss, Aldric, Zephyr, Nyx, Eldoria, "Whispering ___." Add these to `CHARACTER_SYSTEM` too.
- **Code-side enforcement** in `muse.ts`, after generation:
  - Replace `—` with `. `.
  - If any banned term matches, retry once with "Rewrite without: [matches]". On the second failure, strip the matches.
  - Reject any beat over 22 words.
  - Log the hit rate so we can watch it on demo day.

---

### Sources
Every claim above links inline to its source; all links were located by live search in Oct 2026. Where a source was only seen in search summaries (BoLS on the DMG, the Quantic Foundry tabletop pilot), it is flagged as such or used only for uncontroversial facts.
