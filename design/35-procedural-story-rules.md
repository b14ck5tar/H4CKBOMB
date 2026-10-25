# 35: Procedural story rules (Sun ~3:30 AM, CD direction)

**CD:** "We're way off course with predetermined stories. Make rules for how the story is procedurally generated so the AI doesn't spit out nonsense or something hard to follow. Implement the research. Not new features: make it fit a SOCIAL game. It's meant to bring people together."

**Replaces** the story bible, pre-written branches and fixed ladder beats (design/30). The research behind it: design/05 (connection), 08 (DM craft), 09 (human voice), 10 (pacing), 28 (writers' room), 29 (fresh eyes), 32 (persona sim).

## The one principle
**Players steer, the DM reacts.** The chosen plan is what happens. The AI's job is to show the consequence clearly and hand the spotlight to the next friend. There is no script.

## What's fixed vs. generated
- **Fixed at the start (from the real event):** the place, the people involved, the problem, the stakes, one fantasy twist, and the **finish line** ("what solved looks like"), shown on screen all game.
- **Generated every turn:** what happened, what changed, and the next "Right now" obstacle.

## Story state (kept in code, small, shown to the AI every call)
`{ where, problem, finish_line, progress 0-100, cast (≤3 named side characters), facts (≤8 short true-in-this-story facts), open_thread (≤1), last_moments (last 3 outcome lines), memorable (2 player lines worth calling back), pronouns }`
The AI proposes changes (`progress_delta`, `new_fact`, `where`, `open_thread`). **Code validates and applies them**, so the story can't wander.

## Turn rules (every outcome must pass these; code checks what it can, retries once)
1. **The plan happens.** Name the action the turn owner chose, in plain words (paraphrase, never paste). Credit the friend if it was their idea, by name.
2. **The roll sets how well** (grade, design/24 bands):
   - legendary / great: it works better than planned, and progress jumps.
   - it works: it works, with a small cost or twist ("yes, but").
   - sort of: half works, and something new gets in the way.
   - uh oh / disaster: it backfires because of the plan itself, funnily, and the situation gets harder. It never repeats or undoes the past.
3. **Something changes, every turn.** At least one of: we move somewhere, we learn something, someone reacts, the problem shifts. Never "nothing happens".
4. **Progress, decided by code, not the AI:** success +25-40, it works +15-25, sort of +5-10, fail 0 (but the situation changes), disaster −5. At 100, go to the finale early.
5. **One new thing at most per turn** (a character, an object or a place). Props only matter if a player uses them. No new named characters beyond the cast of 3.
6. **Continuity:** never contradict `facts`, `where` or pronouns. If unsure, stay with what's known.
7. **Clarity:** 2 sentences, at most 30 words, an 8-year-old can follow, concrete nouns, cause, then effect. No game words (roll, dice, needs, natural). No kennings or invented jargon.
8. **Voice:** dry, witty, unexpected but it makes sense. Humor comes from the situation and the plan, never random props.
9. **Next obstacle ("Right now"):** one concrete step, at most 8 words, verb first. It must follow from what just happened and lead toward the finish line. Never a repeat, never "again".

## Social rules (what makes it a game that brings people together)
10. **Spotlight:** each outcome makes the acting hero look cool or hilariously human, by name.
11. **Hand-off:** the outcome or the next scene line **addresses the next player by name** with the new obstacle ("Juno, the lights are yours."). The room turns to that person.
12. **Friends' ideas count:** a used idea is credited on screen and in the narration. The table hears whose idea worked.
13. **Callbacks:** at most once per game before the ending, and always in the ending, pay off a funny player line or earlier moment from `memorable`.
14. **Talk-out-loud cue:** the TV invites the turn owner to read their plan to the table before sending ("Sal, tell the table your plan."). That's copy, not a feature.
15. **The ending** credits everyone by name with what they did, calls back 1-2 moments, then the real story: "Based on a true story."

## What to delete or switch off
- Story bibles, pre-written branch outcomes and fixed beats/ladder steps (keep the progress meter, driven by `progress`).
- Any guard that blocks a successful plan from changing the story.
- Canned fallbacks that ignore the plan. A fallback must still name the plan and apply rule 2 generically.

## Additions from the fresh-eyes verdict (design/34), all adopted
- **3 acts, each a different situation, plus the finale.** The act changes *because* a success solved it, or because the clock runs out. The progress meter shows 3 act dots.
- **A success can finish the act.** If the plan solves the current step, it's solved, and the next twist arrives because of it. **Nothing achieved is ever undone.** Wins become `facts`.
- **The plan is the cause.** The outcome must contain the player's own key noun or idea. Code checks for a content word from the plan, else retries once or uses the plan-aware fallback. Don't sanitize ideas into something else before the writer sees them; keep the player's joke and noun.
- **Keep the hook in play.** Store the opener's fantasy hook; it must appear in act 2 and in the finale.
- **Plan-aware fallbacks only:** "{Hero} {attempt}, and it works: {next situation}." / "…and it backfires: {complication}." Always update the situation. Ban "still right there" and "isn't solved yet". Give the outcome call 15 s (it starts at the ruling).
- **Turns:** 1 per player at 4+ players, 2 per player at 2-3 players (max ~6). **Bots never own a turn when humans are playing** (they may suggest), and no "lol" text from bots.

## Speed
One outcome call per turn with spark (low), started the moment the plan is ruled, so it's hidden behind the throw and the meter. The state is small, so prompts are short and fast.

## CD refinements (Sun ~3:45 AM): these override the rules above where they differ
- **Logic chain above all.** Take the player's action literally. Assume it actually happens the way they wrote it, then ask "what would realistically follow?" and build from that. The story always follows a logical line of reasoning from what the player wrote.
- **Rule 3 softened:** something doesn't *have* to change every turn. If it's logical that something changes because of what they did, lean toward it changing. Never invent change just to fill a turn.
- **Rule 4 (progress):** the AI judges how far the action logically moved things toward the finish line. Code only clamps it (a success never moves you backward; the game reaches the finale on time). No fixed numbers per grade.
- **Rule 5:** players can do anything ("everything should be possible, that's the fun"). If a player brings in something new, it's real now. The one-new-thing limit applies only to what the AI invents on its own.
- **Rule 7, stronger:** no made-up terms and no oddly phrased lines. Plain, simple sentences, even when the player did something odd.
- **Approved:** the hand-off to the next player by name, callbacks, and "tell the table your plan" (it gets people talking and lets friends give input).

## Implementation (server side, Sun ~4:30 AM)
- `game/src/lib/procedural.ts` (pure, shared by the TV and the server): `StoryState`, `stateFromOpener(opener, party, turns)` (finish_line = the opener's goal, hook = the opener's twist line, cast = the opener's speaker, facts = its first lines), `checkTurn` (plan's own key word in the outcome, hero named, friend credited only on a success, 2 sentences / 30 words, game words, they/them pronouns, Right now verb-first and never a repeat or "again", hand-off by name, the AI's own new things), `fixPronouns`, `applyTurn` (progress = the AI's `progress_gain` clamped by grade: a success never goes backward; a success that solves the step finishes the act; the act clock reaches act 2 by the first third of the turns and act 3 by two thirds; nothing reached is undone; wins become facts; cast <= 3, facts <= 8), `fallbackProposal` (names the plan and its grade, never "still right there").
- `game/src/server/stories/procedural.ts`: the "turn" prompt (logic chain first, rules 1-16 + the CD refinements, one writers' room game as few-shot), `runTurn` (Spark minimal, 12 s, one retry with the problems if time is left, then code checks and applies; never throws), `runEnding` (credits everyone from `credits`, calls back `memorable`, lands where the real story landed).
- `/api/ai` tasks: `turn`, `story_end` (same shape as `epilogue`: ending, line, recap, skills), `story_state` (opener -> first state, for scripts; the TV can call `stateFromOpener` directly).
- Legacy prompts: "every turn moves to ladder.next" and "never solved before the finale" are gone from OUTCOME_BASE and the ruling.
- Test: `node scripts/procedural-test.mjs` (3 Quick Tales on stored openers, plans incl. chess, a calf sweater, volleyball, hiring the turtle). Last run: every outcome used the player's own idea (chess set, sweater, volleyball, fishing net, inspector job, duct tape), 0 fallbacks, 0 repeats, every game reached act 3, one reached 100 early, every recap named all three heroes. Spark minimal took 5-10 s per turn tonight (Muse is slow), hidden because the call starts at the ruling; endings 2-3 s.

## host.ts integration (for the builder)
1. **State:** `private story: StoryState | null`. In `startStory()`: `this.story = stateFromOpener(seed.opener, this.heroes().map(p => ({ name: p.hero!.name, pronouns: p.hero!.pronouns })), this.state.turnOrder.length)`. Show `story.finish_line` as the goal, `story.right_now` as Right now, and `story.progress` as the meter with 3 act dots (`story.act`). Drop `buildLadder`/`ladder`/`step` for story progression.
2. **Turn order:** 1 turn per player at 4+ players, 2 per player at 2-3 (max 6). Bots never own a turn when humans are playing (they may still suggest).
3. **Talk cue:** on the turn owner's turn, the TV says "{name}, tell the table your plan." (copy only).
4. **Ruling:** send `scene.goal = story.right_now`, `final_goal = story.finish_line` (the ruling never punishes a plan for serving the finish line). Do not shorten the plan before the writer sees it.
5. **Outcome** (where `askOutcome` starts today, right after the ruling, timeout 15 s): `ask("turn", { state: this.story, hero: { name, power: h.ability?.text, pronouns: h.pronouns }, plan: pitch.text /* the player's own words */, attempt: verdict.interpretation, idea_from: <credited friend's name or "">, grade: g.grade, total: g.total, depth: g.depth, next_player: <next owner's name or "">, turns_left })`. Local fallback if the request itself fails: `fallbackProposal` + `applyTurn` from `@/lib/procedural` (same as the route).
6. **Show it** (`showOutcome`): text = `d.outcome`; then `this.story = d.state`; situation = `d.scene` (it already names the next player: do not prefix the name again in `turnLine`); nowGoal = `d.right_now`; meter = `d.progress`. DM's Notes: `+{d.progress_delta} progress: {d.progress_why}`; on `d.act_changed` note "Act {d.act}". If `d.finale` is true, skip the remaining turns and go to the finale.
7. **Remove:** outcome_branches, the "fresh/backward" Right-now guards, ladder clamping, and canned fallbacks that ignore the plan.
8. **Ending** (`askEnding`): `ask("story_end", { state: this.story, winner: { name, pronouns }, attempt, plan, grade, won, players })` → `{ ending, line, recap, skills }` (same as `epilogue`). Then the reveal: "Based on a true story".
9. **Badges** from `skills`: "Starring Riley (makes people laugh), Sam (plans group trips) and Jo (remembers every birthday)".

## The CD's 4 tweaks (Sun ~5 AM): built and tested
1. **Payoff, but simple** (hard rule in the turn, outcome and ending prompts): the plan happens as meant, then ONE plain cause and its effect that a tired 8-year-old gets on first hearing. No wordplay, double meanings or inside jokes. Bad: "The bison mom eats a rook and lets the calf go as a sore winner." Good: "Gus sets up a chessboard in the mud. The bison mom stares at it so long that the little dog trots away." Plus a **plain words** rule (everyday names, no stacked modifiers like "the cone juggling ice hand", no odd pairs like "calf soft", no similes, every "it/she" points to one thing) and a code check on Right now (4+ stacked words = retry).
2. **Momentum by default**: something moves every turn as a result of the plan (progress, a new problem or a new place). SETBACK still moves the meter a little.
3. **Hybrid progress** (`lib/procedural.ts`: `progressRange`, `progressDelta`, `paceProgress`). Ranges are multiples of par = 100 / turns, so every table size lands on time; the AI picks inside the range by logic (`progress_gain` + `progress_why`), code clamps:

   | Grade | Range (x par) | 2 turns | 3 turns | 4 turns | 6 turns |
   |---|---|---|---|---|---|
   | LEGENDARY | 1.7-2.3 | 85-115 | 57-77 | 43-57 | 28-38 |
   | GREAT | 1.3-1.7 | 65-85 | 43-57 | 33-43 | 22-28 |
   | PROGRESS | 0.8-1.2 | 40-60 | 27-40 | 20-30 | 13-20 |
   | PARTIAL | 0.4-0.7 | 20-35 | 13-23 | 10-18 | 7-12 |
   | SETBACK | 0.1-0.25 | 5-13 | 3-8 | 3-6 | 2-4 |
   | DISASTER | -0.25-0 | -12-0 | -8-0 | -6-0 | -4-0 |

   Pacing: no finale before the planned turn count, except one turn early in games of 4+ turns (the meter stops at 90 until then); a forward turn (PARTIAL or better) keeps the meter at least 35% of the way per turn and at least 75 after the last turn, so the finale always feels earned; a backfire is never pushed forward. A success that solves the step takes the top of its range.
   Simulation (`node scripts/progress-sim.mjs`, 20,000 games each, real dice math, a realistic plan mix): finale on the planned turn 78-100% of games (otherwise one turn early, only at 4+ turns), the meter at the finale averages 83-89, a GREAT is always 1.3-1.7 par. Live traces (`scripts/procedural-test.mjs`): 1 human/2 turns, good rolls: PROGRESS +60, GREAT +40 = 100 (finale on time); 1 human, two PARTIALs: +25, +50 = 75 (earned, not stalled); 2 players: GREAT +43, SETBACK +3, PROGRESS +30, PARTIAL +12 = 88; 3 players: PARTIAL +8, GREAT +28, DISASTER -2, PROGRESS +20, LEGENDARY +38, SETBACK +2 = 94; 4 players: PROGRESS +30, GREAT +43, SETBACK +4, PARTIAL +12 = 89.
4. **Wild plans need big rolls; powers never dominate** (ruling prompt): the tier scales with how far-fetched the plan is ("I teleport the bison home" = miracle); a power helps only when it truly applies and then at most one tier easier, never makes a plan clever by itself, never auto-wins. Tested: teleport -> miracle; "freeze time forever and carry everyone home" (Bev's 3-second freeze) -> miracle; Gus finding a thrown-away treat -> clever (uses the scene's food bin too).
5. **Playful labels**: lib/rules.ts tier labels are now CLEVER / SOLID / BOLD / LONG SHOT / ONLY A MIRACLE (were RISKY / WILD). components/tvskin/shared.tsx still says "Risky plan" (builder's file).

Followable on first hearing (my read of the 23 lines in the last run): 19/23 = 83% (turns 15/18, endings 4/5; the run before the plain-words rule was 14/23 = 61%). The 4 misses were odd specifics, not puns: "blinks wide and holds it", "the blink fits zero past cases in the tapes", "empty pockets full of sand", "the tape rail". Two of the stories (the sky turtle, the napping turtle) carry the openers' sleep/snore motif, which still leaks into lines.

Turn-call speed (spark minimal, server side, 19 turns): single model calls 4.0-9.0 s; per turn incl. retries p50 5.7 s, p90 14.2 s (the tail is retries). So TURN_BUDGET_MS is 15 s, max tokens 1500 (answers are 280-750 tokens), and a retry only runs for a hard problem with 7 s left, or a soft one with 10 s left.
