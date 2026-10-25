import type { Branch, Grade } from "@/lib/grade";

/**
 * The Writers' Room: gold-standard examples the Dungeon Master learns from (few-shot). See design/28-writers-room.md.
 *
 * Why examples: the model copies the shape, length and humor of what it is shown far more reliably than it follows
 * instructions. So every line here obeys the house voice exactly:
 *   iconic, a little dry and witty, unexpected but it makes sense; an 8-year-old follows it the first time;
 *   1 or 2 short sentences; concrete pictures; plain cause and effect; one fantasy twist on top of a real event.
 *
 * LEAKAGE RULE (design/09): the model copies example lines word for word when the live story looks like an example.
 * So these events are NOT any demo quest or tonight's likely news (no fossils, pumpkins, bridges, beads, otters).
 * Pass the live story's text as `avoid` to the prompt builders below and any example game that overlaps is skipped.
 *
 * The three example events are real KINDS of odd news (a town elf-costume record try, a stopped town clock being
 * restored, a houseboat harbor kept awake by a mystery hum). They are written as types of events, never as claims
 * about a specific real article.
 */

// ---------------------------------------------------------------- types

export type ExampleRealEvent = {
  place_type: string;
  roles: string[];
  situation: string;
  stakes: string;
  arc: string[];
};

export type ExampleHero = { name: string; power: string; weakness?: string };

export type ExampleTurn = {
  /** What the heroes faced at the start of this turn (the previous outcome's situation). */
  situation: string;
  /** The "Right now" goal on screen during this turn. */
  right_now: string;
  /** The ladder step this outcome moves the story to (input ladder.next). */
  ladder_next: string;
  hero: ExampleHero;
  /** What the player typed, casual phone typing. Never pasted into the text. */
  plan: string;
  /** What the hero tries, in plain words (the ruling's interpretation). */
  attempt: string;
  /** The friend whose suggestion the turn owner used, or "". Credited only on better or legendary. */
  idea_from: string;
  roll: { total: number; natural: number | null; grade: Grade; branch: Branch };
  /** OUTPUT text: 1 or 2 sentences, 26 words max, starts with the hero's name. */
  text: string;
  /** OUTPUT situation: the NEW moment, 22 words max. */
  next_situation: string;
  /** OUTPUT now_goal: verb-first, 8 words max, a real step toward the story goal. */
  now_goal: string;
  /** OUTPUT why: the DM's Notes cause and effect, 20 words max. */
  why: string;
  /** For humans and the model: what makes this turn gold. */
  craft: string;
};

export type ExampleGame = {
  id: string;
  /** Words that mean the live story is too close to this example (skip it to avoid copying). */
  keywords: string[];
  title: string;
  mood: string;
  real_event: ExampleRealEvent;
  problem: { name: string; what: string; stakes: string; pronoun: "she" | "he" | "they" | "it" | "none" };
  goal: string;
  ladder: string[];
  heroes: ExampleHero[];
  turns: ExampleTurn[];
};

export type BadExample = {
  kind: "jargon" | "prop hijack" | "going backward" | "vague goal" | "pasted player text" | "blaming" | "too long" | "spoiler";
  bad: string;
  why: string;
  better: string;
};

export type GoalExample = { context: string; weak: string; good: string; why: string };

export type OpenerExample = {
  id: string;
  keywords: string[];
  /** The real kind of event, plain (the opener prompt's SOURCE). */
  real: string;
  punchline_words: string[];
  real_setting: ExampleRealEvent;
  quest_title: string;
  teaser: string;
  mood: "silly" | "spooky" | "cozy" | "eerie" | "wondrous" | "tense";
  scene_line: string;
  problem_line: string;
  stakes_line: string;
  goal: string;
  situation: string;
  npc_line: { speaker: string; line: string };
  problem: { name: string; stakes: string; pronoun: "she" | "he" | "they" | "it" | "none" };
  beats: string[];
};

export type CallbackExample = {
  kind: string;
  /** The earlier moment being called back (what happened, who, when). */
  earlier: string;
  /** Where the story is when the callback lands. */
  now: string;
  /** The line that calls it back. */
  line: string;
  why: string;
};

// ---------------------------------------------------------------- 1. outcome examples (3 games x 4 turns)

const ELF_EVENT: ExampleRealEvent = {
  place_type: "a small town square on a cold winter morning",
  roles: ["volunteers handing out elf costumes", "an official record judge with a clicker", "townspeople lining up to be counted"],
  situation: "the town is trying to set a record for the most people dressed as elves in one place",
  stakes: "if costumes are incomplete at the count, the record attempt fails",
  arc: ["Volunteers hand out costumes to the crowd", "Everyone squeezes into the square", "The judge counts every elf", "The town finds out it set the record"],
};

