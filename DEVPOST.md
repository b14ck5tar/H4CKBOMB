# Group Project (Devpost text, final build)

Field-by-field paste steps: `DEVPOST_SUBMIT.md`. The "About the project" box takes everything from **## Inspiration**
down to the end of **## What's next for Group Project**.

## Name
Group Project

## Tagline
The one group project where everyone actually shows up.

## Inspiration

People rarely stay quiet at a hangout because they dislike each other. They just don't know what to say, so
everyone ends up on their own phone. Tabletop games fix that: everyone gets a role, a reason to speak and a shared
problem. But someone has to prep and run the game as the Dungeon Master, so most groups never play. We wanted Meta's
Muse to be the Dungeon Master, so the humans could just show up and talk to each other. And we wanted every story to
start from real life, so the ending starts a real conversation: "wait, that actually happened?"

## What it does

A laptop or TV is the table. Phones scan a QR code and become controllers. No app, no accounts, no prep. 2 to 6
players in one room. A Quick Tale is about 5 minutes (one turn each); a Full Story 10 to 15.

1. **Make a hero.** Type your character's name, describe your hero in one line, and answer one question: "What's
   your secret strength?" The hero is exactly what you type: "a Red Bull" becomes a talking energy-drink can. Muse
   paints it in our house style, Neon Ink (hand-inked lines, flat neon color). Or grab one of 18 ready-made heroes and
   play right away. Your real answer stays secret until the end.
2. **Pick tonight's story.** Two sources, both true:
   - *Odd news:* strange stories from real news. A story only gets in if Muse scores it as storyable on 8 measures
     (a clear situation, a problem with stakes, a place you can picture, a real arc, roles for the players, a
     payoff, a fantasy twist that helps, and whether adults would talk about it at a party), averaging 4 out of 5 with
     nothing below 3. Stories show up as fantasy quest cards, so nothing is spoiled.
   - *Our stories:* each player privately writes a small true story and how it really ended, and the table votes on
     one.

   Safety is precise, not broad: hard limits the AI can't cross in any mode (no deaths, violence against people,
   sexual content, children, hate, disasters, partisan politics, or mocking private people), and inside them a Kids /
   Teens / Adults setting tunes the tone. Adults gets grown-up stories, heists, cons and odd court cases included.
3. **Players steer, the DM reacts.** There's no script. On your turn the TV says "Maya, tell the table your plan,"
   and everyone else sends you a move from their phone. You pick your own idea or a friend's. Using a friend's idea
   gives +1, and their hero's name slams onto the screen: "JUNO'S IDEA +1".
4. **Swipe to throw.** Muse reads your plan at face value and stamps how hard it is, sometimes with a dry one-line
   quip about your idea while the die is in the air. That difficulty shifts the roll. You swipe up on your phone and
   the d20 is thrown onto the TV table. Code rolls the dice; the AI never picks a number.
5. **Every number is its own outcome.** There's no pass/fail line: 1 is DISASTER, then UH OH, SORT OF, IT WORKS,
   GREAT, up to LEGENDARY at 20+.
6. **A story that follows your logic.** Muse takes your action literally, assumes it really happens the way you wrote
   it, and writes what would realistically follow, at that grade. Code checks that the outcome uses your own words
   (your chess set stays a chess set), names the hero, and stays short and plain; if not, it retries once. Muse judges
   how far your action moved things toward the finish line, which stays on screen all game, and code keeps that in
   bounds: a success never moves you backward. The story runs in 3 acts, then the narration hands the spotlight to
   the next player by name: "Leo, the lights are yours." Ten seconds before any deadline, the narrator nudges
   whoever hasn't sent yet.
7. **Every decision gets painted, read aloud and scored.** Muse paints a new scene with your group's heroes in it.
   One narrator, Sarah, reads it with the text appearing in sync, over original music made in the browser (a lobby
   theme and 5 story moods). Muse also picks the sound effects for each line from our library of 46 (a door
   creaking, a crowd gasping), timed to the words, plus a build-up and a payoff hit for the finale.
