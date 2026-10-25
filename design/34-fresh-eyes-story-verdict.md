# 34: Fresh-eyes story verdict (Sun ~3:30 AM, from the CD's "worst run yet")

Source: recording `20261025-0731-46` (live build 196ae87, Full Story "The Cat Bus Home", Dot and Milo human, Ranger Wren and Nadia bots, 9:25). I looked at a frame every 3 s and transcribed the audio with Muse Transcribe. Then I read host.ts and prompts.ts on the latest branch, plus design/24, 29 and 30.

## Verdict
The engine is built as a **fixed track with flavor text**. Each turn's destination is decided before the player types. The plan only colors how the heroes get there, and a "success" is never allowed to finish anything. On top of that, Muse timed out on 4 of 6 outcomes. The canned lines that replaced them literally say the opposite of progress. So the table saw three things: their ideas ignored, goals going backward, and "the problem isn't solved yet" after a nat-19.
- "Bro, I literally just solved the problem." (Dot grabbed the cat; the game called it RISKY, then "helps a little, but it costs something")
- "This doesn't explain anything."
- "We've been in the same scenario for eight [minutes]."

## Root causes (all on the latest branch unless noted)
1. **The destination comes first.** prompts.ts OUTCOME_BASE: *"every turn moves to ladder.next; the roll only picks … how the heroes arrive there"*, plus *"Before the finale the problem is never solved for good."* So a good idea can't change where the story goes, and a solved step must be un-solved. After Dot's GREAT, the AI made the cat duck under the porch, which is a new barrier invented to keep the ladder alive.
2. **The ladder repeats steps.** `buildLadder` (host.ts ~L1679) spreads 2-3 beats over 8 turns with `floor(i*beats/turns)`, so each goal sits on 2-3 rungs in a row. When the AI's own goal is missing, `showOutcome` falls back to `L[step]`, which is an *earlier* goal. Seen live: Coax the cat close → Lure it from under the porch → **Coax the cat close (again)** → Calm it around cages → Lure it into the cage → **Calm it around cages (again)**.
3. **The fallbacks are anti-story, and they fired 4 of 6 times.** The outcome call has 12 s and Muse was slow. `FALLBACK_OUTCOME` (host.ts ~L374, server/fallbacks.ts ~L120) never mentions the plan and ends on *"still right there"* or *"isn't solved yet"*. The situation isn't updated either, so the same situation line was read aloud 3 turns in a row.
4. **The problem is one micro-task (catch a cat) stretched over 8 turns.** Nothing escalates, nothing new enters, and the magic hook (the night bus for lost pets) disappears after the opener. With 8 turns and one task, the only way to fill turns is to undo progress.
5. **Ideas get washed out before the writer sees them.** The ruling's `attempt` sanitizes them:
   - "I'm good with animals so it just naturally trusts me" became "Dot calls the cat toward her voice".
   - "develop a screen that attracts cats" became "Milo codes a squeaky mouse game on a phone".
   - The outcome prompt then says *never copy the plan* and *only the first action*, under a 26-word cap. The player's joke and their specific noun never reach the screen.
6. **Bots as turn owners poison a human table.** Bot Wren's plan was "stands by the porch unsure what to do" and it rolled a 19. Bot Nadia skipped Dot's suggestion ("Use my thing. Bro."). Players asked "Why is she saying lol?"
7. **design/30 makes cause 1 worse.** Its three pre-written outcomes per act reduce the player's plan to an `{action}` slot inside a sentence written before the game. It fixes coherence by removing agency. Keep its bible (setting, problem rule, cast, endings). Drop its per-act outcomes and goals.

## The story design I'd ship (10 lines)
1. **Plan the stakes, not the steps.** A story is a problem with a rule, a hook (the bus), a clock and 3 acts, not an 8-rung ladder of micro-goals.
2. **Acts change on purpose.** Act 1: reach the thing. Act 2: it gets worse in a new way, using the hook (the bus pulls up). Act 3 is the finale. Each act is a *different* situation.
3. **A success can finish the act.** If a plan solves the act's problem (grab the cat), it's solved, and the next act's twist arrives *because* of it ("Dot has the cat… and the night bus opens its doors for both of them").
4. **The plan is the cause.** Every outcome names the player's own key noun or idea and makes it the reason the world changed. Test: a bystander can tell whose idea it was.
5. **Nothing achieved is ever undone.** Wins become facts ("the cat trusts Dot") kept in a 3-5 line world-state list that is sent on every call.
6. **Fail forward means a new complication from the same idea** (the warm food draws three more cats), never "still right there".
7. **The roll sets intensity, not the destination.** Low rolls make the act harder and funnier; high rolls skip a step or add a gift.
8. **"Right now" is written from what just happened,** never pulled from a pre-spread list.
9. **The finale lands on the real event's outcome,** reached through the facts the table earned. The reveal maps each fact to what really happened.
10. **Turns:** 1 per player for 4+ players and 2 per player for 2-3 players (max ~6). Bots never own a turn when humans are playing.

## Cut
- Pre-spread ladder goals: show act dots (3), not 8 diamonds.
- The "never solved before the finale" rule.
- design/30's pre-written per-act outcomes and goals (keep `fillBeat` only as an emergency fallback).
- The canned generic outcome lines.
- Bots owning turns at a human table, and bot "lol" suggestions.
- 8-turn Full Story.

## The 5 changes to make before 9:30 AM (smallest that fix what the CD saw)
1. **Kill the backward goals (15 min, host.ts).** `buildLadder` uses each beat once (ladder = beats + goal, no stretching). In `showOutcome`, never set `nowGoal` to a goal already shown. If the AI gave none, keep the current one only on a worse branch; otherwise take the next *unused* beat.
2. **Plan-aware, forward fallbacks (20 min, host.ts + fallbacks.ts).** Build them from `pitch.verdict.interpretation` + the grade + the next beat: "{Hero} {attempt}, and it works: {next situation}." or "{Hero} {attempt}, and it backfires: {complication}." Always update `situation`. Ban "still right there" and "isn't solved yet". Give the outcome call 15 s (it starts at the ruling, so the swipe and tumble hide most of it).
3. **Rewrite the top of OUTCOME_BASE (20 min, prompts.ts).** Replace "every turn moves to ladder.next / never solved before the finale" with:
   - "The plan is the cause. Use the player's own key noun."
   - "If it solves the current step, it is solved, and the next act begins because of it."
   - "Nothing a hero achieved is undone. Never invent a new obstacle in the same spot after a success."
   - Add a code check: the text must contain a content word from `plan`, else retry once or use fallback 2.
4. **Shorter Full Story (5 min).** 1 turn each at 4+ players, 2 each at 2-3 players. Judge and video runs: no bots, or bots that only suggest.
5. **Keep the hook in play (15 min).** Store the opener's fantasy hook in `spine.hook` and send it on every outcome. Rule: it must show up in act 2's situation and in the finale. Plus a `facts` list of what the heroes achieved, which is never contradicted.

After these: run one 4-human Full Story with Muse live. Pass = no goal repeats, no canned line, and every outcome quotes its plan's idea.
