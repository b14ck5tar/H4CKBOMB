export type Stat = "brave" | "clever" | "charming";

/** Who's playing: sets how gentle or heavy the stories and humor can be. See `lib/rating.ts`. */
export type Rating = "kids" | "teens" | "adults";

/** Two optional join questions (lib/real.ts). Either can be "" (skipped). Private until the reveal. */
export interface RealAnswers {
  skill: string; // "What's your secret strength?" -> their power, and the reveal's "Solved by" line
  fear: string; // "What's a small thing that scares you?" -> comedy in the fiction only, never a real dare
}
/** How likely the winning plan is to work. Every plan rolls; "clever" is just the best modifier (lib/rules.ts). */
export type Tier = "clever" | "solid" | "risky" | "wild" | "miracle";
export type Band = "CATASTROPHE" | "FAIL" | "YES_BUT" | "SUCCESS" | "LEGENDARY";
export type Ending = "TRIUMPHANT" | "BITTERSWEET" | "GRIM_BUT_HILARIOUS";
export type SceneKind = "hook" | "twist" | "climax";

export interface Hero {
  name: string;
  epithet: string;
  pronouns: "she/her" | "he/him" | "they/them";
  concept_status: "ok" | "reimagined" | "redirected";
  concept_note: string;
  stats: Record<Stat, number>;
  ability: { name: string; text: string };
  flaw: string;
  roast: string;
  visual: { anchor: string; outfit: string; palette: string[]; prop: string; expression: string };
}

export interface Player {
  id: string;
  name: string;
  color: string;
  status: "joined" | "building" | "ready";
  concept?: string;
  pick?: string; // id of the ready-made character they picked (absent = they made their own)
  real?: RealAnswers; // join questions. On the wire it is only ever {skill:"",fear:""} = "answered"; the text stays on the TV until the reveal.
  truth?: string; // "one true thing about the real you": undefined = not asked yet, "" = skipped. Never shown during play.
  hero?: Hero;
  hasPortrait: boolean;
  abilityAvailable: boolean;
  heart: 0 | 1;
  titles: string[];
  peril: string; // "" when safe
  away?: boolean; // autopilot: their phone went quiet, they timed out twice, or they tapped "Step away"
  catchUp?: string; // "While you were away": shown on their phone for a few seconds after they're back
}

export interface Verdict {
  interpretation: string;
  stat: Stat;
  tier: Tier;
  ability_fits: boolean;
  flaw_walk_in: boolean;
  quip: string;
  on_success: string;
  on_failure: string;
  moderation: "ok" | "redirected" | "flag";
  reason: string; // DM's Notes: plain, ≤16 words, what made it this tier (or why an argument changed it)
  fallback?: boolean; // set by the table when the AI never ruled (the plan text was not reviewed)
  appealUnreviewed?: boolean; // set when the AI never read the player's argument
}

export interface Pitch {
  id: string;
  playerId: string;
  text: string;
  useAbility: boolean;
  embraceFlaw: boolean;
  verdict?: Verdict;
  creditId?: string; // the friend whose suggestion the turn owner used (+1, credit shown)
  own?: string; // the owner's own words (phone sends both parts)
  idea?: string; // the friend's idea they picked
  auto?: boolean; // filled in for a player who ran out of time
  autopilot?: boolean; // filled in because the player was away (TV shows "on autopilot")
}

export interface RollResult {
  playerId: string;
  dice: number[]; // empty when the plan worked without a roll
  kept: number; // 0 when no roll
  advantage: "adv" | "dis" | "none";
  statBonus: number;
  tierMod: number;
  total: number;
  band: Band;
  rescuerId: string; // "" unless this roll came from a Catch!
  noRoll: boolean; // "That works": a clever plan, no dice needed
  boosted: boolean;
  bonus?: number; // +1 for working in a friend's suggestion
  bonusWhy?: string; // what the bonus was for ("idea", "backed")
  need?: number; // the TOTAL the roll needs ("Needs 13+"); 21 = only a natural 20 (a miracle)
  grade?: string; // graded outcome (lib/grade.ts): DISASTER, SETBACK, PARTIAL, PROGRESS, GREAT, LEGENDARY
  gradeLabel?: string; // the stamp ("IT WORKS")
  ending?: Ending; // the ending tier if this was the finale roll
}

