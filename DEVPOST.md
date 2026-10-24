# Once Upon a Roll

**Nobody has to be the Dungeon Master anymore. Every quest is today's real news, told as a fairytale.**

## Inspiration

D&D is one of the best ways friends bond, and it has one bottleneck: somebody has to be the Dungeon Master. Hours of prep, rules lookups, a voice for every goblin. Most groups say "we should play sometime" and never do. Meanwhile we all scroll past the news alone.

"Once Upon a Hack" gave us the frame. A collapsed bridge is a dragon nesting in the rubble. What if the AI took the DM's chair, and every adventure came from something that really happened this week?

## What it does

A laptop or TV becomes the table, and every phone becomes a character sheet and controller. 2 to 6 players scan a QR code and the party is formed in about thirty seconds. No DM, no prep.

**Your hero in one line.** Type "a retired knight who's afraid of geese." Muse Spark builds a stat card (Brave, Clever, Charming at +3, +1, -1; an Ability, a Flaw, a Heart, and a roast from the narrator). Muse Image paints the portrait, which develops on the TV from pencil sketch to full color.

**Pitch, Verdict, Pick, Roll.**
1. **Pitch:** everyone proposes an action at once, typed or spoken, in 20 seconds. Nobody waits for a turn.
2. **Verdict:** the DM rates each pitch as it arrives and stamps it Clever, Solid, Risky, Absurd or Miracle, e.g. `RISKY · DC 18`.
3. **Pick:** the Pitch Wall shows every idea on the TV and the party votes (not for their own).
4. **Roll:** the winner shakes their phone to throw a d20. A natural 1 is a Catastrophe with a Shame Title; a natural 20 is Legendary with a Glory Title. An Absurd pitch that scores 15+ counts as Legendary, so the table votes for the dumb idea on purpose.

**Catch!** When a friend fails a roll, anyone can spend their one Heart to reroll it, and the narration names the rescuer.

**The Rescue Round.** A natural 1 that nobody Catches leaves the hero In Peril ("fell in the river, sharks circling"). The next round becomes a rescue: the other heroes pitch plans, and **the hero in peril picks the winner**, not the party. Success earns the rescuer a Savior title (Shark-Puncher). Failure costs Hope and escalates the comedy.

**Real news, made safe.** Quests come from real Google News headlines via SerpApi. A two-stage tragedy filter rejects deaths, violence, war, disasters with casualties and divisive politics, and keeps only repairable stories: something broke, and a party could fix it. Real people become archetypes. Muse Spark rewrites the headline as a quest with a threat, a goal, locations and three complications drawn from the real details.

**The reveal.** After a streamed epilogue, the last page of the storybook tears away to a stark newsprint clipping: **"This tale was inspired by real events,"** with the real headline, source and a QR link. Players gasp, then laugh.

**Storybook and bookshelf.** Every tale becomes an illustrated storybook saved to the party's bookshelf ("The Cousins, Book 3"). The ending teases "Chapter 2 unlocks next week," so the group has a reason to come back.

## How we built it

**Architecture.** Next.js 15, TypeScript and Tailwind on Vercel. The TV browser at `/tv` runs the game state machine, phones at `/play` send inputs, and they sync over **Supabase Realtime broadcast channels**. All AI calls go through API routes so keys stay on the server.

**All three Muse models, every turn.**
- **Muse Spark (`muse-spark-1.3`)** is the DM brain, always with strict JSON schemas: quest generation, character cards, scene openers, per-pitch verdicts, outcome narration, epilogue, storybook text and the safety classifier. A JSON call measures about 1.9 s.
- **Muse Image (`muse-image-1.0`)** paints portraits (about 14 s), scene plates (about 23 s) and the cover, all from one "Illuminated Storybook" style string.
- **Muse Voice Transcribe (`muse-voice-transcribe-1.0`)** drives push-to-talk pitches. The phone encodes 16 kHz mono WAV, the server forwards it, and the transcript lands in an editable box. We never auto-submit.

**The AI never touches a number.** The server rolls every die with `crypto` RNG, and code computes the DC (15 minus the tier modifier), totals, Hope and outcome bands. The model proposes tiers and prose inside a schema, so it cannot invent its own rules.

