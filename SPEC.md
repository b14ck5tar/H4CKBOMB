# Group Project: Build Spec

**One line:** The one group project everyone actually wants to be in. Muse is your Dungeon Master.
**North star:** a game night that gives everyone an excuse to talk to each other.
**Tracks:** Meta (human connection 30%, AI essential 25%, originality 20%, demo 20%), Most Entertaining, SerpApi, Best Novice. See `DEVPOST.md` for the full pitch. This file wins where other docs disagree.

## World and setup
- **Real in, magic out** (`design/18`, being built on `remote-play`): the news gives the problem, the players' real selves are the solution. Modern urban fantasy: ordinary people with a hidden magical side, so players **play themselves**.
- Each quest is a real, harmless headline plus one uncanny explanation. Tone is spooky-funny. No tragedies, victims, violence or divisive politics, at every rating.
- The laptop/TV (`/tv`) is the table and runs the game. Phones (`/play`) are character sheets and controllers. 2-6 players join by QR or 4-letter code.
- **"Who's playing?" rating** (host only, lobby, before Start): Kids / Teens (default) / Adults, rules in `lib/rating.ts`. It sets which quests are allowed (`questAllowed`: a quest's `rating` is the youngest group it suits), the DM tone (`RATING_GUIDE` on every DM prompt), chat filtering (stricter for kids) and concept examples.
- **No-TV / remote mode** (branch `remote-play`): "Start a new game" on `/play` makes that device the host (it runs `GameHost` with `screen: "phones"` and is also a player). Every phone then shows the story itself (`components/Remote.tsx`), the host's phone gets the lobby controls, and a crew chat lets players who aren't in the same room talk. The host's tab must stay open, but it is **refresh-proof**: `GameHost` saves a snapshot to sessionStorage (`lib/snapshot.ts`), so a reloaded TV or host phone resumes the current phase. The TV mode is otherwise unchanged.

## Hero: you, with a hidden magical side
- Joining asks two light questions, each skippable (`Player.real`): "What's something you're weirdly good at?" → the hero's **ability** (metaphor welcome: parallel parking → "slips through any gap in the spirit traffic"). "What's a small thing that scares you?" → the **flaw**, comedy in the fiction only; the game never asks a player to actually do the scary thing. (The third question and side quests were cut; `real.talk` stays "".)
- Skip both and it falls back to the old one-line concept. Muse Spark builds the card (name and look still invented) and Muse Image paints a cartoon portrait (never a realistic person).

## Quests
- 5 seeds in `game/src/data/seed_quests.json` plus up to 10 cached news quests (`/api/news?rating=…`, SerpApi Google News, RSS backup; fetched and filtered once, filtered by rating after the cache). Each quest carries a `rating`. Local-first news (Austin, then wider) is planned, not confirmed.
- **Best-fit pick:** the host can tap "Pick the best story for us". Muse gets 5-10 allowed candidates plus the party's real answers and returns `QuestPick`: one candidate id, a one-line why, and **one spotlight per hero** (a scene where their real skill can matter; an opening, never a requirement). The host can still pick by hand, or preselect by link: `/tv?party=<name>&quest=<id>`.

## Round: Around the Table (everyone acts, no voting)
1. Each phone gets a secret per-player clue, so the table has to talk.
2. Everyone types or hold-to-talks a plan. Muse rules each: Clever (no roll), Solid, Risky, Absurd or Miracle.
3. Convince the DM: one appeal per player, by voice or text, can upgrade the ruling.
4. Boost: tap 🔥 on a friend's plan for a better roll.
5. Everyone rolls (crypto RNG in code; the AI never decides numbers). Then Catch!: spend your one heart to re-roll a friend's fail.
6. A natural 1 leaves a hero in peril, and friends rescue them next scene.
7. One story beat per hero, quoting their own words.
8. Reading screens are Ready-gated: the TV waits for everyone. A quest board shows progress.

## Arc
3 scenes (hook, twist, climax; each opening gives that scene's spotlighted heroes a moment for their skill) plus a Final Roll where everyone makes a final move at once, then **Mirror, Mirror** (each player secretly writes one kind sentence about another player's best moment; guess, then reveal; nobody is rated), then the epilogue, then:
- **The reveal is proof, not a surprise:** "This really happened. Here's the article." ("The official story" next to "What your group uncovered"), plus the hero line **"Solved by Ava's parallel parking and Ben's coffee."** (`GameState.solvedBy`, built in code from real skills and real names; omitted if nobody shared a skill).
- A **keepsake** illustrated story saved on the group's shelf. That shelf ("next chapter, same crew") is the reason to meet again; there are no side quests.

**Testing fit:** `node scripts/test-combos.mjs --n 24 [--seed 7] [--rating kids] [--out combos.md]` runs random parties against a running dev server (`--base`, default `http://localhost:3000`) and flags contract breaks (one Muse call per player plus one quest pick per combo).

## Art and voice
- Art: "Neon Uncanny" comic scenes (only the impossible thing glows magenta/cyan) on a dark late-night broadcast UI; cartoon character portraits.
- Voice: human-DM rules in the prompts (short concrete lines, quote the players, no tidy button endings, banned AI-tell words) plus a server-side scrubber.

## Stack
Next.js 15 + TypeScript + Tailwind on Vercel. Supabase Realtime syncs TV and phones. Muse Spark (JSON schemas), Muse Image, Muse Voice Transcribe via server routes; Gemini then canned text as fallbacks. SerpApi + RSS for news, cached. MCP connector at `/api/mcp` (tools `start_game_night`, `list_todays_tales`, `invite_message`).

## Deadlines (Austin time)
Soft submit Sat 11:30 PM. Feature freeze Sun 10 AM. Final submit Sun 11:30 AM. Judging Sun 2-5 PM. Demo video in `VIDEO_SCRIPT.md`.
