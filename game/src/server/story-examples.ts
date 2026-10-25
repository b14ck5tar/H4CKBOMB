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
 * The three example events are real KINDS of odd news (a town elf-costume record try, an old house moved across
 * town on a truck, a beach sand sculpture contest). They are written as types of events, never as claims about a
 * specific real article.
 *
 * THEME RULE: the model also copies an example's THEME (an earlier version had a snoring clock and a humming
 * harbor, and live stories turned into nap and hum stories). So each example twist is a different kind of problem
 * (a rule that escalates, a stubborn homesick object, the weather), and none is about sleep or sound.
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
  kind:
    | "jargon"
    | "prop hijack"
    | "going backward"
    | "vague goal"
    | "pasted player text"
    | "blaming"
    | "too long"
    | "spoiler"
    | "weak credit"
    | "kenning"
    | "game words"
    | "moral noun";
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

const HOUSE_EVENT: ExampleRealEvent = {
  place_type: "a small town's streets on moving day for an old house",
  roles: ["a house-moving crew with a flatbed truck and a crew boss", "power line workers lifting wires out of the way", "neighbors watching from their lawns"],
  situation: "an old house is being driven across town on a truck to a new lot",
  stakes: "the road is only closed for one day, so the house must arrive by sundown",
  arc: ["The crew lifts the house onto the truck", "The truck creeps through town under the power lines", "The house squeezes around the last tight corner", "The house is set down on its new lot"],
};

const SAND_EVENT: ExampleRealEvent = {
  place_type: "a beach on the day of a sand sculpture contest",
  roles: ["sand sculptors with buckets and shovels", "judges with clipboards", "a lifeguard in a tall chair"],
  situation: "teams are building giant sand sculptures to be judged at noon",
  stakes: "a sculpture that falls apart before judging can't win",
  arc: ["Teams build their sculptures all morning", "The weather threatens the sand", "Teams rush to save their sculptures", "The judges walk the beach and pick a winner"],
};

const HOUSE_HEROES = {
  wes: { name: "Wes", power: "Strong Back: can hold up anything heavy for a minute" },
  carmen: { name: "Carmen", power: "Never Lost: always knows the fastest way anywhere" },
  theo: { name: "Theo", power: "Real Estate Voice: makes any place sound wonderful" },
  ines: { name: "Ines", power: "Fold Up: fits herself into any small space" },
};

