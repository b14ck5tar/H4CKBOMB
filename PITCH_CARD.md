# PITCH CARD: Group Project

**Group Project: the one group project where everyone actually shows up.**

Rewritten Sun Oct 25 ~1 AM, updated Sun ~4:30 AM (laptop clock, CDT) for the procedural story build (players steer, the DM reacts) and judge mode. Stage pitch: Sun 5:30 PM (GDC 2.216). Judging table: Sun 2 to 5 PM
(WEL): the partner runs it alone until the CD is back ~4:45; lines in PITCH_KIT.md, pocket card `pitch/CHEAT_SHEET.md`. Slides: `pitch/deck.html` (also at
groupproject-game.vercel.app/pitch/deck.html). Live: **groupproject-game.vercel.app** (TV: `/tv`, phones: `/play`).

CD = creative director (speaks). ENG = engineer/partner (drives the laptop and the live demo phone).

**Never mention cut features:** secret clues, Convince the DM, Boost, Catch!, Mirror Mirror, hearts / Hope, "Needs 12+"
(rolls are graded now; there is no pass line), story ladders or pre-written branches (the story is procedural now).
Old words to avoid: "fairytale", "Once Upon a Roll", "inspired by real events", "weirdly good at", "secret talent" (the join
question is "What's your secret strength?"). If asked: "We cut it after playtesting. It crowded the screen."

## 3 lines to remember
1. **"The one group project where everyone actually shows up."**
2. **"There's no script. On your turn, your friends pitch you ideas. Use one and they get the credit."**
3. **"Every story is based on a true story. You find out which one at the end."**

---

## The 2-minute stage pitch (5:30 PM)

Slides advance on the bracketed numbers. ~280 spoken words + one live moment. Rehearse with a stopwatch twice.

**[1: title]** CD:
> "Hi, we're Group Project. The one group project where everyone actually shows up."

**[2: problem]** CD:
> "Think about the last time you hung out with friends. How much of it was everyone on their own phone?
> Tabletop games fix that. Everyone gets a role and a reason to talk. But somebody has to run the game, so most
> groups never play."

**[3: answer]** CD:
> "So Meta's Muse is our Dungeon Master. The TV is the table, your phones are the controllers, no app, no account.
> And every story is based on a true story."

**[4: a turn]** CD:
> "Here's a turn. There's no script: the players steer. The TV tells Gus to pitch his plan to the table, and everyone
> else sends him ideas from their phones. If he uses a friend's idea, he gets plus one and their name goes on screen.
> So the best move in the game is listening to your friends."

**[LIVE MOMENT, ~10 s]** ENG holds up a phone, says "Watch the screen", and swipes up. The die flies onto the TV
(the second browser tab, pre-staged at a roll), tumbles and lands on a grade. CD over the landing:
> "Every number is its own outcome, from disaster to legendary. The dice come from code, never the AI."

*Fallback if the stage Wi-Fi or tab misbehaves: play the 10 s swipe clip from the video. Never debug on stage.*

**[5: art and narrator]** CD:
> "Then the DM reacts. Muse takes your plan literally and writes what would really happen next, in your own words.
> It paints your heroes into a brand-new scene for every decision, a narrator reads it, and the story hands the
> spotlight to the next friend by name. A bad roll never stops the story. It just makes it funnier."

**[6: the ending]** CD:
> "For the finale, everyone shakes their phone at once for one shared roll. And then the twist: it's based on a
> true story. The TV shows what you did, then what really happened, and how your secret strength saved the day. That's
> the moment people turn to each other and say 'wait, that's real?'"

**[7: under the hood]** CD (or ENG):
> "Muse writes and judges. Code rolls the dice. Players play. We tested every model on its job: a better judging
> rubric took Muse Spark from five of eight fair rulings to eight of eight, and Spark beat bigger models in a blind
> writing test. I'm a first-time hacker; I made the creative calls, and Claude Code was our lead engineer, running
> a team of agents that built, tested and watched our playtests frame by frame."

**[8: close + QR]** CD:
> "Nobody has to be the Dungeon Master anymore. Scan this and play. Group Project: the one group project where
> everyone actually shows up. Thank you."

**Meta criteria the pitch hits, in order:** connection (slides 2, 4, 6), AI essential (3, 5, 7), originality (6),
working demo (the live swipe and the QR on 8).

## The 30-second version (elevator, hallway, a judge walking past)

> "It's a party game where Meta's Muse is the Dungeon Master and your phones are the controllers. On your turn,
> your friends pitch you ideas, and using a friend's idea is the best move. You swipe to throw the die, Muse writes
> what your plan would really do and paints it, and at the end you find out the whole story was based on a true story.
> Group Project: the one group project where everyone actually shows up. Scan this and play one turn."

(~75 words. Hand them the QR on "Scan this".)

---

## Meta's rubric, our one beat each

| Criterion | Weight | Say it | Where they see it |
|---|---|---|---|
| Human connection | 30% | "The best move is using a friend's idea." | Friends' suggestion bubbles, "+ Sam's idea +1", the TV's "tell the table your plan", the hand-off by name, the shake-together finale, "Solved by" with their secret strength |
| AI essential + integrated | 25% | "Muse writes the story from your plans, judges every plan and paints your heroes into every decision." | The outcome uses the player's own words, progress + 3 acts, new painting per decision, narrator, DM's Notes (N) |
| Originality | 20% | "It's based on a true story, and you find out at the end." | The reveal: "What you did", then "What really happened" |
| Working demo | 20% | "You just played it on your own phone." | Their phone, real dice, nothing frozen |

## Judge Q&A