export interface RoundOutcome {
  headline: string;
  beats: { hero_id: string; text: string }[];
  now: string;
  complication: string;
  titles: { hero_id: string; kind: "shame" | "glory" | "savior"; title: string }[];
  peril: { hero_id: string; text: string };
  new_canon: string[];
  threat_mood: string;
  highlight_score: number;
  sfx: string;
}

export interface SceneOpen {
  recap: string;
  narration: string;
  question: string;
  situation: string;
  banner: string;
  npc_line: { speaker: string; line: string };
  clues: { hero_id: string; clue: string; because?: string }[];
  suggestions: { hero_id: string; ideas: string[] }[];
  music: string;
}

export interface SceneView {
  kind: SceneKind;
  location: string;
  description: string;
  twist: string;
  hasImage: boolean;
}

/** A scene the team wrote by hand in plain English (seed_quests.json). The AI never rewrites it. */
export interface SeedScene {
  kind: SceneKind;
  title: string;
  location: string;
  narration: string;
  goal: string;
  situation: string;
  npc_line: { speaker: string; line: string };
}

export interface QuestSeed {
  id: string;
  quest_title: string;
  realm_name: string;
  fairytale_premise: string;
  the_threat: { name: string; description: string; mapped_from: string };
  the_goal: { description: string; mapped_from: string };
  locations: { name: string; description: string; mapped_from: string }[];
  complications: { stage: number; title: string; what_happens: string; why_obvious_in_hindsight: string; mapped_from: string }[];
  /** now: "where it stands now" in the real world, from the source's facts only (the ending shows it). */
  the_real_story: { summary: string; headline: string; source: string; link: string; date: string; context_note?: string; now?: string };
  /** A live-news or player-written story's opener (fixed start + fixed goal; the middle branches). */
  opener?: SeedScene;
  /** The problem's stakes, and a pronoun if the problem is a creature (live stories, from the writer). */
  problem?: { pronoun: string; stakes: string };
  /** The story ladder: 3-4 step goals, setup → twist → climax (live stories, from the writer). */
  beats?: string[];
  /** The real event behind a live story (opener.real_setting, spoiler-free): the outcome and ruling stay inside it. */
  real_event?: Record<string, unknown>;
  /** "Our stories": who wrote it (their real ending is the_real_story.summary, hidden until the reveal). */
  author?: { pid: string; name: string };
  art_style_hint: string;
  scenes?: SeedScene[]; // Full Story: hook, twist, climax
  quick_scene?: SeedScene & { first_step?: string; problem_name?: string }; // Quick Tale: the one scene (+ its first step, plain problem name)
  category?: string;
  tone?: string;
  /** The youngest group this story suits: "kids" = fine for everyone, "adults" = adults only. Missing = "teens". */
  rating?: Rating;
}

export interface LogEntry {
  scene: number;
  heroId: string;
  hero: string;
  pitch: string;
  band: Band;
  headline: string;
  narration: string;
  rescue: boolean;
  flagged?: boolean; // the DM steered or flagged this plan: never quote it outside the game (keepsake, Hall)
}

export interface FinalRoll {
  dice: Record<string, number>;
  rolled: string[];
  best: string;
  hopeBonus: number;
  total: number;
  ending: Ending;
  // All-together Final Roll: arm, shared "3, 2, 1, SHAKE!", then every die lands at once.
  stage?: "arm" | "count" | "shake" | "tumble" | "landed";
  armed?: string[]; // tapped "arm your die" (and granted motion on iOS)
  shook?: string[]; // their die is in the air (shaken, tapped, or auto-rolled)
  auto?: string[]; // didn't shake in time, so the table rolled for them
}

/** Someone got saved: a Catch! re-roll, or freed from peril by friends in a rescue round. */
export interface Save {
  id: string;
  savedId: string;
  byIds: string[]; // who saved them
  kind: "catch" | "rescue";
  scene: number;
  thanked: boolean; // the saved player tapped "Thank <name>" (once per save)
}

export interface Storybook {
  title: string;
  dedication: string;
  pages: { text: string; image_ref: string }[];
  hero_pages: { hero_id: string; best_moment: string; award: string }[];
  moral: string;
  real_story_bridge: string;
}

/** Mirror, Mirror: one card per hero, revealed after the Final Roll. */
export interface MirrorCard {
  wardId: string; // the hero this card is about
  guardianId: string; // who secretly watched them and wrote the sentence
  written: boolean; // the guardian sent their own sentence (false = the AI wrote one from the log)
  guess: string; // what the ward guessed their guardian wrote ("" = no guess)
  sentence: string; // "" until the reveal starts
}

