# PITCH KIT: Group Project (judge table, Sun 2-5 PM, WEL)

Verified Sun ~4:30 AM (laptop clock, CDT), line by line, against GAME.md (469418e) and the code (`lib/host.ts`, `lib/rules.ts`,
`lib/grade.ts`, `components/Presenter.tsx`, `server/tts.ts`, `server/news/candidates.ts`, `server/muse.ts`).
Pocket version: `pitch/CHEAT_SHEET.md`. Morning drill: `pitch/REHEARSAL.md`. Stage pitch (5:30 PM): PITCH_CARD.md.

**Who is at the table (DECISIONS Sun ~1 AM):** the CD is at work 11 AM to ~4:30 PM and back ~4:45. **The partner
runs the judge table alone from 2:00 to ~4:45**, and both are there for the last 15 minutes and the 5:30 stage
pitch. So every line below is written for one person. HOST = the person talking to judges. With two people, the
second person is DRIVER (laptop, hotkeys, tech questions).

## 1. The one-liner and the 30-second pitch

**One-liner (say it):** "A party game where nobody has to be the Dungeon Master."
**Tagline (on screen):** "The one group project where everyone actually shows up."

**30 seconds (say it while they scan):**
> "Last time you hung out with friends, how much of it was everyone on their own phone? Game nights fix that, but
> someone has to run the game, so nobody plays. Here, Meta's Muse is the Dungeon Master. The TV is the table, your
> phone is the controller. On your turn your friends send you ideas, and using one is your best move. You swipe to
> throw the die, Muse paints what happens, and at the end you find out it was based on a true story. Scan this."

## 2. The 2-minute pitch (spoken, one beat per criterion)

- **Problem / connection (0:00-0:25):** "Think about your last hangout. Everyone on their own phone. Tabletop games
  fix that: everyone gets a role and a reason to talk. But somebody has to prep and run it, so most groups never
  play. We made the AI the host, so the humans can just talk to each other."
- **The loop / connection (0:25-0:55):** "On your turn the TV says 'Sam, tell the table your plan.' Everyone else
  sends you an idea from their phone. Use a friend's idea and you get plus one and their name goes on screen. The
  best move in the game is listening to your friends. The finale: everyone backs someone else's plan, then the whole
  table shakes their phones for one shared die."
- **AI essential (0:55-1:25):** "Muse runs the whole night. It picks odd news that's safe and actually playable,
  writes the opening, reads your plan at face value and says how hard it is, writes what happens at the grade you
  rolled, and paints your own heroes into a new scene every turn. Take Muse away and there is no game. Code rolls
  the dice; the AI never picks a number or rates a person."
- **Originality (1:25-1:45):** "And the twist: every story really happened. At the end: 'Based on a true story,' the
  real article, and 'Solved by' the secret talent you typed when you joined."
- **Working demo (1:45-2:00):** "You don't have to take our word for it. Scan this, you're in."

## 3. The table run-of-show (judge mode)

### The setting: `/tv?judge=1`
Decided (DECISIONS Sun ~5:45 AM): **1 turn each, at most 3 turns, then the finale everyone plays.** `judge=1` also
always opens on a saved, tested true story (`host.ts` `judge`), so the table never waits on live news. The turn cap is
built (0121947, in main). `judge=1` also forces Quick
(a7b3214). Check the cap on the deployed site before 2 PM (3 judges = 3 turns).

### Timing (from the code's timers, Quick Tale)
| Step | Seconds | Source |
|---|---|---|
| 30-s pitch while they scan + make heroes (overlapped) | 45-60 | design/27 |
| Opener: painting + narrator (~38 words) | 20-25 | `openStory` |
| One turn: ideas + pick (45 s cap, ends early once everyone has sent), ruling 3 s, swipe (8 s cap), die 2.4 s + meter 3.4 s, outcome read ~10 s | 45-65 | `QUICK_TURN_MS`, `ROLL_ANIM_MS`, `ROLL_HOLD_MS` |
| Finale: plans (45 s cap), vote 12 s, ruling 2.8 s, shake, result 3.5 s, outcome read | 60-80 | `startFinale`, `FINAL_*_MS` |
| "Because of you" (≤ 3 panels × 4.8 s + ending line) + reveal | 30-40 | `MONTAGE_PANEL_MS` |

