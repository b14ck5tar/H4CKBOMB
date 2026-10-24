# VIDEO SCRIPT: Once Upon a Roll (Meta submission video, 2:45)

Meta requires a 2 to 3 minute demo video. Ours runs **2:45 (165 s)** and follows their four-part breakdown exactly:

| Part | Meta's ask | Our timing | Length |
|---|---|---|---|
| 1 | Problem and how it brings people closer | 0:00 to 0:28 | 28 s |
| 2 | Working product demo of key features | 0:28 to 1:50 | 82 s |
| 3 | How AI plays a role and is integrated | 1:50 to 2:17 | 27 s |
| 4 | Tools, harnesses and models used, and how they helped the build | 2:17 to 2:45 | 28 s |

Voiceover pace is about 2.4 words per second. If a line runs long, cut words, never shots.
**(if shipped)** marks anything that only goes in if it is live when you record. Each has a fallback shot.
Rubric reminder (Meta): human connection 30%, AI essential and integrated 25%, originality 20%, technical execution 20%. Part 1 sells connection, Part 2 proves execution and originality, Part 3 sells AI, Part 4 covers the build.

---

## PART 1: Problem and human connection (0:00 to 0:28)

| Time | Shot (on screen) | Voiceover | B-roll / notes |
|---|---|---|---|
| 0:00 to 0:05 | Friends on a couch at night, each looking down at their own phone. TV is off. | "Everyone says, 'we should play D&D sometime.'" | **B-roll:** 3 to 4 friends, phones in hand, dim room, no one talking. Slow push-in. |
| 0:05 to 0:11 | One friend alone at a desk with a thick rulebook and sticky notes, then a closed book. | "Then nobody wants to be the Dungeon Master. So game night never happens." | **B-roll:** hands flipping rulebook pages, closing it with a sigh. |
| 0:11 to 0:18 | Cut to the TV lighting up: lobby, room code and QR, title card **ONCE UPON A ROLL**. | "Once Upon a Roll makes the AI the Dungeon Master, so everyone gets to be a hero." | **Screen recording:** TV lobby at 1080p. Title card with the three-line tagline. |
| 0:18 to 0:28 | Same friends, now heads up, phones in hand but pointed at the TV, laughing together on the couch. | "Shared laughter bonds groups. So it's one TV, everyone's phone, and a whole room laughing at the same moment." | **B-roll:** the money shot: **TV + phones in hand, laughing friends**, a mid shot with the TV glow on faces. Lower-third source: *Dunbar et al. 2012, Proc. Royal Society B*. |

## PART 2: Working product demo (0:28 to 1:50)

All footage is real, from one full game. Cut between **TV screen recording** (1080p) and **phone screen recordings**. Show hands on phones in at least two shots.

