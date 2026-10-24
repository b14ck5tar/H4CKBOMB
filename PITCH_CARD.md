# PITCH CARD: Group Project

*The one group project everyone actually wants to be in.*

CD = Creative Director (talks, plays the host). ENG = Engineer (drives the laptop, hidden hotkeys).
Setup: laptop as TV, QR tent card, room pre-warmed at the quest intro. **Never type for the judge. Hand them the QR first, talk second.**

Items marked **(if shipped)** only get said if they are live in the build you are demoing. If not, skip the line, do not apologize, and do not describe it as working.

## Meta's rubric, and our one memorable beat for each

Meta judges score: **Human connection 30% · AI essential and integrated 25% · Originality 20% · Working demo 20%.** Top 3 teams get the Round 2 invite to Menlo Park, so the last 20 seconds of every pitch is a four-line scorecard.

| Criterion | Weight | Our beat (say it) | Where it lands in the demo |
|---|---|---|---|
| **Human connection** | 30% | **"A game night that gives everyone an excuse to talk to each other."** | Opening hook, the secret clues, Convince the DM, Catch!, Mirror, Mirror (if shipped), the shared reveal |
| **AI essential + integrated** | 25% | **"Muse is the Dungeon Master, so nobody has to prep."** | The ruling, Convince the DM, portraits and scenes, hold-to-talk, the connector |
| **Originality** | 20% | **"Real news, one uncanny explanation."** | The quest intro and "The official story" vs "What your group uncovered" |
| **Working demo** | 20% | **"Live on your phone, not a mockup."** | The judge scans, plays and rolls on their own device; real RNG; the fallback chain |

## 3 lines to remember
1. **"The one group project everyone actually wants to be in."**
2. **"A game night that gives everyone an excuse to talk to each other."**
3. **"Muse is the Dungeon Master. You just show up and talk."**

## The thesis (say it in your own words)
People avoid each other mostly out of uncertainty, not fear. We follow the crowd's silence. And we underestimate how much others enjoy us. Tabletop games fix this by giving everyone a role, a reason and a script. The only problem is that someone has to prep as Dungeon Master. Muse is the DM.

## How it works
*Full-screen version: `design/how-it-works.html`. Say: "Muse writes and judges. Code rolls and checks. Players play." If asked what the AI does behind the scenes, point at the DM's Notes, which shows every decision live.*

```mermaid
flowchart LR
  subgraph L1["1. Story pipeline"]
    direction LR
    N["Real news<br/>SerpApi Google News + RSS"] --> F["Safety filter<br/>keyword block + Muse classifier<br/>no deaths, politics, private people"] --> S["Muse: facts become a<br/>supernatural story<br/>each fact maps to an element"] --> P["Muse Image:<br/>pre-painted scenes"]
  end
  subgraph L2["2. One round at the table"]
    direction LR
    C["Secret clue<br/>on each phone"] --> Q["Everyone pitches<br/>type or Muse Voice"] --> R["Muse rules each plan<br/>Clever = no roll ... Miracle<br/>with a reason"] --> V["Convince the DM<br/>argue once"] --> D["Real random dice<br/>code, never AI"] --> B["Muse writes one beat<br/>per hero, quoting them"] --> K["Server checks + scrubs<br/>schema, kind-only, no AI tells"] --> T["TV + phones"]
  end
  P -.-> C
  X["Context the DM keeps:<br/>goal, canon facts, open complications,<br/>each hero's clue/titles/peril, last recaps"] -.-> R
  X -.-> B
  classDef muse fill:#FF2E7E,color:#0A0612
  classDef code fill:#3DE7FF,color:#0A0612
  classDef chk fill:#2CF5C0,color:#0A0612
  classDef ppl fill:#FFB648,color:#0A0612
  class S,P,R,B muse
  class N,C,D,T code
  class F,K chk
  class Q,V ppl
```

**Guardrails:** dice are real RNG. AI judges ideas, never people. No real people or brands. Player text is in-world speech (typed "ignore all previous instructions" and got "Pip shouts gibberish magic words at the sky."). Mirror sentences are kind-only. Fallbacks, so the table never freezes. DM's Notes shows every decision live.

## 4-minute table demo (built on the 30/25/20/20 rubric)

Tags in brackets show which criterion each beat is scoring. Demo quest: the 80-ton boulder that fell at a New Hampshire park (nobody hurt).

