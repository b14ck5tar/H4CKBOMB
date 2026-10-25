# Group Project (Devpost text, final build)

> **Before pasting (Sun, after feature freeze at 10 AM; deadline 11:30 AM).** This block is not for Devpost.
> As of Sun ~1 AM these were decided but not yet in the code. Check each on the deployed build. If one did not ship,
> delete the matching sentence marked ⟦check⟧ below and remove the ⟦check⟧ markers from the rest.
> - ⟦check 1⟧ "Based on a true story" title on the reveal.
> - ⟦check 2⟧ The graded outcome meter on the TV (DISASTER ... LEGENDARY). The grading itself is shipped (lib/grade.ts).
> - Not claimed below (add one plain sentence to step 7 or 8 only if it shipped): the "because of you" ending
>   montage, and the danger meter.
> Also: paste the video link, upload `devpost-media/gallery/*` (re-shoot `4-phones.jpg`: it still shows the old
> "Needs 11+" roll button), and confirm groupproject-game.vercel.app runs the final build.

## Name
Group Project

## Tagline
The one group project where everyone actually shows up.

## Inspiration

People rarely stay quiet at a party because they dislike each other. They're just unsure what to say, so everyone
ends up on their own phone. Tabletop games fix that: everyone gets a role, a reason to speak and a shared problem.
But someone has to prep and run the game as Dungeon Master, so most groups never play. We wanted Meta's Muse to be
the Dungeon Master so the humans could just show up and talk to each other. And we wanted every story to come from
real life, so the ending starts a real conversation.

## What it does

A laptop or TV is the table. Phones scan a QR code and become controllers. No app, no accounts, no prep.

1. **Make a hero.** Describe them in one line and answer "What are you weirdly good at?" Muse paints a cartoon hero.
   Ready-made heroes are there if you'd rather jump straight in.
2. **Pick tonight's story.** *Odd news:* strange, harmless stories from this week's real news, disguised as fantasy
   quest cards so nothing is spoiled. *Our stories:* each player privately writes a small true story and how it
   really ended, and the table votes on one. A Kids / Teens / Adults setting tunes the tone and the news filter.
3. **Take turns, with your friends' help.** On your turn, everyone else suggests a move from their phone. You pick
   your own plan or a friend's. Working in a friend's idea gives +1 and puts their name on the TV ("+ Sam's idea").
4. **Swipe to throw.** Muse judges your one action at face value, and that shifts the roll. You swipe up on your
   phone and the d20 is thrown onto the TV table. Code rolls the dice; the AI never picks a number.
5. **Every number is its own outcome.** There's no pass or fail line: a 1 is a spectacular disaster, a 20 is
   legendary, and everything in between is its own shade. The TV fills an outcome meter to the grade. ⟦check 2⟧
   Fails are funny and set you back, but the story always moves forward.
6. **The story branches, and gets painted.** After every roll Muse writes what happened in short, plain sentences,
   and paints a brand-new scene with your group's heroes in it. A narrator voice, cast by the AI to fit the story
   (Vesper, Juniper, Hollis or Wren), reads it aloud over original music generated in the browser. The AI also
   picks one of six art styles per story.
7. **Grand finale.** Everyone proposes a last plan and votes (not for their own), then the whole table shakes their
   phones at the same moment to roll one shared die.
8. **Based on a true story.** ⟦check 1⟧ The reveal shows what really happened: the real article and what's
   happening there now, or, in Our stories, how it really ended for the friend who wrote it. The "Solved by" line
   credits each player's real "weirdly good at" answer. A keepsake QR lets everyone take the story home.

Quick Tale runs about 5 minutes (one turn each); Full Story about 10 to 15. Built for 2 to 6 players in one room.

## How we built it

**One model per job, picked by testing:**
- **muse-spark-1.3** at three effort levels: *high* writes each story opening (then code checks reading level and
  word limits), *minimal* judges plans live in about 1 to 2 seconds, and a fast setting writes each outcome at its
  grade. It also filters the news and casts the narrator.
- **muse-image-1.0** edits paint the heroes into each new scene, using the heroes and the previous scene as
  references so characters stay consistent. Hero portraits too.
- **muse-voice-transcribe-1.0** handles optional voice input. Typing is the default, so the room talks to each other
  instead of at a machine.
- **OpenAI gpt-4o-mini-tts** narrates, because Meta has no text-to-speech model. Gemini TTS is the automatic backup,
  and plain text is the last fallback.