const SAND_HEROES = {
  ollie: { name: "Ollie", power: "Fort Builder: builds a shelter out of anything" },
  hank: { name: "Hank", power: "Heavy Lifter: can carry anything once", weakness: "always overdoes it" },
  dev: { name: "Dev", power: "Speed Digger: digs faster than a machine" },
  zoe: { name: "Zoe", power: "Eagle Eye: spots anything from far away" },
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
    id: "house-move",
    keywords: ["house move", "moving a house", "moved a house", "house moving", "flatbed", "relocated", "relocation"],
    title: "The Homesick House",
    mood: "cozy",
    real_event: HOUSE_EVENT,
    problem: {
      name: "The Homesick House",
      what: "the old house is homesick, so every time the truck stops, it slides back toward its old street",
      stakes: "if it isn't on the new lot by sundown, the move is off",
      pronoun: "it",
    },
    goal: "Get the house onto its new lot by sundown",
    ladder: ["Get the house to stay on the truck", "Steer the house under the power lines", "Squeeze the house around the last corner", "Set the house down on its new lot"],
    heroes: [HOUSE_HEROES.wes, HOUSE_HEROES.carmen, HOUSE_HEROES.theo, HOUSE_HEROES.ines],
    turns: [
      {
        situation: "Every time the truck stops, the house on the back slides an inch toward its old street.",
        right_now: "Get the house to stay on the truck",
        ladder_next: "Steer the house under the power lines",
        hero: HOUSE_HEROES.wes,
        plan: "hold the house still while the truck drives",
        attempt: "Wes braces the house so it can't slide",
        idea_from: "",
        roll: { total: 3, natural: null, grade: "SETBACK", branch: "worse" },
        text: "Wes holds the house steady, so it can't slide back. It leans its whole weight left instead, and the truck turns toward its old street.",
        next_situation: "The truck is creeping the wrong way under the power lines, and the line workers are waving their arms.",
        now_goal: "Turn the truck around under the power lines",
        why: "Wes stopped the sliding, so the house found another way home, by leaning the truck off course.",
        craft: "The power works and the plan still backfires, logically: the problem finds a new way to get what it wants. The story still reaches the power lines (fail forward), facing the wrong way.",
      },
      {
        situation: "The truck is creeping the wrong way under the power lines, and the line workers are waving their arms.",
        right_now: "Turn the truck around under the power lines",
        ladder_next: "Squeeze the house around the last corner",
        hero: HOUSE_HEROES.carmen,
        plan: "take the next left and loop around the block",
        attempt: "Carmen guides the driver around the block",
        idea_from: "Theo",
        roll: { total: 7, natural: null, grade: "PARTIAL", branch: "mixed" },
        text: "Carmen loops the truck around the block until it faces the right way. The loop passes the old street, and every window fogs up.",
        next_situation: "The house is past the wires with its curtains shut, and a mailbox blocks the tight last corner.",
        now_goal: "Squeeze the house around the last tight corner",
        why: "Carmen knew the fastest loop, so the truck turned around, but the loop went past the house's old street.",
        craft: "PARTIAL: half works, and the twist comes from the problem itself (a homesick house sees home). Fogged windows and shut curtains show the feeling without saying it. No friend credit on a mixed result.",
      },
      {
        situation: "The house is past the wires with its curtains shut, and a mailbox blocks the tight last corner.",
        right_now: "Squeeze the house around the last tight corner",
        ladder_next: "Set the house down on its new lot",
        hero: HOUSE_HEROES.theo,
        plan: "tell the house how nice its new yard is",
        attempt: "Theo tells the house all about its new lot",
        idea_from: "",
        roll: { total: 19, natural: null, grade: "GREAT", branch: "better" },
        text: "Theo describes the new lot like a dream home with morning sun. The curtains open, and the house sucks in its porch to fit the corner.",
        next_situation: "The new lot is one block away, and its new neighbors have mowed the lawn and are holding the gate open.",
        now_goal: "Back the truck through the open gate",
        why: "The house only wanted a good home, so hearing about one made it help itself around the corner.",
        craft: "Top of GREAT: the plan answers what the problem wants (a homesick house needs a home worth going to). The bonus is a real group from the event (the new neighbors) with one specific kindness.",
      },
      {
        situation: "The new lot is one block away, and its new neighbors have mowed the lawn and are holding the gate open.",
        right_now: "Back the truck through the open gate",
        ladder_next: "Set the house down on its new lot",
        hero: HOUSE_HEROES.ines,
        plan: "squeeze in by the gatepost and guide the driver back",
        attempt: "Ines guides the driver from the gap by the gatepost",
        idea_from: "Wes",
        roll: { total: 13, natural: null, grade: "PROGRESS", branch: "better" },
        text: "Ines folds into the gap by the gatepost, Wes's idea, and guides the driver inch by inch. The truck backs through without a scratch.",
        next_situation: "The house is a foot from its new spot, and the crew boss watches the sun sink like it owes him money.",
        now_goal: "Set the house down before the sun sets",
        why: "Ines fit where nobody else could see, so the driver backed in exactly right.",
        craft: "PROGRESS credits the friend in two words. The last situation puts the final goal within reach and ends on a dry detail (the crew boss and the sun) that the ending can call back.",
      },
    ],
  },
  {
    id: "sand-contest",
    keywords: ["sandcastle", "sand castle", "sand sculpture", "sculpture contest", "beach contest"],
    title: "Rain Only on the Castles",
    mood: "silly",
    real_event: SAND_EVENT,
    problem: {
      name: "The Lost Little Cloud",
      what: "a small lost rain cloud thinks the tall sandcastles are mountains, so it parks on top of them and rains",
      stakes: "the castles melt before the judges get there",
      pronoun: "it",
    },
    goal: "Send the cloud out to sea before judging",
    ladder: ["Shield the sculptures from the rain", "Build the cloud a mountain of its own", "Save the castles before the judges arrive", "Send the cloud out to sea before judging"],
    heroes: [SAND_HEROES.ollie, SAND_HEROES.hank, SAND_HEROES.dev, SAND_HEROES.zoe],
    turns: [
      {
        situation: "A small gray cloud hangs over the contest, raining only on the sandcastles, and the judges walk down at noon.",
        right_now: "Shield the sculptures from the rain",
        ladder_next: "Build the cloud a mountain of its own",
        hero: SAND_HEROES.ollie,
        plan: "make a roof out of beach umbrellas",
        attempt: "Ollie builds a roof of umbrellas over the castles",
        idea_from: "",
        roll: { total: 9, natural: null, grade: "PARTIAL", branch: "mixed" },
        text: "Ollie builds a roof of beach umbrellas over the castles, and the rain stops hitting them. The cloud drops lower to look underneath.",
        next_situation: "The cloud now sits on the umbrellas like a lid, and the lifeguard says clouds always sit on the tallest thing around.",
        now_goal: "Pile a sand mountain taller than the castles",
        why: "The umbrellas blocked the rain, but the cloud wants the tallest thing around, so it came down to them.",
        craft: "Top of PARTIAL: the main thing works, and the twist is a picture (a cloud sitting on umbrellas like a lid). A real role (the lifeguard) says the plain fact that explains the problem.",
      },
      {
        situation: "The cloud now sits on the umbrellas like a lid, and the lifeguard says clouds always sit on the tallest thing around.",
        right_now: "Pile a sand mountain taller than the castles",
        ladder_next: "Save the castles before the judges arrive",
        hero: SAND_HEROES.hank,
        plan: "pile up a giant sand mountain at the far end",
        attempt: "Hank piles sand into one giant mountain",
        idea_from: "Dev",
        roll: { total: 2, natural: null, grade: "SETBACK", branch: "worse" },
        text: "Hank overdoes it and piles a mountain taller than the lifeguard tower. The cloud moves over and pours twice as hard, right beside the castles.",
        next_situation: "A river of rain runs off the new mountain toward the castles, and the judges are starting down the beach.",
        now_goal: "Dig a trench to steer the rain away",
        why: "The cloud did move to the tallest thing, but a giant mountain meant giant rain, and water runs downhill.",
        craft: "The weakness shows up only because this exact plan walks into it. The cloud does move (fail forward), but the problem escalates by plain kid logic. Dev's suggestion is never blamed.",
      },
      {
        situation: "A river of rain runs off the new mountain toward the castles, and the judges are starting down the beach.",
        right_now: "Dig a trench to steer the rain away",
        ladder_next: "Send the cloud out to sea before judging",
        hero: SAND_HEROES.dev,
        plan: "dig a ditch around the castles down to the ocean",
        attempt: "Dev digs a trench from the castles to the sea",
        idea_from: "Zoe",
        roll: { total: 10, natural: null, grade: "PROGRESS", branch: "better" },
        text: "Dev digs a trench faster than a machine, Zoe's idea, and the rain runs around the castles to the sea. One tower leans, but it stands.",
        next_situation: "The castles are dry, the judges are halfway down the beach, and the cloud is still parked on the sand mountain.",
        now_goal: "Coax the cloud off the sand mountain",
        why: "The trench gave the water a path downhill to the sea, so it went around the castles.",
        craft: "A 10 works with a wobble (one leaning tower). The credit is two words inside the sentence. The judges walking closer keep the stakes visible.",
      },
      {
        situation: "The castles are dry, the judges are halfway down the beach, and the cloud is still parked on the sand mountain.",
        right_now: "Coax the cloud off the sand mountain",
        ladder_next: "Send the cloud out to sea before judging",
        hero: SAND_HEROES.zoe,
        plan: "find something taller than the mountain for it",
        attempt: "Zoe looks far out for something taller",
        idea_from: "Ollie",
        roll: { total: 17, natural: null, grade: "GREAT", branch: "better" },
        text: "Zoe takes Ollie's idea and spots a fishing boat with a tall mast past the waves. The cloud sees it and starts drifting out to sea.",
        next_situation: "The cloud is drifting slowly toward the mast, and the lifeguard is holding out her rescue board for anyone fast enough.",
        now_goal: "Paddle the cloud out to the fishing boat",
        why: "Clouds sit on the tallest thing around, and the mast is taller than anything on the beach.",
        craft: "The fix follows the problem's own rule, set up two turns ago. The GREAT bonus is a real role's real tool (the lifeguard's rescue board), and the final goal is one clear step away.",
      },
    ],
  },
];

