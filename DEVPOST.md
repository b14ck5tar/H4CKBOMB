# Group Project (Devpost text, final build)

Paste from "Name" down. The paste steps, gallery order and last checks are in `pitch/CD_MORNING.md`.

## Name
Group Project

## Tagline
The one group project where everyone actually shows up.

## Inspiration

People rarely stay quiet at a hangout because they dislike each other. They just don't know what to say, so
everyone ends up on their own phone. Tabletop games fix that: everyone gets a role, a reason to speak and a shared
problem. But someone has to prep and run the game as the Dungeon Master, so most groups never play. We wanted Meta's
Muse to be the Dungeon Master, so the humans could just show up and talk to each other. And we wanted every story to
come from real life, so the ending starts a real conversation: "wait, that actually happened?"

## What it does

A laptop or TV is the table. Phones scan a QR code and become controllers. No app, no accounts, no prep. 2 to 6
players in one room. A Quick Tale takes about 5 to 10 minutes, depending on how many play; a Full Story 10 to 15.

1. **Make a hero.** Describe them in one line and answer one question: "What's your secret talent?" Muse paints the
   hero in our house style, Neon Ink (hand-inked lines, flat neon color). Or grab one of 18 ready-made heroes and
   play right away. Your real answer stays secret until the end.
2. **Pick tonight's story.** Two sources, both true:
   - *Odd news:* strange, harmless stories from real news this week. A story only gets in if Muse scores it as
     storyable on 7 measures (a clear situation, a problem with stakes, a place you can picture, a real arc, roles
     for the players, a payoff, and a fantasy twist that helps). It needs an average of 4 out of 5 and nothing below
     3. Stories show up as fantasy quest cards, so nothing is spoiled.
   - *Our stories:* each player privately writes a small true story and how it really ended, and the table votes on
     one.
   A Kids / Teens / Adults setting tunes the tone and the news filter.
3. **Players steer, the DM reacts.** There's no script. On your turn the TV says "Maya, tell the table your plan,"
   and everyone else sends you a move from their phone. You pick your own idea or a friend's. Using a friend's idea
   gives +1, and their name goes on screen.
4. **Swipe to throw.** Muse reads your plan at face value and stamps how hard it is. That shifts the roll. You swipe up
   on your phone and the d20 is thrown onto the TV table. Code rolls the dice; the AI never picks a number.
5. **Every number is its own outcome.** There's no pass/fail line: 1 is DISASTER, then UH OH, SORT OF, IT WORKS,
   GREAT, up to LEGENDARY at 20+.
6. **A story that follows your logic.** Muse takes your action literally, assumes it really happens the way you wrote
   it, and writes what would realistically follow, at that grade. Code checks that the outcome uses your own words
   (your chess set stays a chess set). It also checks that the hero is named and the lines are short and plain; if
   not, it retries once. Muse judges how far your action moved things toward the finish line, which stays on screen
   all game. Code keeps that in bounds: a success never moves you backward, and nothing you achieved is undone. The
   story runs in 3 acts; an act ends when a plan solves it (or its time runs out). Then the narration hands the spotlight to
   the next player by name: "Leo, the lights are yours."
7. **Every decision gets painted and read aloud.** Muse paints a new scene with your group's heroes in it. A
   narrator, cast by Muse to fit the story (Vesper, Juniper, Hollis or Wren), reads it over original music made in
   the browser (a lobby theme and 5 story moods), with sound on every tap and roll. Muse also picks one of 6 art themes
   per story, all built on Neon Ink so the heroes stay recognizable.
8. **The finale, together.** Everyone proposes a last plan and backs one that isn't theirs (each backer adds +1, up to
   +2). Then the whole table shakes their phones at the same moment to roll one shared die.
9. **Based on a true story.** A "because of you" montage credits every player by name for what they did and calls
   back a funny moment. Then the reveal: *Based on a true story*, with the real article and what's happening there
   now. In Our stories it says *Based on Ava's true story* and shows how it really ended. The "Solved by" line credits
   each player's real secret talent. A keepsake QR lets everyone take the story home.

## How AI is essential (and where code takes over)

Take Muse away and there is no game: no stories, no rulings, no outcomes, no art and no narrator casting.