| Time | Who | Say / do |
|---|---|---|
| 0:00 | CD | **[CONNECTION]** "Quick question. Last time you were in a room full of people you kind of knew, who started the conversation? ...Right. Nobody. We're not scared of each other. We're just unsure, so we wait for someone else to talk. Tabletop games fix that, because everyone gets a role, a reason and a script. But someone has to prep as Dungeon Master. **So Muse is the DM.** Scan this, you're in." Hand over QR. |
| 0:20 | Judge | **[DEMO]** Scans on their own phone, types a hero: "a retired knight afraid of geese." CD: "No app, no account." |
| 0:35 | CD | **[AI]** "Muse Spark is writing your character, Muse Image is painting you. Notice you're a cartoon character on purpose. Nobody has to be on camera to play." Portrait takes about 14 s. Keep talking until it appears. |
| 0:55 | ENG | Hits Begin. Quest intro appears. |
| | CD | **[ORIGINALITY]** "Every quest is **real news from this week**, filtered for anything tragic or political, with one uncanny explanation added. An 80-ton boulder fell at a New Hampshire park and nobody got hurt. Tonight, we find out why." |
| 1:20 | CD | **[CONNECTION]** "Look at your phone. You each got a private clue the others don't have. Nobody can solve this alone, so you have to talk." Let the table talk for a few seconds. Do not rush it. |
| 1:40 | Judge | Makes a plan (speak it or type it). |
| | CD | **[AI]** "Muse rules on it..." (verdict lands: Clever, Solid, Risky, Absurd or Miracle) "A Clever plan works, no roll." If the ruling is harsh: "Now **Convince the DM**. You get one shot, by voice or text. A good argument can upgrade your plan to a sure thing." Judge argues. Verdict updates. |
| 2:10 | CD | **[CONNECTION]** "Everyone acts every round. No voting, so nobody's idea gets left out. See that 🔥? Boost a friend's plan and they roll better." Everyone rolls. "And if your friend fails, **Catch!** Spend your one heart to re-roll it." |
| 2:30 | CD | If a disaster happens: "Now you're stuck, and your friends have to rescue you next scene." Then: "Each hero gets one story beat, in your own words." Read one back to the table. |
| 2:45 | ENG | **[AI + DEMO]** **Muse connector beat (if shipped):** opens Muse, the personal agent, and types: "Start a game night for me and Mira." Muse calls our MCP endpoint (`start_game_night`, `list_todays_tales`, `invite_message`): a room appears on the TV and Muse drafts the invite. CD: "Muse doesn't just run the game. Muse can start the night." |
| 3:05 | ENG | Hotkey: skip to the Final Roll. CD: "Normally it's three scenes, then everyone makes their final move at once." Epilogue plays. |
| 3:15 | CD | **[ORIGINALITY + CONNECTION]** "Here's what really happened." **"The official story"** (the real headline) on one side, **"What your group uncovered"** on the other. **Pause. Let them read and laugh.** Keepsake is saved to the shelf: "Next chapter, same crew." |
| 3:35 | CD | **Mirror, Mirror (if shipped):** "One last thing. Each of you was secretly someone's guardian and wrote one kind sentence about their best moment. Guess what was written about you." ("Probably nothing.") TV reveals them. "Nobody ever rates anyone." |
| 3:45 | CD | **Scorecard close (say all four, one breath each):** "**Connection:** a role, a reason and a script, so everyone has something to say. **AI:** Muse is the DM, the painter, the ears, and can start the night. **Original:** real news with one uncanny explanation. **Working:** you just played it on your own phone." |

If the connector or Mirror, Mirror did not ship, give their time back to Convince the DM and the reveal. Never drop the scorecard.

## Research lines for "human connection" (30%)

Use 1 or 2 per pitch, never all of them. Keep the hedges exactly as written.

1. **The liking gap.** "After a conversation, people consistently underestimate how much the other person liked them (Boothby 2018, *Psychological Science*). That's why the quiet room stays quiet." *(Mirror, Mirror is built on this.)*
2. **Mistakenly seeking solitude.** "Commuters assigned to talk to a stranger enjoyed it more than they predicted (Epley and Schroeder 2014)." Say "in that study" and don't generalize.
3. **Laughter bonds.** "Shared laughter releases endorphins and bonds groups (Dunbar 2012, *Proc. Royal Society B*)."
4. **AI that faces the group.** "A robot that made a small vulnerable remark got human teammates to talk more to each other, and more evenly (Traeger 2020, *PNAS*). Our AI talks to the table, not to you alone."
5. **The problem.** "The US Surgeon General called loneliness an epidemic in 2023, and linked lacking social connection to mortality risk comparable to smoking up to 15 cigarettes a day." *(Keep the "up to".)*

**Do not say:** "oxytocin builds trust" (contested). "A study shows [any party game] improves connection" (we have none). The Surgeon General figure without "up to". "Your AI friend" (we are a host, not a companion). Do not claim one evening cures loneliness.

## Real latencies (use for filler)
Spark JSON call about 1.9 s. Portrait about 14 s. Scene image about 23 s. Never leave dead air: past 6 s, CD talks ("The artist is still inking your likeness...") and the TV shows placeholder sketches. Demo scenes are pre-painted.

## Judge Q&A, by rubric criterion

### Human connection (30%)
1. **Where's the human connection?** We designed against why people stay quiet: uncertainty and a crowd's silence. Each phone has a private clue, so the table has to talk. Everyone acts every round and nobody's idea is voted out. Friends boost each other's plans, spend a heart to Catch a fail, and rescue a stuck hero. Mirror, Mirror (if shipped) ends the night with a kind sentence about each person.
2. **Isn't a phone-and-TV game just more screens?** The TV is the shared focus and the phones carry the secrets. The secret clues exist to make people look up and talk to each other, not into a phone.
3. **Does one evening really connect anyone?** We don't claim one night does. It lowers the cost of starting a conversation, and the keepsake shelf ("next chapter, same crew") is how nights add up.
4. **Why a game and not a chat prompt?** A prompt hands you a question. A game hands you a role, a reason and a script, and that's what removes the uncertainty.

