# PITCH CARD: Once Upon a Roll

CD = Creative Director (talks, plays the Herald). ENG = Engineer (drives the laptop, hidden hotkeys).
Setup: laptop as TV, QR tent card, foam d20, room pre-warmed at the quest intro. **Never type for the judge. Hand them the QR first, talk second.**

Items marked **(if shipped)** only get said if they are live in the build you are demoing. If not, skip the line, do not apologize, and do not describe it as working.

## Meta's rubric, and our one memorable beat for each

Meta judges score: **Human connection 30% · AI essential and integrated 25% · Originality 20% · Technical execution / working demo 20%.** Top 3 teams get the Round 2 invite to Menlo Park, so the last 20 seconds of every pitch is a four-line scorecard.

| Criterion | Weight | Our beat (say it) | Where it lands in the demo |
|---|---|---|---|
| **Human connection** | 30% | **"Phones down, eyes up."** | Opening hook, Look Up! (if shipped), Catch!/Rescue + Thank your savior (if shipped), the shared reveal gasp |
| **AI essential + integrated** | 25% | **"The AI sets the stakes. The friends decide. The dice are real."** | Stat card and portrait, the verdict stamp, the Muse connector, Spotlight (if shipped) |
| **Originality** | 20% | **"Today's news, told as a fairytale."** | The quest intro and the newsprint reveal |
| **Technical execution** | 20% | **"Live on your phone, not a mockup."** | The judge scans, plays and rolls on their own device; real RNG; the fallback chain |

## 3 lines to remember
1. **"Nobody has to be the Dungeon Master anymore."**
2. **"Every quest is today's news, told as a fairytale."**
3. **"Game night in thirty seconds, from the couch."**

## 4-minute table demo (built on the 30/25/20/20 rubric)

Tags in brackets show which criterion each beat is scoring.

| Time | Who | Say / do |
|---|---|---|
| 0:00 | CD | **[CONNECTION]** "When did you last play D&D with friends? ...Right. Someone has to spend hours prepping as Dungeon Master, so most groups never play. **We made the AI the Dungeon Master, so the friends can just be friends.** Scan this, you're in the party." Hand over QR. |
| 0:20 | Judge | **[EXECUTION]** Scans on their own phone, types a hero: "a retired knight afraid of geese." CD: "No app, no account. Room code or QR, that's it." |
| 0:35 | CD | **[AI]** "Muse Spark is building your stat card, Muse Image is painting you." Portrait takes about 14 s. Keep talking until it blooms. |
| 0:55 | ENG | Hits Begin. Map unrolls. |
| | CD | **[ORIGINALITY]** "Every quest is **real news from this week**, pulled with SerpApi, filtered for anything tragic, and Muse turns it into a fairytale. A collapsed bridge becomes a dragon in the rubble. You won't know what really happened until the end." |
| 1:25 | Judge | Pitches an action (speak it or type it). |
| | CD | **[AI]** "The DM decides if that's even possible..." (stamp lands: RISKY · DC 18) "...and fate decides the rest. Notice the AI never rolls and never ranks you. It rates the idea, your friends pick the winner, and the dice are real. Shake your phone." d20 tumbles. Everyone throws emoji. |
| 1:50 | CD | **[CONNECTION]** *Look Up! (if shipped):* "Watch the phones. They go dark while the story is told: just one card that says *Look at the table*. Phones come alive only when it's your turn to pitch or vote. Phones down, eyes up." |
| 2:05 | CD | **[CONNECTION]** **If a nat 1 happens:** "That's a Catastrophe. Now the Rescue Round: *they* pick who saves them." Hero in peril picks the savior. Savior title lands. *Thank your savior (if shipped):* the rescued phone gets a 5-second one-tap thanks ("I owe you a pie"), and the DM reads it out. "A failure just turned into a friendship." |
| 2:30 | CD | **[AI]** *Spotlight (if shipped):* "The narrator tracks who hasn't had a moment and calls them by name: 'The troll is staring at *Mira*...' The AI raises the floor so nobody gets talked over." |
| 2:40 | ENG | **[AI + EXECUTION]** **Muse connector beat (if shipped):** opens Muse, the personal agent, and types: "Start a game night for me and Mira." Muse calls our MCP endpoint (`start_game_night`, `list_todays_tales`, `invite_message`): a room appears on the TV and Muse drafts the invite text. CD: "Our game isn't just *using* Muse, **Muse can run it.** Your agent sets up game night and nudges your friends to show up." |
| 3:00 | ENG | Hotkey: skip to the Final Roll. CD: "Normally it's three escalating scenes. Everyone rolls at once at the finale." Storybook flips, lands on the bookshelf: "Book 1." |
| 3:15 | CD | **[ORIGINALITY + CONNECTION]** "Here's the part people screenshot." Page tears. "**This tale was inspired by real events.**" Real headline types out. **Pause. Let them read.** The room reacts together; let them talk about it. |
| 3:40 | CD | **Scorecard close (say all four, one breath each):** "**Connection:** phones down, eyes up, friends saving friends. **AI:** the DM brain, painter, scribe and now Muse can start the night, with real dice. **Original:** today's news as a fairytale. **Working:** you just played it on your own phone. Chapter 2 unlocks next week. Scan the storybook. It's yours." |