const CLOCK_EVENT: ExampleRealEvent = {
  place_type: "an old clock tower on a small town's square",
  roles: ["volunteer clock fixers", "the mayor planning a restart ceremony", "shop owners on the square"],
  situation: "volunteers are fixing the town clock, which stopped years ago",
  stakes: "the town planned a ceremony to hear the clock chime again",
  arc: ["Volunteers climb the tower to the stuck clock", "They clean out years of dust and pigeon mess", "They find the broken part and replace it", "The clock chimes again for the whole town"],
};

const HARBOR_EVENT: ExampleRealEvent = {
  place_type: "a houseboat neighborhood in a quiet harbor at night",
  roles: ["houseboat neighbors who can't sleep", "a scientist with an underwater microphone", "the harbor master"],
  situation: "a low hum keeps the whole harbor awake every night, and nobody can find where it comes from",
  stakes: "nobody can sleep, and some neighbors talk about moving away",
  arc: ["Neighbors hear the hum every night", "They search the docks and boats for it", "A scientist listens under the water", "They find the cause and learn to live with it"],
};

export const OUTCOME_EXAMPLES: ExampleGame[] = [
  {
    id: "elf-record",
    keywords: ["elf", "elves", "costume", "record attempt", "world record"],
    title: "Hold On to Your Hats",
    mood: "silly",
    real_event: ELF_EVENT,
    problem: {
      name: "The Floating Hats",
      what: "the pointy elf hats float up like balloons whenever someone near them laughs",
      stakes: "a hatless elf doesn't count, so the record fails",
      pronoun: "none",
    },
    goal: "Get every elf counted with a hat on",
    ladder: ["Get the floating hats back down", "Squeeze everyone into the square", "Hush the crowd for the count", "Get every elf counted with a hat on"],
    heroes: [
      { name: "Lou", power: "Knot Hands: ties anything to anything, fast" },
      { name: "Omar", power: "Gap Finder: slips himself or anything through any gap" },
      { name: "Nadia", power: "Deadpan: never laughs, no matter what" },
      { name: "Tess", power: "Dad Voice: one stern sentence stops anyone in their tracks" },
    ],
    turns: [
      {
        situation: "Volunteers are handing out costumes and giggling, and every hat they hand out floats up over the bakery.",
        right_now: "Get the floating hats back down",
        ladder_next: "Squeeze everyone into the square",
        hero: { name: "Lou", power: "Knot Hands: ties anything to anything, fast" },
        plan: "tie all the hats to the costume table",
        attempt: "Lou ties the hat strings to the costume table",
        idea_from: "",
        roll: { total: 11, natural: null, grade: "PROGRESS", branch: "better" },
        text: "Lou knots every hat to the costume table, and the hats stop drifting. The table now floats an inch off the ground, which is fine.",
        next_situation: "The hats are safe, but two hundred elves in jingly shoes are jammed in the side street, and the count starts soon.",
        now_goal: "Squeeze the elf crowd into the square",
        why: "Lou tied the hats to something heavy, so they stopped floating, but laughing still lifts them a little.",
        craft: "A low PROGRESS has a wobble (the floating table), said flatly. The power does the work. The goal moves to the next real step.",
      },
      {
        situation: "The hats are safe, but two hundred elves in jingly shoes are jammed in the side street, and the count starts soon.",
        right_now: "Squeeze the elf crowd into the square",
        ladder_next: "Hush the crowd for the count",
        hero: { name: "Omar", power: "Gap Finder: slips himself or anything through any gap" },
        plan: "lead everyone through the bakery shortcut",
        attempt: "Omar leads the crowd through the bakery",
        idea_from: "Tess",
        roll: { total: 1, natural: 1, grade: "DISASTER", branch: "worse" },
        text: "Omar squeezes two hundred elves through the bakery, right into the flour shelf. They burst into the square white as snowmen, and nobody can stop laughing.",
        next_situation: "The square is full of floury, laughing elves, and two hundred hats are slowly lifting off their heads.",
        now_goal: "Hush the crowd before the hats lift off",
        why: "The shortcut ran through the flour, and floury elves made everyone laugh, and laughing lifts the hats.",
        craft: "DISASTER is a picture the table retells. The crowd still reaches the square (fail forward), but the problem escalates from its own rule. Tess suggested it, and she is never mentioned on a fail.",
      },
      {
        situation: "The square is full of floury, laughing elves, and two hundred hats are slowly lifting off their heads.",
        right_now: "Hush the crowd before the hats lift off",
        ladder_next: "Get every elf counted with a hat on",
        hero: { name: "Nadia", power: "Deadpan: never laughs, no matter what" },
        plan: "stand on the fountain and stare at everyone till they stop",
        attempt: "Nadia stares the crowd quiet from the fountain",
        idea_from: "Lou",
        roll: { total: 15, natural: null, grade: "GREAT", branch: "better" },
        text: "Nadia gives the crowd her flattest stare from the fountain, Lou's idea. The laughing stops, and two hundred hats sink back onto two hundred heads.",
        next_situation: "Two hundred silent elves wait for orders, and the judge on the bandstand is biting her lip to keep from laughing.",
        now_goal: "Get the judge counting without a single laugh",
        why: "Nobody can keep laughing at Nadia's stare, so the hats came down. The judge is the last one giggling.",
        craft: "GREAT credits the friend in a few words and hands the next hero a bonus (a silent crowd that will follow orders). The new complication comes from the problem's own rule.",
      },
      {
        situation: "Two hundred silent elves wait for orders, and the judge on the bandstand is biting her lip to keep from laughing.",
        right_now: "Get the judge counting without a single laugh",
        ladder_next: "Get every elf counted with a hat on",
        hero: { name: "Tess", power: "Dad Voice: one stern sentence stops anyone in their tracks" },
        plan: "use dad voice on the judge, tell her this is serious business",
        attempt: "Tess tells the judge, sternly, that this is serious",
        idea_from: "",
        roll: { total: 22, natural: 20, grade: "LEGENDARY", branch: "legendary" },
        text: "Tess uses her sternest dad voice to call this a serious elf matter. The judge salutes and starts clicking faster than anyone has ever clicked.",
        next_situation: "The judge reaches the very last elf, and it's Omar, still white with flour and trying very hard not to giggle.",
        now_goal: "Get Omar counted with his hat on",
        why: "A stern voice beats a giggle, so the judge got serious and counted fast. Only the last elf is left.",
        craft: "LEGENDARY: someone reacts in a specific, human way (a salute). The act is nearly done, and the last bit calls back Omar's flour for the finale.",
      },
    ],
  },
  {
    id: "town-clock",
    keywords: ["clock", "clock tower", "chime", "bell tower", "town hall"],
    title: "Always a Quarter Past Three",
    mood: "wondrous",
    real_event: CLOCK_EVENT,
    problem: {
      name: "The Sleeping Clock",
      what: "the town clock fell asleep years ago, and while it sleeps, the square stays stuck at a quarter past three",
      stakes: "it is never noon, so the ceremony can never start",
      pronoun: "it",
    },
    goal: "Wake the clock so it can strike noon",
    ladder: ["Climb the tower to the sleeping clock", "Sweep out the dust it sleeps in", "Find the part that keeps it asleep", "Wake the clock so it can strike noon"],
    heroes: [
      { name: "Carmen", power: "Never Lost: always finds the way, even in the dark" },
      { name: "Wes", power: "Pigeon Friend: pigeons do him small favors" },
      { name: "Ines", power: "Fold Up: fits herself into any small space" },
      { name: "Theo", power: "Big Whistle: whistles loud enough to stop a bus" },
    ],
    turns: [
      {
        situation: "The tower stairs are pitch dark, and a slow, rumbly snore is coming from the top.",
        right_now: "Climb the tower to the sleeping clock",
        ladder_next: "Sweep out the dust it sleeps in",
        hero: { name: "Carmen", power: "Never Lost: always finds the way, even in the dark" },
        plan: "lead everyone up in the dark, i never get lost",
        attempt: "Carmen leads the group up the dark stairs",
        idea_from: "",
        roll: { total: 3, natural: null, grade: "SETBACK", branch: "worse" },
        text: "Carmen leads everyone up the dark stairs without one wrong step, straight into the pigeons' bedroom. Fifty pigeons wake up and fill the tower with dust.",
        next_situation: "At the top, the dust is so thick that nobody can see the clock, only hear it snoring.",
        now_goal: "Sweep enough dust to see the clock's face",
        why: "Carmen found the right way, and the right way went through the pigeons, who stirred up years of dust.",
        craft: "The power works and the plan still backfires, logically. The story still reaches the top (fail forward), and the setback makes the next act harder.",
      },
      {
        situation: "At the top, the dust is so thick that nobody can see the clock, only hear it snoring.",
        right_now: "Sweep enough dust to see the clock's face",
        ladder_next: "Find the part that keeps it asleep",
        hero: { name: "Wes", power: "Pigeon Friend: pigeons do him small favors" },
        plan: "ask the pigeons to flap all the dust out the window",
        attempt: "Wes asks the pigeons to fan the dust out the window",
        idea_from: "Theo",
        roll: { total: 7, natural: null, grade: "PARTIAL", branch: "mixed" },
        text: "Wes asks the pigeons for a favor, and they flap the dust out the window. Now the clock can breathe, so it snores twice as loud.",
        next_situation: "Each snore shakes the gears, and the heroes can see one bent gear jammed at the back, holding the hands still.",
        now_goal: "Pull the bent gear out between snores",
        why: "The pigeons cleared the dust, so the clock breathes easier and snores louder, which shows the bent gear.",
        craft: "PARTIAL: half works, and the twist follows from it (clean air, louder snore). The pigeons from the last turn come back as a tool. No friend credit on a mixed result.",
      },
      {
        situation: "Each snore shakes the gears, and the heroes can see one bent gear jammed at the back, holding the hands still.",
        right_now: "Pull the bent gear out between snores",
        ladder_next: "Wake the clock so it can strike noon",
        hero: { name: "Ines", power: "Fold Up: fits herself into any small space" },
        plan: "fold myself into the gears and grab the bent one",
        attempt: "Ines squeezes into the gears for the bent one",
        idea_from: "",
        roll: { total: 19, natural: null, grade: "GREAT", branch: "better" },
        text: "Ines folds herself into the gears like a lawn chair and slides the bent gear out between snores. The hour hand twitches like someone hitting snooze.",
        next_situation: "Down in the square, an old volunteer clock fixer is holding up a new gear he made years ago, just in case.",
        now_goal: "Haul the new gear up the tower",
        why: "Ines fit where no hand could, so the bent gear came out and the clock almost woke.",
        craft: "Top of GREAT: clean and vivid, with two everyday comparisons a kid knows. The bonus is a real role from the event (the volunteer fixer) with a dry detail.",
      },
      {
        situation: "Down in the square, an old volunteer clock fixer is holding up a new gear he made years ago, just in case.",
        right_now: "Haul the new gear up the tower",
        ladder_next: "Wake the clock so it can strike noon",
        hero: { name: "Theo", power: "Big Whistle: whistles loud enough to stop a bus" },
        plan: "whistle for wes's pigeons to carry it up",
        attempt: "Theo whistles for the pigeons to fly the gear up",
        idea_from: "Wes",
        roll: { total: 13, natural: null, grade: "PROGRESS", branch: "better" },
        text: "Theo whistles on Wes's idea, and six pigeons carry the gear up like a tiny moving company. It clicks in, and the clock yawns.",
        next_situation: "The clock is half awake, and the mayor keeps checking her watch, which still says a quarter past three.",
        now_goal: "Wake the clock enough to strike noon",
        why: "The pigeons already owed Wes favors, so Theo's whistle got the gear up fast, and it fit.",
        craft: "PROGRESS credits the friend. The last situation puts the final goal within reach and ends on a dry detail (the mayor's watch) that the ending can call back.",
      },
    ],
  },
  {
    id: "harbor-hum",
    keywords: ["hum", "humming", "houseboat", "harbor", "mystery noise", "fish"],
    title: "Something Hums Under the Docks",
    mood: "eerie",
    real_event: HARBOR_EVENT,
    problem: {
      name: "The Lonely Hum",
      what: "something deep under the docks hums a love song every night, and it gets louder because nobody hums back",
      stakes: "nobody in the harbor can sleep",
      pronoun: "it",
    },
    goal: "Answer the hum so the harbor can sleep",
    ladder: ["Track the hum to one dock", "Wake the scientist and borrow her microphone", "Find the hum's exact note", "Answer the hum so the harbor can sleep"],
    heroes: [
      { name: "Zoe", power: "Night Eyes: sees clearly in the dark" },
      { name: "Hank", power: "Heavy Lifter: can carry anything once", weakness: "falls asleep the moment anything rocks" },
      { name: "Dev", power: "Perfect Ear: can name any note he hears" },
      { name: "Ollie", power: "Nest Builder: makes a cozy bed out of anything" },
    ],
    turns: [
      {
        situation: "Teacups rattle on every houseboat, and the neighbors stand on the docks in pajamas, pointing in different directions.",
        right_now: "Track the hum to one dock",
        ladder_next: "Wake the scientist and borrow her microphone",
        hero: { name: "Zoe", power: "Night Eyes: sees clearly in the dark" },
        plan: "look under the docks with my night vision",
        attempt: "Zoe searches the dark water under the docks",
        idea_from: "",
        roll: { total: 9, natural: null, grade: "PARTIAL", branch: "mixed" },
        text: "Zoe spots the one dock where the water ripples with every hum. Everyone runs over in pajamas to look, and the dock sinks to their ankles.",
        next_situation: "On the last houseboat sleeps a scientist with an underwater microphone, the only person in the harbor wearing earplugs.",
        now_goal: "Wake the scientist and borrow her microphone",
        why: "Zoe could see the ripples in the dark, but pointing at them drew a crowd, and the dock sank.",
        craft: "Top of PARTIAL: the main thing works, and the twist is a picture (pajama neighbors ankle-deep). The new situation brings in the event's real scientist with one dry detail.",
      },
      {
        situation: "On the last houseboat sleeps a scientist with an underwater microphone, the only person in the harbor wearing earplugs.",
        right_now: "Wake the scientist and borrow her microphone",
        ladder_next: "Find the hum's exact note",
        hero: { name: "Hank", power: "Heavy Lifter: can carry anything once", weakness: "falls asleep the moment anything rocks" },
        plan: "climb on her boat and knock on the window",
        attempt: "Hank climbs aboard to knock on her window",
        idea_from: "Ollie",
        roll: { total: 2, natural: null, grade: "SETBACK", branch: "worse" },
        text: "Hank tiptoes aboard, and the rocking boat puts him right to sleep. He snores along with the hum, and the whole harbor shakes twice as hard.",
        next_situation: "The shaking wakes the scientist. Her underwater microphone says the hum now comes from under every boat in the harbor.",
        now_goal: "Catch the hum's exact note on her microphone",
        why: "Rocking makes Hank fall asleep, and his snore joined the hum, so it spread under every boat.",
        craft: "The weakness shows up only because this exact plan walks into it. The scientist still wakes (fail forward), but the problem spreads. Ollie's suggestion is never blamed.",
      },
      {
        situation: "The shaking wakes the scientist. Her underwater microphone says the hum now comes from under every boat in the harbor.",
        right_now: "Catch the hum's exact note on her microphone",
        ladder_next: "Answer the hum so the harbor can sleep",
        hero: { name: "Dev", power: "Perfect Ear: can name any note he hears" },
        plan: "put on her headphones and find the note",
        attempt: "Dev listens through the headphones for the note",
        idea_from: "Zoe",
        roll: { total: 10, natural: null, grade: "PROGRESS", branch: "better" },
        text: "Dev puts on the scientist's headphones, Zoe's idea, and finds the note at once. He tries to hum it and only makes a small squeak.",
        next_situation: "The scientist says nobody awake can hum that low. Then everyone remembers Hank's snore, which hit that note perfectly.",
        now_goal: "Rock Hank back to sleep by the water",
        why: "Dev's ear found the note, but it is too low for a voice. Only a snore went that low.",
        craft: "A 10 works with a wobble (too low to hum). The callback turns Hank's earlier fail into the answer, so a failure becomes the reason it works.",
      },
      {
        situation: "The scientist says nobody awake can hum that low. Then everyone remembers Hank's snore, which hit that note perfectly.",
        right_now: "Rock Hank back to sleep by the water",
        ladder_next: "Answer the hum so the harbor can sleep",
        hero: { name: "Ollie", power: "Nest Builder: makes a cozy bed out of anything" },
        plan: "build hank a bed out of life jackets on the dock",
        attempt: "Ollie builds Hank a bed of life jackets",
        idea_from: "Dev",
        roll: { total: 17, natural: null, grade: "GREAT", branch: "better" },
        text: "Ollie builds Hank a bed of life jackets, Dev's idea, and Hank is asleep before the last one lands. His first snore matches the hum exactly.",
        next_situation: "The scientist can play the snore underwater through her speaker, if someone gets her microphone to Hank without waking him.",
        now_goal: "Get Hank's snore down into the harbor",
        why: "A cozy bed on a rocking dock put Hank to sleep fast, and his snore is the right note.",
        craft: "Uses only things that belong in a harbor. The GREAT bonus is the scientist's speaker, and the final goal is now one clear step away.",
      },
    ],
  },
];