// ---------------------------------------------------------------- 2. bad examples

export const BAD_EXAMPLES: BadExample[] = [
  {
    kind: "jargon",
    bad: "Zoe's Farsight pierces the Rainward, and the Mistling retreats from Castle Row.",
    why: "Invented names nobody was told about. The table stops following.",
    better: "Zoe spots a fishing boat with a tall mast past the waves.",
  },
  {
    kind: "prop hijack",
    bad: "Ollie offers the cloud an ice cream cone, and now the cloud wants more ice cream. Right now: Find more ice cream.",
    why: "A random object took over the story. The problem (the cloud raining on the castles) vanished.",
    better: "Ollie builds a roof of beach umbrellas over the castles, and the rain stops hitting them.",
  },
  {
    kind: "going backward",
    bad: "The house slides all the way back to its old lot, and the crew starts over. Right now: Get the house on the truck.",
    why: "It undoes what the table already achieved and repeats an old goal. Nothing achieved is undone: the next moment follows from what this plan did.",
    better: "The house slides back a block before Wes catches it, so the truck has to take the long way under the power lines.",
  },
  {
    kind: "vague goal",
    bad: "Figure out what is going on with the weather today",
    why: "Banned vague verb, too long, and nobody can tell when it's done.",
    better: "Dig a trench to steer the rain away",
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
    bad: "Carmen expertly guides the enormous, creaking, stubborn old house through the narrow, winding streets of the quiet little town, never once taking a wrong turn, until at last the whole truck is pointing in exactly the right direction again.",
    why: "Over 40 words, a pile of adjectives, and the joke is buried. One or two short sentences, 26 words max.",
    better: "Carmen loops the truck around the block until it faces the right way.",
  },
  {
    kind: "spoiler",
    bad: "Theo tells the house it is going to be a museum, just like in the real news story.",
    why: "It gives away the real story before the reveal. The fantasy twist stays fantasy until the end.",
    better: "Theo describes the new lot like a dream home with morning sun.",
  },
  {
    kind: "weak credit",
    bad: "With Lou's help, Nadia stares at the crowd while Omar films it.",
    why: "\"With X's help\", pointing or filming turns a friend into a spectator. Say whose idea it was and let the idea do something.",
    better: "Nadia gives the crowd her flattest stare, Lou's idea. Or Nadia tries the stare Lou suggested, and the laughing stops. Or Nadia borrows Lou's plan and stares the crowd quiet.",
  },
  {
    kind: "kenning",
    bad: "The pale fliers circle as the sky-weeper settles on the sand towers.",
    why: "Riddle names make listeners decode. Call things what they are, even if it sounds plain.",
    better: "The seagulls circle as the rain cloud settles on the sandcastles.",
  },
  {
    kind: "game words",
    bad: "Tess's perfect roll makes the judge listen, and her Charm bonus kicks in.",
    why: "Dice, rolls, stats, bonuses and grades never appear in the story. Show what happened instead.",
    better: "Tess uses her sternest dad voice, and the judge salutes.",
  },
  {
    kind: "moral noun",
    bad: "Moral: never trust a lighthouse. (No lighthouse was ever in this story.)",
    why: "A moral or ending may only use people and things that were in the story. A new noun at the end feels made up.",
    better: "Even a cloud just wants the tallest thing around.",
  },
];

