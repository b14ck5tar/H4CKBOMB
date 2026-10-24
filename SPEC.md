# Group Project: Build Spec

**One line:** The one group project everyone actually wants to be in. Muse is your Dungeon Master.
**North star:** a game night that gives everyone an excuse to talk to each other.
**Tracks:** Meta (human connection 30%, AI essential 25%, originality 20%, demo 20%), Most Entertaining, SerpApi, Best Novice. See `DEVPOST.md` for the full pitch. This file wins where other docs disagree.

## World and setup
- Modern urban fantasy built from filtered real news: each quest is a real, harmless headline plus one uncanny explanation. Tone is spooky-funny. No tragedies, victims or politics.
- The laptop/TV (`/tv`) is the table and runs the game. Phones (`/play`) are character sheets and controllers. 2-6 players join by QR or 4-letter code.
- Hero: a one-line concept, then Muse Spark builds a card and Muse Image paints a cartoon portrait (never a realistic person).
- Quests: 5 seeds in `game/src/data/seed_quests.json` plus cached news quests (SerpApi Google News, RSS backup). A quest can be preselected by link: `/tv?party=<name>&quest=<id>`.

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
3 scenes (hook, twist, climax) plus a Final Roll where everyone makes a final move at once, then epilogue, then the **reveal** ("The official story" next to "What your group uncovered"), then a **keepsake** illustrated story saved on the group's shelf. **Mirror, Mirror** (in progress): each player secretly writes one kind sentence about another player's best moment; guess, then reveal. No ratings.

## Art and voice
- Art: "Neon Uncanny" comic scenes (only the impossible thing glows magenta/cyan) on a dark late-night broadcast UI; cartoon character portraits.
- Voice: human-DM rules in the prompts (short concrete lines, quote the players, no tidy button endings, banned AI-tell words) plus a server-side scrubber.

## Stack
Next.js 15 + TypeScript + Tailwind on Vercel. Supabase Realtime syncs TV and phones. Muse Spark (JSON schemas), Muse Image, Muse Voice Transcribe via server routes; Gemini then canned text as fallbacks. SerpApi + RSS for news, cached. MCP connector at `/api/mcp` (tools `start_game_night`, `list_todays_tales`, `invite_message`).

## Deadlines (Austin time)
Soft submit Sat 11:30 PM. Feature freeze Sun 10 AM. Final submit Sun 11:30 AM. Judging Sun 2-5 PM. Demo video in `VIDEO_SCRIPT.md`.
