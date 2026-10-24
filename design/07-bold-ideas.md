# 07: Five Bold Ideas Built on the Uncertainty Thesis

Design pass, 2026-10-24, about 18 build hours left. Builds on 05 and 06. [V] = checked today; [M] = from memory, check before a slide.

## The brief, restated as a design rule

People avoid each other not out of fear but because they **can't predict how it will go**. Uncertainty reduction theory (Berger & Calabrese 1975, *Human Communication Research* [V]): first interactions are driven by the need to make the other person predictable. Two forecasting errors inflate that uncertainty:

1. **"They won't want to."** Commuters guessed that fewer than half of strangers would want to talk, yet no one was snubbed (Epley & Schroeder 2014 [V]). People worry more about the *other person* not enjoying a conversation than about their own enjoyment (Sandstrom & Boothby 2021, *Self and Identity* [V]). Concerns about *starting* a conversation are what stop it (Schroeder, Lyons & Epley 2022, *JEP: General* "Hello, stranger?" [V]). People underestimate how often others will agree to help by up to 50% (Flynn & Lake 2008, *JPSP* [V]).
2. **"Everyone else is fine with the silence."** This is pluralistic ignorance: each person privately disagrees with a norm that they assume everyone else holds (Prentice & Miller 1993, *JPSP* [V]). Showing people that the norm is an illusion changed their behavior months later (Schroeder & Prentice 1998 [V]).

For judges: the best loneliness interventions **fixed expectations of rejection**; adding contact did less (Masi et al. 2011 [V, in 05]).

Each concept uses one of six uncertainty killers (**script, reason, role, mask, shared enemy, safe excuse**), and several **reveal the forecast error out loud**. None rates people. All fit one table.

---

## 1. MIRROR, MIRROR *(reuses the engine: a finale for Once Upon a Roll)*

**Hook:** The original magic mirror ranked people. Ours tells you the one truth the liking gap hides: you were seen more warmly than you think.

**How a session plays**
- **0:00 to 3:00.** A normal quest. Each phone secretly assigns a **ward**: you are one player's hidden guardian. Assignments form a cycle, so everyone gets exactly one guardian and nobody is chosen (no popularity contest).
- **During the quest.** The AI watches the game log and privately nudges: *"Your ward rolled a 1 and laughed it off. Note it?"* One tap saves it.
- **3:00 to 3:30. The Mirror Quill.** Each guardian finishes one sentence frame about their ward. Every frame is positive by construction, for example *"The moment I'd retell about you is…"* or *"I'd want you on my quest because…"*. Starter chips are **half-sentences drawn from the game log**, and the human finishes them.
- **3:30 to 3:45. The Guess.** Each player answers: *"What do you think your guardian noticed?"* Typical answer: "probably nothing, I was quiet."
- **3:45 to 4:30. The Reveal.** The TV shows each guess beside the guardian's actual words, read aloud over a Muse Image mirror portrait of that moment. The page joins the storybook.

**Uncertainty killer: a safe excuse, plus a visible forecast error.** You never decide to compliment anyone (it was assigned), and receiving isn't awkward (everyone gets one). The Guess lets you feel the liking gap (Boothby et al. 2018 [V]) with no number. This answers the creative director's objection: **nothing is rated; players say what they *noticed*, not how much they liked anyone.** Research:
- People underestimate how good compliments make others feel (Boothby & Bohns 2021 [V]) and how much gratitude means (Kumar & Epley 2018 [V]).
- Endings dominate memory (peak-end, in 05).
- Correcting the expectation of rejection is the strongest loneliness lever (Masi 2011).

**Judging-table demo.** Two judges plus two teammates; the judges guard each other. The clip: a judge types "I didn't do much," then hears the other judge's real line read over a painted portrait.

**What Muse does**
- **Spark:** spotting moments in the game log, half-sentence chips, a kindness/specificity check that blocks backhanded or generic notes, narration stitched around verbatim quotes.
- **Image:** the mirror portrait.
- **Voice Transcribe:** spoken notes.
- **Connector:** a tool, `read_my_mirror_page`, so a player can later ask Muse to show their page.

**Risks**
- Low-effort notes ("nice"): the AI asks for something specific; the writer has the final say.
- Hidden AI ghostwriting reads as less warm (Hohenstein 2023): chips are fragments only, and the TV labels the line "Written by Priya."
- Dark-humor notes: moderation plus positive-only frames.

**Build:** about 4 to 5 hours. Ward assignment (0.5h), a moment-flag prompt on the existing game log (1h), the quill and guess phone screens (1.5h), the reveal screen with TTS and image (1.5h).

**Scores:** Connection **9** · AI **7** · Originality **8** · Execution **8**

---

## 2. MASKS OFF *(reuses the engine: hidden truths inside character cards)*

**Hook:** Your fairytale hero is secretly built from one true, weird fact about you. By the end, the table has to guess which part is real.