// ---------------------------------------------------------------- 2. bad examples

export const BAD_EXAMPLES: BadExample[] = [
  {
    kind: "jargon",
    bad: "Zoe's Nightsight pierces the Humline, and the Deepsong falters beneath Dock Seven.",
    why: "Invented names nobody was told about. The table stops following.",
    better: "Zoe spots the one dock where the water ripples with every hum.",
  },
  {
    kind: "prop hijack",
    bad: "Wes offers the pigeons a hot dog, and now every pigeon in town wants a hot dog. Right now: Find more hot dogs.",
    why: "A random object took over the story. The problem (the sleeping clock) vanished.",
    better: "Wes asks the pigeons for a favor, and they flap the dust out the window.",
  },
  {
    kind: "going backward",
    bad: "Ines slips, and the bent gear jumps back into place. The clock is stuck again. Right now: Pull the bent gear out.",
    why: "It undoes the last turn and repeats the same goal. Every turn must move to a new situation.",
    better: "Ines pulls the gear, but it drops down the stairs to the volunteer below, who is holding a new one anyway.",
  },
  {
    kind: "vague goal",
    bad: "Figure out what is going on with the harbor tonight",
    why: "Banned vague verb, too long, and nobody can tell when it's done.",
    better: "Catch the hum's exact note on her microphone",
  },
  {
    kind: "pasted player text",
    bad: "Tess uses dad voice on judge bc serious biz and the judge is serious now.",
    why: "It copies what the player typed, slang and all. Say it in your own complete sentence.",
    better: "Tess uses her sternest dad voice to call this a serious elf matter.",
  },
  {
    kind: "blaming",
    bad: "Thanks to Tess's bad shortcut idea, Omar marches everyone into the flour.",
    why: "A fail belongs only to the hero who acted. Never name the friend who suggested it, and never call an idea bad.",
    better: "Omar squeezes two hundred elves through the bakery, right into the flour shelf.",
  },
  {
    kind: "too long",
    bad: "Carmen bravely leads the whole group up the long, winding, dusty staircase in total darkness, never once taking a wrong step, until at last they reach the very top, where a huge flock of startled pigeons explodes into the air around them.",
    why: "Over 40 words, a pile of adjectives, and the joke is buried. One or two short sentences, 26 words max.",
    better: "Carmen leads everyone up the dark stairs without one wrong step, straight into the pigeons' bedroom.",
  },
  {
    kind: "spoiler",
    bad: "Dev listens closely and realizes the hum is just fish looking for a date.",
    why: "It gives away the real story before the reveal. The fantasy twist stays fantasy until the end.",
    better: "Dev finds the note at once. He tries to hum it and only makes a small squeak.",
  },
];

