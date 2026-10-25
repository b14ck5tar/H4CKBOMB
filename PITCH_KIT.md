# PITCH KIT: Group Project (judge table, Sun 2-5 PM, WEL)

Written Sun ~4 AM (laptop clock) from GAME.md, design/13, 22, 25, 27, PITCH_CARD.md, pitch/deck.html, DEVPOST.md,
DECISIONS.md and the code (`game/src/lib/host.ts`, `features.ts`). Status: first full pass, written fast. Re-check
section 3's timing with a stopwatch before judging.

## 1. The one-liner and the 30-second pitch

**One-liner (say it):** "A party game where nobody has to be the Dungeon Master."
**Tagline (on screen):** "The one group project where everyone actually shows up."

**30 seconds (say it):**
> "Last time you hung out with friends, how much of it was everyone on their own phone? Game nights fix that, but
> someone has to run the game, so nobody plays. Here, Meta's Muse is the Dungeon Master. The TV is the table, your
> phone is the controller. On your turn your friends send you ideas, and using one is your best move. You swipe to
> throw the die, Muse paints what happens, and at the end you find out it was based on a true story. Scan this."

## 2. The 2-minute pitch (spoken, one beat per criterion)

- **Problem / connection (0:00-0:25), CD:** "Think about your last hangout. Everyone on their own phone. Tabletop
  games fix that: everyone gets a role and a reason to talk. But somebody has to prep and run it, so most groups never
  play. We made the AI the host, so the humans can just talk to each other."
- **The loop / connection (0:25-0:55), CD:** "On your turn the TV says 'Sam, tell the table your plan.' Everyone
  else sends you an idea from their phone. Use a friend's idea and you get plus one and their name goes on screen.
  The best move in the game is listening to your friends. The finale: everyone backs someone else's plan, then the
  whole table shakes their phones for one shared die."
- **AI essential (0:55-1:25), CD or partner:** "Muse runs the whole night. It picks stories from this week's odd
  news that are safe and actually playable, writes the opening, reads your plan at face value and says how hard it
  is, writes what happens at exactly the number you rolled, and paints your own heroes into a new scene every
  turn. Take Muse away and there is no game. Code rolls the dice; the AI never picks a number or rates a person."
- **Originality (1:25-1:45), CD:** "And the twist: every story really happened. At the end: 'Based on a true story,'
  the real article, and 'Solved by' the secret talent you typed when you joined."
- **Working demo (1:45-2:00), CD:** "You don't have to take our word for it. Scan this, you're in."

## 3. The table run-of-show (4-minute judge visit)

### Timing verdict: a 4-judge game does NOT fit in 4 minutes

The new rule (DECISIONS Sun ~5:15 AM, working copy of `host.ts` `makeTurnOrder`): 2-4 players = 2 turns each, no cap.
Built from the code's own timers (Quick Tale):

| Step | Seconds | From |
|---|---|---|
| Scan + make a hero | 40-60 | design/27 |
| Title card + opener read aloud (~38 words) | ~23 | `TITLE_CARD_MS` 5.2 s + narration |
| One turn: ideas + pick (timer 45 s, ends when the owner picks), ruling 3 s, swipe up to 8 s, die 2.4 s + meter 3.4 s, outcome read ~9 s | 45-60 | `QUICK_TURN_MS`, `ROLL_ANIM_MS`, `ROLL_HOLD_MS`; real runs measured ~60 s/turn (design/33) |
| Finale: plans, 12 s vote, shake ritual ~18 s, result 3.5 s | 65-80 | `FINAL_*_MS` |
| "Because of you" montage + reveal | 30-40 | `MONTAGE_PANEL_MS` 4.8 s per panel |

- **4 judges x 2 turns = 8 turns: ~9-10 minutes.** Over by more than double.
- 4 judges x 1 turn = 4 turns: ~6-6.5 min. Still over.
- **3 turns total: ~5 min. 2 turns total: ~4-4.5 min.**

