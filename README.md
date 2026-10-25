# Group Project

**The one group project where everyone actually shows up.**

A co-op party game for friends in one room. A laptop or TV is the table, phones are the controllers, and Meta's Muse
is the Dungeon Master. Every story starts from something that really happened (odd news, or a player's own true
story); the players steer it, and the ending shows what you did next to what really happened.

Built at **HackTX '26, Oct 24-25 2026** (UT Austin), for Meta's track "Bringing People Closer Together with AI".

- Play: https://groupproject-game.vercel.app/tv (TV) and https://groupproject-game.vercel.app/play (phones)
- A short tested game (~5 min): https://groupproject-game.vercel.app/tv?judge=1

## How it plays

1. Scan the QR on the TV. Type your character's name, describe your hero in one line, and answer "What's your secret
   strength?" (or grab a ready-made hero).
2. Pick tonight's story: odd news, or "Our stories".
3. On your turn the TV says "{name}, tell the table your plan"; everyone else sends you an idea from their phone.
   Use a friend's idea for +1. Muse judges the plan at face value; you swipe to throw a d20 (rolled in code).
4. Muse writes what really follows from your plan, paints your heroes into a new scene, and a narrator reads it.
5. Finale: everyone writes a plan, talks it out ("Convince each other"), backs one that isn't theirs, and the table
   shakes their phones for one shared die.
6. The ending: "What you did", then "What really happened".

## Run it locally

Requires Node 20+.

```bash
npm --prefix game install
```

Copy `.env.example` to `.env.local` at the repo root and fill in your own keys (never commit it). Then:

```bash
npm --prefix game run dev
```

Open `http://localhost:3000/tv` on a laptop and `http://localhost:3000/play?code=ABCD` on phones (or `&as=1`, `&as=2`
for several players in one browser). Without Supabase keys, rooms fall back to BroadcastChannel (same browser only).

## What we built vs what we used

**Our original work (written during the event):**
- The game: the authoritative TV host (`game/src/lib/host.ts`), the phone and TV UI (`game/src/components/`), the
  room transport, turn engine, timers, dice and grading (`lib/rules.ts`, `lib/grade.ts`).
- The procedural story engine: story state, literal-plan rules, code checks on every AI change, 3 acts, the
  player-led ending (`lib/procedural.ts`, `server/prompts.ts`, `server/stories/`).
- The odd-news pipeline and its AI storyability and safety gate (`server/news/`).
- The scene-art pipeline that paints the players' heroes into each scene (`server/art/`).
- The music and UI sounds, generated in code with the Web Audio API (`lib/sound/`).
- The Muse connector (MCP server, `app/api/mcp/`), test harnesses and scripts (`scripts/`).
- Art direction ("Neon Ink"), the ready-made heroes and scenes (generated with Muse Image from our prompts).

**Open-source libraries:** Next.js, React, Tailwind CSS, `@supabase/supabase-js`, zod, qrcode, the `openai` and
`@google/genai` SDKs, server-only (see `game/package.json`).

**APIs and services:** Meta Muse (muse-spark-1.3, muse-image-1.0, muse-voice-transcribe-1.0), ElevenLabs (the
narrator's voice, and our sound-effect library, generated ahead of time), OpenAI TTS and Gemini TTS (backup voices),
SerpApi Google News, Supabase Realtime, Vercel hosting, Google Fonts.

**AI-assisted development:** Claude Code (Anthropic) was our lead engineer; the creative director made every
creative call.

## Privacy

No accounts and no player database. Players enter a **character name, not their real name**. What players type is
sent to Meta's Muse to run the game, and the phone says so. The server caches the generated art and audio. Keys live
only in `.env.local` (git-ignored); `scripts/leakcheck.sh` runs before every commit.

## Team

The creative director (first hackathon) and their partner. Built with Claude Code.
