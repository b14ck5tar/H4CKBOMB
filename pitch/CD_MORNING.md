# CD morning: record the video, submit Devpost, leave at 11

For the CD. Everything here happens after the final build is deployed. The shot list and the full spoken script are
in VIDEO_SCRIPT.md; this page is the order to do it in. Devpost closes 11:30 AM; you leave at 11:00, so **submit by
10:50**.

**Latest start times:** record by 9:00, edit by 9:45, upload by 10:30, Devpost by 10:40.

## 0. Safety check (2 min, before ANY recording)

- [ ] Close Discord, Slack, email, Messages and every DM window. Quit them; minimizing isn't enough (a Discord DM
      popped up in a past recording).
- [ ] Close `.env.local`, any `.env` file, the Vercel env page, the Meta / OpenAI / ElevenLabs / Supabase / SerpApi
      key pages, and any terminal that printed a key.
- [ ] Laptop and phones on Do Not Disturb.
- [ ] Browser: one window, full screen (F11), bookmarks bar hidden, zoom 100%, no other tabs.
- [ ] If a key ever shows up on screen in a recording: stop, delete that file, and tell Claude so the key gets
      rotated.

## 1. Check the deploy (3 min)

Open `https://groupproject-game.vercel.app/tv?bots=1` and play to the first turn with one phone + 1 test player.
- [ ] The TV says "{name}, tell the table your plan" while the owner types. Missing: in Part 2 say "On your turn, your
      friends pitch you ideas."
- [ ] The outcome names the next player at the end. Missing: drop "and the story hands the spotlight to the next
      friend by name."
- [ ] Narrator audio plays. Volume ~70%.
- [ ] One meter (progress with 3 act dots), no danger meter.
- [ ] Quick gives 1 turn each (2 players = 2 turns, then the finale). If it still gives 2 each, tell Claude: DEVPOST
      says "about 5 minutes".
