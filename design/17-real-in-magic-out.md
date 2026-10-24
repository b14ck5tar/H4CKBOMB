# 17 - Real In, Magic Out: players' real qualities meet real news

**Status: proposed, NOT built.** A design pass from Saturday evening for the creative director to accept, trim or reject. Builds on `SPEC.md` (Group Project, urban fantasy, Around the Table), `07` (Mirror, Mirror; Masks Off) and `16` (Real World mode). Nothing below is claimed as shipped.

**The problem it answers:** the game is great for friends *playing* together, but nothing real about the players goes in, so they don't leave knowing each other better. It's fun, not bonding.

## The idea in one line
> **The news gives the problem. Your real selves are the solution. Your real city gives you a reason to meet again.**

Urban fantasy makes this natural: the heroes are ordinary people with a hidden magical side, so players play **themselves**, not an invented knight.

## What makes people bond, and where we stand
| Bonding ingredient | Current build | This proposal |
|---|---|---|
| Sharing something real, a little at a time | Hero is a one-line invented concept | Two light real questions become your power and weakness |
| Depending on each other | Catch!, rescue, Boost, secret per-player clues | Bonus for building on a *friend's* real power |
| Feeling seen | Mirror, Mirror (in progress) | Keep it; the reveal also names each player's real quality |
| A reason to meet again | "Chapter 2" teaser only | A group side quest tied to a real local event |

## The loop
1. **Real you → power (join).** Phone asks two light questions, with a Skip:
   - "What's something you're weirdly good at?" → power ("parallel parking" → "slips through any gap in the city's spirit traffic").
   - "What's a small thing that scares you?" → weakness, used **only as comedy in the fiction**, never something the player must actually do.
   - Optional third: "What could you talk about for hours?" (feeds the side quest; see Flaws).
2. **Real news → the quest (problem).** SerpApi pulls 5-10 harmless headlines (city, then state, then national). Muse Spark **picks the one that best fits this party** and writes the uncanny cause, with **one spotlight moment per player** that only their real quality can solve.
3. **Real places → locations (during, stretch).** The DM asks one player in character: "What's a public spot in this city that matters to you?" It becomes a location in the quest.
4. **Real friends → combos (during).** A plan that builds on a friend's power is ruled one tier better. Small change on top of Boost / Team Up.
5. **The reveal (end).** Keep "The official story" next to "What your group uncovered", plus one new line: *"Solved by Mira's cooking, Jay's parking and Sam's birthday memory."* The reveal is **proof** ("this really happened"), not a surprise, since an Austin setting gives the source away.
6. **Real city → meet again (after).** Muse finds what the group shares; SerpApi Google Events finds a real, all-ages event nearby: *"The Oracle noticed you all love street food. The Night Market is Saturday. Group side quest: go together."* Next game night opens with "Did you complete it?" for a bonus.

## Example
Players: **Mira** (cooking / the dark), **Jay** (parallel parking / pigeons), **Sam** (remembers every birthday / public speaking).
News: *"Congress Ave bridge closed for repairs after cracks found."*
Quest: *The troll who has guarded the bridge for 100 years is sick, and the bridge cracks with him.*

| Scene | Problem | Whose real quality solves it |
|---|---|---|
| Hook | The troll only talks to someone who brings a proper home-cooked meal | Mira |
| Twist | The way to the cure is a maze of moving spirit traffic | Jay |
| Climax | The troll needs his 100 years of friends remembered out loud | Sam (his *character* gives the speech; Sam just picks what it says) |

## Why it helps with judges
- **Meta (connection 30%):** built from real people, ends with a real plan to meet. Works for strangers too (dorms, clubs, first week of class), and judges are mostly strangers to each other, so the demo shows it happening.
- **SerpApi:** two engines with a real role (News for the problem, Events for the side quest).
- **Originality:** not "an AI Dungeon Master" but "your real selves meet your real city".

## Build estimate
| # | Change | Effort | Where |
|---|---|---|---|
| 1 | Real questions → power and weakness on the card | ~2 h | `prompts.ts` card schema, `Phone.tsx` join screen |
| 2 | Quest picks the best-fit headline and writes one spotlight per player | ~1.5 h | `prompts.ts`, `host.ts` quest step |
| 3 | Reveal line naming each player's real quality | ~0.5 h | `prompts.ts` epilogue, `TV.tsx` reveal |
| 4 | Group side quest from shared interest + SerpApi Events | ~2 h | new cached route, epilogue |
| 5 | Local-first news (city → state → national) | ~1 h | `server/news/sources.ts` |
| Stretch | Real public places as quest locations | ~2 h | `prompts.ts`, `host.ts` |

About 7 h without the stretch. **Suggested cut order if time runs out:** 1 → 2 → 3 → 4 → 5 → stretch (stop wherever the clock says).

## Flaws and fixes
🔴 could break it · 🟡 will hurt if ignored · 🟢 minor

| | Flaw | Fix |
|---|---|---|
| 🔴 | Forced fit: random skills + random headline often feels cheesy | Let Muse choose the best-fit headline from a pool; allow metaphorical uses; playtest 20+ random combos |
| 🔴 | Spotlights could make someone face a real fear in public | Weaknesses are comedy in the fiction only; never a real-life action |
| 🔴 | Kids or strangers told to meet up | Side quests are **group-only**; all-ages events only; never a stranger pair alone |
| 🔴 | Scene art can't be pre-painted if quests depend on the party (~23 s per scene) | Keep scene images generic to the headline (pre-paintable); personal touches in text and portraits only |
| 🔴 | Not enough hours alongside the urban fantasy polish and other fixes | Use the cut order above |
| 🟡 | "Good at / scared of" is shallow; people joke; close friends already know | Example chips that steer toward specific answers; the optional third question goes a bit deeper |
| 🟡 | Side quest has too little data, so the AI invents common ground | Ask "What could you talk about for hours?"; only match on what people actually said |
| 🟡 | Pairing leaves someone out with odd numbers | One group side quest, not pairs |
| 🟡 | Personal info (fears, places) lands in a shareable storybook | Public places only; keep fears out of the shared version; ask before including anything personal |
| 🟡 | Local news pool is thin and often crime or politics | City → state → national fallback; cache good quests ahead |
| 🟡 | Fallbacks lose the personal touch exactly when Muse is slow | Seed quests and canned lines get slots ("{player} uses {power}…") filled by code |
| 🟡 | "Did you do your side quest?" needs storage; shelf is per-browser today | Store in Supabase, or mock the next-game-night screen for the demo |
| 🟡 | Pitch gets crowded again | One hero moment: the reveal line naming everyone's real qualities |
| 🟡 | Judges may give guarded or joke answers | Teammates answer first with fun, real ones to set the tone |
| 🟡 | Can't show "meet again" in 4 minutes | Pre-made "next game night" screen showing a completed side quest |
| 🟢 | SerpApi free plan is 250 searches/month, 50/hour, and this uses two engines | Cache everything; ask the SerpApi booth for credits |
| 🟢 | Longer prompts mean slower, flakier calls | Keep strict schemas and existing timeouts |

## Decisions for the creative director
1. Adopt the loop at all, or keep invented heroes?
2. Side quests group-only? (Recommended: yes.)
3. Reveal as proof rather than surprise? (Recommended: yes.)
4. Scene art stays generic to the headline? (Recommended: yes.)
5. Cut order if time runs short.