**How a session plays**
- **Join (20 s).** Phone asks for *"one small true thing nobody here knows"* (chips: a fear, a talent, a strange food).
- **Character card.** Muse disguises the fact as fantasy. "Scared of geese" becomes *"Sir Bramble, who lost a duel to a goose and never spoke of it."* It adds **two invented decoy traits** in the same style.
- **Quest.** Pitches using your own traits earn advantage, so quirks get performed before anything is confessed.
- **Finale: the Unmasking (60 to 90 s).** The table taps which trait is real; the owner reveals it with a 15-second "story behind it" and fields follow-ups ("wait, an actual goose?").

**Uncertainty killer: a mask, then a script for removing it.** Disclosure through a character is near-zero risk; the game then supplies the moment and format for the real story. Research:
- Reciprocal, escalating disclosure builds closeness (Aron 1997; Sprecher 2013 [V, in 05]).
- Asking questions increases liking (Huang et al. 2017, *JPSP* [M]).
- Small vulnerable displays look braver to others than they feel to us (the beautiful mess effect, Bruk 2018 [V]).

The guess is about *facts*, never about people.

**Judging-table demo.** A judge's goose fact surfaces mid-quest; the table guesses it; the story comes out.

**What Muse does**
- **Spark:** disguising each fact and writing believable decoys. This is real creative transformation, not decoration.
- **Image:** the hero portrait, which already exists.
- **Voice:** speaking the true fact.

**Risks**
- Too-heavy facts: chips steer light; a filter swaps anything heavy.
- Obviously fake decoys: prompt tuning.

**Build:** about 3 hours, almost entirely prompt and card-schema work on systems that already exist.

**Scores:** Connection **7** · AI **8** · Originality **7** · Execution **9**

---

## 3. THE HUSH *(wild: silence becomes the villain)*

**Hook:** A fairytale wraith that feeds on awkward silence. The only weapon is talking to each other.

**How a session plays**
- **0:00.** The TV shows *the Hush*, a moth-grey creature that swells whenever the table goes quiet. A tabletop mic streams to Muse Voice Transcribe.
- **Every 8 to 10 s.** Muse Spark reads the latest stretch of transcript and turns it into "spells":
  - a question asked to another person: **Spark**
  - a "me too" moment of shared ground: **Bond**, double damage
  - a laugh: **Glow**
  - a callback to something said earlier: **Echo**, triple damage

  The TV names each hit in storybook type: *"Dana asked Leo about Lagos. The Hush recoils!"*
- **Each phone** holds a private **spell card** for anyone who freezes (*"Ask the person across from you what they'd do with a free Tuesday"*), refreshed when idle.
- **At 3:00** the Hush flees; Muse Image paints the victory beside a "Bonds Found" scroll of shared facts.

