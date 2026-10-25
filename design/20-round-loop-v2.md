# 20: Round loop v2 (the CD's decisions, Sat evening)

The source of the decisions is `DECISIONS.md`. Guiding rule from the CD: **stay close to the best parts of real D&D, keep it fast, no player can dominate, no real-life stuff outside the game.**

## Join (replaces "one true thing" and the partner's 3 questions)
- Pick a ready-made hero or make your own (keep both paths).
- Two skippable questions:
  1. "What's something you're weirdly good at?" (e.g. parallel parking, finding lost things) → `real.skill` → the hero's **power** (metaphorical use welcome).
  2. "What's a small thing that scares you?" (e.g. geese, voicemails, the deep end) → `real.fear` → the hero's **weakness**, comedy in the fiction only. Never ask a player to face it.
- With a ready-made hero, answers override that hero's ability/flaw text. If skipped, the hero keeps its own.
- Answers are private: not shown on the TV until the reveal, and never in DM's Notes as raw text before then.
- Drop `real.talk` and the side quest completely. **No real-world plans, events or suggestions.**
- Keep the partner's "Who's playing?" Kids / Teens / Adults rating (`lib/rating.ts`, `RATING_GUIDE` in every prompt). Default: Teens.

## Story choice
- Full Story: the TV shows **3 random headlines** allowed for the rating. Every phone taps one (15 s or when all have voted). Ties are broken at random. No AI "best fit" pick (remove `pick_quest` from the flow; keep the code only if it's harmless).
- Quick Tale: random, no vote.
- Each hero still gets one spotlight moment written for their power somewhere in the story (round-robin by scene).

## The round (one scene)
1. **Scene** narration plus each phone's "Only you noticed…" clue (from that hero's power). Ready-gated.
2. **Everyone types a plan** (40 s; auto-pitch from a suggestion on timeout; moves on when all are in).
3. **Back one plan** (15 s; moves on when all have backed). Each phone shows all plans and taps one, own or a friend's.
   - **Spotlight rule:** a player whose plan has already won can't win again until every present player's plan has won once. Their plan shows "already had the spotlight" and can't be backed.
   - Most backs wins. Ties go to whoever has been picked least, then at random.
   - No arguing phase, no timer extension.
4. **Ruling + help, in parallel:**
   - The AI rules the winning plan (tier + plain `reason`).
   - Meanwhile the winner may pick **one friend's help**: one piece of one other plan, shown as "+ Sam's fake-cop voice". Optional. Adds **+2**, no extra dice.
   - The DM may weave in that one piece only. **Do not fold in every plan** (CD: "could easily get way over congested").
5. **Convince the DM** stays: only the winner may argue once, the tier can only go up. Only if the winner taps it; otherwise skip immediately.
6. **The winner rolls one d20** (auto-roll on timeout, plus a phone buzz). Total = d20 + stat + tier mod + help (+2) + Inspiration spent on them (+2). Bands as today.
   - **Remove "clever = no roll".** Every winning plan rolls; clever is just the best modifier.
7. **Outcome:** one beat card for the winning plan (naming the helper's piece if used), plus a one-line "meanwhile" for the rest of the crew. Then the next scene.

**Remove:** Boost, Catch!, the everyone-acts multi-roll and the multi-beat per hero. The thank-you button is now "Thank <helper>" (the winner thanks whoever's piece they used).

## Turning players outward (the CD approved these for now; to revisit after playtest)
Players naturally focus on their own hero, so each mechanic hands them something about a friend:
1. **You can't back your own plan.** If you're the only one who can back, auto-skip. If every eligible plan is blocked by the spotlight rule, reset the rule.
2. **Clues are jigsaw pieces.** Each "Only you noticed…" clue is useful for ANOTHER hero's power and names them ("…and Ben is weirdly good at coffee"). Rotate so every hero is named by someone. With one player, the clue fits their own power.
3. **Help is pre-picked.** The AI proposes the best single piece from another plan ("Add Ben's coffee idea? +2"). The winner keeps it with one tap or removes it.

## Inspiration (replaces Catch!)
- After each ruling, the AI may award **one** Inspiration for the most creative, well-thought-out plan of the scene, **any plan, not just the winner**. Reason shown in DM's Notes.
- Max one per scene. The same player can't earn it two scenes in a row.
- The earner **can only give it to a friend**: their phone shows "Give your Inspiration to…" and the token is spent on that friend's next roll as +2 (or banked until that friend's next win). The TV shows "Ava gave Ben her Inspiration ✨".

## Final Roll
- Keep the shake-together ritual (arm → 3, 2, 1 → SHAKE), but it is **ONE shared die**: no best-of-N. Total = d20 + Hope modifiers as today.

## Ending
- Quick Tale: no Mirror. Full Story: keep Mirror for now (CD calls it the weak link; replacement TBD). Use `registerEnding()`.
- Reveal: "This really happened. Here's the article." Plus the "Solved by Ava's parallel parking and Ben's coffee." line (`solvedBy`, from `real.skill` + names; omitted if nobody answered).

## DM prompt fixes (from design/19 stress test)
1. A plan that would end the whole threat before the climax can succeed only partially. The threat escapes, mutates or reveals a bigger layer (fail forward / "yes, but"). Never resolve the quest's core threat before the final scene.
2. Calibrate tiers: most reasonable plans are Solid; Risky for a real gamble; Absurd/Miracle only for impossible-by-the-world's-rules. "Teach the monster bingo" is Risky at worst. Target roughly 50% Solid across ordinary plans.
3. Weaknesses appear only when the plan invokes them or on a fail, not unasked in every beat.
4. Re-run `scripts/dm-evals.mjs` (from branch feat-evals) after the changes and update `design/19-dm-stress-test.md` with before/after.

## Timing target
- One Full Story scene ≈ 2 min. Quick Tale ≤ 3:00 from join to keepsake. Every phase advances early when everyone is done.