// ---------------------------------------------------------------- 3. "Right now" goals

export const GOAL_EXAMPLES: GoalExample[] = [
  { context: "Elf hats are floating up over the bakery.", weak: "Deal with the hats", good: "Pin the floating hats to the costume table", why: "A vague verb tells nobody what to do. Name the action and the thing." },
  { context: "The crowd of elves is jammed in a side street.", weak: "Find the jingle bells", good: "Squeeze the elf crowd into the square", why: "A stray prop is a side errand. The goal is the next real step of the event." },
  { context: "The hats just came back down onto every head.", weak: "Get the hats back down again", good: "Hush the crowd before the count starts", why: "Never redo what was just done. Move to the next act." },
  { context: "A dust cloud hides the clock at the top of the tower.", weak: "Investigate the tower", good: "Sweep enough dust to see the clock's face", why: "Banned vague verb. A physical verb plus a thing a kid can see being done." },
  { context: "One bent gear is holding the clock's hands still.", weak: "Figure out why the clock is acting so strange tonight", good: "Pull the bent gear out between snores", why: "Too long and vague. Eight words max, about the problem itself." },
  { context: "The scientist is awake and her microphone is in the water.", weak: "Restore peace to the harbor", good: "Catch the hum's exact note on her microphone", why: "Abstract and fancy. Nobody can tell when peace is restored." },
  { context: "The heroes have just arrived at the humming harbor.", weak: "Reach the Deepsong Reef", good: "Track the hum to one dock", why: "Invented place name. Use only what the story already said." },
  { context: "Nobody knows yet what is making the hum.", weak: "Prove the hum is only fish", good: "Lower the microphone where the water ripples", why: "Spoils the real story. Stay inside the fantasy until the reveal." },
  { context: "A herd of hired goats escaped into a neighborhood's backyards.", weak: "Try to stop the goats", good: "Herd the goats back through the fence gap", why: "\"Try to\" is banned and \"stop\" is vague. Say where the goats go." },
  { context: "A library book returned decades late keeps reshelving itself in the wrong place.", weak: "Make the librarian happy", good: "Catch the book before it reshelves itself", why: "Not about the problem, and a mood is not a finish line." },
  { context: "A parade balloon is tugging its handlers down the street.", weak: "Keep holding on", good: "Wrap the balloon's ropes around the lamppost", why: "\"Keep\" is banned: it is not a new step. Give a move that changes things." },
  { context: "The final turn: the clock is half awake, noon is within reach.", weak: "Explore the rest of the tower", good: "Wake the clock enough to strike noon", why: "On the last turn the goal points straight at the story goal, never a side trip." },
];

