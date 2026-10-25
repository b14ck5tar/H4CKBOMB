# 33: Deep dive on the "worst run yet" (recording 20261025-0731, live build 196ae87)

Method: I extracted a frame every 0.5 s (1,131 frames), dropped near-duplicates (361 kept) and read every contact sheet. I transcribed the audio twice with Muse Transcribe (50 s and 20 s chunks). The ASR mixes the TV narrator in with the players, so speech quotes are approximate. Then I read the deployed code (`git show 196ae87:`) and the branch at 5e2a768.

Table: Dot (human, "ben"), Milo (human, "BL4CKSTAR"), Ranger Wren (bot "Riley"), Nadia (bot "Sam"). Story: "The Cat Bus Home" (Odd News, Full Story, 8 turns). No keys or secrets appeared on screen. A Discord DM preview popped up at 4:32, so watch for notifications when recording the demo.

## 1. Turn by turn

| # | Plan card (what they chose) | Said out loud | Roll | Outcome shown | Next "Right now" | Ladder |
|---|---|---|---|---|---|---|
| 1 Dot 3:10 | typed "im good with animals so it just naturally trusts me and comes to me when i call it" → **"Dot calls the cat toward her voice"** (Solid) | – | 14+1 = 15 GREAT | AI: "…The cat pads close enough to sniff her shoe, then **ducks under the porch**." | Coax the cat close to home → Lure the cat from under the porch | 1→2. **The success became a new barrier.** |
| 2 Milo 4:14 | **"Milo codes a squeaky mouse game on a phone"** (Dot had suggested "devlop a screen that attracts cats"; no credit was shown) | "I think it's getting a little crowded." | 3+2 = 5 UH OH | **Canned**: "…doesn't work this time. The problem is still right there." | → **Coax the cat close to home (back to step 1)** | 2→3. **Ignored the plan, the goal went backward, and the ladder climbed on a fail.** |
| 3 Wren (bot) 5:17 | the bot picked Milo's suggestion "Idk" → **"Ranger Wren stands by the porch unsure what to do"** (Risky −3) | "Oh, okay. Nice." … "This doesn't explain anything." | 19+2+1−3 = 19 GREAT | **Canned**: "…one step closer. The problem isn't solved yet." | → Calm the cat around cages | 3→4. **A success with no story.** |
| 4 Nadia (bot) 6:32 | **"Nadia lays a small food trail away from the trap"** (Clever +3). It skipped Dot's "use cat food with weed in it to calm it down". | "Cat food… Use my thing. Bro." | 7+1+3 = 11 IT WORKS | AI: "…the cat follows it. It stops by the cage and sniffs without bolting." | → Lure the cat inside the open cage | 4→5. The only clean beat. |
| 5 Dot 7:31 | typed "i grab the cat now what" → **"Dot lunges to grab the cat"** (Risky −3) | "Grabbing the cat." "Why is she saying lol?" "**Why is that risky?**" | 12+2−3 = 11 IT WORKS | **Canned**: "Dot's plan **helps a little, but it costs something**. The problem isn't solved yet." | → **Calm the cat around cages (repeat of turn 3)** | 5→6. **The badge said IT WORKS but the text said "partly".** "Bro I literally just solved the problem… this is not logical… it's awful… same scenario for eight—" |
| 6 Milo 8:19 | Wren's idea → **"Milo makes the cage smell like warm hugs"** (Clever +3) | "Elaborate. Why?" "Dude, we just perfectly— no, this is dumb." | 14+2+1+3 = 20 LEGENDARY | **Canned**: "…better than anyone hoped, and the heroes get a big step closer." | → Track the cat after sightings stop | 6→7. **A nat-20-level result and nothing changed.** |

The narrator re-read the same unchanged situation for three turns in a row, twice: "the cat hides under the porch…" at 4:12, 5:06 and 6:18, then "the cat stands close to the cage for the first time…" at 7:30, 8:24 and 9:18.

## 2. Root causes at 196ae87

