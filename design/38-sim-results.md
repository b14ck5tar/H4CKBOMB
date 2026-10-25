# 38: Playtest simulation, baseline (design/35 engine) vs story v3 (Sun Oct 25, ~10:30-11:10)

An outside measurement after Meta's "the game fell apart the moment we started". 100 simulated college students, real
games through the real engine, read and rated by separate reader agents. Harness: `scripts/sim-playtest.mjs`.
Transcripts, ratings and the audit are in the shared notes folder (`sim-baseline/`, `sim-v3/`), not in the repo.

## How it was run
- **Personas:** 100 students with 6 traits (creativity, chaos, engagement, patience, reading attention, gaming), each
  drawn from N(5.5, 2) and clipped to 1-10, from a fixed seed. Derived: typing style (31 sentence / 10 terse / 6
  paragraph plans in the baseline) and an off-script chance (chaos-driven).
- **Games:** the host's judge-mode pipeline, called directly. Opener = Quick Tale `quick_scene`. Per turn: a Muse
  "player" writes the plan in the persona's voice, then `/api/ai verdict`, then a crypto d20 + stat + tier shift
  (`gradeRoll`, same as `host.makeRoll`), then `/api/ai turn`. Finale: everyone proposes and backs a friend's plan
  (random backing), one shared die, then `story_end`. 3-4 players, 4-6 turns. Judge stories (canal-shark, wall-gold,
  norwich-batman) twice each, plus opera-snake, rust-wyrm, hanging-boulder and cornfield-dome.
- **Checks:** code (lexical repeat check on Right now) plus an auditor agent that labels every turn: progressed,
  same objective, undid an earlier success, off-script followed.
