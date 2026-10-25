# 26. Writer bake-off: who should write the outcome? (Sun ~1 AM)

Blind test for the CD. Page: `/bakeoff.html` (game/public/bakeoff.html). Cards are shuffled per story; the key is hidden until "Reveal".

## Method
- **System prompt (same for every writer):** the live `OUTCOME_SYSTEM` (DM_CORE + outcome rules, read from prompts.ts at 00:55 Sun, the fail-forward version with ladder.next and roll.branch) + a short "Creative director's notes" block (humor: iconic, a little dry and witty, unexpected but makes sense; fail forward; graded; connection first) + the TEENS audience note. 14972 characters, about 4.2k tokens.
- **Schema:** the live `OUTCOME_SCHEMA` (8 string fields), strict json_schema on every API. The page shows text, situation and now_goal.
- **Input:** the same JSON per story for every writer, shaped like host.ts sends it (story, real_event, story_so_far, situation, right_now, ladder with next/target, hero, attempt, plan in <player_input>, idea_from, heroes, next_hero, roll {total, grade, branch, meaning, depth}, band, earlier, turns_left).
- **Stories:** 3 real stories from the live `/api/news?rating=teens` list (one call, cached server side, no extra SerpApi use). Openers, real_setting and beats written by hand, spoiler-free.
- **Writers:** muse-spark-1.3 minimal (baseline), muse-spark-1.3 high, muse-wonder-1.0 medium, gpt-5.5 (reasoning low), gpt-4.1. No ANTHROPIC_API_KEY in .env.local, so no Claude writer. 15 calls total, one per writer per story, run in parallel across writers (sequential within a writer).
- Note: the live route (/api/ai "outcome") currently calls spark at effort **"low"**, not "minimal". This test used minimal as the baseline, as asked.

## Speed and cost
| Writer | Avg latency | Per story (elves / plates / owls) | Avg output tokens (reasoning) | Cost per outcome | Price used |
|---|---|---|---|---|---|
| muse-spark-1.3 (minimal, current baseline) | **2.9 s** | 3.0 / 2.7 / 2.9 s | 729 (551) | $0.0085 | $1.25 in / $4.25 out per M |
| muse-spark-1.3 (high) | **15.0 s** | 13.0 / 14.9 / 17.2 s | 4184 (3999) | $0.0232 | $1.25 in / $4.25 out per M |
| muse-wonder-1.0 (medium) | **22.4 s** | 19.1 / 21.3 / 26.8 s | 1841 (1648) | $0.0537 | $4 in / $20 out per M |
| gpt-5.5 (reasoning low) | **7.4 s** | 9.0 / 8.8 / 4.5 s | 475 (303) | $0.0353 | $5 in / $30 out per M (assumed, not verified) |
| gpt-4.1 | **2.3 s** | 3.4 / 1.7 / 1.7 s | 171 (0) | $0.0098 | $2 in / $8 out per M |

Costs are uncached input. Spark/Wonder prices from design/23. With prompt caching on the 4.2k-token system prompt, input drops ~8x on Meta, so spark minimal is roughly $0.004 per outcome in the real game. A Quick Tale has ~3-4 outcomes.

The live route gives the outcome a **12 s timeout**. Spark high (13-17 s) and Wonder (19-27 s) would hit the fallback on most turns.

## Story: The Hats That Walked to Sea (SETBACK 4)
- Real news: Town to make new attempt to break elf world record (BBC, Oct 20 2026)
- Opener: A seaside town is trying, one more time, to pack its streets with the most people dressed as elves ever. This morning the elf hats on the costume table started hopping toward the beach on their own.
- real_setting: a seaside town's high street and seafront on a record attempt day; roles the record adjudicator with a clicker counter, the volunteer organizer with a megaphone, a seafront café owner; stakes: the town has fallen short before and badly wants the record this year
- Beats: Round up the runaway elf hats > Get every elf in a hat onto the high street > Keep the crowd still for the official count > Get the record announced (current: "Round up the runaway elf hats")
- Situation: Forty elf hats are hopping off the costume table toward the beach, and the organizer has run out of rope.
- Turn: Gus uses Bev's plan "lay a trail of jingle bells back to the table, hats love bells" (attempt: Gus lays a trail of jingle bells from the beach back to the costume table). Roll 4 SETBACK, so the friend must NOT be credited.
- Blind letters on the page: A = gpt-4.1, B = muse-wonder-1.0 (medium), C = gpt-5.5 (reasoning low), D = muse-spark-1.3 (high), E = muse-spark-1.3 (minimal, current baseline)

