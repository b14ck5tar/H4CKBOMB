# Devpost submit (the CD by ~10:15; the partner is the backup, by 11:30)

**The project is already submitted (7:17); `DEVPOST_SUBMIT.md` is the field-by-field update, and it's the source of truth.** The CD plans to finish it before leaving at ~10:20. Use this page if they couldn't, or to add the video link
after. One page, in order. Everything you paste is already written. Never paste a key, and close Discord, DMs and key files
before sharing your screen with anyone.

## 0. Before you start (2 min)
- [ ] Open https://groupproject-game.vercel.app/tv on a laptop: the lobby loads, and "Quick" + "Odd news" buttons show.
      If it doesn't load, still submit; message the team.
- [ ] Find the video: the CD's link (team hub notes or a message), or the MP4 file on the laptop.
- [ ] Open `DEVPOST.md` (this repo, top level) and `devpost-media/gallery-final/` side by side.

## 1. The video (only if the CD didn't upload it)
1. youtube.com → Create → Upload video → pick the MP4.
2. Title: **Group Project: the one group project where everyone actually shows up**. Visibility: **Unlisted**.
3. Copy the link. Open it in a private window: it must play without signing in.

## 2. Devpost: hacktx26.devpost.com → My projects → Group Project → Edit
If you can't see the project, the CD has to add you as a teammate first (message them).

| Devpost field | Paste this (from `DEVPOST.md`) |
|---|---|
| Project name | `Group Project` |
| Elevator pitch | the 181-character line in `DEVPOST_SUBMIT.md` §2 |
| Thumbnail | keep the current logo |
| About the project (the big text box) | Everything from **## Inspiration** down to the end of **## What's next for Group Project** (stop at the `---` line). Keep the `##` headings; Devpost reads Markdown. |
| Built with | The 19 tags in `DEVPOST_SUBMIT.md` §3 |
| "Try it out" links | `https://groupproject-game.vercel.app/tv` and `https://groupproject-game.vercel.app/tv?judge=1` |
| Image gallery | Upload `devpost-media/gallery-final/` **in number order, 1 to 6** (1 is the cover). |
| Video demo link | The YouTube link from step 1 |

The full field-by-field list is `DEVPOST_SUBMIT.md` (top level). Don't paste the **## Built with / Try it** sections into the text box, or
anything in *italics with brackets*.

## 3. Submit
- [ ] **Additional info → Sponsor / Special Prizes (was EMPTY at 7:17)**, tick exactly these: **Meta: Bringing People Closer Together with AI**, **Most Entertaining**,
      **Best Use of SerpApi**. (Best Novice applies by itself if we're eligible. Gemini: off, the CD's call.)
- [ ] Both teammates listed on the project.
- [ ] Press **Submit**. Wait for the "submitted" page.
- [ ] **Screenshot the "submitted" page** and post it in the team hub notes:
      https://claude.ai/artifact/Aehk1tVCwhGP9ydNnXxFD3

## If something goes wrong
- **Rollback** (only if a deploy misbehaves): the known-good build is `once-upon-a-roll-ggknns93n` (tag `judge-safe-1`).
  Away from judges, in a terminal at `C:\Users\oclab\AppData\Local\Temp\gpd\game`:
  `npx vercel promote https://once-upon-a-roll-ggknns93n-bl4ck-b0mb.vercel.app` (or `npx vercel rollback`). Then F5.
- **Video not ready by 11:15:** submit without it, then edit the project to add the link before 11:30 (edits are
  allowed until the deadline).
- **An image won't upload:** skip it; 5 images are plenty. Devpost takes JPG/PNG up to 5 MB.
- **The text box looks broken:** paste section by section, starting with Inspiration.
- **11:25 and still stuck:** press Submit with whatever is there. A submitted project beats a perfect draft.
