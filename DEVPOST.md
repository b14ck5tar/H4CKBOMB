# Group Project

**The one group project everyone actually wants to be in. A game night that gives everyone an excuse to talk to each other.**

## Inspiration

Most of us don't avoid each other because we dislike each other. We avoid each other because we're unsure. Will they want to talk? What would I even say? So we follow the crowd's silence, and the room stays quiet. Research says we have it backwards: people consistently underestimate how much others enjoy talking with them (the "liking gap," Boothby et al., 2018) and mistakenly seek solitude when connection would feel better (Epley and Schroeder, 2014).

Our creative director's thesis: people don't need more reasons to connect, they need a role, a reason and a script. Tabletop games have always done exactly that. Everyone gets a character, a goal and something to say. The catch is that someone has to prep as Dungeon Master, so most groups never play. Meta's Muse can be the DM. The humans just have to show up and talk.

It works for any group that wants to actually talk: families, roommates, long-distance friends on a call, coworkers, classrooms.

## What it does

**The news gives the problem. Your real selves are the solution.**

One screen becomes the table (a laptop or TV) and every phone becomes a character and a controller. 2 to 6 players scan a QR code and the group is ready in about thirty seconds. No DM, no prep, no account. **No TV? (if shipped)** Any phone can host instead: everyone plays from their own phone, from anywhere, with a crew chat for friends who aren't in the same room.

*Items marked (if shipped) were built this weekend but not yet verified end to end with live Muse calls when this was written.*

**You play yourself, with a hidden magical side (if shipped).** It's urban fantasy: ordinary people who turn out to be a little magic. Joining asks two light questions, and either can be skipped:
- *"What's something you're weirdly good at?"* becomes your power. Parallel parking turns into "slips through any gap in the spirit traffic."
- *"What's a small thing that scares you?"* becomes your character's flaw. That's comedy in the story only: the game never asks anyone to actually do the scary thing.

Skip both and you can still type a one-line hero ("a retired knight who's afraid of geese"). Muse Spark builds the character card and Muse Image paints a portrait. Heroes are cartoon characters, never realistic people. That's a deliberate choice: nobody has to put their face on a screen to play.

**"Who's playing?" (if shipped).** Before the story starts, the host picks Kids, Teens or Adults. That one setting decides which real stories are allowed, the DM's tone, how strictly chat is filtered, and the example heroes. Tragedies, victims, violence and divisive politics are blocked at every level.

**A modern urban fantasy, built from real news.** Every quest starts with a real news story from this week and gives it one uncanny supernatural explanation. The tone is spooky-funny. Stories are filtered hard: no tragedies, no real victims, no politics. What's left is the strange and harmless.

**The story that fits your crew (if shipped).** Tap "Pick the best story for us" and Muse reads what everyone said, looks at 5 to 10 safe stories allowed for your rating, and picks the one where this group's real skills fit best, with one spotlight moment per player. The host can still choose by hand. Local first: Austin news, then wider (if shipped).

Our demo quests:
- An 80-ton boulder that fell at a New Hampshire park (nobody hurt)
- A strange radio signal in the Milky Way
- A bridge reopening in Porter, Indiana
- Plastic pellets from a UK spill washing up in Denmark
- A 2-year-old's 280-pound pumpkin

**Around the Table: a round where everyone acts.** There is no voting and nobody's idea gets left out.
1. **A private secret clue on every phone.** Each player knows something the others don't, so the table has to talk to piece the case together.
2. **Everyone makes a plan** by typing or holding to talk.
3. **Muse rules each plan.** Clever ("That works, no roll"), Solid, Risky, Absurd or Miracle.
4. **Convince the DM.** Players get one shot to argue their case, by voice or text. A good argument can upgrade a plan to a sure thing.
5. **Boost a friend.** Tap 🔥 on a friend's plan to give it a better roll.
6. **Everyone rolls.** Then **Catch!** Spend your one heart to re-roll a friend's fail.
7. **Stuck, then rescued.** A hero who rolls a disaster gets stuck, and their friends rescue them next scene.
8. **One short story beat per hero**, quoting their own words back to them.
9. **Ready buttons** so the TV waits for everyone. No one gets rushed past the part they were reading.

**Three scenes, then a Final Roll** where everyone makes their final move at once. Each scene's opening gives that scene's spotlighted player a moment where their real skill can matter (if shipped). It's an opening, never a requirement.

**Mirror, Mirror (if shipped).** A closing ritual. Each player is secretly another player's guardian and writes one kind sentence about that person's best moment. Players first guess what was written about them ("probably nothing"), then the screen reveals it. It aims straight at the liking gap. Nobody ever rates anyone.

**The reveal is proof, not a twist.** After the epilogue: "This really happened. Here's the article." **"The official story"**, the real headline, sits next to **"What your group uncovered"**, plus one line that names the crew **(if shipped)**: *"Solved by Ava's parallel parking and Ben's coffee."* The news gave the problem; your real selves were the solution.

**A keepsake.** Every night becomes an illustrated story saved to the group's shelf. "Next chapter, same crew."

