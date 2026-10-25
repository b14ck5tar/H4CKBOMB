# 36: Legacy audit, a cut list (Sun ~5 AM)

This is a cold read of `game/src` and `game/public` against the current design only: design/35 (procedural rules plus the CD refinements), design/34, design/24's turn loop, and the bottom of DECISIONS.md. Everything else was treated as suspect. **Read-only: no game code was changed.**
- Baseline: HEAD `1968fca` (procedural engine wired into host.ts).
- Uncommitted work in progress (another builder): prompts.ts, lib/procedural.ts, server/stories/procedural.ts, opener.ts, rules.ts, story_library.json. Line numbers for those files come from that working tree and will drift.

## 1. Summary
1. **About 40% of the shipped game code is dead or legacy.** That is roughly 2.5k lines of server TypeScript, ~1.1k lines of TV components, ~1k lines in host.ts, ~500 lines of dead CSS, 99 KB of JSON and ~7 MB of public files that are deployed but never used.
2. **The engine swap landed in `1968fca`.** host.ts now calls `turn`/`story_end`. The old `outcome`/`epilogue`/`outcome_branches` path, its prompts and its canned fallbacks are now dead, but every piece of it is still in the tree.
3. **Biggest risk: the new turn prompt still inherits legacy text.** It is built on `DM_CORE`, which says "Once Upon a Roll" and "Hope". Its few-shot examples print `ladder.next` and teach "every turn must move to a new situation". This is the one cut that changes what players see.
4. **Biggest dead weight:**
   - Mirror, Mirror (host + TV + prompt + route).
   - Catch/rescue/saves/thank-yous.
   - The story-bible/tailor pipeline (bible.ts, stored.ts, models.ts, story_bibles.json).
   - The old news pipeline (pipeline.ts, transform.ts, most of filter.ts and sources.ts).
5. **About 480 of QuickTV.tsx's 1574 lines are old screens that never mount**, because tvskin replaced them. One catch: the only "Play another" button lives in the dead `Keepsake` screen.
6. **Judge-facing copy is stale:**
   - DM's Notes still says "Needs N+" and shows a "Clues" row and "0/0 arguments changed a ruling".
   - The phone reveal says "This really happened".
   - The throw screen says "Your plan won" on every turn.
7. **The danger meter is a leftover with a hidden rule.** design/35 never mentions it. It is still shown every turn, and when full it quietly gives the finale roll a −3. That is a CD call.
8. **The opener still builds a 3-4 step ladder** and retries drafts until the ladder matches the real story's steps. Only `beats[0]` is used, so the retries are slow for nothing.
9. **Publicly deployed dev pages** carry old copy ("Needs 12+", Catch, Mirror, old heroes): meta.html, devpost.html, options.html, how-it-works.html and story-lab.html. The team hub is still titled "Once Upon a Roll HQ".
10. Every cut is a deletion, not a rewrite, except **two prompt edits and five copy strings**. Those are the items to do before 9:30 AM.

## 2. Cut list
Owner key:
- **B**: the main build session. It owns host.ts, prompts.ts, components and CSS (CLAUDE.md: the partner stays out of host/TV/Phone).
- **any**: low-traffic files anyone can take.
- **CD**: the creative director decides first.

Risk is the risk of removing the item.

