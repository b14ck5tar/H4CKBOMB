# Group Project: the game in two pages

The shared truth for every session. Current as of Sun Oct 25, ~4:30 AM (laptop clock). Only final answers live here; the history is in
DECISIONS.md and `design/`. If this file and older docs disagree, this file wins.

## 1. What we're making and why

**"Group Project: the one group project where everyone actually shows up."** A social, laugh-out-loud party game that
brings friends together. The laptop/TV is the table, phones are the controllers, Meta's Muse is the Dungeon Master, and
every story really happened, to the world (odd news) or to one of you ("Our stories"). The end reveals: "Based on a true story".

Built to win Meta's track:
- **Human connection (30%):** friends suggest moves on your turn and get +1 and their name on screen when used; the TV hands the turn over by name; "tell the table your plan"; one shared shake-together finale die; Our stories.
- **AI essential (25%):** Muse judges every plan, writes every turn, writes the openers, gates the news, paints the heroes into each scene. DM's Notes shows every call.
- **Originality (20%):** you play a real event, then "Based on a true story" flips it; your own heroes appear in the art.
- **Working demo (20%):** the flow just works. Every AI call has a fallback, art never makes you wait, Wi-Fi drops pause the game.

**The CD's non-negotiables:**
- **Players' ideas drive the story.**
- **Silky smooth and moderately fast:** nobody waits more than about 5 s.
- **As efficient as possible, always generating ahead:** start every AI call the moment its inputs exist, so answers are ready and quality has time.

**Standing rules:** simple beats clever (followable on first hearing; grown-up humor, not kiddy). Friends turn to each other,
not to the AI. Nobody rates a person: the AI judges ideas, never people, and no player can dominate. Perfect the core
loop before any new feature.

## 2. The night, screen by screen

