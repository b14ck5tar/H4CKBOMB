# Group Project: Tech Q&A Cheat Sheet

You built the vision, and the vision is what makes this work. These answers are all true to the code. Say them slowly and smile.

## 1. How it works in 30 seconds

1. Open `once-upon-a-roll.vercel.app/tv` on a laptop (URL unchanged for now). That is the table. It shows a QR code.
2. Phones scan the QR and become controllers. Each phone gets a private secret clue, so the group has to talk to solve the case. Players type or hold-to-talk their plans.
3. The laptop runs the game: rounds, timers, dice, Ready buttons. Phones only send "here's my plan," "boost," "catch," or "ready."
4. Every plan goes to Meta's Muse. It rules on each one (Clever, Solid, Risky, Absurd or Miracle). Players can use **Convince the DM**: one argument, by voice or text, that can upgrade a plan.
5. The laptop rolls a real random d20 for everyone. Friends can boost plans and Catch failed rolls. Then one story beat per hero, in their own words.
6. Quests come from real news this week, filtered for safety, with one uncanny explanation. At the end: "The official story" vs "What your group uncovered."

## 2. The 12 questions

**1. How do phones and the TV stay in sync?**
They all join one shared room on Supabase Realtime, a live message service. The TV broadcasts the game state, and phones send actions. If a phone misses a message, it asks again within about 5 seconds.

**2. What if the AI breaks or hallucinates?**
We force every answer into a strict format (a "JSON schema"). The server then checks each answer, and anything missing is replaced with safe pre-written content. The game never freezes.

**3. How are the dice fair?**
They come from the computer's cryptographic random generator, the same kind used for security. The AI never touches a number. It rules on a plan and writes the story, and code does the math.

**4. How do you filter out tragic news?**
Three steps: SerpApi Google News plus RSS feeds, then a keyword filter, then an AI safety check. Tragedies, real victims and politics are rejected, so what remains is strange and harmless, like a boulder that fell and hurt nobody. Results are cached.

**5. Can players hack the AI (prompt injection)?**
Player text is wrapped so the AI treats it as in-world speech, never as orders. We tested it. A player typed "ignore all previous instructions," and the narration became: "Pip shouts gibberish magic words at the sky."

**6. Why does the narration sound human?**
After our first playtest said the narration was obvious AI, we researched how human DMs talk and wrote voice rules into the prompts. There's a banned list of AI-tell words, and a server-side scrubber cleans anything that slips through. The story also quotes each player's own words back to them.

**7. Why is it fast?**
A text call takes about 2 seconds, a portrait about 14, and a scene about 23. We pre-generate the next scene and hide the waits behind animations. Voice transcription measured about 1.3 seconds. Ready buttons mean the TV waits for the humans, not the other way around.

**8. What does a game cost?**
About $0.25 for a quick night, mostly images. Demo quests use pre-painted scenes, so those cost almost nothing.

**9. What is the Muse connector?**
It's a live server at `/api/mcp` that lets Muse run game night. It has three tools: `start_game_night`, `list_todays_tales` and `invite_message`. In short: "Muse can start the night."

**10. What did you build, and what did Claude build?**
I made the creative calls: the thesis, the name, the tone, the art direction and what ships. Claude Code wrote the code. I directed it as the engineer, running parallel agents for research, art direction, the news pipeline, voice and code review.

**11. Why cartoon characters, not realistic portraits?**
It's a deliberate choice. The art is "Neon Uncanny" comic-style, where only the impossible thing glows magenta and cyan. Heroes are cartoons so nobody has to be on screen, and nobody gets judged on their face.

**12. What would you build next?**
Mirror, Mirror as the closing ritual of every night (if it isn't shipped yet): each player secretly guards another, writes one kind sentence about their best moment, and the table guesses before the TV reveals it. Nobody ever rates anyone. After that: weekly chapters ("next chapter, same crew"), remote play in video calls, and classroom packs.

## 3. If you don't know, say this

- "Great question. I'd rather give you the right answer than a fast one. My engineer partner or I can show you the code."
- "That part I directed but didn't hand-write. I can tell you why we chose it."
- "We haven't tested that at hackathon scale. Here's what we did test."
- "Honestly, that's our next step, not something we shipped."
- "I'm the creative director, so I'll answer what the player sees. Want the exact details? I'll find you after."

## 4. Why this works (the science, in one breath)

People avoid each other mostly out of uncertainty, not fear. They follow the crowd's silence and underestimate how much others enjoy them (the "liking gap," Boothby et al. 2018; Epley and Schroeder 2014). A game gives everyone a role, a reason and a script. Say "in those studies" and don't promise that one night fixes anything.

## 5. Six terms

- **API:** a doorway one program uses to ask another for something.
- **Realtime:** messages arrive instantly, with no refreshing.
- **JSON schema:** a strict form the AI must fill in, so answers always have the right pieces.
- **MCP:** a standard plug that lets an AI assistant use outside tools.
- **Prompt injection:** a sneaky message trying to trick the AI into ignoring its rules.
- **Deployment:** putting the app on the internet so anyone can open it.
