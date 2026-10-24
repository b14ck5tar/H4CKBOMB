export type Stat = "brave" | "clever" | "charming";

/** Who's playing: sets how gentle or heavy the stories, news and humor can be. See `lib/rating.ts`. */
export type Rating = "kids" | "teens" | "adults";

/** "Real in, magic out": what a player says about their real self. Any field can be "" (skipped). */
export interface RealAnswers {
  skill: string; // "What's something you're weirdly good at?" → their power
  fear: string; // "What's a small thing that scares you?" → comedy in the fiction only, never a real dare
  talk: string; // "What could you talk about for hours?" → the only basis for the side quest
}

/** The AI's pick of tonight's story for this crew, plus one spotlight per hero. */
export interface QuestPick {
  quest_id: string;
  why: string; // one line, shown to the host
  spotlights: { hero_id: string; scene: 0 | 1 | 2; how: string }[]; // how that hero's real skill can matter there
}

/** One group side quest for real life, built only from what players said they could talk about for hours. */
export interface SideQuest {
  title: string;
  text: string;
  based_on: { hero_id: string; said: string }[]; // verbatim answers it uses
}
export type Tier = "clever" | "solid" | "risky" | "absurd" | "miracle";
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
  real?: RealAnswers;
  hero?: Hero;
  hasPortrait: boolean;
  abilityAvailable: boolean;
  heart: 0 | 1;
  titles: string[];
  peril: string; // "" when safe
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
}

export interface Pitch {
  id: string;
  playerId: string;
  text: string;
  useAbility: boolean;
  embraceFlaw: boolean;
  verdict?: Verdict;
  appeal?: string; // "Convince the DM": the player's argument, if they made one
  appealed?: boolean; // true once the DM has ruled on the appeal
  auto?: boolean; // filled in for a player who ran out of time
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
  clues: { hero_id: string; clue: string }[];
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

export interface QuestSeed {
  id: string;
  quest_title: string;
  realm_name: string;
  fairytale_premise: string;
  the_threat: { name: string; description: string; mapped_from: string };
  the_goal: { description: string; mapped_from: string };
  locations: { name: string; description: string; mapped_from: string }[];
  complications: { stage: number; title: string; what_happens: string; why_obvious_in_hindsight: string; mapped_from: string }[];
  the_real_story: { summary: string; headline: string; source: string; link: string; date: string; context_note?: string };
  art_style_hint: string;
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
}

export interface FinalRoll {
  dice: Record<string, number>;
  rolled: string[];
  best: string;
  hopeBonus: number;
  total: number;
  ending: Ending;
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

/** In-game chat, so remote players can talk. Relayed and capped by the host. */
export interface ChatMsg {
  id: number;
  pid: string;
  text: string;
}

/** The "official story" for the reveal, sent to phones when nobody has a TV. */
export interface RevealInfo {
  headline: string;
  source: string;
  date: string;
  summary: string;
  link: string;
  threat: string;
  threatFrom: string;
  goalFrom: string;
}

export type Phase =
  | "lobby"
  | "quest"
  | "narrating"
  | "pitch"
  | "appeal"
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

export interface GameState {
  code: string;
  /** "tv": a big screen runs the table. "phones": a player's device hosts and every phone shows the story. */
  screen: "tv" | "phones";
  rating: Rating; // set by the host in the lobby; default "teens"
  phase: Phase;
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
  // Scene
  narration: string;
  situation: string;
  banner: string;
  npcLine: { speaker: string; line: string };
  suggestions: Record<string, string[]>;
  clues: Record<string, string>; // private per hero (phones only show their own)
  rescue: { victimId: string; peril: string } | null;
  // Round
  pitches: Pitch[];
  boosts: Record<string, string>; // booster id -> pitch id
  rolls: RollResult[]; // in reveal order (lowest result first)
  revealed: string[]; // player ids whose die is shown
  catchers: string[];
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
  chat: ChatMsg[]; // last few messages, oldest first
  reveal: RevealInfo | null; // set when the reveal starts
  questPick: QuestPick | null; // the AI's "best fit for this crew" pick, if the host asked for one
  solvedBy: string; // reveal line: "Solved by Ava's parallel parking and Ben's coffee" ("" if nobody shared a skill)
  sideQuest: SideQuest | null; // shown at the end
  busy: string;
}
