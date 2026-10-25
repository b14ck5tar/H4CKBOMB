# Partner: judging 2-5 PM (WEL)

- [ ] **Before 2 PM: play the final build once**, start to "What really happened".
- [ ] **Hygiene:** Do Not Disturb on the laptop and phone. Quit Discord, Slack and every terminal. No `.env`, key or
      Vercel page open. One fresh TV tab, full screen, on the local build (below); the live site is the fallback.
- [ ] **Rollback ready:** in a terminal at `C:\Users\oclab\AppData\Local\Temp\gpd\game`, run `npx vercel whoami`
      (it should print the team's Vercel account), then close the terminal. The rollback only works on THIS laptop
      (the export folder and the CLI login live here). Judging from another machine? Run `npx vercel login` there first.
- [ ] Lines and answers if you want them: `pitch/CHEAT_SHEET.md`.

## The 2 PM demo: a LOCAL build on the laptop
The submission is final (tag `submission-1130`, live at groupproject-game.vercel.app, video youtu.be/9emoutd3gQQ).
Judges play a local build that may include improvements made after 11:30.
- **Start it:** in PowerShell at the repo root: `TODO: command from scripts/demo.ps1 (look is building it)`. Then open
  the TV at `TODO: local URL from demo.ps1` + `/tv?judge=1&bots=1`, full screen (F11). Phones scan the lobby QR
  (laptop and phones on the same network).
- **Say it once, up front (honest disclosure):** "What we submitted is live at the link; what you're playing has a few
  improvements we made since. Here's what changed: ___." (Fill in from `git log --oneline submission-1130..HEAD`;
  nothing yet as of 11:40.)
- **Fallback, if the laptop build or the local network fails:** open `https://groupproject-game.vercel.app/tv?judge=1&bots=1`
  (the submitted build) and play that. Say: "This is exactly what we submitted."

**Rollback** (only if a deploy misbehaves): the known-good build is `once-upon-a-roll-ggknns93n` (tag `judge-safe-1`).
Away from judges, in a terminal at `C:\Users\oclab\AppData\Local\Temp\gpd\game`:

```bash
npx vercel promote https://once-upon-a-roll-ggknns93n-bl4ck-b0mb.vercel.app
```

If that fails: `npx vercel rollback`. Wait ~30 s, close the terminal, F5 the TV tab.
