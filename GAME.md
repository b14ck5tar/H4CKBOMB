# Group Project: the main ideas in one place

As of Sun Oct 25, ~5 AM. Where sources disagree, this file follows the **latest** decision; every clash is listed in
"Conflicts found" at the end. Tags show where each fact comes from:
**DEC** = DECISIONS.md (entry time), **picker** = the CD + partner's mechanics picker (claude.ai/artifact/8hutcKYHpzStjyTHHj8r82,
summed up in design/24), **design/NN** = the design doc, **code** = the live code on `rebuild-around-the-table`.

## 1. The pitch

**"Group Project: the one group project where everyone actually shows up."** (DEC Sun 12:30 AM)
A party game: the TV is the table, phones are controllers, Meta's Muse is the Dungeon Master, and every story really
happened, to the world (odd news) or to one of you (a true story). You find out how it really ended at the end. (design/25)

## 2. Meta's judging, and what in the game serves it

Winning Meta's track ("Bringing People Closer Together with AI") is the #1 goal. (DEC Concept, CLAUDE.md)

| Criterion | Weight | What serves it |
|---|---|---|
| Human connection | 30% | Friends suggest moves on your turn; +1 and your name on screen when your idea is used; the TV hands the turn to the next player by name; "tell the table your plan"; one shared shake-together die; "Our stories"; the "Solved by" line from your real talent. (design/24, design/35, design/25) |
| AI essential + well integrated | 25% | Muse judges every plan, writes every turn, writes the openers, gates the news, paints the heroes into each scene, casts the narrator; DM's Notes shows every call. (design/25) |
| Originality | 20% | You play a real event, then "Based on a true story" flips it; your own heroes appear in the art; the narrator is cast per story. (design/25) |
| Working demo | 20% | "The flow should just work really well." A fallback for every AI call, art that never makes you wait, pause on Wi-Fi drop. (DEC Sat 6:30 PM, design/25) |

The Meta judge's three lenses: the flow works, the AI feels like "a magical experience", and how the team used AI to
build it. (DEC Sat 6:30 PM) Submission video: ~30 s problem, ~90 s demo, ~30 s AI role, ~30 s tools. (CLAUDE.md)

## 3. The night, screen by screen

1. **Lobby (TV).** A Jackbox-style title screen crossed with a neon nightclub poster: big dripping logo, big QR + 4-letter
   code, hero cards pop in with sound, a few big setting buttons (Quick or Full; Odd news or Our stories; Kids, Teens or
   Adults), Start appears at 2+ players. (DEC Sat 10 PM, DEC Sat ~6 PM, code host.ts `setSource`)
2. **Hero creation (phone).** Describe your hero in one line plus the optional "What's your secret talent?", or grab a
   ready-made hero card. The portrait paints in the background. (DEC Sat 8 PM, DEC Sun 12:30 AM, code MakeHeroScreen.tsx)
3. **Story pick.** Odd news: 3 headlines shown as fantasy quest cards (no spoilers), everyone taps one, ties broken at random.
   Our stories: everyone privately writes a small true story, then the table votes. (DEC Sat evening, DEC Sat 10 PM, design/24)
4. **The opener.** The scene art appears, the narrator reads the opener while the text appears in sync. The finish line
   ("what solved looks like") stays on screen all game, with a "Right now" step. (design/24, design/35)
5. **Turns.** See sections 4 and 5. The TV says "Sal, tell the table your plan"; friends suggest; the owner picks; Muse
   rules it; the owner swipes up on the phone to throw the die onto the TV; the outcome is narrated with a new painting;
   the next player is handed the turn by name. A progress meter with 3 act dots fills. (design/35, DEC Sun 12:30 AM)
6. **Grand finale.** Everyone proposes a plan, everyone votes (not for their own), and the winning plan rolls one shared
   die that everyone shakes their phone for. (picker, DEC Sat 8 PM, code `VOTE_MS` 20 s)
7. **Ending.** A "Because of you" montage: painted panels that credit every hero by name for what they did and call back
   1-2 funny moments. A clear team ending card: YOU DID IT / MOSTLY FINE / WELL, IT'S A STORY. (DEC Sun 1 AM, design/35, code rules.ts)
