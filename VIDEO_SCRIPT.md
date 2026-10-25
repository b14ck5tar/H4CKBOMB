# VIDEO SCRIPT: Group Project (Meta track video)

**Final v3 (Sun 9:27 AM):** `devpost-media/video/out/group-project-final.mp4` (2:47, 1080p) + `group-project-final-small.mp4`
(720p, 23 MB, for phones). Game footage was recorded from the live site by `node scripts/video/capture.mjs`
(headless Chrome: TV + one scripted phone + 2 test players, judge mode, the shark story). If the CD records a better take,
put it in `devpost-media/video/raw/`, point `tv`/`phone` and the shot times in `edl.json` at it, and rebuild.

Rewritten Sun ~7:45 AM (video session) after the CD's notes on the first teaser. **The cut is built by script**, not
by hand: `devpost-media/video/edl.json` (every beat: its voice line and its shots) → `python -I scripts/video/build.py`
→ `devpost-media/video/out/group-project.mp4`. The narrator is Sarah (ElevenLabs Flash v2.5, the game's Combo
settings), generated per line by `node scripts/video/vo.mjs` (only changed lines cost credits; the whole script was
363 credits). The CD only records the footage (shot list below); nobody reads a voiceover.

## CD notes on the first teaser, and the fix

| Note | Fix |
|---|---|
| First 10 s hook weak and irrelevant | The CD's pick: the real headline cold open (below) |
| The 20 on the die moves weird | No old-teaser die. The die shot comes only from the new build's recording (one die number, f7b1f48) |
| "Some of them are genius, others not so much" | Gone. Now (CD pick): "Your friends throw in ideas, and the best part is arguing over which one to use." (the AI judges ideas, never people) |
| "Weirdly good at" | "What's your secret strength?" (CD, everywhere; the game copy is changing to match) |
| Final words | End card: **PLAY FREE AT groupproject-game.vercel.app** + a QR (checked: it decodes to that URL) |
| Harsh S and crackle | Sarah on ElevenLabs, de-essed, low-passed at 11 kHz, true peak limited to -2 dB, no time-stretching |

## How the video maps to Meta's brief

| Part | Meta's ask | Time | Criterion |
|---|---|---|---|
| Hook + 1 | The problem and how it brings people closer | 0:00-0:30 | Human connection (30%) |
| 2 | Working demo of the key features | 0:30-2:00 | Execution & demo quality (25%), Originality (20%), connection again |
| 3 | How AI plays a role | 2:00-2:30 | AI centrality (25%) |
| 4 | Tools and harnesses | 2:30-2:55 | How AI helped build it |

Criterion chips (small, in the caption band): *Human connection* · *Working demo* · *Based on a true story* ·
*AI at the core* · *How we built it*. Captions are burned in, in a band under the footage, so they never cover the
game's own text.

Never on screen or in the words: danger meter, Needs 12+, Catch, Boost, Mirror, clues, Convince the DM, Hope,
"fairytale", "Once Upon a Roll", "weirdly good at", "the one group project where everyone actually shows up" (as the
last words), "some of them are genius", "secret talent", hotkeys, the "?" help, "Local mode", the address bar, any key or DM.
`how-it-works.png` and `deck-slide-4.png` are out (they still show "Convince the DM", "Secret clue", "Gus's turn").

## The hook (first 10 s), the CD's pick