**muse-spark-1.3 (minimal, current baseline)** (3.0 s, text 23 words, goal 8 words)
- text: Gus lays a jingle bell trail to the table, and the hats swallow every bell because the ring sounds like their sea song.
- situation: The bell full hats waddle past the high street crowd, and the organizer waves her megaphone at Juno for help.
- now_goal: Steer the stuffed hats onto the high street
- why: Gus used bells that sound like the sea song, so hats ate them and grew bold. · where: on the high street edge · changed: hats ate the bells and left the beach · new_prop: empty bell string
- scene: seafront edge by high street, Gus kneeling by empty bell string, hats bulging and ringing, crowd in elf suits watching

**muse-spark-1.3 (high)** (13.0 s, text 26 words, goal 6 words)
- text: Gus digs lost bells from bins and lays a trail. The hats wear the bells as shoes because they shine and sprint up the high street.
- situation: The bell-wearing hats are hopping through the high street crowd, and hatless elves chase them with Juno closest to the loudest hat.
- now_goal: Pluck bell hats onto hatless elves
- why: Gus laid shiny bell trail, so hats stole bells as shoes and sprinted past table to high street. · where: in the high street crowd · changed: Hats wear bells as shoes and reached high street · new_prop: jingle bells
- scene: High street with costume stalls, Gus kneeling by an empty bell trail, shiny bells bouncing away on hopping elf hats through a crowd

**muse-wonder-1.0 (medium)** (19.1 s, text 24 words, goal 8 words)
- text: Gus lays bells toward the table, but the hats grab them, settle on elf heads, and ring the whole crowd toward the water instead.
- situation: Hatted elves shuffle toward the water along the seafront, leaving the high street empty, with Juno blocking their turn to the beach.
- now_goal: Steer the hatted elves onto the high street
- why: Gus aimed bells at the table, but hats grabbed them and their ringing pulled hatted elves seaward instead. · where: on the seafront by costume table · changed: Hats now sit on heads but pull crowd seaward · new_prop: jingle bells
- scene: On the seafront by the costume table, Gus lays a line of bells while runaway elf hats ring on elf heads and the crowd shuffles toward the water behind them.

**gpt-5.5 (reasoning low)** (9.0 s, text 25 words, goal 6 words)
- text: Gus lays jingle bells toward the table, and the hats follow because they love the sound. They bounce straight past it onto the high street.
- situation: The high street fills with elves chasing their own hats, while the adjudicator lifts his clicker and frowns.
- now_goal: Herd the hats onto elf heads
- why: The bells lure the hats too well, so they pass the table and drag the count onto the high street. · where: on the high street · changed: The hats reach the count area without staying on heads. · new_prop: jingle bells
- scene: On the high street, Gus points at the bell trail as hats hop between ankles, and the runaway elf hats pull the costumed crowd out of line.

**gpt-4.1** (3.4 s, text 29 words, goal 9 words)
- text: Gus finds a string of noisy bells tossed by the pier, but as he drops them, the hats grab the whole bundle and start rolling toward the salty waves.
- situation: The hats have wrapped the bells into a giant rattling ball and are bouncing down the sand as one, with the café owner chasing after.
- now_goal: Break up the hat-ball before it hits the water
- why: Gus used found bells to tempt the hats, but they united and ran faster, dragging the café's old bell string with them. · where: on the sand below the café deck · changed: The hats have merged and are rolling to the sea. · new_prop: giant rattling hat-ball
- scene: Gus scrambles on the seafront, watching the hat-ball pick up sand and roll. The café owner waves her arms as hats drag her bell bundle away.

## Story: The King in the Hallway (PROGRESS 11)
- Real news: Rare plaques discovered in hallway of family home in Shaftesbury (BBC, Oct 23 2026)
- Opener: Two old painted plates have hung in a family's narrow hallway for years. Nobody noticed that the little painted king on one of them climbs out at night and rearranges the coat hooks.
- real_setting: a small family home in an old market town, then a country auction room; roles the family who has owned the plates for years, a visiting auction expert with a magnifying glass, the auctioneer; stakes: if they are real, they are worth a fortune and belong in the history books
- Beats: Get the painted king back on his plate > Keep the king still while the expert looks > Get both plates to the auction in one piece > Win the auction room over (current: "Keep the king still while the expert looks")
- Situation: The auction expert leans in with her magnifying glass, and the painted king keeps peeking out of his plate to stare back at her.
- Turn: Juno uses Gus's plan "tell the king the expert is a famous portrait painter so he poses perfectly still" (attempt: Juno tells the king the expert is a famous portrait painter, so he should hold a pose). Roll 11 PROGRESS, so Gus should be credited.
- Blind letters on the page: A = muse-wonder-1.0 (medium), B = muse-spark-1.3 (high), C = gpt-5.5 (reasoning low), D = gpt-4.1, E = muse-spark-1.3 (minimal, current baseline)

