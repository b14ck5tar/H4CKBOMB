# 01 — Game Rules & Core Loop

Working title: **Once Upon a Headline**. Co-op, 2–6 players, one AI Dungeon Master.
Design goals, in priority order: **laughter > table talk > pace > depth.**

---

## 1. Turn structure: "Pitch, Pick, Roll"

**Decision:** everyone pitches at once, the party votes on one pitch, and the person who wrote it rolls. This is the creative director's "choose the best action, then the AI decides" loop, done in parallel so nobody waits for a turn.

| Step | Who | Timer (Quick / Full) | What happens |
|---|---|---|---|
| 1. Situation | TV | ~8s | DM narrates the problem. The scene image stays on screen. |
| 2. Pitch | All phones | 20s / 30s | Each player types or holds-to-talk one action. They can toggle **Use Ability** or **Embrace Flaw**. |
| 3. Verdict | AI, then TV | ~4s | **One batched Muse Spark call** rates every pitch: tier stamp, stat used, and a one-line DM quip. The Pitch Wall reveals them all at once. |
| 4. Pick | All phones | 10s | Everyone votes for one pitch, but not their own. Ties go to the better tier, then to whoever has been picked least. |
| 5. Roll | Winner's phone | 8s (auto-rolls if idle) | The winner taps a giant ROLL button. The d20 animates on the TV. |
| 6. Catch! | Other phones | 5s (failed rolls only) | A friend can spend their Heart to reroll (see section 6). |
| 7. Outcome | TV | ~8s | Narration streams in and the meters update. A new image appears on scene change. |

**Why this wins:** the Pitch Wall puts 4 ridiculous ideas on screen at once, so people read them out loud. Voting forces "no, mine is better" arguments, which is the table talk. Nobody is ever idle. A round takes about 50–60s.

---

## 2. Action adjudication

### Feasibility tiers (the AI's verdict)
The tier becomes a **modifier**, and the outcome bands stay fixed. Judges only need to learn one number line.

| Tier | Modifier | AI criteria | Stamp example |
|---|---|---|---|
| **Clever** | +3 | Uses the situation, a character's ability, or something set up earlier | "Annoyingly smart." |
| **Solid** | +0 | Reasonable and direct | "Sure, why not." |
| **Risky** | −3 | Possible, but has obvious ways to go wrong | "Bold. Possibly fatal." |
| **Absurd** | −6 | Physically or narratively ridiculous | "I respect the audacity." |
| **Only a Miracle** | — | Impossible. **Only a natural 20 succeeds.** | "Sure. Roll a 20." |

**Reward for absurdity:** if an Absurd pitch scores 15 or more, it counts as Legendary. If a Miracle pitch succeeds, it clears the scene outright. This is why groups will vote for the dumb idea.

**Total** = d20 + stat (−1 to +3) + tier modifier. The TV always shows the math, for example `14 + Brave 2 + Clever 3 = 19`.

### Advantage and disadvantage (roll 2d20, keep the higher or lower; they cancel each other)
- **Advantage:** "The Party Believes!" when at least 75% of votes go to one pitch, or when the player uses their Ability.
- **Disadvantage:** the AI flags that the pitch walks straight into the roller's Flaw without the player choosing to embrace it.

### Outcome bands
| Roll | Band | Narrative | Mechanics |
|---|---|---|---|
| **Natural 1** | **Catastrophe** | Spectacular, cartoonish doom ("burnt to a crisp, but your mustache survived") | −2 Hope, a complication, and the character earns a **Shame Title** ("the Singed") |
| **2–9** | **Fail** | The plan backfires in a way that makes sense | −1 Hope, a complication |
| **10–14** | **Yes, but…** | It works, at a cost | +1 Progress, then the AI picks −1 Hope *or* a complication |
| **15+** | **Success** | Clean win | +1 Progress |
| **Natural 20** | **Legendary** | The ability or plan works perfectly and heroically | +2 Progress, +1 Hope, a **Glory Title**, and the Ability recharges |

**Embrace Flaw:** a player who deliberately plays into their flaw gets **+1 Hope on any total of 10 or more**. This rewards roleplay and comedy.

---

