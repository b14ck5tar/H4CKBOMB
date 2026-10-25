# 27. Judge table run-of-show (Sun Oct 25, judging 2 to 5 PM, WEL)

Updated Sun ~7 AM for judge mode and the current code. The spoken lines, timing table and FAQ live in PITCH_KIT.md
(section 3); the pocket version is `pitch/CHEAT_SHEET.md`. This doc is the setup and logistics.

Goal: every judge plays a real turn on their own phone, sees a friend's idea win "+1", throws the die, plays the
shake-together finale and leaves on the "Based on a true story" reveal. Judge mode (`/tv?judge=1`): 1 turn each, at
most 3 turns, then the finale everyone plays, on a saved, tested true story. About 5 min from Start.

**People:** the CD is at work 11 AM to ~4:30 PM and back ~4:45 (DECISIONS Sun ~1 AM). **The partner runs the table
alone from 2:00 to ~4:45.** HOST = whoever talks to the judges. DRIVER = the second person, if there is one (laptop,
hotkeys, tech questions). Solo, the HOST does both: everything below works with one person.

---

## 1. Setup (arrive 1:30 PM; the pitching workshop is 1 PM in GDC 5.302 if you go)

### Hardware checklist
- [ ] **Laptop as the TV**, lid facing the judges, charger plugged in, power saving and sleep **off**.
- [ ] **External screen if one is free** (ask an organizer). HDMI/USB-C adapter in the bag.
- [ ] **QR card:** a printed card beside the screen with a QR for **groupproject-game.vercel.app/play** and the
      line "Scan the TV, or open this and type the 4 letters on screen". The lobby's own QR carries the room code and
      stays the fast path.
- [ ] **Sound on:** laptop volume ~70%, or a small Bluetooth speaker. WEL is loud during judging.
- [ ] **Phone hotspot ready** (name and password known, battery > 70%, on a power bank).
- [ ] **Chargers:** laptop charger, a power bank, 2 phone cables.
- [ ] **Two spare phones** already on `/play`, for judges who don't want to scan or have a dead phone.
- [ ] **Backup video** (the Meta video MP4) on the laptop and on a phone.
- [ ] Laptop: Do Not Disturb, Discord/Slack/email closed, other tabs closed, bookmarks bar hidden, no `.env` file or
      key page open anywhere.

### Browser tabs (all on the deployed site)
1. **TV:** `https://groupproject-game.vercel.app/tv?judge=1&bots=1`, full screen (F11). Lobby: **Quick**, **Odd
   news**, **Teens** (Adults only if judges ask).
2. **Deck:** `https://groupproject-game.vercel.app/pitch/deck.html` (the reveal slide and the QR slide, for a judge in
   a hurry).
3. **Backup:** the video file, ready to play.

### Ten minutes before the first judge
- [ ] Play one full warm-up game (you + a team phone + 1 bot). It wakes Muse and checks the narrator.
- [ ] Check: the narrator speaks, paintings change per decision, swipe-to-throw works, **the turn cap holds** (with 3
      players: 3 turns, then the finale), the reveal shows "Based on a true story" and the real article.
- [ ] Reset (section 5) and leave the lobby up. With nobody joined it is its own attract screen (big QR + pitch line).

### Hotkeys (`Presenter.tsx`)
| Key | Does |
|---|---|
| B | Add a test player (lobby only, needs `?bots=1`; up to 3: Riley, Sam, Jo) |
| Q | Quick Tale + begin |
| Space | Continue on a reading screen |
| S | Skip the current timer (only once everyone has sent) |
| N | DM's Notes: every AI call, live |
| H | Hotkey help |
| Esc | Close notes and help |

---

## 2. Bots for empty seats

- The game needs 2+ players. Bots never own a turn while a human plays; they only suggest ideas.
- **One judge alone:** the HOST joins as a player from a team phone (so the judge's suggestion comes from a real
  person; 2 turns: the judge's and the HOST's), and press **B** once.
- **Two judges:** press **B** once, so each turn gets two suggestions.
- **Three or more judges:** no bots. With 4+, turns stop at 3; the 4th judge opens the finale ("you're the closer").
- Say it plainly: "Riley is a test player the TV runs." Never pass a bot off as a person.

---

## 3. The flow

See PITCH_KIT.md section 3 for the second-by-second lines. Shape, with 3 judges:

| Clock | Beat |
|---|---|
| 0:00 | QR card first, 30-second pitch while they scan; heroes with "What's your secret talent?" |
| 0:50 | Start. Opener: painting + narrator. |
| 1:15 | Turn 1 (45 s to suggest and pick; ends early once everyone has sent). Coach the friend's idea. Swipe to throw. |
| 2:15-3:45 | Turns 2 and 3. Only say whose turn it is. |
| 3:50 | Finale: everyone writes, backs one plan (not their own), everyone shakes. |
| 5:15 | "Because of you", then the reveal: the real headline, "Solved by" with their secret talents, the keepsake QR. |
| 5:40 | The close, then questions. |

With 2 judges (or 1 judge + the HOST), the reveal lands about 45 s earlier. Say the length up front: "It's a whole
game in five minutes. The best part is the last 30 seconds."

**If you're running long:** press **S** only after everyone has sent, never during a judge's typing.
**If a judge has only 1 minute:** the 30-second pitch, the deck's reveal slide, and the QR card.
**If judges arrive mid-game:** "Watch the reveal, it's the best part, then you're next."

---

## 4. Fallbacks

| Problem | Do |
|---|---|
| **Venue Wi-Fi slow or down** | The timer stops while every phone is offline and restarts when one is back. Switch the laptop to the hotspot; judges rescan. Under 60 s. |
| **Hotspot also fails** | Play the backup video and talk over it. Hand out the QR card: "Play it tonight with your friends." |
| **Muse slow or down** | Canned lines fill in and the game keeps going; paintings stay on the last scene. If every call is falling back, switch to the video. |
| **Narrator silent** | Text still shows. "Tonight the narrator is shy." Check the volume, move on. |
| **A painting is slow** | Say nothing. The old painting stays up and the new one fades in. |
| **A phone won't join** | Hand them a spare phone already on `/play`. Don't debug a judge's phone. |
| **A judge types something offensive** | The DM keeps it in-world and the checks catch the worst. Smile, move on. |
| **The game errors or freezes** | Reload the TV tab (F5). New room code, everyone rescans. Twice = video. |
| **"Is that a real person?" about a bot** | "No, that's a test player the TV runs so small groups can play." |

---

## 5. Reset between groups (~30 s)

1. On the reveal/keepsake screen, let the judges scan the keepsake QR first.
2. Reload `/tv?judge=1&bots=1` (F5). New room code, empty lobby.
3. Check the lobby came back as **Quick / Odd news / Teens**.
4. Spare phones: reload `/play`, leave them on the join screen.
5. Glance at battery: laptop on charger, hotspot phone > 40%.

## 6. Between groups
- One line on a phone: what each judge laughed at or got stuck on. Anything that breaks twice: message the team.
- Drink water. The pitch should sound as fresh at 4:55 PM as at 2:00.
- ~4:45: the CD arrives. From then on, CD = HOST, partner = DRIVER.