/** DM's Notes: one line in the AI-transparency log. Small strings only (it rides along in every state message). */
export type NoteKind =
  | "source"
  | "hero"
  | "scene"
  | "clue"
  | "ruling"
  | "turn"
  | "roll"
  | "boost"
  | "catch"
  | "thanks"
  | "hope"
  | "safety"
  | "fallback"
  | "mirror"
  | "reveal";

export interface DMNote {
  t: number; // seconds since the notes started
  kind: NoteKind;
  who: string;
  text: string;
}

export interface DMNotes {
  safety: string; // why this story is safe to play (shown from the start)
  /** The real story. null until the reveal, so the twist is never spoiled (phones receive this state too). */
  source: {
    headline: string;
    source: string;
    date: string;
    link: string;
    summary: string;
    mappings: { story: string; real: string }[];
  } | null;
  canon: string[]; // facts the DM must not contradict
  open: string[]; // open complications the DM is carrying into the next scene
  log: DMNote[]; // oldest first, capped
  stats: {
    rounds: number;
    plans: number;
    appeals: number;
    appealsChanged: number;
    rolls: number;
    nat1: number;
    nat20: number;
    safety: number;
    fallbacks: number;
  };
}

export type Phase =
  | "lobby"
  | "story_write"
  | "story_vote"
  | "quest"
  | "narrating"
  | "turn"
  | "pitch"
  | "convince"
  | "vote"
  | "ruling"
  | "roll"
  | "catch"
  | "outcome"
  | "final_roll"
  | "final_result"
  | "mirror_write"
  | "mirror_guess"
  | "mirror_reveal"
  | "epilogue"
  | "reveal"
  | "storybook";

/** "quick" = the ~3 minute judge demo (one scene, then straight to the Final Roll). "full" = the whole story. */
export type GameMode = "full" | "quick";

