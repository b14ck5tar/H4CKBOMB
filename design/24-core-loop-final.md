# 24: Core loop, final (CD + partner picks, Sat ~8 PM)

The source is the mechanics picker (claude.ai/artifact/8hutcKYHpzStjyTHHj8r82). This overrides design/20 and earlier round notes.
North star: **immersion**, smooth and understandable by an 8-year-old, logical, the AI's reasoning visible, and nobody waiting.

## Join
- Describe your hero in one line, plus ONE question: "What are you weirdly good at?" (→ power). Ready-made heroes are the backup (instant).
- **Power scaling in code:** every hero gets the same stat budget (e.g. +2 / +1 / 0). The AI writes only flavor and can't change numbers.
- The custom portrait paints in the background; a colored silhouette shows until it's ready.

## Story modes (lobby)
1. **Odd news:** live news from the past week or month, from random places worldwide. Creative, little-known, interesting, harmless (filtered by the Kids/Teens/Adults rating). Show 3 headlines and vote. Curated seeds are the fallback if live news fails.
2. **Our stories:** every player privately writes a small real story: the setup, the steps that led there, and (hidden) how it really ended. The table votes on which to play. The reveal shows how it really went for that person.

## Turns
- One player per turn. **Everyone else suggests** an action (≈60 s timer). **The turn owner picks**: their own plan or a friend's suggestion.
  - **+1 to the roll** if the owner works in part of someone's suggestion (credit shown: "+ Sam's idea").
  - **One action only.** Max ~140 characters. The AI takes the first concrete action literally and ignores chains ("if that fails I…"); the phone says "one action".
- **Cycles by lobby size:** 2-4 players get 2 turns each; 5-8 players get 1 turn each. Quick Tale gets 1 turn each with shorter timers (~40 s).
- **Grand finale:** everyone proposes, everyone votes (not for their own), and the winning plan rolls the shared shake-together die.
- Absent players are skipped (no autopilot story), and they can rejoin later.

## Judging + dice
- The AI judges the action **literally, at face value** (no Convince the DM): tier + one plain reason. The TV shows **"Needs 12+"** before the roll.
- One d20 + stat + bonuses. A great roll can save a dumb plan (nat 20 always works, in the funniest way); a nat 1 always flops. A wild plan needs a high roll.

## Story writing (branching)
- **Fixed start, fixed goal, open middle.** The opener is the real story (news or personal). After each action, the AI writes what happened and the new situation, so the story branches uniquely.
- Writing rules: 8-year-old clarity, short sentences, logical cause → effect, the quirk only for the turn owner and only if the plan uses it, never paste player text, always move toward the goal.
- Models: muse-spark-1.3 for live outcomes (fast); a stronger setting for openers made ahead of time.

## Art, voice, presentation
- **Each decision gets a new scene image** showing the new situation with the heroes painted in. Painting starts the moment the owner picks; the outcome shows over the previous art; crossfade when ready; never wait.
- **Voice + text:** the narrator reads while the text appears in sync. Two narrator voices to choose from in the lobby (mysterious, alluring; names TBD). Falls back to text-only if TTS is slow or unavailable.
- **DM's Notes** shows the logical reasoning behind each outcome.

## Ending
- "This really happened" + the article (news) or the author's real ending (Our stories).
- **What's happening now** in the real world (e.g. the bridge repair and who it affects), using only facts from the source.
- Keepsake link + QR.

## Length
- Full: 10-15 min (turns scale with lobby size). Quick Tale: ~4-5 min. Keep everyone busy on others' turns via suggestions.

## Setup
- One room for the demo and pitch; remote play is mentioned as easy (/watch exists).