## 3. Party resources and stakes

| Resource | Rules |
|---|---|
| **Hope** (shared party HP) | Starts at 3 in Quick mode and 5 in Full, with a max of 6. **At 0, the tale ends immediately in a "Grim Ending,"** which still produces a funny storybook. |
| **Progress** (per scene) | Quick: 1 round per scene. Full: a track of 3 per scene. A Full scene that isn't cleared in 4 rounds ends "the hard way" (−1 Hope, the story moves on). |
| **Hearts** | Each player has 1 per tale. Spent on Catch! rerolls. |
| **Final Roll** | The climax. **Every player rolls at the same time**, the best single die counts, and **remaining Hope is added as a bonus.** Earlier play feeds directly into the ending. |

**Endings** are set by the Final Roll total. **20 or more: Triumphant** (the realm is reconnected). **12–19: Bittersweet.** **Under 12, or Hope at 0: Grim but Hilarious.**

**Complications follow logically ("obvious in hindsight").** The DM prompt keeps a *consequence ledger*. Every Fail, Yes-but, or Catastrophe must create a complication that (a) names a specific detail from the failed action and (b) changes the next situation. Example: the party throws meat to lure the dragon, the roll fails, and now three hungry wolf packs show up too. Each scene also has one **pre-seeded twist**, taken from a real detail in the news story (for example, a monsoon delaying the repairs becomes a river spirit flooding the gorge). That keeps escalation tied to the headline.

---

## 4. Quest structure

The pipeline: SerpApi Google News → Muse Spark filters out tragedies (no deaths, disasters with victims, violence, or politics) → picks a fixable *problem* story → writes a fairytale quest with 3–4 scene beats → stores the real headline and link for the reveal.

| Mode | Scenes | Rounds | Length |
|---|---|---|---|
| **Quick Tale** (judging) | 3 scenes (Hook, Twist, Climax), **1 round each**, and the Climax is the Final Roll | 3 | ~4 min total |
| **Full Tale** | 4 scenes (Hook, Journey, Twist, Climax), progress 3 each | ~10–14 | 15–20 min |

**Quick Tale time budget:** join and concepts 45s (portraits generate in the background) → card reveal 20s → quest and map 15s → 2 rounds × 55s → Final Roll 30s → headline reveal and storybook 20s, for ≈ **3:50**.

---

## 5. Character card schema

The player gives a one-line concept. Muse Spark returns JSON, and Muse Image paints the portrait.

```json
{
  "name": "Sir Reginald Puddlewick",
  "epithet": "the Reluctant",
  "concept": "a cowardly knight allergic to dragons",
  "stats": { "brave": -1, "clever": 1, "charming": 3 },
  "ability": { "name": "Grovel of Legends", "text": "Talk any monster into a pause.", "uses": 1 },
  "flaw": "Sneezes uncontrollably near dragons.",
  "titles": [],
  "heart": 1,
  "portrait_prompt": "storybook watercolor, ..."
}
```

- **Stats** use a fixed spread of **+3 / +1 / −1**, assigned to fit the concept. The −1 is where the comedy comes from: a cowardly knight gets Brave −1. Brave covers fighting, daring, and physical feats. Clever covers tricks, magic, and knowledge. Charming covers talking, befriending, and performing.
- **Ability:** grants advantage once per tale and recharges on a natural 20. The AI rates a pitch that fits the ability as Clever.
- **Flaw:** triggers disadvantage when the AI judges it relevant, or gives bonus Hope when the player embraces it.
- **Titles** collect on the card and appear in the storybook ("Sir Reginald the Reluctant, the Singed, Dragon-Whisperer").

---

## 6. Social and connection mechanics (for Meta's judges)

| Mechanic | Connection it creates |
|---|---|
| **Pitch Wall** | Everyone's idea is shown publicly, so people read and laugh together |
| **Party vote, not your own** | Players have to persuade each other and argue playfully |
| **The Party Believes! (advantage)** | Agreeing as a group has a visible mechanical payoff |
| **Catch! (spend your Heart)** | Saving a friend. The narration names the rescuer: "Mira yanks Reginald out of the fire." |
| **Reactions** (laugh / fire / gasp / heart on phones, floating on the TV) | Constant low-effort participation. When the **Cheer Meter** fills, the party gets +1 Hope. |
| **All Together Final Roll** | One shared climax with everyone's dice on screen |
| **Storybook credits** | Each player gets a page with their best moment and a "Crowd Favorite" award for the most-reacted pitch |
| **Headline reveal** | Ends on a real-world conversation starter ("wait, that actually happened?") |