**Recommendation (needs a small code change, CD call + builder):** a judge-table setting on `/tv?judge=1`:
**1 turn each, at most 3 turns in total**, then the finale where everyone plays. Why: it is the only setting that
lands the reveal (our best moment, and the "come back" hook) inside the visit. Every judge still suggests on every
turn and plays the finale, so nobody sits out. With 4 judges, the 4th judge gets the first finale plan and is named
by the CD ("you're the closer"). Keep the 45 s typing timer (30 s was too tight in the persona sim); the turn ends
early anyway. If the change can't be made: seat at most 2 judges as players per game (2 x 2 = 4 turns, ~6 min) and
tell extra judges "watch the reveal, then you're next".

### Before the judge arrives
- **Where:** laptop (the TV) facing the judges; CD stands beside the screen facing the judges; partner (ENG) sits
  behind the laptop with the hotkeys. Printed QR card next to the screen.
- **On screen:** the attract loop (press **A**, or it starts after 20 s idle): painted heroes in scenes + the QR.
  Between groups the deck's last slide (QR) also works.
- **Mode:** Quick Tale, Odd news, Teens, on `/tv?judge=1&bots=1` (`judge=1` always plays a saved, tested story; no
  waiting on live news). Warm up with one full game 10 minutes before (wakes Muse, checks the narrator).

### Joining fast
- They scan the lobby QR (it carries the 4-letter room code). Backup: `groupproject-game.vercel.app/play` + the code.
- CD: "No app, no account. One line for your hero, or tap a ready-made one, they're instant."
- One judge alone: ENG joins from a team phone and adds one test player (**B**). Say "Riley is a test player the TV
  runs." Never pass a bot off as a person.

### Second by second (with the 3-turn judge setting)
| Clock | Who | Do / say |
|---|---|---|
| 0:00 | CD | 30-second pitch (section 1), hand them the QR on "Scan this". |
| 0:20 | Judges | Make heroes. CD: "Muse is painting you as a cartoon right now." |
| 0:50 | ENG | Start. CD: "This story hides something that really happened. You find out at the end." |
| 1:00 | CD | Over the opener, once, quietly: "Muse wrote this, cast that narrator and painted you in." Then stop talking. |
| 1:20 | CD | Turn 1: "Everyone else, send [A] an idea. [A], use a friend's and you get plus one." Coach: "Which one made you laugh?" Then silence. |
| 1:50 | CD | "Swipe up to throw." On the meter: "Every number is its own outcome. Code rolls, never the AI." |
| 2:00-3:15 | Judges | Turns 2-3. CD only says whose turn it is. |
| 3:15 | CD | "Last move. Everyone back one plan, not your own. Then everyone shakes at once." |
| 4:15 | CD | Reveal: let it sit 3 s. Point: "That's the real headline." "And that's the talent you typed." "Take it home" (keepsake QR). |
| 4:45 | CD | The close (below). ENG takes questions. |

**Who talks:** CD runs the table and the story. ENG says nothing until a build or AI question, then answers it so
the CD can keep the table playing. Nobody types for a judge.

**The close (one breath):** "Your friends' ideas were your best move. Muse wrote, judged and painted every decision;
code rolled the dice. It was based on a true story. And you just played it."

**The hook to come back:** "Every table gets a different true story. Come back with a friend and play another."

### If something breaks
| Problem | Do |
|---|---|
| Muse slow | Say nothing. Every AI call has a canned fallback that still names the plan; the old painting stays up until the new one fades in. |
| Narrator silent | Text still shows. "Tonight the narrator is shy." |
| Wi-Fi drops | Timers pause while every phone is offline. ENG moves the laptop to the phone hotspot; judges rescan. |
| Hotspot fails too | Play the backup video (on the laptop and a phone) and talk over it. |
| Freeze | ENG reloads the TV (F5); new code, everyone rescans. Twice = video. |
| Judge in a hurry | 30-second pitch + the keepsake QR from the last game. |
| Judges arrive mid-game | "Watch the reveal, it's the best part, then you're next." |

## 4. "What did the AI do?" (30 seconds, partner)

