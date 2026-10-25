# 32: Persona simulation, 100 simulated players (Sun ~2 AM)

**Caveat: this is a simulation, not real users.** One model (muse-spark-1.3, reasoning low, 10 calls of 10 personas + 1
clustering call) role-played 100 personas reading the same written experience. It is good at spotting friction that's
already visible in our own screens and recordings. It can't tell us what's actually fun. It also tends to stereotype
(every AI skeptic scored 1-2) and gets harsher when told to be critical. Read it as a ranked list of risks, not a forecast.

**Input:** an experience transcript of one 3-player Quick Tale (lobby → join → story pick → 3 turns → finale → reveal),
built from the final lobby and tvskin screenshots, the gallery, the phone shots, code timers (`lib/quick.ts`, `host.ts`) and the
real narration and screens from the CD's latest playtest (rec0537, "The Five Dollar Timer"). One accuracy note: **Quick Tale +
Odd News has no story vote** (the story is picked during the lobby), so only Our Stories has one. Scripts and raw output:
scratchpad `persona/` (`sim.py`, `raw.json`, `clusters.json`).

## Headline numbers

| Segment (n) | Replay /10 | Would talk to neighbors | Recommend yes / no |
|---|---|---|---|
| Kids & teens (7) | **8.0** | 86% | 57% / 0% |
| Mixed, shy & outgoing (5) | 6.4 | 60% | 40% / 20% |
| College friends (7) | 5.7 | 86% | 14% / 14% |
| Jackbox & party gamers (7) | 5.3 | 100% | 29% / 43% |
| Hackathon judges (10) | 5.2 | 60% | 20% / 10% |
| Meta judges (10) | 5.1 | 60% | 30% / 20% |
| Older adults (5) | 4.8 | 80% | 60% / 40% |
| Families (7) | 4.7 | 57% | 0% / 14% |
| Coworkers / D&D fans / non-native English (7 each) | 4.6 | 43% / 100% / 57% | 14/29, 29/57, 0/0 |
| Neurodivergent (7) | 4.4 | 57% | 14% / 29% |
| Non-gamers (7) | 3.3 | 29% | 0% / 57% |
| AI skeptics (7) | **1.6** | 86% (mostly to complain) | 0% / 100% |
| **All 100** | **4.9** (median 5) | **68%** | 21% / 30% |

People who talked to their neighbors rated replay **5.3**; people who didn't rated it **3.5**. The connection loop works
when it fires. Losing people happens in the dead time between those moments.

**Judge scores (Meta rubric, mean ± SD, range):**

| | Connection /30 | AI /25 | Originality /20 | Demo /20 | Total /100 |
|---|---|---|---|---|---|
| Meta judges (10) | 17.1 ± 3.5 (12-23) | 12.9 ± 2.3 (8-16) | 11.6 ± 2.2 (7-15) | 14.2 ± 1.8 (10-17) | **55.8 ± 8.5 (37-67)** |
| Hackathon judges (10) | 18.2 ± 3.0 (14-24) | 13.0 ± 2.0 (10-18) | 11.6 ± 1.7 (9-15) | 13.6 ± 1.4 (11-16) | **56.4 ± 7.4 (46-73)** |

That's well below our own ~78 estimate (design/25). The weakest areas relative to their max are **AI (52%)** and
**originality (58%)**. Representative judge lines: "AI feels like narration skin over dice", "Meta integration is
asserted, not shown", "co-located but not present: half the game our phones are dark", and "the best connection beat
is using a friend's idea for +1 and the joint shake".

## Top 10 confusion points (frequency out of 100)
1. **Phones go dark ("HERE IT COMES" / "HERE'S WHAT HAPPENED") during narration, rolls and outcomes**: 26 (6 judges)
2. **Timers too short for typing, reading and the 12 s finale vote** (slow typists, kids, ESL, seniors): 12
3. **Narration repeats details** ("the chess piece rattles" ×4), turns feel like they change little, and the ending is a non sequitur: 12 (6 judges)
4. **The dice math is unexplained** ("d20 +2 Charm +1 idea −5 wild = d20 −2", tiers, the 1-20 bar): 11 (D&D fans and non-gamers most)
5. Narration is hard to follow: fast voice, music over the voice, captions out of sync, small goal text: 5
6. Spotlight anxiety: timed improv in front of others (shy players, introvert coworkers): 4
7. The shake-to-roll gesture is confusing or awkward (seniors, dyspraxia): 4
8. Distrust of AI or Meta, plus privacy of Our Stories (where do secrets go?): 6
9. Soft stakes: one die decides the finale, "WELL, IT'S A STORY" reads as a vague loss, and there's no winner: 3, plus 7 who asked for points
10. Sensory overload, and "SIGNAL LOST" is mistaken for a real disconnect: 3. Slang and idioms confuse ESL players: 3

## Top 10 delights (best moment, coded)
Finale shake-together die + battle cry **17** · friend's idea credited on TV / "back a friend's plan" **16** ·
true-story reveal (clipping vs your version) **12** · heroes painted into each new scene **9** · Natural-1 disaster **7** ·
clear rule beats (tier stamp, one action, DM's Notes) **6** · hero cards and weakness lines **4** · keepsake **4** ·
captions and hold-to-speak **4** · "Because of you" montage / the live-news hook **2**. Nothing delighted 17 people.
**Laugh lines:** the Natural-1 pocket critter (22), hero bios like "abandons any post for a dropped pretzel" (17), the
"late bell" ending (10, even though others called it nonsense), the bike chase (10), "WELL, IT'S A STORY" / SIGNAL LOST (10). 30 never laughed.

## Top 10 requested changes
Keep phones active during narration **11** · cut narration repetition and length **11** · longer timers **11** ·
bigger text, read-aloud, louder/slower captions **10** · bigger groups / remote play **10** · show the DM's reasoning on
the TV **9** · a clear winner or stakes **7** · explain dice and tiers plainly **7** · shy-friendly options (pass,
anonymous suggestions) **6** · calm mode / tap instead of shake / plain English **5 each**. (8 skeptics asked to remove
AI or Meta. No tweak fixes that.)

## The 3 changes that would move the most people
Ranked by how many personas flagged the problem (confusion or requested change), then by judge weight. Together they
cover **62 of 100**.
1. **Phones never go fully dark (26 people, 6 judges).** During narration and rolls, give each phone something light that
   pulls attention back up to the TV, not down: the caption line, a "call it!" guess (high or low?) before the die lands, and
   reactions that pop on the TV. The next owner can also see suggestions arriving early. *CD call:* this has to stay
   glanceable. One Meta persona's complaint was the opposite ("keep eyes on the room").
2. **Readable pacing (24 people).** Give typing 45 s (it still ends early when everyone's done), give the finale vote 20 s, use
   bigger captions, duck the music harder under the narrator, and add a tap option next to shake.
3. **Tight, non-repeating narration (20 people, 6 judges).** Outcomes in at most 2 short sentences. Never repeat a prop the
   previous line already used. The ending must follow from the winning plan. This is a prompt and eval change
   (`prompts.ts` OUTCOME, `scripts/story-evals.mjs`), so it's cheap.

Close 4th (20 people, 5 judges, lowest replay at 4.3): **say the dice math in words** ("Wild plan: harder, −5. Sam's
idea: +1.") and make the finale result a clear win or loss. For the judge demo, the cheapest AI-score lift is to open
DM's Notes for one beat and say "Muse judged this plan, Muse wrote this, Muse painted this".
