# 11 — Interactivity: what players physically and socially DO

Research and design pass, 2026-10-24. Scope: verbs, not prose. DM craft, AI voice and pacing/fairness live in other docs.

**The playtest complaint:** "We didn't really do much other than answer like 3 questions and roll dice."

**Diagnosis from the code.** A round today is `narrating (7–16 s) → pitch 25 s → vote 12 s → roll 10 s → tumble 1.8 s → catch 6 s → outcome ~8 s`, about 73 s.
Each player gets two verbs (type, vote), and one player also taps ROLL. Everyone else watches the last ~25 s, with a reaction bar that changes nothing. A losing pitcher has no further way in. That is the "my idea wasn't selected" sting, and even trivial exclusion hurts (Williams et al. 2000, doc 05 A1).

---

## 1. What makes these games feel interactive

| Game | Lesson for us |
|---|---|
| **Jackbox** ([GDC listing](https://gdcvault.com/play/1027202/), [Built In](https://builtin.com/media-gaming/jackbox-games-design-party-pack)) | Each phone shows something only its owner sees, and there is one task at a time. Watchers always hold a lever that matters: Quiplash's Audience vote decides winners ([PS Blog](https://blog.playstation.com/?p=158077)). |
| **Keep Talking** ([GDC 2016](https://gdcvault.com/play/1023113/Designing-Asymmetric-Gameplay-For-Keep)) | Split the information, and talking becomes the game. Kane calls it a game about communication between players. |
| **Spaceteam** ([making-of](https://episodiccontentmag.com/2016/01/29/everybodyshake2/)) | Information that belongs to someone else, plus time pressure, makes people shout without any extra rules. Shaking the phone works as a team verb. |
| **WarioWare** ([Iwata Asks](https://iwataasks.nintendo.com/interviews/ds/diy/0/2)) | Physical actions last 4–8 s and use one instantly readable verb. |
| **Mario Party** | Moments where everyone acts at once pay back the dead time of a solo turn. |
| **Werewolf / Among Us** | Hidden information triggers persuasion. Secrets create talk even without betrayal. |
| **Wavelength / Dixit** ([Wavelength](https://en.wikipedia.org/wiki/Wavelength_(game))) | One player holds private knowledge, and the group argues over what it means. |
| **Telestrations** | Your own words, transformed in public, are the funniest thing in the room. Quote players verbatim. |
| **D&D tables** ([Help action](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat#Help), [Sly Flourish on the spotlight](https://slyflourish.com/track_turns_the_shadowdark_way.html)) | Anyone can lend aid, and good DMs rotate the spotlight. Losing the vote must not mean leaving the scene. |

Sources were checked on 2026-10-24. The GDC Vault was in maintenance mode, so its listings were confirmed through search.

---

## 2. Eight story-tied mechanics

Hours assume the existing `GameHost` phases, `MicButton`, realtime broadcast and `SceneOpen` JSON.

### M1. Secret Sight: each hero sees a different piece of the scene
- **TV:** the scene as normal, plus a row of sealed "eye" icons, one per hero. An eye turns gold when a pitch uses that hero's clue, and the pitch card gets a `🔍 used Mira's clue` tag.
- **Phone:** during narration it buzzes and shows a private card tied to the hero's best stat, with the line "Only you see this. Tell the table, or don't." For example:
Brave: "The troll's left knee is bandaged." Charming: "It's humming a lullaby." A tap inserts the clue into your pitch as a chip.
- **Rule:** a pitch that uses any hero's clue is eligible for **Clever (+3)**. One clue per scene is secretly a real detail from the news story, and the headline reveal shows which one: "Mira's clue was the real $4M repair shortfall."
- **Time:** 0 s. It is read during narration, which already exists.
- **Bonding:** information interdependence (Depping & Mandryk 2017, doc 05 C). It also fixes "hard to follow," because the story gets retold out loud by people instead of read off a screen.
- **Build:** 2–3 h: `secrets:[{hero_id, clue, is_real}]` in the existing scene call (no new latency), passed into the verdict, plus canned clues for the 5 seed quests.
- **Demo fit:** excellent. Judges see three phones showing different text.

### M2. Lend a Hand: the D&D Help action
- **TV:** after the vote, the winner's portrait appears center stage. Helper portraits slide in beside it as their lines arrive, each with a speech bubble ("Hold its other leg!") and a `+1 HELP` chip. The math line grows: `14 + Brave 3 + Clever 3 + Help 2`.
- **Phone (everyone but the roller):** a 9 s card: "Help Reginald? Hold to say how." It has hold-to-talk plus 3 one-tap chips (for example "Distract it," "Boost him up," "Cheer").
- **Rule:** each helper gives +1, up to +2. The cost is that helpers stand in the blast radius: on a Fail, the complication names them too.
- **Payoff:** the outcome narration must quote every helper's line verbatim.
- **Time:** 9 s, replacing today's 10 s of idle "X is rolling…".
- **Bonding:** Ben Franklin effect and gratitude (Jecker & Landy 1969; Algoe 2012), shared risk (Bastian et al. 2014). A losing pitcher is back in the scene 10 s later.
- **Build:** 4–5 h: an `assist` phase, `makeRoll`/`fetchOutcome` moved after it, and `helpers:[{hero,line}]` in the outcome prompt.
- **Demo fit:** excellent. It is the clearest "everyone is playing" beat.

### M3. Battle Cry: in-character voice, woven in verbatim
- **TV:** the roller's shout fills the screen in a huge Cinzel speech banner as it is transcribed (~1.3 s), and the narration quotes it exactly.
- **Phone (roller):** "Shout your battle cry!" with hold-to-talk, for up to 4 s, during the same window as Lend a Hand.
- **Time:** 0 s, because it runs in parallel with M2.
- **Bonding:** mimicry and shared laughter (Gray et al. 2015). Observers read vulnerability as courage (Bruk et al. 2018). Verbatim human lines counter "obviously AI."
- **Build:** 1–2 h. `MicButton` is already built, and the line is one extra field in the outcome input.
- **Demo fit:** great for the Meta voice track.

### M4. Rally the Roll: shake and brace
- **TV:** the d20 tumbles for 3 s instead of 1.8 s. A row of hands lights up, one per phone currently bracing, while a rope or bridge sound effect creaks. If the party holds, the die lands with "THE PARTY HOLDS +1."
- **Phones:**
  - **Roller:** shakes the phone to roll (DeviceMotion, with tap as a fallback).
  - **Everyone else:** holds a giant **BRACE** button with a thumb, with vibration feedback.
- **Rule:** the brace count is sampled at 2.0 s. If at least all non-rollers minus one are bracing, the roll gets +1. Failure only happens when someone isn't paying attention, which is exactly what gets the table shouting "HOLD IT!" (as in Spaceteam).
- **Final Roll:** everyone shakes at once.
- **Time:** +1.2 s.
- **Bonding:** synchrony increases prosociality (Mogan et al. 2017; Tarr et al. 2016). Collective effervescence (Páez et al. 2015).
- **Build:** 2–3 h. iOS needs `DeviceMotionEvent.requestPermission()` from a tap, so request it on "Join the party".
- **Demo fit:** excellent, and very visible on camera.

### M5–M8: considered, not in the top 3

**M5. Fork in the Road.**
- **TV:** between scenes, the map shows two pins with risk tags drawn from the quest's complications.
- **Phones:** 6 s to tap a path, shown as a live tug-of-war. A tie means **Split up**, and the next pitches run in two pairs.
- **Time:** +6–8 s per scene.
- **Bonding:** joint decisions (Tomasello et al. 2005).
- **Build:** 3 h.
- **Demo fit:** weak. It adds time and a third vote.

**M6. Parley.**
- **TV:** the NPC card from the existing `npc_line`, with "the troll is listening…".
- **Phones:** the first player to grab the Talking Stick asks one question aloud. Muse Spark answers in character with a usable hint.
- **Time:** 6–9 s.
- **Bonding:** shared attention (Shteynberg 2015). It also helps comprehension.
- **Build:** 3–4 h, for a new `npc` AI kind.
- **Demo fit:** risky. The chain of ASR, then Spark, then reading can leave about 5 s of dead air, and only one player is active.

**M7. The Satchel.**
- **Story:** outcomes can award a story item, such as the Troll's Spare Sock.
- **Phones:** **Use** it in a pitch (Clever-eligible), or **Give** it to a friend's phone.
- **Bonding:** callbacks and gifts build shared reality (Rossignac-Milon et al. 2021).
- **Build:** 3 h.
- **Demo fit:** poor. Two rounds aren't enough to pay off an item.

**M8. Secret Wish.**
- **Phones:** each hero privately gets a story wish ("make the troll laugh").
- **TV:** wishes are revealed in the storybook, and each fulfilled wish earns a Glory Title. You get Werewolf-style scheming without betrayal.
- **Time:** 0 s.
- **Build:** 2 h.
- **Demo fit:** medium. It suits Full Tale better.

---

## 3. Recommendation: the top 3

1. **Secret Sight (M1).** Everyone has something to say *before* pitching. It fixes "hard to follow" and takes 0 s.
2. **Lend a Hand + Battle Cry (M2 + M3, built as one phase).** Every player speaks into the story each round, and those words appear verbatim. It fixes "my idea wasn't picked" and "felt AI."
3. **Rally the Roll (M4).** The roll becomes a group physical act, so the climax of every round is shared.

Together they give every player a verb every 10–20 s across three channels: talk (clues), voice (help lines and battle cries) and body (shake and brace). The round still fits in about 72 s, because the new beats replace dead waiting instead of adding phases.

**Hold for Full Tale:** Parley (M6) first, then Secret Wish (M8), Fork (M5) and Satchel (M7).

---

## 4. Exact per-round flow (Quick Tale, 4 heroes)

| t (s) | Phase | TV | Roller's phone | Everyone else's phone |
|---|---|---|---|---|
| 0–10 | **Narrate + Secret Sight** | Scene art and narration. A row of sealed eyes, one per hero. | *Buzz.* Private clue card: "Only you see this." | Same, with each player's own clue. The table starts comparing ("mine says it's humming?"). |
| 10–30 | **Pitch** (20 s, was 25 s) | Pitch Wall fills live. Tier stamps slam as each pitch arrives. 🔍 tags show on pitches that use a clue. | Type or hold-to-talk. 🔍 inserts the clue chip. Ability and Flaw toggles. | Same. |
| 30–40 | **Vote** (10 s, was 12 s) | Live vote counts. "The Party Believes!" appears at 75% agreement. | Vote (not for your own pitch). Team-up option. | Same. |
| 40–49 | **Lend a Hand + Battle Cry** (9 s) | Winner center stage. Helper portraits pop in with speech bubbles and `+1 HELP` chips (max +2). The battle cry fills a banner. The math line updates live. | "Shout your battle cry!" with hold-to-talk (≤4 s). Then the **SHAKE TO ROLL** card appears, ready. | "Help Reginald? Hold & say how" (≤6 s), or tap a chip. Tap "Stay back" to opt out of the blast radius. Ends early once everyone has acted. |
| 49–52 | **Rally the Roll** (3 s tumble) | The roller's shake launches the d20, which also auto-launches at 49 s. A hand row lights up per bracing phone with a creak sound effect. At 2.0 s the brace count is sampled and, if it passes, "THE PARTY HOLDS +1" appears. The die lands with full math. The outcome request fires at the 2.0 s sample. | Shake (or tap). | Hold **BRACE** (vibration pulses while held). |
| 52–58 | **Catch!** (fail only, 6 s) | Pulsing "Can anyone catch Reginald?" Helpers are visibly in the blast radius. This window hides outcome latency. | Watch. | A Heart-holder slams CATCH!, and the reroll repeats the 3 s Rally. |
| 58–72 | **Outcome** (~10–14 s) | Narration quotes the battle cry and every help line verbatim, with helpers named in success and failure alike. Titles stamp. Hope changes. | Reaction bar. Tap **Thank** to send ♥ to a named helper. | Reaction bar. Tap **Thank** on a helper. Thanks counts feed the storybook's "Best Friend" award. |

**Totals:**
- **No Catch:** about 66 s.
- **With Catch:** about 72 s, up to 75 s with a slow outcome.
- **Today:** about 73 s.

**Longest idle gap per player:** about 9 s, during outcome reading, and even then the Thank and reaction buttons are live. The roller and helpers are active from 0 to 52 s without a gap.

**Final Roll:** every phone shows **SHAKE** at once and all dice tumble together. Best die plus Hope counts, and a full-party shake within one second adds Rally +1. Help lines from both rounds replay as a caption montage.

**Edge cases:**
- **Rescue Round:** the hero in peril cannot pitch, but **can** Lend a Hand to their own rescuer by shouting encouragement, so the victim still speaks.
- **Two players:** Help is capped at +1, and Rally succeeds if the one other player braces.
- **Nobody helps:** "Reginald goes alone…" plus a sad trombone, which teaches the mechanic for next round.

---

## 5. Build plan

| # | Task | Hours |
|---|---|---|
| 1 | Secret Sight: add `secrets` to scene schema and prompts. Canned clues for the 5 seed quests. Verdict sees the clues. Phone card and chip. TV eyes and 🔍 tag. Reveal ties the real clue back to the headline. | 2.5 |
| 2 | `assist` phase. Help text or voice capture. Battle cry. Move roll creation and outcome fetch after assist. Outcome prompt rule: quote `helpers[]` and `battle_cry` verbatim, ≤12 words each. Name helpers on Fail. | 4.5 |
| 3 | Rally: DeviceMotion with permission requested on the Join tap (tap fallback). `brace` hold messages throttled to state changes only. 3 s tumble. +1 math chip. Final Roll shake. | 2.5 |
| 4 | Thank button and "Best Friend" storybook award, reusing `reactionCounts` logic. | 0.5 |
| | **Total** | **~10 h** |

If time runs short, cut voice for help first (chips and text only), then shake (tap only), then Thank. Never cut Secret Sight: it is the cheapest change and the most legible to judges.

**Balance note for the pacing/fairness agent:** the social bonuses stack to at most +3 (Help +2 and Rally +1). If playtests show more than 60% of rolls succeeding, shift Success to 16+ instead of weakening the social levers.
