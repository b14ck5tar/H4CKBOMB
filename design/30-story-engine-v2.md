# 30. Story engine v2: plan the story, then tailor it live (Sun)

**The problem.** Every outcome was written live, turn by turn, from scratch. The writer only saw the last few lines, so it lost the thread: props took over, twists came from nowhere, goals drifted, and the ending did not pay off the real story. It read like mush.

**The fix (CD-approved direction).** Plan the whole story once, with the best model and no time pressure, then adapt each planned beat live with a fast model.

| Stage | When | Model (default) | Budget | What it writes |
|---|---|---|---|---|
| `story_bible` | Once per chosen story, during the vote / title card | spark-1.3 high (or Wonder, see the lab) | 20-90 s, hidden | Setting, side cast, the problem's ONE rule, one act per turn (situation, Right now goal, planned twist, 3 pre-written outcomes), the finale, 3 endings, 3 callbacks |
| `tailor` | Every turn, after the die lands | spark-1.3 low | <= 3 s | The rolled branch's beat rewritten for what the hero really did and the exact roll, keeping the next act's situation |
| `tailor` (kind "ending") | The finale | spark-1.3 low | <= 3 s | The ending tier's planned ending, tailored, plus the recap and skills |

Why it fixes the mush:
- **The problem's rule** ("the hats float whenever someone near them laughs") is decided once. Every escalation, twist and fix follows it, so "unexpected but makes sense" is built in.
- **Every act is written knowing where the story goes next.** All three branches of an act lead into the next act's situation, so a bad roll never derails the story, it only changes how the heroes arrive (fail forward).
- **The endings are written against the real ending** (the opener's hidden `official_line`), so the reveal lands.
- **Callbacks are planted** in act 1-2 and paid off in the endings.
- **A failed live call costs nothing:** the beat is filled in code (`fillBeat`), so the fallback is still the planned, on-thread line, not a canned "it doesn't work this time".

## Player-driven (CD correction after the live run, Sun ~3 AM)
"You're not taking our ideas for how the story should progress; there are barriers even with successful rolls." So the bible is a **destination and guardrails, not a script**:
- **The chosen plan is what happens.** better/legendary: it works the way the player meant, and the situation changes in that direction (never "it works but the problem is the same"). mixed: the wanted part happens, plus a catch from the plan itself. worse: the plan happens and backfires in a way tied to that plan.
- **New paths are followed.** "Challenge it to chess" becomes the story; the next situation and Right now goal come out of what the plan did, heading to the finale goal. `ahead` (the planned milestones) is only a guide when the plan opened no path of its own. Never a goal the plan made pointless.
- **The pre-written beat is a reference** (voice, the problem's logic), passed as `reference`, never pasted when it ignores the plan. The AI-free fallback now says the plan happened at its strength ("Bev freezes time and scoops up the dog, Juno's idea, and it works."), not the plan-blind beat.
- **Skip ahead / finish early:** the tailor returns `steps` (1, or 2 on GREAT/LEGENDARY when the plan already did the next milestone's job) and `goal_reached` (true when the plan achieved the finale goal: go straight to the finale).

Tested on the stored "Bison Babysitter" pack (spark minimal, 2.6-4.8 s): a staring contest freezes the bison and the dog goes quiet; Bev's time-freeze scoop puts the dog in her jacket and the goal jumps to "Walk the tired dog home"; the phone call brings the family running (steps 2); climbing the bin rolls it and the bark makes the bison carry the dog off; the hay trade drags the dog toward Juno. All five followed the plan; no fallbacks after the pronoun-check fix.

## Files
- `game/src/server/stories/bible.ts`: the bible prompt + schema + code checks + retry + in-memory cache (`makeBible`), the tailor prompts (`tailor`, `tailorEnding`), live post-checks (`liveProblems`: game words, they/them pronouns).
- `game/src/server/stories/models.ts`: **the one config** for which model writes which stage (`ENGINES`, `DEFAULT_ENGINE`, env `STORY_ENGINE`), plus an OpenAI client (reads `OPENAI_API_KEY` inside the function, never logs it).
- `game/src/lib/beat.ts`: the bible's types + `fillBeat` + `BEAT_OF` / `ENDING_TIER`, pure, so host.ts can import them.
- `game/src/app/api/ai/route.ts`: tasks `story_bible` and `tailor` (+ fallbacks, + post-checks). `maxDuration` is now 120 s for the bible.
- `game/src/app/api/story-lab/route.ts`: dev-only, saves the CD's blind picks into this file.
- `scripts/story-lab.mjs` + `scripts/story-lab.template.html` → `game/public/story-lab.html` (the blind test).
- Also: `prompts.ts` ruling gets the design/29 #11 rule (a plan that serves the big goal is never wild just for skipping the Right now step); `opener.ts` gets the design/29 #4 rule (say WHAT and WHERE plainly, hide only the outcome, no kennings).

## The bible's shape (`lib/beat.ts` StoryBible)
```
setting: 2 sentences, spoiler-free
problem: { name, stakes, pronoun, rule }
cast: [{ role, name, want, voice, line }] x2-3   (cast[0] = the recurring side character)
acts: [{ situation, goal, twist, outcomes: { worse, mixed, better: { text, carry } } }] x turns
finale: { situation, goal, twist }
endings: { triumph, mostly_fine, well_its_a_story: { text, line } }
callbacks: [3 lines]
```
Beat text slots: `{hero} {action}, ...` and, on better only, `{friend}` in a credit clause (4 credit forms, never "with X's help"). Act 1's situation = the opener's situation; act 1's goal = beats[0]. `carry` = the one fact the branch carries into the next act (worse: the complication, mixed: the twist, better: the bonus).

Inputs: `opener` (as /api/story/opener returns it), `real_event` (= opener.real_setting), `ending_facts` (hidden, so endings land on the real ending), `news` {headline, snippet, source, place} (only for the spoiler check in code: never sent to the model), `party` (names + powers), `turns`, `rating`, `cache_key` (the seed id), `motifs_used_tonight`.

Code checks before accepting a bible: exact act count, no avoid/giveaway words, no hero names, no banned names, verb-first 8-word goals with no vague verbs, no repeated goal, the `{hero} {action}` start, no `{friend}` on worse/mixed, word limits, dashes/banned words. Serious problems trigger one retry if the first call left time; small ones are fixed in code (`tidy`).

## design/29 + persona-sim rules folded in
- #4: say plainly WHAT it is and WHERE; hide only the outcome; kennings banned ("pale fliers").
- #6: `motifs_used_tonight` avoid list (sleep, hum, glow, whisper, pale + each earlier game's problem noun); the rule hits a different kind of thing each act (crowd, object, weather, mix-up, friendly rival, deadline).
- #9: the weakness is only sent to the tailor on the worse branch (enforced in code, `heroFor`); 4 credit forms.
- #10: game words banned in the prompts AND checked in code (dice, natural 20, "needs 12", DC...) → fallback to the filled beat. Endings may only mention things in the log, beat, cast or callbacks.
- #11: Right now goals are sub-steps that lead to the finale goal; the ruling never punishes a plan for serving the big goal.
- Pronouns: `pronouns` {name: "they/them"} map into every tailor call; a they/them hero next to he/she in a sentence (with no one else named) → fallback.
- Persona sim: every narration <= 2 short sentences; `dont_reuse` = the last 6 narration lines, never reuse their phrases, openings or sentence shape.

## Stored bibles (Muse is slow at night: never make the judge table wait)
- `scripts/prebuild-bibles.mjs` writes a bible for every story in `game/src/data/story_library.json` (default 4 acts, teens) into `game/src/data/story_bibles.json` (`server/stories/stored.ts`). It reuses the library's stored opener, or writes one with no party (the pipeline stores it in the library too).
- **Story packs.** Each stored entry carries its own opener and reveal facts with the bible (the library's opener field is overwritten by every new game, so it cannot be trusted to match). `story_bible` with `stored_only: true` + `cache_key` (library id) + `turns` + `rating` returns `{opener, ending_facts, bible}` instantly, or `{bible: null}`. The host plays that opener, so the bible always matches, and skips the opener call entirely (no Muse wait at all for library stories).
- `story_bible` (normal call) also checks the store: same story id (`cache_key` = the library id), same opener (fingerprint = situation + problem name), same rating, and at least as many acts as turns. A 4-act bible also serves 2- and 3-turn games (`fitBible` keeps the first and last act and evenly spaced ones). A hit returns at once with `meta.stored: true`.
- A new library story's fresh bible is saved to the store automatically in dev. On Vercel the file is read-only, so run the prebuild locally and commit `story_bibles.json`.
- For the store to hit, the game must play the library's stored opener (the pipeline's replay path). A brand-new opener gets a fresh bible (Wonder ~35 s, hidden during the vote and title card).
- Tailor budget: the host already starts the outcome call when the die is decided (right after the ruling), so the swipe + tumble hide ~4-6 s. After the die lands, wait **at most 3 s** more, then show the stored beat filled in code (`fillBeat`). Spark minimal measured 2.8-5.7 s per tailor tonight, gpt-4.1 1.0-1.8 s.

Pre-built tonight: all 10 library stories (4 acts, teens, Wonder medium, 55-78 s each, 0 code-check problems). Their openers still lean on sleep motifs ("The Sleepy Snore Static", "The Napping Pumpkin Patch"): that is the opener prompt, which needs `motifs_used_tonight` and the house-wide ban on sleep/hum (pipeline agent). Re-run `node scripts/prebuild-bibles.mjs` after the opener fix; it skips stories that already have a pack, so delete their entries first.

## Story lab (blind multi-model test)
Open `http://localhost:<port>/story-lab.html` on a dev server. Two real news stories, each played as a full mini-game (bible + 3 tailored turns + tailored ending) by 3 configs, with the same heroes, plans and rolls. Versions are shuffled and shown as A/B/C; Pick, Reveal, then Save (appends "CD picks" at the bottom of this file) or Copy.

Re-run: `set NEXT_DIST_DIR=.next-lab&& npm --prefix game run dev -- -p 3107`, then `node scripts/story-lab.mjs` (cached per step; `--fresh` to redo; a ledger caps text calls at 60).

### Lab results (Sun ~2:30 AM, Muse running slow tonight)
Stories: "Cumbria zoo welcomes troublesome trio of rare baby fossas" (BBC) and "2 giant Ramesses II statues discovered by man in Egypt" (Live Science), both from the cached news list. Heroes Juno (they/them), Gus, Bev; rolls fossas SETBACK 4 / GREAT 17 (Juno's idea) / PARTIAL 8, finale 13 (triumph); statues DISASTER (nat 1) / PROGRESS 11 (Gus's idea) / LEGENDARY (nat 20), finale 7 (mostly fine).

| Config | Bible time | Bible code-check problems | Tailor time (each) | Notes |
|---|---|---|---|---|
| muse-wonder-1.0 medium bible + spark minimal tailor | **33-39 s** (4 runs; 55-72 s in the prebuild later at night) | 0 every time | 2.8-5.7 s (minimal); "low" was 7-9 s | Most grounded and coherent: every situation hands the next hero something, credits are right, endings land the real story. Humor drier and fewer props. |
| muse-spark-1.3 high bible | 78 s once (18k output tokens), then 2 timeouts (75 s, 110 s) and one "length" failure at 24k tokens | 0 | | **Not usable for bibles**: too slow and flaky tonight. Kept in models.ts for reference only. |
| muse-spark-1.3 medium bible + spark minimal tailor | 50 s (fossas), 63-73 s (statues, after a "length" failure at 16k tokens and a timeout at 110 s) | 0 | 3.4-5.2 s | Close to Wonder in quality, slower and less reliable (spends 11-13k tokens reasoning). |
| gpt-4.1 bible + gpt-4.1 tailor | 7-32 s | 1 small each (a dash, a vague goal, a banned phrase), fixed in code | **1.0-1.8 s** | Funniest single lines ("Marge pockets the mustache"), but more stray props (boots, a mustache, a shoe) and it made the problem a cast member once. Off-Meta. |

Every tailored line used the right credit form ("just like Juno said", "on Juno's advice"), never credited a friend on a miss, and kept Juno as "they". Fallbacks (the beat filled in code) came up 4 times out of 24 tailors on Spark, all from timeouts; they read fine because they are the planned line.

**Recommendation:** `DEFAULT_ENGINE = "wonder+spark"`: Wonder writes the bible (pre-built for library stories, or ~35 s hidden in the vote), Spark minimal tailors. It is all-Meta (Meta's "AI essential" criterion) and it was the most coherent. If the CD's blind pick is gpt-4.1, switch one line (`STORY_ENGINE=gpt-4.1`); it is also the fastest tailor if Spark keeps running slow.

**What the lab exposed upstream (not the bible's fault):** the openers still carry tonight's tired motifs and kennings. The fossas opener (written before the design/29 #4 rule) calls them "tiny climbers" and makes them float; the statues opener has the kings snoring. The bible must keep the opener's problem, so it inherits them. The opener prompt now has the #4 rule; it should also get `motifs_used_tonight` (pipeline agent).

Note: the lab games used the first tailor prompt (keep the planned beat). The tailor is now player-driven (see above); the lab still compares the bible writers fairly.

Full transcripts of all six games: `node scripts/story-lab.mjs` writes `results.md` in LAB_OUT; the page shows everything.

## What host.ts must change (for the builder)
The tailor returns exactly the `outcome` shape and the ending tailor exactly the `epilogue` shape, so the parsing code in `askOutcome` / `askEnding` stays. Import from `@/lib/beat` (pure): `StoryBible`, `BEAT_OF`, `ENDING_TIER`, `fillBeat`.

1. **Seed:** add `bible?: StoryBible` and keep `private bibleP = new Map<string, Promise<StoryBible | null>>()` (seed id → bible).
2. **Ask for the bible when the story is chosen:** in `useQuest(id)` (and in the Quick Tale prep path, as soon as `prep.seed` is known), call `askBible(seed)` once:
   ```ts
   this.ask<{ bible: StoryBible | null }>("story_bible", {
     opener: seed.opener, real_event: seed.real_event, ending_facts: <the opener's ending_facts>,
     news: { headline, snippet, source, place } /* the candidate it came from; never shown to the model */,
     party: this.party(), turns: this.makeTurnOrder().length, rating: this.state.rating,
     cache_key: <the library story id (news candidate id)>, motifs_used_tonight: this.motifs,
   })  // stored bibles return at once; otherwise timeout 100 s; on null or failure: no bible, the current live path
   ```
   Then `seed.bible = d.bible` if the seed is still the current one. The first tailor call is ~60-90 s after the vote ends (title card + opener + turn 1's ideas, ruling and roll), so a 40-90 s bible is hidden. Optional (cost x3): start it for all 3 vote options right after each opener lands in `prepareStory`; the route caches by `cache_key`, so the winner's later call returns at once.
3. **Ladder:** in `buildLadder`, if `seed.bible?.acts.length === turns`, use `[...bible.acts.map(a => a.goal), bible.finale.goal]`. If the bible arrives after `startStory`, rebuild the ladder for the remaining steps (keep `step`).
4. **Each turn's outcome** (`askOutcome`): with a bible, `const act = bible.acts[Math.min(this.state.step, bible.acts.length - 1)]` (the ladder step, not the turn index: steps can skip), call `"tailor"` instead of `"outcome"` (timeout 6 s), with:
   ```ts
   { hero: { name, power, weakness: h.flaw, pronouns: h.pronouns }, attempt, plan, idea_from /* won only, as now */,
     roll: { total, grade, branch, meaning, depth, natural }, band,
     situation: this.state.situation, right_now: this.state.nowGoal,
     destination: { goal: bible.finale.goal, lands: bible.endings.triumph.line },
     ahead: [...bible.acts.slice(step + 1).map(a => a.goal), bible.finale.goal],
     beat: act.outcomes[BEAT_OF[g.branch]] /* a reference only */,
     next: bible.acts[step + 1] ?? bible.finale /* for the fallback's situation */, next_hero,
     problem: bible.problem, cast: bible.cast, callbacks: bible.callbacks,
     story_so_far: this.storySoFar(), earlier: <last 4 narrations>, dont_reuse: <last 6 narrations>,
     real_event: this.seed?.real_event, pronouns: <{name: pronouns} for every hero>, motifs_used_tonight: this.motifs }
   ```
   **Timing:** keep starting it at the ruling (as `outcomeP` does now). In `showOutcome`, wait for it at most 3 s after the die lands; if it is not in, use the filled beat. The local fallback `fb()` becomes `fillBeat(beat.text, { hero: h.name, attempt, idea_from, branch })` with `situation = next.situation`, `nowGoal = next.goal` (the route already does this when the AI fails; this covers a network timeout). If there is no bible (yet), keep the current `"outcome"` call unchanged.
5. **Progress** (`showOutcome`), player-driven: with a bible, `nowGoal = asked` (the tailor's now_goal follows the players' path), else the next act's goal. Advance the ladder by `d.steps` (1 or 2), and further if `now_goal` equals a later milestone. If `d.goal_reached`, skip the remaining turns and go straight to the finale (`startTurn` → finale). Never hold the story on a fixed beat, and drop the "fresh/backward" repeat guards for bible turns.
6. **Side character:** with a bible, use `bible.cast[0]` (`{speaker: role or name, line}`) wherever `npc_line` is sent today.
7. **Finale:** the finale's situation is the last tailor's situation (fallback `bible.finale.situation`); the finale goal is `bible.finale.goal`.
8. **Ending** (`askEnding`): with a bible, call `"tailor"` with `kind: "ending"`:
   ```ts
   { kind: "ending", winner: { name, power, pronouns }, attempt, plan, roll: { grade, depth },
     tier: ENDING_TIER[ending], beat: bible.endings[ENDING_TIER[ending]],
     heroes, log: this.state.log.map(l => `${l.hero}: ${l.narration}`), problem: bible.problem, cast: bible.cast,
     callbacks: bible.callbacks, story_so_far: this.storySoFar(), real_event, players /* as now */, pronouns }
   ```
   Fallback: `{ ending: fillBeat(beat.text, { hero: winner, attempt, branch: "worse" }), line: beat.line }`.
9. **motifs_used_tonight:** `private motifs = ["sleep", "hum", "glow", "whisper", "pale"]`; when a game ends, push its `problem.name` nouns (lowercase, minus "the"). Survives across games in the same TV session.
10. **DM's Notes (explainable AI):** when the bible lands, note "The story plan": `bible.problem.rule` + "planned by <model> in N s". Each turn: "Planned beat (<branch>): <beat.text>" and "Tailored by Muse Spark for <hero>'s plan", so judges can see plan vs live.
11. **Badges** (design/29 #10, keepsake): "Starring Riley (makes people laugh), Sam (plans group trips) and Jo (remembers every birthday)" in sentence case, from the `skills` the ending tailor returns.

### Message-ready steps for the builder
> Story engine v2 is in (`server/stories/bible.ts`, `lib/beat.ts`, `/api/ai` tasks `story_bible` + `tailor`). host.ts changes, in order (details in design/30 "What host.ts must change"):
> 0. Vote start, for each option that has a library id: `ask("story_bible", { stored_only: true, cache_key: <library id>, turns, rating })`. If it returns an opener, build the seed from that `{opener, ending_facts}` exactly as `prepareStory` builds it from /api/story/opener (same shape), set `seed.bible = bible`, and skip the opener call. Instant, no Muse. Only stories without a pack go through /api/story/opener + `story_bible`.
> 1. In `useQuest` (and Quick Tale prep), call `story_bible` once with the opener, real_event, ending_facts, news candidate, party, turns = `makeTurnOrder().length`, rating, `cache_key: <library story id>`, `motifs_used_tonight`; store `seed.bible`. Timeout 100 s, null = old path.
> 2. `buildLadder`: bible goals + finale goal when the act count matches.
> 3. `askOutcome`: with a bible, call `tailor` with situation, right_now, destination (finale goal), ahead (the remaining milestone goals), the beat for `BEAT_OF[branch]` as a reference, next act (or finale), pronouns map, `dont_reuse` (last 6 lines), `motifs_used_tonight`; local fallback = `fillBeat(...)`; wait at most 3 s after the die lands, then use the fallback. Same response shape as `outcome`.
> 4. `showOutcome` (player-driven): nowGoal = tailor's now_goal; advance the ladder by `steps`; `goal_reached` = jump to the finale. No repeat guards, no snapping back to a planned beat.
> 5. Side character = `bible.cast[0]`.
> 6. `askEnding`: `tailor` with `kind: "ending"`, `tier: ENDING_TIER[ending]`, `beat: bible.endings[tier]`, log as "Hero: line". Same shape as `epilogue`.
> 7. Keep a `motifs` list across games; add DM's Notes for the plan and each planned beat.
> 8. Pass `pronouns` on every hero you send (outcome, ruling, epilogue too).