**(a) Plans not honored**
- 4 of 6 outcomes were `FALLBACK_OUTCOME` (host.ts L353). By design, those lines "never quote the plan".
- The ruling rewrites the plan as a 12-word `interpretation` ("Never copy the plan's words", prompts.ts L209). The outcome then repeats that rule: "Never copy or quote the plan", 26 words max (L260-263). The player's key noun gets lost: trust, screen, weed, grab.
- The ruling prompt says "a plan that would solve the whole problem at once… can only partly work" (L207), and brute force counts as risky. So "grab the cat" was rated Risky.
- Bots own turns and pick any human idea at least 60% of the time, with no quality check (bots.ts L228-231). That is how "Idk" became a plan.

**(b) Successes don't progress**
- **The timeout.** `askOutcome` starts at the ruling with a 12 s limit (host L2453), and the server's Muse call also has 12 s (route.ts L43). The ruling-to-outcome gap was about 14 s (4:55→5:09, 6:03→6:17, 8:56→9:10). `viaAI` also throws away an answer that arrives after 12 s, even when it comes before the outcome is shown (L828). The table watched "The DM is writing it down…" and then got the canned line anyway.
- **The fallback goes by band, not grade.** PROGRESS maps to YES_BUT, whose line is "helps a little, costs something". GREAT maps to SUCCESS, whose line ends "isn't solved yet" (grade.ts ROWS).
- **Fallbacks return `situation: ""`**, so the old situation stays and the turn line repeats it.
- **The ladder.** `buildLadder` (L1636) spreads 3 beats over 8 turns: coax×3, calm×3, track×2. When the AI gives no goal, `showOutcome` takes `L[step]` (L2495), which is a repeat. The step climbs on every roll, even UH OH.
- **The prompt forbids finishing anything.** "Every turn moves to ladder.next" and "Before the finale the problem is never solved for good" (L230, L252). On steps 0-2, ladder.next is the same as the current goal, so the model had to invent the porch.
- The last beat, "Track the cat after sightings stop", is a step from the real news story, not from this scene.

**(c) Other**
- Turns take about 60 s each, and 8 turns plus the finale is 10+ minutes. The video ended mid turn 7.
- Bot "lol" and typo suggestions ("silde", "cgaes") confused the players.
- The night bus hook never came back after the opener.

## 3. On the branch (196ae87..7b46971, 18 commits)

**Fixed**
- The ladder is gone. Progress (0-100) now drives 3 act dots.
- `shownGoals` blocks repeated goals.
- `fallbackLine` names the plan and matches the grade.
- Bots never own a turn while humans are playing, and they write clean text (no "lol", no typos).
- `own_words` and `friend_idea` now reach the ruling and the outcome.
- 7b46971 rewrote the prompts: "THE CHOSEN PLAN IS WHAT HAPPENS… A success really works and is never undone". "Never solved for good" is deleted. The ruling now says "if it succeeds, it really works".

**Still broken or worse**
- The host now waits 15 s, but route.ts still aborts the server call at **12 s** (L47), so nothing gained. Late answers are still discarded, and the clock still starts at the ruling. This is the bug that produced 4 of the 6 bad turns.
- The outcome prompt still says "Never copy or quote the plan" (L264) and still mentions ladder.next. It doesn't explain the `own_words`, `finish_line` and `progress` fields the host now sends.
- After a fallback, `nowGoal` stays the same, so a success still leaves the same "Right now".
- **Regression:** `makeTurnOrder` (L1732) sets cycles from *all* heroes (4 or more means 1 cycle) but deals turns only to humans. This exact table would get **2 turns total**.

## 4. Top 5 fixes
1. **route.ts L47:** outcome `timeoutMs` 20 s. **host:** wait on `outcomeP` until the die lands + 4 s, not ruling + 12 s, and keep a late answer if the outcome isn't on screen yet.
2. **prompts.ts OUTCOME_BASE:** replace "Never copy or quote the plan" with "Name the player's own key noun (own_words)". Remove the leftover ladder.next text. Define `finish_line` and `progress`.
3. **prompts.ts ruling:** if the last outcome set it up (the cat at the cage), "grab it" is Solid, not Risky. The `interpretation` keeps the player's noun ("trusts", "screen", "grab").
4. **host.ts fallback:** on a better or legendary grade, set a fresh `nowGoal` (the next act from `finish_line`) instead of keeping the old one. Skip the turn narration if the situation is unchanged.
5. **host.ts `makeTurnOrder`:** cycles from `humans.length` (2 humans → 2 each). Bots ignore ideas under 3 words or without a verb ("Idk", "Meow"). Gate: one 4-human Full Story with Muse live, with no canned line and no repeated goal.