> "Muse Spark is the Dungeon Master. It scores this week's odd news for safety and whether it's playable, writes the
> opening, reads each plan literally and says how hard it is, then writes what happens at exactly the number you
> rolled, following written story rules so it stays logical. Muse Image paints your heroes into a new scene every
> turn. Muse Voice Transcribe lets you speak your plan instead of typing. And our Muse connector lets Muse, the
> agent, start a game night. Press N for DM's Notes: every call it made and why. One part isn't Meta: the
> narrator's voice is OpenAI, because Meta has no text-to-speech model. Code decides every number."

- **Why essential:** no Muse = no story, no rulings, no outcomes, no paintings. It is the host, not a garnish.
- **Explainable:** DM's Notes (N) logs each ruling, the progress decision with one line of why, and fallbacks.

## 5. How we built it (short story, partner)

> "Our creative director is at their first hackathon and made every creative call. Claude Code was our lead engineer,
> running parallel agents: builders, a story director, designers, testers and reviewers. In about 14 hours we made
> **165 commits** and wrote **35 design docs** (about 5,700 lines). Fresh-eyes agents played the game cold and told
> us what broke. Agents watched our playtest recordings frame by frame; our worst run is why we threw out the
> scripted story and built story rules. A **100-persona simulation** flagged friction (30 s to type was too tight).
> A writers' room of hand-written examples set the house voice. And we bake-offed models on our real job: a better
> rubric took Muse Spark from 5 of 8 fair rulings to 8 of 8, and in a blind test of 5 writers Spark won."

Numbers checked Sun ~4 AM: 165 commits on `rebuild-around-the-table` (first 13:54 Sat, last 03:54 Sun; `git log`),
35 `design/*.md` files (5,746 lines), 100 personas (design/32), 5/8 to 8/8 (design/23), 5 writers (design/26),
32-scenario stress test (commit 8eed30a). Re-count commits the morning of.

## 6. Judge FAQ

1. **What's real vs AI?** The story's starting event is real (a real article, or a player's true story). The heroes,
   the twist and everything that happens are Muse's; the dice and every number are code.
2. **Safety with real news?** A keyword block, then Muse scores each story: no deaths, injuries, crime with victims,
   war, politics, health scares or named private people. Heavy news is a future, opt-in mode, not tonight.
3. **Why not just ChatGPT?** A chatbot is one person and a screen. This is a room: one shared table, phones as
   controllers, friends feeding each other ideas, real dice and a reveal.
4. **A shy player?** Typing is the default, so nobody has to speak. Friends send you ideas, so you never face a blank
   box. A timer picks a friend's idea if you freeze.
5. **Replayability?** A new real story every day from the news, plus Our stories from your own lives. 18 heroes or
   your own, 4 narrators, 6 art themes.
6. **Cost?** About 20 cents for a Quick Tale by our math from published prices (paintings ~1 cent each). Not measured
   on a real game yet; say "about".
7. **What's next?** Section 7's top 3.
8. **vs AI Dungeon?** AI Dungeon is one player typing to an AI. We're a room of friends, and the AI is only the host.
9. **vs Jackbox?** Jackbox is competitive and hand-written. We're co-op (win or lose together), every story is new
   and true, and your heroes appear in the art.
10. **What if the AI says something bad?** Player text goes in as in-world speech inside a strict format; we threw 32
    hostile scenarios at the DM. If a check fails the game uses a canned line. The AI judges plans, never people.
11. **Privacy for Our stories?** No accounts, no player database. Words go to Muse to run the game, and the phone says
    so. The keepsake lives in the link. We never use Meta's `-contributor` models (code refuses to start with one).
12. **Can the AI cheat the dice?** No. Crypto random numbers in code; the AI only picks a difficulty tier.
13. **Why OpenAI for the voice?** Meta has no text-to-speech model. We compared voices by ear; Gemini is the backup,
    text the last fallback. Meta's rep told us to pick the best model per job.
14. **How do you keep the story logical?** Code holds the story state (place, problem, facts, progress) and checks
    every outcome: it must use your words, never undo a win, stay short. One retry, then a fallback.
15. **Can a great roll save a dumb plan?** Yes, sometimes. Wild plans get a big minus, so they need a big roll.

## 7. What's next (proposal-only)

**Pitch these 3 (one line each):**
1. **Campaign mode:** "Your heroes carry over into the next story and grow from what they did, like a real D&D
   campaign." Strongest for Meta: it turns one night into a crew that comes back (connection over time).
2. **Our stories first:** "Every player brings a small true story, and the night becomes 'I didn't know that about
   you.'" Built today; next is making it the main mode. It came from Meta's own rep.
3. **Real World mode, with guardrails:** "Opt-in heavier news for groups who want to talk about things that matter:
   whole-table opt-in, skip any time, a human approves every story." (design/16)

**Parked (and why):**
| Idea | Why parked |
|---|---|
| Weekly chapters | Folds into Campaign mode; pitch it as one idea. |
| Remote play (`/watch` exists) | Fine as a one-line answer if asked; weaker for "in the room" connection. |
| Local news (city to state to national) | Thin pool, often crime or politics (design/17). |
| Judges' Saga (earlier tables' heroes cameo) | A table gimmick, not a product. |
| Real-life side quests / meetups | CD: no real-life stuff outside the game. |
| Messenger video-call mode, classroom mode, quest packs (design/04) | Business talk; distracts from the demo. |
| Skill meter before each roll | On hold (DEC Sat 10 PM). |
| Bold ideas: roast intros, talent vote, real-vs-fake, anchor cameo, front-page keepsake | Parked by the CD (Sun ~2 AM). |
| Mirror, Catch, Boost, clues, Convince the DM, danger meter | Cut; never mention. |