The real headline slams onto black (whoosh + brass hit), taken from this morning's own reveal so it matches the story
the footage plays (judge mode rotates the shark, the gold and the Batman stories). Sarah: **"What would YOU do?"**
Cut: the phones light up (the "Shake!" phones from the CD's cut, `video-source-cd.mp4` 0:58), the TV, then the logo
sting from the CD's cut (0:10). The headline is the real clipping; nothing claims the game's events happened.

## The voiceover (Sarah; one line per beat, as in edl.json)

**Hook:** What would YOU do?
**Part 1:** When friends hang out, a lot of the night is everyone on their own phone. / Tabletop games fix that. But
someone has to run the game, so most groups never play. / So Meta's Muse runs it. The TV is the table, your phones
are the controllers, and every story really happened.
**Part 2:** Scan the code. No app, no account. Name your character, describe them in one line, and add your secret
strength. / Your hero is exactly what you typed, painted in by Muse. / Muse turns a real, odd news story into tonight's
adventure. / On your turn, you tell the table your plan. / Your friends
throw in ideas, and the best part is arguing over which one to use. / Every hero has Guts, Brains and Charm: force, tricks and talk. / Swipe up to
throw. Code rolls the dice, never the AI. / Muse takes your plan literally, writes what happens next, and paints a
new scene. / For the finale, everyone gets thirty seconds to convince each other. / Then you back a plan, and the
whole table shakes their phones at once. / And the twist. Here's what you did. / And here's what really happened.
**Part 3:** Muse runs the night. Muse Spark picks odd news that makes a good, safe story, judges every plan, and
writes every turn. / Muse Image paints your heroes into every scene. Code rolls the dice, and the AI judges ideas,
never people. / Every brain in this game is Meta's Muse: it writes, judges every plan, paints you in, listens, and even picks the sound effects. All it borrowed is a voice and a box of sounds. *(caption adds: ElevenLabs.)*
**Part 4:** It was built by a first-time hacker making every creative call, with Claude Code as lead engineer,
running a team of agents. / They watched our playtests frame by frame. Our worst run is why we rebuilt the story
around the players' choices. / A test harness plays whole games with real Muse calls, and a better rubric took Muse
Spark from five of eight fair rulings to eight.
**End card:** Play free at groupproject-game dot vercel dot app.

Between lines the game's own sound plays (Sarah narrating in the game, the die, the reveal), so the demo breathes.

## Shot list for the CD (9:00-9:45)

**Before recording: Do Not Disturb on; close Discord, terminals and any page with a key.**

Setup: the laptop TV at `/tv?judge=1&bots=1` in Chrome **full screen (F11)**, the CD's real phone + 2 test players
(press **B** twice in the lobby). Start both recordings before the lobby and keep them running for the whole game:
1. **Laptop:** Win+Alt+R (Game Bar) or Snipping Tool (Win+Shift+R, system audio on), 1920x1080.
2. **Phone:** its own screen recorder, mic off.
One full judge game (~6 min) gives everything below. Then send me the two files.

| # | Where | Shot | Notes |
|---|---|---|---|
| S1 | TV | Lobby: QR, heroes arrive | |
| S2 | Phone | Type the character name, the one-line hero, the secret strength; tap Make my hero | Type slowly; one clear noun ("a night-shift baker who argues with her sourdough") |
| S3 | TV | The hero card pops in, painted, matching what you typed | |
| S4 | TV | Opener painting + Sarah reading | Let it play |
| S5 | Phone + TV | Your turn: quips, the friend's-idea card, tap a friend's (test player's) idea; TV shows "+ name +1" | The money shot |
| S6 | TV / Phone | The stats explained (Guts = force · Brains = tricks · Charm = talk) | Hold 3 s |
| S7 | Phone + TV | Swipe up; the one die lands | |
| S8 | TV | Outcome text + the new painting crossfades in | |
| S9 | TV + Phone | "Convince each other": the 30 s talk screen, then the vote | Talk out loud, it's fine |
| S10 | Phone + TV | Shake; the final die | Everyone real shakes at once |
| S11 | TV | Grand ending: WHAT YOU DID → WHAT REALLY HAPPENED | Don't touch anything until it ends |
| S12 | TV | The real-news clipping, readable | |
| S13 | TV | DM's Notes (press N), 10 s of entries scrolling | A separate short clip after the game |
| S14 | Laptop | Claude Code, several sessions in the sidebar | Safety check first (no `.env`, no key on screen); skip if unsure |

## Facts behind each line (so nobody overclaims)

- "Tell the table your plan": `components/QuickTV.tsx`. "+1 with their name": `lib/host.ts`.
- One die number on screen: f7b1f48. Crypto dice: `lib/rules.ts`.
- "Your hero is exactly what you typed": the turn call gets the typed concept (c257d7f); hero art in `server/art/`.
- Guts = force · Brains = tricks · Charm = talk: the stat legend (4e5896c).
- A new painting every turn with the heroes in it: Muse Image edits, `server/art/sceneArt.ts`.
- "Picks news that makes a good, safe story": the storyability gate, `server/news/candidates.ts`. In judge mode the
  story comes from the saved, gated library: say "a real, odd news story", never "this week's".
- "Thirty seconds to convince each other": the finale talk, 30 s in judge mode (d6d482c).
- "What you did → What really happened": the grand ending (2d4b87a, 4fdf65a).
- Narrator: one ElevenLabs voice (Sarah), OpenAI TTS backup. Meta has no TTS model.
- "Frame by frame": design/33. "A test harness": `scripts/procedural-test.mjs`. "5 of 8 → 8 of 8": design/23.

## Export and upload

1080p30 MP4, H.264 + AAC, -14 LUFS, under 3:00 (draft: 2:47). Watch once muted. YouTube **Unlisted**, check it plays
in a private window, keep the MP4 on a phone as the judge-table backup.
