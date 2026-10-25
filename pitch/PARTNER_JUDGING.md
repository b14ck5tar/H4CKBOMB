# Partner: running judging alone (Sun 2-5 PM, WEL)

Everything you need on one page. The CD is back ~4:45; stage pitch 5:30 PM in GDC 2.216. Longer answers:
`pitch/CHEAT_SHEET.md`.

## Before 2 PM (arrive 1:30)
- [ ] **Play one full judge game on the final build** (you + a team phone, press **B** once): Start → 1 turn each →
      finale → "What you did" → "What really happened". Check the narrator speaks and paintings change every turn.
- [ ] **Hygiene:** laptop and phone on Do Not Disturb. Quit Discord, Slack, email and every terminal. No `.env` file,
      key page or Vercel page open anywhere. One browser window, **one fresh TV tab**, full screen (F11).
- [ ] TV tab: `https://groupproject-game.vercel.app/tv?judge=1&bots=1` (judge mode sets Quick + Adults, a saved,
      tested story: the Busan canal shark, the Dendermonde gold or the Norwich Batman).
- [ ] Sound ~70%. Charger in. Hotspot ready on your phone. Spare phone on `/play`. Backup video on the laptop + phone.
      QR card next to the screen.

## The judge visit (about 5 minutes from Start)
Bots: 1 judge → you join on the team phone + press **B** once. 2 judges → **B** once. 3+ → none. Say "Riley is a test
player the TV runs."

1. QR card first. **Opener B (10 s):** "Our application to HackTX got denied. My teammate never even applied. We walked
   in anyway, and built the one group project where everyone actually shows up."
2. **Opener A (30 s, while they scan):** "Last time you hung out with friends, how much of it was everyone on their own
   phone? Game nights fix that, but someone has to run the game, so nobody plays. Here, Meta's Muse is the Dungeon
   Master. The TV is the table, your phone is the controller. On your turn your friends send you ideas, and using one
   is your best move. You swipe to throw the die, Muse paints what happens, and at the end you find out it was based
   on a true story. Scan this." Then: "It's a whole game in about five minutes."
3. Heroes: "Muse is painting you as a cartoon. Your secret talent comes back at the end." Press Start.
4. Over the opener, once: "Muse wrote this and painted you in." Then quiet.
5. Each turn: "Everyone else, send [name] an idea. Use a friend's and you get plus one." / "Swipe up to throw. Code
   rolls the dice, never the AI." Then stop talking; let them argue.
6. Finale: "Everyone back one plan, not your own. Then everyone shakes at once."
7. Reveal: "What you did", then "What really happened". "That's how it really went." "That's the talent you typed."
   "Take it home."
8. Close: "Your friends' ideas were your best move. Muse wrote, judged and painted every decision; code rolled the
   dice. It was based on a true story. And you just played it." For Meta judges, last: "Every brain in this game is
   Meta's Muse: it writes, judges every plan, paints you in, and listens. The only thing it borrowed is a voice."
9. Reset: let them scan the keepsake QR, then F5 the TV tab (new room code).

Questions: the top 5 answers are in `pitch/CHEAT_SHEET.md`. Don't know? "Good question; I don't want to guess. Can I
follow up?" Never say "4 minutes", "this week's news", "nothing is saved", or any cut feature.

## If something goes wrong
| Problem | Do |
|---|---|
| **Muse is slow** | Say nothing. Canned lines fill in and the old painting stays until the new one fades in. If every call falls back for a whole game, play the backup video and talk over it. |
| **The voice fails** | The text still shows. "Tonight the narrator is shy." Check the laptop volume, move on. |
| **A phone can't join** | Hand them the spare phone already on `/play`, or have them type `groupproject-game.vercel.app/play` + the 4 letters. Don't debug a judge's phone. |
| **Wi-Fi drops** | The game pauses itself. Switch the laptop to your hotspot; judges rescan. Hotspot down too: the video. |
| **The game freezes** | F5 the TV tab; everyone rescans. Twice in a row: the video. |
| **The site itself is broken** (errors, blank page, after a new deploy) | **Roll back** (below), then F5. |

## Rollback (only if the live site misbehaves)
The known-good build is `once-upon-a-roll-ggknns93n` (git tag `judge-safe-1`). Away from the judges, open a terminal
in `C:\Users\oclab\AppData\Local\Temp\gpd\game` and run:

```bash
npx vercel promote https://once-upon-a-roll-ggknns93n-bl4ck-b0mb.vercel.app
```

If that fails: `npx vercel rollback`. Wait ~30 s, close the terminal, F5 the TV tab.
