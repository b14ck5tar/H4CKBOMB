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
