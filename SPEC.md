# Once Upon a Roll: Build Spec v1

**One line:** Nobody has to be the Dungeon Master anymore. A co-op fairytale D&D night where every quest is today's real news, told as a fairytale.

**Tracks:** Meta, Most Entertaining, SerpApi. Best Overall and Best Novice are considered automatically.

Details live in `design/01`–`04`. This file is the source of truth wherever they disagree.

## The game
- **Setup:** the laptop or TV is the table. Phones are character sheets and controllers. Players join with a room code or QR code. 2–6 players, co-op against the world.
- **Character:** a one-line concept → Muse Spark builds a card → Muse Image paints a portrait.
  - Stats are Brave, Clever and Charming, set to +3, +1 and −1.
  - Each card has 1 Ability (once per tale), 1 Flaw, a Heart, and a roast line.
- **Quest:** a real headline from SerpApi Google News goes through a two-stage tragedy filter, then becomes a fairytale quest seed with threat, goal, locations, 3 complications, and the real story.
- **Round loop, "Pitch → Verdict → Pick → Roll":**
  1. Everyone pitches at once by typing or voice (20 s).
  2. The AI rates each pitch as it arrives: Clever +3, Solid 0, Risky −3, Absurd −6, or Miracle (nat 20 only).
  3. The Pitch Wall shows every pitch on the TV, and players vote (not for their own).
  4. The winner rolls a d20.
- **Roll math:** total = d20 + stat + tier modifier.

  | Roll | Result |
  |---|---|
  | Natural 1 | Catastrophe, plus a Shame Title |
  | 2–9 | Fail |
  | 10–14 | Yes, but (works at a cost) |
  | 15+ | Success |
  | Natural 20 | Legendary, plus a Glory Title |

  An Absurd pitch that scores 15+ counts as Legendary.
- **Shared resources:** a Hope meter for the party. Each player can spend their Heart on a **Catch!** to reroll a friend's failed roll. Advantage when 75% or more of votes agree, or when a player uses their Ability.
- **Rescue Round:** a natural 1 that isn't Caught leaves the hero **In Peril** (the narrator sets it up, e.g. "fell in the river, sharks circling").
  - The next round becomes a rescue: the other heroes pitch rescue plans, and **the hero in peril picks the winning pitch** instead of a party vote.
  - **Success:** the hero is rescued and the rescuer earns a Savior title (e.g. "Shark-Puncher").
  - **Fail:** −1 Hope and comic escalation.
  - In Quick Tale, the rescue replaces that scene's normal round, so there's no extra time.
- **Bookshelf:** each finished storybook is saved to the party's shelf ("The Cousins, Book 3"). The ending shows "Chapter 2 unlocks next week."
- **Quick Tale (judging), about 4 minutes:** Hook scene, then Twist scene, then the climax, which is a **Final Roll** where everyone rolls together.
- **Ending:** a streamed epilogue, then the **newsprint reveal** ("This tale was inspired by real events…" with the real headline, source and a QR link), then a shareable storybook.

## Decisions (resolving conflicts between the design docs)
- **Name: Once Upon a Roll.** Docs 01 and 02 say "Once Upon a Headline"; ignore that.
- **Verdicts run per pitch as each arrives** (doc 03), not batched (doc 01). Code derives the DC as 15 − the tier modifier, so the stamp reads, e.g., `RISKY · DC 18`.
- **Dice:** the table (TV) pre-rolls each die with the browser's cryptographic RNG. The AI never touches numbers.
- **Room sync:** Supabase Realtime. The TV browser runs the game; phones send inputs. AI calls go through Next.js API routes so keys stay on the server.
- **AI:** `muse-spark-1.3` with strict JSON schemas, `muse-image-1.0`, and `muse-voice-transcribe-1.0` (push-to-talk, sending a file to `/asr/transcribe`). Never use `-contributor` models. Fallbacks: Gemini, then canned text. The TV is never idle for more than about 3 s.
- **Art: "Illuminated Storybook."** Parchment and ink, gilt accents, a midnight frame. Fonts are Cinzel Decorative, Cinzel, EB Garamond and Alegreya Sans. Use one image style string for every image.
- **News:** pre-generated and cached, so there are no API calls on the critical path. Five demo quests are already written in `design/02` and ship as `seed_quests.json`.
- **Hooks:**
  - **Voice actions:** stretch item #1.
  - **Weekly saga:** v1 only shows a "Chapter 2 unlocks next week" teaser and stores the party. The full system is cut.

## Milestones
| # | Milestone | Done when |
|---|---|---|
| M1 | Rooms | TV lobby with code and QR. Phones join and appear live. |
| M2 | Characters | Concept → card on phone and TV (text first, portrait async). |
| M3 | Core loop (text only) | Seed quest → scenes → pitch/verdict/vote/roll/Catch → Final Roll → epilogue. **Playable end to end.** |
| M4 | Deploy + soft submit | Live on Vercel, Devpost draft submitted by **11:30 PM Saturday**. |
| M5 | Images | Portraits, scene plates, cover. |
| M6 | News pipeline + reveal | SerpApi → filter → seed. Newsprint reveal and storybook page. |
| M7 | Juice | d20 animation, nat 1/20 effects, reactions, sounds, page turns. |
| M8 | Voice | Push-to-talk pitches. |
| — | Freeze | **Sunday 10 AM**, then backup video, final submit 11:30 AM, rehearse. |

## Open items
- [ ] Keys in `.env.local`: Muse, SerpApi, Gemini, Supabase.
- [ ] Test Meta's unverified behavior (design/03 §10): image sizes, latency, streaming plus JSON.
- [ ] Check the Porter bridge quest facts against the real article before demoing it.
- [ ] Ask Meta's table: does every top-3 team get the Menlo Park invite? Any credits?
