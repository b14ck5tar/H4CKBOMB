# Devpost: update the submitted project (the CD, by ~10:15)

The project is **already submitted** (7:17 recording, `devpost-media/DEVPOST_CURRENT.md`); edits stay open until
11:30 AM. Go to hacktx26.devpost.com → **My projects** → Group Project → **Edit project**, and walk the steps in order.
On each step press **Save** before moving on. Close Discord, DMs, key files and terminals before sharing your screen.

## ⚠️ Do this first: Additional info → Sponsor / Special Prizes is EMPTY
Right now the project is **not entered in Meta's track**. On the **Additional info** step, under "Sponsor / Special
Prizes", tick:
- [ ] **Meta: Bringing People Closer Together with AI**
- [ ] **Most Entertaining**
- [ ] **Best Use of SerpApi**
- [ ] **TODO CD:** anything else you want to enter. Gemini: leave it unticked (your call: Gemini is only our
      last-resort backup voice).
Press **Save**.

## 1. Manage team: keep
oclabomb rudd + Uche are already on it.

## 2. Project overview
| Field | Do |
|---|---|
| Project name | keep (`Group Project`) |
| Elevator pitch | **replace** with: `The one group project where everyone actually shows up: a party game where Meta's Muse is the Dungeon Master, your phones are the controllers, and every story starts from real life.` (181 characters) |
| Thumbnail | keep (the paint-splash logo) |

## 3. Project details
**About the project: replace everything.** Select all in the box and delete it. Then open `DEVPOST.md`, copy from the
line `## Inspiration` down to the last bullet of `## What's next for Group Project` (stop at the `---` line), and
paste. This fixes everything stale in the old text:
- "What are you weirdly good at?" → "What's your secret strength?", and players name their own hero.
- "Needs 12+" → gone; every number is its own outcome.
- "Fixed start, fixed goal" → players steer; the ending is "What you did" → "What really happened" + the bridge line.
- "a narrator voice the AI casts" / "Gemini TTS narrates (in progress)" → one ElevenLabs narrator, Sarah, with
  OpenAI as the backup.
- The "in progress" items now ship: a new painting every turn with your heroes, the keepsake QR, Our stories.
- "8-year-old clarity" → "a tired adult at a party gets it on first hearing".
- Added: the Muse connector, judge mode, quips, the friend's-idea slam, the convince-each-other talk, story sound
  effects, the Adults tier with hard limits, the Meta-first model table, and your Accomplishments line.

**Accomplishments line (CD picks one; option 1 is already in `DEVPOST.md`):**
1. ⭐ "Our creative director's first hackathon. Our application got denied and one of us never applied, so we walked
   in anyway, and shipped a game where the AI runs the night and the humans just get to play."
2. "My first hackathon. I didn't write the code, I directed it, and learned that AI builds things that look good fast,
   but making them feel good took a whole night of playtesting with real people."
   (To use 2, replace the first-hackathon bullet under Accomplishments after pasting.)

**Built with: replace.** Remove the old tags (click the x on each), then type each and press Enter:
`next.js` `react` `typescript` `tailwindcss` `vercel` `supabase` `meta-muse` `muse-spark` `muse-image`
`muse-voice-transcribe` `mcp` `elevenlabs` `openai` `gemini` `web-audio-api` `serpapi` `google-news` `claude`
`claude-code` (19 tags; all used in the code. `gemini` stays because Gemini TTS is still the last-resort backup voice.)

**"Try it out" links: add one** (keep the first):
1. keep `https://groupproject-game.vercel.app/tv`
2. add `https://groupproject-game.vercel.app/tv?judge=1`

**Code repository: REQUIRED by Meta's official rules** ("a link to a publicly accessible code repository").
`b14ck5tar/H4CKBOMB` is private today. **CD does this:**
1. History is checked: none of our 7 key values appear in any of the 362 commits, and no `.env` file was ever committed
   (Claude, Sun ~8 AM). A `README.md` at the root says what we built vs the libraries and APIs we used.
2. GitHub → b14ck5tar/H4CKBOMB → **Settings** → General → scroll to **Danger Zone** → **Change visibility** →
   **Change to public** → confirm.
3. Make sure the final code is on the default branch (`main`), or link the branch:
   `https://github.com/b14ck5tar/H4CKBOMB/tree/rebuild-around-the-table`.
4. Add `https://github.com/b14ck5tar/H4CKBOMB` as a "Try it out" link (and in any "code repository" field the form has).

## 4. Project media
**Image gallery: replace all 5** (old lobby, old Gus turn, old phones, old boulder reveal). Delete each, then upload
`devpost-media/gallery-final/` 1 to 6 in order, with these captions:
1. `1-lobby-and-phone.jpg`: `The TV is the table, your phone is the controller. Name your hero and tell it your secret strength.`
2. `2-friends-ideas-best-move.jpg`: `On your turn your friends pitch you ideas. Use one: +1 and their name on screen. Then swipe to throw.`
3. `3-heroes-painted-in.jpg`: `Muse Image paints your own heroes into a new scene after every decision.`
4. `4-new-painting-read-aloud.jpg`: `A new painting every turn, read aloud by one narrator, Sarah.`
5. `5-based-on-a-true-story.jpg`: `The ending: what you did, then what really happened.`
6. `6-under-the-hood.jpg`: `Muse writes and judges. Code rolls the dice. Players steer.`

**Video demo link: replace** `https://youtu.be/wu14pZQE4NY` with the new video from the video session (~9:45). Check
it in a private window first.

## 5. Additional info
| Field | Do |
|---|---|
| Sponsor / Special Prizes | **see the top of this page** (tick Meta + Most Entertaining + SerpApi) |
| Universities or schools | **replace** `UT` with `The University of Texas at Austin` |
| .Tech domains | keep empty |
| Feedback about technology (optional) | **add:** `Muse Spark at minimal effort was fast enough to judge every plan live, and Muse Image edits with reference images kept our characters consistent from scene to scene. The one thing we missed was a Meta text-to-speech model, so the narrator is the only non-Meta piece.` |
| Which AI tools did you use? | tick **Anthropic**; also tick **Meta**, **OpenAI** and **Gemini** if they're listed (Muse is the game's AI; OpenAI and Gemini are backup voices) |
| Did you implement a generative AI model or API? | **replace** `Yes` with the paragraph below |
| Gemini Project Number | keep empty (we're not entering the Gemini prize) |

Generative AI answer (paste as is):
```
Yes. Meta's Muse is the Dungeon Master and runs the whole game. Muse Spark scores real odd news for safety and whether it makes a good story, writes each story opening, judges every player's plan at face value, and writes what happens next at the grade the dice gave, plus the grand ending. Muse Image paints the players' own heroes into a new scene after every decision. Muse Voice Transcribe lets players speak their plan. A Muse connector (MCP) lets Muse start a game night. Why: so nobody has to be the Dungeon Master, and the humans can just talk to each other. Code rolls every die and checks every AI change to the story; the AI judges ideas, never people. The narrator's voice is ElevenLabs, because Meta has no text-to-speech model. We built it with Claude Code as our lead engineer.
```

## 6. Submit
- [ ] **Every team member is a registered HackTX participant** (official rule). Both of you: confirm you're checked in /
      registered with HackTX.
- [ ] Required by Meta: the video link, the public repo link, and the description (the About text) are all filled in.
- [ ] Keep the terms box ticked. If the page shows a **Submit** or **Update** button, press it.
- [ ] Check the status still says **"Project submitted!"**.
- [ ] Screenshot the public project page and post it in the team hub notes:
      https://claude.ai/artifact/Aehk1tVCwhGP9ydNnXxFD3
