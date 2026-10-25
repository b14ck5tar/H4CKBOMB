# 29: Fresh-eyes review (Sun Oct 25, ~1:45 AM)

A reviewer session that had not seen the build before. It played the **live site** (groupproject-game.vercel.app, TV + 1 phone + 2 test bots): one Quick Tale in Odd news (live story about owls, "The Roof Guests") and one Quick Tale in Our stories (it played the curated pumpkin story instead). It also read DECISIONS.md, design/21, 24, 25, 28, `story-examples.ts`, `quickstart_heroes.json`, every image in `public/heroes`, `quests`, `lobby`, `style-candidates`, and the main session's latest playtest shots (`playtest-shots/bots2`, `phone-ui/v2`).

**Screenshots:** `C:\Users\oclab\AppData\Roaming\Claude\side-session-notes\local_ad541dcf-0e6c-4020-ae73-9df17703386a\fresh-eyes-screens\` (below: `shots/NN-name.jpg`). Contact sheets: `40` heroes, `41` lobby + quest scenes, `42` phone v2 (branch), `43` the main session's bots2 run.

**Caveat:** the live site is behind the branch. `/tv-preview` is a 404 live, and it still shows "Needs 9+" and "What are you weirdly good at?". Commits b51e750, 2c54e21 and 3162f17 already fix some of what I hit. Those items are marked **(fixed on branch? verify after deploy)**.

## Verdict (10 lines)
1. The bones are right. Friends suggest, the owner picks, a d20 decides, a painting lands, and the real story comes out at the end. Nothing else at HackTX does this.
2. The best moment is the new painting with your own hero in it (`shots/16`, `23`). It's eye-stealing, and Muse is clearly doing real work.
3. The weakest link is still the writing. The openers hide the real event behind fog words ("soft white faces", "pale fliers"), so the story never feels like *being inside* the news.
4. The second weakest is sameness. Same raccoon, granny and barista; the same sleepy, humming, lullaby stories; the same glowing magenta swirl in every painting. The writers' room examples cause part of this.
5. The payoff isn't reliable. In the live-news game, "This really happened" never showed up. The game went straight from "How it ended" to the keepsake.
6. One bug can hurt us with judges: Kai (they/them) gets called "his", "he" and "cameraman" on screen. Hero pronouns are never sent to the writer.
7. The humor is close but not there yet. The dry examples are good ("which is fine"), but live lines read flat or random ("drop lost socks on roofs as thanks").
8. Connection: the friend-idea mechanic works when it's visible. Too often the TV is dark during picking and ruling, and the phone is an empty black page.
9. Visual identity is split into three looks: a gorgeous attract screen, a flat terminal-style lobby, then a painterly game. The lobby, where judges spend their first 60 s, is the weakest screen.
10. With the 6 P0s below fixed and deployed, this goes from "cool hack" to "the one judges talk about". Each P0 is a prompt, data or one-component change, not a feature.

---

## Top 15 issues, ranked

### P0: fix before the 10 AM freeze

**1. The live site isn't the build we think we're testing.**
- Evidence: `/tv-preview` returns 404 live. The live game still shows "Needs 9+ (d20 + 3)" (`shots/20`) and "What are you weirdly good at?" (`shots/04`), which b51e750 removed. Our stories played the curated pumpkin story instead of my true story, which 2c54e21 says is fixed.
- Fix: deploy `rebuild-around-the-table` before the morning playtest. Put a build stamp (short commit hash) in the DM's Notes footer, so the CD, the partner and every agent know which build they're judging.

**2. Pronoun bug: a they/them hero is called "his", "he" and "cameraman".**
- Evidence: "Kai watches his phone clip and keeps filming, so he never asks…" (`shots/17`). Keepsake recap: "Kai kept filming his phone clip", badge "MOST LOYAL CAMERAMAN" (`shots/30`). Kai is `"pronouns": "they/them"` in `quickstart_heroes.json`.
- Cause: `host.ts` sends `hero: { name, power, weakness }` to `outcome` (~L2408) and to the ruling (~L1899) with no pronouns. Same for epilogue, recap and badges.
- Fix: pass `pronouns` for the acting hero and a `{name: pronouns}` map for all heroes into every writing call. Add one prompt rule: "Use exactly these pronouns." Add a cheap post-check: if a they/them hero's name sits in the same sentence as he/his/him/she/her, retry once or swap the pronoun.
- Why P0: "Human connection" judges and Meta's own values. One wrong pronoun on the big screen undoes a lot of goodwill.

**3. "This really happened" can silently disappear.**
- Evidence: the owl game went "How it ended" (`shots/28`), then about 14 s of dark screen (`shots/29`), then the keepsake (`shots/30`). The page text has no "Based on a true story" and no headline. The pumpkin game did show its reveal.
- Cause: `RevealCard` returns `null` when `host.realStory` is missing (QuickTV ~L984). Live-news stories can arrive without one.
- Fix: never skip the reveal. Build `realStory` from the news candidate the story came from (headline, source, date, link are all there when the 3-headline vote is built). If even that is missing, show the stamp plus the seed's `mapped_from` line. Add an assert to the bot playtest: "reveal phase shown with a headline".

**4. Openers hide the WHAT, when they should hide only the HOW IT ENDED.**
- Evidence: owls became "A loud town has soft white faces on a tall roof." / "The pale fliers are raising babies here and cannot sleep for staring." / goal "Find the pale fliers above the loud street" (`shots/09`, `10`, `11`). I only worked out they were owls from the third painting. The opposite mistake in the pumpkin story: "A 2-year-old grew a 280-pound pumpkin, and it won the fair." That gives away the real ending in line 1, so the reveal had nothing left to reveal.
- Fix (opener prompt + examples): **say plainly what the thing is and where** (owls, a pumpkin festival, a city roof). **Hide only the real outcome.** Ban made-up kennings ("pale fliers", "soft white faces", "the loud street"). design/28 already says "no invented jargon", but the opener prompt doesn't enforce it. Add 2 bad/better opener pairs to `BAD_EXAMPLES`:
  - Bad: "pale fliers". Better: "a family of snowy owls".
  - Bad: "it won the fair". Better: "the weigh-in is tomorrow morning".

**5. Same heroes everywhere.**
- Evidence:
  - All 3 style candidates are raccoon + grandma + barista (`style-candidates/*_scene_preview.jpg`).
  - 4 of 5 lobby paintings use the same ready-made trios (`shots/41`).
  - The make-hero placeholder is literally "a raccoon who works security at the mall" (`shots/04`; still in `Phone.tsx` on the branch).
  - Bots always pick ready-made heroes, so every test game has Gus, Juno, Kai or Pruitt.
  - The evals use Gus, Juno and Bev more than 100 times each (`scratchpad/evals/*.json`).
  - The main session's own latest run: Gus, Kai and Juno on the pumpkin again (`shots/43`).
- Result: the whole team has seen the same faces 200 times. That's the "tunnel vision" the CD feels, and the judges' table will see the same faces in the attract loop, the lobby and the game.
- Fix: see the Variety plan. Short version:
  - 18 ready-made heroes; bots and the attract loop draw from all of them.
  - Rotating placeholders that are never animals in uniform.
  - A fresh lobby loop painted with new heroes.

**6. Everything is about sleeping and humming.**
- Evidence:
  - `story-examples.ts` has 62 lines with sleep, snore, nap, hum, lullaby or yawn. The clock "snores twice as loud", the harbor guy "is asleep before the last one lands", the clock "yawns", the hum is everywhere.
  - Live titles: "The Pumpkin That Hums at Nap Time".
  - Eval titles: "The Bouncy Baby Nap", "The Napping Stone Grandpas", "The Sleepy Stone Twins".
  - Owls "cannot sleep for staring", "sleeping farm dogs", "Hum it the slow lullaby" (`shots/42`).
- The model copies the *theme* of the examples, not just their shape.
- Fix:
  - Rewrite the harbor game and the clock game so their twists aren't sleep or sound. Keep the elf game.
  - Add a `motifs_used_tonight` avoid list that the TV keeps across games: sleep, hum, glow, whisper, pale, plus each game's problem noun. Pass it to the opener and outcome calls as "don't lean on these".

### P1: big wins for the demo

**7. Dead air on both screens while the plan is picked and ruled.**
- Evidence: the TV dims to a dark painting with only "The DM rules on Mr. Pruitt's plan" (`shots/14`, `21`). The phone is one heading on a full black page (`shots/13`). On bot turns I couldn't tell what the plan was before the result. The pumpkin run did show the plan card, a few seconds late.
- Fix:
  - Show the plan card ("Kai's plan · + Sal's idea · +1") the instant the owner taps GO, before the ruling returns.
  - Phone: while waiting, show the scene thumbnail, the plan and big reaction buttons, not a black page.
  - One narrator "thinking" quip per ruling ("Muse is consulting the rulebook. There is no rulebook."). Pre-recorded, 8 variants.

**8. The plan I typed wasn't the plan that got judged, and credit gets invented.**
- Evidence: I typed "announce it's everyone's birthday downstairs and there's free cake". The outcome was "Sal names each watcher, with Kai's help…" (`shots/19`, `23`). My earlier tap on a suggestion probably selected Kai's card, with no visible selected state, and my text was ignored. The nat 20 said "with Sal filming", but Sal's idea was the lullaby; filming is Kai's thing.
- Fix:
  - A selected suggestion gets a clear checked state, and the textbox shows "Using Kai's idea" plus a ✕ to undo.
  - Typed text plus a selected idea are sent together as "plan + idea".
  - Credit names the idea ("Sal's lullaby idea"). It never invents an action for the friend.

**9. Ready-made traits hijack the story, and every success uses the same sentence.**
- Evidence: Kai's filming shows up in 3 of 6 outcome lines. Mr. Pruitt "goes blurry and scans the street" (a blur power used for looking). Every success uses "with X pointing / with X's help / with X filming".
- Fix: send `weakness` only on worse/setback grades (the rule in design/28 isn't enforced in code). Add the "with X's help" construction to the bad examples, and give 3 other ways to credit a friend.

**10. Lines that break the spell or make no sense.**
- Evidence:
  - "A perfect roll makes the pumpkin hum along" (game mechanics inside the fiction).
  - "The pale fliers take the fruit" (owls don't eat fruit).
  - "drop lost socks on roofs as thanks" (a random prop).
  - Moral: "Always pack extra crackers when the guests leave early" (crackers never appeared; `shots/30`).
  - Badge text: "STARRING RILEY'S MAKING PEOPLE LAUGH (MR. PRUITT), SAM'S ORGANIZING GROUP TRIPS (KAI) AND JO'S…" (all caps, unreadable).
- Fix:
  - Ban roll, dice, perfect, natural, DC and "needs" in narration.
  - The epilogue and moral may only use nouns that appear in the story log. One cheap check: retry if the moral has a noun not in the log.
  - Badge line becomes "Starring Riley (makes people laugh), Sam (plans group trips) and Jo (remembers every birthday)".

**11. "Right now" fights "The goal", and the obvious good idea gets punished.**
- Evidence: Right now said "Get the giant pumpkin to the festival scale" while The goal said "Get the pumpkin to take a nap before morning". The lullaby plan (exactly the goal) was ruled WILD, Needs 17+. After Kai's fail, Right now stayed the same (`shots/17`).
- Fix: right_now must be a sub-step that leads to the goal (add it to the now_goal rubric, plus 2 examples). The ruling sees both, and a plan that serves the big goal is never "wild" just because it skips the sub-step.

**12. Three visual identities. The lobby, the first impression, is the plainest.**
- Evidence: the attract screen is big painted art and a great logo (`shots/02`). The lobby is flat black with small monospace text and a "+ Add test player" link visible to judges (`shots/01`, `07`). The game is painterly neon (`shots/16`). The reveal is a cream newspaper (`shots/43`). The new phone v2 adds graffiti-neon plus 4 more type styles (`shots/42`).
- Fix:
  - Keep the attract painting behind the lobby (blurred and darkened, slowly crossfading) and the big drip logo in the lobby header.
  - Hide "+ Add test player" unless `?bots=1`.
  - Limit TV and phone to 2 display faces plus 1 body face.
  - Make the newspaper the *only* paper object, used on purpose for "real world" moments.

**13. Every painting's magic is the same glowing magenta and cyan swirl, and the heroes still read as Gravity Falls.**
- Evidence: contact sheet `shots/41`. Hand, aurora, rings, cracked dome, sky beam, eye, ribbon: 13 scenes and one neon-energy motif. That's the strongest "AI-generated" signal in the game. Kai (pink hair, braces-era face) reads as Mabel, and "Mabel" appears in `tv-preview` and `phone-preview` copy and in the `ThrowScreen` comment.
- Fix:
  - Scene prompt: "the fantasy twist is a concrete physical object made of the scene's own material (vines knitting a sweater, a mailbox with teeth). At most ONE glowing light source. No energy swirls, rings, beams or auras."
  - For the art style, pick **B (Neon Noir)** or **A (Kinetic comic)**, not C. C is the glossy look people recognize as AI.
  - Rename every "Mabel".

**14. The first 60 seconds for a judge has two blank waits.**
- Evidence: after "Make my hero" the phone shows "Your hero is being written and drawn. Hang tight" on a black page for about 10 s (`shots/05`). After START the TV shows black with particles for about 10 s (`shots/08`). The lobby promises "You'll vote on the story first" (`shots/07`), but I never saw a vote in Quick Tale.
- Fix: phone v2's card-with-shimmer (`shots/42`) solves the first; make sure it's live. TV: show the title card ("Tonight: …") at 0 s and let the opener fade in. Make the lobby line match what actually happens.

**15. The finale's words and numbers don't line up.**
- Evidence:
  - The TV said "Everyone: tap ARM on your phone" while my phone said "SHAKE!" (`shots/26`, `27`).
  - The TV showed "0 OF 3 PLANS IN" with 3 checkmarks.
  - I never saw the final die land in the owl game.
  - The pumpkin game's nat 1 flashed "1 +2 Charm = 3 · needed 11+", then "WELL, IT'S A STORY".
  - Smaller: "👋 SAL IS BACK" toast during the outcome (`shots/22`); "Hold to speak" (cream) is louder than "Send my plan" (`shots/24`), which goes against typing-first; the goal header top-left touches the Right-now pill at 1600 px (`shots/11`).
- Fix:
  - One verb per step on both screens.
  - Hold the final die big for 3 s: number, grade word, and one human sentence ("So close. The pumpkin is wide awake, but the festival loves it anyway.").
  - Suppress reconnect toasts during outcome and reveal.
  - Make the mic button secondary.

---

## Variety plan

| Thing | Today | Target for the demo | How to make it (cheap) |
|---|---|---|---|
| Ready-made heroes | 6 (raccoon, grandma, barista, influencer, cryptid, crossing guard) | **18** | One script: 12 new pitches written by the CD + Muse Spark (CD picks), portraits by muse-image in the chosen style, about 25 s each, run 6 in parallel, about 2 min. Mix ages, jobs and species, and at most 2 animals. Ideas: a retired magician who only knows one trick, a night-bus driver who knows every rider's secrets, a 9-year-old city council member, a lighthouse keeper who argues with fog, a mall Santa in July, a beekeeper with stage fright. |
| Bots' heroes | always ready-made, often the same trio | random from all 18, never the same trio twice in a night | `freeHeroIds()` shuffle + a "used tonight" list. |
| Placeholders | "a raccoon who works security at the mall" | 8 rotating, no animals in uniform | Array in `Phone.tsx`; pick by room code hash. |
| Lobby / attract paintings | 5 (boulder ×2, otter ×2, poster), the same heroes | **8**, each with a different hero trio and story | Reuse the quest scene art + new heroes through `/images/edits` (≈8 × 25 s). |
| Quest scenes | 8 quests × 3, one neon-swirl motif | same count, **one distinct twist per quest** | Re-paint only scene_1 of each quest with the "concrete object, one light" rule (8 images). |
| Curated story seeds | the pumpkin dominates (my run, the main run, the evals) | **12+**, rotated, no repeats within a night | Pull 20 candidates from the cached `/api/news` (no new SerpApi calls), CD picks 12 in 10 min. Keep a `seen_seeds` list on the TV (localStorage) so the judging table never gets the same story twice. |
| Writers' room themes | 3 example games, 2 of them about sleep or sound | 3 games with 3 different twist types (crowd, object, weather) | Rewrite 2 games (≈45 min). Keep the lint. |
| Narrator stock lines | 1 per beat ("Listen up. Plans in a moment", "Here's what happened", "The DM rules on X's plan", "Well, it's a story") | **6 per beat** × 4 voices | Write 6 variants per beat in the house voice (CD approves), pre-render the TTS once (about 100 short clips, cents), pick without repeats. |
| Motifs per night | none tracked | avoid list across games | `motifs_used_tonight` (see #6). |

---

## 5 bold-but-cheap ideas judges will remember

1. **Roast intros (0 new AI calls).** Each ready-made hero already has a great dry roast ("Gus takes this job very seriously. The mall never technically hired him."). We never show it. Give each hero a 3-second card slam in the lobby, read by the narrator. This is the CD's humor bar, already written, at zero cost.
2. **"Whose secret talent?" before the credits (connection + "I learned something about them").** Before "Starring…", the TV shows one talent ("Remembering everyone's birthday"), and phones vote on who it belongs to. Then the reveal. 15 seconds of the whole table looking at each other. It reuses the vote UI.
3. **One real detail, two fakes (makes the real-news reveal a game).** At the reveal, Muse writes 2 believable fake details. Phones vote on which detail really happened, then the article lands. The room argues, and Muse's role in it is obvious to a judge. One Spark call per game.
4. **The news anchor cameo.** The real headline is read by a different voice: a bright, local-TV news anchor, after a whole game of mysterious narrator. The tone flip gets a laugh every time and makes "this really happened" land. One TTS clip.
5. **Front-page keepsake: "LOCAL STRANGERS SAVE ___".** The keepsake becomes a newspaper front page in the same layout as the reveal card. The group's final painting is the photo, the recap is the article, the badges are pull quotes. People screenshot and share it ("we made the news"), which is the Meta-friendly ending. Pure layout, no new AI.

Bonus (zero code, pitch-side): coach the turn owner to **read their plan out loud** before tapping GO. The TV can say "Sal, read it to the table." It's the cheapest way to make people talk to each other instead of their phones.

---

## How this maps to Meta's scoring
- **Human connection (30):** #7, #8, ideas 2, 3 and "read it out loud". Today the friend-idea moment is real but often invisible.
- **AI essential (25):** strong already (paintings, narrator, rulings). #3 and #4 make the AI's best trick (real news → story → reveal) actually land.
- **Originality (20):** the reveal is the hook. It failed on the live-news run (#3) and was spoiled in the pumpkin run (#4).
- **Working demo (20):** #1 (deploy plus build stamp), #2, #15. Run 3 games back to back and check that no hero, title or motif repeats.
