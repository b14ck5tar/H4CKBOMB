# Group Project (placeholder name)

## Tagline

A party game where Meta's Muse is the Dungeon Master, your phones are the controllers, and every story starts from something that really happened.

## Inspiration

People rarely stay quiet at a party because they dislike each other. They're just unsure what to say. Tabletop games fix that: everyone gets a role, a reason to speak and a shared problem. But someone has to prep as Dungeon Master, so most groups never play. We wanted Muse to be the DM so the humans could just show up and talk to each other. And we wanted stories from real life, so the ending starts a real conversation.

## What it does

A laptop or TV is the table. Phones scan a QR code and become controllers. No accounts, no prep.

1. **Make a hero.** Describe them in one line and answer "What are you weirdly good at?" Muse paints a cartoon hero.
2. **Pick a story.** *Odd news:* three strange, harmless headlines from around the world this week, and the table votes. *Our stories:* each player privately writes a small real story, including how it really ended, and the table picks one.
3. **Take turns.** On your turn, everyone else suggests an action from their phone. You choose your own plan or a friend's. Working in a friend's idea gives +1 and puts their name on screen ("+ Sam's idea").
4. **Roll.** Muse judges the one action at face value, and the TV shows "Needs 12+" before you roll a d20. Code rolls the dice; the AI never picks numbers.
5. **The story branches.** Fixed start, fixed goal, open middle. After each roll Muse writes what happened in short, plain sentences, and paints a new scene with your group's heroes in it for every decision. A narrator voice, cast by the AI to fit the story, reads it aloud, and the AI picks one art style per story.
6. **Grand finale.** Everyone proposes a last plan, everyone votes (not for their own), and the whole table shakes their phones together to roll one shared die.
7. **The real ending.** The TV shows what really happened: the article plus what's happening now in the real world, or the author's real ending. A keepsake QR lets everyone take the story home.

## How we built it

**One model per job, picked by testing:**
- **muse-spark-1.3** judges plans live (about 1.7 s per plan) and writes each outcome.
- **muse-image-1.0 edits** paint the heroes into each scene, using a hero lineup sheet and the previous scene as references so the characters stay consistent.
- **muse-voice-transcribe-1.0** handles optional voice input. Typing is the default, so the room talks to each other instead of at a machine.
- **OpenAI gpt-4o-mini-tts** narrates (Gemini TTS as backup), because Meta has no text-to-speech model. The AI casts one of five voices and a reading style per story.
- **SerpApi Google News** supplies live odd news, filtered by a keyword block list and a Muse classifier, then cached so a game never waits on a search.
- **Next.js on Vercel and Supabase Realtime.** The TV runs the game and phones send inputs. Every AI call has a fallback, so a slow response never freezes the table.

**How we used AI to build it.** Claude Code was our lead engineer. It ran parallel agents for research, building and review, while our creative director made every creative call.
- **A DM stress-test harness** runs 32 scenarios against the DM prompts before a change ships.
- **A model bake-off** with real API calls. Muse Spark beat Muse Wonder on humor in both head-to-heads and was about twice as fast. The bigger lesson: rewriting the judging rubric took Spark from 5 to 7 correct rulings out of 8 to all 8, three runs in a row. A better rubric beat a bigger model.
- **Playtest analysis from screen recordings.** Agents timed where the minutes went: about 2.5 minutes of idle TV in an 8-minute game, and 40 s waiting on character creation.
- **Pivots from real playtests.** Instant heroes, one action per turn, plain writing and heroes inside the art all came from watching people play.

## Challenges we ran into

- **The AI's writing was unfollowable.** In our first playtest it invented jargon and turned a villain description into a character. A player asked, "What the hell is foam?" We rewrote the prompts for 8-year-old clarity: short sentences, clear cause and effect, the goal always on screen.
- **Too many features.** Secret clues, arguing with the DM, boosts, re-rolls and a closing ritual crowded every screen. A Meta judge told us to nail one or two things instead of adding more.
- **Cutting to the core.** We turned off most of it and kept one loop: suggest, pick, roll, see what happens.

## Accomplishments that we're proud of

- A full game from QR code to real-story reveal that a new player understands in a minute.
- A turn system where helping a friend is the best move.
- AI that is the whole game but never decides a number or rates a person.
- Our creative director's first hackathon. *(CD: add a line in your own words.)*

## What we learned

- The flow matters more than the feature count.
- Let the model write and let code decide. Players trust real dice.
- Test models on your actual job. Our guess about the "better" model was wrong.
- Watch people play. The recordings showed problems we had stopped seeing.

## What's next for Group Project

- **Real World mode:** opt-in heavier news with guardrails, for groups who want to talk about things that matter.
- **Remote play** for friends in different cities.
- **Weekly chapters:** the same crew, a new real story each week.

---

## Built with

`next.js` · `typescript` · `react` · `tailwindcss` · `vercel` · `supabase-realtime` · `meta-muse-spark` · `meta-muse-image` · `meta-muse-voice-transcribe` · `gemini-tts` · `gemini-api` · `serpapi` · `google-news` · `claude-code`

## Tracks to select

- Meta: Bringing People Closer Together with AI
- Most Entertaining
- Best Use of SerpApi
- MLH Best Use of Gemini API (we use Gemini TTS for narration)
- Best Novice applies automatically if we're eligible.

## Try it

- Table (open on a laptop or TV): https://groupproject-game.vercel.app/tv
- Phones: https://groupproject-game.vercel.app/play

*Status: submitted Saturday night. The parts marked "in progress" are being finished for the final version, due Sunday 11:30 AM.*