// ---------------------------------------------------------------- 4. openers

export const OPENER_EXAMPLES: OpenerExample[] = [
  {
    id: "elf-record",
    keywords: OUTCOME_EXAMPLES[0].keywords,
    real: "A small town gathers in its square, everyone in elf costumes, to try for a record for the most people dressed as elves.",
    punchline_words: ["set the record", "world record"],
    real_setting: ELF_EVENT,
    quest_title: "Hold On to Your Hats",
    teaser: "A whole town dresses as elves for a record, and every laugh sends a hat flying.",
    mood: "silly",
    scene_line: "A small town lines up in its square in elf costumes to try for a record.",
    problem_line: "The pointy hats float up like balloons whenever someone laughs, and elves laugh a lot.",
    stakes_line: "The judge only counts elves in hats, so flying hats mean no record.",
    goal: "Get every elf counted with a hat on",
    situation: "A folding table of costumes, a giggling volunteer, and a judge with a clicker watching a hat drift over the bakery.",
    npc_line: { speaker: "Record judge", line: "I count elves. A hat is half of an elf." },
    problem: { name: "The Floating Hats", stakes: "a hatless elf doesn't count, so the record fails", pronoun: "none" },
    beats: ["Get the floating hats back down", "Squeeze everyone into the square", "Hush the crowd for the count", "Get every elf counted with a hat on"],
  },
  {
    id: "town-clock",
    keywords: OUTCOME_EXAMPLES[1].keywords,
    real: "Volunteers in a small town restore the town hall clock, which had been stopped for decades, in time for a restart ceremony.",
    punchline_words: ["decades", "chimes again"],
    real_setting: CLOCK_EVENT,
    quest_title: "Always a Quarter Past Three",
    teaser: "A town's old clock is finally getting fixed, but it was never broken. It's asleep.",
    mood: "wondrous",
    scene_line: "Volunteers are fixing the old clock on the town hall tower, which stopped years ago.",
    problem_line: "The clock fell asleep, and while it sleeps, the whole square stays stuck at a quarter past three.",
    stakes_line: "The ceremony starts when the clock strikes noon, and noon never comes.",
    goal: "Wake the clock so it can strike noon",
    situation: "A narrow tower door, pitch dark stairs, a mayor holding giant scissors, and a slow snore from the top.",
    npc_line: { speaker: "The mayor", line: "We start at noon. I've been saying that for a while." },
    problem: { name: "The Sleeping Clock", stakes: "it is never noon, so the ceremony never starts", pronoun: "it" },
    beats: ["Climb the tower to the sleeping clock", "Sweep out the dust it sleeps in", "Find the part that keeps it asleep", "Wake the clock so it can strike noon"],
  },
  {
    id: "harbor-hum",
    keywords: OUTCOME_EXAMPLES[2].keywords,
    real: "Houseboat neighbors in a quiet harbor are kept awake for weeks by a low hum at night that nobody can trace, until a scientist listens under the water.",
    punchline_words: ["fish", "mating call", "singing fish"],
    real_setting: HARBOR_EVENT,
    quest_title: "Something Hums Under the Docks",
    teaser: "A houseboat harbor hasn't slept in weeks, because of a hum nobody can find.",
    mood: "eerie",
    scene_line: "In a harbor full of houseboats, the neighbors haven't slept in weeks.",
    problem_line: "Something deep under the docks hums a love song every night, and it gets louder because nobody hums back.",
    stakes_line: "Teacups rattle off the shelves, and soon the neighbors will start moving away.",
    goal: "Answer the hum so the harbor can sleep",
    situation: "Rattling teacups, neighbors on the dock in pajamas, and dark water that buzzes when you touch it.",
    npc_line: { speaker: "Harbor master", line: "It's not my boat. I checked my boat four times." },
    problem: { name: "The Lonely Hum", stakes: "nobody in the harbor can sleep", pronoun: "it" },
    beats: ["Track the hum to one dock", "Wake the scientist and borrow her microphone", "Find the hum's exact note", "Answer the hum so the harbor can sleep"],
  },
];

