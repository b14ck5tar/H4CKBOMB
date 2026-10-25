# 25: Meta track alignment audit (Sat Oct 24, ~9:15 PM)

Goal: a top-3 finish in Meta's "Bringing people closer together with AI".
Sources: the Meta track brief, the opening ceremony deck, the Meta judge's own words (design/22), DECISIONS.md
(latest = Sat ~8 PM core loop), design/24, design/23, DEVPOST.md, and the code on `rebuild-around-the-table`.

**The judge's three lenses (design/22):** (1) the flow works really well, not feature count; (2) the AI feels like "a
magical experience" and is essential, not an afterthought; (3) how the team used AI to build it, and whether we
learned what it's good and bad at.

## Summary

| Criterion | Weight | Today (est.) | After P0+P1 (est.) | One-line verdict |
|---|---|---|---|---|
| Human connection | 30 | 21 | 25 | The turn loop is built around helping a friend. Judges need to *see* it in the first 2 minutes, and "Our stories" (our best connection beat) is not in the demo. |
| AI essential + integrated | 25 | 18 | 21 | Muse is in every core spot. But the word "Muse" never appears on the TV or phones, and DM's Notes still lists cut features. |
| Originality | 20 | 15 | 16 | Real odd news or your own true story, retold, then "this really happened". Plus a Muse connector. Clear and memorable. |
| Technical execution / working demo | 20 | 12 | 16 | The new build is solid locally, but **the public site still runs the old build** from `main`. |
| **Total** | 100 | **~66** | **~78** | Top-3 range needs the P0s done and one clean, rehearsed 4-minute run. |

Submission: the video script is rewritten for this build (VIDEO_SCRIPT.md). DEVPOST.md has stale and wrong lines (below).

---

## 1. Human connection (30%)

**What we have**
- **Turns where friends help** (design/24, `lib/host.ts` turn engine, `components/Phone.tsx` SuggestForm/PitchForm):
  on your turn, everyone else sends a suggestion; you pick yours or a friend's.
- **Credit for using a friend's idea:** +1 to the roll and the TV shows "+ Sam's idea · +1" (`components/QuickTV.tsx` ~L580, ~L619).
- **Grand finale:** everyone proposes, everyone votes but not for their own, and one shared die is rolled by shaking
  phones together (`host.ts` final stage "shake").
- **Join question** "What are you weirdly good at?" becomes the hero's power, stays private, and comes back at the
  reveal in the "Solved by…" / "Starring…" line (`host.ts` `onReal` / `applyReal`).
- **Our stories** (`host.ts` `startStoryWrite`, `Phone.tsx` ~L276): each player privately writes a small true story and
  how it really ended; the table votes; the end shows "This really happened to Ava" (`QuickTV.tsx` ~L820). This is the
  "I learned something about them" beat, and it answers the Meta rep's own suggestion (design/22, 5:36).
- **Typing is the default**, so people talk to each other, not at a mic. Nobody rates a person; the AI judges actions.
- **Keepsake** link + QR to take the story home (`app/tale`, `lib/keepsake.ts`).

**What a judge sees in a 3-4 minute demo:** QR join, one-line heroes, the story vote, a turn where a friend's
suggestion gets picked with "+ name's idea", a roll with "Needs 12+", the shake-together finale, the reveal.

**Mechanic → connection, visible within 2 minutes?**

| Mechanic | Why it brings people closer | Visible by 2:00 in Quick Tale? |
|---|---|---|
| Friends suggest, owner picks | Every turn is a reason to turn to the person next to you | Yes, the first turn (~1:00) |
| "+ Sam's idea · +1" | Helping a friend is the best move; credit is public | Yes, if the owner picks a friend's idea. **Coach it.** |
| "Needs 12+" then a d20 | The room cheers for the same number | Yes |
| Shared shake die (finale) | A physical, all-together moment | Around 3:00 |
| "Solved by / Starring" with your real knack | "I didn't know you were good at that" | Reveal, ~3:30 |
| Our stories reveal | You learn a real thing that happened to a friend | **Not in the current demo plan** |

**Gaps**
1. The strongest connection beat (Our stories) isn't in the judge demo or the old video plan.
2. The "+ name's idea" moment depends on the owner picking a friend's idea. If judges each type their own, the
   connection point is invisible.
3. No spoken line tells the judge *why* the loop brings people closer; the pitch card still talks about secret clues,
   Catch! and Boost, which are cut.

**Fixes**
- **P0 (0 min, pitch):** coach the moment. CD on the first turn: "Your friends are sending you ideas. Pick one of
  theirs and you get +1, and their name goes on screen." Rewritten in PITCH_CARD.md.
- **P1 (20 min, team):** prepare an "Our stories" demo path: a team member's true story pre-typed on one phone, so a
  judge table can pick it. Use it in the video (Part 2) even if the live demo stays on odd news.