**Muse can run game night.** Our live MCP connector at `/api/mcp` exposes three tools for Meta's personal agent: `start_game_night`, `list_todays_tales`, and `invite_message`. The agent plans; the humans send the invite and show up.

## How we built it

**Architecture.** Next.js 15, TypeScript and Tailwind on Vercel, live at https://once-upon-a-roll.vercel.app (URL unchanged for now). The TV browser at `/tv` runs the game state machine, phones at `/play` send inputs, and they sync over Supabase Realtime. In no-TV mode (if shipped) the same game engine runs on the host's phone, and every phone draws the story itself. The host is refresh-proof (if shipped): it saves a snapshot of the game as it goes, so a reloaded TV or host phone picks up the story where it left off, and a phone that fell asleep catches up when it wakes. All AI calls go through server routes, so keys never reach a browser.

**Muse is the DM, the painter and the ears.**
- **Muse Spark** turns players' real answers into characters, picks the story that fits the crew (if shipped), and writes scenes, rulings, appeals (the Convince the DM verdicts), story beats, the epilogue and the keepsake. The "Who's playing?" rating rides along on every DM prompt (if shipped). A JSON call measures about 1.9 s. Strict JSON schemas keep every answer in shape.
- **Muse Image** paints character portraits and scenes. We measured about 14 s for a portrait and about 23 s for a scene.
- **Muse Voice Transcribe** powers hold-to-talk plans and arguments.
- **The MCP connector** lets Muse start the night itself.

**Narration engineered to sound like a human DM, not AI.** After our first playtest ("the AI narration is obvious"), we researched what separates human DMs from AI ones and wrote voice rules into the prompts: short concrete lines, quote the players' own words, no tidy button at the end of every paragraph. A banned list of AI-tell words, and a server-side scrubber that cleans what slips through, keeps the output on voice.

**The AI doesn't touch the dice.** The server rolls every die with cryptographic RNG, and code computes totals and outcomes. The model proposes a ruling and prose inside a schema, so it can't invent rules.

**Prompt injection, tested.** A player typed "ignore all previous instructions." Player text is wrapped as in-world speech, so the result was: *"Pip shouts gibberish magic words at the sky."* The game carried on.

**News pipeline.** A scheduled job pulls real stories, runs them through the filter (keyword prefilter, then a Muse Spark classifier that rejects casualties, victims and politics), and caches ready-to-play quests, so no news call sits on the critical path of a game. Each quest is tagged with the youngest group it suits, and the cache is filtered by the table's rating after the fact, so a rating never costs an extra search (if shipped). SerpApi Google News feeds it, with RSS and hand-written seed quests as backups.

**Testing the fit.** "Your real skill solves a random news story" can feel forced. A test script plays 20+ random parties (real-sounding skills and fears, some skipped, all three ratings) against the dev server and flags contract breaks: a story outside the candidates or the rating, a player with no spotlight or two, a flaw that reads like a real-life dare. A human reads the rest and judges whether each fit feels natural.

**Art: "Neon Uncanny."** Scenes are in Spider-Verse-style comic art where only the impossible thing glows magenta and cyan. The UI is a dark, late-night broadcast look to match.

**Built with Claude Code.** Claude Code (Anthropic) was our lead engineer, orchestrating parallel agents for research, art direction, the news pipeline, voice and code review, while the Muse models run inside the product itself.

## Challenges

- **Making the AI sound like a person.** Our first narration read like AI, and our first loop left players' ideas unchosen. We rebuilt the voice and replaced voting with a round where everyone acts.
- **Making every player matter.** Private clues, boosts, Catch! and one story beat per hero mean no one watches from the sidelines.
- **Latency vs. a party.** A portrait takes about 14 s and a scene about 23 s. We hide the wait with placeholder sketches, pre-generated scenes and Ready buttons, so the TV is never dead air.
- **Filtering the news.** "Bridge collapse" can be a charming quest or a terrible story. A hard-block list, a soft-flag list and a casualty check separate them.
- **Real answers, random news.** Random skills plus a random headline often feel cheesy. So Muse picks the best fit from a pool instead of forcing one story, metaphor is welcome, and a spotlight is an opening, never a requirement.
- **Fears without dares.** Asking for a small fear is personal. It only ever becomes comedy for your character, and every question can be skipped.
- **Syncing a TV and phones** on conference Wi-Fi with one authoritative host, and keeping that host alive when it's a phone that locks, sleeps or reloads mid-story.

## Accomplishments

- A complete game night, from QR code to keepsake, that strangers can pick up in thirty seconds.
- A round where every player acts, every plan gets a ruling, and the table has to talk to solve the case.
- Convince the DM: a good argument, spoken or typed, can change the result.
- Narration that holds up next to a human DM, and survives a prompt-injection attempt in character.
- A reveal that turns a funny story into a conversation about something real, and (if shipped) names how each player's real skill saved the day.
- One rating setting that makes the same game right for a family table, a dorm or a group of coworkers (if shipped).
- Our creative director's first hackathon: the thesis, the name, the art direction, the narrator voice and the pitch are theirs. *(CD: edit this line.)*

## What we learned