// ---------------------------------------------------------------- 3. "Right now" goals

export const GOAL_EXAMPLES: GoalExample[] = [
  { context: "Elf hats are floating up over the bakery.", weak: "Deal with the hats", good: "Pin the floating hats to the costume table", why: "A vague verb tells nobody what to do. Name the action and the thing." },
  { context: "The crowd of elves is jammed in a side street.", weak: "Find the jingle bells", good: "Squeeze the elf crowd into the square", why: "A stray prop is a side errand. The goal is the next real step of the event." },
  { context: "The hats just came back down onto every head.", weak: "Get the hats back down again", good: "Hush the crowd before the count starts", why: "Never redo what was just done. Move to the next act." },
  { context: "The truck is creeping the wrong way under the power lines.", weak: "Investigate the truck", good: "Turn the truck around under the power lines", why: "Banned vague verb. A physical verb plus a thing a kid can see being done." },
  { context: "The last corner is tight, and a mailbox is in the way.", weak: "Figure out how to get this house all the way across town today", good: "Squeeze the house around the last tight corner", why: "Too long and vague. Eight words max, about the problem itself." },
  { context: "A homesick house keeps sliding back toward its old street.", weak: "Help the house feel at peace", good: "Brace the house so it can't slide back", why: "A feeling is not a finish line. Nobody can tell when peace arrives." },
  { context: "The heroes have just arrived at the sand contest.", weak: "Reach the Cloudspire Dunes", good: "Shield the sculptures from the rain", why: "Invented place name. Use only what the story already said." },
  { context: "The elf count hasn't happened yet.", weak: "Prove the town really set the record", good: "Line up the elves for the judge's count", why: "Spoils the real ending. Stay inside the story until the reveal." },
  { context: "A herd of hired goats escaped into a neighborhood's backyards.", weak: "Try to stop the goats", good: "Herd the goats back through the fence gap", why: "\"Try to\" is banned and \"stop\" is vague. Say where the goats go." },
  { context: "A library book returned decades late keeps reshelving itself in the wrong place.", weak: "Make the librarian happy", good: "Catch the book before it reshelves itself", why: "Not about the problem, and a mood is not a finish line." },
  { context: "A parade balloon is tugging its handlers down the street.", weak: "Keep holding on", good: "Wrap the balloon's ropes around the lamppost", why: "\"Keep\" is banned: it is not a new step. Give a move that changes things." },
  { context: "The final turn: the cloud is drifting toward the boat's mast.", weak: "Explore the rest of the beach", good: "Paddle the cloud out to the fishing boat", why: "On the last turn the goal points straight at the story goal, never a side trip." },
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
    id: "house-move",
    keywords: OUTCOME_EXAMPLES[1].keywords,
    real: "A crew moves an old house across a small town on a flatbed truck to a new lot, with the road closed for the day.",
    punchline_words: ["historic", "years old"],
    real_setting: HOUSE_EVENT,
    quest_title: "The Homesick House",
    teaser: "An old house is moving across town today, and it would really rather not.",
    mood: "cozy",
    scene_line: "A moving crew is driving an old house across town on a flatbed truck.",
    problem_line: "The house is homesick, so every time the truck stops, it slides back toward its old street.",
    stakes_line: "The road is only closed until sundown, so the house has to arrive today.",
    goal: "Get the house onto its new lot by sundown",
    situation: "A flatbed truck, a crew boss with a walkie-talkie, low power lines, and a house creeping backward an inch at a time.",
    npc_line: { speaker: "Crew boss", line: "Houses don't back up. I've moved forty houses." },
    problem: { name: "The Homesick House", stakes: "if it isn't on the new lot by sundown, the move is off", pronoun: "it" },
    beats: ["Get the house to stay on the truck", "Steer the house under the power lines", "Squeeze the house around the last corner", "Set the house down on its new lot"],
  },
  {
    id: "sand-contest",
    keywords: OUTCOME_EXAMPLES[2].keywords,
    real: "Teams on a beach build giant sand sculptures for a contest, racing the weather to finish before the judges walk the beach.",
    punchline_words: ["first place", "winning sculpture"],
    real_setting: SAND_EVENT,
    quest_title: "Rain Only on the Castles",
    teaser: "A sand sculpture contest has perfect weather, except for one small cloud that only rains on the castles.",
    mood: "silly",
    scene_line: "Teams on a beach are building giant sand sculptures for judging at noon.",
    problem_line: "A small lost rain cloud thinks the tall castles are mountains, so it parks on top of them and rains.",
    stakes_line: "If the castles melt before the judges get there, nobody can win.",
    goal: "Send the cloud out to sea before judging",
    situation: "Dripping sandcastles, a lifeguard in a tall chair, and one gray cloud the size of a minivan.",
    npc_line: { speaker: "Lifeguard", line: "Clouds aren't my department. I checked." },
    problem: { name: "The Lost Little Cloud", stakes: "the castles melt before the judges get there", pronoun: "it" },
    beats: ["Shield the sculptures from the rain", "Build the cloud a mountain of its own", "Save the castles before the judges arrive", "Send the cloud out to sea before judging"],
  },
];