## 8. Body language and talking tips

- Hand them the QR first, talk second. Let the judges play; their phones are the demo.
- Face the judges, not the screen. Talk to each other (CD to partner hand-offs), not at the judge.
- When judges argue about an idea, stop talking. That silence is the human-connection score.
- Don't explain rules; the first turn teaches the game. Don't apologize for a slow painting.
- Smile at a bad roll: "A bad roll makes it funnier."
- **Memorize these 3 sentences:**
  1. "The one group project where everyone actually shows up."
  2. "On your turn your friends pitch you ideas. Use one and they get the credit."
  3. "Every story is based on a true story. You find out which one at the end."

## 9. Rehearsal checklist (morning)

- [ ] Final build merged to `main` and deployed; open the live `/tv` and check "tell the table your plan", the 3 act
      dots and no danger meter.
- [ ] Decide the judge-table setting (section 3) and test it.
- [ ] Two stopwatch runs of a judge visit with 3-4 people on phones. Target: reveal before 4:30.
- [ ] Narrator audible on the deployed site; volume ~70% in a loud room.
- [ ] Hotspot tested; backup video on the laptop and a phone; spare phones on `/play`.
- [ ] Both say the 30-second pitch and the close out loud twice.
- [ ] Partner says the "What did the AI do?" answer in 30 s.
- [ ] Read the "Don't say yet" list once more.

## Don't say yet (not built, not tested, or not true on the live site)

- **"Play it now at groupproject-game.vercel.app"** until the merge: at ~4 AM the live site still runs the old build
  (it shows the danger meter and "RISKY", and has no "tell the table" line). `origin/main` is 48 commits behind.
- **"2 turns each" / "4 minutes"** for a 4-judge game: it's ~9-10 minutes (section 3).
- **"Nothing is saved after"** (phone footer): narration audio and paintings are cached in the server's temp folder.
  Say "no accounts, no player database".
- **"About 20 cents a game"** as a measured fact: it's an estimate.
- **Danger meter, Needs 12+, Mirror, Catch, Boost, clues, Convince the DM:** cut.
- **"Hybrid progress feels 9/10"**: tuned in a script, no CD sign-off recorded.
- **The Muse connector live** until it's checked on the deployed URL after the merge.
- **Campaign mode, Real World mode, weekly chapters, remote play:** proposals only; say "next".