- **Give people a role, a reason and a script** and they'll talk. The game's job is to make the first sentence easy.
- **Let the model write and let code decide.** Players trust a game with real dice.
- **Constrain the output, not the creativity.** Strict schemas and voice rules let the story run wild.
- **Everyone acts, or the quiet ones disappear.** Voting hid players. Rounds where all plans count fixed that.

> **[CREATIVE DIRECTOR: personal first-hackathon reflection goes here. 3 to 5 sentences in your voice: what surprised you, what you made, what you'd tell the next first-timer. Delete this note before submitting.]**

## What's next

- **Mirror, Mirror** as the closing ritual of every night (if it isn't already shipped).
- **Weekly chapters:** the same crew, a new real story, a shelf of keepsakes.
- **Remote play inside Messenger and WhatsApp video calls**, building on the phone-hosted mode, for long-distance friends.
- **Classroom and workplace packs** for teachers and teams.
- **A spoken narrator** and voice actions.

## Built With

`next.js` · `typescript` · `tailwindcss` · `react` · `vercel` · `supabase-realtime` · `meta-muse-spark` · `meta-muse-image` · `meta-muse-voice-transcribe` · `meta-muse-agent` · `model-context-protocol` · `claude-code` · `serpapi` · `google-news` · `web-audio-api` · `zod` · `gemini` (fallback)

## Why this fits each track

**Meta: Bringing People Closer Together with AI.** The whole product is a machine for getting people to talk. You play yourself (if shipped), so you leave knowing what your friends are weirdly good at. Private clues force conversation, boosts and Catch! reward helping a friend, Convince the DM turns a plan into a debate, and Mirror, Mirror (if shipped) closes the night with a kind sentence. Muse is the DM that makes it possible, and Muse can even start the night.

### How we map to Meta's criteria

Meta scores human connection (30%), how essential and well integrated the AI is (25%), originality (20%), and a working demo (20%).

**Human connection (30%).** Our north star is a game night that gives everyone an excuse to talk to each other. We designed against the real reason people stay quiet: uncertainty, and a crowd's silence. Each player gets a role, a reason (a secret clue only they hold) and a script (a plan to pitch, an argument to make). Everyone acts every round, nobody's idea is voted away, and friends rescue each other. Players bring something real about themselves (if shipped), and the reveal credits each of them by name. Mirror, Mirror (if shipped) works on the liking gap directly, and nobody is ever rated. Remote play (if shipped) means the crew doesn't have to be in one room.

**AI is essential and well integrated (25%).** Remove the AI and there is no game, because there is no DM. Muse Spark turns real answers into powers, picks the real story that fits this crew (if shipped), and writes the scenes, rulings, appeals, story beats, epilogue and keepsake. Muse Image paints heroes and scenes. Muse Voice Transcribe lets players pitch and argue by voice. Through the live MCP connector at `/api/mcp`, Muse can start the night, list tonight's quests, and draft the invite. The server owns the dice, and the narration is engineered not to sound like AI.

**Originality (20%).** A DM that makes friends talk instead of replacing them. Real news turned into modern urban fantasy, where the news gives the problem and the players' real selves are the solution. And a reveal that's proof, not a twist: "This really happened," next to what your group uncovered.

**Working demo (20%).** It's live at https://once-upon-a-roll.vercel.app. A real game from QR code to keepsake runs on Next.js on Vercel, with Supabase Realtime keeping the TV and phones in sync, server-side AI calls under strict schemas, cryptographic dice, cached news, a host that survives a refresh (if shipped), and a fallback chain (Muse, then Gemini, then canned text) so the demo doesn't stall.

**Research grounding.**
- People underestimate how much others like talking with them (Boothby et al. 2018, *Psychological Science*), and mistakenly seek solitude (Epley and Schroeder 2014, *J. Experimental Psychology: General*).
- Shared laughter bonds groups (Dunbar et al. 2012, *Proc. Royal Society B*).
- An AI that supports the group, rather than replacing it, can get humans talking more to each other and more evenly (Traeger et al. 2020, *PNAS*).
- The need is real: the US Surgeon General's 2023 advisory called loneliness an epidemic and linked a lack of connection to mortality risk comparable to smoking up to 15 cigarettes a day.

**Most Entertaining.** A boulder that fell for a reason, a friend whose real-life parallel parking becomes a superpower, an argument made to a DM who might just be persuaded, a hero stuck in a mess their friends have to fix, and a reveal that turns the real headline into the punchline.

**Best Use of SerpApi.** Google News via SerpApi supplies every quest and the real headline behind the reveal, cached and pre-generated so the game never waits on it. Quests are tagged by audience and filtered after the cache, so the Kids, Teens and Adults tables share one set of searches (if shipped).

**Best Pitch.** Three lines: The one group project everyone actually wants to be in. A game night that gives everyone an excuse to talk to each other. Muse is your Dungeon Master.

**Best Novice.** This was our creative director's first hackathon. They owned the thesis, name, art direction, narrator voice and pitch, and shipped them beside a working Next.js, Supabase and Muse app, all written this weekend.

All code was written during HackTX '26.