**SerpApi.** A scheduled job calls the `google_news` engine for science, tech and good-news queries, keeps the direct publisher link, source, thumbnail and date, and feeds them to the filter. Results are pre-generated and cached as ready quests, so no SerpApi call sits on the critical path of a game. A call counter and saved fixtures protect the free quota. Google News RSS and hand-written seed quests are backups.

**Safety in layers.** Keyword prefilter, then a Muse Spark classifier that rejects casualties, then output lint. On the player side: input sanitizing, in-character redirects, a `moderation` field on every verdict, image prompts built only from sanitized descriptors, and a one-tap "new quest" for the host.

**Feel.** Parchment-and-ink art with gilt accents, and all sound effects synthesized with the Web Audio API (dice, wax seals, page turns, a record scratch for the nat 1).

## Challenges

- **Latency vs. a party.** A portrait takes about 14 s and a scene about 23 s. We hide it with sketch-to-color placeholders, phrase-by-phrase narration, scene plates generated before heroes exist, and a rule that the TV is never idle for more than about 3 seconds.
- **Tragedy filtering.** "Bridge collapse" can be a charming quest or a horrible story. Separating them took a hard-block list, a soft-flag list and a casualty check.
- **Verdicts per pitch** instead of one batch, so rulings land while players are still typing.
- **Syncing TV and phones** on conference Wi-Fi with one authoritative host.

## Accomplishments

- A full game, QR code to keepsake, that strangers can pick up in thirty seconds.
- The Rescue Round: a failure becomes the next round's story, and the hero you let down picks their savior.
- The newsprint reveal, which turns a joke into a conversation about the real world.
- An AI that sets the stakes but never rolls the dice.
- Our creative director's first hackathon: the name, art direction, narrator voice and pitch are theirs. *(CD: edit this line.)*

## What we learned

- Let the model write and let code decide. Players trust a game with real dice.
- Hide the wait inside the performance. A stamp that lands after a pause beats an instant answer.
- Constrain the output, not the creativity. Strict schemas let the prose run wild.

> **[CREATIVE DIRECTOR: personal first-hackathon reflection goes here. 3 to 5 sentences in your voice: what surprised you, what you made, what you'd tell the next first-timer. Delete this note before submitting.]**

## What's next

- **Weekly chapters:** Chapter 2 of your party's saga on next week's news, with the same heroes and bookshelf.
- **Remote play** inside Messenger and WhatsApp video calls.
- **Voice actions and a spoken narrator.**
- **Quest packs and a classroom news-literacy mode.**
- **Full Tale mode** with four scenes.

## Built With

`next.js` · `typescript` · `tailwindcss` · `react` · `vercel` · `supabase-realtime` · `meta-muse-spark` · `meta-muse-image` · `meta-muse-voice-transcribe` · `serpapi` · `google-news` · `web-audio-api` · `zod` · `gemini` (fallback)

## Why this fits each track

**Meta: Bringing People Closer Together with AI.** A social product by design. It removes the biggest barrier to playing together (the DM's prep), and each mechanic makes a human moment: the public Pitch Wall, voting for a friend's idea, Catch! (spending your only Heart to save someone), and the Rescue Round, where the hero you failed chooses who saves them. All three Muse models are on the critical path of every game.

**Most Entertaining.** A foam d20, a record scratch when the die rolls off the table, a crooked CATASTROPHE stamp, a table voting to talk a dragon down with an apology. Every round is built for laughter, and the newsprint reveal is the final punchline.

**Best Use of SerpApi.** Google News via SerpApi is the source of every quest. It supplies the headline, direct publisher link, source and date behind the reveal and its QR code, cached and pre-generated so the game never waits on it.

**Best Pitch.** Three lines: Nobody has to be the DM anymore. Every quest is today's news, told as a fairytale. Game night in thirty seconds, from the couch.

**Best Novice.** This was our creative director's first hackathon. They owned the name, art direction, narrator voice and pitch, and shipped them beside a working Next.js, Supabase and Muse app, all written this weekend.

All code was written during HackTX '26.
