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
- ✅ Join question: "What's your secret talent?" (replaces "weirdly good at").
- ✅ Odd-news stories must pass a storyability gate (clear situation, problem + stakes, visual setting, a real 3-4 step arc, a payoff at the reveal; fantasy twist improves rather than confuses). No more grasping at random articles.
- ✅ The in-game look = the tvskin mockups (turn card + idea bubbles, 1-20 quality meter, HUD with ladder + danger). Everything animated, nothing stiff. Top priority for the builder.
- ✅ Art: a house style blending A (lively comic color/energy) + B (bold ink, flat neon, graphic readability); less glossy-AI; C rejected (unsettling). 12 new ready-made heroes in that style.
- ✅ Voice: raw OpenAI audio has no static, so no processing. Cast: sage, coral, fable, shimmer (tts-1-hd); onyx dropped. One narrator per game.
- ✅ Stories: a library of gated good stories; past week, then past month, then library, then curated.
- ✅ Judge demo: a guaranteed-great curated story. Bots: none for judges (1-2 only if needed).
- ✅ House art style "Neon Ink" (A+B blend) + 12 new heroes (v2) replace the old 6.
- ✅ CD rule (Sun ~2 AM): perfect the core loop before ANY new feature. The fresh-eyes 'bold ideas' (roast intros, talent vote, real-vs-fake, anchor cameo, front-page keepsake) are parked.
- ✅ Art: Neon Ink house style + 18 v2 heroes approved; each story still gets its own art theme (a variation on Neon Ink).
- ✅ Pitch: both present. The CD is away 11 AM-4:30 PM (work) and back ~4:45 for the 5:30 pitch; the partner covers judging 2-5 PM. So the build must be stable by ~9:30 AM, the video recorded and the Devpost finalized before 11 AM.
- ✅ Story = procedural rules (design/35 + CD refinements): logic chain from the player's literal action, everything possible, plain wording, the AI judges progress (code clamps), hand-off + callbacks + 'tell the table your plan'.

## Sun ~4:15 AM: story tweaks (CD answers to design/35 push-back)
1. Payoff consequence: yes, but **simple beats clever**. CD: rather "simple, playable and followable than complex and confusing". One plain cause and effect; no wordplay.
2. Momentum by default: yes.
3. Hybrid progress (the grade sets a range, the AI picks within it): yes, but it must be tuned with tests until it feels 9/10.
4. Wild plans need big rolls: yes. Power scaling still applies: no hero massively out- or underperforms.
5. Playful difficulty labels: yes.
6. 6 AM freeze: decide when we get there.

## Sun ~4:45 AM: generative openers + polish push
- Quick Tale writes a live opener from fresh news during the lobby and hero creation (it was always curated, QUICK_IS_CURATED). A stored opener is the instant backup; `?judge=1` forces the stored one. (CD: "we need stuff generative flowing within a manageable time frame.")
- Approved A (scene art follows the story; art never hidden by the UI on laptops), B (music polish), C (submission prep). Run agents in parallel.
- Boulder opener renamed "The Boulder on the Edge"; spoilers removed from 3 more openers.
- GAME.md: the one doc of all main ideas, weighted on the core-loop picker (design/24) and the procedural rules (design/35).

## Sun ~5:15 AM: danger meter cut, turn counts, campaign idea, pitch kit
- Danger meter cut entirely (CD: "never understood it"). One meter only: progress with 3 act dots.
- Turns: 2-4 players = 2 turns each, 5+ players = 1 turn each, in every mode (humans only).
- Campaign mode (heroes carry over into the next story with upgrades, like real D&D): proposal only. The proposal-only list will be trimmed to a top 3 for the pitch.
- Started PITCH_KIT.md: pitches, judge-table run-of-show, AI explanation, how-we-built-it, judge FAQ, talking tips, rehearsal.

## Sun ~5:45 AM: CD answers before the session split
- Non-negotiables for every session: **players' ideas drive the story**, and **silky smooth, moderately fast**: nobody waits more than about 5 s. Be as efficient as possible, and keep generating ahead: start every AI call the moment its inputs exist, so the answers are ready and quality has time. (Simple-beats-clever and the social rules stay as decided earlier.)
- Priority: everything at a high standard. **Story quality is the weak point**, plus preparing for the actual judging. Art, looks, sound and smoothness need only small touch-ups.
- Judge mode: `/tv?judge=1` = 1 turn each, max 3 turns, then the finale everyone plays (about 5 min). Normal games keep 2 each at 2-4 players and 1 each at 5+.
- Handoff: a short GAME.md (the shared truth) plus a tailored brief per session.