- [ ] The narrator sounds like ElevenLabs (Sarah, George or Charlie), not the old OpenAI voice. Still OpenAI (the plan
      isn't bought yet)? Then in the voiceover say "The narrator is OpenAI", and tell Claude so DEVPOST and the deck
      get switched back.

## 2. The live take (about 15 min for 2 takes)

Setup (VIDEO_SCRIPT.md, "Shot list"): `/tv?judge=1&bots=1` (a saved, tested true story), **Quick · Odd news · Teens**,
2 humans on real phones + 2 test players (press **B** twice). That's 2 turns (1 each) + the finale, about 5 minutes.

Start every recording first, then **clap once on camera** (it syncs the tracks):
1. **TV:** OBS (1920x1080, 60 fps, desktop audio on, mic off), or Snipping Tool (Win+Shift+R, system audio on).
2. **Phone A and phone B:** screen recording, mic off, "Show touches" on (Android).
3. **Room camera:** a third phone, landscape, both faces + the TV glow.

Play these moves (plan the moves, not the words):
- [ ] Human A types a custom hero ("a night-shift baker who argues with her sourdough") and a real secret talent.
      Human B grabs a ready-made hero, also with a real talent.
- [ ] A's turn: B pitches an idea **out loud** and types it. A picks B's idea (+1 and B's name on screen).
- [ ] B's turn: B reads the plan to the table first, then sends it.
- [ ] Use plans with one clear noun (a ladder, a cinnamon roll, a marching band).
- [ ] Finale: both shake the phones at the same moment, laughing.
- [ ] Reveal: someone says "wait, that's real?" out loud.

Keep the take that has: a friend's idea picked, one low roll and one high roll, an outcome that uses the player's
own word, a readable headline at the reveal. **One good take is enough.**

Also record **the opening shot** (Part 1, 9 s): the two of you on a couch, each scrolling your own phone, nobody
talking. Then 5 s of hands rolling real dice, if you have dice.

## 3. Screen captures after the take (5 min)

- [ ] **DM's Notes:** on the TV, press **N** and record 10 s of the entries scrolling.
- [ ] **Claude Code:** 8 s of Claude Code with several sessions in the sidebar. **Do the safety check again first**:
      no `.env`, no key in any visible output. If unsure, skip this shot and use deck slide 7 instead.

## 4. B-roll ready-made (no recording needed)

In `devpost-media/broll/` (made by script, 1920x1080):
| File | Use it for |
|---|---|
| `deck-slide-3.png` | Part 1 end: "So we built Group Project" |
| `how-it-works.png` | Part 3: the one-turn diagram (real news → Muse → plan → dice → Muse → painting) |
| `deck-slide-7.png` | Part 3/4: "Muse writes and judges. Code rolls the dice. Players steer." + the build numbers |
| `deck-slide-6.png` | Part 2 backup for the reveal if your take's headline is hard to read |
| `deck-slide-8.png` | The end card (QR + URL) |
After the gallery run (Claude asks the story session for it), `devpost-media/gallery-v2/` has real game stills and
two "TV + phones" composites: good backups for any shot that came out blurry.

## 5. Voiceover (10 min)

A quiet small room (a closet is ideal). Phone voice memo, mic ~6 inches away, a little to the side. Read the
one-take block in VIDEO_SCRIPT.md ("The voiceover") straight through, stopping 2 s at each [pause]. Slower than feels
natural, like telling a friend; no trailer voice. Fluff a line? Pause, then reread that sentence; the edit cuts it.

## 6. Edit (30-40 min) in Clipchamp (built into Windows) or CapCut

1. Drop in, in this order: couch shot → dice shot → `deck-slide-3.png` → the live take (TV capture as the base) →
   `how-it-works.png` → DM's Notes clip → `deck-slide-7.png` → Claude Code clip → `deck-slide-8.png`.
2. Cut the voiceover at its [pause] gaps and lay the parts on top: Part 1 at 0:00, Part 2 at 0:30, Part 3 at 2:00,
   Part 4 at 2:30. Add the small criterion chips (VIDEO_SCRIPT.md) top-left.
3. In Part 2, cut the live take down to the moments in VIDEO_SCRIPT.md (join, opener, the friend's-idea pick, the
   swipe, the outcome, the shake, the reveal). Cut away to a phone capture or the room camera at least 3 times.
4. Game sound low under the VO; louder for the narrator and the reveal.
5. Captions: Clipchamp's auto-captions, then fix any wrong words. Keep them out of the bottom 15%.
6. **Under 3:00.** If long, cut words, not the friend's-idea moment or the reveal.

Never on screen: hotkeys, the "?" help, "Local mode", the address bar, any key, any DM.

## 7. Export and upload (10 min)

- [ ] Export 1080p MP4. Watch it once muted (captions readable?) and once with sound.
- [ ] YouTube, **Unlisted**. Open the link in a private window: it plays without a login.
- [ ] Copy the MP4 to your phone: it's the backup video for the judge table.

## 8. Devpost (10 min), hacktx26.devpost.com

- [ ] Paste DEVPOST.md section by section (from "Name" down).
- [ ] Your one line under "Accomplishments" (replace the placeholder in italics).
- [ ] Paste the video link.
- [ ] Gallery: the 5-6 shots Claude picks (listed in `devpost-media/gallery-v2/PICKS.md` once the run is done),
      cover first. JPG/PNG up to 5 MB, 3:2 crops best.
- [ ] Tracks: Meta, Most Entertaining, Best Use of SerpApi. Gemini: off (your call).
- [ ] Built with: already lists `elevenlabs` (the narrator) and `openai-tts` (its backup). Paste as is.
- [ ] Both teammates added. **Submit.** Screenshot the "submitted" page.

## 9. Before you leave (11:00)

- [ ] Message the partner: the video link, "Devpost submitted", and where the backup MP4 is.
- [ ] The partner has `pitch/CHEAT_SHEET.md` (or the team hub's Judging section) on their phone.
- [ ] Back ~4:45 PM at WEL; stage pitch 5:30 PM in GDC 2.216 (PITCH_CARD.md).