- **3 judges (3 turns): about 5 min from Start, about 6 min from hello.**
- **2 judges, or 1 judge + you (2 turns): about 4:30 from Start, about 5:15 from hello.**
- The finale can come early: when the finish line is in reach, the game goes straight to it (`finaleNext`).
- Judges are said to stay about 4 minutes. So **set the length up front**: "It's a whole game in about five minutes. The
  best part is the last 30 seconds." Two stopwatch runs in rehearsal decide whether we keep max 3 (see the flag in
  section 10).

### Before the judge arrives
- **Where:** laptop (the TV) facing the judges, sound ~70%. HOST stands beside the screen facing the judges. Printed
  QR card next to the screen. With two people, DRIVER sits behind the laptop.
- **On screen:** the lobby. While nobody has joined, the lobby is its own attract screen (the big QR and a pitch
  line, `Lobby.tsx`). There is no attract hotkey any more.
- **URL:** `https://groupproject-game.vercel.app/tv?judge=1&bots=1`. Lobby buttons: **Quick**, **Odd news**,
  **Teens**. Warm up with one full game 10 minutes before (wakes Muse, checks the narrator).

### Joining fast
- They scan the lobby QR (it carries the 4-letter code). Backup: `groupproject-game.vercel.app/play` + the code.
- HOST: "No app, no account. One line for your hero, or tap a ready-made one, they're instant."
- **One judge alone:** you join as a player on a team phone (2 turns: theirs and yours) and press **B** once for a
  test player who only suggests ideas. Say "Riley is a test player the TV runs." Never pass a bot off as a person.
- **Two judges:** press **B** once, so each turn gets two suggestions. **Three or more:** no bots.

### Second by second (3 judges)
| Clock | Do / say |
|---|---|
| 0:00 | Hand them the QR card first. 30-second pitch (section 1) while they scan. |
| 0:30 | Heroes: "Muse is painting you as a cartoon right now. The secret talent comes back at the end." |
| 0:50 | Press Start. "This story hides something that really happened. You find out at the end." |
| 1:00 | Over the opener, once, quietly: "Muse wrote this and painted you in." Then stop talking. |
| 1:15 | Turn 1: "Everyone else, send [A] an idea. [A], use a friend's and you get plus one." Coach: "Which one made you laugh?" Then silence. |
| 2:00 | "Swipe up to throw." On the meter: "Every number is its own outcome. Code rolls, never the AI." |
| 2:15-3:45 | Turns 2-3. Only say whose turn it is. |
| 3:50 | "Last move. Everyone write one, then back one plan, not your own. Then everyone shakes at once." |
| 5:15 | Reveal: let it sit 3 s. Point: "That's the real headline." "And that's the talent you typed." "Take it home" (keepsake QR). |
| 5:40 | The close (below), then questions. |

**Talking rule:** talk before Start and at the reveal; in between, only names and one coaching line. When judges
argue about an idea, stop talking. Nobody types for a judge.

**The close (one breath):** "Your friends' ideas were your best move. Muse wrote, judged and painted every decision;
code rolled the dice. It was based on a true story. And you just played it."

**The hook to come back:** "Every table gets a different true story. Come back with a friend and play another."

### Hotkeys (TV laptop, `Presenter.tsx`)
| Key | Does |
|---|---|
| B | Add a test player (lobby only, needs `?bots=1`; up to 3) |
| Q | Quick Tale + begin |
| Space | Continue on a reading screen |
| S | Skip the current timer (only after everyone has sent) |
| N | DM's Notes: every AI call, live |
| H | Hotkey help |
| Esc | Close notes and help |

### If something breaks
| Problem | Do |
|---|---|
| Muse slow | Say nothing. Every AI call has a canned fallback that still names the plan; the old painting stays until the new one fades in. |
| Narrator silent | Text still shows. "Tonight the narrator is shy." Check the volume, move on. |
| Wi-Fi drops | The timer stops while every phone is offline ("Reconnecting phones…"). Move the laptop to the phone hotspot; judges rescan. |
| Hotspot fails too | Play the backup video (laptop and phone) and talk over it. Hand out the QR card. |
| Freeze | Reload the TV (F5). New room code, everyone rescans. Twice = video. |
| Judge in a hurry | 30-second pitch, the deck's reveal slide, and the QR card. |
| Judges arrive mid-game | "Watch the reveal, it's the best part, then you're next." |