## Sun ~4:15 AM (laptop clock): GAME.md rewritten (lead session)
- GAME.md cut to ~2 pages: final answers only, "Conflicts found" resolved and removed. Resolved with: danger meter cut; turns 2-4 = 2 each, 5+ = 1 (humans only); judge mode 1 turn each, max 3, then the finale; "Based on a true story"; "What's your secret talent?"; friend's idea +1; Quick Tale live opener with stored backup, `?judge=1` forces stored; narrator ElevenLabs vs OpenAI (CD picking voices); Neon Ink + per-story themes; no pass-line numbers.
- ⚠️ Quick Tale turn timer: GAME.md follows the code's 45 s (the 100-persona sim found 30 s too tight), not the Sat 8 PM 30 s. Change it back if the CD wants.
- ✅ CD standing rule (relayed by the coordinator): when a session thinks something should be done a certain way, do it, and tell the CD explicitly WHY in plain words. Check old-iteration ideas against GAME.md and the latest DECISIONS before reusing them.
- ⏳ Narrator voice per persona (Vesper, Wren, Juniper, Hollis) from the bake-off page: the CD picks; voice session applies it.
- Clock note: the laptop says ~4:30 AM CDT. Some earlier entry times ("5:45 AM", "8:40 AM") ran ahead of it; trust the laptop clock.

## Sun ~4:35 AM: narrator voices (CD picks, ElevenLabs v3)
- ✅ Vesper = Sarah, Hollis = George, Wren = Charlie (all Eleven v3, the expressive model). Juniper had no pick: dropped, the AI casts from 3 voices (lead's call: every voice in the game is one the CD approved by ear).
- ⚠️ Vesper: the CD ticked Lily once and Sarah twice; lead went with Sarah.
- ✅ (Sun ~4:45 AM) CD answers: buy the ElevenLabs $5 Starter plan (the CD buys it; voice flips the provider after). Art: a new painting EVERY turn (the act/win/finale-only cadence is reverted). Quick Tale = 1 turn each (~5 min); Full keeps 2 each at 2-4 players, 1 at 5+. Gemini track: off. Sound fixes (605476d): the CD says they sound good.
- ✅ Sound effects approved by the CD ("cool, a little muffled but nice"); voice brightens them slightly.
- ✅ (lead) Narration: Flash v2.5 for live turn lines (v3 takes 3-5 s, breaking the no-wait rule); v3 for openers, next scenes and the ending. Per-game credit guard: if the balance is low, the whole game reads with OpenAI, never switching mid-game. Judge stories each get one pinned AI-cast voice so their openers can be pre-cached.
- ⏳ CD: narrator "a bit choppy and echoey, make it smooth" → voice is fixing it (dry narrator, smooth ducking).

## Sun ~5 AM: CD course-correct + one narrator
- ✅ CD: focus on the game working and feeling smooth before more narrator work. The laughing clip and 4th phone are dropped from the video (screen recording only).
- ✅ CD voice pivot: ONE ElevenLabs narrator for everything, the "main girl" voice (v3, stability 0, similarity 0.8, style 0.45, speaker boost). No per-story casting for now. Flash in the same voice for live turn lines if v3 would make people wait.
- ✅ CD: the demo video can use test bots (fine as is). The look session publishes production when the lead says go; the CD approves the prompt. The CD is buying the ElevenLabs $5 plan.

## Sun ~5 AM: freeze schedule (lead, on the coordinator's advice; the CD can change it)
- No new features from now on. Fixes until 8:00 · final deploy by 8:30 · 3 timed judge runs 8:30-9:15 · video + submit 9:15-10:45.
- The one polish allowed: a loud friend's-idea moment ("SAM'S IDEA +1" on the TV + the friend's name in the narration). Connection is 30% of the score.
- Narrator live on the laptop: ElevenLabs Sarah for every line; every fallback voice is female.

## Sun ~5:45 AM: tone + narrator (CD)
- ✅ The game's story is BASED on a true story: the narrator never says "this really happened". It says "based on a true story" once, at the reveal only.
- ✅ Storyteller narration (talks to the table) + Jackbox-style quips on plans and big rolls (tease the idea, never the person), shipping.
- ✅ CD: "why are the storylines so kiddy?" The prompts' "an 8-year-old follows it" bar is replaced with "a tired adult at a party gets it on first hearing": plain and followable, with grown-up dry/dark humor. The Kids setting keeps the gentle tone. Default + judge rating: adults.
- ✅ CD: stories are lame ("nobody cares about bridges"), and the same few have been reused too long. Research 20 fresh real odd-news stories (Aug-Oct 2026, worldwide); the CD picks the new judge stories.
- ⏳ Full Story cap at 6 turns (⭐).
- ✅ (Sun ~6 AM) CD: new judge stories = the Busan canal shark, the Met Opera snake audition, the €9M gold in a Dendermonde cellar wall (from 20 researched Aug-Oct 2026 stories). The other 7 of the top 10 go into the library. The old rust-wyrm/boulder/cornfield stories leave the judge top 3.
- ✅ (Sun ~6:10 AM) CD: the safety filter is why the stories are lame. ADULTS mode now allows non-violent crime (heists, cons, scams, fraud), weird court cases, public-figure/company scandals, absurd local-government drama and dark-funny topics. Still blocked in every mode: deaths, serious injuries, violence against people, sexual content, children, hate, war/tragedy/disasters, partisan hot-button politics, mocking private people. Teens/Kids keep the old rules. 10 juicier stories are being researched for the CD to consider for the demo.