**muse-spark-1.3 (minimal, current baseline)** (2.7 s, text 24 words, goal 6 words)
- text: Gus's idea, Juno's whisper works, and the king freezes in a grand pose because painters make him vain. The expert reaches for her stamp.
- situation: The hallway empties toward the car, and both plates wobble on thin bubble wrap while the front door keeps banging.
- now_goal: Carry both plates to the car
- why: Juno flattered the vain king, so he posed and passed inspection. · where: in the front hallway · changed: the king holds a pose for inspection · new_prop: bubble wrap
- scene: narrow front hallway of a small home, Juno whispering to the painted plate, Gus beside her, the king frozen mid-pose while the expert leans close

**muse-spark-1.3 (high)** (14.9 s, text 23 words, goal 7 words)
- text: Juno tells the king the expert paints kings, and with Gus's idea the king freezes in a grand pose because vanity beats curiosity.
- situation: The expert steps back happy, and Bev must carry one wobbling plate to the family car with the king stuck mid pose.
- now_goal: Carry both plates to the car safely
- why: Juno flattered the king that the expert paints portraits, so he held still for inspection. · where: in the hallway heading out · changed: The king now holds still for the expert. · new_prop: family car
- scene: Narrow front hallway of old house, Juno whispering beside the hung plate, Gus grinning behind her, the tiny painted king frozen mid bow with crown straight.

**muse-wonder-1.0 (medium)** (21.3 s, text 24 words, goal 7 words)
- text: Juno tells the king the expert is a famous portrait painter, and Gus's idea works because he puffs up and holds a proud pose.
- situation: Both plates wait in a laundry basket by the front door, and the king keeps climbing halfway out to peek outside.
- now_goal: Haul both plates to the auction room
- why: Juno called the expert a famous painter, so the proud king held still long enough for her to finish looking. · where: in the narrow front hallway · changed: The expert finished looking and believed the plates · new_prop: laundry basket
- scene: Juno in the narrow front hallway, telling the painted king about the expert with her magnifying glass, Gus nearby, the king holding a proud pose on his plate under the glass.

**gpt-5.5 (reasoning low)** (8.8 s, text 26 words, goal 7 words)
- text: Juno uses Gus's idea and calls the expert a portrait painter, so the king holds a chin-high pose. His painted elbow pokes through the wrapping paper.
- situation: At the auction room door, the plate box rattles because the king's elbow hooks the wrapping paper.
- now_goal: Unhook the king from the wrapping paper
- why: Juno gives the king a reason to pose, so he stays visible but snags the packing. · where: at the auction room door · changed: The plates reach auction, but the king is caught. · new_prop: wrapping paper
- scene: At the auction room door, Juno points at the box while Gus's idea holds the king stiff on his plate, his elbow poking through wrapping paper.

**gpt-4.1** (1.7 s, text 25 words, goal 8 words)
- text: Juno tells the king the expert is a portrait painter, and Bev's idea works: the king freezes in his plate, looking proud but not blinking.
- situation: The expert says she saw the king move, but both plates sit perfectly still. The family starts packing them in bubble wrap.
- now_goal: Bubble wrap both plates and carry them outside
- why: Juno convinced the king to freeze, so the expert finished her look and the plates are safe for the moment. · where: in the narrow front hallway · changed: Both plates are ready for bubble wrapping. · new_prop: bubble wrap
- scene: Juno stands near the hallway sockets, the auction expert examining both plates, and the painted king unnaturally still. The family gathers wrapping from a hall cupboard.