If Look Up!, Thank your savior, Spotlight or the connector did not ship, give their time back to the roll and the reveal. Never drop the scorecard.

## Research lines for "human connection" (30%)

Use 1 or 2 per pitch, never all five. Keep the hedges exactly as written.

1. **The problem.** "The US Surgeon General called loneliness an epidemic in 2023, and linked lacking social connection to mortality risk comparable to smoking up to 15 cigarettes a day. We built a reason to sit on the same couch tonight." *(US Surgeon General 2023. Keep the "up to".)*
2. **Laughter bonds.** "Shared laughter releases endorphins and bonds groups. Dunbar 2012 found it raises pain thresholds, and PET scans show social laughter triggers the brain's own opioids (Manninen 2017). Our game is a machine for making a room laugh at the same time."
3. **Phones down.** "Having phones out at a meal made people enjoy it less (Dwyer, Kushlev and Dunn 2018). So during the story our phones go dark and everyone looks at the table." *(Pair with Look Up!, if shipped. Przybylski and Weinstein 2013 on phones and closeness is directional only: replications are mixed.)*
4. **AI that faces the group.** "A robot that made a little vulnerable remark got human teammates to talk more to each other, and more evenly (Traeger 2020, *PNAS*). Our AI talks to the table, not to you alone."
5. **Hardship and thanks.** "Strangers who share a hardship bond and cooperate more (Bastian 2014, *Psychological Science*), and people underestimate how good a thank-you feels (Kumar and Epley 2018). So you fail spectacularly, a friend chooses to save you, and you say thanks."

**Do not say:** "oxytocin builds trust" (the effect is contested). "A study shows Jackbox helps connection" (none exists). The Surgeon General cigarette figure without "up to". "Your AI friend" (we are a host, not a companion).

## Real latencies (use for filler)
Spark JSON call about 1.9 s. Portrait about 14 s. Scene image about 23 s. Never leave dead air: use the Herald voice ("The scribes are inking your likeness...") past 6 s. Scene plates are pre-generated, so the first scene is already painted.

## Judge Q&A, by rubric criterion

### Human connection (30%)
1. **Where's the human connection?** Co-op, so nobody wins alone. It deletes the DM's prep, which is the main bottleneck keeping friends from playing. Catch! costs your only Heart to save a friend, and in the Rescue Round the hero you failed picks their savior. Phones go dark during the story so eyes stay on each other (Look Up!, if shipped). The reveal gives you something to talk about afterward.
2. **Isn't a phone-and-TV game just more screens?** Screens isolate when they pull attention away from the people in the room. Ours is one shared screen everyone looks at, with phones used only to pitch and vote. Research on co-located play says a co-player in the room adds fun and presence compared with online play (Gajadhar 2008).
3. **Does one evening really connect anyone?** One tale is a low-risk dose of contact, and a hero's mask makes reaching out cheap. The bookshelf and weekly chapters are how doses add up: friendship research puts casual friend at roughly 50 hours together and close friend at 200 or more (Hall 2019). We are not claiming four minutes does it.