| Job | Model |
|---|---|
| Scores odd news for storyability and safety | muse-spark-1.3 (low effort) |
| Writes each story opening from the real article or a player's true story; code checks reading level and length | muse-spark-1.3 (high effort, with faster backups racing it) |
| Reads each plan at face value and stamps its difficulty | muse-spark-1.3 (minimal effort, temperature 0) |
| Writes each turn: what happened, what changed, the next step, progress, and the hand-off to the next player | muse-spark-1.3 (minimal effort, started the moment the plan is judged so it's ready when the die lands) |
| Casts the narrator and the art theme per story; writes the ending and the credits | muse-spark-1.3 |
| Hero portraits, and the heroes painted into a new scene after every decision | muse-image-1.0 (image edits, with the heroes and the last scene as references so characters stay consistent) |
| Optional voice input | muse-voice-transcribe-1.0 |

**Code decides everything with a number:** the dice (crypto RNG), the bonuses, the grade, how far progress may move,
the act changes, the turn order, and the "Solved by" line, which is built from the players' own answers. The AI
judges ideas, never people. Nobody is scored or ranked. DM's Notes on the TV shows every call Muse made and why.

**The one non-Meta model is the narrator's voice,** because Meta has no text-to-speech model: OpenAI
gpt-4o-mini-tts (and tts-1-hd for one voice), with Gemini TTS as the automatic backup and plain text as the last
fallback.

## How we built it

- **Next.js on Vercel and Supabase Realtime.** The TV runs the whole game; phones only send intents (join, idea,
  plan, vote, throw, shake). Every AI call has a fallback (the turn fallback still names the plan), so a slow response
  never freezes the table. The next painting is prepared in the background, so nobody waits on art.
- **SerpApi Google News** supplies the odd news, cached for 4 hours, then a keyword block list and the storyability
  gate. Stories that pass are saved to a story library, so a quiet news week still has good stories.
- **An MCP connector** (`/api/mcp`) lets Muse, the agent, list tonight's stories, open a table and draft the invite.

### How AI tools and test harnesses helped us build it

Our creative director (first hackathon) made every creative call. Claude Code was the lead engineer, running
parallel agents: builders, a story director, lobby and phone designers, QA testers, reviewers and recording analysts.
What actually changed the game:

- **Watching real playtests, frame by frame.** Agents pulled a frame every half second from our screen recordings,
  transcribed the room with Muse Voice Transcribe, and lined up every turn: plan, roll, what the AI wrote, what the
  players said. Our worst run showed stories that ignored the plan and repeated the same situation ("Bro, I literally
  just solved the problem"). That recording is why we threw out pre-written story branches and built the procedural
  engine: players steer, the DM reacts.
- **A story test harness.** A script plays whole Quick Tales against real Muse calls with tricky plans (a chess set, a
  sweater for a calf, hiring the turtle). It checks every outcome against the rules. Last run: every outcome used the
  player's own idea, 0 fallbacks, 0 repeated steps, and every game reached act 3.
- **Model bake-offs on our real job.** A rewritten judging rubric took Muse Spark from 5-7 of 8 fair rulings to 8 of
  8, three runs in a row. A better rubric beat a bigger model. In a blind writing test of five writers (Spark at two
  effort levels, Muse Wonder, GPT-5.5, GPT-4.1), Spark stayed: it credited the right friend every time, kept the
  limits and fit the time budget.
- **A 100-persona simulation** flagged friction before real people hit it (for example, 30 seconds to type a plan
  was too tight, so Quick Tale gives 45). We treated it as a list of risks, not proof of fun.
- **Test players:** up to 3 bot players with personalities, run by the TV, so two of us could playtest the full loop
  at 3 AM. With real people at the table, bots only suggest; they never take a person's turn.
- **A cold legacy audit** before the freeze: an agent read the whole codebase against the current design and listed
  every leftover rule and stale line a judge could see.

## Challenges we ran into

- **Pre-written stories broke the moment players got creative.** A player solved the problem and the story said "the
  problem is still right there." We replaced the script with rules: take the plan literally, follow the logic, keep
  the player's own words, never undo a win, move through 3 acts, and hand off to the next player by name.
- **The AI's writing was hard to follow.** In our first playtest it invented jargon, and a player asked "What the
  hell is foam?" Now every line is short and plain, cause then effect, with the goal always on screen.
- **Too many features.** Secret clues, arguing with the DM, boosts and re-rolls crowded every screen. A Meta judge
  told us to nail one or two things. We cut it down to one loop: suggest, pick, roll, see what happens.

## Accomplishments that we're proud of

- A full game, from QR code to true-story reveal, that a new player understands in a minute.
- A turn system where listening to your friends is the best move.
- A story that follows the players' own logic instead of a script, with AI that runs the whole game but never decides a
  number or rates a person.
- Our creative director's first hackathon. *(CD: one line in your own words here.)*

## What we learned

- Let the players steer. The best stories came from taking their plans literally.
- Let the model write and let code decide. Players trust real dice.
- Test models on your actual job. Our guess about the "better" model was wrong twice.
- Watch people play. The recordings showed problems we had stopped seeing.

## What's next for Group Project

- **Our stories first:** every player brings a small true story, and the night becomes "I didn't know that about you."
- **Remote play** for friends in different cities (a `/watch` big-screen view already exists).
- **Weekly chapters:** the same crew, a new true story each week.
- **Real World mode:** opt-in, heavier news with guardrails, for groups who want to talk about things that matter.

---

## Built with

`next.js` · `typescript` · `react` · `tailwindcss` · `vercel` · `supabase-realtime` · `meta-muse-spark` ·
`meta-muse-image` · `meta-muse-voice-transcribe` · `openai-tts` · `gemini-tts` · `web-audio-api` · `serpapi` ·
`google-news` · `mcp` · `claude-code`

## Tracks to select

- Meta: Bringing People Closer Together with AI
- Most Entertaining
- Best Use of SerpApi
- MLH Best Use of Gemini API: only if the CD keeps it (see `pitch/CD_MORNING.md`).
- Best Novice applies automatically if we're eligible.

## Try it

- Table (open on a laptop or TV): https://groupproject-game.vercel.app/tv
- Phones: scan the QR on the TV, or go to https://groupproject-game.vercel.app/play
- Fewer than 2 people? Open https://groupproject-game.vercel.app/tv?bots=1 and add test players.
- Video: *(paste the link)*