// ---------------------------------------------------------------- 5. callbacks

export const CALLBACK_EXAMPLES: CallbackExample[] = [
  {
    kind: "a fail becomes the fix (ending)",
    earlier: "Turn 2: Hank fell asleep on the scientist's boat and snored along with the hum.",
    now: "The finale. Ollie's plan won: lower the speaker and let Hank snore into the harbor.",
    line: "On Ollie's plan, the crew lowers the speaker, and Hank snores into the harbor. Deep under the docks, the hum answers once, softly, and stops. Everyone sleeps, and Hank already was.",
    why: "The funniest failure of the night turns out to be the answer, so the player who flopped is the hero of the ending.",
  },
  {
    kind: "an NPC's line comes back (ending)",
    earlier: "The opener: the record judge said \"A hat is half of an elf.\"",
    now: "The finale. The judge counts Omar last, still covered in flour.",
    line: "The judge clicks Omar last, still white with flour, his hat firmly on. She writes down two hundred whole elves, which is four hundred halves.",
    why: "Reusing the judge's own rule as the last laugh makes the world feel consistent, and the table remembers it.",
  },
  {
    kind: "a running detail pays off (ending line)",
    earlier: "Turn 4: the mayor kept checking her watch, which still said a quarter past three.",
    now: "The finale worked. The clock strikes noon.",
    line: "The clock strikes noon, and the mayor checks her watch, which finally agrees.",
    why: "A small dry detail planted earlier lands as the ending card. No explanation needed.",
  },
  {
    kind: "a friend's unpicked suggestion gets its moment (outcome)",
    earlier: "Turn 1: Theo suggested whistling for help, but Carmen picked her own plan.",
    now: "Turn 4: Theo's own turn, using Wes's pigeon idea.",
    line: "Theo finally gets to whistle, on Wes's idea, and six pigeons carry the gear up like a tiny moving company.",
    why: "\"Finally\" tells Theo the DM heard him three turns ago. Players feel heard even when their idea wasn't picked.",
  },
  {
    kind: "a player's real knack (outcome)",
    earlier: "The lobby: Lou said his secret talent is untangling Christmas lights (his power became Knot Hands).",
    now: "Turn 1: Lou ties the floating hats down.",
    line: "Lou knots every hat to the costume table faster than he untangles Christmas lights, and the hats stop drifting.",
    why: "It nods to something true about the real person, warmly, so the table learns a little about them.",
  },
  {
    kind: "the whole night in one line (recap)",
    earlier: "Carmen woke the pigeons (a setback), Wes put them to work, Ines pulled the bent gear, and Theo whistled the pigeons back.",
    now: "The recap card after the finale.",
    line: "Carmen woke the pigeons, Wes put them to work, and Ines pulled the bent gear. Theo whistled the pigeons back with a new one, and the clock struck noon.",
    why: "Every friend gets credit by name, in order, and Carmen's setback is told as the start of the solution, never as a mistake.",
  },
];

