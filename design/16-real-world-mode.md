# 16 - Real World mode (future work): design + guardrails

**Status: pitched, NOT built.** Tonight's build uses only eerie, harmless news (`design/02-news-to-quest.md`). Nothing below is claimed as shipped. A Meta employee said it is possible, judges will ask, and it needs guardrails.

**Why:** the creative director believes people bond over real things, and that scary real problems are OK to discuss if the frame is "what would *we* do?" 40% of people sometimes or often avoid the news, and younger people feel powerless about big issues (Reuters Institute DNR 2025: https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2025/dnr-executive-summary).

## 1. The experience (6 bullets)
1. **The whole group opts in at the lobby.** Default is off. Every phone must tap "Yes, we're up for a real one"; one "not tonight" from anyone cancels it. Under-18 or unknown-age tables never see the option (age gate).
2. **Pick from 3 "Real World" cards,** each with a one-line content note ("about: drought and water supply; no injuries shown"). Any player can tap **Skip this story** at any moment, no reason asked, and the table swaps to a harmless tale.
3. **Tone shift.** The DM is respectful, plain and warm. Fantasy stays in the costumes (the party is a "Round Table of fixers"), but there is **no supernatural villain standing in for real suffering**. The antagonist is an abstract force (time, scarcity, misinformation, red tape), never a group or a person.
4. **The question is constructive:** "With every resource in the world, how would your group solve this?" Players plan and divide jobs, turning to each other, not the screen. The AI judges ideas, never people.
5. **The story follows helpers and solutions:** engineers, nurses, volunteers, farmers, the people already working on it, shown as competent. Hope comes from real kinds of response, not magic.
6. **It ends with real resources:** the reveal shows the real headline and source, plus 2-3 vetted ways to help or learn more (a reputable agency page, a charity, a local volunteer route), then a cool-down: Mirror, Mirror (one kind sentence about a friend).

## 2. Guardrails

| Never allowed | Enforced by | DM's Notes shows |
|---|---|---|
| **Named victims** (any private individual, any minor) | Stage B classifier field `private_individuals` must be false and `people_named` empty in the fiction; Stage C lint strips names; prompt rule | Names removed and why |
| **Ongoing mass-casualty events in the first 72 h** | Stage A hard-block plus a new `event_age_hours` and `ongoing_casualties` schema field; Real World cards need age >= 72 h **and** a human approver | Event age, "cleared by: <human>" |
| **Graphic content** (gore, method, cause of death) | Keyword block; classifier `graphic_risk` score must be low; image prompt bans realistic bodies and uses the cartoon style only; output lint | Graphic-risk score |
| **Blaming a group** (nation, religion, party, class, ethnicity) | Prompt rule "the problem, not the people" (already in 02); lint on demonyms and group terms; cause is always a system or process | Cause = "<impersonal force>" |
| **Medical or financial advice** | Prompt rule + output lint for "you should take/buy/invest"; resources list links only to vetted public agencies; fixed line "We're a game, not advice" | Flags if the lint fired |
| **Forcing anyone through it** | Whole-table opt-in, age gate, one-tap Skip (instant swap, no explanation), content note before, no warning-only reliance (see sec. 4) | Opt-in tally, skips used |
| **Unreviewed heavy stories** | Human-review queue: every Real World quest sits at `status=needs_review` until a person approves; no live news goes to a table unreviewed | Reviewer + timestamp |
| **Invented facts** | Neutral `the_real_story` line, source URL and date mandatory; `mapped_from` for every element (existing schema) | Each element mapped to its real fact |

If any check fails, the table gets a harmless seed quest. The mode is off in the demo build.

## 3. Likely judge questions (short, honest answers)
1. **"Isn't this exploiting real suffering for entertainment?"** A real risk, which is why it isn't in tonight's build. The design centers the *response* (helpers, solutions), bans victims and graphic content, and ends in real ways to help. We would not ship without the review queue.
2. **"What if someone in the room is personally affected?"** We can't know. So: whole-table opt-in, content notes, one-tap Skip, no pressure to speak. Warnings alone don't help much (sec. 4), so control carries the weight.
3. **"Can the AI get it wrong?"** Yes. So a human approves every heavy quest, DM's Notes expose every mapping, and failures fall back to a harmless tale. We have not tested any of this on heavy news yet.
4. **"Why would a game help with real problems?"** We don't claim it solves anything, only that it makes talking about them easier and less lonely. Evidence is suggestive, not proven (sec. 4).
5. **"Why not just stay with harmless news?"** We do, by default. The mode is optional: real things bond people, and many avoid news because it feels hopeless. Constructive framing is the bet to test.

## 4. Evidence, with limits
- **Constructive journalism:** 13 of 14 mood studies found more positive or less negative emotion; "likes" rose, sharing did not; behavior and trust evidence is thin (review of 18 studies: https://constructiveinstitute.org/research-overview-effects/). Promising for mood, unproven for action.
- **News avoidance:** 40% avoid the news at least sometimes (Reuters DNR 2025, link above).
- **Shared pain bonds groups, mixed replication:** https://www.unsw.edu.au/newsroom/news/2014/09/shared-pain-brings-people-together; a hint, not proof.
- **Trauma-informed design:** SAMHSA's six principles (safety; trustworthiness and transparency; peer support; collaboration and mutuality; empowerment, voice and choice; cultural, historical and gender issues; summary https://opentextbc.ca/peersupport/chapter/samhsas-six-principles-of-trauma-informed-care/). Mapping: opt-in and Skip (choice), DM's Notes (transparency), the group (peer support).
- **Content warnings** do not reduce distress and slightly raise anticipatory anxiety (12-study meta-analysis: https://www.psychologicalscience.org/news/2023-october-content-warnings-distress.html). So: brief neutral content notes plus real control (Skip), not alarming banners.
- **Precedents:** *World Without Oil* (https://cdn.itvs.org/world_without_oil_update-pressrelease.pdf), *Superstruct* (https://en.wikipedia.org/wiki/Superstruct), *Fate of the World* with Oxford climate modelling (https://innovation.ox.ac.uk/?p=8550), *This War of Mine*, which raised over $500,000 for War Child (https://www.pcgamesinsider.biz/news/68284/this-war-of-mine-raises-half-a-million-dollars-for-uk-charity-war-child/). Lesson: respectful, expert-informed, tied to real help. No wellbeing outcome data found.

## 5. Example quest outline (generic): "The Long Dry"
**Real topic (generic):** a multi-year drought putting pressure on a region's water supply. No event less than 72 h old, no casualties, no named people or places.
- **Premise:** the Round Table of fixers is called to a thirsty valley. The threat is not a monster but Scarcity itself, shown as a slowly emptying well.
- **Scene 1 (hook):** secret phone clues (crop schedule, hydrologist's map, budget, rumor) force talking.
- **Scene 2 (twist):** the obvious fix (a bigger pipeline) causes a new problem downstream. Players must weigh fairness, cost and time, and the DM praises ideas that share the burden.
- **Scene 3 (climax):** a Final Roll on the group's combined plan: leak repair, reuse, smarter irrigation, community water-sharing. The dice are real; every outcome leaves the valley better, differently.
- **Reveal:** "This is a real, ongoing challenge." Shows the source, then 2-3 vetted links (a public water agency, a conservation charity, tips to cut household use) and a Mirror, Mirror kind-sentence round.
- **DM's Notes:** event age, cause = "scarcity (impersonal)", cleared by <human>, 0 skips, 0 flags.

*Next step:* prototype the review queue and `event_age_hours`, then test with volunteers (opt-out, debrief) before any public use.