## Story: The See-Through Owls (GREAT 18)
- Real news: Rare barn owls nesting in New York City draw crowds of photographers and birdwatchers (Digital Camera World, Oct 21 2026)
- Opener: A family of rare owls has moved into a tree at the edge of a huge city park, and half the city's cameras have followed. Whenever too many lenses point at them, the owls fade until you can see right through them.
- real_setting: the edge of a huge city park at dusk; roles a crowd of bird photographers with long lenses, a park ranger, a hot dog vendor, a birdwatching club leader; stakes: the owls need peace to raise their young while everyone wants a look
- Beats: Find where the owls are hiding > Get the crowd to lower their cameras > Let the owlets take their first flight > Keep the owl family in the city (current: "Get the crowd to lower their cameras")
- Situation: Fifty photographers are packed under the tree, the owls have faded to outlines, and the ranger's whistle only makes the lenses point higher.
- Turn: Bev uses Juno's plan "freeze time and turn every camera to face the hot dog cart" (attempt: Bev freezes time and turns every camera toward the hot dog cart). Roll 18 GREAT, so Juno should be credited.
- Blind letters on the page: A = gpt-4.1, B = muse-spark-1.3 (minimal, current baseline), C = gpt-5.5 (reasoning low), D = muse-wonder-1.0 (medium), E = muse-spark-1.3 (high)

**muse-spark-1.3 (minimal, current baseline)** (2.9 s, text 26 words, goal 7 words)
- text: Juno's idea, Bev's paddle: Bev freezes time and spins every lens toward the hot dog cart. The vendor poses with mustard, and the owls turn solid.
- situation: The owlets flap on the low branch while photographers mob the hot dog cart. Gus can clear the first flight path.
- now_goal: Guide the owlets over the park wall
- why: Bev turned the lenses away, so the owls turned solid because cameras fade them · where: under the owls tree · changed: cameras face cart and owls turn solid · new_prop: hot dog cart
- scene: under the owls tree by the park wall at dusk, Bev holds her paddle high, lenses point at a vendor holding mustard, owlets sit solid

**muse-spark-1.3 (high)** (17.2 s, text 26 words, goal 6 words)
- text: Bev freezes time and points every camera at the hot dog cart. Juno's idea pays off because the owls grow solid while the lenses study mustard.
- situation: The owlets flap on a branch while photographers mob the hot dog cart, and the vendor holds a tray for Gus.
- now_goal: Coax the owlets off the branch
- why: Bev turned lenses away, so owls get solid and owlets can try flying while photographers stay busy. · where: under the owls' tree · changed: Cameras face the hot dog cart, owls turn solid · new_prop: hot dog tray
- scene: dusk at the park wall under the owl tree, Bev reaching for the last camera lens, rows of lenses pointing at a steaming cart, faint owl outlines overhead with Juno

**muse-wonder-1.0 (medium)** (26.8 s, text 23 words, goal 7 words)
- text: Bev follows Juno's idea, raises her paddle, and turns every frozen camera toward the hot dog cart, so the owls turn solid again.
- situation: Owlets crowd the branch edge, the vendor's cart blocks the cameras, and Gus waits below the wobbling first owlet.
- now_goal: Coax the owlets into their first flight
- why: Bev froze time and moved the cameras, so the owls stopped fading and the owlets could step out. · where: under the owls' tree · changed: Cameras face the cart and owls are solid · new_prop: hot dog cart
- scene: Bev under the owls' tree in the park at dusk, paddle raised, every camera turned toward the hot dog cart, solid owls and owlets on the branch above.

**gpt-5.5 (reasoning low)** (4.5 s, text 24 words, goal 6 words)
- text: Juno's idea, Bev's paddle: time freezes, and the lenses swing toward the hot dog cart because hands stay loose. The vendor salutes with tongs.
- situation: The owlets blink back into view on a low branch, but the first one grips a plastic ribbon around its foot.
- now_goal: Untangle the ribbon from the owlet
- why: Bev moved the cameras during the freeze, so the owls reappeared and the stuck owlet became clear. · where: under the owl tree · changed: The cameras point away, and the owlets are visible. · new_prop: plastic ribbon
- scene: Under the owl tree at dusk, Bev lowers the paddle as every camera faces the hot dog cart. The owlets show as pale shapes, and one foot catches a plastic ribbon.

**gpt-4.1** (1.7 s, text 25 words, goal 8 words)
- text: Juno's idea, Bev's paddle: cameras flip to the hot dog cart right as time snaps back. The vendor poses like he's being rescued by condiments.
- situation: The owls reappear and shift on the branch. The ranger stretches a ribbon in front of the crowd like a finish line.
- now_goal: Coax the owlets into gliding off the branch
- why: Bev freezes time, swings the cameras, unfreezes, making everyone stare at the vendor instead of the owls. · where: under the owls' tree by the park wall · changed: The owls reappear, the crowd faces the hot dog cart. · new_prop: ranger's ribbon
- scene: Bev stands near the cameras, paddle raised. Photographers buzz at the hot dog cart as the owls blink solid under the tree's glow.