// ---------------------------------------------------------------- prompt builders
// Deterministic on purpose: the same text every call keeps the system prompt a stable prefix for prompt caching.

const q = (s: string) => `"${s}"`;

/** True when the live story overlaps an example (copying risk): skip that example. */
function overlaps(keywords: string[], avoid?: string) {
  if (!avoid) return false;
  const text = avoid.toLowerCase();
  return keywords.some((k) => new RegExp(`\\b${k.toLowerCase()}\\b`).test(text));
}

/**
 * The outcome few-shot block for OUTCOME_SYSTEM. `avoid` = the live story's title + real_event.place_type + problem
 * name; any example game that overlaps is left out. `games` caps how many games are included (default all 3).
 */
export function outcomeExamplesPrompt(opts: { avoid?: string; games?: number } = {}) {
  const games = OUTCOME_EXAMPLES.filter((g) => !overlaps(g.keywords, opts.avoid)).slice(0, opts.games ?? 3);
  const blocks = games.map((g) => {
    const head = `STORY ${q(g.title)}. real_event: place_type ${q(g.real_event.place_type)}, roles [${g.real_event.roles.map(q).join(", ")}], stakes ${q(g.real_event.stakes)}. The problem: ${g.problem.what}. story.goal ${q(g.goal)}.`;
    const turns = g.turns.map((t) => {
      const who = `${t.hero.name} (${t.hero.power}${t.hero.weakness ? `; weakness: ${t.hero.weakness}` : ""})`;
      const from = t.idea_from ? `, idea_from ${q(t.idea_from)}` : "";
      const nat = t.roll.natural ? `, natural ${t.roll.natural}` : "";
      return [
        `- situation ${q(t.situation)} right_now ${q(t.right_now)} ladder.next ${q(t.ladder_next)}`,
        `  ${who}: ${t.attempt}${from}. ${t.roll.grade} ${t.roll.total}${nat} (${t.roll.branch}).`,
        `  text ${q(t.text)}`,
        `  situation ${q(t.next_situation)}`,
        `  now_goal ${q(t.now_goal)}`,
        `  why ${q(t.why)}`,
      ].join("\n");
    });
    return `${head}\n${turns.join("\n")}`;
  });
  return `GOLD EXAMPLES (other stories: copy the voice, length and moves, never the words, names or objects):\n${blocks.join("\n\n")}`;
}