### P0: changes what players and judges see (do before 9:30)
| # | item | file:line | why it's legacy | risk | owner |
|---|---|---|---|---|---|
| 1 | "Once Upon a Roll" and "Hope" in DM_CORE, the prefix of every prompt including `turn` and `story_end` | server/prompts.ts:9, :34 | Old name; Hope is off | low | B |
| 2 | Few-shot turns print `ladder.next` (each Right now is the next ladder rung), and they are pasted into the live turn prompt | server/story-examples.ts:636 (data at :41-42, :194 and every `ladder_next`); used by server/stories/procedural.ts:65 | design/35: no fixed ladder beats | low | B |
| 3 | Bad example "Every turn must move to a new situation." | server/story-examples.ts:429 | CD rule 3 softened ("never invent change just to fill a turn"); clashes with procedural.ts:49 in the same prompt | low | B |
| 4 | DM's Notes rule "Needs N+" | components/DMNotes.tsx:14 | No success threshold since Sun 12:30 AM; judges read this panel | low | B |
| 5 | DM's Notes "Clues" row, and "{n}/{m} arguments changed a ruling" | components/DMNotes.tsx:187-201, :208 | Clues and Convince the DM are cut; judges always see "none" and "0/0" | low | B |
| 6 | "This really happened" | components/phone/RevealScreen.tsx:35 | The reveal is "Based on a true story" | low | B |
| 7 | "Inspired by real events" on the keepsake page | app/tale/page.tsx:104 | Same | low | B |
| 8 | "Your plan won" on every throw | components/phone/ThrowScreen.tsx:59 | Vote-era copy; only the finale has a vote | low | B |
| 9 | "· had a turn" on a finale plan you can't back; the TV says "Hung back" | components/phone/FinaleScreens.tsx:141 vs tvskin/Finale.tsx:191 | Old spotlight rule; the real reason is that no plan was sent | low | B |
| 10 | Danger meter: the bar on the TV every turn, plus a hidden −3 on the finale when full | QuickTV.tsx:865, tvskin/Hud.tsx:76-97; lib/host.ts:117, :2411, :2531-2534 | Not in design/35/34/24. It was approved at 1 AM, before design/35 replaced the ladder with progress and acts. A hidden penalty stacked on the grade | med | **CD** |
| 11 | Ending note "Below the target fails; reaching it works with a cost; 3 over works cleanly." | lib/host.ts:2753 | The old DC rule, shown in DM's Notes | low | B |
| 12 | Autopilot note "Their hero plays its own suggestions and rolls itself" | lib/host.ts:674 | design/24: absent players are skipped (startTurn already skips them) | low | B |
| 13 | "Play another" (`host.nextTale()`) and "How the AI decided ▸" exist only in the dead `Keepsake` screen | components/QuickTV.tsx:1276-1353 | After the ending montage the TV has no Play-another button except a presenter hotkey. **Move these two buttons into EndingMontage before deleting Keepsake** | med | B |