---

## 7. Screens

### TV (shared table)
1. **Lobby:** title art, room code, QR code, joined players.
2. **Character Reveal:** cards flip one at a time, with portrait, stats, flaw, and a DM roast line.
3. **Quest Reveal:** the painted realm map with pins, the quest text, and the source headline shown as a sealed scroll.
4. **Scene:** illustration, situation text, Hope hearts, progress pips, timer, active complication banner.
5. **Pitch Wall:** every pitch with its tier stamp, DM quip, and live vote counts.
6. **Roll:** a giant d20, the math breakdown, and a band banner (CATASTROPHE / LEGENDARY).
7. **Outcome:** narration, meter changes, title earned.
8. **Final Roll:** every player's die tumbling at once, plus the Hope bonus.
9. **Ending:** the scroll unseals to show the real headline and source, then a storybook preview and a QR code to share.

### Phone (character sheet and controller)
1. **Join:** room code and name.
2. **Concept:** text box or hold-to-talk (Voice Transcribe).
3. **My Card:** portrait, stats, ability, flaw, Heart, titles. Always one tap away.
4. **Pitch:** input, plus Use Ability and Embrace Flaw toggles.
5. **Vote:** the other players' pitches with their tiers.
6. **Roll:** the ROLL button (winner only). Everyone else sees "Reginald is rolling…"
7. **Catch!:** a 5-second pulsing button after a teammate fails a roll.
8. **Reaction bar:** stays on screen during every phase.
9. **End:** my storybook page and a share button.

---

## 8. Five clip-worthy moments to engineer

1. **The Card Roast:** "Sir Reginald, Brave −1," with a portrait of a knight already sweating. Prompt the AI to make the flaw visible in the portrait.
2. **"Only a Miracle" gets voted anyway:** the whole table chooses the impossible pitch, and the TV builds suspense with a slow-motion die.
3. **Natural 1 plus Shame Title:** a catastrophe narration followed by a permanent "the Singed" stamped onto the card.
4. **The Catch:** a natural 1, a friend slams Catch!, the reroll comes up 20, the rescuer is named, and the table erupts.
5. **The Headline Reveal:** "This tale was inspired by real news…" The dragon was a bridge collapse and the wolf packs were budget cuts. People gasp and then laugh.

---

## 9. Scope: MVP vs stretch

### MVP (must ship, ≈12h)
- Rooms over WebSocket: TV host plus phone clients, room code, QR code.
- Character generation: text concept → JSON card → Muse Image portrait (async, with a placeholder silhouette until it arrives).
- SerpApi news → filter → quest, with **3 cached fallback quests** in case the API or filter fails on stage.
- Pitch → batched verdict → vote → roll → narration. **Quick Tale only.**
- Hope, Progress, Hearts and Catch!, advantage, natural 1 and 20 titles, Final Roll.
- **One illustration per scene** (3 total), pre-generated as soon as the scene starts.
- Reactions on the TV.
- Headline reveal and a simple storybook HTML page.
- AI fallbacks: if a verdict times out, the pitch is rated Solid. Narration is a canned line for each band.

### Stretch (in this order)
1. Voice pitching through Muse Voice Transcribe. **High demo value for the Meta track, so do it first.**
2. AI-painted realm map with game-controlled pins. The MVP uses a static parchment map with pins.
3. Cheer Meter → Hope, and Audience join (react-only phones for judges watching).
4. Full Tale mode (4 scenes with progress tracks).
5. Browser text-to-speech for DM narration.
6. Hosted, shareable storybook link.
7. "Cursed One" saboteur mode.

### Cut entirely
Individual HP, inventory, movement on the map, initiative and combat rounds, leveling, more than 3 stats, accounts and persistence, per-round illustrations.
