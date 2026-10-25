# Decisions log

Append-only. Every creative or product call, with the creative director's (CD) actual answer. Newest at the bottom.
Status: ✅ decided · ⏳ pending (CD hasn't answered) · ⚠️ defaulted by Claude, never approved.
Full history and train of thought: `design/00-where-we-are.md`.

## Concept
- ✅ Track: Meta "Bringing People Closer Together with AI". Co-op, the table vs. the world. No saboteur.
- ✅ Product: phones as controllers, the TV is the table, Muse is the DM. Every story comes from a filtered real headline. Ends with "official story vs what you uncovered" and a bookshelf.
- ✅ World: modern urban fantasy, spooky-funny. Not fairytale. Partner agreed.
- ✅ Name: "Group Project" (placeholder). No suspicion-themed names.
- ✅ Art: Neon Uncanny scenes ("epic", "the octopus kind of thing is cool"). Heroes must be cartoon characters, never realistic people.
- ✅ Heavy news: Real World mode only as a pitch, with guardrails. Tonight's stories are eerie but harmless.

## Principles (red lines)
- ✅ Connection first: "we laughed so hard", plus a little "I learned something about them", plus "we pulled it off together".
- ✅ Nobody rates a person. The AI judges ideas, not people.
- ✅ No player can dominate (most votes, best answers). CD raised this 4+ times.
- ✅ People talk to each other, not to the AI. Typing is the default input; voice is optional.
- ✅ The AI must be explainable to judges (DM's Notes).
- ✅ Judges are free to leave, and should want to come back.

## Mechanics
- ✅ Dice auto-roll if you don't roll, plus a buzz.
- ✅ Ready-made characters, with an offer to make your own (6b).
- ✅ Optional hidden "one true thing" (2b).
- ✅ Shake-together Final Roll (3a). Thank-you button (4).
- ✅ Clues come from each hero's special quality: "Only you noticed… because …".
- ⚠️ "Convince the DM" (one-argument appeal), Boost, and "clever = no roll". Built by Claude from "convince the dungeon master". The scan flags Boost and "clever = no roll" as breaking the no-domination rule.
- ⏳ Round choice: proposed d-variant. Each player backs one plan (their own or a friend's) in 15 s, no arguing phase. Spotlight rule: a plan that has won can't win again until everyone's has. The AI borrows one piece of every other plan ("Yes, and"). Boost is removed.
- ⏳ Mirror, Mirror: the CD called it "the weak link". Quick Tale skips it. Replacement TBD (the per-round "help" now covers "Yes, and").

### Sat evening: new round loop ✅ (CD: "the loop sounds good")
1. Scene + "Only you noticed…" clue → 2. everyone types a plan → 3. each backs one plan (spotlight rule) →
4. winner may take ONE friend's help (+2, no extra dice) → 5. Convince the DM stays (CD: "seems fine") →
6. **the winner rolls one d20** (CD: "whoever proposed the winning idea rolls, one roll per choice") → 7. outcome.
- ✅ Final Roll: everyone shakes as a ritual, ONE shared die (no best-of-N; "5 possibilities to roll a 20 no good").
- ✅ Don't fold in every idea ("could easily get way over congested").
- ✅ Stay close to the best parts of real D&D; don't stray. Catch! isn't in D&D, so it's on the chopping block (⏳ confirm).
- ✅ The loop must stay fast, and the DM must handle very diverse stories and plans.

## Partner's doc 17 (Real In, Magic Out)
- ✅ Name the player and their real quality in the reveal ("Sam's patience is what saved the bridge").
- ✅ Keep local news (city → state → national) as a story source.
- ✅ Local meetup side quest: dropped. **CD: "NO REAL LIFE STUFF OUTSIDE OF GAME (for now at least)."** No side quests, no real-world plans or suggestions.
- ✅ Partner's `remote-play` branch (Sat ~6 PM), option a: the partner pauses host/TV/Phone edits and Claude merges it in. Keep: the Kids/Teens/Adults "Who's playing?" setting, the 3 questions folded into one-true-thing onboarding, the "Solved by…" line, and phone-as-host if it works. Drop: side quest. The partner then owns local news + rating tags, tests and Devpost.
- ⏳ Pick the headline that best fits the group's qualities, with one spotlight per player.

## Story choice and onboarding (Sat evening)
- ✅ Story pick: 3 random headlines (age-allowed), everyone taps one, ties broken at random. No AI "best fit" pick ("no unfair advantages"). Quick Tale = random.
- ✅ Join questions replace the one true thing: "weirdly good at" → power, "small thing that scares you" → weakness (comedy only). Both skippable. Shown only at the reveal.
- ✅ Inspiration, option a (CD's idea: the AI gives a token for a creative, well-thought-out plan, +2 on a later roll). Proposed: the earner can only give it to a friend; max one per scene; any plan can earn it; not twice in a row. Replaces Catch!.

## Judge demo
- ✅ Quick Tale (~3 min, one scene, very polished art). Autopilot. Keepsake link + QR. Attract screen + hotkeys. Judges' Saga only lightly.
- ✅ Online mode: c (screen-share now, plus a `/watch` big screen).
- ✅ All 20 UX fixes and the privacy note. The note must be honest that Muse processes the text (free credits mean Meta may use content).

## Open logistics
- ⏳ Final name and .tech domain · feature-freeze time · Meta presenter lines in the pitch · whether Best Pitch counts toward the 3-track limit · partner's role · Meta Global hackathon application (due Oct 25, 11:59 PM ET).

## Sat ~5:30 PM: Meta-table playtest (2 recordings)
- CD: "took like 8 minutes", "over crowded", "not enough explanation", "too many features", "proposed answers were always the same", "art didn't incorporate our characters", "obvious AI is writing these stories", "the wording is unfollowable", "what the hell is foam".
- ✅ Writing: option a. We (the devs) hand-write each story's scenes in plain English during development; the AI only reacts to plans. Grade 5-6 reading level, no invented jargon.
- ⏳ Round: a (bare bones ⭐) / b (+ Convince the DM) / c (loop v2).
- ⏳ Art: a (hero stickers in scenes + AI group poster at the end ⭐) / b (paint every scene live).

## Sat ~6:30 PM: after the Meta rep's feedback (rep is a judge)
- Rep's judging lens: (1) "the flow should just work really well" (not feature count); (2) AI essential, "a magical experience"; (3) how the team used AI to build it.
- ✅ Plan "y": simple core, silky and immersive, different models per job, **no new features** beyond this list.
  - Core round = bare bones: scene (hand-written) → everyone types a plan → back a friend's (not your own; spotlight rule) → winner rolls one d20 → outcome. Final Roll (one shared die, shake ritual) → reveal ("this really happened" + "Solved by…") → keepsake.
  - Off for the demo (code kept, switched off): Mirror, Boost, Catch, Hope, Inspiration, Help, Convince the DM, long storybook.
  - Join: ready-made hero by default + 2 optional questions (good at / small fear). Kids/Teens/Adults setting.
- ✅ Art a: muse-image edits paint the party's heroes into the scene art, prefetched in the background; fall back to the pre-painted scene if not ready. Group poster at the end.
- ✅ "Your own story" a: after the core is flawless (target ~9 PM), add a 4th "Write your own" card on the story vote; muse-wonder writes it.
- ✅ Models: muse-wonder-1.0 for story creation (ahead of time); muse-spark-1.3 minimal for live rulings; research the best model per job (images, narration incl. voice, judging, story creation), and a non-Meta model is allowed.
- ✅ CD rebuild priorities: flow first; simple gameplay; uncluttered screens; smooth, slick transitions and story effects; execute the core VERY well; polish and fix only, no cool new features; stories easy to follow and logical, especially when weaving in each hero's quirks. Base the work on the Meta judge's feedback.
- ⏳ Voice narration: wanted, but it must be "smooth, not obviously AI". Voice samples to be compared by ear before choosing.

## Sat ~8 PM: core loop FINAL (from the mechanics picker, CD + partner) → design/24-core-loop-final.md
- ✅ Turn-based: everyone suggests, the owner picks; +1 for working in a friend's suggestion; one action only; cycles by lobby size; a grand finale vote (not your own) + a shared shake die.
- ✅ No Convince the DM; literal judging; "Needs N+"; d20 per action.
- ✅ Two story modes: live odd news (worldwide, past week/month, 3-headline vote) and "Our stories" (personal, with the real ending revealed).
- ✅ Branching AI writing from a fixed start and goal; 8-year-old clarity; logical.
- ✅ New scene art per decision with heroes; never wait.
- ✅ Voice + synced text; 2 narrator voices (Sulafat + Charon, mysterious and alluring; names TBD).
- ✅ Ending: real story + what's happening now + keepsake.
- ✅ Join: describe + one question (good at); equal stat budget; ready-made backup.
- ✅ Timers ~60 s; absent players skipped; one room for the demo.
- ✅ Cut for good: Catch, Boost, Mirror, clues.
- ✅ Narrator cast: 4-5 voices (at least one male and one female); the AI casts one voice and tone per story mood (creepy → ghost-story telling). "Not super in depth, but very important."
- ✅ Art style per story: option a. The AI picks one style per game from a tested set of 5-6.
- ✅ No forced "reason" lines. The outcome narration is the explanation (cause → effect in-story). The deeper "How the AI decided" is an optional view at the end.
- ✅ Narrator cast (OpenAI gpt-4o-mini-tts, speed 1.2, mysterious/alluring, never cheerful): Vesper (sage), Wren (ballad), Juniper (coral), Hollis (ash). Gemini TTS is the backup.
- ✅ Live link: groupproject-game.vercel.app (old once-upon-a-roll link still works).
- ✅ Logo/thumbnail: the CD's neon paint logo, with the J fixed (devpost-media/logo-v4-J-*.jpg).
- ✅ Music + SFX: option a, original music generated in code (Web Audio): lobby loop + 5 story moods (AI-picked), ducks under the narrator; SFX on every press; always something playing on the TV.
- ✅ Quick Tale turn timer stays 30 s (advances early when everyone's done); about 4 min with 3 real players.

## Sat ~10 PM: after the CD's live playtest ("fun, but not game-like enough; goal too narrow; pictures didn't change; ending lame")
- ⏸ ON HOLD (CD, ~10 PM): Skill meter before every roll (3 s, friends can tap to slow it): perfect = second die (advantage), good = +2, miss = plain roll. The narrator credits the skill on a perfect-but-failed roll. The die stays the climax.
- ✅ A "Right now" goal set by the AI after each outcome; the big goal stays in the corner.
- ✅ Every decision gets a new scene composition; the story follows the players' new threads (yes, and).
- ⏳ Danger meter / progress bar: unclear, to confirm.
- ⏳ Ending: to revisit later (proposed a "because of you" montage).
- ✅ Story ladder: 3-4 planned steps per quest (success climbs, fail stays with a twist), small progress dots next to 'Right now'. No spoilers before the reveal; vote on fantasy quest cards.
- ✅ No villain: every quest centers on a PROBLEM (stuck, lost, broken, spreading) with stakes; nothing to defeat.
- ✅ Test bots: up to 3 human-like bot players (hidden host option) for playtesting.
- ✅ Lobby revamp (CD answers): Jackbox-style title screen mixed with a moody neon nightclub poster; background = slow loop of AI-painted scenes mixed with the melting neon logo art; big logo with a drip/pulse; big neon-framed QR on one side; hero cards pop in with sound; settings as big buttons but uncluttered; Start appears big at 2+ players (countdown option); punchy text plus a tiny "how it works"; attract mode cycles hero-in-scene art plus one pitch line; references: Jackbox + D&D. Must NOT look like an AI-made web page.

## Sun ~12:30 AM: CD answers on the overall game
- Audience: everyone. **Connectedness first (Meta).** Feelings: laughed so hard + learned something about them + a cool story.
- Length: Full 10-15 min, Quick ~5 min. One AI twist per turn. Free-text input. Team win/lose with a clear ending card. Judge demo: judges play on their phones, or a short video then a live round.
- Humor: iconic, a little dry and witty, creative, unexpected but makes sense. Art: stray a bit from the Gravity Falls look (too close).
- Fails: funny AND set you back a little.
- ✅ NO success threshold: every roll number is its own outcome (1 worst … 20 best). Plan difficulty shifts the number; the AI writes the outcome at exactly that intensity; ladder movement is graded (setback / stall / climb / big climb / legendary).
- Swipe up on the phone to throw the die; it's thrown and rolls on the TV (the result is still code RNG).
- The CD's bar for tomorrow: "perfection: full-scale working product, optimal integration, eye-stealing graphics and UI, so smooth it feels like you're in the story."
- ✅ (Sun ~1 AM) CD "yes on everything": swap in the new lobby (no Mabel-lookalike art), phone revamp, in-game TV polish, "Based on a true story" on the reveal, ending "because of you" montage, danger meter, the real Meta video (script now, record on the final build in the morning), Devpost final update, pitch prep, judge-table plan.
- ✅ Tagline: "Group Project: the one group project where everyone actually shows up."
- ✅ Fail forward: every turn advances one step; the grade picks a better or worse branch.
- ✅ Blind model bake-off for storytelling (Spark minimal vs Spark high vs Wonder, plus Claude/GPT if keys are added).