| Time | Shot (on screen) | Voiceover | On-screen action / notes |
|---|---|---|---|
| 0:28 to 0:36 | Phone camera scans the QR on the TV. Phone shows the join screen, then the hero box. TV lobby fills with names. | "Scan the QR. No app, no account. Type one line: 'a retired knight afraid of geese.'" | Phone screen recording, then TV. Type the hero text live-speed, then speed-ramp. Overlay: "30 seconds to start". |
| 0:36 to 0:46 | TV: stat card builds, then the portrait develops from pencil sketch to full color. | "Muse Spark writes the stat card. Muse Image paints the portrait." | TV screen recording. Hold on the finished portrait for one beat. Overlay chips: *Muse Spark*, *Muse Image*. |
| 0:46 to 0:58 | TV: the map unrolls, the quest intro appears (threat, goal). A small "Real news, this week" badge. | "Tonight's quest is real news from this week. SerpApi finds it, a filter strips anything tragic, and it's told as a fairytale." | TV screen recording. Do **not** show the real headline here; save it for the reveal. Overlay chip: *SerpApi Google News*. |
| 0:58 to 1:12 | Phones: pitching by typing, then holding push-to-talk. TV: the Pitch Wall fills; a verdict stamp slams: **RISKY · DC 18**; votes tick in. | "Everyone pitches at once, typed or spoken. The DM stamps each idea. Then friends vote." | Split screen: phone left, TV right. Voice shot uses Muse Voice Transcribe. Cut on the stamp. |
| 1:12 to 1:24 | Phone shake, the d20 tumbles on the TV, lands on **1**. CATASTROPHE stamp, record scratch, emoji flood. | "A real d20 decides. Roll a one, and it's a catastrophe." | TV screen recording with audio. *(If shipped: insert 2 s of phones dimming to the **Look Up!** card: "Look at the table.")* |
| 1:24 to 1:36 | TV: **In Peril** banner, then the Rescue Round. The hero in peril taps a savior on their phone; Savior title lands ("Shark-Puncher"). | "Then the hero in peril picks who saves them. A failure becomes a friendship." | Phone screen recording of the pick, then TV. *(If shipped: phone shows the one-tap **Thank your savior** prompt, 2 s.)* Cut to a B-roll cutaway of friends cheering. |
| 1:36 to 1:50 | TV: storybook pages flip. The last page tears away to the newsprint: **"This tale was inspired by real events,"** headline types out, then the book lands on the bookshelf: "Book 1". | "At the end, the page tears. 'This tale was inspired by real events.' And the storybook is yours." | TV screen recording. Hold the newsprint 2 full seconds. **B-roll cutaway:** friends reading the screen and reacting. |

**Fallback if the Rescue Round doesn't trigger in your take:** use the test hotkey to force a nat 1 and re-record that shot. Never show the hotkey on screen.

## PART 3: How AI plays a role (1:50 to 2:17)

| Time | Shot (on screen) | Voiceover | On-screen action / notes |
|---|---|---|---|
| 1:50 to 1:57 | Animated panel: a pitch goes in, the strict JSON verdict comes out, and the stamp lands. Beside it, a die with "server RNG". | "Take the AI away and there's no game. Muse Spark is the DM brain and the safety filter. The server rolls the dice, so the AI sets the stakes but never the numbers." | Motion graphic from real JSON and the real stamp. Overlay: *muse-spark-1.3, strict JSON schemas*. |
| 1:57 to 2:03 | Quick montage: a portrait, a scene plate, a phone mic waveform turning into text. | "Muse Image paints every hero and scene. Muse Voice Transcribe lets you just speak." | Overlay chips: *Muse Image*, *Muse Voice Transcribe*. |
| 2:03 to 2:17 | **(if shipped)** Screen recording of Muse, Meta's personal agent: the user types "start a game night for me and Mira." Muse calls `start_game_night`, `list_todays_tales`, `invite_message`. The TV shows a fresh room. Muse shows the drafted invite. | "And Muse, Meta's personal agent, can run it. Through our connector, Muse starts game night, shows tonight's tales, and writes the invite to your friends." | Screen recording of Muse plus the TV lobby. Overlay: `/api/mcp` and the three tool names. The human sends the invite. |

**Fallback if the connector isn't live:** replace the last 14 s with a longer montage of the narration and the Pitch Wall, and change the VO to: "Every turn is a Muse call, and the table is the interface: friends talk to each other, not to a chatbot." Remove all mention of Muse starting the night.

## PART 4: Tools, harnesses and models, and how they helped (2:17 to 2:45)

