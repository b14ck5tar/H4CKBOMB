# CD morning: record the video, submit Devpost, leave at 11

For the CD. Everything here happens after the final build is deployed. The shot list and the full spoken script are
in VIDEO_SCRIPT.md; this page is the order to do it in. **You record 8:00-8:30 and leave ~8:30. The partner submits
Devpost by 11:30 with `pitch/PARTNER_SUBMIT.md`.**

**Schedule (laptop clock, the CD's call):** freeze **7:20**, deploy **~7:30**, timed judge games **7:30-8:00**
(`pitch/REHEARSAL.md`), **you record the video 8:00-8:30**, you leave **~8:30**. Everything for Devpost is paste-ready
already (DEVPOST.md, `devpost-media/gallery-final/`). Before you leave, hand the partner the raw recordings + this page;
whoever finishes the edit/upload follows §6-7, and the partner submits with `pitch/PARTNER_SUBMIT.md`.

**Recording on localhost:3000** (the partner's take) is fine: full screen (F11) so the address bar is hidden, and
check the TV doesn't show "Local mode" (it means the rooms aren't connected).

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
- [ ] The narrator is your ElevenLabs voice (one voice for everything), not the old OpenAI voice. Still OpenAI (the plan
      isn't bought yet)? Then in the voiceover say "The narrator is OpenAI", and tell Claude so DEVPOST and the deck
      get switched back.

## 2. The live take (about 15 min for 2 takes)

Setup (VIDEO_SCRIPT.md, "Shot list"): `/tv?judge=1&bots=1` (a saved, tested true story), **Quick · Odd news · Adults** (judge mode sets these),
you on a real phone (plus any real player who's around) + 2 test players (press **B** twice). Each real player gets
1 turn, then the finale.

Start every recording before the lobby (in the edit, line the tracks up on the first die-landing sound):
1. **TV:** OBS (1920x1080, 60 fps, desktop audio on, mic off), or Snipping Tool (Win+Shift+R, system audio on).
2. **Phone A (and B if you can):** screen recording, mic off, "Show touches" on (Android).

Play these moves (plan the moves, not the words):
- [ ] Type a custom hero ("a night-shift baker who argues with her sourdough") and a real secret talent.
- [ ] Your turn: pick a test player's (or a friend's) idea, so "+1" and their name show on screen.
- [ ] With a second real player: they read their plan to the table first, then send it.
- [ ] Use plans with one clear noun (a ladder, a cinnamon roll, a marching band).
- [ ] Finale: shake the phone (everyone real shakes at the same moment).

Keep the take that has: a friend's idea picked, one low roll and one high roll, an outcome that uses the player's
own word, a readable headline at the reveal. **One good take is enough.**

No camera filming: the video is screen recordings plus the B-roll stills in §4.

## 3. Screen captures after the take (5 min)

- [ ] **DM's Notes:** on the TV, press **N** and record 10 s of the entries scrolling.
- [ ] **Claude Code:** 8 s of Claude Code with several sessions in the sidebar. **Do the safety check again first**:
      no `.env`, no key in any visible output. If unsure, skip this shot and use deck slide 7 instead.

## 4. B-roll ready-made (no recording needed)

In `devpost-media/broll/` (made by script, 1920x1080):
| File | Use it for |
|---|---|
| `deck-slide-2.png` | Part 1: "everyone on their own phone… someone has to run the game" |
| `deck-slide-3.png` | Spare for Part 1's end: "So we built Group Project" (the lobby screen recording is the first pick) |
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

1. Drop in, in this order: `deck-slide-2.png` → the live take (TV capture as the base) →
   `how-it-works.png` → DM's Notes clip → `deck-slide-7.png` → Claude Code clip → `deck-slide-8.png`.
2. Cut the voiceover at its [pause] gaps and lay the parts on top: Part 1 at 0:00, Part 2 at 0:30, Part 3 at 2:00,
   Part 4 at 2:30. Add the small criterion chips (VIDEO_SCRIPT.md) top-left.
3. In Part 2, cut the live take down to the moments in VIDEO_SCRIPT.md (join, opener, the friend's-idea pick, the
   swipe, the outcome, the shake, the reveal). Cut away to a phone capture at least 3 times.
4. Game sound low under the VO; louder for the narrator and the reveal.
5. Captions: Clipchamp's auto-captions, then fix any wrong words. Keep them out of the bottom 15%.
6. **Under 3:00.** If long, cut words, not the friend's-idea moment or the reveal.

Never on screen: hotkeys, the "?" help, "Local mode", the address bar, any key, any DM.

## 7. Export and upload (10 min)

- [ ] Export 1080p MP4. Watch it once muted (captions readable?) and once with sound.
- [ ] YouTube, **Unlisted**. Open the link in a private window: it plays without a login.
- [ ] Copy the MP4 to your phone: it's the backup video for the judge table.

## 8. Devpost: the partner submits (`pitch/PARTNER_SUBMIT.md`)

Everything is paste-ready: the text (DEVPOST.md, your Accomplishments line is filled in), the gallery
(`devpost-media/gallery-final/`, upload 1-6 in order), tracks (Meta, Most Entertaining, SerpApi). Before you leave:
- [ ] Add the partner as a teammate on the Devpost project (they can't edit it otherwise).

## 9. Before you leave (~8:30)

- [ ] Message the partner: the video link (or "the edit isn't done, the files are in …"), and where the MP4 is.
- [ ] The partner has `pitch/CHEAT_SHEET.md` (or the team hub's Judging section) on their phone.
- [ ] Back ~4:45 PM at WEL; stage pitch 5:30 PM in GDC 2.216 (PITCH_CARD.md).
