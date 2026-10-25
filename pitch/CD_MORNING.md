# CD morning: record the video, update Devpost, leave ~10:20

For the CD. Everything here happens after the final build is deployed. The shot list is in VIDEO_SCRIPT.md ("Shot
list for the CD"); this page is the order to do it in. **You record 9:00-9:45, submit Devpost by ~10:15, and leave
~10:20. The partner is the backup submitter (`pitch/PARTNER_SUBMIT.md`).**

**Schedule (laptop clock, the CD's call):** features frozen from **7:20**; playtest → fix cycles until **9:00**
(`pitch/REHEARSAL.md`); **video 9:00-9:45**; **Devpost submitted by ~10:15**; you leave **~10:20**. Everything for
Devpost is paste-ready already (DEVPOST.md, `devpost-media/gallery-final/`). If the video isn't cut and uploaded by
10:15, update Devpost anyway; the partner adds the video link before 11:30 (`pitch/PARTNER_SUBMIT.md`).

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
- [ ] The narrator is your ElevenLabs voice (one voice for everything), not the old OpenAI voice. Still OpenAI? Tell Claude
      and the video session, so DEVPOST, the deck and the video get switched back.

## Rollback

**Rollback** (only if a deploy misbehaves): the known-good build is `once-upon-a-roll-ggknns93n` (tag `judge-safe-1`).
Away from judges, in a terminal at `C:\Users\oclab\AppData\Local\Temp\gpd\game`:
`npx vercel promote https://once-upon-a-roll-ggknns93n-bl4ck-b0mb.vercel.app` (or `npx vercel rollback`). Then F5.

- [ ] **Before you leave, check the rollback works:** in a terminal at `C:\Users\oclab\AppData\Local\Temp\gpd\game`, run `npx vercel whoami`
      (it should print the team's Vercel account), then close the terminal. The rollback only works on THIS laptop
      (the export folder and the CLI login live here). Judging from another machine? Run `npx vercel login` there first.

## 2. Record (9:00-9:45): follow VIDEO_SCRIPT.md, "Shot list for the CD"

The video session builds and cuts the video by script, with Sarah's ElevenLabs voice. **You only record**; there's no
voiceover to read and no editing to do.
- [ ] Safety check (§0) again right before you press record.
- [ ] Laptop TV on `/tv?judge=1&bots=1`, full screen (F11), your real phone + 2 test players (press **B** twice).
- [ ] Start the laptop recording (Win+Alt+R or Snipping Tool, system audio on) and the phone's screen recorder (mic
      off) before the lobby, and keep both running for one full judge game (~6 min).
- [ ] After the game: a 10 s clip of DM's Notes (press **N**), and, only if no key or `.env` can show, 8 s of Claude
      Code with several sessions in the sidebar.
- [ ] Send the laptop and phone files to the video session (it cuts, exports and gives the YouTube link for Devpost).

## 8. Devpost: update by ~10:15 (follow `DEVPOST_SUBMIT.md`, field by field)

The project is already submitted; you're updating it. **First: Additional info → Sponsor / Special Prizes was EMPTY;
tick Meta + Most Entertaining + SerpApi.** Then the text, tags, links, gallery 1-6 and the school name, as listed.
- [ ] Screenshot the public project page into the team hub notes.

## 9. Before you leave (~10:20)

- [ ] Message the partner: the video link (or "the video session is still cutting it; add the link before 11:30").
- [ ] The partner has `pitch/CHEAT_SHEET.md` (or the team hub's Judging section) on their phone.
- [ ] Back ~4:45 PM at WEL; stage pitch 5:30 PM in GDC 2.216 (PITCH_CARD.md).