- **SerpApi Google News** supplies the odd news, filtered by a keyword block list and a Muse Spark classifier, and
  cached for 4 hours so no game waits on a search.
- **Next.js on Vercel and Supabase Realtime.** The TV runs the whole game; phones only send intents. Every AI call
  has a canned fallback, so a slow response never freezes the table, and the next painting is prepared in the
  background so nobody waits on art.
- **An MCP connector** (`/api/mcp`) lets Muse, the agent, list tonight's tales, open a table and draft an invite.

**How we used AI to build it.** Our creative director (first hackathon) made every creative call; Claude Code was
the lead engineer, running parallel agents: a builder, a story director, a story pipeline, lobby and phone
designers, a QA tester, reviewers and recording analysts.
- **DM stress test:** 32 hostile scenarios across all 8 curated quests before we froze the prompts.
- **Judging bake-off** with real API calls: Spark vs Wonder at several effort levels. A rewritten rubric took Muse
  Spark from 5-7 of 8 correct rulings to 8 of 8, three runs in a row. A better rubric beat a bigger model.
- **Blind writing bake-off:** five writers (Spark minimal, Spark high, Muse Wonder, GPT-5.5, GPT-4.1) on the same
  three stories, shown to our creative director with the names hidden. Spark stayed: it credited the right friend
  every time, kept the limits and fits the time budget. One competitor credited the wrong friend, which a party game
  can't get wrong.
- **Playtest analysis from screen recordings:** agents timed where the minutes went in our first playtest (about 2.5
  minutes of idle TV in an 8-minute game, 40 s waiting on character creation) and read every line the AI wrote.
- **Test players:** up to 3 bot players with personalities, run by the TV, so we could playtest the full loop with
  two people at 3 AM.

## Challenges we ran into

- **The AI's writing was unfollowable.** In our first playtest it invented jargon and turned a villain's description
  into a character. A player asked, "What the hell is foam?" We rewrote the prompts for an 8-year-old's clarity:
  short sentences, cause and effect, the goal always on screen, and every story about a problem, not a villain.
- **Too many features.** Secret clues, arguing with the DM, boosts, re-rolls and a closing ritual crowded every
  screen. A Meta judge told us to nail one or two things. We cut it all down to one loop: suggest, pick, roll, see
  what happens.
- **Pass/fail felt flat.** Our creative director's playtest said "not game-like enough". So every roll number became
  its own outcome, and a fail moves the story somewhere worse instead of stalling it.

## Accomplishments that we're proud of

- A full game, from QR code to true-story reveal, that a new player understands in a minute.
- A turn system where helping a friend is the best move.
- AI that is the whole game but never decides a number or rates a person.
- Our creative director's first hackathon. *(CD: one line in your own words here.)*

## What we learned

- The flow matters more than the feature count.
- Let the model write and let code decide. Players trust real dice.
- Test models on your actual job. Our guess about the "better" model was wrong twice.
- Watch people play. The recordings showed problems we had stopped seeing.

## What's next for Group Project

- **Our stories first:** every player brings a small true story; the night becomes "I didn't know that about you".
- **Remote play** for friends in different cities (a `/watch` big-screen view already exists).
- **Weekly chapters:** the same crew, a new true story each week.
- **Real World mode:** opt-in heavier news with guardrails, for groups who want to talk about things that matter.

---

## Built with

`next.js` · `typescript` · `react` · `tailwindcss` · `vercel` · `supabase-realtime` · `meta-muse-spark` ·
`meta-muse-image` · `meta-muse-voice-transcribe` · `openai-tts` · `gemini-tts` · `web-audio-api` · `serpapi` ·
`google-news` · `mcp` · `claude-code`

## Tracks to select

- Meta: Bringing People Closer Together with AI
- Most Entertaining
- Best Use of SerpApi
- MLH Best Use of Gemini API: **CD call.** Gemini TTS is now only the backup narrator, so this entry is weaker than
  when Gemini was the main voice. Keep it only if we're under the track limit.
- Best Novice applies automatically if we're eligible.

## Try it

- Table (open on a laptop or TV): https://groupproject-game.vercel.app/tv
- Phones: scan the QR on the TV, or go to https://groupproject-game.vercel.app/play
- Fewer than 2 people? Open https://groupproject-game.vercel.app/tv?bots=1 and add test players.
- Video: *(paste the link)*