### AI essential and well integrated (25%)
4. **How exactly do you use Muse?** Spark: quests, character cards, per-pitch verdicts, narration, epilogue, storybook, safety classification, all in strict JSON schemas. Image: portraits, scenes, cover. Voice Transcribe: push-to-talk pitches. All three are in every game. Remove the AI and there is no Dungeon Master, so there is no game.
5. **Why not just ChatGPT?** That is one person with a chatbot. This is a room: shared state, a TV plus phones, a Pitch Wall, voting, real dice, portraits and a keepsake storybook. The AI faces the group, not one user.
6. **What stops the AI from breaking the rules or judging people?** The AI never touches a number. The server rolls the dice, code computes DCs, totals and Hope. The model only proposes a tier and prose inside a strict JSON schema. It rates whether an idea is feasible, never who is better. Players and dice decide.
7. **What does the Muse connector do? (if shipped)** It is an MCP endpoint at `/api/mcp` with three tools: `start_game_night`, `list_todays_tales` and `invite_message`. Muse, the personal agent, can open a room, show tonight's quests and draft the invite, so the AI helps people get together, not just play. Muse drafts; the human sends.

### Originality (20%)
8. **What's new here?** Three things together. The AI takes the Dungeon Master's chair. Every quest is a real headline from this week, made safe and told as a fairytale. And the newsprint reveal turns the joke into a conversation about the real world.
9. **How do you keep tragic news out?** Two stages. A keyword prefilter, then a Muse Spark classifier that rejects deaths, injuries, violence, war, disasters with casualties and divisive politics. We keep only repairable stories: something broke and a party could fix it. Real people become archetypes. The host has a one-tap new quest, and the reveal links the source.

### Technical execution (20%)
10. **Is this real, or a mockup?** You just played it. Next.js on Vercel, Supabase Realtime sync, all three Muse models called from server routes. The server RNG rolls the dice. Fallbacks: Muse, then Gemini, then canned text.
11. **How does SerpApi matter?** Google News via SerpApi is the source of every quest and of the reveal: headline, direct publisher link, source, date. It is cached and pre-generated, so no game ever waits on it.
12. **What was hardest?** Latency. A portrait is about 14 s and a scene about 23 s. We hide it with sketch-to-color placeholders, pre-generated scene plates, phrase-by-phrase narration and Herald lines.
13. **How did you build it in a weekend?** Claude Code (Anthropic) as lead engineer, orchestrating parallel subagents for research, the news pipeline, voice, juice and animation, and docs. Meta's Muse models run inside the product. (Business / what's next: weekly chapters on the party's bookshelf, Messenger and WhatsApp video-call play, themed quest packs, a classroom news-literacy mode.)

(Novice judge? CD, say: "This is my first hackathon. I did the name, the look, the narrator and this pitch.")

## 60-second stage version
"D&D is one of the best ways friends bond, but someone has to spend hours prepping as Dungeon Master, so most groups never play. We're **Once Upon a Roll**, and we made the AI the Dungeon Master. Open the laptop, everyone scans a code, type one line like 'a knight afraid of geese,' and Meta's Muse builds your character and paints your portrait. Every quest is a real headline from this week, filtered for anything tragic and reimagined as a fairytale. Everyone pitches an idea, the AI rules whether it's possible, the party votes, and a d20 decides. Roll a 1 and you're in peril, and the hero in peril picks who rescues them. Roll a 20 and it's legend. Muse, Meta's personal agent, can even start the night and invite your friends *(if shipped)*. At the end you get an illustrated storybook, and its last page says *'This tale was inspired by real events,'* with the real headline. Phones down, eyes up. Game night in thirty seconds, from the couch. Nobody has to be the DM anymore."

## If something breaks
- **Generation stalls past 6 s:** CD fills with the Herald voice ("The scribes are inking your likeness..."). ENG waits for the canned fallback.
- **Portrait never arrives:** the sketch placeholder stays. CD: "The scribe is still painting. Your hero is real."
- **Muse is slow or down:** the app falls back to Gemini, then canned lines. Keep narrating.
- **Muse connector fails or isn't live:** skip the beat. If it errors on stage, ENG shows the pre-recorded clip of Muse calling the three tools, and CD says "Here it is from an earlier run." Never imply it ran live if it did not.
- **News/SerpApi issue:** quests are pre-cached. If needed, ENG hits the reroll-quest hotkey for a seed quest.
- **Voice fails:** "The scribe dozed off." Judge types instead.
- **Phone won't join:** ENG joins from the laptop's second tab. Or hand over the next judge's phone.
- **Nat 1 or nat 20 won't come:** ENG uses the test hotkey to force it. Never mention it.
- **Wi-Fi dies:** switch to the phone hotspot. If that fails, play the backup video (stored on laptop and phone) and narrate over it.
- **Something offensive is typed:** the DM redirects in character. CD smiles and moves on.
- **Past 4:00:** ENG skips to the reveal, then the scorecard. Always end on the newsprint and the four lines.
