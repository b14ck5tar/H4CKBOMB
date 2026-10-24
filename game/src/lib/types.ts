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
  partnerId?: string; // set on a ⚔ Team Up combo
  abilityBy?: string; // on a combo: whose ability gets spent
}

export interface RollResult {
  playerId: string;
  dice: number[];
  kept: number;
  advantage: "adv" | "dis" | "none";
  baseAdvantage?: "adv" | "dis" | "none"; // before the Team Up bonus, so a Catch! reroll starts from the same footing
  statBonus: number;
  tierMod: number;
  total: number;
  band: Band;
  rescuerId: string; // "" unless this roll came from a Catch!
}

export interface Outcome {
  headline: string;
  narration: string;
  yes_but_cost: "none" | "hope" | "complication";
  complication: string;
  shame_title: string;
  glory_title: string;
  savior_title: string;
  peril: string;
  new_canon: string[];
  threat_mood: string;
  highlight_score: number;
  sfx: string;
}

export interface SceneOpen {
  recap_of_previous: string;
  narration: string;
  situation: string;
  banner: string;
  npc_line: { speaker: string; line: string };
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
  partnerId?: string;
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

export type Phase =
  | "lobby"
  | "quest"
  | "narrating"
  | "pitch"
  | "vote"
  | "roll"
  | "rolling"
  | "catch"
  | "outcome"
  | "final_roll"
  | "final_result"
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
  quest?: { title: string; realm: string; premise: string; threat: string; goal: string };
  scenes: SceneView[];
  sceneIndex: number;
  hope: number;
  hopeMax: number;
  narration: string;
  situation: string;
  banner: string;
  npcLine: { speaker: string; line: string };
  suggestions: Record<string, string[]>;
  rescue: { victimId: string; peril: string } | null;
  pitches: Pitch[];
  votes: Record<string, string>;
  deadline: number; // ms remaining when this state was sent, 0 = no timer
  rollerId: string;
  winningPitchId: string;
  roll: RollResult | null;
  catchers: string[];
  outcome: Outcome | null;
  final: FinalRoll | null;
  epilogue: string;
  storybook: Storybook | null;
  log: LogEntry[];
  busy: string; // "" or a short "the scribes are inking…" message
}
