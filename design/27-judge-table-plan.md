# 27. Judge table run-of-show (Sun Oct 25, judging 2 to 5 PM, WEL)

Goal: every judge plays one real turn on their own phone, sees a friend's idea win "+1", throws the die, and leaves
on the "Based on a true story" reveal, inside ~4 minutes. Judges are free to leave mid-game; the table should make
them want to come back.

Sources: DECISIONS.md (judge demo, Sun ~12:30 AM and ~1 AM calls), design/13 (judge demo), design/22 (the Meta
rep's lenses: the flow works, the AI feels magical, how we built it with AI), PITCH_CARD.md (lines and Q&A).

CD = creative director (host, talks to judges). ENG = engineer/partner (laptop, hotkeys, fixes, Q&A on the build).

---

## 1. Setup (arrive 1:30 PM; the pitching workshop is 1 PM in GDC 5.302 if you go)

### Hardware checklist
- [ ] **Laptop as the TV**, lid facing the judges, charger plugged in, power saving and sleep **off**.
- [ ] **External screen if one is free** (a monitor or TV at WEL, or ask an organizer). HDMI/USB-C adapter in the
      bag. Mirror is fine; extend is better (TV on the big screen, laptop keeps DM's Notes or the deck).
- [ ] **QR stand:** a printed card beside the screen with a QR for **groupproject-game.vercel.app/play** and the
      line "Scan the TV, or open this and type the 4 letters on screen". The room code changes every game, so the
      lobby's own QR (it carries the code) stays the fast path; the card is for judges at the back and for later.
- [ ] **Sound on:** laptop volume ~70%, or a small Bluetooth speaker. The narrator and the dice are half the magic.
      Test it in the room; WEL is loud during judging.
- [ ] **Phone hotspot ready** on ENG's phone (name and password known, battery > 70%, charging from a power bank).
- [ ] **Chargers:** laptop charger, a power bank, 2 cables for phones.
- [ ] **Two spare phones** (team phones) already on `/play`, for judges who don't want to scan or have a dead phone.
- [ ] **Backup video** (the Meta video MP4) downloaded on the laptop and on a phone.
- [ ] Laptop: Do Not Disturb, notifications off, other tabs closed, bookmarks bar hidden.

### Browser tabs (in this order, all on the deployed site)
1. **TV:** `https://groupproject-game.vercel.app/tv?bots=1`, full screen (F11). Lobby set to **Quick Tale**,
   **Odd news**, **Teens** (Adults only if the judges ask for it).
2. **Deck:** `https://groupproject-game.vercel.app/pitch/deck.html` (slide 8, the QR, is the backdrop between groups).
3. **Backup:** the video file, ready to play.

### Ten minutes before the first judge
- [ ] Play one full warm-up Quick Tale (2 of us + 1 bot). It wakes Muse, caches the news and checks the narrator.
- [ ] Check: the narrator speaks, paintings change per decision, swipe-to-throw works on both team phones, the
      reveal shows the real article.
- [ ] Reset (section 6), then leave the lobby on the **attract screen** (press **A**, or wait 20 s with nobody
      joined). It loops hero-in-scene art and one pitch line, so passing judges see something moving.

### Hotkeys (TV laptop; ENG only, never in front of the judge's hands)
| Key | Does |
|---|---|
| A | Attract screen on/off |
| B | Add a test player (lobby only; up to 3 bots: Riley, Sam, Jo) |
| Q | Quick Tale + begin (picks the demo story if none is chosen) |
| Space | Continue on a reading screen |
| S | Skip the current timer |
| N | DM's Notes: every AI call, live |
| H | Help overlay |
| Esc | Close notes, help, attract |

---

## 2. Bots for empty seats

- The game needs 2+ players. **One judge alone:** ENG joins as a human from a team phone (so the judge's friend
  suggestion comes from a real person), and press **B** once for a third hero.
- **Two judges:** press **B** once (3 heroes) so there are always two suggestions per turn. Keep it to at most 4
  heroes total in Quick Tale, or the 4 minutes run over.
- **Three or more judges:** no bots.
- Say it plainly: "Riley is a test player the TV runs, so you have someone to help you." Never pass a bot off as a
  person.

---

## 3. Who says what

- **CD talks to the judges.** The opener, coaching each turn, the reveal, the scorecard close. CD faces the judges,
  not the screen.
- **ENG is silent until needed.** Starts the game, presses Space/S if a screen lingers, watches DM's Notes on the
  second screen, answers build questions (models, cost, privacy, how we used AI). ENG takes over the talk if a judge
  asks something technical mid-game, so CD keeps the table playing.
- **Rule for both:** hand them the QR first, talk second. Never type for a judge. When the judges are arguing about
  an idea, stop talking.

---

## 4. The 4-minute flow (Quick Tale)

| Clock | Who | Do / say |
|---|---|---|
| 0:00 | CD | **Opener (connection first):** "Quick question: last time you hung out with friends, how much of it was everyone on their phone? *(beat)* This is Group Project, the one group project where everyone actually shows up. The TV is the table, your phone's the controller, and Meta's Muse is the Dungeon Master. Scan this, you're in." Point at the QR. |
| 0:20 | Judges | Scan, type a hero in one line, answer "What are you weirdly good at?" CD: "No app, no account. Muse is painting you as a cartoon right now." If someone stalls past 20 s: "Tap a ready-made hero, they're instant." |
| 0:45 | ENG | Adds a bot if needed (section 2), presses Start. CD: "Each story hides something that really happened this week. You'll find out what at the end." |
| 1:00 | CD | Opening painting + narrator. CD, quietly over it: "Muse wrote this, picked that narrator for the mood, and painted all of you into the scene." Then stop talking. |
| 1:15 | CD | **First turn (the connection beat).** "It's [Judge A]'s turn. Everyone else: send them an idea on your phone. [A], pick one. If you use a friend's idea you get plus one and their name goes up there." **Coach the pick:** "Which one made you laugh?" Then stop talking and let them argue. |
| 1:50 | CD | **Swipe.** "Swipe up on your phone to throw." The die flies onto the TV. As the meter fills: "Every number is its own outcome, disaster to legendary. The dice come from code, never the AI." |
| 2:00 | CD | **New painting.** Point at the crossfade: "Every decision gets a new painting with you in it." On a low roll: "A bad roll never stops the story, it makes it worse. That's the fun part." |
| 2:00 to 3:00 | Judges | Remaining turns (30 s timers; the turn ends early once everyone has sent). CD only names whose turn it is. |
| 3:00 | CD | **Finale:** "Last move. Everyone back one plan, not your own. Then everyone shakes your phone at the same time. One die for the whole table." |
| 3:25 | CD | **Reveal:** "Based on a true story." Let them read for 3 s. Point at the article: "That's the real headline." Point at "Solved by": "And that's what you said you're weirdly good at." Keepsake QR: "Take the story home." |
| 3:45 | CD | **Scorecard close, one breath each:** "**Connection:** your friends' ideas are your best move. **AI:** Muse writes, judges and paints every decision; code rolls the dice. **Original:** it's based on a true story, and you find out at the end. **Working:** you just played it." |
| 4:00 | ENG | Q&A (PITCH_CARD.md, "Judge Q&A"). Offer DM's Notes (N) if they ask how the AI decided. |

**If you're running long:** ENG presses **S** to skip timers once everyone has sent, never during a judge's typing.
Past 3:30 with turns left: skip to the finale talk and let the game play out while you close. Always end on the
reveal and the four scorecard lines.

**If a judge has only 1 minute:** the 30-second version from PITCH_CARD.md, then show the deck's slide 4 (a turn)
and slide 6 (the reveal), and hand them the keepsake QR from the last game.

**If judges arrive mid-game:** let the current group finish (it's under 2 minutes away). CD to the new judges:
"Watch the reveal, it's the best part, then you're next." The ending is the best attract screen we have.

---

## 5. Fallbacks

| Problem | Do |
|---|---|
| **Venue Wi-Fi slow or down** | Timers freeze while every phone is offline and restart when one is back. ENG switches the laptop to the phone hotspot; judges' phones rejoin by scanning again (or join the hotspot if their data is bad). Under 60 s. |
| **Hotspot also fails** | Play the backup video on the laptop and talk over it with the 4-minute script. Hand out the URL card: "Play it tonight with your friends." |
| **Muse slow or down** | Canned lines fill in and the game keeps going; paintings stay on the last scene. Keep talking. If every call is falling back, switch to the video. |
| **Narrator silent** | Text still shows. "Tonight the narrator is shy." Check laptop volume, then move on. |
| **A painting is slow** | Say nothing. The old painting stays up and the new one fades in. |
| **No live news** | The vote uses our curated real stories. Nobody can tell. |
| **A phone won't join** | Hand them a spare phone already on `/play`. Don't debug a judge's phone. |
| **A judge types something offensive** | The DM keeps it in-world and the filter catches the worst. Smile, move on. |
| **The game errors or freezes** | ENG: reload the TV tab (F5). The room code changes, so everyone rescans. If it happens twice, video. |
| **"Is that a real person?" about a bot** | "No, that's a test player the TV runs so small groups can play." |

---

## 6. Reset between groups (~30 s, ENG)

1. On the reveal/keepsake screen, let the judges scan the keepsake QR first.
2. Reload `/tv?bots=1` (F5). New room code, empty lobby.
3. Check the lobby settings came back as **Quick Tale / Odd news / Teens**.
4. Team spare phones: reload `/play` and leave them on the join screen.
5. Leave the TV on the lobby; press **A** for the attract screen if nobody is waiting.
6. Glance at battery: laptop on charger, hotspot phone > 40%.

## 7. Between groups (CD)
- Note what each judge laughed at or got stuck on (one line on a phone). Anything that breaks twice goes to ENG.
- Drink water. The opener should sound as fresh at 4:55 PM as at 2:00.
