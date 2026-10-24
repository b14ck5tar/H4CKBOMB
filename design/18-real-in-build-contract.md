# 18 - Real In, Magic Out: build contract

**Status: being built on branch `remote-play`.** This is the agreed version of `17-real-in-magic-out.md` plus a "Who's playing?" rating. Several builders work in parallel; this file is the contract between them. Shared types are already in `game/src/lib/types.ts` (`Rating`, `RealAnswers`, `QuestPick`, `SideQuest`, new `Player.real`, `QuestSeed.rating`, `GameState.rating / questPick / solvedBy / sideQuest`) and the rating rules in `game/src/lib/rating.ts`. Don't rename them; add, don't break.

## Decisions (agreed with the team)
1. **Players play themselves, with a hidden magical side.** Joining asks three light questions, each skippable (at least one answer, or fall back to the old one-line concept):
   - "What's something you're weirdly good at?" → `real.skill` → the hero's **ability** (metaphorical uses are welcome: parallel parking → "slips through any gap in the spirit traffic").
   - "What's a small thing that scares you?" → `real.fear` → the hero's **flaw**, which is **comedy in the fiction only**. The game never asks a player to actually do the scary thing. (Sam's *character* gives the speech; Sam just picks what it says.)
   - "What could you talk about for hours?" → `real.talk` → the **only** basis for the side quest.
2. **Best-fit story, not a forced one.** The host can tap "Pick the best story for us": the AI gets 5-10 safe candidate quests (seed quests + cached news quests, filtered by rating) and the party's real answers, picks the one that fits best, and returns one spotlight per hero (`QuestPick`). The host can still pick by hand.
3. **One spotlight per hero.** Each scene's opening gives the spotlighted hero(es) a moment where their real skill can matter. Never force it; it's an opening, not a requirement.
4. **The reveal is proof, not a surprise.** Copy changes from a twist to "This really happened. Here's the article." Plus the one hero line: **"Solved by Ava's parallel parking and Ben's coffee."** (`GameState.solvedBy`, built in code from `real.skill` and the players' real names; "" if nobody shared a skill.) This line is the pitch's hero moment.
5. **One group side quest, never pairs.** At the end, the AI writes one `SideQuest` for the whole group using only what people actually said in `real.talk` (verbatim in `based_on`). If answers don't overlap, the quest connects them ("everyone brings one thing about their topic to the next game night"). Never invent shared interests. Rating rules in `SIDE_QUEST_GUIDE`.
6. **"Who's playing?" rating** in the lobby (host only, before Start): Kids / Teens (default) / Adults, see `rating.ts`. It controls: which quests are allowed (`questAllowed`), the DM tone (`RATING_GUIDE` appended to every DM prompt), chat filtering (kids: stricter), concept examples, and side quests. Tragedy, victims, violence and divisive politics stay blocked at every rating.

## AI tasks (`POST /api/ai` with `{ task, input }`, response `{ data, fallback }`)
Every task input gains `rating: Rating` (default "teens" if missing). Server-side code must validate it with `isRating`.

| Task | New/changed input | Output |
|---|---|---|
| `character` | `real: RealAnswers` (may be all ""), `concept` (may be "" when `real` is used), `rating` | `Hero` (unchanged shape). Ability from `real.skill`, flaw from `real.fear` (comedy only), name/visual still invented. |
| `pick_quest` (new) | `{ rating, party: [{ hero_id, name, hero_name, skill, fear, talk }], candidates: [{ id, title, premise, threat, goal, locations: string[] }] }` | `QuestPick`. `quest_id` must be one of the candidate ids; `spotlights` covers every hero once, `scene` 0-2, `how` one short line. |
| `scene` | add `rating`, `party_real: [{ hero_id, skill, fear }]`, `spotlight: [{ hero_id, how }]` (heroes spotlighted in this scene, may be empty) | `SceneOpen` (unchanged). The spotlighted hero's clue/suggestions should invite their skill. |
| `verdict`, `round`, `epilogue`, `storybook`, `kind` | add `rating` | unchanged |
| `side_quest` (new) | `{ rating, party: [{ hero_id, name, hero_name, talk }], quest_title }` | `SideQuest` |

Fallbacks (canned, in `server/fallbacks.ts`) are required for `pick_quest` (first candidate, round-robin spotlights) and `side_quest` (a generic group plan that quotes any non-empty `talk` answers verbatim).

## News (`GET /api/news?rating=kids|teens|adults`)
Same response shape `{ quests: QuestSeed[], generatedAt }`, each quest tagged with `rating`. Up to 10 quests. The cache key must not multiply SerpApi calls: fetch and filter once, tag each quest with a rating, and filter by the query param after the cache. Without the param, behave as today (teens and below). Seed quests in `game/src/data/seed_quests.json` get a `rating` too.

## Who owns what (parallel builders)
- **Prompts/AI builder:** `game/src/server/prompts.ts`, `game/src/server/fallbacks.ts`, `game/src/app/api/ai/route.ts`, plus the `character` prompt.
- **News builder:** `game/src/server/news/*`, `game/src/app/api/news/route.ts`, `game/src/data/seed_quests.json` (add `rating`).
- **Client builder:** `game/src/lib/host.ts`, `game/src/components/Phone.tsx`, `TV.tsx`, `Remote.tsx`, `game/src/lib/usePhone.ts`, app pages. Sends the inputs above, shows the rating picker, the three questions, "Pick the best story for us", spotlights, the proof reveal + solvedBy line, and the side quest (TV and phones).
- **Test + docs builder:** `scripts/test-combos.mjs` (20+ random party/story combos against a running dev server, prints picks, spotlights and side quests for a human to judge), `SPEC.md`, `PITCH_CARD.md`, `design/17` status.

Nobody edits `lib/types.ts` or `lib/rating.ts` without saying so in their report.
