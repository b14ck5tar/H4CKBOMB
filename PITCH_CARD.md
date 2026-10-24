# PITCH CARD: Once Upon a Roll

CD = Creative Director (talks, plays the Herald). ENG = Engineer (drives the laptop, hidden hotkeys).
Setup: laptop as TV, QR tent card, foam d20, room pre-warmed at the quest intro. **Never type for the judge. Hand them the QR first, talk second.**

## 3 lines to remember
1. **"Nobody has to be the Dungeon Master anymore."**
2. **"Every quest is today's news, told as a fairytale."**
3. **"Game night in thirty seconds, from the couch."**

## 4-minute beat sheet

| Time | Who | Say / do |
|---|---|---|
| 0:00 | CD | "When did you last play D&D? ...Right. Someone has to spend hours prepping as Dungeon Master, so most groups never play. **We made the AI the Dungeon Master.** Scan this, you're in the party." Hand over QR. |
| 0:20 | Judge | Scans, types a hero: "a retired knight afraid of geese." |
| | CD | "Muse Spark is building your stat card, Muse Image is painting you." Portrait takes about 14 s. Keep talking until it blooms. |
| 0:50 | ENG | Hits Begin. Map unrolls. |
| | CD | "Every quest is **real news from this week**, pulled with SerpApi, filtered for anything tragic, and Muse turns it into a fairytale. You won't know what really happened until the end." |
| 1:25 | Judge | Pitches an action (speak it or type it). |
| | CD | "The DM decides if that's even possible..." (stamp lands: RISKY · DC 18) "...and fate decides the rest. Shake your phone." d20 tumbles. Everyone throws emoji. |
| 2:00 | CD | **If a nat 1 happens:** "That's a Catastrophe. Now the Rescue Round: *they* pick who saves them." Hero in peril picks the savior. Savior title lands. |
| 2:25 | ENG | Hotkey: skip to the Final Roll. CD: "Normally it's three escalating scenes. Everyone rolls at once at the finale." |
| 2:55 | ENG | Storybook flips through its pages, then it lands on the bookshelf: "Book 1." |
| | CD | "Here's the part people screenshot." Page tears. "**This tale was inspired by real events.**" Real headline types out. **Pause. Let them read.** |
| 3:30 | CD | "Thirty seconds to start, no DM, no prep, and you just played the news with strangers. Spark is the DM brain and safety filter, Image paints every scene, Voice lets you just speak, SerpApi finds the story. Chapter 2 unlocks next week. Scan the storybook. It's yours." |

## Real latencies (use for filler)
Spark JSON call about 1.9 s. Portrait about 14 s. Scene image about 23 s. Never leave dead air: use the Herald voice ("The scribes are inking your likeness...") past 6 s. Scene plates are pre-generated, so the first scene is already painted.

## Top 8 judge Q&A

1. **How do you keep tragic news out?** Two stages. A keyword prefilter, then a Muse Spark classifier that rejects deaths, injuries, violence, war, disasters with casualties and divisive politics. We keep only repairable stories: something broke and a party could fix it. Real people become archetypes. The host has a one-tap new quest, and the reveal links the source.
2. **Why not just ChatGPT?** That is one person with a chatbot. This is a room: shared state, a TV plus phones, a Pitch Wall, voting, real dice, portraits and a keepsake storybook. Nobody wants to pass one laptop around.
3. **Where's the human connection (Meta)?** Co-op, so nobody wins alone. It deletes the DM's prep. Catch! costs your only Heart to save a friend, and in the Rescue Round the hero you failed picks their savior. The reveal gives you something to talk about afterward.
4. **How exactly do you use Muse?** Spark: quests, character cards, per-pitch verdicts, narration, epilogue, storybook, safety classification, all in strict JSON schemas. Image: portraits, scenes, cover. Voice Transcribe: push-to-talk pitches. All three are in every game.
5. **How does SerpApi matter?** Google News via SerpApi is the source of every quest and of the reveal: headline, direct publisher link, source, date. It is cached and pre-generated, so no game ever waits on it.
6. **What stops the AI from breaking the rules?** The AI never touches a number. The server rolls the dice, code computes DCs, totals and Hope. The model only proposes a tier and prose inside a strict JSON schema.
7. **What was hardest?** Latency. A portrait is about 14 s and a scene about 23 s. We hide it with sketch-to-color placeholders, pre-generated scene plates, phrase-by-phrase narration and Herald lines.
8. **Business / what's next?** Weekly chapters on the party's bookshelf, Messenger and WhatsApp video-call play, themed quest packs, and a classroom news-literacy mode. Every shared storybook is a free ad.

(Novice judge? CD, say: "This is my first hackathon. I did the name, the look, the narrator and this pitch.")

## 60-second stage version
"D&D is one of the best ways friends bond, but someone has to spend hours prepping as Dungeon Master, so most groups never play. We're **Once Upon a Roll**, and we made the AI the Dungeon Master. Open the laptop, everyone scans a code, type one line like 'a knight afraid of geese,' and Meta's Muse builds your character and paints your portrait. Every quest is a real headline from this week's news, filtered for anything tragic and reimagined as a fairytale. Everyone pitches an idea, the AI rules whether it's possible, the party votes, and a d20 decides. Roll a 1 and you're in peril, and the hero in peril picks who rescues them. Roll a 20 and it's legend. At the end you get an illustrated storybook for your bookshelf, and its last page says *'This tale was inspired by real events,'* with the real headline. Game night in thirty seconds, from the couch. Nobody has to be the DM anymore."

## If something breaks
- **Generation stalls past 6 s:** CD fills with the Herald voice ("The scribes are inking your likeness..."). ENG waits for the canned fallback.
- **Portrait never arrives:** the sketch placeholder stays. CD: "The scribe is still painting. Your hero is real."
- **Muse is slow or down:** the app falls back to Gemini, then canned lines. Keep narrating.
- **News/SerpApi issue:** quests are pre-cached. If needed, ENG hits the reroll-quest hotkey for a seed quest.
- **Voice fails:** "The scribe dozed off." Judge types instead.
- **Phone won't join:** ENG joins from the laptop's second tab. Or hand over the next judge's phone.
- **Nat 1 or nat 20 won't come:** ENG uses the test hotkey to force it. Never mention it.
- **Wi-Fi dies:** switch to the phone hotspot. If that fails, play the backup video (stored on laptop and phone) and narrate over it.
- **Something offensive is typed:** the DM redirects in character. CD smiles and moves on.
- **Past 4:00:** ENG skips to the reveal. Always end on the newsprint.
