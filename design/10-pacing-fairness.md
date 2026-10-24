# 10 · Pacing, Readability & Fairness

**Playtest (2 players):** "The story was way too hard to follow, neither of my answers were selected, it moved too fast."
The code explains all three complaints. This doc covers what the research says, what the code does now, and the fix.

## 1. What the best games do (sources checked Oct 2026)

- **Jackbox: one task at a time, and say when you're waiting.** The "Jack Principles" (Harry Gottlieb) frame the game as a live host talking to you. Pacing means one decision at a time, always knowing what's next, and making players "aware that the program is waiting for them." ([Built In](https://builtin.com/media-gaming/jackbox-games-design-party-pack))
- **Jackbox: the narrator reads aloud.** In Quiplash, host Schmitty reads every prompt aloud before the answers are revealed ([Windows Central](https://www.windowscentral.com/quiplash-review)). Every answer gets its own head-to-head matchup and a vote ([Jackbox](https://www.jackboxgames.com/games/quiplash-3)), so nobody's answer goes unseen.
- **Jackbox: timers are a setting, not a constant.** Party Packs ship **Extended Timers** and **No Timers** toggles, framed as giving players "extra time to hear or read prompts" ([PP10 accessibility](https://www.jackboxgames.com/blog/accessibility-features-in-the-jackbox-party-pack-10)). In PP8, Job Job's No-Timer mode moves on once everyone has submitted answers and votes ([PP8](https://jackboxgames.com/streaming-moderation-accessibility-features-jackbox-party-pack-eight)). A Jackbox developer said they lengthened timers for Twitch, but going further meant waiting on players who weren't responding ([Steam](https://steamcommunity.com/app/331670/discussions/0/611698195168609949)). Lesson: **auto-advance when everyone is done, keep a fallback timer for stragglers.**
- **Kahoot** shows the question alone (~5 s) before answers; teachers ask for more "think time"; no built-in read-aloud ([community](https://support.kahoot.com/hc/en-us/community/posts/360028793713-Longer-Think-Time-before-students-can-actually-answer), [CU Boulder](https://www.colorado.edu/digital-accessibility/kahoot-accessibility-summary)). Separate *reading* from *answering*.
- **Among Us** gives **Discussion** its own phase before **Voting**; a common setup is 45 s talk, 30 s vote ([PCGamesN](https://www.pcgamesn.com/among-us/settings-best)).
- **Dixit / Wavelength** rotate the spotlight: storyteller passes clockwise ([Wikipedia](https://en.wikipedia.org/wiki/Dixit_(board_game))); a new Psychic each round ([rules](https://officialgamerules.org/game-rules/cmyk-wavelength/)).
- **Mario Party** puts an instruction-and-practice screen before every minigame ([manual](https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_ds_21/Manual_NintendoDS_MarioPartyDS_EN.pdf)).
- **Quarterbacking:** in open-information co-op, one player decides for all ([Justin Gary](https://justingarydesign.substack.com/p/the-quarterback-problem), [Meeple Mountain](https://www.meeplemountain.com/articles/benching-the-quarterback-how-to-deal-with-alpha-players-in-co-op-games/)); fix: give each player a decision only they own.
- **TTRPG GMs** keep the spotlight moving, some with a checklist of who has acted ([Gnome Stew](https://gnomestew.com/troys-crock-pot-tracking-that-spotlight-time/)).

**Reading and the 10-foot UI**
- **Reading speed:** the average adult reads **238 wpm** silently (nonfiction) and **183 wpm** aloud (Brysbaert 2019, [doi:10.1016/j.jml.2019.104047](https://doi.org/10.1016/j.jml.2019.104047)). Subtitle practice is commonly cited at roughly 160–180 wpm (BBC) and 20 characters/s (Netflix English), with two lines max ([Netflix TTSG](https://backlothelp.netflix.com/hc/en-us/articles/215758617)). (Subtitle figures via secondary sources.)
- **Type size:** at 1080p, TV text should be **28 px minimum**, "aim to exceed it" ([Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/use-an-easily-readable-default-font-size/), citing Amazon). Android TV favors larger type and plain faces, and reserves display styles for short text ([Android TV typography](https://developer.android.com/design/ui/tv/guides/styles/typography)). Amazon asks for low information density ([Amazon](https://developer.amazon.com/sdk/asb/ux-guidelines.html)).
- **Text-to-speech:** browser `speechSynthesis` is free and has an `end` event we can hold on ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)).

## 2. Diagnosis of our build

Sources: `rules.ts`, `host.ts` (`readMs` = 330 ms/word, clamped 7–16 s), `TV.tsx`, `Phone.tsx`, and the word caps in `server/prompts.ts`.

| Phase | Timer now | Max words on TV | Words/min required | Verdict |
|---|---|---|---|---|
| Quest intro | readMs, 9–20 s | premise 62–77 (seeds) + title | 77 w / 20 s = **231** | Borderline; auto-advances |
| Narrating | AI ≤16 s, then readMs **7–16 s** | narration 55 + NPC 18 + banner 6 = **79** | 79 / 16 s = **296**, ~**400** after TypeReveal | **Too fast.** Text then **disappears** |
| Pitch | **25 s** (30 s rescue). SPEC says 20 s. Ends instantly when all sealed | TV: situation ≤18. Phone: situation + 3 chips + 2 checkboxes + mic | Read + decide + type in 25 s | Tight; abrupt cut |
| Vote | verdicts ≤9 s, then **12 s**. Ends instantly when all voted | per card: name + pitch (≤200 chars, ~35 w) + stamp + quip 14 ≈ **50 w**; 6 players ≈ 300 | 300 / 12 s = 1500 | **Unreadable at 4+ players** |
| Roll | 10 s (auto-roll), anim 1.8 s | ~20 | — | OK |
| Catch | 6 s | 12 | — | OK |
| Outcome | AI ≤12 s, then readMs **7–16 s** | headline 4 + narration **75** (with supporting beats) | 79 / 16 s = **296** | **Too fast**, then jumps to the next scene |
| Final roll / result | 12 s / **4.5 s** | ~15 | — | Result flashes by |
| Epilogue | readMs 10–**22 s** | **90** | 245 | Fast |
| Reveal | **20 s** fixed | headline + summary + 2 mappings ≈ 100 | 300 | Fast for the key Meta moment |

**Why "hard to follow":**
1. Narration is the only telling of the story, on screen ≤16 s, then replaced by an 18-word `situation`.
2. `quest.goal` is never rendered on the TV; `recap_of_previous` is generated and dropped.
3. Text is under the 28 px floor: narration 26 px, pitch wall 20 px, italic quips at default size, seals 14/12 px.
4. `TypeReveal` (380 ms/phrase) eats 4–5 s of each hold.
5. Every reading phase auto-advances; the only control is "Continue ▸", which skips.

**Why "neither of my answers were selected"** (2 players):
- Quick Tale has only **2 pitch rounds** (the climax is the Final Roll).
- No self-votes, so a 2-player vote is always a **1–1 tie**, and `endVote` breaks ties by **tier rank before "times picked"**: the CLEVER-stamped player wins every round.
- Miss the 25 s cut and the other pitch auto-wins, no vote.
- "Supporting pitches" are ≤8-word clauses buried in a 75-word paragraph shown ≤16 s; the phone says "Eyes on the table." The loser never sees their idea land.

## 3. Pacing model

**Three kinds of phase:**

| Kind | Phases | Rule |
|---|---|---|
| **Read** (all-ready) | quest intro, every narration beat, outcome beats, epilogue, reveal | Advance when **every phone taps Ready ✓** *or* the host taps Continue. Fallback = `hold()` max. Show a "Ready 1/3" seal row. |
| **Act** (timed + all-submitted) | pitch, cheer, final roll | Timer plus auto-advance on all-submitted, after a **1.5 s "All plans sealed!" beat** (never an instant cut). |
| **Moment** (spotlight) | each roll, catch | Hero-tap with a generous fallback. |

**Timer values** (`rules.ts`; make the phone `Timer` read totals from state instead of hard-coding 25000/12000):

| Constant | Now | New |
|---|---|---|
| PITCH_MS | 25 s | **35 s** first round, **30 s** after (rescue 35 s) |
| VOTE_MS → CHEER_MS | 12 s | **15 s** |
| ROLL_MS (per hero) | 10 s | **8 s** fallback auto-roll |
| CATCH_MS | 6 s | **7 s** |
| FINAL_ROLL_MS | 12 s | **15 s** |
| final_result | 4.5 s | **7 s** |
| reveal | 20 s fixed | **Read phase**, fallback 30 s |
| Extended timers (lobby toggle) | — | ×1.5 on everything (Jackbox precedent) |

**Reading-time formula** (replaces `readMs`):

```
hold(words, phrases) = reveal + max(5 s, words × 333 ms) + 1.5 s settle
  reveal  = phrases × 250 ms        // speed TypeReveal up from 380 → 250
  333 ms/word = 180 wpm             // group reading at 10 ft; between oral (183) and BBC subtitle pace
  clamp: min 6 s, max 25 s per beat
If "Read it to me" is on: hold = max(hold, TTS end + 1.2 s)
All phones Ready → advance 0.8 s later.
```

A 25-word beat holds ~13.5 s worst case, ~7 s with Ready taps. Keep the cap; cut words instead.

**Phone affordances in Read phases** (they replace "Eyes on the table"):
- **Right now:** one ≤12-word line, plus your goal.
- **Ready ✓:** a big button. Your seal on the TV turns gold.
- **🔊 Read it to me:** any player can toggle it. The TV speaks each beat with `speechSynthesis` in a slow narrator voice (rate 0.95), and the hold extends to the end of speech. Default **on** for the judge demo: it doubles as the Jackbox narrator.
- **✋ Wait:** adds 10 s, once per beat. This fixes "moved too fast" without slowing fast tables.

## 4. Fairness model: **"Everyone Acts"** (recommended)

| Option | 2 players | 6 players | 4-min fit | Problem |
|---|---|---|---|---|
| Vote, winner rolls (now) | always a tie; one player may never win | 4 of 6 lose each round | ✓ | The playtest complaint |
| Rotating spotlight | 1 round each | 2 rounds → **4 heroes never act** | ✗ | Breaks at 3+ |
| Team Up | fine | still 4 left out | ✓ | Partial |
| **Everyone Acts** | both act every round | all 6 act | ✓ (~4–8 s per hero) | One longer narration (we budget it) |

**Rule:**
- **Every pitch resolves every round** with its own d20 (stat + tier as now).
- Voting becomes **Cheer ⭐**: each player stars one other plan, and the most-starred plan (ties: all of them) rolls with **advantage** and resolves *last* as the headline beat. Social voting survives, nobody gets eliminated, and in a 2-player game both players can earn advantage.
- **Hope:** each band applies today's rules, capped at **−2 net per scene**. Catastrophe still causes peril; in a rescue the hero in peril cheers, and *any* success saves them.
- **Catch!** stays as one combined 7 s window after the roll call.
- **Latency:** dice are pre-rolled at verdict time (SPEC rule), so **one** `outcome` call fires while the roll call plays; re-fire only on a Catch.
- **Outcome schema:** `headline ≤4 w`, `hero_lines[{hero_id, line ≤15 w}]`, `now ≤15 w`, plus existing titles/peril/canon fields.

### Quick Tale flow (2–6 players, ~4 min with 2–3 players)

| # | TV | Phone | Advance |
|---|---|---|---|
| 0 | **Quest card:** painting, title, 2 beats ≤25 w. The Quest panel slides in. | "Your goal: …" + Ready / 🔊 / ✋ | All ready, ≤25 s |
| 1 | **Scene beats** (2 × ≤25 w, Ken Burns pan per beat), banner, then "Right now" fills in | Right now + Ready | All ready per beat |
| 2 | **Pitch:** big "Right now" situation, seals "sealed ✓" | situation, 3 chips, mic, ability/flaw toggles | 35/30 s or all sealed + 1.5 s |
| 3 | **Plan board:** one card per hero showing the AI *interpretation* (≤15 w, not the raw text), stamp, quip ≤10 w | other plans, each with ⭐ Cheer | 15 s or all cheered |
| 4 | **Roll call:** weakest stamp first, cheered plan last. Hero portrait, plan and DC, "Mira, roll!" Die, then band stamp. | Your turn: big ROLL. Others: "Mira's rolling…" + reactions | tap or 8 s each; result holds 2.5 s |
| 5 | **Catch?** failed dice glow | catchers: CATCH! | 7 s or tap |
| 6 | **Outcome:** headline, then 1 beat per 2 heroes (portrait + band chip + their line), then a "Now:" beat | **"Your moment:"** your line + Ready | all ready per beat |
| 7 | Repeat 1–6 for the Twist scene | | |
| 8 | **Climax:** 1 beat, then **Final Roll** (everyone, as now) | ROLL | 15 s or all rolled |
| 9 | Result 7 s → **Epilogue** in 3 beats ≤30 w | Ready | all ready |
| 10 | **Reveal** (Read phase), then storybook (host-paced, as now) | "Read the real story" link | Continue |

**Budget for 3 players:** intro 15 + 2 × (beats 15 + pitch 30 + cheer 12 + roll call 3 × 5 + outcome 18) + climax 10 + final 10 + result 7 + epilogue 15 + reveal 20 ≈ **4:30**.
- Ready taps usually trim this to about 4:00.
- For the judge demo, run 2 players and leave 🔊 on.

## 5. Readability rules

**Persistent "Quest panel"** (TV, top-right, always visible after the intro; replaces the title in `TopBar`):
- **QUEST:** `goal` rewritten to ≤10 words (new seed field `goal_short`).
- **RIGHT NOW:** the latest `situation` or `now`, ≤12 words.
- **SO FAR:** the last outcome headline plus each hero's band dot, or the `recap_of_previous` we already generate.
- Hope hearts and "Scene 2 of 3."

The phone header mirrors QUEST and RIGHT NOW, plus **YOUR GOAL**: your hero's line from `suggestions`, or "Help the party: <goal_short>".

**Word budgets** (enforce in `prompts.ts` and truncate server-side):

| Text | Now | New |
|---|---|---|
| Narration beat | 1 × 55 w | **2 beats × ≤25 w** (array) |
| NPC line | 18 w | 12 w, shown as its own beat |
| Situation / now | 18 w | **12 w** |
| Pitch card on TV | raw text ≤200 chars | interpretation ≤15 w + quip ≤10 w |
| Outcome | 1 × 60–75 w | headline 4 + **15 w per hero** + now 15 |
| Epilogue | 90 w | 3 beats × ≤30 w |
| Any TV screen | — | **≤40 words visible at once** |

**Big-text rules (1080p):**
- Narration ≥ **44 px** (2.75rem). Situation/"Right now" ≥ 48 px. Pitch cards ≥ 32 px. **Nothing that must be read below 28 px.** Seal names go up to 24 px and become decoration only.
- Lines ≤ 42 characters, 3 lines per beat max, left-aligned. Body text in roman (non-italic) EB Garamond, never Cinzel Decorative.
- Ink on parchment at ≥ 7:1 contrast. No text over the painting without a solid plate.
- One image per beat (pan/crop of the scene plate, or the acting hero's portrait), so the eye knows *who* the sentence is about.
- Keep text on screen until the phase ends. The pitch phase still shows the last beat in small type under "Right now," so nothing vanishes mid-thought.

## 6. Code checklist

`rules.ts` timers + `hold()`. `host.ts`: per-beat Ready set; `cheer → rollCall → catchAll → resolveScene`; one outcome call per scene (if Vote is kept, tie-break fewest-picked *before* tier). `prompts.ts`: beats, `hero_lines`, caps. `TV.tsx`: QuestPanel, beats, font sizes, RollCall. `Phone.tsx`: Ready/🔊/✋, Your moment, Cheer, timer totals from state.
