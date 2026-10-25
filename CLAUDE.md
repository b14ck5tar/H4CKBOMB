# Once Upon a Roll: working rules

HackTX '26 project (UT Austin, Oct 24–25 2026, theme "Once Upon a Hack"). A Jackbox-style co-op fairytale D&D night:
the laptop/TV is the table, phones are controllers, Meta's Muse is the Dungeon Master, and every quest is a filtered
real news story with a "this tale was inspired by real events" reveal at the end.

The team is a creative director (first hackathon; makes every creative call) plus a partner. Claude writes the code.
Read `SPEC.md` first (the source of truth), then `design/` for the details behind each decision.

## Deadlines (Austin time)
- Soft submission: Sat 11:30 PM on hacktx26.devpost.com. Final: Sun 11:30 AM. Feature freeze: Sun 10 AM.
- Judging: Sun 2–5 PM (WEL). Meta's track needs a 2–3 min demo video (see `VIDEO_SCRIPT.md`).
- Meta scores: human connection 30%, AI essential and well integrated 25%, originality 20%, working demo 20%.

## Keys (read this before touching anything)
- Keys live ONLY in `.env.local` at the repo root (git-ignored). `.env.example` lists the names.
- Never print, paste, commit or log a key value. Never put a key in chat, Discord, the hub page or a doc.
- `NEXT_PUBLIC_*` values ship to every player's browser: only the Supabase URL and the **publishable** key go there.
  The Supabase **secret** key is never used by this app.
- Before every commit run `bash scripts/leakcheck.sh` (it fails if any key value is staged).
- SerpApi free plan = 250 searches/month. Never call it by hand. The app caches news (`/api/news`, 4 h).
- Muse costs real (small) money. Demo quests use pre-painted scenes in `game/public/quests/` (free).

## Run it
- `npm --prefix game install`, then start the dev server (the preview config is `.claude/launch.json`: port 3000,
  build folder `.next-main`). Parallel test servers must set `NEXT_DIST_DIR` to their own folder, or they clobber
  each other's builds.
- Open `/tv` on the laptop and `/play?code=ABCD` on phones. For several players in one browser, add `&as=1`, `&as=2`.
- Without Supabase keys the rooms fall back to BroadcastChannel (same browser only) and the TV shows "Local mode".

## Architecture
- `game/src/lib/host.ts`: `GameHost`, the authoritative game on the TV (phases, timers, dice, AI calls).
  Phones only send intents (`join`, `concept`, `pitch`, `vote`, `roll`, `catch`, `react`); the TV broadcasts state.
- `game/src/lib/transport.ts` (Supabase broadcast / BroadcastChannel), `usePhone.ts` (phone side, self-resyncing).
- `game/src/server/`: `muse.ts` (Meta Model API), `prompts.ts` (DM prompts + strict JSON schemas),
  `fallbacks.ts` (canned content so a failed AI call never freezes a table), `news/` (SerpApi → filter → quest).
- API routes: `/api/ai` (one route, `task` selects the prompt), `/api/image`, `/api/transcribe`, `/api/news`,
  `/api/mcp` (the Muse connector; see `MUSE_CONNECTOR.md`).
- UI: `components/TV.tsx`, `components/Phone.tsx`, juice in `D20`, `Stamp`, `Effects`, `Reactions`, `lib/sfx.ts`.
- Dice always come from `crypto` RNG in code. The AI never decides numbers; it picks tiers and writes narration.

## Design principles (creative directors' calls, Sat afternoon)
- **People talk to each other, not to the AI.** The AI is the host. Typing is the default input (voice is optional) so a room isn't everyone talking over each other at a machine. Every feature should create a reason to turn to the person next to you.
- The feeling we optimize: **"we laughed so hard"**, plus a little "I learned something about them" and, when they win, "we pulled it off together".
- Nobody ever rates a person. AI judges ideas, never people. Everything the AI does must be explainable to a judge (DM's Notes).
- Heavy/real-world news is a pitched future mode with guardrails, not tonight's build. Tonight: eerie, harmless news.
- Judging demo is ~4 minutes, and judges should feel free to leave and want to come back.

## Meta alignment check (required for every feature, fix and demo decision)
Winning Meta's track is the #1 goal. Before calling anything done, check it against Meta's brief and judges:
- **Human connection (30%)**: does it make people turn to each other, visibly, within a 2-minute demo?
- **AI essential + well integrated (25%)**: is Muse doing real work in the core loop (not decoration)? Is it "a magical experience"?
- **Originality (20%)** and **working demo (20%)**: does the flow "just work really well"? Fewer features, executed well.
- Prefer Meta models where they fit (Muse Spark, Muse Image, Muse Voice Transcribe, the Muse connector); non-Meta only where Meta has no model or a test showed a clear win, and say why.
- Submission: a 2-3 min video (~30 s problem/connection, ~90 s demo, ~30 s AI role, ~30 s tools/harnesses and how they helped the build).
Scorecard and gaps: `design/25-meta-alignment.md`.

## How we work
- Commit after every working step and push to `origin main` (b14ck5tar/H4CKBOMB). End messages with the
  Co-Authored-By line.
- Partner: work on a branch, and stay out of `host.ts`, `TV.tsx`, `Phone.tsx` unless coordinated.
- Use subagents for research and design, and a parallel reviewer agent to read big diffs for bugs.
- Playtest before calling anything done (TV tab + phone tabs, real Muse calls).
- Creative calls (names, art, tone, which features) belong to the creative director: show options, don't decide silently.
- If something is inefficient or there's a better way, say so immediately and plainly.
- The team hub (deadlines, tasks, notes) is https://claude.ai/artifact/Aehk1tVCwhGP9ydNnXxFD3