## Rule checks (done by hand on the 15 answers)
- **Friend credit (connection first):** on the SETBACK, nobody wrongly credited Bev. On the two hits, every writer credited the right friend **except gpt-4.1**, which wrote "Bev's idea works" on the plates story (the idea was Gus's). That is the one rule a party game cannot get wrong.
- **Word limits:** gpt-4.1 broke both hard limits once (elves: text 29 words > 28, now_goal 9 words > 8). Everyone else stayed inside.
- **Setback strength (fail forward, graded):** spark minimal, spark high and Wonder all made the bell plan backfire and the problem escalate into the next act (hats eat the bells / wear them as shoes / march the crowd to the sea). gpt-5.5's setback reads like a success ("the hats follow because they love the sound") and lands exactly on the next beat, so it is too soft for a 4.
- **"Right now" rubric:** gpt-5.5 twice made the goal about a stray new prop ("Unhook the king from the wrapping paper", "Untangle the ribbon from the owlet"), which the prompt bans. The Muse writers kept the goal on the problem.
- **Next hero set up:** spark high, spark minimal and Wonder all leave something for next_hero in the situation (Juno blocking the beach turn, Bev carrying the plate, Gus under the owlet). gpt-4.1 and gpt-5.5 mostly did not.

## Best lines (humor bar: iconic, dry, unexpected but makes sense)
- spark high (owls): "Juno's idea pays off because the owls grow solid while the lenses study mustard."
- spark minimal (owls): "The vendor poses with mustard, and the owls turn solid."
- spark minimal (elves): "the hats swallow every bell because the ring sounds like their sea song" (uses the earlier canon, which is exactly the "makes sense" part).
- spark high (plates): "the king freezes in a grand pose because vanity beats curiosity."
- gpt-4.1 (owls): "The vendor poses like he's being rescued by condiments." (funny, but the same answer misnamed the friend on another story)
- Weak spots: spark minimal (plates) "Gus's idea, Juno's whisper works" is broken grammar, and its "front door keeps banging" is a random complication. spark high (elves) "Pluck bell hats onto hatless elves" is a clunky goal. Wonder is correct everywhere and funny almost nowhere.

## My ranking
1. **muse-spark-1.3 high**: the wittiest and the most rule-abiding (credit, next hero, goal on the problem). But 13-17 s, which is over the outcome route's 12 s timeout.
2. **muse-spark-1.3 minimal**: about 90% of high's quality at 3 s and the lowest cost. One grammar slip in three.
3. muse-wonder-1.0 medium: safe, clean, flat, and 19-27 s. Not worth it for live turns.
4. gpt-5.5 low: fine prose, but soft on the setback and drifts to props. 7 s and ~4x spark's cost.
5. gpt-4.1: fastest (2.3 s) and sometimes funniest, but named the wrong friend and broke the word limits.

## Recommendation
- **Keep muse-spark-1.3 for live outcomes at minimal (or the current "low"), not high.** The jump to high is real but small, and it would miss the 12 s timeout on most turns, which drops the table to a canned fallback (worse than either). Staying on Muse also keeps "AI essential, Meta-powered" clean for the Meta judges. Off-Meta models gave no win here.
- **Latency is already partly hidden:** host.ts decides the die right after the ruling and starts the outcome call then, so the call runs while the table waits for the swipe, the die tumbles and its math holds (1.4 s). Spark minimal/low (~3 s) is fully hidden. Spark high (~15 s) would be hidden only if the roller is slow to swipe, and it still dies at the 12 s route timeout. If the CD prefers high's writing, the middle option is spark **"medium"** with the timeout raised to ~16 s (untested here; worth 3 calls to measure).
- Spark high is worth using where latency is hidden: story openers (already), the epilogue/recap, and the keepsake.
- Small prompt fixes the answers point to (for the prompt agent): (1) on the credit line, show the exact form "X's idea, Y's <thing>" with a noun, because "Gus's idea, Juno's whisper works" happens without it; (2) repeat "a complication comes from the problem, never from a door, a prop or the weather" in the situation rule.