1. **Lobby (TV):** Jackbox-style title crossed with a neon nightclub poster. Big QR + 4-letter code, hero cards pop in with sound, a few big setting buttons (Quick or Full; Odd news or Our stories; Kids, Teens or Adults). Start appears at 2+ players.
2. **Hero (phone):** one line about your hero plus the optional "What's your secret talent?", or grab a ready-made hero. The portrait paints in the background.
3. **Story pick:** Odd news shows 3 headlines as fantasy quest cards (no spoilers); everyone taps one, ties break at random. Our stories: everyone privately writes a small true story, then the table votes.
4. **Opener:** the scene art appears and the narrator reads while the text appears in sync. The finish line and the "Right now" step stay on screen.
5. **Turns:** "Sal, tell the table your plan" → friends suggest → the owner picks or writes one plan → Muse labels it → the owner swipes up to throw the die onto the TV → the outcome is narrated over a new painting → the next player is handed the turn by name. One meter: progress, with 3 act dots.
6. **Grand finale:** everyone proposes, everyone votes (not for their own), and the winning plan rolls one shared die that everyone shakes their phone for.
7. **Ending:** a "Because of you" montage credits every hero by name and calls back 1-2 funny moments, then a clear team card: YOU DID IT / MOSTLY FINE / WELL, IT'S A STORY.
8. **Reveal:** "Based on a true story": the real article (or the author's real ending), what's happening now, "Solved by Ava's parallel parking and Ben's coffee", then a keepsake link + QR.

## 3. The core mechanics (18 picker questions, final answers)

| # | Question | Final answer |
|---|---|---|
| 1 | Becoming a hero | One line + "What's your secret talent?" (optional). Ready-made heroes as backup (18, Neon Ink). Power scaling: nobody massively out- or underperforms. |
| 2 | Whose action | One owner per turn; everyone else suggests, the owner picks. Full: 2-4 players get 2 turns each, 5+ get 1. Quick: 1 each. Humans only (bots never own turns). Then the grand finale. |
| 3 | Dice | One d20 per action plus modifiers; one shared shake die for the finale. No pass line: every total is its own outcome. Wild plans need big rolls. |
| 4 | Who judges a plan | Muse, literally and at face value, as a playful label (CLEVER … ONLY A MIRACLE). No "Convince the DM". No pass-line numbers shown. |
| 5 | Story sources | Odd news from the past week (then month), worldwide, little-known, through a storyability gate; or players' own true stories. |
| 6 | Picking the story | 3 quest cards and a vote, or Our stories (everyone writes, the table votes). |
| 7 | How the text is written | Procedural story rules (section 4) from a fixed real start. |
| 8 | Using a hero's power | Only for the turn owner, only when the plan truly uses it: at most one tier easier, never wins alone. |
| 9 | Length | Full 10-15 min. Quick ~5 min (1 turn each). Judge mode (`/tv?judge=1`): 1 turn each, max 3 turns, then the finale, ~5 min. |
| 10 | Connection moments | Talk to convince the owner; +1 when the owner uses a friend's idea; one action only (no "if that fails"); shake together for the finale. |
| 11 | Stakes | Team vs. the story: win or lose together, with a clear ending card. |
| 12 | The ending | "Because of you" montage, then "Based on a true story" + what's happening now + keepsake. |
| 13 | Narration | Voice with synced text, one narrator for every story (the CD's ElevenLabs pick); never cheerful. |
| 14 | Art | A new painting per decision with the heroes in it; never wait. |
| 15 | Input | Typing by default; voice optional on the owner's plan. |
| 16 | Showing the AI | DM's Notes shows the reasoning. No forced reason lines on the main screen; the outcome is the explanation. |
| 17 | Where you play | One room. Remote play is a pitch line (`/watch` big-screen link exists). |
| 18 | Pacing | Timers: 60 s per turn (Quick 45 s), early advance when everyone's done. Away players are skipped and can rejoin. |

## 4. The story rules

- **Players steer, the DM reacts.** The chosen plan is what happens; there is no script.
- **Logic chain from the player's own words:** take the plan literally, assume it happens as written, ask "what would realistically follow?" Anything a player adds is real now. The AI invents at most one new thing per turn.
- **Fixed at the start** (from the real event): place, people, problem, stakes, one fantasy twist, finish line. Code keeps these facts and checks every AI change, so nothing achieved is undone and nothing contradicts.
- **Each outcome:** names the plan in plain words with the player's key word; 2 sentences, ≤ 30 words; no game words or invented terms; dry, witty, unexpected but logical; ends on a new "Right now" (verb first, ≤ 8 words).
- **Simple payoff:** one plain cause and its effect, no wordplay. ("Gus sets up a chessboard in the mud. The bison mom stares at it so long that the little dog trots away.")
- **Momentum by default:** something moves every turn as a result of the plan. Small is fine; "nothing happens" is not. A backfire comes from the plan itself, funnily.
- **Hybrid progress by roll:** the grade sets a range, the AI picks inside it by logic (one line why, in DM's Notes). Tuned until it feels 9/10 and the finale lands on time.
- **Wild plans need big rolls; power scaling:** the more far-fetched, the bigger the minus. No hero massively out- or underperforms.
- **Social beats:** hand-off by name ("Juno, the lights are yours"); the "tell the table your plan" cue; callbacks (at most once mid-game, always in the ending); credit to friends ("+ Sam's idea", named in the narration on a success).
- **Shape:** 3 acts, each a different situation, then the finale. The fantasy twist returns in act 2 and the finale.
- **Speed:** one Muse call per turn, started the moment the plan is labelled, hidden behind the throw. One retry, then a plan-aware fallback that still moves the story.

## 5. The pieces

- **Heroes:** cartoon characters, never realistic people. Equal stat budget in code (+2/+1/0 across Guts, Brains, Charm). The secret talent is the power, stays private, and returns at the reveal ("Solved by…"). Kids/Teens/Adults filters stories and tone.
- **Dice:** all numbers from code (crypto); the AI picks labels and words, never numbers. Total = d20 + stat + 1 (friend's idea) + plan shift (CLEVER +3, SOLID 0, BOLD −3, LONG SHOT −5, ONLY A MIRACLE −8). Grades: natural 1 DISASTER · 2-5 UH OH · 6-9 SORT OF · 10-14 IT WORKS · 15-19 GREAT · 20+ LEGENDARY. Fails are funny and set you back a little. No roll in time = auto-roll with a buzz.
- **Story sources:** live odd news (SerpApi, cached 4 h; 250 searches/month) → gated library → curated. The gate keeps clear, playable, interesting stories. Adults also allows non-violent crime (heists, scams), weird court cases, scandals and dark-funny topics; every mode blocks deaths, serious injuries, violence, sexual content, children, hate, war/tragedy, partisan politics and mocking private people. A problem, never a villain. **Quick Tale** writes a live opener from fresh news during the lobby, with a stored backup ready instantly; `?judge=1` forces a stored story.
- **Narrator:** one ElevenLabs voice for everything (the CD's pick, Eleven v3; the same voice on Flash for instant turn lines). Synced text; text-only fallback if audio is slow; never switches voice mid-game.
- **Art:** Neon Ink house style (hand-inked indie comic, flat neon, less glossy-AI, away from the Gravity Falls look) plus a per-story theme. Muse Image paints the party's heroes into each scene, started the moment the owner picks; the old painting stays until the new one crossfades in. Art is never hidden by the UI.
- **Sound:** original music made in code: a lobby loop plus 5 story moods picked by the AI (no eerie/tense for Kids). Music on the TV only, ducking under the narrator; phones play effects; a sound on every press.
- **Models:** Muse Spark judges plans, writes turns and endings (fast setting) and openers (high setting, hidden wait); Muse Image for portraits and scenes; Muse Voice Transcribe for voice input; the Muse connector (`/api/mcp`) starts a night from Muse. Narration is the one non-Meta job (Meta has no text-to-speech).

## 6. Cut and future

**Cut:** danger meter, Catch, Boost, Mirror Mirror, secret clues, Convince the DM, Hope meter, Inspiration, Help, AI plan suggestions, thank-you button, skill meter, villains, pre-written scenes/branches, real-life side quests, the parked bold ideas (roast intros, talent vote, real-vs-fake, anchor cameo, front-page keepsake).

**Future ideas to pitch (top 3):**
1. **Campaign mode:** heroes carry over into the next story with upgrades, like real D&D.
2. **Our stories as the main mode:** the night is built from your own lives.
3. **Real World mode with guardrails:** heavier real news, handled with care.

Everything else is parked.
