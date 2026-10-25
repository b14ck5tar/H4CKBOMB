# 28: Writers' Room (gold-standard examples)

Storytelling is our weakest link (design/21: "foam", butter chicken taking over, unfollowable wording). Models copy examples far better than they follow rules, so `game/src/server/story-examples.ts` holds hand-written examples in the exact house voice. The prompts embed them as few-shots.

## The voice (CD)
- **Iconic, a little dry and witty, creative, unexpected but it makes sense.** The world takes the strange thing seriously. The joke is one concrete detail, said flatly ("The table now floats an inch off the ground, which is fine.").
- **An 8-year-old follows it the first time.** 1 or 2 short sentences (26 words max). Everyday words. Plain cause and effect a listener could retell.
- **Start with the hero's name.** Show the power doing the work. Mention a weakness only when this exact plan walks into it.
- **Credit friends on success** ("Lou's idea"). **Never name a friend on a fail.** A fail belongs only to the hero who acted, and no idea is ever called bad.
- **Fail forward.** Every turn ends in a new situation. Low rolls arrive at the next act the hard way, and the problem escalates by its own rule (laughing lifts the hats, so floury elves are a disaster).
- **Inside the real event.** The real kind of place, the real roles (the record judge, the house-moving crew boss, the lifeguard), the real stakes. One fantasy twist on top.
- **Humor from the situation, not random props.** Flour comes from the bakery the plan went through, and beach umbrellas come from the beach. At most one new object per turn.
- **No** em dashes, semicolons, invented names, pasted player text, generic cheering, or spoilers of the real story.
- **"Right now" goals:** verb-first, 8 words max, a physical verb plus a thing in the scene, a real step toward the story goal, and a kid can tell when it's done.

## What's in the file
| Export | What | Embed in |
|---|---|---|
| `OUTCOME_EXAMPLES` / `outcomeExamplesPrompt({avoid})` | 3 games x 4 turns (elf record, homesick house on a moving truck, a lost rain cloud at a sand sculpture contest). Rolls 1, 2, 3, 7, 9, 10, 11, 13, 15, 17, 19, 22 cover every grade | `OUTCOME_SYSTEM` (replaces its fossil examples) |
| `BAD_EXAMPLES` / `badExamplesPrompt()` | 12 "never like this" lines with the reason and a better line (adds weak credit like "with X's help", with 3 better ways; kennings; game words; a moral noun that never appeared) | `OUTCOME_SYSTEM`, after the gold examples |
| `GOAL_EXAMPLES` / `goalExamplesPrompt(n)` | 12 weak vs good "Right now" goals | `OUTCOME_SYSTEM` now_goal rubric (`n` = 6 if tokens matter) |
| `OPENER_EXAMPLES` / `openerExamplesPrompt({avoid})` | 3 spoiler-free openers in the opener's field order | `OPENER_SYSTEM` after `EXAMPLES` in `stories/opener.ts` |
| `CALLBACK_EXAMPLES` / `callbackExamplesPrompt()` | 6 callbacks (a fail becomes the fix, an NPC's line returns, a friend's unpicked idea gets its moment, a real knack, the recap) | `EPILOGUE_SYSTEM`, and `OUTCOME_SYSTEM` on later turns |

## Rules for using them
1. **Leakage:** the model copies example words when the live story looks like an example (design/09). None of these events is a demo quest or the fossil/pumpkin stories. Always pass `avoid` = live title + `real_event.place_type` + problem name, and overlapping games are dropped.
2. **The current fossil-drawer examples in `OUTCOME_SYSTEM` match tonight's live story ("The Drawer With Claws")** and use the bot names Momo and Raj. Swap them for `outcomeExamplesPrompt()`. Example heroes here (Lou, Omar, Nadia, Tess, Carmen, Wes, Ines, Theo, Zoe, Hank, Dev, Ollie) avoid the bot and ready-made hero names.
3. **Caching:** the builders are deterministic, so the system prompt stays a stable prefix. Don't rotate per call.
4. **Tokens:** the full outcome block is about 1,850 words. If Spark latency suffers, use `{games: 2}`.
5. **Theme copying:** the model copies an example's THEME, not just its words. A first version had a snoring clock and a humming harbor, and live stories turned into nap and hum stories. Each twist is now a different kind of problem (a rule that escalates, a stubborn homesick object, the weather), and none is about sleep or sound. Keep new examples varied the same way.
6. **New examples** must pass the lint: 26/22/8/20-word limits, a hero-name start, chained situations, credit only on better or legendary, no dashes, colons or banned words.

## Self-review
Each turn was scored 1-5 on clarity, humor, cause and effect, real event, fail forward and goal. The weakest three were revised:
- Version 1's weakest turns (the harbor's crowd line and "too low to hum", the clock's credit phrasing) were rewritten.
- The clock and harbor games were then replaced with the house and sand games, because their sleep and sound themes leaked into live stories.

The openers were also trimmed to the 45-word narration limit.