8. **"Based on a true story" reveal.** The real article (or the author's real ending), what's happening now in the real
   world, "Solved by Ava's parallel parking and Ben's coffee", then a keepsake link + QR. (design/24, design/35, code host.ts)

## 4. The core mechanics picker (CD + partner, Sat ~8 PM): every question and its answer

The picker had 18 questions. "Picked" is what they ticked plus their note; "Since then" is any later change.
(picker; DEC Sat 8 PM "core loop FINAL"; design/24)

| # | Question | Picked (CD + partner) | Since then |
|---|---|---|---|
| 1 | How you become a hero | Describe your hero in one line + ONE question ("what are you good at"). Power scaling so nobody massively out- or underperforms. Ready-made heroes as the backup, but people should usually make their own. | The question is now "What's your secret talent?" (DEC Sun 12:30 AM). 18 ready-made heroes in Neon Ink (DEC Sun ~2 AM). |
| 2 | Whose action happens | One player per turn. Everyone else suggests, the owner picks. 2-4 players: 2 turns each; 5-8: 1 each. Then one grand finale: everyone proposes, everyone votes, not for their own. | Turns: 2 each at 2-3 players, 1 each at 4+, max 6; bots never own a turn when humans play. (design/35, code `makeTurnOrder`) |
| 3 | Dice | One d20 per action plus modifiers; one shared shake-together die for the finale. "Even a stupid idea can work with a great roll", but stupid plans shouldn't usually work. | No pass/fail line: every total is its own outcome (DEC Sun 12:30 AM). Swipe up to throw. Wild plans need big rolls (DEC Sun 4:15 AM). |
| 4 | Who judges if a plan is reasonable | The AI sets the difficulty with a reason. No more "Convince the DM": it takes your plan literally, at face value. | "Needs 12+" is gone; the TV shows how the plan shifts the roll ("Long shot plan −5"). Playful labels. (code QuickTV.tsx `ShiftBadge`, DEC Sun 4:15 AM) |
| 5 | Where stories come from | Live news from the past week or month, from random places worldwide (creative, little-known), and players' own true stories. | Live news must pass a storyability gate; then a library of gated stories, then curated ones. (DEC Sun 12:30 AM) |
| 6 | Picking tonight's story | Two modes: 3 random headlines and a vote, or "Our stories" where everyone writes their own. | Vote on fantasy quest cards, no spoilers (DEC Sat 10 PM). |
| 7 | How the text is written | Each story starts from a fixed real baseline (the article or the personal story); after each decision the AI branches it into a unique story. | Replaced by the procedural story rules (section 5). (DEC Sun ~2 AM, design/35) |
| 8 | Using each hero's quirk | Only for the turn owner, and only when the plan uses it. | A power makes a plan at most one tier easier, and never wins alone (DEC Sun 4:15 AM, prompts.ts). |
| 9 | Length | 10-15 min, plus a quick version. Turns per player scale with the lobby size. | Full 10-15 min, Quick ~5 min (DEC Sun 12:30 AM). |
| 10 | Connection moments | People talk to convince the turn owner. +1 to the roll if the owner works in part of someone's suggestion. ONE action only (no "if that fails I..."). Shake together for the final roll. No Catch, no Boost, no Mirror, no clues. | Plus hand-off by name, callbacks and the "tell the table" cue (design/35). |
| 11 | Stakes and winning | Team vs. the story: you win or lose together. | Clear team ending card (DEC Sun 12:30 AM). |
| 12 | The ending | "This really happened. Here's the article." + what's happening now in the real world (e.g. the bridge repair and who it affects) + keepsake link and QR. | "Because of you" montage, then "Based on a true story" (DEC Sun 1 AM). |
| 13 | Narration | Text and voice: the text appears as the narrator reads it. Key word: immersion. An 8-year-old must follow it. | 4 voices, the AI casts one per story (section 9). |
| 14 | Art | A new image per decision showing the current situation, heroes painted in if it doesn't slow the game. Never leave players waiting. | Neon Ink house style with a theme per story; the art follows the story (DEC Sun ~2 AM, DEC Sun 4:45 AM). |
| 15 | How players input | Typing (default). | Voice stays optional on the owner's plan form (design/25). |
| 16 | Showing what the AI does | The DM's Notes panel: the AI shows the logical reasoning behind each outcome. | No forced "reason" lines on screen; the outcome is the explanation; "How the AI decided" is optional at the end (DEC Sat 8 PM). |
| 17 | Where you play | One room for the demo; say remote play or screen sharing would be easy. | `/watch` big-screen link exists (design/24). |
| 18 | Pacing | Timers, about a minute per decision. Players who walk away are left out of the story and can rejoin. | Full turn 60 s, Quick Tale 45 s (code rules.ts). Away players' turns are skipped (code host.ts). |

## 5. The procedural story engine (design/35 + CD refinements + Sun 4:15 AM tweaks)

**CD:** "Make rules for how the story is procedurally generated so the AI doesn't spit out nonsense." It replaces story
bibles, pre-written branches and fixed ladder steps. (design/35)

**The one principle: players steer, the DM reacts.** The chosen plan is what happens. There is no script. (design/35)

**Logic chain above all (CD).** Take the action literally, assume it happens the way they wrote it, then ask "what would
realistically follow?" Everything is possible ("that's the fun"); if a player brings in something new, it's real now.
(design/35 CD refinements)

**Fixed at the start** (from the real event): the place, the people, the problem, the stakes, one fantasy twist, and the
finish line. **Generated each turn:** what happened, what changed, the next "Right now". (design/35)

**Kept in code and sent on every call:** where, problem, finish line, progress 0-100, up to 3 side characters, up to 8
facts, one loose end, the last 3 outcomes, 2 funny lines to call back, pronouns. The AI proposes changes; **code checks
and applies them**, so the story can't wander. (design/35, code lib/procedural.ts)

**Every outcome must:**
- Name the plan in plain words (paraphrase, never paste) and contain the player's own key word. (design/35)
- Let the roll set how well it went (section 7). A backfire comes from the plan itself, funnily. (design/35)
- Be 2 sentences, at most 30 words, clear to an 8-year-old; no game words (dice, roll, needs); no made-up terms or odd
  phrasing. Dry, witty, unexpected but it makes sense; humor from the situation, never random props. (design/35)
- Never contradict known facts; nothing achieved is ever undone; wins become facts. (design/35)
- End on a new "Right now": one concrete step, verb first, at most 8 words, never a repeat. (design/35)
- The AI invents at most one new thing per turn on its own; players can add anything. (design/35 CD refinements)

**The CD's Sun 4:15 AM tweaks** (DEC Sun 4:15 AM):
1. **Payoff, but simple beats clever.** "Simple, playable and followable" over "complex and confusing": one plain cause
   and its effect, no wordplay. Example kept in the prompt: "Gus sets up a chessboard in the mud. The bison mom stares at
   it so long that the little dog trots away." (prompts.ts, working copy)
2. **Momentum by default.** Something moves every turn as a logical result of the plan; small is fine, "nothing happens"
   is not. Never invent a random change. (prompts.ts, working copy)
3. **Hybrid progress, tuned to feel 9/10.** The grade sets a guaranteed range and the AI picks inside it by logic, with
   one line on why (shown in DM's Notes). Ranges scale to the game length so the finale lands on time (code lib/procedural.ts
   `PROGRESS_PAR`; tuning script scripts/progress-sim.mjs).
4. **Wild plans need big rolls, and power scaling still applies.** The more far-fetched the plan, the bigger the
   minus; a power helps at most one tier and never wins alone. No hero massively out- or underperforms. (prompts.ts)
5. **Playful difficulty labels**: CLEVER, SOLID, BOLD, LONG SHOT, ONLY A MIRACLE. (code rules.ts, working copy)
6. The 6 AM freeze: decide when we get there.

**Shape:** 3 acts, each a different situation, then the finale. An act ends when a success solves the step, or when its
share of the turns runs out. The opener's fantasy twist must appear in act 2 and the finale. At 100 progress the
finale comes early (at most one turn early, games of 4+ turns). (design/35, code `paceProgress`)

**Speed and safety net:** one Muse call per turn, started the moment the plan is ruled so it hides behind the throw;
one retry if a check fails; otherwise a plan-aware fallback that still names the plan and moves the story ("...and it
backfires: ..."), never "still right there". (design/35, code server/stories/procedural.ts)

## 6. Hero creation and power scaling

- One-line description, or a ready-made hero (18 Neon Ink heroes); the optional "What's your secret talent?" becomes the
  hero's power, stays private, and returns at the reveal ("Solved by..."). (DEC Sun 12:30 AM, DEC Sun ~2 AM, DEC Sat evening)
- Heroes are cartoon characters, never realistic people. (DEC Concept)
- **Equal stat budget in code:** every hero gets +2 / +1 / 0 across Guts, Brains and Charm. The AI only picks which is
  which and writes flavor; it never changes numbers. (design/24, code rules.ts `STAT_BUDGET`)
- A power counts only when it truly applies to the plan, and then makes it at most one tier easier. (DEC Sun 4:15 AM)
- Kids / Teens / Adults setting filters stories and tone. (DEC Sat ~6 PM)

## 7. Dice and grades

All numbers come from code (crypto random); the AI picks a tier and writes words, never numbers. (CLAUDE.md, code rules.ts `d20`)

**Total = d20 + stat + 1 if the owner used a friend's idea + the plan's tier shift.** (code lib/grade.ts, host.ts)
Tier shifts: CLEVER +3, SOLID 0, BOLD −3, LONG SHOT −5, ONLY A MIRACLE −8. (code lib/grade.ts, rules.ts)

| Total | Grade on the TV | What happens |
|---|---|---|
| natural 1 | DISASTER | A spectacular, funny backfire; a small step back |
| 2-5 | UH OH | It backfires; the problem grows; progress moves only a little |
| 6-9 | SORT OF | Half works, and a twist comes with it |
| 10-14 | IT WORKS | It works |
| 15-19 | GREAT | It works really well |
| 20+ or natural 20 | LEGENDARY | Better than anyone hoped (a great roll can save a dumb plan) |

(code lib/grade.ts; DEC Sun 12:30 AM "no success threshold", "fails: funny AND set you back a little")
After the throw the TV shows the math and the total on a 1-20 quality meter. (code QuickTV.tsx `RollMath`)
If you don't roll in time, the die rolls for you, with a buzz. (DEC Mechanics)

## 8. Story sources

- **Odd news (live):** SerpApi Google News, past week first, past month if needed, random editions worldwide, cached
  for 4 hours (free plan: 250 searches/month). (code server/news/candidates.ts, CLAUDE.md)
- **Storyability gate:** Muse scores each story 1-5 on situation, problem, setting, a real 3-4 step arc, real roles,
  payoff and fantasy fit; keep only an average of 4+ with no score under 3. Hard safety block: no deaths, injuries,
  crime with victims, war, politics, health scares, named private people or children. (code candidates.ts, DEC Sun 12:30 AM)
- **Fallback order:** past week → past month → the library of gated stories → curated stories. (DEC Sun 12:30 AM, code server/news/library.ts)
- **Tonight's tone:** eerie but harmless; heavy news is a pitched future mode with guardrails. (DEC Concept)
- **World:** modern urban fantasy, spooky-funny. Not fairytale. (DEC Concept)
- **No villain:** "we need a problem, not a villain". Every story centers on a problem (stuck, lost, broken,
  spreading) with stakes; nothing to defeat. (DEC Sat 10 PM)
- **"Our stories" (personal mode):** each player privately writes a small true story: the setup, the steps that led
  there, and (hidden) how it really ended. The table votes; the reveal shows how it really went for that person. If
  nobody writes one in time, the game plays odd news instead. (design/24, code host.ts)
- **Quick Tale:** a live opener written from fresh news during the lobby, with a stored opener as the instant backup
  (DEC Sun 4:45 AM); `/tv?judge=1` always plays a stored one. See Conflicts #1.

## 9. Narrator voices and art style

- **Narrator:** one voice per game, cast by the AI to fit the story's mood, reading while the text appears in sync.
  Mysterious and alluring, never cheerful. Falls back to text only if audio is slow. (DEC Sat 8 PM, DEC Sun 12:30 AM)
- **The cast** (persona names are placeholders): Vesper (OpenAI sage), Juniper (coral), Hollis (fable), Wren (shimmer).
  No audio processing: the raw audio has no static. (DEC Sun 12:30 AM, code lib/voices.ts)
- **House art style "Neon Ink":** a hand-inked indie comic look (a blend of lively comic color and bold ink with flat
  neon), less glossy-AI, and stray from the Gravity Falls look. (DEC Sun 12:30 AM, design/31)
- **Per-story themes:** the AI picks one of 6 variations of Neon Ink per story (Neon Ink, noir night, warm storybook,
  retro sci-fi poster, moody watercolor-ink, sunny comic); heroes stay recognizable. (DEC Sun ~2 AM, code lib/artStyles.ts)
- **Scene art:** a new painting per decision with the party's heroes painted in, started the moment the owner picks;
  the outcome shows over the last painting and crossfades when ready. Never wait. Art is never hidden by the UI on
  laptops. (design/24, DEC Sun 4:45 AM)

## 10. Sound

Original music generated in code (Web Audio, no files): a lobby loop plus 5 story moods (mysterious, eerie, playful,
warm, tense) picked by the AI per story (never eerie or tense for Kids). Music plays on the TV only and ducks under the
narrator; phones play sound effects; a sound on every press; something is always playing on the TV.
(DEC Sat 8 PM, code lib/sound, prompts.ts)

## 11. Social rules

- **People talk to each other, not to the AI.** Typing is the default; voice is optional. (DEC Principles)
- **Hand-off by name:** each outcome hands the next player the new obstacle ("Juno, the lights are yours"). (design/35 rule 11)
- **Talk cue:** "Sal, tell the table your plan." (design/35 rule 14, code QuickTV.tsx)
- **Credit friends:** a used idea gets "+ Sam's idea" and +1 on screen; the narration credits the friend on a success.
  (design/24, design/35 rule 12, code lib/grade.ts)
- **Callbacks:** at most once before the ending, always in the ending. (design/35 rule 13)
- **Nobody rates a person.** The AI judges ideas, never people. No player can dominate. (DEC Principles)
- **No real-life stuff outside the game** (for now): no side quests or real-world suggestions. (DEC doc 17)
- Feelings we aim for: "we laughed so hard", "I learned something about them", "we pulled it off together". (DEC Principles, DEC Sun 12:30 AM)

## 12. What's cut

| Cut | Why / source |
|---|---|
| Mirror, Mirror (kind line about a friend) | "The weak link" (DEC Mechanics, DEC Sat 8 PM) |
| Catch! (re-roll a friend's fail) and its thank-you hearts | "Not in D&D" (DEC Sat 8 PM, design/36) |
| Boost; "clever = no roll"; Convince the DM | Break "no one dominates"; judging is literal (DEC Sat 6:30 PM, DEC Sat 8 PM) |
| Hope meter; rescue after a natural 1 | Off since plan "y" (DEC Sat 6:30 PM, design/36) |
| Secret clues ("Only you noticed...") | Cut for good (DEC Sat 8 PM) |
| Inspiration token, Help (+2), AI plan suggestions, long storybook | Off for the demo (DEC Sat 6:30 PM, code features.ts) |
| Local meetup side quest; anything real-life outside the game | CD: "NO REAL LIFE STUFF OUTSIDE OF GAME" (DEC doc 17) |
| Villains | "A problem, not a villain" (DEC Sat 10 PM) |
| Pre-written scenes, branches, story bibles, fixed ladder | Replaced by the procedural rules (design/35) |
| Skill meter before each roll | On hold (DEC Sat 10 PM) |
| Bold ideas (roast intros, talent vote, real-vs-fake, anchor cameo, front-page keepsake) | Parked: perfect the core first (DEC Sun ~2 AM) |

## 13. Models and why

| Job | Model | Why |
|---|---|---|
| Judging each plan (tier + reason) | muse-spark-1.3, minimal | Fast and consistent; 8/8 in the bake-off (design/23, code route.ts) |
| Writing each turn and the ending | muse-spark-1.3, minimal | ~90% of "high" quality at ~3 s; hidden behind the throw (design/26, code stories/procedural.ts) |
| Story openers | muse-spark-1.3, high, with a low-effort backup | Best writing where the wait is hidden (design/23, code stories/opener.ts) |
| Storyability gate, hero cards, narrator casting | muse-spark-1.3 | (code candidates.ts, route.ts) |
| Hero portraits; heroes painted into each scene | muse-image-1.0 (image edits) | ~$0.01 per image, keeps heroes consistent (design/23, code server/art) |
| Optional voice input | muse-voice-transcribe-1.0 | (design/25) |
| Narration audio | OpenAI gpt-4o-mini-tts (tts-1-hd for one voice); Gemini TTS backup; then text only | Meta has no text-to-speech model; the one job that leaves Meta (design/23, code server/tts.ts) |
| Starting a night from Muse | The Muse connector (MCP at `/api/mcp`) | (MUSE_CONNECTOR.md) |

muse-wonder-1.0 is not used live: "correct everywhere and funny almost nowhere", and 19-27 s. Off-Meta writers gave no
win. (design/26)

## Conflicts found (please confirm with the CD)

1. **Quick Tale source.** DEC Sun 4:45 AM: Quick Tale writes a live opener from fresh news, `?judge=1` forces the stored
   one. Committed code still has `QUICK_IS_CURATED = true` (host.ts:119, always stored); an uncommitted working-copy
   change swaps it for `?judge=1`. DEC Sun 12:30 AM also says the judge demo uses "a guaranteed-great curated story":
   confirm judges get `?judge=1`.
2. **Turns per player.** Picker/design/24: 2-4 players = 2 each, 5-8 = 1 each. design/35 + code: 2-3 = 2 each, 4+ = 1 each, max 6.
   Also design/24 says Quick Tale gets 1 turn each; the code doesn't change turns for Quick Tale.
3. **Quick Tale timer.** DEC Sat 8 PM: 30 s. design/24: ~40 s. Code: 45 s ("30 s was too tight" in the persona sim).
4. **Quick Tale length.** ~3 min (DEC Judge demo), ~4 min (DEC Sat 8 PM), ~4-5 min (design/24), ~5 min (DEC Sun 12:30 AM). Used the latest.
5. **"Needs 12+".** Picker/design/24/design/25 show a pass line; DEC Sun 12:30 AM removed it. The TV follows the latest,
   but DM's Notes (DMNotes.tsx:14) still says "Needs N+", and rules.ts keeps the old `TIER_DC`.
6. **Progress.** design/35 rule 4 (fixed numbers per grade) → CD refinement (the AI judges, code only clamps) → DEC Sun 4:15 AM
   hybrid (grade range, AI picks inside). Used the hybrid. Nothing records the "feels 9/10" sign-off yet.
7. **Momentum.** The CD refinement softened rule 3 ("something doesn't have to change"); DEC Sun 4:15 AM says momentum by
   default. Used the latest (it also answers design/36's open question).
8. **Danger meter.** Approved in DEC Sun 1 AM; design/35 never mentions it; design/36 recommends cutting it. The code
   still shows it and quietly gives the finale −3 when it's full (host.ts). Needs a CD call.
9. **Narrator voices.** design/24: 2 voices (Gemini Sulafat + Charon), chosen in the lobby. DEC Sat 8 PM: sage, ballad,
   coral, ash on gpt-4o-mini-tts. DEC Sun 12:30 AM: sage, coral, fable, shimmer "(tts-1-hd)". Code: only shimmer uses tts-1-hd.
   design/25 says "five voices"; the `FEATURES.voice` comment and SPEC.md still say Gemini.
10. **Art style.** DEC Sat 8 PM: the AI picks from 5-6 different tested styles. DEC Sun ~2 AM: Neon Ink with per-story
    variations. Used the latest. `FEATURES.artStyles` comment and SPEC.md still say "Neon Uncanny".
11. **Join questions.** 2 questions incl. "small fear" (DEC Sat evening, Sat 6:30 PM) → 1 question (DEC Sat 8 PM) →
    "What's your secret talent?" (DEC Sun 12:30 AM). The picker note says "what are you good at". Used the latest.
12. **Friend bonus.** The ticked picker option said "+2"; the CD's note and design/24 say +1. Code: +1. design/35 rule 12
    credits friends in the narration; the code only credits them on a success (misses belong to the hero who acted).
13. **Story writing.** DEC Sat 5:30 PM: we hand-write every scene. DEC Sat 8 PM: AI branching. design/35: procedural.
    Used design/35. The `FEATURES.aiScenes` comment still describes hand-written scenes.
14. **Openers model.** DEC Sat 6:30 PM: muse-wonder-1.0 writes stories. design/23 + code: muse-spark-1.3 high. Used the code.
    design/35 "Speed" says the turn call is spark low; the code uses minimal.
15. **Picker leftovers.** "Players pick a setting or kind of chaos" was ticked but never carried into design/24 or built.
16. **Thank-you button** was approved early (DEC Mechanics) and later removed with Catch (design/36), with no CD entry.
17. **Reveal wording.** design/24 "This really happened"; DEC Sun 1 AM/design/35 "Based on a true story". The code uses both
    (stamp + small line). CLAUDE.md still says "this tale was inspired by real events" and "Once Upon a Roll".
18. **Not committed yet:** the playful labels (rules.ts), the payoff / momentum / power-scaling prompt rules
    (prompts.ts, stories/procedural.ts) and the hybrid progress ranges (lib/procedural.ts) are in the working copy only.