## 4. "What did the AI do?" (30 seconds)

> "Muse Spark is the Dungeon Master. It scores odd news for safety and whether it's playable, writes the opening,
> reads each plan literally and says how hard it is, then writes what happens at the grade you rolled, following
> written story rules so it stays logical. Muse Image paints your heroes into a new scene every turn. Muse Voice
> Transcribe lets you speak your plan instead of typing. And our Muse connector lets Muse, the agent, start a game
> night. Press N for DM's Notes: every call it made and why. One part isn't Meta: the narrator's voice (ElevenLabs), because Meta
> has no text-to-speech model. Code decides every number."

- **Why essential:** no Muse = no story, no rulings, no outcomes, no paintings. It is the host, not a garnish.
- **Explainable:** DM's Notes (N) logs each ruling, each progress decision with one line of why, and every fallback.
- **At the table:** judge mode plays a saved true story from our gated library (so you never wait). At home, Quick
  Tale writes a live opener from this week's odd news during the lobby.

## 5. How we built it (short story)

> "Our creative director is at their first hackathon and made every creative call. Claude Code was our lead engineer,
> running parallel agents: builders, a story director, designers, testers and reviewers. In under a day we made
> **about 175 commits** and wrote **35 design docs**. Fresh-eyes agents played the game cold and told us what broke.
> Agents watched our playtest recordings frame by frame; our worst run is why we threw out the scripted story and
> built story rules. A **100-persona simulation** flagged friction (30 s to type was too tight). And we bake-offed
> models on our real job: a better rubric took Muse Spark from 5 of 8 fair rulings to 8 of 8, and in a blind test of
> 5 writers Spark won."

Checked Sun ~4:30 AM (laptop clock, CDT): 174 commits on `rebuild-around-the-table` (`git log`), 35 `design/*.md` files (5,746 lines),
100 personas (design/32), 5/8 to 8/8 (design/23), 5 writers (design/26), 32-scenario stress test (commit 8eed30a).
Re-count commits at 10 AM.

## 6. Judge FAQ

1. **What's real vs AI?** The story's starting event is real (a real article, or a player's true story). The heroes,
   the twist and everything that happens are Muse's; the dice and every number are code.
2. **Safety with real news?** A keyword block, then Muse scores each story: no deaths, injuries, crime with victims,
   war, politics, health scares or private people. 7 storyability scores, average 4 of 5, none below 3. Heavy news is
   a future, opt-in mode.
3. **Why not just ChatGPT?** A chatbot is one person and a screen. This is a room: one shared table, phones as
   controllers, friends feeding each other ideas, real dice and a reveal.
4. **A shy player?** Typing is the default, so nobody has to speak. Friends send you ideas, so you never face a blank
   box. If your timer runs out, the first friend's idea goes ahead.
5. **Replayability?** New odd news every day, plus Our stories from your own lives. 18 ready-made heroes or your own,
   6 art themes.
6. **Cost?** About 20 cents for a Quick Tale by our math from published prices (paintings ~1 cent each). Not measured
   on a real game; say "about".
7. **What's next?** Section 7's top 3.
8. **vs AI Dungeon?** AI Dungeon is one player typing to an AI. We're a room of friends, and the AI is only the host.
9. **vs Jackbox?** Jackbox is competitive and hand-written. We're co-op (win or lose together), every story is new
   and true, and your heroes appear in the art.
10. **What if the AI says something bad?** Player text goes in as in-world speech inside a strict format; we threw 32
    hostile scenarios at the DM. If a check fails the game uses a canned line. The AI judges plans, never people.
11. **Privacy for Our stories?** No accounts, no player database. Words go to Muse to run the game, and the phone says
    so. The keepsake lives in the link. We never use Meta's `-contributor` models (the server refuses to start with
    one).