- **Ratings:** reader agents (Claude Sonnet, not Muse, so the engine's model never grades itself). Each persona reads
  one transcript as if they had played it, then gives 1-10, one like, one dislike, and followable y/n. The 34 who
  played rate their own game; the rest are spread evenly.
- **Caveats (read these before quoting a number):**
  - Raters read text. They never see the art, voice, music or the TV, which judges loved, so absolute scores
    understate fun. Compare baseline vs v3; don't quote the 1-10 as "how fun it is".
  - The Muse player is wilder than a real table: 38% of plans were ruled `wild`.
  - The finale backing is random, so some finale complaints (ties, "the lazy plan won") are partly a sim artifact.
  - There are no friend suggestions and no table talk.

## Baseline (design/35 engine, `NEXT_PUBLIC_STORY_V2=1`): 10 games, 47 turns, 100 ratings, 171 Muse calls

| Measure | Result |
|---|---|
| Fun, 1-10 | **mean 5.38, median 5, sd 1.46** |
| Rating spread | 2:1, 3:9, 4:20, 5:22, 6:26, 7:15, 8:5, 9:2 |
| By game | shark 4.6 / 4.5, gold 5.5 / 4.8, Batman 5.2 / 6.9, opera 4.9, wyrm 6.1, ice hand 4.8, hatchling 6.5 |
| By persona | enthusiastic 7.3, creative 6.0, average 5.3, chaos 5.1, skimmer 5.1, gamer 4.3, bored skeptic 3.0 |
| Players rating their own game | 5.71 |
| Followable on first hearing | **87%** (the 13 "n" cluster in opera-snake and the second gold-wall game) |
| Turns where the story did NOT progress (auditor) | **30%** (14/47) |
| Turns whose Right now repeats an earlier objective (auditor) | **40%** (19/47) |
| Lexical exact or near repeat of the previous Right now (code) | 9% (4/47): rewording hides most repeats from a word check |
| A success undone later | 2 (both handbag games: caught, then it climbs away again) |
| Off-script plans followed (auditor) | 7/11 became a fact. **But 10/11 off-script plans missed the roll** (ruled wild or miracle, −5 to −8) |
| Miss rate | 55% of turns (PARTIAL 7, SETBACK 9, **DISASTER 10 = 21%**) |
| Ruling tiers | wild 18, solid 16, clever 7, risky 5, miracle 1 |
| Endings for the same story | **Not meaningfully different**: they split on the one finale die (win/lose), not on what players did. Both shark games end "the shark stays, mascot stays". Both handbag games end "the owner catches the bag at the wall". |
| Early finale (progress hit 100) | 2 of 10 games (g4 at turn 3 of 4, g10 at turn 4 of 5) |

### Top likes (clustered, of 100)
1. **Absurd power gags that pay off (~59):** the dough shark luring the crowd, the bee choir, the bag hopping onto
   Batman's head, the snake that votes.
2. **Side-character one-liners and premise hooks (~29):** "I have a grappling hook. It is made of toilet paper.",
   "It does not even have a mouth.", the sheriff's "I would like to keep being right."
3. **Clear goal on screen, short and quick turns (~27).**
4. **The true-story reveal (~19).**
5. **"My dumb plan worked" (~17):** "i go home" and the baby floats after me, "yell at fog open sky" wins the finale.

### Top dislikes (clustered, of 100)
1. **The story circles one objective (~26):** "Five turns to get one bag off a windshield", "the bus stayed stuck for
   three turns", "dough snakes and capes became the answer to everything".
2. **The finale felt arbitrary (~29, partly a sim artifact):** "my plan got zero backing and disappeared", "the
   finale roll of 3 wiped out five turns of work".
3. **The dice feel random and punishing (~22):** three DISASTERs in a row in game 1, and "Rolled a 1 for my big idea".
4. **The AI sands chaos down (~17):** "The DM defanged every wild plan into a mushy dance contest", "couldn't break
   anything", "my paragraph got boiled to one line".
5. **Too much text, or confusing middle lines (~16):** the recap paragraph, "Rebelt the loose bars before count", "a
   bus in a lost-and-found counter?". Also (~16) **the premise hook gets dropped**: "the talking gold never speaks",
   the bridge inspector vanishes.

### The 3 worst stuck moments (verbatim)
1. **Batman, game 6, turns 1-4** (the judges' exact complaint). Right nows: "Grab the bag from the wall" → "Lure
   the bag down from ledge" → "Get the bag off Batman" → "Get the handbag back down to its owner". Turn 3 was IT
   WORKS: "It drops onto his arm, then scrambles straight up onto Batman's head." Every success is reversed,
   because the premise ("wherever it lands, it climbs") makes the loop the story.
2. **Shark, game 1, turns 2-5:** "Free the stuck bus from mud" → "Free the stuck bus from mud" → "Clear sticky dough
   off the bus" → "Unstick riders from seats". The outcome: "They pop at once and coat the bus in sticky dough, so it
   sits lower in the mud." The shark never moves for 4 turns.
3. **Opera snake, game 7, turns 1-4:** "Free Mr. Han from capes" → "Clear dough snakes from rack" → "Drag capes from
   dough snakes" → "Pull capes from hissing dough pile". The Princess hunt is gone for 4 turns.

### What the numbers say (baseline)
- **"Stuck" has two causes, not one.**
  - The fixed finish line (design/37's root cause) keeps every Right now orbiting the same goal.
  - **Misses create self-made messes that become the next objective** (stuck bus, sticky dough, capes). Two of the
    three worst runs are clean-up chains after misses, not a success failing to stick. A miss that makes "clean up
    your own mess" the next goal is as stuck as repeating the goal.
- **The dice punish the very behavior v3 wants to invite.** A `wild` ruling (−5) turns a die of 2-6 into a total of
   1 or less, which is a DISASTER. So 21% of turns were DISASTERs (a fair d20 gives 5% natural 1s), and 10 of 11
   off-script plans missed. Chaos players followed by the text but always losing is why they say "couldn't break
   anything".
- **Endings follow the die, not the players**, so two games of the same story read alike.

### Top 5 fixes, ranked (baseline evidence)
1. **A success is final, and the next beat is a new situation.** Check in code that the next Right now shares no
   object with the one just solved, and retry once if it does (a word check misses rewording, so compare the key
   noun). This is v3's rule 15; verify it holds.
2. **A miss worsens a PRESSURE, never "clean up the mess you made".** The next Right now after a miss must not be
   about an object the hero's own plan created (dough, the bus, capes). It should be the story pressure getting worse
   (v3's pressures fit this exactly).
3. **Soften the dice for wild ideas.** Make DISASTER a natural 1 only, and cap `wild` at −3 (or let wild plans roll
   with no shift and land with a twist). An off-script plan should succeed about half the time, or "the story follows
   you" is a promise the dice break.
4. **The Batman premise is itself a loop** ("wherever it lands, it climbs"). Either the bag stops climbing for good
   once someone catches it, or swap norwich-batman out of the judge top 3 for a story that passed the 8-box
   checklist. Both baseline handbag games had the bag reversed at least once.
5. **The ending comes from the players' choices, not just win/lose.** Pass recent endings and the most memorable
   player choice as the ending's anchor (v3 adds recent_endings). Also cut the recap to one line: it is the most-cited
   "too much text".

## Story v3 (`02470f8`, prod build on :3108): 3 judge games, quick check
_Pending: written when the v3 run and its ratings finish._