**Uncertainty killer: a shared enemy, plus a script on every phone.** Silence becomes the monster's fault, not yours; breaking it is a group attack, not a personal risk. Research:
- Starting a conversation is the scary part (Schroeder 2022 [V]).
- People wrongly expect conversations to run dry (Kardas, O'Brien & Schroeder 2022, "Keep talking," *JPSP* [V]).
- Equal turn-taking makes groups smarter (Woolley 2010 [V, in 05]).
- A vulnerable robot evened out how much humans talked to each other (Traeger 2020 [V, in 05]).

The Hush scores *the room*, never a person.

**Judging-table demo.** "Kill it in 3 minutes." Judges talk to each other, not us. The clip: two judges find a shared hometown and the Hush shrieks.

**What Muse does**
- **Voice Transcribe** in real time, at the core.
- **Spark:** classifying questions, shared ground and callbacks, and dealing adaptive cards.
- **Image:** the victory plate.
- **Connector:** `summon_the_hush`, so a Muse user can start a session for a gathering.

The most AI-essential idea of the five.

**Risks**
- Hall noise: USB table mic, push-to-talk fallback.
- 2 to 4 s latency: fine, damage animates afterward.
- Point-farming hollow questions: still start real conversations, which is the point.
- Feeling surveilled: live transcript shown on screen, deleted at session end.

**Build:** 10 to 14 hours as a standalone game, or about 5 hours as a lobby "boss" inside Once Upon a Roll.

**Scores:** Connection **8** · AI **9** · Originality **9** · Execution **5**

---

## 4. THE SLEEPING CASTLE *(wild: breaking pluralistic ignorance)*

**Hook:** A curse put the whole castle to sleep. Everyone thinks they're the only one awake.

**How a session plays**
- **0:00 to 1:30. Secret Wishes.** Phones privately show five wishes Muse wrote for this room (*"I've wanted to say hi to someone here and didn't"*, *"I'd rather talk than scroll right now"*). For each, you also predict **how many others said yes.** Plus one free-text: *"What do you wish someone would ask you about?"*
- **1:30 to 2:30. The Waking.** Each wish shows guess vs. actual (*"You guessed 2 of 6. It's 5."*) and the castle brightens. Narrator: *"The curse was only that each of you thought you were alone."*
- **2:30 to 4:00. First Light.** Muse clusters free-text wishes into cards: *"Someone here is dying to be asked about sourdough. Find them."* The writer opted in by writing it.

**Uncertainty killer: a reason, plus a visible norm correction.** The room learns it *wants* to talk before anyone risks anything, then each person gets a target known to welcome them. Research:
- Prentice & Miller 1993 and Schroeder & Prentice 1998 [V].
- Epley & Schroeder 2014 [V].
- Sandstrom & Boothby 2021 [V]: the main fear is that the *other* person won't enjoy it, and the wish card removes that fear.

**Judging-table demo.** A bar flips from 1 to 5; a judge goes and asks about the sourdough.

**What Muse does**
- **Spark:** writing context-fit wishes, clustering free text, writing the wish cards, and protecting anonymity (counts only, no small-group de-anonymizing).
- **Image:** a castle that brightens in stages.

The AI is thinner here: the reveal itself is counting.

**Risks**
- Thin anonymity at small tables: counts only, minimum 4 players.
- An honest "no" majority: wishes framed as "a little"; narration stays kind.

**Build:** about 7 to 9 hours (room sync and phones are reused, but the flow is new).

**Scores:** Connection **8** · AI **6** · Originality **8** · Execution **7**

---

## 5. THE BALLAD OF TWO STRANGERS *(wild: the AI bard who only listens)*

**Hook:** Two people talk for three minutes. A bard listens and turns what they said into an illustrated ballad, including the thing they had in common and never noticed.

**How a session plays**
- **0:00. Pairs face each other.** The AI bard deals **verse cards** that escalate in the Aron style and have a fairytale flavor:
  - Verse I: *"What small thing made you happy this week?"*
  - Verse II: *"What did you believe as a child that turned out wrong?"*
  - Verse III: *"What quest are you on right now?"*
- A shared mic transcribes; the bard **never speaks mid-conversation.**
- **2:30. The Golden Thread.** Muse shows one follow-up prompt built from what the AI heard: *"You both mentioned your grandmothers' kitchens. Tell each other about them."*
- **3:30. The Ballad.** A 6-line illustrated ballad quoting both verbatim, Golden Thread highlighted, saved to the storybook.

**Uncertainty killer: a script, plus a reason.** "We're making a ballad" is a legitimate excuse for personal questions, and the escalation sets the depth so nobody has to. Research:
- People underestimate how much they'll enjoy deep talk (Kardas, Kumar & Epley 2022 [V]).
- Turn-taking is in the design (Sprecher 2013).
- Perceived similarity draws people together (Byrne 1971 [M]), and the Golden Thread surfaces it.

**Judging-table demo.** Two judges pair up and get a ballad with a shared detail neither caught.

**What Muse does:** Voice Transcribe, Spark to find the shared thread and write the ballad around verbatim quotes, Image for the plate.

**Risks**
- Reads as "icebreaker questions with extra steps": the Golden Thread must be the selling point.
- No speaker separation: push-to-talk on each phone.

**Build:** 8 to 12 hours standalone. The Golden Thread alone could be a 2-hour finale for Once Upon a Roll.

**Scores:** Connection **8** · AI **9** · Originality **7** · Execution **6**

---

## Ranking

Weighted by Meta's rubric (30/25/20/20; the listed weights cover 95 of 100 points):

| Rank | Concept | Conn | AI | Orig | Exec | Weighted | Hours |
|---|---|---|---|---|---|---|---|
| 1 | **Mirror, Mirror** (merge) | 9 | 7 | 8 | 8 | **7.65** | 4–5 |
| 2 | The Hush | 8 | 9 | 9 | 5 | 7.45 | 10–14 (5 as lobby boss) |
| 3 | Masks Off (merge) | 7 | 8 | 7 | 9 | 7.30 | 3 |
| 4 | Ballad of Two Strangers | 8 | 9 | 7 | 6 | 7.25 | 8–12 |
| 5 | The Sleeping Castle | 8 | 6 | 8 | 7 | 6.90 | 7–9 |

## Recommendation: stay, and merge Mirror, Mirror as the finale

**Don't pivot.** With 18 hours, one engineer and a game ~80% working, a pivot trades a polished demo for an unfinished one, and execution (20%) is how first-time teams usually lose. The Hush is the boldest idea but depends on live audio in a loud hall: the wrong bet for tomorrow.

**Merge Mirror, Mirror (4 to 5 hours),** replacing the "Toasts" idea (05 #13). It answers the creative director's thesis directly and rescues the liking-gap idea without ratings. The pitch becomes:

> "Once Upon a Roll gives you the **excuse** to play together: a script, a role, a mask. The Mirror gives you the **proof**: you were seen more warmly than you guessed. The most effective loneliness interventions don't add more contact. They fix the expectation of rejection. Ours does that in 30 seconds, without rating anyone."

**If 3 hours remain, add Masks Off.** It personalizes character cards cheaply and gives guardians real material to notice.

**Cut order:** Masks Off, then the mirror portrait (keep text and voice). Never cut the Guess step: the gap between expected and actual is what moves people.

**Pitch-only borrowing:** *"Silence is the villain, not you"* (from The Hush) names the problem on stage without building it.