- **P2 (CD call):** a one-line "Ask them about it" prompt on the reveal for Our stories (e.g. "Ava, what happened
  next?"). It stays inside the game, so it respects "no real-life stuff outside the game".

## 2. AI essential and well integrated (25%)

**Is Muse essential in the core loop? Yes.** Without it there is no story, no ruling, no art and no narrator cast.

| Job | Model | Where |
|---|---|---|
| Odd-news safety + oddness filter | muse-spark-1.3 (low) | `server/news/candidates.ts` (one call per 4 h refresh) |
| Story opener from the article or a player's true story | muse-spark-1.3 (high) + reading-grade checks | `server/stories/opener.ts`, `/api/story/opener` |
| Hero card from a one-line description | muse-spark-1.3 | `/api/ai` task `character` |
| Literal judging, tier + "Needs N+" | muse-spark-1.3 (minimal, v2 rubric, 8/8 in bake-off) | `/api/ai` task `verdict` |
| Outcome narration + next situation (branching) | muse-spark-1.3 | `/api/ai` task `outcome` |
| Narrator casting (voice + style per story mood) | muse-spark-1.3 | `/api/ai` task `cast`, `lib/voices.ts` |
| Epilogue, keepsake | muse-spark-1.3 | `/api/ai` tasks `epilogue`, `storybook` |
| Hero portraits | muse-image-1.0 | `/api/image` |
| Heroes painted into each new scene per decision | muse-image-1.0 `/images/edits` | `server/art/sceneArt.ts`, `/api/scene-art` |
| Voice input (optional) | muse-voice-transcribe-1.0 | `/api/transcribe`, `components/MicButton.tsx` |
| Narration audio | **OpenAI gpt-4o-mini-tts**, then Gemini TTS, then text only | `server/tts.ts`, `/api/tts` |
| Starting a night from Muse, the agent | MCP connector | `app/api/mcp/route.ts`, MUSE_CONNECTOR.md |

- **Voice input is still reachable:** the mic button is on the turn owner's plan form and the finale form
  (`Phone.tsx` PitchForm ~L527). It is not on friends' suggestion form. That fits "typing is the default".
- **Code decides numbers:** dice are crypto RNG, stats are an equal budget in code, the AI only picks a tier.
- **The connector now works with the current data** (fixed tonight): `list_todays_tales` returns live odd news
  from `/api/news` plus the curated seeds as a fallback; `start_game_night` returns a working `/tv` link (party name,
  `mode=quick`, pinned seed) and an invite. Tested locally with JSON-RPC and in a browser (MUSE_CONNECTOR.md, bottom).

**What a judge sees:** a new painting per decision with their own hero in it, a narrator voice that fits the story,
a ruling that reads their exact words, and DM's Notes (press N) showing every call.

**Gaps**
1. **"Muse" appears nowhere on the TV or phone screens.** A grep of `components/` finds it only in one DM's Notes
   line ("muse-image edits"). A judge watching the game can't tell which AI is the DM.
2. **DM's Notes lists cut features** (`components/DMNotes.tsx` RULES: "Mirror sentences are kind-only", "Hope are
   plain math"). A judge who opens it sees rules for things that don't exist.
3. The narrator, the most "magical" moment, is the one non-Meta model. That's fine (Meta has no TTS, design/23), but
   it must be said plainly, and DEVPOST still says Gemini.
4. The connector is only on the old deploy until the merge (see Technical).

**Fixes**
- **P1 (15 min, builder, `components/`):** a small credit line in the TV lobby and on the narration caption:
  "Your Dungeon Master: Muse" / "Written by Muse · read by Ash". Add model chips to DM's Notes entries
  (Spark / Image / Transcribe / TTS).
- **P1 (5 min, builder, `DMNotes.tsx`):** replace the Mirror and Hope rules with the current ones: "One action per
  turn, judged at face value", "+1 when you use a friend's idea", "The real story is revealed at the end".
- **P1 (10 min, docs):** DEVPOST: "OpenAI gpt-4o-mini-tts narrates (Meta has no text-to-speech model); Gemini TTS is
  the backup." Decide whether to keep the MLH Gemini track claim (CD call: Gemini is now only the fallback).
- **P2 (30 min):** record the Muse-connector clip for the video (needs the deploy).

## 3. Originality (20%)

**What we have:** party games with an AI host exist (Jackbox-style). What's new:
- Every story is something that **really happened**: odd, harmless news from around the world this week, or a
  player's own true story. The end flips it: "This really happened" + the article, or the author's real ending, plus
  "what's happening now" from the source (`QuickTV.tsx` ~L820-847).
- The AI paints **your** heroes into each new scene as the story branches.
- The narrator is **cast per story** (five voices, `lib/voices.ts`).
- Muse, the agent, can start the night through our connector.

**Gap:** the hook line in the old pitch ("real news, one uncanny explanation") undersells Our stories and the reveal.
**Fix (P0, done in PITCH_CARD/VIDEO_SCRIPT):** "Every story really happened, to the world or to one of you. You find
out how it really ended at the end."

## 4. Technical execution / working demo (20%)

**What we have:** TV-authoritative host (`lib/host.ts`), Supabase broadcast with a BroadcastChannel fallback,
self-resyncing phones, a canned fallback for every AI call (`server/fallbacks.ts`), "never wait" art (outcome shows
over the previous painting, crossfade when ready), pause on Wi-Fi drop (latest QA P0), cached news, keepsake by URL hash.

**Gaps (ranked)**
1. **P0: the public site runs the old build.** `https://groupproject-game.vercel.app/api/mcp` answers with the old
   tool descriptions; `origin/main` is at 807e196, behind this branch. DEVPOST "Try it" points there.
2. **P0: Quick Tale is ~5 minutes; the judging slot is ~4 minutes** including the pitch. One full rehearsal with a
   stopwatch, with three people on phones, before feature freeze.
3. **P1: Vercel env must have the narrator key** (OpenAI) and `MODEL_API_KEY`; otherwise the narrator silently falls
   back to text. Check by ear on the deployed site.
4. **P1: PITCH_CARD fallback claim was false:** it said "Muse, then Gemini, then canned text". Text AI falls back to
   canned content only (`/api/ai/route.ts`). Fixed in PITCH_CARD.md.
5. **P2:** odd-news ids can't be pinned by link (the opener is written during the vote). Fine; the connector says so.

**Fixes:** merge `rebuild-around-the-table` → `main` after the builder's current pass and a reviewer read; redeploy;
run the connector curl checks against the live URL; record a backup video of a clean run.

## 5. Submission requirements

| Requirement | Status | Fix |
|---|---|---|
| 2-3 min video, 30/90/30/30 | Old script described cut features | **Rewritten** (VIDEO_SCRIPT.md, 2:58) |
| Part 4: tools, harnesses, models, how they helped | Story exists in DEVPOST | In the script: Claude Code + agents, DM stress test, bake-off, frame-by-frame playtest analysis, pivots |
| Devpost text | Stale: "in progress" markers, Gemini as narrator, Built-with lacks OpenAI | P1, 15 min (partner) |
| Working link | Old build | P0 merge + deploy |
| Track list | Includes MLH Gemini on the strength of Gemini TTS | CD call (Gemini is now the fallback) |

## 6. Red flags

1. **Old build in production** (P0, above).
2. **Wrong model claims in docs:** DEVPOST says Gemini narrates; the code uses OpenAI first. SPEC.md and the
   `FEATURES.voice` comment say Gemini too. Fix the words, not the code.
3. **Privacy promise vs Meta's free credits.** DECISIONS (judge demo) says the privacy note must be honest that Muse
   processes the text. No such note is in the current UI. "Our stories" asks for real personal stories, which go to
   Muse (and the outcome text to OpenAI for audio). The `-contributor` guard in `server/muse.ts` is good, but the
   team's own reading is that free-credit traffic may be used by Meta. **P1 (10 min, builder):** one line on the Our
   stories form: "Your story goes to Meta's Muse to write the game. Keep it to things you'd tell this table." Verify
   the credit terms before claiming anything stronger.
4. **Cut features still in pitch materials** (secret clues, Convince the DM, Boost, Catch!, Mirror). Saying any of
   these to a judge contradicts what they see. PITCH_CARD.md is rewritten.
5. **Non-Meta model in a core spot:** only TTS, and only because Meta has none. Say it, don't hide it. The Meta rep
   explicitly encouraged picking the best model per job (design/22, 3:12), so this is a strength if framed as taste.

## Ranked fix list

| # | Priority | Fix | Owner | Effort |
|---|---|---|---|---|
| 1 | P0 | Merge to `main`, redeploy, check `/tv`, `/play`, narrator audio and `/api/mcp` on the live URL | Claude + partner | 30 min |
| 2 | P0 | Stopwatch rehearsal of the 4-minute demo with the new PITCH_CARD script; cut talk, not play | CD + partner | 20 min |
| 3 | P1 | Show "Muse" on screen (lobby credit, narration caption, model chips in DM's Notes) | builder | 15 min |
| 4 | P1 | Clean DM's Notes rules (remove Mirror/Hope; add the current rules) | builder | 5 min |
| 5 | P1 | Privacy line on the Our stories form | builder | 10 min |
| 6 | P1 | "Our stories" demo path + film it for the video | CD + partner | 20 min |
| 7 | P1 | DEVPOST corrections (TTS, in-progress markers, Built with, Gemini track call) | partner | 15 min |
| 8 | P2 | Record the Muse connector clip after deploy | partner | 15 min |
| 9 | P2 | "Ask them about it" line on the Our stories reveal | CD call, builder | 10 min |
