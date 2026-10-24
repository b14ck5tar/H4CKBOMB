# 00: Where we are (Sat ~4:35 PM, from a full scan of the session)

## 1. How the idea evolved, and why
- **Goal (12:51):** win Meta's track. Liked "jackbox mixed with fairytale vibes".
- **Cut selfies** ("can make people uncomfortable") for D&D-style character creation. **Cut live Austin data** ("cool but odd").
- **Co-op, not a saboteur** ("u vs the world"). The AI judges whether a plan is feasible. **Real news as fantasy quests** was the creative director's (CD's) own idea.
- **Picked over StoryWeek:** "approved, go with once upon a roll + bookshelf", plus the CD's rescue idea.
- **The CD's thesis:** people are "avoidant due to uncertainty", not afraid. The Liking Gap idea was rejected because rating people "can seriously hurt peoples feelings".
- **2:31 PM playtest:** "too hard to follow", "neither of my answers were selected", "moved to fast", "ai narration is obvious", "make it a lot more interactive". This led to a **full rebuild**: everyone acts, no voting.
- **"I personally dont like fairytale stuff"**, so the world became **urban fantasy** (the partner preferred fairytale; "we agree"). The CD wanted scary real news ("ai takeover, new disease"); it was narrowed to eerie, harmless news.
- **"Losing track of the connectedness... audience might be to narrow"**, so the framing went connection-first. On names: "why r all ur answers so like about suspicion". **"Group Project" is a placeholder.**
- **Art:** "i HATE the people design... we should be characters". The Neon Uncanny scenes are "epic".
- **Dice "probably not needed... convince the dungeon master"**, which became Convince the DM.
- **Meta rep:** judges come to tables; she liked the idea. Sensitive topics need guardrails. "Understand what the ai is doing behind the scenes" led to DM's Notes.
- **Latest:**
  - Clues "seem like an artifact"; they are now tied to each character's quality.
  - **"The mirror thing is the weak link."**
  - Worry that someone "might control the game if they always get the most votes or always put the best answers".

## 2. What the CD wants (R = said more than once)
- **Connection first (R).** Bonding, not just fun.
- **No rating people; no domination by popular or strong players (R, 4 times).**
- **People talk to each other, not to the AI** ("slippery slope"). Typing is the default.
- **Not AI-seeming (R):** narration and names.
- **Phenomenal art (R).** Cartoon heroes, never realistic people. Quick Tale "very well made artistically".
- **Not fairytale.** Modern, bold, colorful.
- **Real-world grounding (R).** It's "OKAY to talk about" real problems, but tonight that is only a future mode with guardrails.
- **Judges free to leave and want to come back (R).**
- **The AI must be explainable.**
- **How the CD wants to work:** options plus a recommended pick (R); agents and fast answers (R); flag better ways fast; push and pull git often (R); never expose keys (R).

## 3. Decided vs open
**Decided:**
- Meta track, co-op, news quests, bookshelf, urban fantasy, the placeholder name, cartoon heroes, Neon Uncanny scenes.
- DM's Notes: "ab and c".
- The 10 questions: 1a (+d, +c); 2b; 3a; 4 "if research says"; 5b; 6b, plus make-your-own; 7b; 8b; 9 at 4 minutes; 10 a and d.
- "yes all all builds".
- All 20 UX fixes and the privacy note.
- Dice auto-roll stays.
- Online mode: c.
- Demo items 1–5; item 6 "dont spend to much time".
- Clues tied to each character's "special quality".

Defaulted but never approved: **Convince the DM**.

**Open:**
1. Replace Mirror with "Yes, and…" and spread Boosts (a / b / c).
2. Partner's doc 17: light, full or skip (asked twice).
3. Final name and .tech domain.
4. Feature-freeze time, and whether the schedule goes on the hub.
5. Whether the Meta presenter's three lines go in the pitch.
6. Whether Best Pitch counts toward the 3-track limit.
7. Partner's role.
8. Whether to apply to the Meta Global AI Developer Hackathon (deadline Oct 25, 11:59 PM ET).

