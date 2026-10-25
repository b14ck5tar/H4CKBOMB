# 37: Story rework after Meta feedback (Sun ~10:25 AM, CD)

## What Meta said
- They loved the look and feel, but "the game fell apart the moment we started." The story doesn't progress: in our last game we spent 4 turns trying to get a bag. One judge said the story and gameplay were too hard to follow.
- The Meta rep: the moat is **how we prompt the story**. A story spine is chosen at selection time, and then the model and the players are free to play open-ended from there.

## Root cause (one rule in code)
- design/35 and commit 74cec6d made "the finish line stays open until the finale (a success solves a step, never the goal)". Every Right now is a sub-step toward that fixed finish line.
- So a success never changes the situation. The story keeps circling the same task (the pig, the bag).
- The progress meter also implies "finish the task", which ties the ending to the original goal.

## The story checklist (CD, all 8 must be YES before a story enters the game)
Gate above all 8 (pass/fail, enforced in code): safe for the room. No deaths, violence against people, kids, hate, or mocking private people.
1. Is the problem big enough that it takes the whole group to solve?
2. Is there an alterable ending that doesn't strictly favor one side?
3. Does the story feel and flow well when dramatized for a group of people?
4. Can the dramatized story fit unique characters with different superpower abilities?
5. Can the story have multiple endings and routes, especially when someone does something unexpected?
6. Does the real event make people say "wait, that REALLY happened?"
7. Is it easy to follow? Can the setup be told in one plain sentence (where, what's wrong, what's at stake), and can every turn be followed by someone who just walked up to the table?
8. Is there a real dilemma the group will argue about, not just a task?

## The new structure: strict start, loose middle, strict path to an open ending
1. **Strict start (at selection).** Built from the article:
   - the setting (place, mood);
   - 2-3 side characters, each with a want;
   - the ORIGINAL problem (the real one from the article);
   - a suggested goal, which is only a suggestion;
   - 2-3 **pressures**: things that get worse on their own whatever players do (D&D "fronts" / clocks), e.g. the press arrives, the police notice, the shark gets hungrier;
   - the dilemma (box 8).
2. **Loose middle (every turn).**
   - The action happens exactly as typed. It can't be undone, and it becomes a fact.
   - The situation changes for real: a success SOLVES that problem for good, and the next beat is a NEW circumstance that grew out of it. A failure makes things worse in a new way. Never "try again", never the same objective twice (a code check against every earlier Right now).
   - Players can go beyond the goal: if they become private detectives or invest their savings in gold, the story follows them.
   - One pressure advances each turn, so there's always momentum.
3. **Strict path to an open ending.**
   - The meter becomes a story clock (Act 1 / Act 2 / Act 3 / Finale, by turns), not "task % done".
   - The last turn is the climax: the moment of truth for whatever the situation IS by then, not the original goal.
   - The ending is written from what the players actually did, so it's never the same ending twice. Pass in the endings from recent games to avoid repeats.
   - Unique heroes plus unique choices make a unique story.
4. **The reveal.** "Your story started from a real article. The problem you faced at the start, [original problem], really happened." Then What you did → What really happened. The article screen STAYS UP; the TV moves forward or back only on a key press or button (no auto-advance).