// ---------------------------------------------------------------- 5. callbacks

export const CALLBACK_EXAMPLES: CallbackExample[] = [
  {
    kind: "a fail becomes a win (ending)",
    earlier: "Turn 2: Hank overdid it and piled a sand mountain taller than the lifeguard tower, and the cloud poured on it.",
    now: "The finale. Zoe's plan won: paddle the cloud out to the fishing boat's mast.",
    line: "On Zoe's plan, the crew paddles the cloud out to the fishing boat, and it settles on top of the mast. The judges reach dry castles, and Hank's mountain gets a ribbon nobody planned.",
    why: "The biggest mess of the night ends with a prize, so the player who flopped gets the last laugh, warmly.",
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
    earlier: "Turn 4: the crew boss watched the sun sink like it owed him money.",
    now: "The finale worked. The house is set down at sunset.",
    line: "The house settles onto its new lot just as the sun goes down, and the crew boss forgives the sun.",
    why: "A small dry detail planted earlier lands as the ending card. No explanation needed.",
  },
  {
    kind: "a friend's unpicked suggestion gets its moment (outcome)",
    earlier: "Turn 1: Theo suggested telling the house about its new home, but Wes picked his own plan.",
    now: "Turn 3: Theo's own turn.",
    line: "Theo finally gets to sell the new lot like a dream home, and the house sucks in its porch to fit the corner.",
    why: "\"Finally\" tells Theo the DM heard him two turns ago. Players feel heard even when their idea wasn't picked.",
  },
  {
    kind: "a player's real knack (outcome)",
    earlier: "The lobby: Lou said his secret strength is untangling Christmas lights (his power became Knot Hands).",
    now: "Turn 1: Lou ties the floating hats down.",
    line: "Lou knots every hat to the costume table faster than he untangles Christmas lights, and the hats stop drifting.",
    why: "It nods to something true about the real person, warmly, so the table learns a little about them.",
  },
  {
    kind: "the whole night in one line (recap)",
    earlier: "Wes stopped the sliding (a setback), Carmen turned the truck around, Theo talked the house around the corner, and Ines guided it through the gate.",
    now: "The recap card after the finale.",
    line: "Wes stopped the sliding, Carmen turned the truck around, and Theo talked the house around the corner. Ines guided it through the gate, and the house made it before sundown.",
    why: "Every friend gets credit by name, in order, and Wes's setback is told as the start of the solution, never as a mistake.",
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
        `- situation ${q(t.situation)} right_now ${q(t.right_now)}`,
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
