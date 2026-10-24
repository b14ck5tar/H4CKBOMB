# 14 · First-time-user UX audit

**Question:** can someone who has never played (non-gamers, judges who don't know each other) tell what to do within seconds at every step, without anything feeling confusing, slow or intimidating?

**How it was tested (Sat Oct 24):** I read `CLAUDE.md`, `SPEC.md`, `TV.tsx`, `Phone.tsx`, `HeroCard.tsx`, `MicButton.tsx`, `app/page.tsx`, `app/play/page.tsx`, `rules.ts`, `host.ts` and `usePhone.ts`. Then I played the live site (https://once-upon-a-roll.vercel.app): one TV tab plus two phone tabs at 375×812 (`&as=1`, `&as=2`). The run went from joining, through character creation and the quest intro, to one full round in scene 1 (narration, pitch, appeal, roll, catch, outcome). I used one game's worth of Muse calls and edited no code.

**Tag:** 🗣 marks a fix that directly supports "people talk to each other, not to the AI".

---

## Ranked fixes (top 20)

### 1. Phone · Pitch screen: the Send button is below the fold 🗣
- **Problem:** at 375×812 the screen stacks the header, the "secretly watching" line, the clue, the timer, the question, the text box, 3 idea chips, a big mic button and 2 checkboxes. **"Send my plan" sits off-screen.** A first-timer types a plan, sees no button and panics while the 40 s timer runs.
- **Fix:**
  - Make the submit button sticky at the bottom (`sticky bottom-0`) with its label: **"Send my plan ▸"**.
  - Fold the two checkboxes into one collapsed row: **"＋ Use my power / lean into my flaw"**.
  - Shrink the mic button (see #13).
  - Move the "Secretly watching…" line off this screen. It already shows in the quest phase.
- **Effort:** M

### 2. Phone + TV · Catch!: the person who failed isn't told to ask for help 🗣
- **Problem:** when your roll fails, your own phone says **"Can anyone catch them?"**, a generic line that hides the fact that it's you. The TV shows "♥ can catch" in 12–13 px text under one avatar. The window is 8 s (`CATCH_MS`). In my run it expired before anyone could have understood it. This is the best "turn to your friend" moment in the game, and right now it goes past unnoticed.
- **Fix:**
  - Failer's phone: **"You failed! Maya can save you. Ask her!"**
  - Catcher's phone keeps the big **CATCH!** button, with the sub-label "Save Mabel (your one save)".
  - TV headline: **"MAYA CAN SAVE MABEL. SHOUT FOR IT!"**
  - Raise `CATCH_MS` to 15 s.
- **Effort:** S

### 3. Phone · Roll: the die rolls itself before first-timers tap it
- **Problem:** `ROLL_MS` = 12 s, then `revealAll()`. Someone who is watching the TV (as instructed) loses the one tactile moment that is theirs. In my run, Mabel's die auto-rolled.
- **Fix:**
  - Raise `ROLL_MS` to 20 s.
  - Vibrate the phone when the ROLL phase starts.
  - TV under each unrolled die: **"Mabel: tap ROLL!"** in `text-xl`, not `text-sm`.
  - Show a countdown only in the last 5 s: "Auto-rolling in 5…".
- **Effort:** S

### 4. Phone · Reading screens pull eyes down to the phone 🗣
- **Problem:**
  - During outcome, the phone prints the full "Your moment" text, the same text the TV is typing out, so people read their own phone instead of watching together.
  - The biggest thing on the phone is a yellow **"✓ I've read it"** button. Tapping it by reflex skips TV beats for everyone: beat 2 of 2 went by unread in my run.
- **Fix:**
  - While it's your beat, the phone shows only **"⬆ Look up: your moment is on the TV"**. The full text appears once the TV has moved on.
  - Hide the Ready button until the TV's `TypeReveal` finishes (or for the first 4 s).
  - Rename it **"Done. Next ▸"** and make it smaller (`btn-ghost`, not gilt).
- **Effort:** S–M

### 5. Phone · Join screen gives no context, and a bad code spins forever
- **Problem:**
  - The name screen says only "GROUP PROJECT / Your name / Join". It doesn't confirm which table you're joining or what the game is.
  - With a wrong code (tested: `ZZZQ`), the phone shows "Finding table ZZZQ…" forever. There's no timeout and no way to re-enter the code.
- **Fix:**
  - Name screen subtitle: **"Joining table CSNX. The story is on the TV; this phone is your controller."**
  - After 8 s with no state: **"Can't find table ZZZQ. Check the 4 letters on the TV."** plus a code input and a **Try again** button.
- **Effort:** S

### 6. Phone · No disconnected or reconnecting state
- **Problem:** if Wi-Fi drops or the TV tab closes, the phone freezes on its last screen and looks fine. `usePhone` re-sends `hello` but never tells the user.
- **Fix:**
  - Track `lastHeard` in state.
  - After 6 s of silence, show a thin top banner: **"Reconnecting to the TV…"**.
  - After 30 s: **"Lost the table. Is the game still open on the TV?"** plus a **Re-enter code** button.
  - Disable submit buttons while disconnected so typed plans aren't silently lost.
- **Effort:** M

### 7. TV · You can't tell who is who 🗣
- **Problem:** once characters exist, the TV shows only hero names (Maya, Mabel). The real names (Ava, Ben) disappear everywhere except the mirror reveal. Strangers and judges can't address each other by name. Hero names that start alike (Maya / Mabel) make it worse.
- **Fix:**
  - Crew chips: **"Maya · Ava"**.
  - Lobby HeroCard: "played by Ava" under the name.
  - PlanCards header: "MAYA (Ava)".
- **Effort:** S

### 8. Phone · Waiting states say "wait" when they could say "talk" 🗣
- **Problem:** "Drawing your character…", "Waiting for the story to start…", "Waiting on the others…" and "Eyes on the TV" are dead air.
- **Fix:** give each one a prompt that turns people toward each other (copy is in the waiting-states table below), for example:
  - Building: **"Drawing you… Tell the person next to you who you picked."**
  - Plan sent: **"Plan in! Tell the table what you're doing."**
- **Effort:** S

### 9. Phone header + TV · Jargon and a ♥ that means two things
- **Problem:**
  - From the first second the phone header reads **"♥ Catch ready · Ability ready · tap for card"** (12 px monospace, 80 % opacity), before anyone knows what Catch or Ability means.
  - The TV top bar shows 6 hearts labelled only by a hover tooltip ("Group Hope").
  - ♥ means both "group Hope" (TV) and "my personal catch" (phone).
- **Fix:**
  - Phone header becomes **"Maya · tap to see your card"**. Show "♥ 1 save left" only from the first roll on.
  - Give Hope its own icon and a visible label on the TV: **"HOPE ★★★☆☆☆"**.
  - Add one line on the quest intro: "Hope: the team's luck. Big wins add, natural 1s cost."
- **Effort:** S

### 10. TV · Too small to read at TV distance, and doesn't fit a 720p laptop
- **Problem:**
  - Stamps are sized in px (`sm` = 16 px, `md` = 26 px), so they don't scale with the TV's rem scaling. The ruling stamps on the plan cards are 16 px.
  - Labels are `text-xs` (QuestBoard headings, "plan in ✓", "ready ✓", "STUCK"), which is about 13 px on a 1366 px laptop.
  - In a short window (tested 800×440, and true of a 1366×768 laptop with browser chrome):
    - The **Start the story** button is below the fold.
    - The quest intro's goal line gets cut off.
    - The crew avatars overlap the scene image.
- **Fix:**
  - Change Stamp sizes to rem, and use at least `md` on the TV.
  - Nothing below `text-base` on the TV. Crew marks become `text-lg`.
  - Raise the root clamp to `clamp(18px, 1.3vw, 30px)`.
  - Make the lobby Start row sticky at the bottom of the right column.
  - Test at 1280×650.
- **Effort:** M

### 11. Phone · Convince the DM: too fast, and the result is never shown 🗣
- **Problem:**
  - 20 s (`APPEAL_MS`) to read the ruling, think and type an argument on a phone. I barely made it with pre-written text.
  - After arguing, the phone jumps straight to ROLL with no "it worked / it didn't". Players never learn whether arguing is worth it.
- **Fix:**
  - Raise `APPEAL_MS` to 30 s.
  - Before the roll, show the outcome on the phone and TV for 2 s:
    - **"Convinced! RISKY → SOLID"**, or
    - **"Nice try. Still ABSURD."**
  - Data already exists: `appealed` plus the new `verdict`.
  - Helper copy: "Ask the table for a reason, then type it."
- **Effort:** S–M

### 12. Phone · The last plan can never get a 🔥 boost 🗣
- **Problem:** pitch ends the instant the last plan arrives (`onPitch` → `endPitch`), and `onBoost` only accepts boosts during `pitch`. Whoever submits last can't be boosted. In a 2-player game nobody can boost the second plan at all. Meanwhile, people with a "THAT WORKS" plan sit idle through the appeal phase.
- **Fix:**
  - Allow boosts during `appeal` too.
  - Show the 🔥 list under "Waiting on the others…" with the heading **"Pick your favourite plan to 🔥 (they roll 2 dice)"**.
- **Effort:** M

### 13. Phone · The mic button is the loudest thing on screen
- **Problem:** `MicButton` is a 64 px cream block on the dark UI, brighter than the primary button. That contradicts "typing is the default" and invites talking at the phone.
- **Fix:**
  - Restyle it as a ghost/secondary button (dark fill, thin border) at 48 px high, labelled **"🎙 or hold to talk"**.
  - Put it to the right of the text box rather than as a full-width row.
- **Effort:** S

### 14. Phone + TV · The hero card doesn't explain itself
- **Problem:**
  - "GUTS +1 · BRAINS −1 · CHARM +3" means nothing to non-gamers.
  - The case number ("26-D920") is visual noise.
  - Ability text reads like a compressed note ("Ask phone one future thing, get wrong detail").
- **Fix:**
  - One line under the stats: **"Higher = better at it. The judge picks which one your plan uses."**
  - Hide the file number on the phone.
  - Ask the character prompt for full-sentence abilities, under 12 words.
- **Effort:** S

### 15. TV · Lobby: no "how to play" for judges, and wrong pronoun 🗣
- **Problem:**
  - A judge walking up sees a QR code, story cards and "Your crew (0 ready)", but nothing says what the game *is*.
  - While a character is being made, the TV says **"Drawing your character…"** under Ava's name, which reads as if the TV means *you*.
- **Fix:**
  - A 3-step strip under the room code: **"1 Scan · 2 Invent a hero · 3 Plan together, roll, find the real news"**.
  - Building label becomes **"Drawing Ava's character…"**.
  - Empty-crew line becomes **"Nobody yet. Point your phone camera at the code."**
- **Effort:** S

### 16. Landing page + phone copy · "DM" jargon and two names 🗣
- **Problem:**
  - The landing page leads with "Nobody has to be the **Dungeon Master** anymore", so non-gamers don't know what problem it solves.
  - Phones say "The **DM** flips to the next page of notes…" and "Convince the **DM**?"
  - The game is "Group Project" in the game but "Once Upon a Roll" on the landing page and in the tab title.
- **Fix (creative director's call):**
  - Landing subhead: **"A party story game for 2–6 friends. One screen, your phones, an AI storyteller."**
  - Add the same 3-step strip as #15.
  - In player-facing text, say "the storyteller" (or "the judge" for rulings); keep "DM" for judges' DM's Notes.
  - Pick one name everywhere.
- **Effort:** S

### 17. TV · Quest board: cut-off goal, a duplicate and a spoiler
- **Problem:**
  - `shortGoal` cuts mid-sentence: "…keep the new span unchewed **until the…**".
  - While scene 1 loads, "THE GOAL" and "RIGHT NOW" show the same text.
  - "LAST TIME" fills with this round's result (`now`) while the beats are still being read, and the summary card then repeats it word for word.
- **Fix:**
  - Store a hand-written `goal_short` (≤10 words) per seed, or cut at a clause boundary.
  - Show "Scene 1 is loading…" in RIGHT NOW until `question` arrives.
  - Update `lastTime` only in `afterRound()`.
- **Effort:** S

### 18. Phone · A failed character build fails silently
- **Problem:** if the character AI call fails, `buildCharacter` sets status back to `joined`. The phone drops back to an empty "Who are you tonight?" form with no message, so it looks like the app ate your idea.
- **Fix:**
  - Client-side: if status goes `building` → `joined` with no hero, refill the text box and show **"The ink smudged. Tap Make my character again."**
  - Better: a fallback hero so this never happens.
- **Effort:** S

### 19. Phone · Small tap targets
- **Problem:**
  - "Use the example" and "Redraw my character" are ~20 px tall underlined monospace links.
  - The ability/flaw checkboxes are 20 px.
  - The timer reads "40s" in 14 px.
  - Helper lines ("Tell the others, or use it in your plan.", "Keep it secret…") are 12 px at 60 % opacity.
- **Fix:**
  - All tappables at least 44 px high: make the links `btn-ghost` chips.
  - Helper text at least 14 px at 80 % opacity.
  - Clue helper copy: **"Say it out loud, or keep it for your plan."**
- **Effort:** S

### 20. TV · Pitch phase is an empty stage 🗣
- **Problem:** during pitch, the scene picture vanishes and the TV is a single question over a big empty area until the first plan lands. Nothing on the TV tells the room to talk first.
- **Fix:**
  - Keep a small scene thumbnail beside the question.
  - Under the question, in large type: **"Talk it over. Then type your plan."**
  - Make the crew strip say who is still writing: **"Ben is still thinking…"**
- **Effort:** S

---

## What each phase should say (≤8 words each)

| Phase | TV headline | Phone headline |
|---|---|---|
| Lobby, nobody in | Scan the code with your phone camera | (join screen) Joining table CSNX. Your name? |
| Lobby, making heroes | Everyone: invent a hero on your phone | Who are you tonight? One weird line. |
| Hero being drawn | Drawing Ava's character… | Drawing you… tell your neighbour who! |
| Lobby, all ready | Pick a story, then press Start | You're in! Compare cards with someone. |
| Quest intro | Read together. Phones have secret missions. | Secret mission inside. Then look up. |
| Narrating | Read it, then share your clues | Your secret clue. Say it out loud? |
| Pitch | Talk it over. Then type your plan. | What do you do? One sentence. |
| Pitch, plan sent | Plans in: Maya ✓ · Ben thinking… | Plan sent. Tell everyone your idea! |
| Appeal | Risky plans: argue your case now | Risky! Argue it, or just roll. |
| Appeal, clever plan | (same) | That works! 🔥 a friend's plan. |
| Roll | Tap ROLL on your phones! | Your turn: tap to roll! |
| Catch | MAYA CAN SAVE MABEL. SHOUT! | Failer: You failed! Ask Maya to save you. / Catcher: Save Mabel? Tap CATCH! |
| Outcome | (beat text) | Look up: your moment's on the TV |
| Final roll | Everyone roll at once! | Final roll! Tap together on three. |
| Mirror write | Secretly finish one kind sentence | Finish the sentence about Mabel. |
| Mirror guess | What did your guardian write? | Guess what they wrote about you. |
| Mirror reveal | (sentence) | Look up: this one's about Ava. |
| Reveal | This really happened. Read it together. | Look up. This really happened. |
| Storybook | Your story. Press Next page. | Thanks for playing! Story's on the TV. |
| Late joiner | — | Story in progress. Next one's yours! Send reactions meanwhile. |

## Empty and waiting states (copy)

- **Phone, character drawing** (5–10 s, observed): "Drawing you… Tell the person next to you who you picked."
- **Phone, lobby with hero ready:** "You're in! Show your card to someone. Who'd win in a fight?"
- **Phone, "The DM is reading your plans…"** → "The storyteller is reading. Guess who has to roll."
- **Phone, plan sent, others still writing:** "Plan in! Tell the table what you're doing." Then the 🔥 list.
- **Phone, Clever plan during appeal:** "That works, no roll! Help a friend argue theirs."
- **TV, scene image loading:** keep the hourglass + "Painting the scene…" (good). The blank purple box I saw in scene 1 needs the same label.
- **TV, "Nothing yet. Give it a minute." (LAST TIME)** is fine. Hide the box in scene 1 instead of filling it.

## Error states

| Situation | Today | Fix |
|---|---|---|
| Wrong / expired room code | "Finding table ZZZQ…" forever (observed) | After 8 s: "Can't find table ZZZQ. Check the TV." + code input (#5) |
| Phone loses connection / TV tab closed | Frozen last screen, no signal | "Reconnecting to the TV…" banner after 6 s; re-enter code after 30 s (#6) |
| Mic permission denied | Button turns into "Mic unavailable — type instead" (good) | Add "(Allow the mic in your browser settings to talk)". Keep the text box focused. |
| Mic recorded nothing | "The scribe dozed off. Type it instead?" (good) | Keep |
| Character AI fails | Form silently resets | "The ink smudged. Tap Make my character again." (#18) |
| Story already started | "A story is underway. Jump in on the next one!" | Add "Watch the TV, and you can still send reactions" + show the reaction bar |
| Local mode (no Supabase) | Red 12 px note on TV | Fine for devs. Never shows in prod. |

## Accessibility basics

- **Contrast:**
  - Card text (`--ink-soft` #bdb3d6 on #150e22) is about 9:1, which is good.
  - Low-contrast spots: `text-parchment/55` footer, `/60` and `/70` helper text, and the disabled primary button (dark maroon text on maroon at 40 % opacity, nearly unreadable).
  - Keep disabled buttons legible: 60 % opacity, with a reason underneath ("Type a line first").
- **TV distance (about 3 m):**
  - Nothing below about 24 px on a 1080p TV.
  - Today's offenders: QuestBoard labels, Crew marks, "tap ROLL on your phone", the beat "1 of 2", px-sized Stamps (#10).
- **Phone tap targets:** at least 44 px (#19). Reaction buttons and the big buttons are already fine.
- **Motion:** stamps, glitches and pulses are heavy. `juice.css` already has a reduced-motion block. Make sure `animate-pulse` on the BigButton and the waiting text respects it too.
- **Not colour-only:** fail/success stamps carry words (good). The Crew "…" vs "✓" marks are tiny glyphs, so use words ("writing…", "ready").
- **Screen readers:** emoji reaction buttons have aria-labels (good). The Hope hearts have an aria-label but no visible label (#9).

## Other playtest notes (lower priority / to verify)

- Several stamps (Maya's "THAT WORKS · NO ROLL" on the phone and on the TV roll stage, "NOPE / ROLLED 8" on the beat card) showed up as a huge faint ghost instead of a crisp stamp.
  - This may be because background tabs pause CSS animations, which would leave `ouar-stamp-slam` stuck on its first keyframe.
  - **Check on a real phone and TV.** If it happens there too, give the slam animation a final-state fallback.
- The quest teasers read like real news and are intriguing. The "You'll find out which at the end" hook works.
- The secret mission card on the phone is clear and warm. The clue box ("Only you noticed") is the strongest talk-starter in the game: make it bigger, not smaller.