### AI essential and well integrated (25%)
5. **How exactly do you use Muse?** Spark: characters, scenes, rulings, appeals, beats, epilogue, keepsake. Image: portraits and scenes. Voice Transcribe: hold-to-talk plans and arguments. The MCP connector at `/api/mcp` lets Muse start the night. Remove the AI and there is no DM, so no game.
6. **Why not just ChatGPT?** That's one person and a chatbot. This is a room: a shared screen, private clues per phone, a ruling for every player, real dice, and a keepsake. The AI faces the group.
7. **Does the AI sound like AI?** We worked at it. Research-driven voice rules, a banned list of AI-tell words, and a server-side scrubber. Players' own words get quoted back to them.
8. **What stops the AI from breaking rules or being manipulated?** The server rolls the dice and code computes the outcomes. The model proposes a ruling and prose inside a strict schema. We tested "ignore all previous instructions": it became "Pip shouts gibberish magic words at the sky."
9. **What does the Muse connector do? (if shipped)** An MCP endpoint at `/api/mcp` with `start_game_night`, `list_todays_tales` and `invite_message`. Muse can open a room, show tonight's quests and draft the invite. Muse drafts; the human sends.

### Originality (20%)
10. **What's new here?** The AI doesn't replace the group, it hands everyone a reason to talk. Real news becomes modern urban fantasy with one uncanny explanation. And the reveal ("The official story" vs "What your group uncovered") ties it back to the real world.
11. **How do you keep tragic news out?** A keyword prefilter, then a Muse Spark classifier. No tragedies, no real victims, no politics. We keep strange, harmless stories where nobody was hurt. The reveal links the real source.
12. **Why cartoon characters instead of realistic people?** Deliberate. It keeps the game silly, protects privacy, and means nobody is judged on their face.

### Working demo (20%)
13. **Is this real, or a mockup?** You just played it. Next.js on Vercel, Supabase Realtime sync, all three Muse models called from server routes, server RNG for the dice. Fallbacks: Muse, then Gemini, then canned text.
14. **How does SerpApi matter?** Google News via SerpApi is where quests and the real headline come from. It's cached and pre-generated, so no game waits on it.
15. **What was hardest?** Two things. Latency (a portrait is about 14 s and a scene about 23 s), and making the AI sound like a human DM. After playtesting we rebuilt the voice and replaced voting with rounds where everyone acts.
16. **How did you build it in a weekend?** Claude Code (Anthropic) orchestrating parallel agents for research, art direction, the news pipeline, voice and code review. Muse runs inside the product.

(Novice judge? CD, say: "This is my first hackathon. The thesis, the name, the look, the narrator and this pitch are mine.")

## 60-second stage version
"Most of us don't avoid each other because we're scared. We avoid each other because we're unsure, and we follow the crowd's silence. We also underestimate how much people enjoy us. Tabletop games fix that by giving everyone a role, a reason and a script. But someone has to prep as Dungeon Master. We're **Group Project**, the one group project everyone actually wants to be in, and **Muse is your DM**. Everyone scans a code and gets a cartoon hero. Every quest is a real news story from this week, filtered for anything sad or political, with one uncanny explanation: why did an 80-ton boulder fall at a New Hampshire park? Each phone gets a private clue, so you have to talk. Everyone makes a plan, Muse rules on it, and you can *convince the DM* with one good argument. Friends boost plans, catch failed rolls and rescue stuck heroes. At the end the TV shows the official story next to what your group uncovered, and the night is saved to your shelf: next chapter, same crew. A game night that gives everyone an excuse to talk to each other."

## If something breaks
- **Generation stalls past 6 s:** CD fills ("The artist is still inking your likeness..."). ENG waits for the canned fallback.
- **Portrait never arrives:** the sketch placeholder stays. CD: "The artist is still painting. Your hero is real."
- **Muse is slow or down:** the app falls back to Gemini, then canned lines. Keep talking.
- **Muse connector fails or isn't live:** skip the beat. If it errors on stage, ENG shows the pre-recorded clip of Muse calling the three tools, and CD says "Here it is from an earlier run." Never imply it ran live if it did not.
- **News/SerpApi issue:** quests are pre-cached. If needed, ENG hits the reroll-quest hotkey for a seed quest.
- **Voice fails:** "The mic is shy." Judge types instead.
- **Phone won't join:** ENG joins from the laptop's second tab, or hand over the next judge's phone.
- **Disaster roll won't come:** ENG uses the test hotkey to force it. Never mention it.
- **Wi-Fi dies:** switch to the phone hotspot. If that fails, play the backup video (stored on laptop and phone) and narrate over it.
- **Something offensive is typed:** the DM redirects in character. CD smiles and moves on.
- **Past 4:00:** ENG skips to the reveal, then the scorecard. Always end on "The official story" vs "What your group uncovered" and the four lines.
