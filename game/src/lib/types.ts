export type Stat = "brave" | "clever" | "charming";
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
  busy: string;
}