---

## Appendix A: on-screen story text, verbatim (TV)

- Lobby tagline: "Tonight's news, but you're the ones who fix it." Hero: Dot typed "i am saint mary from the bible", talent "very hyperactive", which became **DOT, the Almost Saint** (+2 Guts, 0 Brains, +1 Charm; NEVER SITS STILL: "Vibrate through any slow line, lock, or boring wait.").
- Vote (2:22): 1 The Sneezing Flat, "An old flat coughs up lost papers, and something fluffy refuses to share." 2 The Dog Who Loved Doors, "A lost little dog keeps slipping through every sliding door in the mountains." 3 The Cat Bus Home, "A lost house cat keeps hopping a strange night bus out of town." Dot voted Dog. The Cat Bus won.
- Title (2:35): "TONIGHT: A COZY LOST CAT RESCUE / THE CAT BUS HOME / PAINTED IN STORYBOOK GOUACHE / YOUR DUNGEON MASTER: MUSE".
- Opener (2:48): "In a quiet suburb, an owner and a rescue volunteer watch night videos of a lost house cat. A kind night bus for lost pets keeps opening its doors for the cat and carrying him off to new towns. If he hops on the bus again tonight, he rides off and stays lost for good." Narrated: "Rescue volunteer says, it eats each night, then runs from the cage." and "[…] an open screen door, a box trap with food, and night video showing a cat near the porch." Right now: COAX THE CAT CLOSE TO HOME. Goal: Get the cat home before the bus leaves town.
- T1 suggestions: Nadia "reset the box trap with warm fresh food", Ranger Wren "vibrate the food bowl like dinner bell lol", Milo "Grab the car". Outcome as in the table.
- T2 suggestions: Nadia "make warm food smell reach farther for a minute", Ranger Wren "make porch super cozy for kitties lol", Dot "devlop a screen that attracts cats".
- T3 suggestions: Nadia "track its paw prints for safest cozy spot", Milo "Idk", Dot "rangle the cat ur litteraly a rangler".
- T4 suggestions: Ranger Wren "plan a tiny porch picnic to chill lol", Milo "Cook it food", Dot "use cat food with weed in it to calm it down".
- T5 suggestions: Ranger Wren "silde the yummiest bite deeper inside lol", Nadia "hold the cage door steady and wait", Milo "Meow".
- T6 suggestions: Nadia "make cages feel like safe porch for a minute", Ranger Wren "make cgaes smell like warm hugs lol".
- Situations read aloud: after T1, T2 and T3: "The cat hides under the porch by the trap, too shy for the cage, and Milo holds warm food nearby." After T4, T5 and T6: "The cat stands close to the cage for the first time, sniffing the food trail, while Dot holds the door open."

## Appendix B: speech (Muse ASR, 20 s chunks; narrator lines removed where clear)
4:48 "Danger is danger. I think it's getting a little crowded." · 5:24 "[unclear] now it's gone." · 5:42 "[expletive] brain… like that" · 6:00 "Oh, okay. Nice." · 6:18 "This doesn't explain anything." · 6:36 "I like this drawing." "[…] cat food, with [weed] in it." · 6:54 "[Use] my [expletive] thing. Bro." · 7:30 "Grabbing the cat." · 7:48 "Why is she saying lol? Why is it mad? Why is that risky?" · 8:06 "Bro I literally just [expletive] solved the problem… this is not logical." · 8:24 "This game's awful." / "It's not that bad." / "It's awful. It's not developing at all how it should be. We've been in the same scenario for eight—" · 8:42 "I feel like this story… barely." · 9:00 "What did you [expletive] tell— Why?" "Elaborate. Why?" · 9:18 "Why? … Dude, we just perfectly— No, this is dumb."
