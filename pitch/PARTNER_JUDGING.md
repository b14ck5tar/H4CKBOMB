# Partner: judging 2-5 PM (WEL)

- [ ] **Before 2 PM: play the final build once**, start to "What really happened".
- [ ] **Hygiene:** Do Not Disturb on the laptop and phone. Quit Discord, Slack and every terminal. No `.env`, key or
      Vercel page open. One fresh TV tab, full screen: `https://groupproject-game.vercel.app/tv?judge=1&bots=1`.
- [ ] Lines and answers if you want them: `pitch/CHEAT_SHEET.md`.

**Rollback** (only if a deploy misbehaves): the known-good build is `once-upon-a-roll-ggknns93n` (tag `judge-safe-1`).
Away from judges, in a terminal at `C:\Users\oclab\AppData\Local\Temp\gpd\game`:

```bash
npx vercel promote https://once-upon-a-roll-ggknns93n-bl4ck-b0mb.vercel.app
```

If that fails: `npx vercel rollback`. Wait ~30 s, close the terminal, F5 the TV tab.
