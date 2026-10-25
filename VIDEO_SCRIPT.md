# VIDEO SCRIPT: Group Project (Meta track video)

*Group Project: the one group project where everyone actually shows up.*

Rewritten Sun ~5 AM (laptop clock) to match GAME.md: judge mode, a new painting every turn, the ElevenLabs narrator,
one progress meter (no danger meter), "Based on a true story". The order to do things in (safety check, take, edit,
upload) is `pitch/CD_MORNING.md`; section numbers below (§) point there. **Record on the deployed build. Devpost closes
11:30 AM; the CD leaves at 11 AM.**

## How the video maps to Meta's brief

| Part | Meta's ask | Time | Meta criterion it proves | Words |
|---|---|---|---|---|
| 1 | The problem and how it brings people closer | 0:00-0:30 | **Human connection (30%)** | ~60 |
| 2 | Working demo of the key features | 0:30-2:00 | **Working demo (20%)**, connection again (friends' ideas, the shake), **Originality (20%)** (the true-story reveal) | ~140 |
| 3 | How AI plays a role and is integrated | 2:00-2:30 | **AI essential + well integrated (25%)** | ~60 |
| 4 | Tools, harnesses and how they helped | 2:30-3:00 | How we used AI to build it (the Meta rep's third lens, design/22) | ~62 |

Hard limit 3:00; aim for 2:50 plus the end card. Pace ~2.2 words a second. If a line runs long, cut words, not the
friend's-idea moment or the reveal. Burn in captions (judges often watch muted).

**Criterion chips:** a small label in the top-left corner while each part plays: *Human connection* · *Working demo*
· *Based on a true story* · *AI at the core* · *How we built it*. ⭐ Names only, no percentages (it reads as
confident, not as box-ticking).

Never on screen or in the words: danger meter, Needs 12+, Catch, Boost, Mirror, clues, Convince the DM, Hope,
"fairytale", "Once Upon a Roll", "inspired by real events", "weirdly good at", hotkeys, the "?" help, "Local mode",
the address bar, any key or DM.

**No camera filming (CD):** the whole video is screen recordings (the TV and the phones) plus the B-roll stills in
`devpost-media/broll/`.

---

## The voiceover: one clean read (record in one take)

Read it straight through like telling a friend. At each `[pause]`, stop for two full seconds (that's where the edit
cuts). Slower than feels natural. No trailer voice.

> When friends hang out, a lot of the night is everyone on their own phone.
> Tabletop games fix that. Everyone gets a role and a reason to talk. But someone has to run the game, so most groups
> never play.
> So we built Group Project. Meta's Muse is the Dungeon Master, your phones are the controllers, and every story is
> based on a true story.
>
> `[pause]`
>
> Scan the code. No app, no account. Describe your hero in one line, and your secret talent.
> Muse turns a real, odd news story into tonight's adventure, and paints you in.
>
> `[pause]`
>
> There's no script. On your turn, you tell the table your plan, and your friends pitch you ideas. Use one, and you
> get plus one, with their name on screen.
>
> `[pause]`
>
> Swipe up to throw. Every number is its own outcome. Code rolls the dice, never the AI.
> Muse takes your plan literally and writes what would really happen next. Every turn gets a new painting, and the
> spotlight passes to the next friend by name.
>
> `[pause]`
>
> For the finale, everyone backs a friend's plan, then the whole table shakes their phones at once.
> And the twist: it's based on a true story. The real article, and how your secret talents saved the day.
>
> `[pause]`
>
> Muse runs the night. Muse Spark picks news that makes a good, safe story, writes the opening, judges every plan and
> writes every turn. Muse Image paints your heroes into every scene. Code rolls the dice, and the AI judges ideas,
> never people.
> Every brain in this game is Meta's Muse: it writes, judges every plan, paints you in, and listens. The only thing it
> borrowed is a voice.
>
> `[pause]`
>
> This is my first hackathon. I made the creative calls, and Claude Code was our lead engineer, running a team of
> agents. They watched our playtests frame by frame, and our worst run is why we rebuilt the story around players'
> choices. A test harness plays whole games with real Muse calls, and a better rubric took Muse Spark from five of
> eight fair rulings to eight.

About 345 words: ~2:35 of speech, leaving ~25 s of game sound (the narrator, the die, the laughs) inside 3:00. Part 1
~60 words, Part 2 ~140, Part 3 ~60, Part 4 ~62. Too long? Drop, in this order: "running a team of agents"; "with real
Muse calls"; "Every number is its own outcome."

---

## Shot list (keyed to `pitch/CD_MORNING.md`)

**The take (§2):** `/tv?judge=1&bots=1`, **Quick · Odd news · Teens**, the CD on a real phone (plus any real player
who's around) + 2 test players (press **B** twice in the lobby). Judge mode plays a saved, tested true story and gives
each real player 1 turn, then the finale. All screen recordings (the TV and the phones). Test players only suggest
ideas, never own a turn; never call one "my friend". A test player's idea can still be the "+1" pick.

| Time | VO beat | Shot | Source |
|---|---|---|---|
| **Part 1** | | | |
| 0:00-0:19 | "everyone on their own phone… so most groups never play." | `deck-slide-2.png` (TOGETHER. ON OUR PHONES.) with a slow push in; the two boxes "Game nights fix that" / "Someone has to run them" land on the matching words. | §4 B-roll |
| 0:19-0:30 | "So we built Group Project…" | The TV lobby: neon title, big QR and the lobby filling with heroes. Title: **Group Project**, subtitle *the one group project where everyone actually shows up.* | §2 take: TV |
| **Part 2** | | | |
| 0:30-0:40 | "Scan the code…" | Phone A: type the hero, answer "What's your secret talent?" TV: the hero card pops in, the portrait paints in. | §2 take: phone A + TV |
| 0:40-0:48 | "Muse turns a real, odd news story…" | TV: the opening painting with the party's heroes; the narrator starts reading, text in sync. | §2 take: TV |
| 0:48-1:06 | "There's no script…" (**the money shot**) | TV: "{A}, tell the table your plan." Phone B: typing the idea. Phone A: friends' ideas; A taps B's. TV: the plan card with "+ B's idea +1". Hold 2 s on the credit. | §2 take: both phones + TV |
| 1:06-1:16 | "Swipe up to throw…" | Phone A: the thumb flicks up. TV: the d20 flies onto the table, lands, the meter fills to its grade. Caption: *1 = DISASTER … 20 = LEGENDARY*. | §2 take: phone A + TV |
| 1:16-1:32 | "Muse takes your plan literally…" | TV: the outcome uses A's own word, the new painting crossfades in, the progress meter moves, the last line names B. | §2 take: TV |
| 1:32-1:44 | "For the finale…" | Phones: "Shake!" TV: one shared die lands, the screen shakes. | §2 take: phones + TV |
| 1:44-2:00 | "And the twist…" | TV: "Because of you" with names, then **Based on a true story**: the real headline, "Solved by" with the real talents. Last 2 s: the keepsake QR. Headline hard to read? Cut to `deck-slide-6.png`. | §2 take: TV / §4 |
| *optional* | (only if time allows) | **Our stories reveal, ~20 s**: a short second take with the lobby on **Our stories**; record only its ending, "Based on Ava's true story" and how it really ended. It's the strongest connection beat (fresh-eyes). Slot it right after the odd-news reveal and trim the finale shake to fit 3:00. Optional VO line: "Or play a friend's true story, and find out how it really ended." | a second §2 take, TV |
| **Part 3** | | | |
| 2:00-2:14 | "Muse runs the night…" | The one-turn diagram: real news → Muse Spark → plan → Muse Spark judges → code rolls → Muse Spark writes → Muse Image paints → narrator. Chips: *muse-spark-1.3*, *muse-image-1.0*. | §4 `how-it-works.png` |
| 2:14-2:22 | "Code rolls the dice…" | TV with DM's Notes open, entries scrolling (rulings, progress with one line of why). | §3 DM's Notes clip |
| 2:22-2:30 | "Every brain in this game is Meta's Muse…" | `deck-slide-7.png` (Muse Spark, Muse Image, Muse Voice Transcribe, MCP connector chips). Caption on "borrowed is a voice": *Narrator voice: ElevenLabs (Meta has no text-to-speech)*. | §4 B-roll |
| **Part 4** | | | |
| 2:30-2:39 | "This is my first hackathon…" | Claude Code with several sessions in the sidebar. **Safety check first.** Unsure? Stay on `deck-slide-7.png`. | §3 Claude Code clip |
| 2:39-2:49 | "They watched our playtest videos…" | A contact sheet of frames from the worst playtest (design/33), then the clean turn screen from today's take. | a still from design/33 + §2 take |
| 2:49-2:55 | "A test harness… eight of eight." | `deck-slide-7.png`, zoomed on "5→8/8". | §4 B-roll |
| 2:55-3:00 | (no voice; game music) | End card: **Group Project** · groupproject-game.vercel.app · QR. | §4 `deck-slide-8.png` |

**Keep the take that has:** a friend's idea picked, one low roll and one high roll, an outcome that uses the
player's own word, a readable headline at the reveal. One good take is enough.

**Plan the moves, not the words:** on A's turn, pick a friend's or a test player's idea (+1, their name on screen).
With a second real player: B reads the plan to the table first, then sends it. Plans with one clear noun (a ladder, a cinnamon roll, a marching band) read best.

---

## Facts behind each line (so nobody overclaims)

- "Tell the table your plan": `components/QuickTV.tsx`. "+1 with their name": `lib/host.ts`.
- Grades 1 DISASTER … 20+ LEGENDARY, crypto dice: `lib/grade.ts`, `lib/rules.ts`.
- A new painting every turn with the heroes in it: Muse Image edits, `server/art/sceneArt.ts`.
- "Picks news that makes a good, safe story": the storyability gate, `server/news/candidates.ts` (7 scores, average 4+,
  none below 3). In judge mode the story comes from the saved, gated library: say "a real, odd news story", never
  "this week's".
- Narrator: one ElevenLabs voice for everything (the CD's pick; Eleven v3 for the story beats, the same voice on Flash for instant turn lines); OpenAI TTS backup. No per-story casting (DECISIONS, db136e7).
  **Pending** the CD's plan purchase: if the deployed narrator is still OpenAI when you record, read "The narrator is
  OpenAI" instead (CD_MORNING §1).
- "Frame by frame": design/33. "A test harness": `scripts/procedural-test.mjs`. "5 of 8 → 8 of 8": design/23.
- Finale: backing a plan you didn't write; one shared shake die (`host.ts` `startFinale`).

## Edit and export (details in §6-7)

Game sound under the VO, louder on the narrator and the reveal; the game's music is original, so nothing else is
needed. Captions out of the bottom 15%. Export 1080p MP4 under 3:00, watch it once muted, upload to YouTube
**Unlisted**, check it plays in a private window, keep the MP4 on a phone as the judge-table backup.