### P1: dead code in files being edited right now (delete at the next quiet moment, or right after freeze)
| # | item | file:line | why it's legacy | risk | owner |
|---|---|---|---|---|---|
| 14 | Mirror, Mirror: constants, `mirrorFrame`, `kindFallback`, `assignWards`, `endingSteps.mirror`, `startMirror`…`stepMirror`, `onMirrorWrite`/`Guess`, `onThanks`, mirrorP/mirrorFate, wards/mirror state | lib/host.ts:99-101, :284-299, :440-445, :1464, :1512-1520, :2778-2942 | Cut for good (DECISIONS Sat 8 PM); `FEATURES.mirror` is false | low | B |
| 15 | Mirror TV screens, TopBar, Crew + "STUCK" chip, Footer, Hope hearts | components/TV.tsx:47-149, :162-259, :426-453 | Mirror/Hope/peril are gone; TV.tsx is only a router to Lobby/QuickTV now | low | B |
| 16 | Catch/rescue/saves: `thankYouLines`, `SUCCESS_BANDS`, `recordSaves` (never called), `onThankSave`, `thankYous`, `ThankHearts` (mounted, can't fire) | lib/host.ts:74-83, :300, :2946-2980; components/TV.tsx:262-319, QuickTV.tsx:1568 | Catch is cut for good | low | B |
| 17 | Old `outcome` engine leftovers: `FALLBACK_OUTCOME` (unused, says "still right there"/"isn't solved yet"), stale doc comment on the branching writer | lib/host.ts:359-365, :2470-2472 | Replaced by `turn` + `localTurn` | low | B |
| 18 | Old outcome/epilogue/branches on the server: `OUTCOME_BASE`, `outcomeSystem`, `OUTCOME_SYSTEM`, `OUTCOME_SCHEMA`, `EPILOGUE_*`; route `outcome`, `outcome_branches`, `epilogue`, `BRANCH_ROLLS`, `GRADE_MEANING`, `STORY_CALLS.branch` | server/prompts.ts:229-313, :356-381; app/api/ai/route.ts:44-66, :123-145, :166 | No caller since `1968fca` except scripts/story-evals.mjs | low | B |
| 19 | Unused prompts and tasks: `SCENE_SYSTEM` (clues, suggestions, rescue, truth_hint), `ROUND_SYSTEM` (caught_by, boosted, peril, "Natural 1"), `KIND_SYSTEM`; route `scene`, `round`, `kind`, `story_state`, `story_bible`, `tailor`, `fallbackTailor`, `truth_hint` wrapping | server/prompts.ts:115-150, :316-354, :385-403; route.ts:67 (TASKS) plus their cases | No caller in the game | low | B |
| 20 | Server canned fallbacks: `fallbackOutcome` ("still right there", "isn't solved yet"), `FALLBACK_EPILOGUE` ("The die lands…"), `fallbackClue`, `fallbackScene`, `fallbackVerdict`, `fallbackRound`/`BEAT`, `fallbackKind`; "Weirdly Good At It" in `fallbackHero` | server/fallbacks.ts:21, :38-148 | Banned lines; plan-blind; old join wording. Keep `fallbackHero` (reworded), `fallbackRuling` and `fallbackStorybook` | low | B |
| 21 | host's own old ending fallback (`FALLBACK_ENDING`/`FALLBACK_LINE`, "The die lands") | lib/host.ts:366-375, :2663 | The route's `story_end` fallback is already plan-aware; this one names no plan and uses a game word | low | B |
| 22 | Dead QuickTV screens: GoalBar, ColdOpen (`false ?`), Turn/TypingLine/Planning, Vote, Ruling, RollMath, Outcome, EndingSlot, RevealCard, Keepsake (after #13), the dead count/shake branch of Final, `StoryStage`, imports only they use (`TIER_DC`, `QRCode`, `firstAction`, `isFailure`, `BAND_LABEL`, `TypeReveal`, `Stamp`) | components/QuickTV.tsx:254-291, :383-429, :533-735, :1067-1098, :1113-1125, :1158-1166, :1172-1353, :1574 | Replaced by tvskin (`3039480`); never mounted | low | B |
| 23 | Hope/ladder/danger leftovers in rules and grade: `TIER_MOD`, `TIER_DC`, `judge`, `autoSucceeds`, `band`, `ending`, `APPEAL_MS`, `CATCH_MS`, `PITCH_MS`, `HOPE_*`; `ladderDelta`, `nextStep`, `isMiss`, `finalTotal`; header "the ladder always advances one act per turn" | lib/rules.ts:4-38, :80-98, :119, :128-134; lib/grade.ts:5, :31, :56, :72-80 | Pass/fail threshold, Hope, ladder. Unused or imported but unused (host.ts:11-13, :22, :28) | low | B |
| 24 | State fields with no live writer or reader: `hope`, `hopeMax`, `ladder`, `step`, `clues`, `clueBecause`, `rescue`, `catchers`, `boosts`, `saves`, `beatIndex`, `round`, `question`, `lastTime`, `banner`, `suggestions`, `wards`, `mirror*`, `thanks`; Player `abilityAvailable`, `heart`, `peril`, `titles`; RollResult `need`, `advantage`, `rescuerId`, `noRoll`, `boosted` | lib/types.ts (GameState ~:303-385, Player :30-46, RollResult :78-96, NoteKind :227-241) | Each one rides in every state broadcast | med (touches phone and TV props) | B, after freeze |
| 25 | "One true thing" (`truth`) and the fear half of the join answers (`onTruth`, `truthScene`, fear → flaw in `applyReal`, CHARACTER_SYSTEM fear rules) | lib/host.ts:1145, :1245-1254, :1299-1325; server/prompts.ts:81-87 | The join has one question (secret talent); phones always send `fear: ""` and never send `truth` | med | B |
| 26 | Stored shelf (`loadShelf`, `saveToShelf`, "ouar-shelf") | lib/host.ts:85-96, :350-356, :3056-3079 | Writes localStorage that nothing reads | low | B |
| 27 | Pluggable ending API with no callers (`registerEnding`, `setEndingPlan`) | lib/host.ts:1136-1142 | Built for Mirror | low | B |
| 28 | Old prompt bits: CHARACTER "usable once per tale", ROAST "-1 stat" (stats are 0/1/2); STORYBOOK "CASE FILE WRITER" + `thank_yous`; BOT example "throw my sandwich at it lol" (bots.ts:276 strips "lol" when humans play) | server/prompts.ts:75, :77, :87, :407-411, :433 | Old ability rule, Catch, "no lol" | low | B |
| 29 | Opener's 3-4 step ladder and its checks ("beats must be 3 or 4 steps", "beats must mirror real_arc one to one"); "wait, that really happened?" | server/stories/opener.ts:35-36, :105, :140-142, :180, :442-449; examples at story-examples.ts:115, :524-560 | Only `beats[0]` is used (the first Right now); the retries cost seconds per opener | med | B |

### P2: no one is editing these; any time, any order
| # | item | file:line | why it's legacy | risk | owner |
|---|---|---|---|---|---|
| 30 | Story-bible/tailor pipeline: bible.ts, stored.ts, models.ts (includes a gpt-4.1 engine), lib/beat.ts, data/story_bibles.json (92 KB) | server/stories/bible.ts:1-485, stored.ts, models.ts; data/story_bibles.json | design/35 replaces the bible and the pre-written branches. Only scripts use it. **First repoint scripts/procedural-test.mjs:19 to story_library.json** (it reads its test openers from story_bibles.json) | med | any |
| 31 | Old news pipeline: pipeline.ts, transform.ts ("Case Writer for Once Upon a Roll", fairytale_premise), filter.ts Stage A/B + classifier, sources.ts RSS and named queries | server/news/pipeline.ts, transform.ts, filter.ts:29-60, :69-238, sources.ts:24-26, :93-157, :199-212 | No importers; replaced by candidates.ts + library.ts. **Keep** `HARD_BLOCK`, `SOURCE_DENYLIST`, `softMatch`, `fetchSerpApiParams`, the fixture | low | any |
| 32 | `museText` | server/muse.ts:66 | No importers | low | any |
| 33 | `/api/story-lab`, public/story-lab.html, scripts/story-lab*, prebuild-bibles, tailor-test | app/api/story-lab/route.ts; public/story-lab.html | design/30 lab tooling | low | any |
| 34 | Unused components and hooks: HeroCard.tsx (whole file), `HowThisWasMade`, `useCountdown` | components/HeroCard.tsx; DMNotes.tsx:250-322; lib/usePhone.ts:82-91 | No importers | low | any |
| 35 | Dead CSS: cold open, reveal, keepsake book, mode picker, old phone `ph-*`, goal bar, ladder and danger pips, old turn/vote/outcome blocks; `portrait-oval`, `timer-bar`, `pk-ladder`, `pk-grow`, `pk-sub`, `tvx-clip-meta` | app/quick.css:203-256, :328-517, :535-552, :588-619, :665-713 (keep `gp-need` :653-656); globals.css:209, :222-235; phone-theme.css:178, :471, :512-531; tv-theme.css:1359 | Used only by the dead screens | low | B (CSS sits next to its components) |
| 36 | Phone ladder diamonds and the `ladder`/`step` props passed through the phone | phone/kit.tsx:311-326; Phone.tsx:116, :140, :196, :209; Suggest/Watching/YourTurn screens | `ladder` is always `[]`. Phones show no progress while the TV shows act dots; swap in `progress` if wanted | low | B |
| 37 | HUD names and aria "ladder" / "Step N of 4" | tvskin/Hud.tsx:6-65 (aria :35), QuickTV.tsx:858; the stale swap-in notes in tvskin/index.ts:1-25 and phone/index.ts:1-31 | The visuals are already 3 act gems + crown | low | B |
| 38 | Presenter's old Attract screen covers the new lobby's own attract mode after 20 s idle | components/Presenter.tsx:41-45, :124; components/Attract.tsx | Duplicate attract path | med | **CD** (which one judges walking by see) |
| 39 | Old 6 heroes: data/quickstart_heroes.json, public/heroes/*.webp (not v2), public/pitch/char_*.webp; phone-preview still imports them | app/phone-preview/page.tsx:10, :39; lib/heroArt.ts:9 fallback | Replaced by v2 (d0260df missed phone-preview) | low | any |
| 40 | tv-preview points at old lobby art that isn't deployed (404 on Vercel) | app/tv-preview/page.tsx:25 | Lobby art moved to /lobby/v2 | low | any |
| 41 | Dev pages: `/juice-demo` ("Once upon a roll", "DC 15", marked safe to delete), `/sound-test` (keep until the sound review is done) | app/juice-demo/page.tsx; app/sound-test/page.tsx | Demo scaffolding with public URLs | low | any |
| 42 | Publicly served stale HTML: meta.html (old heroes, "weirdly good at"), devpost.html ("Needs 12+"), options.html (Catch, Boost, Mirror, Hope), how-it-works.html (clues, Mirror); public/style-candidates (4.8 MB); create-next-app .svg files | game/public/* | Not linked from the app or the hub. **Keep** public/quests (all 8 used), heroes/v2, lobby/v2, pitch/deck.html | low | any |
| 43 | Team hub title and brief: "Once Upon a Roll HQ", Catch!, Rescue Round, Hope | claude.ai/artifact/Aehk1tVCwhGP9ydNnXxFD3 | Out of repo; judges may see it if it's shared | low | any |

**Leave alone (renaming costs more than it saves before judging):**
- `ouar-*` CSS classes and storage keys (renaming `ouar-code` drops an open room on refresh).
- Seed field names (`fairytale_premise`, `the_threat`, `realm_name`), which the MCP route reads.
- `seedScenes`' multi-scene branch: fallback-only, since all 8 seeds have openers.
- The `threat` alias in opener.ts.
- "quest" wording on the vote: a CD call.

## 3. Contradictions with design/35
**In the live turn prompt (they fight design/35 on every turn):**
- server/prompts.ts:9 (DM_CORE, the prefix of TURN_BASE and STORY_END): *You are the Dungeon Master of "Once Upon a Roll,"*
- server/prompts.ts:34: *"The game engine owns all mechanics: dice, totals, Hope."*
- server/story-examples.ts:636: *`- situation … right_now … ladder.next ${q(t.ladder_next)}`*. Every example shows a ladder rung as the next goal, while the prompt itself has no ladder input.
- server/story-examples.ts:429: *"Every turn must move to a new situation."* That fights procedural.ts:49, *"never invent a random change that the plan did not cause"*, and the CD's softened rule 3.
- server/prompts.ts:24: *"Never paste a player's words."* Next to procedural.ts rule 14 (*"uses the player's own key word … chess stays chess"*), this needs one clause: "paraphrase, but keep their noun".
- server/stories/procedural.ts:39: plan is *"for meaning"*. That is the same wording design/34 blamed for washing out ideas; rule 14 now outweighs it, but it is worth deleting.
- server/stories/procedural.ts:49: *"something moves every turn … 'nothing happens' is not"*. This is a mild tension with the softened rule 3. It looks deliberate, because the SETBACK range is "momentum: small, never nothing" (lib/procedural.ts:101-108). **The CD should confirm it.**

**Dead now, but would fight design/35 if anything calls them again:**
- prompts.ts:231: *"move the story to its NEXT act"* (one act per turn).
- prompts.ts:234: *"The story NEVER stays put … win or lose this outcome ends in a NEW situation"*.
- prompts.ts:275: *"Only the first concrete action happens."*
- prompts.ts:278: *"Clearly different from the last situation."*
- fallbacks.ts:120-122: *"The problem is still right there."*, *"The problem isn't solved yet."* (twice).
- lib/host.ts:359-365: the same lines.
- fallbacks.ts:105, host.ts:366-370: *"The die lands, …"*
- opener.ts:140-142, :442-445: *"beats: the story ladder, ONE beat per real_setting.arc step"*, *"beats must mirror real_arc one to one"*.
- bible.ts:64: *"acts: exactly 'turns' acts, one per turn … act 1's goal is opener.beats[0]"*.

**UI and code rules:**
- DMNotes.tsx:14: *"Needs N+, bonuses and totals are plain math."*
- host.ts:2753: *"Below the target fails; reaching it works with a cost; 3 over works cleanly."*
- host.ts:2411: a full danger meter adds −3 to the finale, a rule no current doc has.
- host.ts:674: *"Their hero plays its own suggestions and rolls itself"*.
- RevealScreen.tsx:35: *"This really happened"*.
- ThrowScreen.tsx:59: *"Your plan won"*.

## 4. Safe removal order
Rule: one commit per step, run `npm --prefix game run build` (or tsc) after each, and do a quick `/tv` + 2 phones playtest after steps 1, 3 and 5.

1. **Prompt and copy only (≈20 min, B, before 9:30):** #1-3 and #28. In DM_CORE: rename the game, drop "Hope", add "keep their key noun". In story-examples: drop the `ladder.next` print line and reword line 429. Delete "for meaning" in procedural.ts:39. Then #4-9, #11, #12. No logic changes. Re-run `node scripts/procedural-test.mjs` once.
2. **CD decisions (5 min of the CD's time):** #10 danger meter (recommend: cut both the bar and the hidden −3; the act gems already show stakes), #38 attract screen, and confirm the "momentum" rule. Then B applies the answers.
3. **Move "Play another" and "How the AI decided" into EndingMontage (#13)**, then delete the dead QuickTV screens and their imports (#22), then the dead CSS (#35). Playtest the whole ending.
4. **Delete whole-feature islands in host.ts and TV.tsx:** Mirror (#14, #15), Catch/saves (#16), shelf and ending API (#26, #27), then FALLBACK_OUTCOME/ENDING (#17, #21). Each island is self-contained; tsc catches leftovers.
5. **Server dead tasks:** remove the route cases and TASKS entries first (#18, #19), then the prompts, then fallbacks.ts (#20). Retire scripts/story-evals.mjs, or point it at `turn`.
6. **After the feature freeze (Sun 10 AM), or after judging:**
   - rules/grade exports (#23)
   - GameState/Player/RollResult fields (#24, touches phones)
   - truth/fear (#25)
   - opener ladder checks (#29; test the openers again)
7. **Anytime, by anyone, no game risk:**
   - bible pipeline (#30; repoint procedural-test.mjs first)
   - news pipeline (#31), museText (#32), story-lab (#33), unused components (#34)
   - phone/HUD naming (#36, #37)
   - old heroes and previews (#39, #40), dev pages (#41), public HTML and style-candidates (#42), hub (#43)

Don't touch: public/quests (the demo's pre-painted scenes), seed_quests.json, story_library.json, quest_images.json, heroes/v2, lobby/v2, pitch/deck.html, the `/api` routes image, mcp, news, scene-art, story/opener, tts and transcribe.