export interface GameState {
  code: string;
  rating: Rating; // "Who's playing?", set in the lobby; default "teens"
  phase: Phase;
  mode: GameMode;
  partyName: string;
  players: Player[];
  questId: string;
  questOptions: { id: string; title: string; teaser: string }[];
  quest?: { title: string; realm: string; premise: string; threat: string; goal: string; goalShort: string };
  scenes: SceneView[];
  sceneIndex: number;
  hope: number;
  hopeMax: number;
  // Quest board
  question: string; // the scene's dramatic question ("Right now")
  lastTime: string; // recap / wrap of the last round
  // Scene (hand-written: seed_quests.json)
  sceneTitle: string;
  goal: string; // the story's final goal (small in the corner; reached in the finale)
  nowGoal: string; // "Right now:" the objective the players' own choices set (written after each outcome)
  ladder: string[]; // the story ladder: 2-4 planned steps, the last one is the goal (the finale). [] = no ladder
  step: number; // the step the table is on (0-based)
  fling: { power: number; angle: number } | null; // how the die was thrown (flight only; the number is decided in code)
  sceneArt: string; // the current painting's URL (phones show it as a live thumbnail); "" if it's a data URL
  progress: number; // 0-100 toward the finish line (procedural stories, design/35); 3 act dots on the TV
  act?: number; // 1-3, the story's act (the act clock or a solved step can move it ahead of progress)
  narration: string;
  situation: string;
  banner: string;
  npcLine: { speaker: string; line: string };
  suggestions: Record<string, string[]>;
  clues: Record<string, string>; // private per hero (phones only show their own)
  clueBecause: Record<string, string>; // why only that hero noticed it ("your Brains", "you're a night-shift baker")
  rescue: { victimId: string; peril: string } | null;
  // Round: everyone types a plan, everyone backs a friend's, the winner rolls
  pitches: Pitch[];
  votes: Record<string, string>; // voter id -> pitch id (or quest id during the story vote)
  winnerId: string; // the winning pitch id ("" until the vote ends)
  wins: Record<string, number>; // player id -> plans of theirs that won (the spotlight rule)
  outcome: string; // 1-2 sentences: what the winning plan did
  endingLine: string; // one line for the reveal: how it ended
  /** A time warning ~10 s before an input deadline (CD): who is still typing, if it's one person (their character's name). */
  nudge?: { at: number; kind: "turn" | "idea" | "pitch" | "vote" | "convince"; name: string };
  /** The grand ending's reveal (CD): each hero's key move, the real story in beats, and the line linking the two. */
  revealData?: { moves: { heroId: string; name: string; move: string }[]; real: { what: string; ending: string; source: string; date: string }; bridge: string };
  /** The story slide's sound cues (lib/storySfx.ts): the TV plays them in order when `at` changes. `id` = the first. */
  /** ~10 s left on a timer (story sets it): the TV plays a time warning (lib/sound/timeWarn.ts); `name` = a live "<Name>, ten seconds." */
  timeWarn?: { at: number; name?: string };
  sfx?: { id: string; cues: { id: string; word: number }[]; at: number; kind?: "line" | "buildup" | "payoff" };
  recap: string; // the reveal's "your version": 1-2 sentences on what this group actually did
  storyOptions: { id: string; title: string; teaser: string; art?: string }[]; // the story vote's 3 QUEST cards (never the real headline)
  source: "news" | "ours"; // lobby: Odd news (live headlines) or Our stories (players write true stories)
  written: string[]; // Our stories: who has sent theirs (the stories themselves stay on the TV)
  // Turns (design/24): one owner per turn, everyone else suggests, then a grand finale everyone votes on
  turnOrder: string[]; // player ids, in turn order (cycles by lobby size)
  turnIndex: number; // whose turn it is in turnOrder
  ideas: Record<string, string>; // suggester id -> their one-action idea for the owner this turn
  finale: boolean; // the grand finale: everyone proposes, everyone votes (not your own), one shared die
  /** The narrator the AI cast for this story (design/24 P5): a voice, a style line, and the kind of story. */
  cast: { voice: string; name: string; style: string; kind: string; art: string; artName: string; music: string } | null;
  /** The line being read aloud right now (TV only plays it; phones ignore it). ms = its length at play speed. */
  voice: { id: number; ms: number; delay: number; rate: number } | null;
  narrated: boolean; // a narrator clip has actually played this story (only then does the TV credit the narrator)
  typing: string[]; // who is typing a plan or an idea right now (the TV shows "Marvin is typing…")
  paused: boolean; // every phone went quiet (Wi-Fi drop): timers are frozen until one is back
  artKey: number; // the latest painting of what the heroes just did (a key into the TV's sceneImages), -1 = the plate
  boosts: Record<string, string>; // booster id -> pitch id
  rolls: RollResult[]; // in reveal order (lowest result first)
  revealed: string[]; // player ids whose die is shown
  catchers: string[];
  saves: Save[]; // every save tonight, and whether the saved player said thanks
  round: RoundOutcome | null;
  beatIndex: number; // which beat card is showing; === beats.length shows the wrap
  // Reading screens
  ready: string[];
  deadline: number; // ms remaining when this state was sent, 0 = no timer
  // Ending
  final: FinalRoll | null;
  finalMoves: Record<string, string>;
  epilogue: string;
  storybook: Storybook | null;
  // Mirror, Mirror (empty with one player)
  wards: Record<string, string>; // guardian id -> ward id (phones only show their own)
  mirrorMoments: Record<string, string[]>; // guardian id -> a few of their ward's own lines, as reminders
  mirror: MirrorCard[]; // in reveal order
  mirrorIndex: number; // which mirror card is showing
  thanks: Record<string, number>; // ward id -> times they tapped "Thank them"
  log: LogEntry[];
  solvedBy: string; // reveal line: "Solved by Ava's parallel parking and Ben's coffee." ("" until the reveal, or if nobody shared a skill)
  notes: DMNotes;
  busy: string;
  /** Players the host removed from the lobby (FEATURES.kick): their phone shows Rejoin. */
  kicked?: string[];
  /** Which game this is in the room (0 = the first). Play again (FEATURES.playAgain) adds 1. */
  game?: number;
}

/**
 * The procedural story's state (design/35), held by the host and shown to the AI on every call. The AI proposes
 * changes (progress_delta, new_fact, where, open_thread); code validates and applies them so the story can't wander.
 */
export interface StoryState {
  where: string;
  problem: string;
  stakes: string;
  finish_line: string; // "what solved looks like", on screen all game
  progress: number; // 0-100
  cast: { name: string; role: string }[]; // at most 3 named side characters
  facts: string[]; // at most 8 short facts that are true in this story
  open_thread: string; // at most one
  last_moments: string[]; // the last 3 outcome lines
  memorable: string[]; // 2 player lines worth calling back
  pronouns: Record<string, string>; // hero name -> pronouns
  creature_pronoun?: string; // if the problem is a creature
  hook: string; // the opener's fantasy twist: it must come back in act 2 and in the finale
  achieved: string[]; // what the table has already done (never undone)
  last_prop?: string;
}