| Time | Shot (on screen) | Voiceover | On-screen action / notes |
|---|---|---|---|
| 2:17 to 2:27 | Terminal: Claude Code with parallel subagent lanes labeled **research · news pipeline · voice · juice/animation · docs**. | "We built it in a weekend with Claude Code from Anthropic as lead engineer, orchestrating parallel subagents: research, the news pipeline, voice, animation and docs, all at once." | Screen recording of the real Claude Code session (blur any keys). Overlay chip: *Claude Code, Anthropic*. |
| 2:27 to 2:38 | Simple stack diagram: Muse Spark, Image and Voice inside the product; Next.js, Vercel, Supabase Realtime; SerpApi into the news pipeline. | "Meta's Muse models run inside the product. Next.js and Vercel serve it, Supabase Realtime keeps the TV and phones in sync, and SerpApi finds the real news." | Stack diagram in the Illuminated Storybook style. Keep to what is true of the shipped build. |
| 2:38 to 2:45 | End card: the team, the live URL, a QR, and the tagline. Final B-roll: friends laughing, TV glow. | "Nobody has to be the Dungeon Master anymore." | Hold the end card 3 s. Text: **Once Upon a Roll · Phones down, eyes up.** |

---

## Recording checklist

**Before you record**
- [ ] Run one full game end to end, then pick which take you will film from. Pre-warm Muse (one dummy call) so the first portrait is not cold.
- [ ] Decide what shipped: Look Up!, Thank your savior, Spotlight, the Muse connector. Delete the unshipped rows and use the fallback lines.
- [ ] Clear notifications and turn on Do Not Disturb on every phone and the laptop. Hide bookmarks and personal tabs. Close Slack and email.
- [ ] Charge all phones. Phones in portrait. Brightness at max for screen recordings.
- [ ] Pick the quest with a clean, uplifting headline. Check the facts of the real story before showing the newsprint.
- [ ] Remove API keys, `.env.local` and tokens from every terminal and screen you show. Blur the Claude Code session if needed.

**Screen recording**
- [ ] **TV screen at 1080p, 30 fps or higher.** Set the laptop display to 1920 x 1080, browser at 100% zoom, in full-screen mode.
- [ ] Record with **OBS** (Display Capture, 1080p, MP4 or MKV, 30 or 60 fps) **or Windows Game Bar: Win+Alt+R** to start and stop. Game Bar records one app window, so make the browser the active window. Clips land in `Videos\Captures`.
- [ ] Record **phone screens** with the phone's built-in screen recorder at its native resolution. Do one clip per scene: join, hero entry, pitch, voice, vote, shake and roll, Rescue pick.
- [ ] Record the Muse connector and the Claude Code terminal as separate clips, each 20 s or longer.
- [ ] Record game audio (dice, stamp, record scratch). Capture system audio in OBS or Game Bar.

**Filming B-roll**
- [ ] Film B-roll with a phone on a tripod or a stack of books. Eye level, landscape, 1080p or higher.
- [ ] **TV + phones in hand, laughing friends:** 3 to 4 friends on a couch, the TV in frame, phones held up. Shoot a wide, a mid shot with TV glow on faces, and a close-up of a hand shaking a phone.
- [ ] Also shoot: the pre-game "everyone on their phone" shot, a person closing a rulebook, a high-five after a rescue, a reaction to the newsprint reveal.
- [ ] Get written OK from everyone on camera. Use friends, teammates or volunteers.

**Voiceover and sound**
- [ ] **A quiet corner:** record the voiceover somewhere soft and small (a closet or a room with a blanket over you), phone mic six inches away or a USB mic. No fans, no AC, no hallway.
- [ ] Record the voiceover in one pass per part, then once more. Leave 1 s of silence before and after each take.
- [ ] Use music that is licensed or royalty free, and mix it low under the voiceover.

**Takes and edit**
- [ ] **Record a 2nd take** of the whole demo and of the voiceover. Keep the better of each.
- [ ] Edit to exactly **2:45**, and never over 3:00. Check each part against the timing table above.
- [ ] Add captions (judges may watch on mute). Keep text out of the bottom 15% of the frame.
- [ ] Export 1080p MP4, H.264. Watch it start to finish on a phone and a laptop.
- [ ] Upload (YouTube unlisted or as Devpost requires), open the link in a private window, and confirm it plays without a login.
- [ ] Save a copy on the laptop and the phone. This is also the backup video for the table demo.