## 4. Build status
- **Live** (once-upon-a-roll.vercel.app, deployed ~3:48 PM):
  - Round: everyone acts, Convince the DM, Boost, Catch!, rescue.
  - Old-style clues, Mirror, reveal, storybook and shelf.
  - 5 seed quests and cartoon portraits.
  - Supabase sync, voice and the MCP connector.
- **Committed, not deployed** (`rebuild-around-the-table`): 3 new quests, pitch deck, docs 13–15. **`origin/main` is behind.**
- **Unmerged branches:**
  - `feat-gpa`: ready-made characters plus "one true thing".
  - `feat-gpb`: shake together plus thank-you.
- **In progress, uncommitted:**
  - DM's Notes, the red-team fixes and the clue change (main folder).
  - Autopilot (`gpa`).
  - Keepsake, attract screen and Judges' Saga (`gpb`).
  - `/watch` (`gpc`).
  - Quick Tale (`gpd`).
- **Queued:** the 20 UX fixes, the privacy note, and a re-run of the failed red-team test.
- **Only proposed:** Real World mode (doc 16), doc 17, weekly chapters, saving the game on TV refresh.
- **Promised, never done:**
  - **Live news in the TV quest list.** The TV reads only `seed_quests.json`; `/api/news` is used only by the MCP connector.
  - "Spotlight" for the quietest player.
  - A draft of the Meta global hackathon application.

## 5. Human logistics
| Item | Status |
|---|---|
| Devpost draft + partner (soft deadline 11:30 PM) | Not done |
| .tech domain | Blocked on name |
| Real playtest, 3–4 strangers on real phones (proposed for 7 PM) | Not done. Only one real 2-player test, on the old round |
| Pitch rehearsal ×3 | None yet |
| Meta video (2:48 script), Sunday morning | No owner |
| Discord: does Best Pitch count toward 3? | Unasked |
| Partner: role, Meta key, $50 credits | Unclear |
| Muse custom connector registration | Never tested in Muse |
| Meta rep's name; sleep plan | Missing |

Sunday: pitching workshop 1 PM, judging 2–5 PM, stage pitch 5:30 PM.

## 6. Risks and blind spots
1. **The build still breaks the red lines.**
   - Boost rewards the favorite friend.
   - "Clever = no roll" lets the most articulate player auto-succeed.
   - Convince the DM means arguing with the AI.
2. **Mirror is live and in every doc, but the CD now calls it weak.** DEVPOST and PITCH_CARD still say "(if shipped)".
3. **Fairytale leftovers judges will see:**
   - The home page `/` still says "Once Upon a Roll... fairytale quest".
   - The `layout.tsx` tab title and description, the URL and the hub all use the old name.
   - `CLAUDE.md` still says "fairytale" and lists a `vote` intent.
   - `MUSE_CONNECTOR.md` is stale.
   - Doc 17 cites Team Up, which was removed.
   - SPEC.md says Mirror is "in progress".
4. **SerpApi claim vs reality.** The quests are curated offline, not pulled live.
5. **Merge risk.** Five parallel copies all edit `host.ts`, `TV.tsx` and `Phone.tsx`, and two of them create `lib/useWatch.ts`. The integrated build is untested.
6. **Scope.**
   - The CD was told to "freeze the concept", then 9+ feature agents launched.
   - Freeze dates conflict: 9 PM Saturday vs Sunday 10 AM.
   - Meta's presenter said "small steps beat big leaps".
7. **Onboarding overload.** Ready-made characters, "one true thing", doc 17's questions and character clues all compete for the first 60 seconds.
8. **Demo length.** The full game is far longer than the judges' roughly 2 minutes of play. Quick Tale must be the default.
9. **Privacy.** Free credits let Meta use content, which clashes with "Kept private to this game". Disclose it.
10. **Fragility.** A TV refresh loses the game; venue wifi is untested.
11. **Partner buy-in.** Their fairytale preference was overruled.