8. **The finale, together.** Everyone writes a last plan, and then the TV says "Convince each other": a short talk
   (30 seconds at the judge table, 60 at home) where every plan is on screen and people argue it out loud. Everyone
   backs one plan that isn't theirs (each backer adds +1, up to +2; a tie is a coin flip), then the whole table shakes
   their phones at the same moment to roll one shared die.
9. **Based on a true story.** The real event only set the scene; the ending is yours. So the grand ending comes in
   two beats. *What you did*: a card for every hero with their key move in their own words, and "Solved by" each
   player's real secret strength. Then *What really happened*: the real headline, its source and date, and how it
   really ended, with one bridge line read aloud that contrasts or matches the two ("You kept the gold safe. So did
   the real crew: nine million euros, handed to the police."). In Our stories it says *Based on Ava's true story*. A
   keepsake QR lets everyone take the story home.

## How AI is essential (and where code takes over)

Take Muse away and there is no game: no stories, no rulings, no outcomes, no art.

| Job | Model |
|---|---|
| Scores odd news for storyability and safety | muse-spark-1.3 (low effort) |
| Turns your one line into a hero card, keeping exactly what you typed | muse-spark-1.3 |
| Writes each story opening from the real article or a player's true story; code checks reading level and length | muse-spark-1.3 (high effort, with faster backups racing it) |
| Reads each plan at face value, stamps its difficulty, and writes the occasional quip | muse-spark-1.3 (minimal effort, temperature 0) |
| Writes each turn: what happened, what changed, the next step, progress, the sound effects and the hand-off to the next player; a quick copy-edit pass when it fits before the die lands | muse-spark-1.3 (minimal effort, started the moment the plan is judged so it's ready when the die lands) |
| Picks the art theme; writes the grand ending, the bridge line to the real story, and the finale's build-up and payoff sounds | muse-spark-1.3 |
| Hero portraits, and the heroes painted into a new scene after every decision | muse-image-1.0 (image edits, with the heroes and the last scene as references so characters stay consistent) |
| Optional voice input | muse-voice-transcribe-1.0 |
| Starting a game night from Muse, the agent | the Muse connector (MCP, `/api/mcp`) |

**Code decides everything with a number:** the dice (crypto RNG), the bonuses, the grade, how far progress may move,
the act changes, the turn order, the timers, and the "Solved by" line, which is built from the players' own answers.
The AI judges ideas, never people. Nobody is scored or ranked. DM's Notes on the TV shows every call Muse made and
why.

**The one non-Meta job is the narrator's voice,** because Meta has no text-to-speech model: ElevenLabs (one voice,
Sarah; Eleven v3 for the story beats prepared ahead, Flash for instant turn lines), with OpenAI TTS as the automatic
backup, Gemini TTS behind it, and plain text as the last fallback. Our sound-effect library was also made with
ElevenLabs ahead of time; Muse picks which ones play. Everything else is Meta.

## How we built it

- **Next.js on Vercel and Supabase Realtime.** The TV runs the whole game; phones only send intents (join, idea,
  plan, vote, ready, throw, shake). Every AI call has a fallback (the turn fallback still names the plan), so a slow
  response never freezes the table. Every AI call starts the moment its inputs exist, so the next painting, line and
  voice are ready before anyone waits.
- **SerpApi Google News** supplies the odd news, cached for 4 hours, then a keyword block list and the storyability
  gate. Stories that pass are saved to a story library, so a quiet news week still has good stories.
- **An MCP connector** (`/api/mcp`) lets Muse, the agent, list tonight's stories, open a table and draft the invite.

### How AI tools and test harnesses helped us build it

Our creative director (first hackathon) made every creative call. Claude Code was the lead engineer, running
parallel agents: builders, a story director, lobby and phone designers, a voice and sound designer, QA testers,
reviewers and recording analysts. What actually changed the game:

- **Watching real playtests, frame by frame.** Agents pulled a frame every half second from our screen recordings,
  transcribed the room with Muse Voice Transcribe, and lined up every turn: plan, roll, what the AI wrote, what the
  players said. Our worst run showed stories that ignored the plan and repeated the same situation ("Bro, I literally
  just solved the problem"). That recording is why we threw out pre-written story branches and built the procedural
  engine: players steer, the DM reacts.
- **A story test harness.** A script plays whole Quick Tales against real Muse calls with tricky plans (a chess set, a
  sweater for a calf, hiring the turtle) and checks every outcome against the rules.
- **Model bake-offs on our real job.** A rewritten judging rubric took Muse Spark from 5-7 of 8 fair rulings to 8 of
  8, three runs in a row: a better rubric beat a bigger model. In a blind writing test of five writers (Spark at two
  effort levels, Muse Wonder, GPT-5.5, GPT-4.1), Spark stayed: it credited the right friend every time, kept the
  limits and fit the time budget. We picked the narrator the same way, by ear, in a voice bake-off.
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
- **Our stories felt lame all night, and we kept treating symptoms.** "Nobody cares about bridges." We added a
  storytelling score, word filters, spoiler checks. The real cause was one rule: our safety filter was so broad it
  blocked every story with an edge (heists, cons, weird court cases, scandals), which is exactly what makes real news
  fun to play. We made safety precise instead of broad: hard lines that protect people, room for grown-up mischief.
- **Too many features.** Secret clues, arguing with the DM, boosts and re-rolls crowded every screen. A Meta judge
  told us to nail one or two things. We cut it down to one loop: suggest, pick, roll, see what happens.

## Accomplishments that we're proud of

- A full game, from QR code to true-story reveal, that a new player understands in a minute.
- A turn system where listening to your friends is the best move, and a finale where you have to convince each other.
- A story that follows the players' own logic instead of a script, with AI that runs the whole game but never decides a
  number or rates a person.
- Our creative director's first hackathon: they made every creative call and directed AI to build it.
- We almost weren't here: our application got denied, and one of us never applied. We walked in anyway.

## What we learned

- **AI needs a director.** Left alone, it drifts away from the original idea and writes stories that are hard to
  follow. So we built the guidance: a story engine where Muse writes inside clear rules and code checks every move it
  makes.
- **Build the prototype fast.** A good idea isn't enough. Our first playtest found problems no plan would have, and
  oh boy, there were a lot of them.
- **Looking good isn't feeling good.** AI is great at building things that look good fast. Making them feel good
  took playtesting with real people and watching the recordings.
- **Let the players steer, and let code decide the numbers.** The best stories came from taking plans literally, and
  players trust real dice.
- **Guardrails should protect people, not flatten the story.** And when the same complaint keeps coming back in
  different words, look for the one rule underneath it.
- **Our first hackathon:** stressful, fun, and a great experience.

## What's next for Group Project

- **Campaign mode:** your heroes carry over into the next story and grow from what they did, like a real D&D campaign.
- **Our stories as the main mode:** every player brings a small true story, and the night becomes "I didn't know that
  about you."
- **Real World mode:** opt-in, heavier news with guardrails, for groups who want to talk about things that matter.

---

## Built with

`next.js` · `react` · `typescript` · `tailwindcss` · `vercel` · `supabase-realtime` · `meta-muse-spark` ·
`meta-muse-image` · `meta-muse-voice-transcribe` · `mcp` · `elevenlabs` · `openai-tts` · `web-audio-api` · `serpapi` ·
`google-news` · `claude-code`

## Try it

- Table (open on a laptop or TV): https://groupproject-game.vercel.app/tv
- Phones: scan the QR on the TV, or go to https://groupproject-game.vercel.app/play
- A short, tested game (about 5 minutes): https://groupproject-game.vercel.app/tv?judge=1
- Fewer than 2 people? Open https://groupproject-game.vercel.app/tv?bots=1 and add test players.