/** The "never write like this" block (bad line, why, better line). */
export function badExamplesPrompt() {
  return `NEVER WRITE LIKE THIS:\n${BAD_EXAMPLES.map((b) => `- ${b.kind.toUpperCase()}: ${q(b.bad)} ${b.why} Better: ${q(b.better)}`).join("\n")}`;
}

/** Weak vs good "Right now" goals. `n` caps how many pairs (default all 12). */
export function goalExamplesPrompt(n = GOAL_EXAMPLES.length) {
  return `RIGHT NOW GOALS (weak, then good):\n${GOAL_EXAMPLES.slice(0, n).map((g) => `- ${g.context} Weak ${q(g.weak)}. Good ${q(g.good)}. ${g.why}`).join("\n")}`;
}

/** Opener examples in the same field order as OPENER_SYSTEM's output. */
export function openerExamplesPrompt(opts: { avoid?: string } = {}) {
  const list = OPENER_EXAMPLES.filter((o) => !overlaps(o.keywords, opts.avoid));
  return `MORE EXAMPLES (NEWS):\n${list
    .map((o, i) =>
      [
        `${i + 1}. REAL: ${q(o.real)}`,
        `   punchline_words [${o.punchline_words.map(q).join(", ")}]`,
        `   real_setting ${JSON.stringify(o.real_setting)}`,
        `   quest_title ${q(o.quest_title)}  mood ${q(o.mood)}`,
        `   teaser ${q(o.teaser)}`,
        `   scene_line ${q(o.scene_line)}`,
        `   problem_line ${q(o.problem_line)}`,
        `   stakes_line ${q(o.stakes_line)}`,
        `   goal ${q(o.goal)}`,
        `   situation ${q(o.situation)}`,
        `   npc_line ${JSON.stringify(o.npc_line)}`,
        `   problem ${JSON.stringify(o.problem)}`,
        `   beats ${JSON.stringify(o.beats)}`,
      ].join("\n"),
    )
    .join("\n")}`;
}

/** Callback examples, for OUTCOME_SYSTEM (later turns) and EPILOGUE_SYSTEM (ending, line, recap). */
export function callbackExamplesPrompt() {
  return `CALLBACKS (bring back an earlier moment or a friend's words, at most one per outcome, never to mock anyone):\n${CALLBACK_EXAMPLES.map((c) => `- ${c.kind}. Earlier: ${c.earlier} Line: ${q(c.line)} ${c.why}`).join("\n")}`;
}
