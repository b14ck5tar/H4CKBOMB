# 21: Meta-table playtest, Sat ~5:15 PM (from 2 screen recordings)

**CD's verdict:** "took like 8 minutes", "over crowded", "not enough explanation", "too many features", "some of it doesn't make sense", "proposed answers were always the same", "art didn't incorporate our characters", "the wording is unfollowable", "what the hell is foam".

## Video 1: Full Story by accident, 8:02
The recording shows no Quick Tale badge, so it ran the full flow: 3 scenes, Mirror and an 8-page book.

Where the time went:
- About 2.5 minutes of blank or idle TV: narration waiting on CONTINUE, plus about 30 s of an empty screen during each plan-typing phase.
- Mirror took 75 s.
- The storybook took 65 s.

Missing instructions:
- The typing screens never say "type your plan".
- Nobody is told who presses CONTINUE.
- Hearts, Hope and "guardian" are never explained.

Most crowded screens (about 13 elements each):
- Scene narration: the avatars are clipped behind the art.
- Outcome card: it overlaps the cards above it.
- Storybook crew page: text spills out of the card.

Repetition:
- One player typed "hack the mainframe" in all 3 scenes and was rewarded twice.
- 4 of 5 verdicts start with "Sure."
- Both games ended with the same closing line.

Bugs:
- The "Last time" card shows the result before the outcomes play.
- The finale shows stale "Right now" and "Last time" text.
- The dice order is reversed from the avatar order.
- Storybook: page 4 is nearly empty, page 5 uses the wrong art, grammar slips, and one story line has no setup.

## Video 2: Quick Tale, 3:30 (game clock 2:15)
- **About 40 s were spent in the lobby on "Thinking up a character…"**
- The scene text was full of jargon: "Respawn Cliff", "fake sea", "No boring carries", "the island blinks out at dawn".
- The goal was never stated. "How do you score?" never says score what.
- "Foam" came from the villain description in `seed_quests.json` ("tide-shape of sea foam") and leaked into play as a character.
- The ending pasted raw plan text into its sentences ("flips it with charm the foam into aiming").
- Small UI bugs:
  - A phone icon draws as an empty box.
  - The ability shows "(used)" while still in the lobby.

## Takeaways
1. Cut features: bare-bones round, no Mirror in the demo, a shorter book.
2. Hand-written scenes with a goal always on screen (design/20 + DECISIONS).
3. Every screen gets one instruction line; nothing sits idle without telling people what's happening.
4. Never paste raw player text into narration; the AI paraphrases it into a full sentence.
5. Vary the openers ("Sure."), and stop repeat plans from being rewarded every time (the same idea twice gets a "yes, but").
6. Character creation must be instant for the demo (ready-made heroes as the default).
7. Heroes need to be in the art.