### Privacy
**"What happens to what we type?"** It goes to Meta's Muse API to run tonight's game; the phone says so on the
join screen ("No accounts. Your words go to Meta's Muse AI to run the game; the TV keeps the finished tale, and
our server caches the art and audio."). No accounts, no
names beyond a nickname, no database of players. Rooms are a 4-letter code over Supabase broadcast; the TV holds the
game in memory. The keepsake lives in the link itself. We never use Meta's `-contributor` models (code refuses to
start if one is configured), because those are the ones Meta trains on.
**"What about Our stories, where people type real things?"** Same path. The form asks for small stories you'd tell
this table, and the real ending stays hidden until the reveal.

### Cost
**"What does a game cost?"** About 20 cents for a Quick Tale, by our math: paintings are a cent each (~6 per game),
the narrator ~3 to 5 cents, the writing and rulings a few cents (Muse Spark rulings are about $0.002 each). Ready-made
heroes are pre-painted, so they're free. The live news search is cached for 4 hours, so a game never pays for it.
*(Estimate from published prices, design/23 and design/26. Don't quote lower unless we've measured a real game.)*

### Why a non-Meta voice
**"Why a non-Meta narrator?"** Meta has no text-to-speech model; Muse Voice Transcribe only listens. So the voice
is the one job that had to leave Meta. We compared voices by ear and picked ElevenLabs (Eleven v3 for the story beats, Flash for instant turn lines), with OpenAI TTS
as the automatic backup and plain text if both fail. Meta's team told us on Saturday to pick the best model per job,
and we tested every job (design/23, design/26).

### Safety
**"How do you keep tragic news out?"** Safety is precise, not broad. Hard limits the AI can't cross in any mode: no
deaths, violence against people, sexual content, children, hate, disasters or partisan politics, and no mocking private
people (a keyword block, then the Muse Spark gate). Inside those lines, Kids / Teens / Adults tunes the tone; Adults
allows grown-up mischief like heists, cons and odd court cases. A story also has to average 4 of 5 on 8 storyability
checks. We learned this the hard way: our first filter was so broad it blocked every story with an edge. Stories center on a problem (something stuck, lost or spreading), never a villain or a
real group. Heroes are cartoons, so nobody is judged on their face.
**"Can players break it?"** Player text goes in as in-world speech inside a strict JSON schema. "Ignore all previous
instructions" just becomes something your hero shouts. Code computes every number; the AI only picks a tier. We
ran a 32-scenario hostile stress test on the DM before freezing the prompts.
**"Does the AI judge people?"** Never. It judges the plan as written. Nobody is scored, ranked or voted out.
**"Is the story scripted?"** No. The real story fixes the place, the problem and the finish line. Everything else
comes from the players: Muse takes each plan literally and writes what would realistically follow, at the grade the
dice gave. Code checks the outcome uses the player's own words (a chess set stays a chess set), keeps every win, moves
the progress bar within limits and runs 3 acts. Our worst playtest had pre-written branches that ignored players; that
recording is why we rebuilt it (design/33, design/35).

### AI depth
**"How exactly is Muse used?"** Muse Spark: the storyability and safety gate on the news, every story opening (high
effort, checked for reading level), every ruling (minimal effort), every turn (what happened, what changed, the next
step, how much progress, and the hand-off to the next player), the art theme per story, the ending. Muse Image: hero portraits and a new scene with your heroes for every decision. Muse Voice Transcribe:
optional voice input (typing is the default so the room talks to each other). Plus an MCP connector so Muse, the
agent, can start a game night and draft the invite. Take Muse away and there is no game.
**"Why not just ChatGPT?"** That's one person and a chatbot. This is a room: one shared screen, phones as
controllers, friends feeding each other ideas, real dice, a reveal.
**"How did you use AI to build it?"** Claude Code as lead engineer with parallel agents (builder, story director,
story pipeline, lobby and phone designers, QA tester, recording analysts, reviewers). A 32-scenario DM stress test.
A judging bake-off (rubric v2: 5/8 → 8/8 fair rulings, three runs). A blind writing bake-off of five writers
including GPT-5.5 and GPT-4.1; Spark won because it credited the right friend and stayed fast. And agents analyzing
our playtest recordings frame by frame ("what the hell is foam?" became our writing rule).

### What's next
**"Where does this go?"** (1) **Campaign mode**: your heroes carry over into the next story and grow from what they
did, like a real D&D campaign. (2) **Our stories** as the main mode: every player brings a small true story, and the
night becomes "I didn't know that about you." That came from Meta's own feedback. (3) **Real World mode**: opt-in
heavier news with guardrails, for groups who want to talk about things that matter. Not tonight's build.

### Novice judge
CD: "This is my first hackathon. The idea, the look, the narrator's voice and every creative call are mine."

## If something breaks (stage or table)
- **A painting is slow:** say nothing; the old painting stays up and the new one fades in.
- **Muse is slow or down:** a fallback line that still names the plan fills in, and the game keeps going.
- **Narrator silent:** text still appears. "Tonight the narrator is shy." Move on.
- **Wi-Fi drops:** timers freeze while every phone is offline. Switch the laptop and phones to the phone hotspot.
  If that fails, play the video.
- **Past time:** skip to the reveal slide and the close.

## Research lines (use one at most, keep the hedge)
- **The liking gap:** after a conversation, people underestimate how much the other person liked them (Boothby et
  al. 2018, *Psychological Science*).
- **Laughter bonds:** shared laughter is linked to endorphin release and group bonding (Dunbar 2012, *Proc. R. Soc. B*).

**Do not say:** "studies show party games cure loneliness", "your AI friend", "oxytocin".