12. **Can the AI cheat the dice?** No. Crypto random numbers in code; the AI only picks a difficulty label.
13. **Why a non-Meta voice?** Meta has no text-to-speech model; Muse Voice Transcribe only listens. We compared
    voices by ear, there's a backup voice, and plain text is the last fallback. Meta's rep told us to pick the best
    model per job.
14. **How do you keep the story logical?** Code holds the story state (place, problem, facts, progress) and checks
    every outcome: it must use your words, never undo a win, stay short. One retry, then a fallback.
15. **Can a great roll save a dumb plan?** Sometimes. Wild plans get a big minus (down to −8), so they need a big
    roll; a natural 20 is always LEGENDARY.

## 7. What's next (proposal-only, GAME.md top 3)

1. **Campaign mode:** "Your heroes carry over into the next story and grow from what they did, like a real D&D
   campaign." Strongest for Meta: one night becomes a crew that comes back.
2. **Our stories as the main mode:** "Every player brings a small true story, and the night becomes 'I didn't know
   that about you.'" Built today; next is making it the main mode. It came from Meta's own rep.
3. **Real World mode, with guardrails:** "Opt-in heavier news for groups who want to talk about things that matter:
   whole-table opt-in, skip any time." (design/16)

If asked about anything else (remote play, weekly chapters, local news): "Parked. We nailed one loop first."
Never mention cut features (danger meter, Mirror, Catch, Boost, clues, Convince the DM, Hope).

## 8. Body language and talking tips

- Hand them the QR first, talk second. Let the judges play; their phones are the demo.
- Face the judges, not the screen.
- When judges argue about an idea, stop talking. That silence is the human-connection score.
- Don't explain rules; the first turn teaches the game. Don't apologize for a slow painting.
- Smile at a bad roll: "A bad roll makes it funnier."
- **Memorize these 3 sentences:**
  1. "The one group project where everyone actually shows up."
  2. "On your turn your friends pitch you ideas. Use one and they get the credit."
  3. "Every story is based on a true story. You find out which one at the end."

## 9. Rehearsal

The 10-minute plan and the 15-question drill are in `pitch/REHEARSAL.md`.

## 10. Calls made (lead, Sun ~4:45 AM)

- **Partner runs judging solo 2:00-4:45** (DECISIONS Sun ~12:30 AM stands).
- **Judge mode stays max 3 turns.** Say "about five minutes" up front; drop to max 2 if rehearsal runs go past 6:00
  from hello.
- **Quick Tale = 1 turn each, ~5 min** (CD; the story session is building it). Full Story keeps 2 each at 2-4 players.
- **Narrator: one ElevenLabs voice for everything** (the CD's pick; Eleven v3 for the story beats, the same voice on
  Flash for instant turn lines), no per-story casting, OpenAI TTS as the backup (CD). **Pending:** the switch goes live when the CD confirms the
  plan purchase; until the deployed narrator is ElevenLabs, say "OpenAI TTS" instead. **Gemini track: off.**
- **Phone footer** reworded by the look session (4b8cfa2): "No accounts. Your words go to Meta's Muse AI to run the
  game; the TV keeps the finished tale, and our server caches the art and audio."

## Don't say yet (not built, not tested, or not true on the live site)

- **"Play it now at groupproject-game.vercel.app"** until the merge + deploy: the live site runs an old build (danger
  meter, "RISKY", no "tell the table"). `origin/main` is 55 commits behind the branch (Sun ~4:30 AM).
- **"This is this week's news"** at the table: judge mode plays a saved story from the library. Say "a real story".
- **"4 minutes"**: a judge-mode game is ~5 min from Start (section 3).
- **"Nothing is saved"**: the server caches art and audio. Say "no accounts, no player database".
- **"About 20 cents a game"** as a measured fact: it's an estimate.
- **Danger meter, Needs 12+, Mirror, Catch, Boost, clues, Convince the DM, Hope:** cut.
- **"Hybrid progress feels 9/10"**: tuned in a script, no CD sign-off recorded.
- **The Muse connector live** until it's checked on the deployed URL after the merge.
- **Campaign mode, Real World mode:** proposals; say "next".
