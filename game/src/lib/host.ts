"use client";
import { heroPortrait } from "@/lib/heroArt";
import seedsJson from "@/data/seed_quests.json";
import questImages from "@/data/quest_images.json";
import quickHeroes from "@/data/quickstart_heroes_v2.json";
import { ai, image, thumbnail, withTimeout } from "./api";
import {
  BAND_LABEL,
  ENDING_LABEL,
  FINAL_ROLL_MS,
  HOPE_MAX,
  HOPE_START,
  PITCH_MS,
  PLAYER_COLORS,
  ROLL_ANIM_MS,
  ROLL_MS,
  PLAN_MAX,
  QUICK_TURN_MS,
  RULING_MS,
  STAT_LABEL,
  STORY_VOTE_MS,
  TIER_DC,
  TIER_LABEL,
  TURN_MS,
  VOTE_MS,
  d20,
  evenStats,
  judge,
  endingFromBand,
  TITLE_BEAT_MS,
  narrationMs,
  readMs,
} from "./rules";
import { openRoom, type Msg, type Transport } from "./transport";
import { mask } from "./mask";
import { QUICK, coldOpenTimeline } from "./quick";
import { FEATURES } from "./features";
import { pickStorySfx, pickStorySfxCues, type StorySfxCue } from "./storySfx";
import { Bots } from "./bots";
import { TIER_SHIFT, gradeRoll } from "./grade";
import { applyTurn, fallbackProposal, quipOk, stateFromOpener, type StoryState, type TurnResult, type VoiceLine } from "./procedural";
import { speakableName } from "./now";
import { DEFAULT_CAST, VOICES, isVoice } from "./voices";
import { ART_STYLES, isArtStyle } from "./artStyles";
import { DEFAULT_RATING, isRating, questAllowed } from "./rating";
import { HEAVY, cleanText, fearPhrase, realOf, skillPhrase, solvedByLine } from "./real";
import type {
  Band,
  DMNotes,
  Ending,
  GameMode,
  GameState,
  Hero,
  MirrorCard,
  NoteKind,
  Pitch,
  Player,
  QuestSeed,
  Rating,
  RealAnswers,
  RollResult,
  Save,
  SeedScene,
  SceneView,
  Stat,
  Storybook,
  Verdict,
} from "./types";

const SEEDS = seedsJson as QuestSeed[];
/** Ready-made characters for fast onboarding; portraits are pre-painted in public/heroes/<id>.webp. */
export const QUICK_HEROES = quickHeroes as { id: string; pitch: string; hero: Hero }[];

/** "Ricky thanked Mara for the save" lines. Pure, so the read-only /watch screen can show them too. */
export function thankYouLines(s: GameState) {
  const name = (id: string) => s.players.find((p) => p.id === id)?.hero?.name ?? "";
  return s.saves
    .filter((x) => x.thanked)
    .map((x) => {
      const by = x.byIds.map(name).filter(Boolean);
      const list = by.length > 1 ? `${by.slice(0, -1).join(", ")} and ${by[by.length - 1]}` : by[0] ?? "a friend";
      return `${name(x.savedId)} thanked ${list} for ${x.kind === "catch" ? "the save" : "the rescue"}`;
    });
}

export interface ShelfBook {
  party: string;
  title: string;
  date: string;
  heroes: string[];
  moral: string;
  headline: string;
  source: string;
  link: string;
  ending: string;
  cover: string;
}

const READING = new Set(["quest", "narrating", "ruling", "outcome", "mirror_reveal", "epilogue", "reveal"]);
const MIRROR_WRITE_MS = 40_000;
const MIRROR_GUESS_MS = 20_000;
const MIRROR_PHASES = ["mirror_write", "mirror_guess", "mirror_reveal"];
// All-together Final Roll: arm (up to 8 s), "3, 2, 1" (3.5 s), SHAKE window (6 s), shared tumble, land.
const FINAL_ARM_MS = 6000;
const FINAL_COUNT_MS = 3200;
const FINAL_SHAKE_MS = 5000;
const FINAL_TUMBLE_MS = 2000;
const FINAL_LAND_MS = 1400;
const FINAL_RESULT_MS = 3500;
const CONVINCE_MS = 60_000; // the finale talk (CD): one minute to convince each other
const FULL_READ_CAP_MS = 20_000; // a reading screen never holds the table longer (Space or every phone skips sooner)
const TITLE_CARD_MS = 5200; // Full Story: the title card before scene 1
const ROLL_HOLD_MS = 2200; // after the die lands: the quality meter fills and its grade reads (was 3.4 s of dead air)
/** The outcome stays up long enough to read it out loud, and no longer. */
const outcomeMs = (text: string) => Math.min(12_000, Math.max(6500, text.split(/\s+/).length * 330 + 3200));
// Autopilot: a phone that's said nothing for this long (mid-story) is away; its hero keeps playing on its own.
const AWAY_SILENCE_MS = 25_000;
const AWAY_AFTER_TIMEOUTS = 2;
export const MONTAGE_PANEL_MS = 3600; // one ending-montage panel on the TV (was 4.8 s: the CD waited ~70 s across montage + reveal)
/** design/35 rule 4: progress is decided by code from the grade, never by the AI. */
/** The house ranking of the hand-made stories (Quick Tale opens on the first one a table hasn't played). */
const JUDGE_TOP = 3; // judge mode (/tv?judge=1) rotates through the first 3 FEATURED stories only
// galactic-signal is last: its premise ("radio glow", "the catalog stays wrong") made 2 of 3 unfollowable lines in the Sun eval.
// The judge top 3 (CD, Sun): the canal shark, the gold in the wall, the Norwich Batman; then the opera snake and the old three.
const FEATURED = ["canal-shark", "wall-gold", "norwich-batman", "opera-snake","rust-wyrm", "hanging-boulder", "cornfield-dome", "billion-pearls", "idle-island", "returned-otter", "littlest-gardener", "galactic-signal"];
const PRESENCE_ONLY = new Set(["hello", "ping", "away"]); // these don't count as "I'm back"
/** Every phone silent this long = the table pauses ("Reconnecting phones…"). Phones ping every 3 s. */
const ALL_QUIET_MS = 8000;
/** The climax: nobody is put on autopilot here, and the phone never covers it with "I'm back". */
const CLIMAX = new Set(["final_roll", "final_result", "epilogue", "reveal", "storybook"]);
const BAND_RANK: Record<Band, number> = { LEGENDARY: 0, SUCCESS: 1, YES_BUT: 2, FAIL: 3, CATASTROPHE: 4 };

/** "Bridge inspector" -> "the bridge inspector", "The sheriff" -> "the sheriff", "TV reporter" -> "the TV reporter", "Grandpa" stays. */
function speakerRef(s: string) {
  const t = s.trim();
  if (/^the\s/i.test(t)) return `the ${t.slice(4)}`;
  const w = t.split(/\s+/);
  if (w.length === 1) return t;
  return `the ${[/^[A-Z]{2,}$/.test(w[0]) ? w[0] : w[0].toLowerCase(), ...w.slice(1)].join(" ")}`;
}

/**
 * What the narrator reads for the opener: a storyteller's lead-in, the narration, then the character's line (CD: a
 * storyteller talking to the table). The judge openers are pre-voiced from exactly this text (game/voice-cache).
 */
/** A line as the narrator reads it (and its audio cache key): one line, no doubled words. */
function voiceText(text: string) {
  // "door door", "through through": a doubled word reads badly aloud.
  return text.replace(/\s+/g, " ").trim().replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
}

function openerText(sc: SeedScene) {
  const npc = sc.npc_line?.speaker && sc.npc_line?.line ? ` And ${speakerRef(sc.npc_line.speaker)}? Very calmly: "${sc.npc_line.line}"` : "";
  return `Okay, everyone… gather in. ${sc.narration}${npc}`;
}

/** The narrator's sign-off after the ending (the same text wherever it's voiced, so the early clip is the one that plays). */
const SIGN_OFF = "And that, friends, is how the story goes.";

type OutcomeData = { progress_hint?: "low" | "mid" | "high"; step_solved?: boolean; text: string; situation?: string; why?: string; now_goal?: string; where?: string; changed?: string; new_fact?: string; new_prop?: string; memorable?: string; scene?: string; open_thread?: string };

const norm = (x: string) => String(x ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();

/** A live odd-news candidate (GET /api/news). */
interface NewsCand {
  id: string;
  headline: string;
  snippet: string;
  source: string;
  url: string;
  date: string;
  place: string;
}

/** The story writer's answer (POST /api/story/opener). */
interface OpenerRes {
  opener: {
    title: string;
    narration: string;
    goal: string;
    situation: string;
    npc_line?: { speaker: string; line: string };
    quest_title?: string;
    teaser?: string;
    mood?: string;
    threat?: { name?: string; pronoun?: string; want?: string };
    problem?: { name?: string; stakes?: string; pronoun?: string };
    beats?: string[];
    /** Story v3: the starting problem in one plain sentence, and 2-3 things that get worse on their own. */
    original_problem?: string;
    pressures?: { name: string; stages: string[]; fix: string }[];
  };
  ending_facts?: { kind: "news"; whats_happening_now?: string; official_line?: string } | { kind: "personal"; real_ending?: string };
  safe?: boolean;
  fallback?: boolean;
  quest_title?: string; // the fantasy quest name (never the headline)
  teaser?: string; // one line for the quest card
  mood?: string;
}

/** /api/news may send candidates, or (older shape) whole quest seeds: either becomes a candidate. */
function toCandidate(x: unknown): NewsCand | null {
  const o = x as Record<string, unknown> & { the_real_story?: Record<string, string>; realm_name?: string };
  if (!o) return null;
  if (typeof o.headline === "string") {
    return { id: String(o.id ?? o.headline).slice(0, 80), headline: o.headline, snippet: String(o.snippet ?? ""), source: String(o.source ?? ""), url: String(o.url ?? ""), date: String(o.date ?? ""), place: String(o.place ?? "") };
  }
  const rs = o.the_real_story;
  if (rs?.headline) return { id: String(o.id ?? rs.headline).slice(0, 80), headline: rs.headline, snippet: rs.summary ?? "", source: rs.source ?? "", url: rs.link ?? "", date: rs.date ?? "", place: String(o.realm_name ?? "") };
  return null;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function openerScene(o: OpenerRes["opener"], where: string): SeedScene {
  return {
    kind: "hook",
    title: o.title,
    location: where,
    narration: o.narration,
    goal: String(o.goal ?? "").replace(/[.!]+$/, ""),
    situation: o.situation,
    npc_line: o.npc_line ?? { speaker: "", line: "" },
  };
}

/** Our stories without the writer: the player's own setup is the opener (never the ending). */
function localOpener(st: { title: string; setup: string; steps: string }): OpenerRes {
  return {
    opener: { title: st.title, narration: st.setup, goal: "Help this story end well", situation: st.steps || st.setup, npc_line: { speaker: "", line: "" } },
    safe: true,
    fallback: true,
  };
}

/** A live headline as a story: the opener from the writer, the article for the reveal. */
function newsSeed(id: string, c: NewsCand, o: OpenerRes): QuestSeed {
  const facts = o.ending_facts?.kind === "news" ? o.ending_facts : undefined;
  return {
    id,
    quest_title: o.opener.title,
    realm_name: "", // the real place waits for the reveal
    fairytale_premise: o.opener.narration,
    the_threat: { name: o.opener.title, description: o.opener.situation, mapped_from: facts?.official_line || c.snippet },
    the_goal: { description: o.opener.goal, mapped_from: "" },
    locations: [],
    complications: [],
    the_real_story: { summary: c.snippet, headline: c.headline, source: c.source, link: c.url, date: c.date, now: facts?.whats_happening_now || "" },
    art_style_hint: o.opener.situation,
    rating: "teens",
    opener: openerScene(o.opener, c.place),
    original_problem: o.opener.original_problem,
    pressures: o.opener.pressures,
  };
}

/** A player's true story: the opener from their setup; their real ending is kept for the reveal. */
function personalSeed(id: string, pid: string, author: string, st: { title: string; setup: string; steps: string; ending: string }, o: OpenerRes): QuestSeed {
  const ending = o.ending_facts?.kind === "personal" && o.ending_facts.real_ending ? o.ending_facts.real_ending : st.ending;
  return {
    id,
    quest_title: o.opener.title || st.title,
    realm_name: "",
    fairytale_premise: o.opener.narration,
    the_threat: { name: o.opener.title || st.title, description: o.opener.situation, mapped_from: st.setup },
    the_goal: { description: o.opener.goal, mapped_from: "" },
    locations: [],
    complications: [],
    the_real_story: { summary: ending, headline: st.title, source: author, link: "", date: new Date().toISOString().slice(0, 10) },
    art_style_hint: o.opener.situation,
    rating: "teens",
    opener: openerScene(o.opener, ""),
    original_problem: o.opener.original_problem,
    pressures: o.opener.pressures,
    author: { pid, name: author },
  };
}

/** "…and then…", "if that fails…": only the first action counts. Returns the first action and whether a chain was cut. */
export function firstAction(text: string): { action: string; cut: boolean } {
  const m = text.match(/(.+?)(?:\s*[,;.]?\s*(?:\b(?:and|or|but)\s+)?\b(?:then|after that|afterwards|if (?:that|it) (?:fails|doesn't work|does not work)|if not|otherwise|else)\b)/i);
  const action = m ? m[1].trim().replace(/[,;.\s]+$/, "") : "";
  if (action.split(/\s+/).length >= 2) return { action, cut: true };
  return { action: text, cut: false };
}

/** Camera directions for decision paintings, rotated so consecutive pictures are clearly different shots. */
const SHOTS = [
  "close-up on the heroes' faces and hands in the middle of the action",
  "wide shot showing the whole place and how small the heroes are in it",
  "low angle looking up past the heroes at the impossible thing",
  "over-the-shoulder shot from behind one hero, looking at what they face",
  "high angle looking down on the heroes and the scene around them",
];

/** One action, ~140 characters, one line. */
/** A player-chosen hero name: trimmed, 20 characters max, letters and simple punctuation; "" if it has slurs or profanity. */
function heroNameOf(x: unknown) {
  const n = cleanText(x, 40).replace(/[^\p{L}\p{N} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20).trim();
  return n && mask(n) === n ? n : "";
}

function cleanPlan(text: unknown) {
  return String(text ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, PLAN_MAX);
}

/** Uniform-enough random int in [0, n) from crypto. */
function randInt(n: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

/** "Doug was at his best when" */
function mirrorFrame(h: Hero) {
  const poss = h.pronouns === "he/him" ? "his" : h.pronouns === "she/her" ? "her" : "their";
  return `${h.name} was at ${poss} best when`;
}

/**
 * Client-side safety net when the kindness pass doesn't answer. Mirrors fallbackKind on the server.
 * Safety: never shows unchecked text (not the guardian's draft, not the ward's raw lines), only a warm canned line.
 */
function kindFallback(h: Hero, moments: { pitch: string }[]) {
  const frame = mirrorFrame(h);
  const subj = h.pronouns === "he/him" ? "he" : h.pronouns === "she/her" ? "she" : "they";
  return moments.length
    ? `${frame} ${subj} went all in on a plan and made the whole table lean closer.`
    : `${frame} ${subj} stayed in it with everyone, start to finish.`;
}
const SUCCESS_BANDS: Band[] = ["YES_BUT", "SUCCESS", "LEGENDARY"];

// ---------- DM's Notes (AI transparency) ----------
const NOTES_CAP = 60;
/** Why each seed story is safe to play. Short and static: these five were checked by hand. */
const SAFETY_NOTES: Record<string, string> = {
  "rust-wyrm": "No one hurt. The bridge closed as a precaution and is reopening. No real people in the story.",
  "billion-pearls": "No one hurt. The spill was in July and the beach clean-up is underway. No real people in the story.",
  "hanging-boulder": "No one hurt. The rock fell on a closed walkway and the event is over. No real people in the story.",
  "canal-shark": "Good animal news: the shark swam back to sea. No one hurt. No real people in the story.",
  "opera-snake": "A real opera casting call for a snake. No one hurt. No real people in the story.",
  "wall-gold": "Found treasure, handed to the police. No one hurt, nothing stolen. No real people in the story.",
  "norwich-batman": "A bag snatch with a happy ending: the bag came back with everything inside. No one hurt. The thief is never named or shown. Adults rating.",
  "galactic-signal": "Nobody involved at all: a radio source 49,000+ light-years away. No danger. No real people in the story.",
  "littlest-gardener": "Happy local news: a festival pumpkin win. No one hurt. The young grower is never named or shown.",
  "idle-island": "Nothing happened to anyone: it was a computer simulation in a research study. No real people in the story.",
  "returned-otter": "Good wildlife news: an otter came home. No one hurt. No real people in the story.",
  "cornfield-dome": "Space debris landed in an empty field, was secured, and posed no danger. No one hurt. No real people in the story.",
};
const SAFETY_GENERIC = "Passed the tragedy filter: no deaths, injuries, crime, war, disease or politics. No real people in the story.";

function emptyNotes(): DMNotes {
  return {
    safety: "",
    source: null,
    canon: [],
    open: [],
    log: [],
    stats: { rounds: 0, plans: 0, appeals: 0, appealsChanged: 0, rolls: 0, nat1: 0, nat20: 0, safety: 0, fallbacks: 0 },
  };
}

const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const end = (t: string) => t.trim().replace(/[\s.!?,]+$/, "") + ".";
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);

/**
 * Ending module: one step that runs between the Final Roll and the reveal. Call done() when it's over.
 * Steps are looked up by id, so a new module (a Mirror, Mirror replacement, say) is one registerEnding() call
 * plus a setEndingPlan() for the mode that should use it.
 */
export type EndingStep = (done: () => void) => void;

function bestStat(h?: Hero): Stat {
  if (!h) return "brave";
  return (Object.keys(h.stats) as Stat[]).sort((a, b) => h.stats[b] - h.stats[a])[0];
}

function shortGoal(text: string) {
  const first = text.split(/(?<=[.!?])\s/)[0];
  const words = first.split(/\s+/);
  return words.length > 16 ? words.slice(0, 16).join(" ") + "…" : first;
}

/** The last few endings on this TV (v3: the ending prompt avoids repeating them). */
function recentEndings(): string[] {
  try {
    return JSON.parse(localStorage.getItem("gp-endings") ?? "[]").slice(0, 5);
  } catch {
    return [];
  }
}
function rememberEnding(text: string) {
  try {
    if (text) localStorage.setItem("gp-endings", JSON.stringify([text, ...recentEndings()].slice(0, 5)));
  } catch {
    /* a nice-to-have */
  }
}

export function loadShelf(): ShelfBook[] {
  try {
    return JSON.parse(localStorage.getItem("ouar-shelf") ?? "[]");
  } catch {
    return [];
  }
}

/**
 * The ending when the AI is down: it still names the final plan (design/35, plan-aware fallbacks only) and lands on
 * the finish line. `attempt` is the ruling's plain line ("Gus leads a snack parade to the cabin").
 */
function fallbackEnding(ending: Ending, name: string, attempt: string, finish: string) {
  const did = (attempt || `${name} goes for it`).replace(/[.!]+$/, "");
  const goal = finish.replace(/[.!]+$/, "").replace(/^./, (c) => c.toLowerCase());
  // The finish line is usually verb-first ("Get the dog home"); anything else is said as a plain result.
  if (ending === "TRIUMPHANT") return !goal || /^(the|a|an|it|they|we|everyone)\b/i.test(goal) ? `${did}, and it works. The heroes pull it off together.` : `${did}, and it works. Together, the heroes ${goal}.`;
  if (ending === "BITTERSWEET") return `${did}, and it mostly works. The job gets done, but one silly thing never goes back to normal.`;
  return `${did}, but it doesn't quite work. Everyone is fine, and somehow the town likes it better this way.`;
}
const FALLBACK_LINE: Record<Ending, string> = {
  TRIUMPHANT: "They pulled it off together.",
  BITTERSWEET: "It worked, mostly.",
  GRIM_BUT_HILARIOUS: "It didn't work, and somehow that's fine.",
};


/** The stories this group's rating allows (lib/rating.ts). */
function questOptionsFor(rating: Rating) {
  // Quest cards only: the fantasy title and the quest. The real headline, source and place wait for the reveal.
  return SEEDS.filter((q) => questAllowed(q.rating, rating)).map((q) => ({
    id: q.id,
    title: q.quest_title,
    teaser: `Your quest: ${(q.quick_scene?.goal ?? q.scenes?.[q.scenes.length - 1]?.goal ?? q.the_goal.description).replace(/[.!]+$/, "").replace(/^./, (c) => c.toLowerCase())}.`,
    art: (questImages as Record<string, string[]>)[q.id]?.[2],
  }));
}

/** A room's state before any story: the constructor's, and Play again's (which keeps the room, players and heroes). */
function freshState(code: string, rating: Rating = DEFAULT_RATING): GameState {
  return {
    code,
    rating,
    phase: "lobby",
    mode: "full",
    partyName: "",
    players: [],
    questId: "",
    questOptions: questOptionsFor(rating),
    scenes: [],
    sceneIndex: 0,
    hope: HOPE_START,
    hopeMax: HOPE_MAX,
    question: "",
    lastTime: "",
    sceneTitle: "",
    goal: "",
    nowGoal: "",
    ladder: [],
    step: 0,
    fling: null,
    progress: 0,
    sceneArt: "",
    narration: "",
    situation: "",
    banner: "",
    npcLine: { speaker: "", line: "" },
    suggestions: {},
    clues: {},
    clueBecause: {},
    rescue: null,
    pitches: [],
    votes: {},
    winnerId: "",
    wins: {},
    outcome: "",
    endingLine: "",
    recap: "",
    storyOptions: [],
    source: "news",
    written: [],
    turnOrder: [],
    turnIndex: 0,
    ideas: {},
    finale: false,
    cast: null,
    voice: null,
    narrated: false,
    typing: [],
    paused: false,
    artKey: -1,
    boosts: {},
    rolls: [],
    revealed: [],
    catchers: [],
    saves: [],
    round: null,
    beatIndex: 0,
    ready: [],
    deadline: 0,
    final: null,
    finalMoves: {},
    epilogue: "",
    storybook: null,
    wards: {},
    mirrorMoments: {},
    mirror: [],
    mirrorIndex: 0,
    thanks: {},
    log: [],
    solvedBy: "",
    notes: emptyNotes(),
    busy: "",
  };
}

export class GameHost {
  state: GameState;
  deadlineAt = 0;
  portraits: Record<string, string> = {};
  thumbs: Record<string, string> = {};
  sceneImages: Record<number, string> = {};
  reactionCounts: Record<string, number> = {};

  private t: Transport;
  private subs = new Set<() => void>();
  private reactionSubs = new Set<(r: { pid: string; emoji: string; id: number }) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: (() => void) | null = null;
  private bcTimer: ReturnType<typeof setTimeout> | null = null;
  private seed?: QuestSeed;
  private verdicts = new Map<string, Promise<Verdict>>(); // pitch id -> its ruling, asked the moment it was sent
  private sceneList: SeedScene[] = []; // the hand-written scenes being played
  private pinned = false; // a story was picked by link, so Full Story skips the vote
  private pendingRoll: RollResult | null = null;
  private turnP: Promise<TurnResult> | null = null;
  private outcomeAt = 0; // when the outcome text arrived (its audio was asked for then)
  private finalRoll: RollResult | null = null;
  private finalPitch: Pitch | null = null;
  private artP = new Map<string, Promise<void>>(); // `${questId}:${scene}` -> hero-painted scene art in flight
  private artSeq = 10; // keys for per-decision paintings in sceneImages (0-2 are the plates)
  private epilogueP: Promise<{ ending: string; line: string; recap: string; skills: Record<string, string> | null; sfx?: StorySfxCue[]; buildup?: string; payoff?: string; bridge?: string; lines?: VoiceLine[] }> | null = null;
  private endingAt = 0;
  private storybookP: Promise<Storybook> | null = null;
  private reactionId = 0;
  private lastReact: Record<string, number> = {};
  private lastPortraitSend: Record<string, number> = {};
  private mirrorP = new Map<string, Promise<string>>(); // guardian id -> their finished, kind sentence
  private lastThanks: Record<string, number> = {};
  private notesStart = Date.now();
  private mirrorFate = new Map<string, "kept" | "rewritten" | "dm">(); // guardian id -> what the kindness pass did
  private finalSafety: ReturnType<typeof setTimeout> | null = null;
  private truths: Record<string, string> = {}; // "one true thing" texts, kept off the wire until the storybook
  private reals: Record<string, RealAnswers> = {};
  private basePowers: Record<string, { ability: Hero["ability"]; flaw: string }> = {}; // the hero's own text, before answers // join answers (good at / small fear), kept off the wire until the reveal
  private skipping = false; // a presenter skip (Continue / S) isn't a player letting time run out
  // Online mode: /watch pages ask for state + media. Only then do we spend bandwidth on reactions and scene copies.
  private watched = false;
  private sceneCopies = new Map<string, Promise<string>>(); // `${questId}:${index}` -> image small enough for a realtime message
  private lastSeen: Record<string, number> = {};
  private timeouts: Record<string, number> = {}; // consecutive phases this player let time out
  private awayWhy: Record<string, "silent" | "idle" | "stepped"> = {};
  private toastSubs = new Set<(t: { text: string; id: number }) => void>();
  private toastId = 0;
  private presenceIv: ReturnType<typeof setInterval> | null = null;
  private endingFor: string | null = null; // the final roll the epilogue/storybook were already asked about
  private endingQueue: string[] = [];
  private endingSteps: Record<string, EndingStep> = {
    mirror: (done) => (Object.keys(this.state.wards).length ? this.startMirror(done) : done()),
    epilogue: (done) => this.startEpilogue(done),
  };
  /** Which ending modules run, in order, per mode. Quick Tale skips Mirror for now (pluggable later). */
  private endingPlan: Record<GameMode, string[]> = { full: FEATURES.mirror ? ["mirror", "epilogue"] : ["epilogue"], quick: ["epilogue"] };
  /** When the current Quick Tale started (ms), for the TV's run clock. 0 = not running. */
  startedAt = 0;
  endedAt = 0;

  constructor(code: string) {
    this.state = freshState(code);
    this.t = openRoom(code);
    this.t.on((m) => this.handle(m));
    if (typeof window !== "undefined") this.loadNews();
    this.presenceIv = setInterval(() => this.checkPresence(), 2000);
  }

  get transportKind() {
    return this.t.kind;
  }

  // ---------- store plumbing ----------
  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };
  getState = () => this.state;
  onReaction(fn: (r: { pid: string; emoji: string; id: number }) => void) {
    this.reactionSubs.add(fn);
    return () => {
      this.reactionSubs.delete(fn);
    };
  }

  onToast(fn: (t: { text: string; id: number }) => void) {
    this.toastSubs.add(fn);
    return () => {
      this.toastSubs.delete(fn);
    };
  }

  private set(patch: Partial<GameState>) {
    this.state = { ...this.state, ...patch };
    this.subs.forEach((f) => f());
    this.broadcastSoon();
  }

  private patchPlayer(pid: string, patch: Partial<Player>) {
    this.set({ players: this.state.players.map((p) => (p.id === pid ? { ...p, ...patch } : p)) });
  }

  private player(pid: string) {
    return this.state.players.find((p) => p.id === pid);
  }

  private heroes() {
    return this.state.players.filter((p) => p.hero);
  }

  private broadcastSoon() {
    if (this.bcTimer) return;
    this.bcTimer = setTimeout(() => {
      this.bcTimer = null;
      this.broadcastNow();
    }, 100);
  }

  private broadcastNow() {
    const deadline = this.deadlineAt ? Math.max(0, this.deadlineAt - Date.now()) : 0;
    this.t.send({ type: "state", state: { ...this.state, deadline } });
  }

  private setTimer(ms: number, fn: () => void) {
    this.clearTimer();
    if (this.paused) {
      // Frozen while every phone is offline: it starts when one is back.
      this.pending = fn;
      this.pausedLeft = ms;
      return;
    }
    this.deadlineAt = Date.now() + ms;
    this.pending = fn;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.deadlineAt = 0;
      const f = this.pending;
      this.pending = null;
      f?.();
    }, ms);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.deadlineAt = 0;
  }

  /** TV "Continue ▸" / spacebar: run whatever the current timer would run, right now. */
  skip() {
    const f = this.pending;
    if (!f) return;
    this.clearTimer();
    this.skipping = true;
    try {
      f();
    } finally {
      this.skipping = false;
    }
    this.broadcastSoon();
  }

  /** A reading screen: advances on Continue, when every hero taps Ready, or after a generous safety timer. */
  private reading(text: string, next: () => void, minMs = 7000, capMs?: number) {
    this.set({ ready: [] });
    this.setTimer(this.readFor(text, minMs, capMs), next);
  }

  private onReady(pid: string) {
    // The finale talk: "ready to vote" (everyone here ready = the vote starts).
    if (this.state.phase === "convince") {
      if (!this.player(pid)?.hero || this.state.ready.includes(pid)) return;
      const ready = [...this.state.ready, pid];
      this.set({ ready });
      if (this.allPresent((id) => ready.includes(id))) this.endConvince();
      return;
    }
    if (!READING.has(this.state.phase) || this.state.busy || !this.pending) return;
    if (this.quick && this.state.phase === "quest") return; // the cold open plays out (the TV can still skip)
    if (!this.player(pid)?.hero || this.state.ready.includes(pid)) return;
    const ready = [...this.state.ready, pid];
    this.set({ ready });
    if (this.allPresent((id) => ready.includes(id))) this.skip();
  }

  // ---------- autopilot (presence) ----------
  /** Heroes whose phones are with us. */
  private present() {
    return this.heroes().filter((p) => !p.away);
  }

  /** Everyone who's here has done it. Never true when nobody is here, so an empty table runs on timers. */
  private allPresent(done: (pid: string) => boolean) {
    const here = this.present();
    return here.length > 0 && here.every((p) => done(p.id));
  }

  private inStory() {
    return this.state.phase !== "lobby" && this.state.phase !== "storybook";
  }

  private toast(text: string) {
    // Never over the big moments (the roll, what happened, the finale, the ending): a "back" pill there is noise.
    if (["narrating", "roll", "outcome", "final_roll", "final_result", "epilogue", "reveal"].includes(this.state.phase)) return;
    const t = { text, id: ++this.toastId };
    this.toastSubs.forEach((f) => f(t));
  }

  private setAway(pid: string, why: "silent" | "idle" | "stepped") {
    const p = this.player(pid);
    if (!p?.hero) return;
    this.awayWhy[pid] = why;
    if (p.away) return;
    this.patchPlayer(pid, { away: true });
    const why2 = why === "stepped" ? "They tapped Step away" : why === "silent" ? "Their phone went quiet" : "Two timers in a row ran out on them";
    this.note("hero", p.hero.name, `On autopilot: ${why2}. Their hero plays its own suggestions and rolls itself; nobody waits.`);
    this.nudge();
  }

  private setBack(pid: string) {
    const p = this.player(pid);
    delete this.awayWhy[pid];
    this.timeouts[pid] = 0;
    if (!p?.away) return;
    // One line on what their hero did without them (skipped when "Your moment" is already on their phone).
    const s = this.state;
    const last = s.log[s.log.length - 1]?.narration;
    const catchUp = last || "Not much yet. Your hero kept your seat warm.";
    this.patchPlayer(pid, { away: false, catchUp });
    if (catchUp) setTimeout(() => this.player(pid)?.catchUp === catchUp && this.patchPlayer(pid, { catchUp: "" }), 20_000);
    if (p.hero) {
      this.toast(`${p.hero.name} is back`);
      this.note("hero", p.hero.name, "Back from autopilot.");
    }
  }

  /** Every message from a phone says "I'm here". Pings only undo a silent away; a real tap undoes any. */
  private touch(m: Msg) {
    const pid = m.pid as string;
    if (!pid || !this.player(pid)) return;
    this.lastSeen[pid] = Date.now();
    if (this.paused) this.resume();
    if (m.type === "away") {
      if (this.inStory()) this.setAway(pid, "stepped");
      return;
    }
    if (!PRESENCE_ONLY.has(m.type) || this.awayWhy[pid] === "silent") this.setBack(pid);
  }

  /** A phase ran out on these players. Two in a row and their hero goes on autopilot. */
  private timedOut(pids: string[]) {
    if (this.skipping) return; // the presenter cut the timer short; nobody walked away
    if (this.state.finale || CLIMAX.has(this.state.phase)) return; // nobody goes on autopilot at the climax
    pids.forEach((pid) => {
      const p = this.player(pid);
      if (!p?.hero || p.away) return;
      this.timeouts[pid] = (this.timeouts[pid] ?? 0) + 1;
      if (this.timeouts[pid] >= AWAY_AFTER_TIMEOUTS) this.setAway(pid, "idle");
    });
  }

  private checkPresence() {
    this.pruneTyping();
    if (!this.inStory()) return;
    const now = Date.now();
    const here = this.heroes().filter((p) => !p.away);
    const alive = here.filter((p) => now - (this.lastSeen[p.id] ?? now) < ALL_QUIET_MS);
    // Every phone silent at once is a Wi-Fi drop, not a walk-away: freeze the table instead of marking anyone away.
    if (here.length && !alive.length) return this.pause();
    if (this.paused) return;
    if (!alive.length || CLIMAX.has(this.state.phase)) return;
    this.heroes().forEach((p) => {
      if (!p.away && now - (this.lastSeen[p.id] ?? now) > AWAY_SILENCE_MS) this.setAway(p.id, "silent");
    });
  }

  private paused = false;
  private pausedLeft = 0;

  /** "Reconnecting phones…": the timer stops where it is; no auto-rolls, no autopilot, until a phone is back. */
  private pause() {
    if (this.paused) return;
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.pausedLeft = Math.max(0, this.deadlineAt - Date.now());
    }
    this.deadlineAt = 0;
    this.set({ paused: true });
    this.note("hero", "The table", "Every phone went quiet at once (Wi-Fi?), so the table paused instead of moving on without anyone.");
  }

  private resume() {
    if (!this.paused) return;
    this.paused = false;
    const now = Date.now();
    this.heroes().forEach((p) => (this.lastSeen[p.id] = Math.max(this.lastSeen[p.id] ?? 0, now)));
    this.set({ paused: false });
    const fn = this.pending;
    if (fn) this.setTimer(Math.max(this.pausedLeft, 4000), fn);
    this.broadcastNow();
    this.note("hero", "The table", "Phones are back, so the table picked up where it stopped.");
  }

  /** Someone just went away: if everyone still here has already acted, don't make them wait. */
  private nudge() {
    const s = this.state;
    switch (s.phase) {
      case "story_vote":
        if (this.storyVoters().every((p) => s.votes[p.id])) this.endStoryVote();
        return;
      case "turn":
        if (this.player(this.owner())?.away) this.endTurn();
        return;
      case "pitch":
        if (this.allPresent((id) => s.pitches.some((x) => x.playerId === id))) this.endPitch();
        return;
      case "vote": {
        const voters = this.planVoters();
        if (voters.every((p) => s.votes[p.id])) this.endVote();
        return;
      }
      case "roll":
        if (!s.revealed.length && this.player(s.rolls[0]?.playerId ?? "")?.away) this.revealRoll();
        return;
      case "final_roll":
        // All-together roll: stop waiting at "arm" or "shake" once everyone still here has done it.
        if (s.final?.stage === "arm" && this.allPresent((id) => !!s.final?.armed?.includes(id))) this.startCountdown();
        else if (s.final?.stage === "shake" && this.allPresent((id) => !!s.final?.shook?.includes(id))) this.startTumble();
        return;
      case "mirror_write":
        if (this.allPresent((id) => !s.mirror.some((c) => c.guardianId === id && !c.written))) this.endMirrorWrite();
        return;
      case "mirror_guess":
        if (this.allPresent((id) => !s.mirror.some((c) => c.wardId === id && !c.guess))) this.startMirrorReveal();
        return;
      default:
        if (READING.has(s.phase) && !s.busy && this.pending && this.allPresent((id) => s.ready.includes(id))) this.skip();
    }
  }

  // ---------- DM's Notes ----------
  /** One line in the transparency log. Small strings only: this rides along in every state message. */
  private note(kind: NoteKind, who: string, text: string) {
    const n = this.state.notes;
    const entry = {
      t: Math.max(0, Math.round((Date.now() - this.notesStart) / 1000)),
      kind,
      who: clip(who, 40),
      text: clip(text.replace(/\s+/g, " ").trim(), 240),
    };
    this.set({ notes: { ...n, log: [...n.log, entry].slice(-NOTES_CAP) } });
  }

  private bump(k: keyof DMNotes["stats"], by = 1) {
    const n = this.state.notes;
    this.set({ notes: { ...n, stats: { ...n.stats, [k]: n.stats[k] + by } } });
  }

  /** Honesty: say so every time a canned backup stood in for the AI. */
  private fellBack(what: string, why: string) {
    this.bump("fallbacks");
    this.note("fallback", "Backup used", `${what}: ${why}. Canned text stood in so the table never freezes.`);
  }

  /**
   * Every AI call goes through here: a timeout, an error, a server-side fallback, or an unusable answer
   * all get logged once, then `fb` stands in.
   */
  private viaAI<T, R>(what: string, p: Promise<{ data: T; fallback: boolean }>, ms: number, use: (d: T, fallback: boolean) => R | null | undefined, fb: () => R): Promise<R> {
    let done = false;
    const flag = (why: string) => {
      if (done) return;
      done = true;
      this.fellBack(what, why);
    };
    return withTimeout(
      p.then(
        (res) => {
          if (done) return undefined as unknown as R; // lost the race to the timer; the value is ignored
          const out = use(res.data, res.fallback);
          if (res.fallback || out == null) {
            flag(res.fallback ? "the AI call failed" : "the AI's answer was unusable");
            return out ?? fb();
          }
          done = true;
          return out;
        },
        () => {
          flag("the AI call errored");
          return fb();
        },
      ),
      ms,
      () => {
        // withTimeout runs this when its timer fires even if the call already answered: then it's a no-op.
        if (done) return undefined as unknown as R;
        flag(`no answer within ${Math.round(ms / 1000)}s`);
        return fb();
      },
    );
  }

  /** Every AI call carries the group's rating, so the DM's tone always matches who's playing. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ask<T>(task: string, input: any) {
    return ai<T>(task, { ...input, rating: this.state.rating });
  }

  private heroName(pid: string) {
    return this.player(pid)?.hero?.name ?? this.player(pid)?.name ?? "Someone";
  }

  /** What the DM ruled, in plain words. Redirected plans are described, never quoted. */
  private noteRuling(pitch: Pitch, v: Verdict) {
    this.bump("plans");
    const name = this.heroName(pitch.playerId);
    // Safety: player text that never reached the AI's moderation is not printed.
    const plan = v.fallback ? "(plan hidden: not reviewed)" : v.moderation === "ok" ? `"${clip(mask(pitch.text), 90)}"` : `(${clip(v.interpretation, 80)})`;
    const target = `${TIER_SHIFT[v.tier] >= 0 ? "+" : ""}${TIER_SHIFT[v.tier]} on the roll`;
    this.note("ruling", name, `Judged by Muse Spark: ${plan}${pitch.creditId ? ` (+ ${this.heroName(pitch.creditId)}'s idea, +1)` : ""} → ${TIER_LABEL[v.tier]}, ${target}, rolls ${STAT_LABEL[v.stat]}. ${end(v.reason || "No reason given")}`);
    if (v.moderation === "redirected") {
      this.bump("safety");
      this.note("safety", name, "Plan steered to the nearest harmless version. The original is never repeated.");
    } else if (v.moderation === "flag") {
      this.bump("safety");
      this.note("safety", name, "Plan flagged for care. The DM answered gently and kept it at Solid.");
    }
  }

  /** The die, the bonuses, the total and the band: all computed in code, never by the AI. */
  private noteRoll(r: RollResult, delay = ROLL_ANIM_MS, auto = false) {
    const write = () => {
      const name = this.heroName(r.playerId);
      const v = this.state.pitches.find((p) => p.playerId === r.playerId)?.verdict;
      this.bump("rolls");
      if (r.kept === 1) this.bump("nat1");
      if (r.kept === 20) this.bump("nat20");
      const mods = v ? ` ${fmtMod(r.statBonus)} ${STAT_LABEL[v.stat]}${r.bonus ? ` +${r.bonus} friend's idea` : ""}` : "";
      const vs = r.tierMod ? ` ${r.tierMod > 0 ? "+" : ""}${r.tierMod} ${v ? TIER_LABEL[v.tier].toLowerCase() : "plan"}` : "";
      const nat = r.kept === 1 ? " Natural 1." : r.kept === 20 ? " Natural 20." : "";
      this.note("roll", name, `${auto ? "Didn't tap in time, so the table rolled. " : ""}d20 rolled ${r.kept}${mods}${vs} = ${r.total} → ${end(r.gradeLabel ?? BAND_LABEL[r.band].replace(/…$/, ""))} Every total is its own outcome; the story moves on either way.${nat}`);
    };
    if (delay > 0) setTimeout(write, delay);
    else write();
  }

  // ---------- messages from phones ----------
  private handle(m: Msg) {
    this.touch(m);
    switch (m.type) {
      case "hello": {
        this.broadcastSoon();
        const now = Date.now();
        if (this.thumbs[m.pid] && now - (this.lastPortraitSend[m.pid] ?? 0) > 5000) {
          this.lastPortraitSend[m.pid] = now;
          this.t.send({ type: "portrait", pid: m.pid, url: this.thumbs[m.pid] });
        }
        break;
      }
      case "watch":
        return this.onWatch(m);
      case "join":
        return this.onJoin(m.pid, m.name);
      case "concept":
        return this.buildCharacter(m.pid, m.text, m.name);
      case "pick":
        return this.pickHero(m.pid, m.heroId, m.name);
      case "redraw":
        return this.redraw(m.pid);
      case "newhero":
        return this.onNewHero(m.pid);
      case "truth":
        return this.onTruth(m.pid, m.text);
      case "real":
        return this.onReal(m.pid, m.skill, m.fear);
      case "pitch":
        return this.onPitch(m.pid, m.text, String(m.creditId ?? ""), m.own, m.idea);
      case "idea":
        return this.onIdea(m.pid, m.text);
      case "typing":
        return this.onTyping(m.pid);
      case "story":
        return this.onStory(m.pid, m.title, m.setup, m.steps, m.ending);
      case "vote":
        return this.onVote(m.pid, String(m.id ?? ""));
      case "roll":
        return this.onRoll(m.pid, m.power, m.angle);
      case "ready":
        return this.onReady(m.pid);
      case "react":
        return this.onReact(m.pid, m.emoji);
      case "mirror":
        return this.onMirrorWrite(m.pid, m.text);
      case "guess":
        return this.onMirrorGuess(m.pid, m.text);
      case "thanks":
        return this.onThanks(m.pid);
      case "arm":
        return this.onArm(m.pid);
      case "thank_save":
        return this.onThankSave(m.pid, m.saveId);
      // "ping", "away" and "back" are handled by touch()
    }
  }

  private onJoin(pid: string, rawName: string) {
    const name = String(rawName ?? "").replace(/[<>]/g, "").trim().slice(0, 20) || "Player"; // the character's name (join asks for it, CD)
    const existing = this.player(pid);
    if (existing) return this.patchPlayer(pid, { name });
    if (this.state.phase !== "lobby" || this.state.players.length >= 6) return;
    // A free color (a kick can leave a gap), else the usual rotation.
    const used = new Set(this.state.players.map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[this.state.players.length % PLAYER_COLORS.length];
    this.set({
      kicked: (this.state.kicked ?? []).filter((x) => x !== pid), // Rejoin after a kick
      players: [
        ...this.state.players,
        { id: pid, name, color, status: "joined", hasPortrait: false, abilityAvailable: true, heart: 1, titles: [], peril: "" },
      ],
    });
  }

  private onReact(pid: string, emoji: string) {
    const now = Date.now();
    if (now - (this.lastReact[pid] ?? 0) < 300) return;
    this.lastReact[pid] = now;
    this.reactionCounts[pid] = (this.reactionCounts[pid] ?? 0) + 1;
    const r = { pid, emoji: String(emoji).slice(0, 4), id: ++this.reactionId };
    this.emitReaction(r);
    // Laughter shouldn't get cut off: a burst of reactions buys a reading screen a few more seconds.
    if (READING.has(this.state.phase) && this.deadlineAt && this.deadlineAt - now < 3000 && this.pending) {
      const fn = this.pending;
      this.setTimer(this.deadlineAt - now + 2500, fn);
    }
  }

  private emitReaction(r: { pid: string; emoji: string; id: number }) {
    this.reactionSubs.forEach((f) => f(r));
    if (this.watched) this.t.send({ type: "reaction", ...r });
  }

  /** A read-only /watch screen joined (or is missing pictures). It never changes the game; we just send it what it lacks. */
  private onWatch(m: Msg) {
    this.watched = true;
    this.broadcastSoon();
    const pids: string[] = Array.isArray(m.portraits) ? m.portraits.slice(0, 12).map(String) : [];
    pids.forEach((pid) => this.thumbs[pid] && this.t.send({ type: "portrait", pid, url: this.thumbs[pid] }));
    const questId = this.state.questId;
    const idx: number[] = Array.isArray(m.scenes) ? m.scenes.slice(0, 6).map(Number) : [];
    idx.forEach((i) => {
      const url = this.sceneImages[i];
      if (!url || !questId) return;
      const key = `${questId}:${i}`;
      // Pre-painted scenes are short paths; generated ones are big data URLs, so send a smaller JPEG copy.
      if (!this.sceneCopies.has(key)) this.sceneCopies.set(key, url.startsWith("data:") ? thumbnail(url, 800, 0.7) : Promise.resolve(url));
      this.sceneCopies.get(key)!.then((copy) => copy && this.state.questId === questId && this.t.send({ type: "scene", questId, index: i, url: copy }));
    });
  }

  // ---------- lobby ----------
  /** Lobby choice: "Quick Tale · 3 min" or "Full Story". Quick preselects the demo quest if none is picked. */
  setMode(mode: GameMode) {
    if (this.state.phase !== "lobby") return;
    this.set({ mode });
    this.prepareQuick();
  }

  // ---------- Quick Tale: a fresh live story, made while people join ----------
  private quickPrep: { seed: QuestSeed | null; ready: boolean; p: Promise<QuestSeed | null> } | null = null;
  /** Judge-safe switch (/tv?judge=1): Quick Tale always plays a saved story, never waits on a live one. */
  judge = false;
  /** When the lobby opened (to measure how long the live Quick Tale story takes). */
  private lobbyAt = Date.now();

  /** Stories this TV played lately (localStorage), so Quick Tale doesn't repeat them. */
  private recentStories(): string[] {
    try {
      return JSON.parse(localStorage.getItem("gp-recent-stories") ?? "[]");
    } catch {
      return [];
    }
  }

  private rememberStory(seed: QuestSeed) {
    try {
      const key = seed.the_real_story.headline || seed.id;
      const list = [key, ...this.recentStories().filter((k) => k !== key)].slice(0, 6);
      localStorage.setItem("gp-recent-stories", JSON.stringify(list));
      // The story ids this table has played, so /api/news can skip them (?played=).
      const id = seed.id.replace(/^news-/, "");
      const ids = [id, ...this.playedIds().filter((x) => x !== id)].slice(0, 30);
      localStorage.setItem("gp-played-ids", JSON.stringify(ids));
    } catch {}
  }

  private playedIds(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem("gp-played-ids") ?? "[]");
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }

  /**
   * Quick Tale picks a random live odd-news story (not one played lately) and writes its opener + paints its scene
   * during the lobby. If it isn't ready by Start, a curated story (also not played lately) stands in.
   */
  private prepareQuick() {
    if (this.state.mode === "full") this.prepareVote();
    if (!FEATURES.liveNews || this.judge || this.state.source !== "news" || this.pinned || this.quickPrep || this.state.phase !== "lobby") return;
    const recent = new Set(this.recentStories());
    const pool = this.newsCands.filter((c) => !recent.has(c.headline));
    if (!pool.length) return;
    const c = pool[0]; // /api/news sends only stories that pass the storyability gate, best first
    const optionId = `news-${c.id}`;
    // The live opener is written while people join and make heroes (that takes longer than the ~30 s call).
    // patient: nobody waits on this one, so the server lets the high-effort draft land (up to 40 s).
    const p = this.prepareStory(optionId, { mode: "news", patient: true, source: { headline: c.headline, snippet: c.snippet, source: c.source, url: c.url, date: c.date } }, (o) => newsSeed(optionId, c, o)).catch(() => null);
    const prep: { seed: QuestSeed | null; ready: boolean; p: Promise<QuestSeed | null> } = { seed: null, ready: false, p };
    this.quickPrep = prep;
    p.then((seed) => {
      const secs = ((Date.now() - this.lobbyAt) / 1000).toFixed(1);
      if (!seed) {
        this.note("fallback", "Quick Tale", `The live story couldn't be written (${secs}s after the lobby opened); a saved story will play.`);
        return;
      }
      prep.seed = seed;
      prep.ready = true;
      this.note("source", "Quick Tale", `Live story from today's news is ready ${secs}s after the lobby opened: "${seed.quest_title}".`);
      if (this.quick) this.prewarm(seed);
    });
  }

  /** Full Story's three quests, written (and painted) in parallel the moment Odd news is on and news is in. */
  private votePrep: { optionId: string; c: NewsCand }[] = [];

  private prepareVote() {
    if (!FEATURES.liveNews || this.state.source !== "news" || this.pinned || this.votePrep.length || this.state.phase !== "lobby") return;
    const recent = new Set(this.recentStories());
    // Only gated stories (best first); empty cards are filled from the curated quests at vote time.
    const pool = this.newsCands.filter((c) => !recent.has(c.headline)).slice(0, 3);
    if (!pool.length) return;
    this.votePrep = pool.map((c) => {
      const optionId = `news-${c.id}`;
      if (!this.openerP.has(optionId)) this.prepareStory(optionId, { mode: "news", source: { headline: c.headline, snippet: c.snippet, source: c.source, url: c.url, date: c.date } }, (o) => newsSeed(optionId, c, o));
      return { optionId, c };
    });
  }

  /** The vote's live quest cards, once written: the quest title and teaser, never the headline. */
  private async liveVoteOptions(): Promise<{ id: string; title: string; teaser: string }[]> {
    if (!this.votePrep.length) this.prepareVote();
    if (!this.votePrep.length) return [];
    this.set({ phase: "story_vote", storyOptions: [], votes: {}, busy: "Writing tonight's quests…" });
    const seeds = await Promise.all(this.votePrep.map((v) => withTimeout(this.openerP.get(v.optionId) ?? Promise.resolve(null), 10_000, () => null)));
    this.set({ busy: "" });
    return seeds
      .map((seed, i) => {
        if (!seed) return null;
        const teaser = this.teasers.get(seed.id) || (seed.opener?.goal ? `Your quest: ${seed.opener.goal.replace(/[.!]+$/, "")}.` : "");
        return { id: this.votePrep[i].optionId, title: seed.quest_title, teaser };
      })
      .filter((x): x is { id: string; title: string; teaser: string } => !!x);
  }

  /** The art for a vote card (curated plates ride in state; live paintings are data URLs, so the TV asks here). */
  optionArt(id: string) {
    return this.plateArt.get(id) ?? "";
  }

  private plateArt = new Map<string, string>();
  private teasers = new Map<string, string>();

  /**
   * The best curated story this TV hasn't played lately (judge mode: Quick Tale opens on a hand-made top story).
   * FEATURED is the house ranking; anything not in it comes after, and a table never gets the same story twice.
   */
  private freshCurated() {
    const recent = new Set(this.recentStories());
    const allowed = this.state.questOptions;
    const rank = (id: string) => (FEATURED.includes(id) ? FEATURED.indexOf(id) : FEATURED.length);
    const fresh = allowed.filter((q) => !recent.has(SEEDS.find((s) => s.id === q.id)?.the_real_story.headline ?? q.id));
    // Judge mode only plays the house's top 3 (known-great), the least recently played first.
    const top = this.judge ? allowed.filter((q) => FEATURED.slice(0, JUDGE_TOP).includes(q.id)) : [];
    if (top.length) {
      const order = this.recentStories();
      const age = (id: string) => order.indexOf(SEEDS.find((x) => x.id === id)?.the_real_story.headline ?? id);
      const unplayed = top.filter((q) => age(q.id) < 0).sort((a, b) => rank(a.id) - rank(b.id));
      return (unplayed[0] ?? top.slice().sort((a, b) => age(b.id) - age(a.id))[0]).id;
    }
    const pool = (fresh.length ? fresh : allowed).slice().sort((a, b) => rank(a.id) - rank(b.id));
    return pool[0].id;
  }

  /** Swap in a new ending module (see EndingStep). */
  registerEnding(id: string, step: EndingStep) {
    this.endingSteps[id] = step;
  }

  setEndingPlan(mode: GameMode, ids: string[]) {
    this.endingPlan[mode] = ids;
  }

  /** The one scene opener that may nod to players' "one true thing": the second scene, or Quick Tale's only one. */
  private truthScene() {
    return this.quick ? 0 : 1;
  }

  private get quick() {
    return this.state.mode === "quick";
  }

  /** Reading-screen safety timer; Quick Tale caps it so the demo stays under three minutes. */
  private readFor(text: string, minMs: number, capMs: number = QUICK.readCapMs) {
    const ms = readMs(text, minMs);
    // Full Story caps too: a long article summary read at 0.4 s a word held the reveal for 70 s (CD playtest).
    return Math.min(ms, Math.max(this.quick ? capMs : FULL_READ_CAP_MS, minMs));
  }

  setPartyName(name: string) {
    this.set({ partyName: name.slice(0, 40) });
  }

  async buildCharacter(pid: string, concept: string, chosenName?: unknown) {
    const p = this.player(pid);
    if (!p || p.status === "building" || this.state.phase !== "lobby") return;
    const text = String(concept ?? "").slice(0, 200);
    // The player's own hero name (CD): the AI builds around it and code makes sure it is never renamed.
    const chosen = heroNameOf(chosenName);
    this.patchPlayer(pid, { status: "building", concept: text, hasPortrait: false });
    const others = this.heroes().filter((o) => o.id !== pid);
    const hero = await this.viaAI<Hero, Hero | undefined>(
      `${p.name}'s character card`,
      this.ask<Hero>("character", {
        concept: text,
        chosen_name: chosen || undefined,
        partySoFar: others.map((o) => o.hero!.visual.anchor),
        real: this.reals[pid],
        avoidNames: others.map((o) => o.hero!.name),
      }),
      45_000,
      (d) => d,
      () => undefined,
    );
    if (this.player(pid)?.hero) return; // play started first, and they already have a ready-made stand-in
    if (!hero) return this.patchPlayer(pid, { status: this.state.phase === "lobby" ? "joined" : "ready" });
    if (hero.concept_status === "redirected" || hero.concept_status === "reimagined") {
      this.bump("safety");
      this.note(
        "safety",
        hero.name,
        hero.concept_status === "redirected"
          ? "Character idea steered to a harmless, funny version. The original is never repeated."
          : "Character idea named a real person or famous character, so the DM made an original instead.",
      );
    }
    delete this.basePowers[pid];
    if (chosen) hero.name = chosen;
    hero.stats = evenStats(hero.stats);
    // The AI already built the power from their answer; the code override is only for ready-made heroes.
    this.patchPlayer(pid, { status: "ready", hero, abilityAvailable: true, heart: 1 });
    if (!this.reals[pid]?.skill) this.applyReal(pid);
    const url = await image({ kind: "portrait", visual: hero.visual, flaw: hero.flaw, ability: hero.ability?.text });
    // Same hero still? (Compare by name: the join answers replace the hero object with a new power and weakness.)
    if (!url || !this.sameHero(pid, hero)) return;
    this.portraits[pid] = url;
    this.thumbs[pid] = await thumbnail(url);
    this.t.send({ type: "portrait", pid, url: this.thumbs[pid] });
    this.patchPlayer(pid, { hasPortrait: true });
  }

  /** The player still has this hero (not redrawn, not swapped for a stand-in). */
  private sameHero(pid: string, hero: Hero, pick?: string) {
    const p = this.player(pid);
    return !!p?.hero && p.hero.name === hero.name && p.pick === pick;
  }

  /** A ready-made character: instant, no AI call, pre-painted portrait. One of each per table. */
  async pickHero(pid: string, heroId: string, chosenName?: unknown) {
    const p = this.player(pid);
    const q = QUICK_HEROES.find((h) => h.id === heroId);
    if (!p || !q || p.status === "building" || this.state.phase !== "lobby") return;
    if (this.state.players.some((o) => o.id !== pid && o.pick === q.id)) return;
    const hero: Hero = { ...structuredClone(q.hero), stats: evenStats(q.hero.stats) };
    // A ready-made keeps its name unless the player typed their own (the phone sends one only if they edited it).
    const chosen = heroNameOf(chosenName);
    if (chosen) hero.name = chosen;
    delete this.basePowers[pid];
    this.patchPlayer(pid, { status: "ready", pick: q.id, concept: q.pitch, hero, hasPortrait: false, abilityAvailable: true, heart: 1 });
    this.applyReal(pid);
    this.note("hero", hero.name, "Ready-made hero picked: written and painted ahead of time, so no AI call.");
    const url = heroPortrait(q.id);
    this.portraits[pid] = url;
    const thumb = await thumbnail(url);
    if (!this.sameHero(pid, hero, q.id)) return;
    if (thumb) {
      this.thumbs[pid] = thumb;
      this.t.send({ type: "portrait", pid, url: thumb });
    }
    this.patchPlayer(pid, { hasPortrait: true });
  }

  /** "Redraw my character": back to choosing (frees a ready-made for someone else). */
  redraw(pid: string) {
    const p = this.player(pid);
    if (!p || p.status === "building" || this.state.phase !== "lobby") return;
    delete this.portraits[pid];
    delete this.thumbs[pid];
    this.patchPlayer(pid, { status: "joined", hero: undefined, pick: undefined, hasPortrait: false });
  }

  /** Play again (FEATURES.playAgain): back in the lobby, "Make a new hero" drops the kept one. Their join answers stay. */
  private onNewHero(pid: string) {
    const p = this.player(pid);
    if (!FEATURES.playAgain || !p?.hero || p.status === "building" || this.state.phase !== "lobby") return;
    delete this.portraits[pid];
    delete this.thumbs[pid];
    delete this.basePowers[pid];
    this.patchPlayer(pid, { status: "joined", hero: undefined, pick: undefined, concept: undefined, hasPortrait: false, titles: [] });
  }

  /**
   * The TV host removes a player or a test player (FEATURES.kick, lobby only). Their phone sees its id in
   * state.kicked and offers Rejoin (a normal join, which takes it off the list).
   */
  kick(pid: string) {
    const p = this.player(pid);
    if (!FEATURES.kick || !p || this.state.phase !== "lobby") return;
    this.bots.remove(pid);
    for (const m of [this.portraits, this.thumbs, this.reals, this.truths, this.basePowers, this.lastSeen, this.timeouts, this.awayWhy]) delete m[pid];
    this.set({
      players: this.state.players.filter((x) => x.id !== pid),
      kicked: [...(this.state.kicked ?? []).filter((x) => x !== pid), pid],
      ready: this.state.ready.filter((x) => x !== pid),
      typing: this.state.typing.filter((x) => x !== pid),
    });
    this.note("hero", p.hero?.name ?? p.name, "Removed from the lobby by the host.");
  }

  /** "One true thing about the real you" (optional, "" = skipped). Private; only for one gentle nod and the storybook. */
  private onTruth(pid: string, text: string) {
    const p = this.player(pid);
    if (!p || this.state.phase !== "lobby") return;
    const truth = String(text ?? "").replace(/[<>]/g, "").trim().slice(0, 80);
    // Private until the storybook: state (which every phone, /watch and /notes receive) only says "answered".
    this.truths[pid] = truth;
    this.patchPlayer(pid, { truth: "" });
    // The truth itself is PRIVATE: never put its text in the log.
    if (truth) this.note("hero", p.hero?.name ?? p.name, "Shared one true thing about themselves. It stays private: the DM may nod to it once, gently, in one scene.");
  }

  /** Lobby: Odd news (live headlines, curated stories as the fallback) or Our stories (players write true stories). */
  setSource(source: "news" | "ours") {
    if (this.state.phase !== "lobby") return;
    this.set({ source });
    this.prepareQuick();
  }

  /** Live odd-news candidates for this rating (GET /api/news, cached server-side for 4 h). Never throws. */
  loadNews() {
    const rating = this.state.rating;
    const played = this.playedIds().slice(0, 30).map(encodeURIComponent).join(",");
    fetch(`/api/news?rating=${rating}${played ? `&played=${played}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (this.state.rating !== rating) return;
        const raw: unknown[] = Array.isArray(j?.candidates) ? j.candidates : Array.isArray(j?.quests) ? j.quests : [];
        this.newsCands = raw.map(toCandidate).filter((c): c is NewsCand => !!c);
        if (this.newsCands.length) this.note("source", "Odd news", `${this.newsCands.length} live headlines ready.`);
        this.prepareQuick();
      })
      .catch(() => {});
  }

  /** "Who's playing?" Kids / Teens / Adults. Filters the stories and sets the DM's tone. Lobby only. */
  setRating(r: Rating) {
    if (this.state.phase !== "lobby" || !isRating(r)) return;
    const questOptions = questOptionsFor(r);
    this.set({ rating: r, questOptions });
    this.newsCands = [];
    this.quickPrep = null;
    this.votePrep = [];
    this.loadNews();
    if (this.seed && !questAllowed(this.seed.rating, r)) {
      this.seed = undefined;
      this.set({ questId: "", quest: undefined, scenes: [] });
    }
  }

  /**
   * The two join questions (both optional). The text stays on the TV: the wire only says "answered".
   * A usable answer becomes the hero's power / weakness right away (in code, no AI wait); the raw words come
   * back only at the reveal, in the "Solved by" line.
   */
  private onReal(pid: string, skill: unknown, fear: unknown) {
    const p = this.player(pid);
    if (!p || this.state.phase !== "lobby") return;
    const real = realOf({ skill, fear });
    this.reals[pid] = real;
    this.patchPlayer(pid, { real: { skill: "", fear: "" } });
    this.applyReal(pid);
    if (real.skill || real.fear) this.note("hero", p.hero?.name ?? p.name, "Answered the join questions. Their answers shape the hero's power and weakness, and stay private until the reveal.");
  }

  /** Turn a player's answers into their hero's power and weakness. Heavy answers are never used. */
  private applyReal(pid: string) {
    const p = this.player(pid);
    const real = this.reals[pid];
    if (!p?.hero || !real) return;
    const skill = HEAVY.test(real.skill) ? "" : skillPhrase(real.skill);
    const fear = HEAVY.test(real.fear) ? "" : fearPhrase(real.fear);
    if (!skill && !fear) return;
    const base = this.basePowers[pid] ?? (this.basePowers[pid] = { ability: p.hero.ability, flaw: p.hero.flaw });
    const hero: Hero = {
      ...p.hero,
      // Keep the hero's designed power (it matches their portrait); the player's knack joins it.
      ability: skill ? { name: base.ability.name, text: `${base.ability.text.replace(/[.!\s]+$/, "")}, with a secret strength: ${skill}.` } : base.ability,
      flaw: fear ? `Has the worst luck with ${fear}, at the worst moments.` : base.flaw,
    };
    this.patchPlayer(pid, { hero });
  }

  /** Pick a story by hand (the /tv?quest= link, the connector). A picked story skips the Full Story vote. */
  chooseQuest(id: string) {
    if (this.useQuest(id)) this.pinned = true;
  }

  private findSeed(id: string) {
    return SEEDS.find((s) => s.id === id) ?? this.builtSeeds.get(id);
  }

  private useQuest(id: string) {
    const seed = this.findSeed(id);
    if (!seed || !questAllowed(seed.rating, this.state.rating)) return false;
    this.seed = seed;
    this.sceneImages = {};
    this.artP.clear();
    this.sceneCopies.clear();
    this.set({ notes: { ...this.state.notes, safety: SAFETY_NOTES[seed.id] ?? SAFETY_GENERIC } });
    // Pre-painted plates, keyed by plate: 0 = scene 1, 1 = scene 2, 2 = the climax (also Quick Tale's scene).
    const pre = (questImages as Record<string, string[]>)[id] ?? [];
    pre.forEach((url, i) => url && (this.sceneImages[i] = url));
    // A live or personal story has no pre-painted plates: its scene is painted while the table votes.
    this.plateP.get(id)?.then((url) => {
      if (!url || this.state.questId !== id) return;
      [0, 1, 2].forEach((i) => (this.sceneImages[i] ??= url));
      this.set({});
    });
    this.set({
      questId: id,
      quest: {
        title: seed.quest_title,
        realm: "", // the real place waits for the reveal
        premise: seed.fairytale_premise,
        threat: seed.the_threat.name,
        goal: seed.the_goal.description,
        goalShort: shortGoal(seed.the_goal.description),
      },
      scenes: [],
    });
    return true;
  }

  /** The hand-written scenes this story plays (seed_quests.json), with a plain fallback for stories without them. */
  private seedScenes(seed: QuestSeed, quick: boolean): SeedScene[] {
    if (seed.opener) return [{ ...seed.opener, kind: quick ? "climax" : "hook" }];
    if (quick && seed.quick_scene) return [{ ...seed.quick_scene, kind: "climax" }];
    if (!quick && seed.scenes?.length === 3) return seed.scenes;
    const locs = seed.locations;
    const goal = shortGoal(seed.the_goal.description).replace(/…$/, "");
    const make = (kind: SeedScene["kind"], li: number, ci: number): SeedScene => ({
      kind,
      title: locs[li]?.name ?? seed.quest_title,
      location: locs[li]?.name ?? seed.realm_name,
      narration: `${locs[li]?.description ?? ""} ${seed.complications[ci]?.what_happens ?? ""}`.trim(),
      goal,
      situation: locs[li]?.description ?? "",
      npc_line: { speaker: "", line: "" },
    });
    if (quick) return [make("climax", locs.length - 1, 2)];
    return [make("hook", 0, 0), make("twist", Math.floor(locs.length / 2), 1), make("climax", locs.length - 1, 2)];
  }

  /** Which pre-painted plate is behind turn k: the story moves through the three plates as the turns go by. */
  private plateFor(k: number) {
    if (this.quick) return 2;
    const n = Math.max(1, this.state.turnOrder.length);
    return Math.min(2, Math.floor((k * 3) / (n + 1)));
  }

  /**
   * The art hook: paint the party's heroes into a plate (server/art via /api/scene-art, muse-image edits, ~15 s,
   * cached). Fires in the background; when it lands, the TV crossfades from the pre-painted plate to the new art.
   * Never blocks: a failure just keeps the plate.
   */
  private getSceneArt(plateIn: number) {
    if (!FEATURES.heroArt || !this.seed) return;
    const questId = this.seed.id;
    const plate = this.quick ? 2 : plateIn;
    const key = `${questId}:${plate}`;
    if (this.artP.has(key)) return;
    const heroes = this.heroes()
      .slice(0, 4)
      .map((p) => ({ id: p.pick ?? p.id, name: p.hero!.name, portraitUrl: p.pick ? heroPortrait(p.pick) : this.portraits[p.id], visual: p.hero!.visual }));
    if (!heroes.length) return;
    const t0 = Date.now();
    const built = this.builtSeeds.has(questId);
    const p = Promise.all([this.castP ?? Promise.resolve(null), built ? this.plateP.get(questId) ?? Promise.resolve(null) : Promise.resolve(null)])
      .then(([cast, base]) => {
        if (built && !base) throw new Error("no scene to paint into");
        return fetch("/api/scene-art", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questId,
            sceneIndex: this.quick ? "quick" : plate,
            heroes,
            rating: this.state.rating,
            style: cast?.art ?? "neon",
            ...(built ? { sceneUrl: base, sceneText: this.seed?.opener?.situation ?? "" } : {}),
          }),
        });
      })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { url?: string; fallback?: boolean; cached?: boolean } | null) => {
        if (!res?.url || res.fallback || this.state.questId !== questId) return;
        this.sceneImages[plate] = res.url;
        this.sceneCopies.delete(`${questId}:${plate}`);
        this.note("scene", "Scene art", `Painted by Muse Image: the heroes in the scene (${res.cached ? "cached" : `${Math.round((Date.now() - t0) / 1000)}s`}). The pre-painted scene showed until it was ready.`);
        this.set({});
      })
      .catch(() => {});
    this.artP.set(key, p);
  }

  canBegin() {
    const playing = this.state.players.some((p) => p.hero || p.status === "building");
    return playing && (this.quick ? !!this.seed || this.state.questOptions.length > 0 : this.state.questOptions.length > 0);
  }

  async begin() {
    if (!this.canBegin()) return;
    // Custom heroes that are still drawing come along: they finish in the background during the story vote.
    const players = this.state.players
      .filter((p) => p.hero || p.status === "building")
      .map((p) => ({ ...p, peril: "", abilityAvailable: true, heart: 1 as const, away: false }));
    const now = Date.now();
    players.forEach((p) => (this.lastSeen[p.id] = Math.max(this.lastSeen[p.id] ?? 0, now)));
    this.timeouts = {};
    this.awayWhy = {};
    this.reactionCounts = {};
    this.mirrorP.clear();
    this.mirrorFate.clear();
    this.endingFor = null;
    this.startedAt = Date.now();
    this.endedAt = 0;
    this.set({
      players,
      kicked: [], // a removed phone that never rejoined sees the game in progress, like any late phone
      sceneIndex: 0,
      wards: !this.quick && FEATURES.mirror ? this.assignWards(players.map((p) => p.id)) : {},
      mirrorMoments: {},
      mirror: [],
      mirrorIndex: 0,
      thanks: {},
      saves: [],
      hope: HOPE_START,
      log: [],
      wins: {},
      votes: {},
      winnerId: "",
      outcome: "",
      endingLine: "",
      recap: "",
      turnOrder: [],
      turnIndex: 0,
      ideas: {},
      finale: false,
      cast: null,
      voice: null,
      narrated: false,
      typing: [],
      paused: false,
      artKey: -1,
      solvedBy: "",
      round: null,
      final: null,
      finalMoves: {},
      epilogue: "",
      storybook: null,
      rescue: null,
      notes: { ...this.state.notes, source: null, canon: [], open: [] },
    });
    // Quick Tale (judge mode): the best hand-made story this table hasn't played. Full Story: the table votes,
    // unless one was picked by link.
    if ((this.quick || this.judge) && !this.pinned && this.state.source !== "ours") {
      const prep = this.quickPrep;
      const live = this.judge || !prep ? null : prep.seed ?? (await withTimeout(prep.p, 2000, () => null));
      if (live) {
        this.useQuest(live.id);
        this.quickPrep = null; // used: the next group gets a fresh one
        this.note("source", "Quick Tale", "Live story from today's news.");
      } else {
        this.useQuest(this.freshCurated());
        this.note("source", "Quick Tale", this.judge ? "Saved story (judge mode)." : "Saved story: the live one wasn't ready in time.");
      }
    }
    if (this.state.source === "ours") return this.startStoryWrite();
    if (!this.quick && !this.pinned && !this.judge) return this.startStoryVote();
    this.startStory();
  }

  /**
   * Mirror, Mirror: everyone secretly guards one other hero. A shuffled single cycle, so nobody gets themselves,
   * everyone has exactly one guardian, and nobody is picked more than anyone else. One player: no mirror.
   */
  private assignWards(ids: string[]): Record<string, string> {
    if (ids.length < 2) return {};
    const order = [...ids];
    for (let i = order.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return Object.fromEntries(order.map((id, i) => [id, order[(i + 1) % order.length]]));
  }

  // ---------- story vote (Full Story) ----------
  /**
   * Three stories, every phone taps one (15 s), ties broken at random. Odd news: three live headlines (each one's
   * opener is written and its scene painted while people vote); curated stories when live news is missing.
   */
  private async startStoryVote(given?: { id: string; title: string; teaser: string }[]) {
    let storyOptions = given ?? [];
    if (!given) {
      const live = FEATURES.liveNews ? await this.liveVoteOptions() : [];
      if (this.state.phase !== "story_vote" && this.state.phase !== "lobby") return;
      if (live.length) {
        // Live quests first; any empty card is a curated quest (never a story that didn't pass the gate).
        const fill = shuffle(this.state.questOptions).slice(0, Math.max(0, 3 - live.length));
        storyOptions = [...live, ...fill];
        this.note("source", "Odd news", `${live.length} quest${live.length > 1 ? "s" : ""} from this week's real news${fill.length ? ` and ${fill.length} curated` : ""}. The real headlines stay hidden until the reveal.`);
      } else {
        if (this.votePrep.length) this.note("fallback", "Backup used", "The live quests weren't written in time, so curated quests stand in.");
        storyOptions = shuffle(this.state.questOptions).slice(0, 3);
      }
    }
    if (storyOptions.length < 2) return this.playOption(storyOptions[0]?.id ?? this.state.questOptions[0]?.id);
    this.set({ phase: "story_vote", storyOptions, votes: {}, ready: [] });
    // Each option's narrator and opener audio get ready during the vote, so the winner starts voiced.
    for (const o of storyOptions) this.prewarm(this.builtSeeds.get(o.id) ?? this.findSeed(o.id));
    this.setTimer(STORY_VOTE_MS, () => this.endStoryVote());
  }

  /** Play the chosen option: a curated story right away, or a live/personal one once its opener is written. */
  private async playOption(optionId: string) {
    if (this.findSeed(optionId) && !this.openerP.has(optionId)) {
      this.useQuest(optionId);
      return this.startStory();
    }
    const p = this.openerP.get(optionId);
    if (p) {
      // A player's own story is worth the wait (the writer takes 20-40 s); a news story falls back sooner.
      const ours = optionId.startsWith("ours-");
      this.set({ busy: ours ? "Writing your story…" : "Writing tonight's story…" });
      let seed = await withTimeout(p, ours ? 40_000 : 15_000, () => null);
      this.set({ busy: "" });
      if (!seed && ours) {
        const local = this.ourFallback.get(optionId)?.();
        if (local) {
          this.builtSeeds.set(local.id, local);
          this.note("fallback", "Story writer", "The writer was slow, so their story plays from their own words.");
          seed = local;
        }
      }
      if (seed) {
        this.note("source", "Story writer", seed.author ? "Opener written from their true story; the real ending is kept for the reveal." : "Opener written from the article's facts only.");
        this.useQuest(seed.id);
        return this.startStory();
      }
      this.note("fallback", "Backup used", "That story couldn't be written in time, so a curated story stands in.");
    }
    const allowed = this.state.questOptions;
    this.useQuest(allowed[randInt(allowed.length)].id);
    this.startStory();
  }

  /** Everyone in the game votes on the story, even someone whose custom hero is still being drawn. */
  private storyVoters() {
    return this.state.players.filter((p) => !p.away);
  }

  private endStoryVote() {
    if (this.state.phase !== "story_vote") return;
    this.clearTimer();
    const opts = this.state.storyOptions;
    const count = (id: string) => Object.values(this.state.votes).filter((v) => v === id).length;
    const top = Math.max(...opts.map((o) => count(o.id)));
    const best = opts.filter((o) => count(o.id) === top);
    const pick = best[randInt(best.length)];
    const tally = opts.map((o) => `"${o.title}" ${count(o.id)}`).join(", ");
    this.note("source", "Story vote", `${tally}. ${best.length > 1 ? "Tie, broken at random (no AI pick, no unfair advantage)." : "Most votes wins."}`);
    this.playOption(pick.id);
  }

  // ---------- the story ----------
  /**
   * Fixed start, fixed goal, open middle (design/24). The opener is hand-written; the goal is the story's final goal;
   * after that every turn's outcome moves the story on.
   */
  private startStory() {
    const seed = this.seed!;
    const quick = this.quick;
    const scenes = this.seedScenes(seed, quick);
    const opener = scenes[0];
    const goal = scenes[scenes.length - 1].goal;
    this.sceneList = [{ ...opener, goal }];
    this.rememberStory(seed);
    this.turnArt.clear();
    this.seenArt.clear();
    this.quipsSaid = [];
    // Where the heroes are: the real kind of place (never a real place name, which would leak into story_so_far).
    const placeType = typeof seed.real_event?.place_type === "string" ? (seed.real_event.place_type as string) : "";
    this.story = null;
    this.finaleNext = false;
    this.set({
      scenes: [{ kind: "hook", location: opener.location, description: opener.situation, twist: "", hasImage: !!this.sceneImages[this.plateFor(0)] }],
      turnOrder: this.makeTurnOrder(),
      turnIndex: 0,
      ideas: {},
      finale: false,
      cast: null,
      voice: null,
      narrated: false,
      typing: [],
      paused: false,
      artKey: -1,
    });
    // No script (design/35): the state comes from the opener; every turn's plan is what happens, the roll sets
    // how well, and the engine (code) applies it. The finale comes at 100 or when the turns run out.
    this.story = stateFromOpener(
      {
        ...opener,
        goal,
        // A plain problem name ("the ice hand"), never the invented title ("The Ice Age Grip").
        problem: { name: (quick && seed.quick_scene?.problem_name) || seed.the_threat.name, stakes: seed.problem?.stakes ?? "" },
        real_setting: seed.real_event,
        // Story v3: the starting problem (the reveal refers back to it) and the pressures (the live opener writes them).
        original_problem: seed.original_problem,
        pressures: seed.pressures,
        // Quick Tale's opener already answers the full story's first mystery, so its first step comes from the quick scene.
        beats: quick && seed.quick_scene?.first_step ? [seed.quick_scene.first_step] : seed.beats ?? (seed.scenes ?? []).map((sc) => sc.goal),
      },
      this.heroes().map((p) => ({ name: p.hero!.name, pronouns: p.hero!.pronouns })),
      this.state.turnOrder.length,
    );
    this.set({ ladder: [], step: 0, progress: 0, act: 1 });
    if (FEATURES.storyV3)
      this.note(
        "scene",
        "The story",
        `It starts with: ${this.story.original_problem || this.story.problem}. Suggested goal: ${this.story.finish_line} (players can go anywhere). Every success settles the situation for good and the story moves on; ${(this.story.pressures ?? []).map((p) => p.name).join(", ")} get worse on their own. The meter is a story clock: Act 1, 2, 3, then the finale.`,
      );
    else this.note("scene", "The finish line", `${this.story.finish_line}. No script: every turn's plan is what happens, and the roll sets how well. Progress fills from 0 to 100 over 3 acts.`);
    this.note("safety", "Why it's safe", SAFETY_NOTES[seed.id] ?? SAFETY_GENERIC);
    this.note(
      "source",
      "The story",
      seed.author
        ? `A true story from someone at this table. Who wrote it, and how it really ended, stays hidden until the reveal.`
        : quick
        ? `Quick Tale built from a real news story. The headline stays hidden until the end so it can't spoil anything.`
        : `Built from a real news story${seed.category ? ` (${seed.category.replace(/_/g, " ")})` : ""}. The headline stays hidden until the end so it can't spoil the twist.`,
    );
    const n = this.state.turnOrder.length;
    const owners = new Set(this.state.turnOrder).size; // people who own turns (humans; test players only suggest)
    this.note("turn", "Turns", `${n} turns (${owners} ${owners === 1 ? "player" : "players"} × ${owners ? Math.round(n / owners) : 0}), then the grand finale. The opener and the goal were written by the team; the AI writes what each action does.`);
    this.set({ phase: "quest", sceneIndex: 0, narration: "", sceneTitle: "", goal: "", ready: [], cast: null, voice: null, busy: "" });
    this.getSceneArt(0);
    this.askCast(seed);
    this.openerAsked = Date.now();
    this.voiceFor(this.openerLine(opener));
    const ms = TITLE_CARD_MS; // a title card for every story: the real headline waits for the reveal
    this.setTimer(ms, () => this.openStory());
  }

  private openerAsked = 0;


  private cleanSkills: Record<string, string> | null = null;

  /** What the narrator says when a turn starts: the owner's name, then where things stand. */
  private turnLine(_owner: string) {
    return this.state.situation; // the scene line already names whose turn it is (design/35 hand-off)
  }

  /** Turn order: everyone in join order, repeated. 2-4 people get 2 turns each, 5+ get 1 (every mode). */
  private makeTurnOrder() {
    const all = this.heroes().map((p) => p.id);
    const humans = all.filter((id) => !this.bots.isBot(id));
    // Test players only own turns when no human is playing (they still suggest ideas).
    const ids = humans.length ? humans : all;
    // Judge mode (/tv?judge=1, ~5 min): 1 turn each, at most 3 turns, then the finale everyone plays.
    if (this.judge) return ids.slice(0, 3);
    // Quick Tale (~5 min, CD Sun): 1 turn each, then the finale.
    if (this.quick) return ids;
    // Full Story: 2-4 people get 2 turns each; 5+ get 1 each. Counted from the people who own turns, never the bots.
    const cycles = ids.length >= 5 ? 1 : 2;
    return Array.from({ length: cycles }, () => ids).flat();
  }

  private isFinal() {
    return this.state.finale;
  }

  /** The hand-written opener: read aloud (if the voice is ready) while it reveals line by line. Space skips. */
  /** The finale's build-up or payoff sound (one id from the ending call). Off unless FEATURES.storySfx. */
  private cueFinale(kind: "buildup" | "payoff", id?: string) {
    const ok = pickStorySfx(id);
    if (!FEATURES.storySfx || !ok) return;
    this.set({ sfx: { id: ok, cues: [{ id: ok, word: 0 }], at: Date.now(), kind } });
    this.note("scene", "Sound", `Muse picked the finale ${kind === "buildup" ? "build-up" : "payoff"}: ${ok}`);
  }

  /** The slide's sound cues (CD): Muse picked 1-3 in the turn or ending call; the TV plays them in order. Off unless FEATURES.storySfx. */
  private playStorySfx(x?: unknown) {
    const cues = pickStorySfxCues(x);
    if (!FEATURES.storySfx || !cues.length) return;
    this.set({ sfx: { id: cues[0].id, cues, at: Date.now(), kind: "line" } });
    this.note("scene", "Sound", `Muse picked: ${cues.map((c) => c.id).join(", then ")}`);
  }

  private async openStory() {
    this.clearTimer();
    const sc = this.sceneList[0];
    if (!sc) return;
    // The opener's audio was asked for at the title card; wait at most 5 s from then, else text only.
    const clip = await this.voiceBy(this.openerLine(sc), this.openerAsked + 8500);
    if (this.state.phase !== "quest") return;
    this.set({
      phase: "narrating",
      sceneIndex: 0,
      sceneTitle: sc.title,
      goal: sc.goal,
      nowGoal: this.story?.right_now ?? "", // the first step, from the opener
      narration: sc.narration,
      situation: sc.situation,
      npcLine: sc.npc_line ?? { speaker: "", line: "" },
      question: sc.goal,
      pitches: [],
      votes: {},
      winnerId: "",
      outcome: "",
      rolls: [],
      revealed: [],
      round: null,
      ready: [],
      busy: "",
    });
    this.note("scene", "The opener", `"${sc.title}". Goal for the whole story: ${end(sc.goal)}`);
    // The judge stories carry their opener's sound effect in the seed (quick_scene.sfx).
    this.playStorySfx((sc as { sfx?: string }).sfx);
    const first = this.state.turnOrder[0];
    if (first) void this.voiceFor(this.turnLine(first));
    const spoken = this.play(clip, TITLE_BEAT_MS);
    const ms = spoken ? TITLE_BEAT_MS + spoken + 1200 : narrationMs(sc.narration, sc.npc_line?.line ?? "");
    this.setTimer(ms, () => this.startTurn(0));
  }

  // ---------- turns: one owner, everyone else suggests ----------
  private turnMs() {
    return this.quick ? QUICK_TURN_MS : TURN_MS;
  }

  /** The owner of turn i, skipping anyone who's away (they can come back later). Past the last turn: the finale. */
  private startTurn(i: number) {
    this.clearTimer();
    this.set({ voice: null });
    this.giveLateHeroes();
    const order = this.state.turnOrder;
    let k = i;
    while (k < order.length && (!this.player(order[k])?.hero || this.player(order[k])?.away)) {
      this.note("turn", this.heroName(order[k]), "Away, so their turn is skipped. They can jump back in any time.");
      k++;
    }
    if (k >= order.length) return this.startFinale();
    if (this.finaleNext) {
      this.note("turn", "Grand finale", FEATURES.storyV3 ? "The story clock ran out, so the finale comes now." : "The finish line is in reach, so the finale comes now.");
      return this.startFinale();
    }
    this.verdicts.clear();
    this.preRuled.clear();
    const owner = order[k];
    this.set({ phase: "turn", turnIndex: k, ideas: {}, pitches: [], votes: {}, winnerId: "", outcome: "", rolls: [], revealed: [], ready: [], busy: "", typing: [] });
    this.setTimer(this.turnMs(), () => this.endTurn(true));
    this.armNudge("turn", this.turnMs(), () => [owner]);
    // "Jay, the lodger is…": the narrator reads the turn start if the clip is ready (it was asked for with the outcome).
    const line = this.turnLine(owner);
    // The clock restarts once the narrator has finished the line (CD playtest: "is it my turn?" while it was still
    // talking), so the turn owner always gets the full time after the story stops speaking.
    this.voiceBy(line, Date.now() + 4000).then((clip) => {
      if (this.state.phase !== "turn" || this.state.turnIndex !== k) return;
      const ms = this.play(clip);
      if (ms) {
        this.setTimer(this.turnMs() + ms, () => this.endTurn(true));
        this.armNudge("turn", this.turnMs() + ms, () => [owner]);
      }
    });
    this.note("turn", this.heroName(owner), `Turn ${k + 1} of ${order.length}. Everyone else can suggest one action; ${this.heroName(owner)} picks.`);
  }

  /** Whose turn is next (skipping anyone away), for the hand-off line. "" before the finale. */
  private nextOwner() {
    const order = this.state.turnOrder;
    for (let k = this.state.turnIndex + 1; k < order.length; k++) if (this.player(order[k])?.hero && !this.player(order[k])?.away) return order[k];
    return "";
  }

  private owner() {
    return this.state.turnOrder[this.state.turnIndex] ?? "";
  }

  private typingAt: Record<string, number> = {};

  /** "Marvin is typing…": phones say so while someone writes a plan or an idea, so the TV is never just a clock. */
  private onTyping(pid: string) {
    if (!["turn", "pitch"].includes(this.state.phase) || !this.player(pid)?.hero) return;
    this.typingAt[pid] = Date.now();
    if (!this.state.typing.includes(pid)) this.set({ typing: [...this.state.typing, pid] });
  }

  private pruneTyping() {
    const now = Date.now();
    const typing = this.state.typing.filter((pid) => now - (this.typingAt[pid] ?? 0) < 4000);
    if (typing.length !== this.state.typing.length) this.set({ typing });
  }

  /** A friend's suggestion for the turn owner (one action, ~140 characters). They can change it until the owner picks. */
  private onIdea(pid: string, text: string) {
    if (this.state.phase !== "turn" || pid === this.owner() || !this.player(pid)?.hero) return;
    const clean = cleanPlan(text);
    if (!clean) return;
    this.set({ ideas: { ...this.state.ideas, [pid]: clean }, typing: this.state.typing.filter((x) => x !== pid) });
    // Generate ahead: rule the idea now, as the owner's plan with this friend's credit, so if the owner takes it as
    // written the plan card shows the moment they press Go (the "DM is reading" wait was 5-15 s in the CD playtest).
    // Guards (fresh-eyes review): edits are debounced (1.5 s of quiet), and at most 2 ideas a turn are ruled ahead,
    // so a busy table never floods Muse at judging hour.
    const owner = this.owner();
    const turn = this.state.turnIndex;
    clearTimeout(this.preRuleTimers[pid]);
    this.preRuleTimers[pid] = setTimeout(() => {
      if (this.state.phase !== "turn" || this.state.turnIndex !== turn || this.state.ideas[pid] !== clean) return;
      if (!owner || this.preRuled.has(norm(clean)) || this.preRuled.size >= 2) return;
      this.preRuled.set(norm(clean), this.askRuling({ id: `pre-${pid}`, playerId: owner, text: clean, useAbility: false, embraceFlaw: false, creditId: pid, idea: clean }));
    }, 1500);
  }

  private preRuleTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  /** The storyteller's quips spoken this game (sent to the ruling so it varies them). */
  private quipsSaid: string[] = [];

  /** Rulings started early on friends' ideas (by their text), for the current turn only. */
  private preRuled = new Map<string, Promise<Verdict>>();

  /** The owner picks: their own words, or a friend's suggestion (maybe edited). Using a friend's idea is +1 and credited. */
  private onPitch(pid: string, text: string, creditId = "", own?: unknown, idea?: unknown) {
    const s = this.state;
    if (s.phase === "turn") {
      if (pid !== this.owner()) return this.onIdea(pid, text);
      const clean = cleanPlan(text);
      if (!clean) return;
      const credit = creditId && creditId !== pid && s.ideas[creditId] ? creditId : "";
      // Both parts travel to the writer as the player wrote them (their nouns and jokes intact).
      const parts = { own: cleanPlan(own) || undefined, idea: credit ? cleanPlan(idea) || s.ideas[credit] : undefined };
      return this.takePlan({ id: `t${s.turnIndex}-${pid}`, playerId: pid, text: clean, useAbility: false, embraceFlaw: false, creditId: credit || undefined, ...parts });
    }
    if (s.phase !== "pitch") return;
    if (!this.player(pid)?.hero || s.pitches.some((p) => p.playerId === pid)) return;
    const clean = cleanPlan(text);
    if (!clean) return;
    const pitch: Pitch = { id: `f-${pid}`, playerId: pid, text: clean, useAbility: false, embraceFlaw: false };
    this.set({ pitches: [...s.pitches, pitch] });
    // No visible loading: every finale plan is ruled the moment it's sent, so the winner's ruling is ready when the vote ends.
    const vp = this.askRuling(pitch);
    this.verdicts.set(pitch.id, vp);
    vp.then((v) => this.set({ pitches: this.state.pitches.map((x) => (x.id === pitch.id ? { ...x, verdict: v } : x)) }));
    if (this.allPresent((id) => this.state.pitches.some((x) => x.playerId === id))) this.endPitch();
  }

  private takePlan(pitch: Pitch) {
    if (this.state.phase !== "turn") return;
    this.clearTimer();
    this.set({ pitches: [pitch] });
    const ideas = Object.keys(this.state.ideas).length;
    const from = pitch.creditId ? `, working in ${this.heroName(pitch.creditId)}'s idea (+1)` : ideas ? `, their own idea (${ideas} suggestion${ideas > 1 ? "s" : ""} offered)` : "";
    this.note("turn", this.heroName(pitch.playerId), `Picked a plan${from}.`);
    this.startRuling(pitch);
  }

  /** Time's up: the owner goes with the first friend's idea, or, with none, the turn passes. */
  private endTurn(timedOut = false) {
    if (this.state.phase !== "turn") return;
    const owner = this.owner();
    if (timedOut) this.timedOut([owner]);
    const first = Object.entries(this.state.ideas)[0];
    if (first) {
      this.note("turn", this.heroName(owner), `Out of time, so ${this.heroName(first[0])}'s suggestion goes ahead.`);
      return this.takePlan({ id: `t${this.state.turnIndex}-${owner}`, playerId: owner, text: first[1], useAbility: false, embraceFlaw: false, creditId: first[0], auto: true });
    }
    this.note("turn", this.heroName(owner), "Out of time and no suggestions, so the turn passes.");
    this.startTurn(this.state.turnIndex + 1);
  }

  /** A custom hero still drawing when play starts gets a ready-made one, so nobody ever waits on a portrait. */
  private giveLateHeroes() {
    this.state.players
      .filter((p) => !p.hero)
      .forEach((p) => {
        const taken = new Set(this.state.players.map((o) => o.pick).filter(Boolean));
        const q = QUICK_HEROES.find((h) => !taken.has(h.id)) ?? QUICK_HEROES[0];
        this.portraits[p.id] = heroPortrait(q.id);
        this.patchPlayer(p.id, { status: "ready", pick: q.id, hero: { ...structuredClone(q.hero), stats: evenStats(q.hero.stats) }, hasPortrait: true });
        this.applyReal(p.id);
        this.note("hero", q.hero.name, `${p.name}'s custom hero wasn't ready, so they play a ready-made one. Nobody waits.`);
        thumbnail(heroPortrait(q.id)).then((t) => {
          if (!t) return;
          this.thumbs[p.id] = t;
          this.t.send({ type: "portrait", pid: p.id, url: t });
          this.set({});
        });
      });
  }

  // ---------- the grand finale: everyone proposes, everyone votes (not your own), one shared die ----------
  private startFinale() {
    this.clearTimer();
    this.verdicts.clear();
    // v3: the finale is the moment of truth for the situation as it is NOW, never a snap back to the original goal.
    this.set({ phase: "pitch", finale: true, nowGoal: FEATURES.storyV3 ? this.story?.right_now || this.state.nowGoal : this.state.goal, pitches: [], votes: {}, winnerId: "", outcome: "", rolls: [], revealed: [], ready: [], busy: "", typing: [] });
    this.note("turn", "Grand finale", "Everyone proposes the final move, everyone backs a friend's plan (never their own), and the winning plan gets one shared die.");
    const line = `Alright, everyone… time for the grand finale. ${this.state.situation} So. What's the final move?`;
    this.voiceBy(line, Date.now() + 4000).then((clip) => this.state.phase === "pitch" && this.play(clip));
    this.setTimer(this.turnMs(), () => this.endPitch(true));
    this.armNudge("pitch", this.turnMs(), () => this.present().filter((h) => !this.state.pitches.some((x) => x.playerId === h.id)).map((h) => h.id));
  }

  private endPitch(timedOut = false) {
    if (this.state.phase !== "pitch") return;
    this.clearTimer();
    const missing = this.heroes().filter((h) => !this.state.pitches.some((p) => p.playerId === h.id));
    if (timedOut) this.timedOut(missing.filter((h) => !h.away).map((h) => h.id));
    let el = this.eligible();
    if (!el.length) {
      // Nobody typed anything: someone still has to do something.
      const h = this.present()[0] ?? this.heroes()[0];
      const fill: Pitch = { id: `f-${h.id}`, playerId: h.id, text: "goes for it, all in", useAbility: false, embraceFlaw: false, auto: true };
      this.set({ pitches: [...this.state.pitches, fill] });
      this.verdicts.set(fill.id, this.askRuling(fill));
      el = [fill];
    }
    if (missing.length) this.note("ruling", "Final plans", `${this.state.pitches.length} of ${this.heroes().length} plans in.`);
    const voters = this.planVoters(el);
    if (el.length === 1 || !voters.length) {
      this.note("ruling", "The vote", el.length === 1 ? "Only one final plan, so no vote." : "Nobody else could back a plan, so no vote.");
      return this.startRuling(el[0]);
    }
    if (FEATURES.finaleTalk) return this.startConvince();
    this.startVote();
  }

  private startVote() {
    this.set({ phase: "vote", votes: {}, ready: [] });
    this.setTimer(this.quick ? 12_000 : VOTE_MS, () => this.endVote(true));
    this.armNudge("vote", this.quick ? 12_000 : VOTE_MS, () => this.planVoters().filter((p) => !this.state.votes[p.id]).map((p) => p.id));
  }

  /**
   * "Convince each other" (CD, Sun): before the final vote, 60 s for the table to argue for their plans out loud.
   * Everyone's plan is on screen (state.pitches); phones send "ready"; everyone ready = straight to the vote.
   */
  private startConvince() {
    this.set({ phase: "convince", ready: [] });
    const talkMs = this.judge ? 30_000 : CONVINCE_MS; // judge mode keeps the demo short
    this.setTimer(talkMs, () => this.endConvince());
    this.armNudge("convince", talkMs, () => this.present().filter((p) => !this.state.ready.includes(p.id)).map((p) => p.id));
    // Pre-voiced by the voice session (exact text = a cache hit).
    const said = this.judge ? "Alright. You've got thirty seconds. Convince each other." : "Alright. You've got one minute. Convince each other.";
    this.voiceBy(said, Date.now() + 3000).then((clip) => this.state.phase === "convince" && this.play(clip));
    this.note("ruling", "Convince each other", "One minute to talk the table into your plan. Everyone taps Ready to vote, or the minute runs out.");
  }

  private nudgeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Time warning (CD): ~10 s before an input deadline, if someone still hasn't sent, state.nudge names the slow player
   * (only when it's exactly one) and the voice session plays a pre-voiced nudge, never twice in a row, never over the
   * narrator. Re-arming replaces the last one; a phase change cancels it.
   */
  private armNudge(kind: "turn" | "idea" | "pitch" | "vote" | "convince", totalMs: number, slow: () => string[]) {
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.nudgeTimer = null;
    if (totalMs < 15_000) return;
    const phase = this.state.phase;
    const turn = this.state.turnIndex;
    this.nudgeTimer = setTimeout(() => {
      if (this.state.phase !== phase || this.state.turnIndex !== turn || this.state.paused) return;
      const who = slow().filter((id) => this.player(id) && !this.player(id)!.away);
      if (!who.length) return;
      const name = who.length === 1 ? this.heroName(who[0]) : "";
      // nudge = look's "10 s!" chip; timeWarn = voice's spoken warning (a live "<Name>, ten seconds." when one person).
      this.set({ nudge: { at: Date.now(), kind, name }, timeWarn: { at: Date.now(), ...(name ? { name } : {}) } });
    }, totalMs - 10_000);
  }

  private endConvince() {
    if (this.state.phase !== "convince") return;
    this.clearTimer();
    this.startVote();
  }

  /** Finale plans that can win: every plan someone actually made. */
  private eligible(): Pitch[] {
    return this.state.pitches.filter((p) => !p.auto || this.state.pitches.every((x) => x.auto));
  }

  /** Who backs a plan: everyone here who has a friend's plan they can back (never their own). */
  private planVoters(el = this.eligible()) {
    return this.present().filter((p) => el.some((x) => x.playerId !== p.id));
  }

  private onVote(pid: string, id: string) {
    const s = this.state;
    if (s.phase === "story_vote") {
      if (!s.storyOptions.some((o) => o.id === id) || !this.player(pid)) return;
      const votes = { ...s.votes, [pid]: id };
      this.set({ votes });
      if (this.storyVoters().every((p) => votes[p.id])) this.endStoryVote();
      return;
    }
    if (s.phase !== "vote") return;
    const target = this.eligible().find((p) => p.id === id);
    if (!target || target.playerId === pid || !this.player(pid)?.hero) return;
    const votes = { ...s.votes, [pid]: id };
    this.set({ votes });
    if (this.planVoters().every((p) => votes[p.id])) this.endVote();
  }

  private endVote(timedOut = false) {
    if (this.state.phase !== "vote") return;
    this.clearTimer();
    const el = this.eligible();
    if (timedOut) this.timedOut(this.planVoters(el).filter((p) => !this.state.votes[p.id]).map((p) => p.id));
    const count = (id: string) => Object.values(this.state.votes).filter((v) => v === id).length;
    const top = Math.max(...el.map((p) => count(p.id)));
    const best = el.filter((p) => count(p.id) === top);
    const winner = best[randInt(best.length)];
    const tally = el.map((p) => `${this.heroName(p.playerId)} ${count(p.id)}`).join(", ");
    this.note("ruling", "The vote", `Backs: ${tally}.${best.length > 1 ? " Tie, broken at random." : ""} ${this.heroName(winner.playerId)}'s plan is the final move.`);
    // A tie is announced, never silent (CD: "how is it randomly choosing?").
    if (best.length > 1) {
      const said = `Tie! ${this.heroName(winner.playerId)}'s plan wins the coin flip.`;
      this.set({ banner: said });
      this.voiceBy(said, Date.now() + 2500).then((clip) => this.play(clip));
    }
    this.startRuling(winner);
  }

  // ---------- the DM rules on the plan, literally ----------
  private askRuling(pitch: Pitch): Promise<Verdict> {
    const p = this.player(pitch.playerId)!;
    const h = p.hero!;
    const fb = (): Verdict => this.verdictFallback(pitch);
    return this.viaAI(
      `Ruling on ${h.name}'s plan`,
      this.ask<Partial<Verdict>>("verdict", {
        scene: { title: this.state.sceneTitle, goal: this.story?.right_now || this.state.nowGoal || this.state.goal, final_goal: this.story?.finish_line || this.state.goal, situation: this.state.situation, who_is_there: this.sceneList[0]?.npc_line?.speaker ?? "" },
        finale: this.state.finale,
        hero: { name: h.name, best_stat: bestStat(h), stats: h.stats, power: h.ability?.text ?? "", weakness: h.flaw },
        plan: pitch.text,
        own_words: pitch.own,
        friend_idea: pitch.idea,
        earlier: this.state.log.map((l) => `${l.hero} (${l.band}): ${l.narration}`).slice(-4),
        story_so_far: this.storySoFar(),
        real_event: this.seed?.real_event,
        pronouns: this.pronounMap(),
        quips_so_far: this.quipsSaid.slice(-4), // so the storyteller never repeats a shape
      }),
      10_000,
      (d, f): Verdict | null => (f || !d?.tier ? fb() : { ...fb(), ...d, fallback: false, interpretation: d.interpretation || `${h.name} tries their plan` }),
      fb,
    );
  }

  private verdictFallback(pitch: Pitch): Verdict {
    const p = this.player(pitch.playerId);
    return {
      interpretation: `${p?.hero?.name ?? "The hero"} tries their plan`,
      fallback: true,
      stat: bestStat(p?.hero),
      tier: "solid",
      ability_fits: false,
      flaw_walk_in: false,
      quip: "",
      on_success: "",
      on_failure: "",
      moderation: "ok",
      reason: "Backup ruling: the AI didn't answer in time, so it counts as Solid",
    };
  }

  private async startRuling(pitch: Pitch) {
    this.clearTimer();
    this.set({ phase: "ruling", winnerId: pitch.id, busy: "" });
    const turn = this.state.turnIndex;
    const finale = this.state.finale;
    const vp = this.verdicts.get(pitch.id) ?? (!finale ? this.preRuled.get(norm(pitch.text)) : undefined) ?? this.askRuling(pitch);
    this.verdicts.set(pitch.id, vp);
    let settled = false;
    vp.then(() => (settled = true));
    // Only if the ruling isn't already in, say so after a moment.
    setTimeout(() => !settled && this.state.phase === "ruling" && this.set({ busy: "The DM is reading the plan…" }), 600);
    const asked = Date.now();
    const v = await vp;
    console.info(`[wait] ruling ${Date.now() - asked}ms (${finale ? "finale" : `turn ${turn + 1}`})`);
    if (this.state.phase !== "ruling" || this.state.turnIndex !== turn || this.state.finale !== finale) return;
    const judged = { ...pitch, verdict: v };
    this.noteRuling(judged, v);
    // The die is decided now (crypto, in code), so the outcome is written while the table watches the roll.
    const roll = this.makeRoll(judged);
    this.set({ pitches: this.state.pitches.map((x) => (x.id === pitch.id ? judged : x)), busy: "", rolls: [{ ...roll, dice: [], kept: 0 }], revealed: [] });
    // The storyteller's quip on the plan (CD): spoken over the plan card while the die is thrown, every other turn
    // (or before a 20 or a 1), only if it passes the plain-words check; otherwise silence. It comes free with the ruling.
    const hero = this.player(pitch.playerId)?.hero?.name ?? "";
    const quip = String(v.quip ?? "").trim();
    if (!finale && quip && (turn % 2 === 0 || roll.kept === 20 || roll.kept === 1) && quipOk(quip, hero)) {
      this.note("ruling", "Storyteller", `"${quip}" (said while the die is thrown)`);
      this.quipsSaid.push(quip);
      this.voiceBy(quip, Date.now() + 2500).then((clip) => ["ruling", "roll"].includes(this.state.phase) && this.state.turnIndex === turn && this.play(clip));
    }
    if (finale) return this.setTimer(this.judge ? 1800 : this.quick ? 2800 : RULING_MS, () => this.startFinalRoll(judged, roll));
    this.pendingRoll = roll;
    this.outcomeAt = 0;
    // design/35: ONE turn call, started the moment the plan is ruled (hidden behind the plan card, the throw and
    // the meter), with the player's own words.
    this.turnP = this.turnFor(judged, roll);
    this.turnP.then((d) => {
      this.outcomeAt = Date.now();
      this.castLine(d.outcome, d.lines);
      this.voiceFor(d.outcome);
      // A new painting every turn (CD, Sun): what just happened, in the place the story has moved to. A new act or
      // the finale frames the whole party; any other turn frames the hero and the friend whose idea it was.
      this.paintDecision(judged, v, d.outcome, d.scene || this.state.situation, d.finale ? "finale" : d.act_changed ? "act" : "win");
      if (d.scene) this.voiceFor(d.finale || !this.nextOwner() ? `Alright, everyone… time for the grand finale. ${d.scene} So. What's the final move?` : d.scene);
    });
    this.setTimer(this.judge ? 1800 : this.quick ? 2200 : RULING_MS, () => this.startRoll());
  }

  /**
   * design/24 P4: every decision gets a new painting. The moment the plan is ruled (1-2 s after the owner picks),
   * muse-image edits the CURRENT picture: the heroes, doing this action, in this situation. ~15 s; the outcome shows
   * over the previous art and the TV crossfades when it lands. Never waited on. Steered plans are never painted.
   */
  private paintDecision(pitch: Pitch, v: Verdict, moment = v.interpretation, where = this.state.situation, beat: "act" | "win" | "finale" = "finale") {
    if (!FEATURES.heroArt || !this.seed || v.moderation !== "ok") return;
    const questId = this.seed.id;
    const plate = this.plateFor(this.state.turnIndex);
    const prev = this.sceneImages[this.state.artKey] ?? this.sceneImages[plate];
    // A new act or the finale shows the whole party (up to 4); a win shows the hero and the friend whose idea it was.
    const inShot = beat !== "win" ? null : new Set([pitch.playerId, pitch.creditId].filter(Boolean));
    const heroes = this.heroes()
      .filter((p) => !inShot || inShot.has(p.id))
      .slice(0, 4)
      .map((p) => ({ id: p.pick ?? p.id, name: p.hero!.name, portraitUrl: p.pick ? heroPortrait(p.pick) : this.portraits[p.id], visual: p.hero!.visual }));
    if (!heroes.length || !prev) return;
    const t0 = Date.now();
    const asked = this.artSeq;
    const forTurn = this.state.finale ? -1 : this.state.turnIndex;
    fetch("/api/scene-art", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questId,
        sceneIndex: this.quick ? "quick" : plate,
        heroes,
        rating: this.state.rating,
        sceneUrl: prev,
        sceneText: where,
        // A different camera every time, so consecutive pictures never look like the same shot.
        moment: `${moment} Camera: ${SHOTS[this.artSeq % SHOTS.length]}.`,
        style: this.state.cast?.art ?? "neon",
        newScene: true,
        beat,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (res: { url?: string; fallback?: boolean; error?: string } | null) => {
        if (res?.fallback && /policy|safety|moderation/i.test(res.error ?? "")) {
          // The image filter refused (usually a hero's description): try once more with plain, generic looks.
          res = await fetch("/api/scene-art", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questId,
              sceneIndex: this.quick ? "quick" : plate,
              heroes: heroes.map((h) => ({ ...h, id: `${h.id}-plain`, name: "", visual: "a friendly cartoon hero in everyday clothes" })),
              rating: this.state.rating,
              sceneUrl: prev,
              sceneText: where,
              moment: "the heroes try their plan",
              style: this.state.cast?.art ?? "neon",
              newScene: true,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
        }
        if (!res?.url || res.fallback || this.state.questId !== questId || this.state.phase === "lobby") return;
        // Paintings land in order; a slow older one never replaces a newer one.
        if (asked < this.lastArtAsked) return;
        this.lastArtAsked = asked;
        const key = this.artSeq++;
        this.sceneImages[key] = res.url;
        this.turnArt.set(forTurn, res.url);
        // Landed while its own turn's result is still up: that's the picture the table saw for this move.
        if (forTurn >= 0 && this.state.turnIndex === forTurn && this.state.phase === "outcome") this.seenArt.set(forTurn, res.url);
        // Phones' "live on the TV" thumbnail: a small copy (the full painting is too big to broadcast).
        if (!res.url.startsWith("data:")) this.set({ sceneArt: res.url });
        else thumbnail(res.url, 240, 0.6).then((t) => this.state.questId === questId && t && this.set({ sceneArt: t }));
        this.note("scene", "Scene art", `Painted by Muse Image, a new shot (${Math.round((Date.now() - t0) / 1000)}s): ${clip(where, 90)}`);
        this.set({ artKey: key });
      })
      .catch(() => {});
    this.artSeq++;
  }

  private lastArtAsked = 0;

  /** The painting of each turn's decision (turn index; -1 = the finale), for the ending montage. */
  private turnArt = new Map<number, string>();
  /** The picture on screen while each turn's result was shown (CD: the montage card must match what they saw). */
  private seenArt = new Map<number, string>();

  /**
   * The ending montage ("Because of you"): up to 3 turn moments plus the ending, each with its painting, its line and
   * whose move it was. The TV plays them as panels; the narrator reads the ending on the last one.
   */
  montage(): { image: string; line: string; heroIds: string[] }[] {
    const log = this.state.log;
    const turns = log.slice(0, -1).map((l, i) => ({ l, i }));
    const pick = turns.length <= 3 ? turns : [turns[0], turns[Math.floor(turns.length / 2)], turns[turns.length - 1]];
    const fallback = this.sceneImages[this.state.artKey] ?? this.sceneImages[2] ?? this.sceneImages[0] ?? "";
    const panels = pick.map(({ l, i }) => ({ image: this.seenArt.get(i) || this.turnArt.get(i) || this.sceneImages[Math.min(2, i)] || fallback, line: l.narration, heroIds: [l.heroId] }));
    const winner = log[log.length - 1]?.heroId ?? "";
    if (this.state.epilogue)
      panels.push({
        image: this.turnArt.get(-1) ?? fallback,
        line: this.state.epilogue,
        heroIds: [winner, ...this.heroes().map((p) => p.id).filter((id) => id !== winner)].filter(Boolean),
      });
    return panels;
  }

  // ---------- story sources (design/24 P6) ----------
  private newsCands: NewsCand[] = [];
  private builtSeeds = new Map<string, QuestSeed>(); // live and personal stories, built during the vote
  private openerP = new Map<string, Promise<QuestSeed | null>>(); // option id -> its story, being written
  private plateP = new Map<string, Promise<string | null>>(); // story id -> its painted opening scene
  private ourStories: Record<string, { title: string; setup: string; steps: string; ending: string }> = {};

  private party() {
    return this.heroes().map((p) => ({ hero_id: p.id, name: p.hero!.name, power: p.hero!.ability?.text ?? "" }));
  }

  /**
   * Ask the story writer (POST /api/story/opener) for one option's opener + ending facts, the moment the vote starts,
   * then paint its opening scene. Resolves null if it can't be written or isn't safe: that option falls back.
   */
  private prepareStory(optionId: string, req: Record<string, unknown>, build: (o: OpenerRes) => QuestSeed, local?: () => OpenerRes) {
    const p = (async () => {
      try {
        const res = await fetch("/api/story/opener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...req, rating: this.state.rating, party: this.party() }),
        }).catch(() => null);
        // No writer (yet), or it failed: a personal story still plays from its own words.
        const j = (res?.ok ? await res.json() : local ? local() : null) as OpenerRes | null;
        if (!j) return null;
        if (!j?.opener?.narration || j.safe === false) return null;
        const seed = build(j);
        const qt = j.quest_title || j.opener.quest_title;
        const teaser = j.teaser || j.opener.teaser;
        const mood = j.mood || j.opener.mood;
        if (qt) seed.quest_title = qt;
        if (teaser) this.teasers.set(seed.id, teaser);
        if (mood) seed.tone = mood; // the writer's mood steers the narrator, music and paint
        // One consistent threat (name, pronoun, want) and the story ladder, from the writer.
        // The problem (new shape) or the threat (older shape): one name, what's at stake, a creature's pronoun.
        const pr = j.opener.problem ?? (j as { problem?: { name?: string; stakes?: string; pronoun?: string } }).problem;
        const th = j.opener.threat;
        const name = pr?.name || th?.name;
        const stakes = pr?.stakes || th?.want || "";
        const pronoun = pr?.pronoun || th?.pronoun || "";
        if (name) seed.the_threat = { ...seed.the_threat, name };
        if (stakes || pronoun) seed.problem = { pronoun: /^(she|he|it|they)$/.test(pronoun) ? pronoun : "", stakes };
        const real = (j.opener as { real_setting?: Record<string, unknown> }).real_setting ?? (j as { real_setting?: Record<string, unknown> }).real_setting;
        if (real && typeof real === "object") seed.real_event = real;
        if (Array.isArray(j.opener.beats)) seed.beats = j.opener.beats.map((b) => String(b).trim()).filter(Boolean).slice(0, 4);
        this.builtSeeds.set(seed.id, seed);
        this.paintOpening(seed);
        return seed;
      } catch {
        return null;
      }
    })();
    this.openerP.set(optionId, p);
    return p;
  }

  /** A story without pre-painted plates gets its opening scene painted (muse-image, Neon Uncanny) during the vote. */
  private paintOpening(seed: QuestSeed) {
    if (this.plateP.has(seed.id)) return;
    const o = seed.opener!;
    // Painted in the story's own theme: the narrator cast (a quick call, cached) picks the art style first.
    const p = this.castRaw(seed).then((r) =>
      image({ kind: "scene", location: o.location || "", description: o.situation, realm: "", threat: o.narration, quality: "fast", style: r.cast.art }),
    );
    this.plateP.set(seed.id, p);
    p.then((url) => {
      if (!url) return;
      this.plateArt.set(seed.id, url);
      if (this.state.phase === "story_vote") this.set({}); // the vote card picks up its picture
    });
  }

  // ---------- Our stories: everyone privately writes a small true story ----------
  private startStoryWrite() {
    this.ourStories = {};
    this.set({ phase: "story_write", written: [], votes: {}, ready: [] });
    this.setTimer(this.quick ? 90_000 : 120_000, () => this.endStoryWrite());
  }

  private onStory(pid: string, title: unknown, setup: unknown, steps: unknown, ending: unknown) {
    if (this.state.phase !== "story_write" || !this.player(pid)) return;
    const clean = (x: unknown, n: number) => String(x ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
    const story = { title: clean(title, 60), setup: clean(setup, 400), steps: clean(steps, 400), ending: clean(ending, 300) };
    if (!story.setup || !story.ending) return;
    if (!story.title) story.title = story.setup.split(/[.!?]/)[0].slice(0, 50);
    // The story stays on the TV: the wire only says who has written one. The real ending is hidden until the reveal.
    this.ourStories[pid] = story;
    this.prepareOurs(pid); // its opener starts writing now (they take 20-40 s), not when the phase ends
    const written = [...new Set([...this.state.written, pid])];
    this.set({ written });
    this.note("source", this.player(pid)?.name ?? "A player", "Wrote a true story. Its real ending stays hidden until the reveal.");
    // Everyone has written: the vote starts now, not when the timer ends.
    if (this.state.players.filter((p) => !p.away).every((p) => written.includes(p.id))) this.endStoryWrite();
  }

  private endStoryWrite() {
    if (this.state.phase !== "story_write") return;
    this.clearTimer();
    const ids = Object.keys(this.ourStories);
    if (!ids.length) {
      this.note("source", "Our stories", "Nobody wrote one in time, so tonight is an odd news story instead.");
      this.set({ source: "news" });
      return this.startStoryVote();
    }
    const options = ids.map((pid) => {
      if (!this.openerP.has(`ours-${pid}`)) this.prepareOurs(pid);
      return { id: `ours-${pid}`, title: this.ourStories[pid].title, teaser: "A true story from someone at this table." };
    });
    this.startStoryVote(options);
  }

  /** One player's true story: ask the writer for its opener; if the writer never answers, it plays from their own words. */
  private ourFallback = new Map<string, () => QuestSeed>();
  private prepareOurs(pid: string) {
    const st = this.ourStories[pid];
    if (!st) return;
    const optionId = `ours-${pid}`;
    const author = speakableName(this.player(pid)?.name ?? "Someone");
    this.ourFallback.set(optionId, () => personalSeed(optionId, pid, author, st, localOpener(st)));
    this.prepareStory(
      optionId,
      { mode: "personal", source: { author_id: pid, title: st.title, setup: st.setup, steps: st.steps, real_ending: st.ending } },
      (o) => personalSeed(optionId, pid, author, st, o),
      () => localOpener(st),
    );
  }

  // ---------- the narrator's voice (design/24 P5) ----------
  private voiceClips = new Map<string, Promise<{ url: string; ms: number; rate: number } | null>>();
  private voiceUrls: Record<number, string> = {};
  private voiceSeq = 0;
  private voicedBy = "";
  private castP: Promise<NonNullable<GameState["cast"]>> | null = null;

  /** Test players for playtesting (up to 3, run by this TV; they send the same intents a phone does). */
  private bots = new Bots({
    state: () => this.state,
    inject: (m) => this.handle(m),
    owner: () => this.owner(),
    freeHeroIds: () => QUICK_HEROES.filter((h) => !this.state.players.some((p) => p.pick === h.id)).map((h) => h.id),
    storySoFar: () => this.storySoFar(),
    deadline: () => this.deadlineAt,
    turnMs: () => this.turnMs(),
    humansPlaying: (): boolean => this.state.players.some((p) => !p.id.startsWith("bot-")),
    ask: (input) => this.ask<{ text?: string }>("bot", input).then((r) => (r.fallback ? "" : String(r.data?.text ?? ""))),
  });

  /** "+ Add test player" (lobby only). Returns the bot's name, or "" when there's no room. */
  addBot() {
    const name = this.bots.add();
    if (name) this.note("hero", name, "Test player added: run by the TV for playtesting, its moves written by Muse Spark (minimal).");
    return name;
  }
  /** Cast calls per story, so a story's narrator (and its opener's audio) can be ready before it starts. */
  private castCache = new Map<string, Promise<{ cast: NonNullable<GameState["cast"]>; failed: boolean; want: string; pronoun: string }>>();

  /**
   * The procedural story state (design/35): fixed at the start from the real event (where, problem, stakes, finish
   * line), then changed only by code applying what each turn proposes. Shown to the AI on every call.
   */
  private story: StoryState | null = null;
  /** The engine said the finish line was reached: the next turn is the finale. */
  private finaleNext = false;

  /** The story state as the ruling and the ending see it (the engine's state, hidden real event included). */
  storySoFar() {
    const st = this.story;
    if (!st) return {};
    return { where: st.where, problem: st.problem, at_stake: st.stakes, finish_line: st.finish_line, progress: st.progress, act: st.act, cast: st.cast, facts: st.facts, open_thread: st.open_thread, last_moments: st.last_moments, memorable: st.memorable, pronouns: st.pronouns, hook: st.hook, right_now: st.right_now };
  }

  /** The audio for voice line `id` (the TV plays it; nothing goes over the network to phones). */
  voiceUrl(id: number) {
    return this.voiceUrls[id] ?? "";
  }

  /** The AI casts one narrator for the story's mood (cached per story, so it can run before the story starts). */

  private castRaw(seed: QuestSeed) {
    const hit = this.castCache.get(seed.id);
    if (hit) return hit;
    const MOOD_MUSIC: Record<string, string> = { silly: "playful", spooky: "eerie", cozy: "warm", eerie: "eerie", wondrous: "mysterious", tense: "tense" };
    const moodMusic = MOOD_MUSIC[String(seed.tone ?? "").toLowerCase()] ?? "";
    const fb = () => ({ voice: DEFAULT_CAST.voice, name: VOICES[DEFAULT_CAST.voice].name, style: DEFAULT_CAST.style, kind: "a strange true story", art: "neon", artName: ART_STYLES.neon.name, music: moodMusic });
    const p = withTimeout(
      this.ask<{ voice: string; style: string; kind: string; art: string; music: string; problem_stakes?: string; problem_pronoun?: string }>("cast", {
        title: seed.quest_title,
        premise: seed.fairytale_premise,
        problem: { name: seed.the_threat.name, description: seed.the_threat.description },
        category: seed.category ?? "",
        tone: seed.tone ?? "",
      }).then(
        ({ data: d, fallback: f }) => {
          if (f || !isVoice(d?.voice)) return { cast: fb(), failed: true, want: "", pronoun: "" };
          const art = FEATURES.artStyles && isArtStyle(d.art) ? d.art : "neon";
          return {
            cast: { voice: d.voice, name: VOICES[d.voice].name, style: String(d.style ?? "").slice(0, 160) || DEFAULT_CAST.style, kind: String(d.kind ?? "").slice(0, 60) || "a strange true story", art, artName: ART_STYLES[art].name, music: String(d.music ?? "") || moodMusic },
            failed: false,
            want: String(d.problem_stakes ?? "").slice(0, 120),
            pronoun: /^(she|he|it|they)$/.test(String(d.problem_pronoun)) ? String(d.problem_pronoun) : "",
          };
        },
        () => ({ cast: fb(), failed: true, want: "", pronoun: "" }),
      ),
      8000,
      () => ({ cast: fb(), failed: true, want: "", pronoun: "" }),
    );
    this.castCache.set(seed.id, p);
    return p;
  }

  /** Get a story's narrator and its opener's audio ready while the table is still choosing. */
  private prewarm(seed: QuestSeed | null | undefined) {
    if (!seed || !FEATURES.voice) return;
    const cp = this.castRaw(seed).then((r) => r.cast);
    const sc = this.seedScenes(seed, this.quick)[0];
    if (sc) void this.voiceFor(this.openerLine(sc), cp);
  }

  /** At game start: the story's narrator, plus what its threat wants (for the story spine). */
  private askCast(seed: QuestSeed) {
    this.castP = this.castRaw(seed).then((r) => {
      if (r.failed) this.fellBack("Casting the narrator", "the AI call failed or was too slow");
      if (this.seed?.id !== seed.id) return r.cast;
      this.set({ cast: r.cast });
      if (this.story && !this.story.stakes && r.want) this.story.stakes = r.want;
      this.note("hero", "Story look", `Muse Spark read the story as ${r.cast.kind}: painted in ${r.cast.artName}, music: ${r.cast.music || "rotating"}. One narrator voice for every story.`);
      if (this.story?.stakes) this.note("scene", "The problem", `${seed.the_threat.name}. At stake: ${this.story?.stakes}. Every complication comes from the problem; nobody has to be defeated.`);
      return r.cast;
    });
    return this.castP;
  }

  /**
   * One line of narration as audio: cast voice + style + a brisk-pace note. Cached per text. Resolves null on any
   * failure, and callers never wait more than 5 s for it: the story falls back to text alone.
   */
  private voiceFor(text: string, castP = this.castP) {
    // "door door", "through through": a doubled word reads badly aloud.
    const clean = voiceText(text);
    if (!clean || !FEATURES.voice) return Promise.resolve(null);
    const hit = this.voiceClips.get(clean);
    if (hit) return hit;
    const p = (async () => {
      const cast = await (castP ?? Promise.resolve(null));
      if (!cast) return null;
      try {
        // Character voices (FEATURES.castVoices): the line's narration and quotes, plus who is who; /api/tts may ignore them.
        const lines = this.castLines.get(clean);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, voice: cast.voice, style: cast.style, ...(lines ? { lines, cast: this.speakers() } : {}) }),
        });
        if (!res.ok) return null;
        // Gemini's calm reads slowly, so the TV plays it at 1.25x; OpenAI's pace is already natural (1x).
        const rate = Number(res.headers.get("X-Voice-Rate") ?? 1) || 1;
        if (!this.voicedBy) {
          const by = res.headers.get("X-Voice-Provider");
          this.voicedBy = by === "elevenlabs" ? "ElevenLabs (Sarah: Eleven v3 for openers and endings, Flash v2.5 for live lines)" : by === "gemini" || rate !== 1 ? "Gemini TTS" : "OpenAI TTS";
          this.note("hero", "Narrator", `Voiced by ${this.voicedBy} (Meta has no voice model). Text only if a line isn't ready in 5 s.`);
        }
        const ms = Number(res.headers.get("X-Audio-Ms") ?? 0);
        const url = URL.createObjectURL(await res.blob());
        return { url, ms: Math.round(ms / rate), rate };
      } catch {
        return null;
      }
    })();
    this.voiceClips.set(clean, p);
    return p;
  }

  /** The opener as read aloud; with castVoices on, its character line is marked for that character's voice. */
  private openerLine(sc: SeedScene) {
    const text = openerText(sc);
    const npc = sc.npc_line;
    if (npc?.speaker && npc?.line) {
      const quote = `"${npc.line}"`;
      this.castLine(text, [{ speaker: "", text: text.slice(0, text.lastIndexOf(quote)).trim() }, { speaker: npc.speaker, text: quote }]);
    }
    return text;
  }

  /** Lines that have a cast member's quote in them (FEATURES.castVoices), by the text voiceFor reads. */
  private castLines = new Map<string, VoiceLine[]>();

  /** Remember a line's narration/quote split for its audio (only when some piece isn't the narrator's). */
  private castLine(text: string, lines?: VoiceLine[]) {
    if (!FEATURES.castVoices || !Array.isArray(lines) || !lines.some((l) => l?.speaker)) return;
    this.castLines.set(voiceText(text), lines);
  }

  /** Who can speak in a line: the story's side characters and the heroes (for /api/tts to pick voices). */
  private speakers() {
    return [
      ...(this.story?.cast ?? []).map((c) => ({ name: c.name, role: c.role })),
      ...this.heroes().map((p) => ({ name: p.hero!.name, role: `a hero at the table: ${(p.concept ?? "").slice(0, 80)}`, pronouns: p.hero!.pronouns || "they/them" })),
    ];
  }

  /** Wait for a clip at most until `deadline` (ms since epoch). null = read it as text. */
  private async voiceBy(text: string, deadline: number) {
    // A clip that's already in still plays even if its deadline passed long ago (it was asked for early).
    const left = Math.max(150, deadline - Date.now());
    return withTimeout(this.voiceFor(text), left, () => null);
  }

  /** Start reading a line aloud on the TV (after `delay` ms). Returns how long it takes, 0 if text only. */
  private play(clip: { url: string; ms: number; rate: number } | null, delay = 0) {
    if (!clip) {
      this.set({ voice: null });
      return 0;
    }
    const id = ++this.voiceSeq;
    this.voiceUrls[id] = clip.url;
    this.set({ voice: { id, ms: clip.ms, delay, rate: clip.rate }, narrated: true });
    return clip.ms;
  }

  /** One d20 + the stat the DM picked + 1 for a friend's idea, against the tier's target. All in code. */
  private makeRoll(pitch: Pitch, die = d20()): RollResult {
    const p = this.player(pitch.playerId)!;
    const v = pitch.verdict ?? this.verdictFallback(pitch);
    const statBonus = p.hero!.stats[v.stat] ?? 0;
    // +1 for working in a friend's idea; in the finale, +1 per friend who backed the plan (max +2).
    const backed = this.state.finale ? Math.min(2, Object.values(this.state.votes).filter((id) => id === pitch.id).length) : 0;
    const bonus = (pitch.creditId ? 1 : 0) + backed;
    // Graded outcomes (lib/grade.ts): no pass/fail line. The plan's difficulty is a shift on the total; in the finale
    // the finale's shift never goes below -3 (no loss spiral).
    const finale = this.state.finale;
    const tierShift = TIER_SHIFT[v.tier];
    const shift = finale ? Math.max(-3, tierShift) : tierShift;
    const g = gradeRoll(die + statBonus + bonus + shift, die);
    return {
      playerId: p.id,
      dice: [die],
      kept: die,
      advantage: "none",
      statBonus,
      tierMod: shift,
      bonus,
      bonusWhy: backed ? "backed" : bonus ? "idea" : "",
      need: 0,
      total: g.total,
      band: g.band,
      grade: g.grade,
      gradeLabel: g.label,
      ending: g.ending,
      rescuerId: "",
      noRoll: false,
      boosted: false,
    };
  }

  // ---------- the owner rolls ----------
  private startRoll() {
    const roll = this.pendingRoll;
    if (this.state.phase !== "ruling" || !roll) return;
    this.set({ phase: "roll", rolls: [roll], revealed: [], fling: null });
    // Their phone shows a big ROLL button; after 10 s the table rolls for them (and their phone buzzes).
    if (this.player(roll.playerId)?.away) return this.setTimer(1500, () => this.revealRoll());
    this.setTimer(this.judge ? 3000 : this.quick ? 6000 : ROLL_MS, () => this.revealRoll(true)); // judge mode: auto-throw at 3 s (CD: waits)
  }

  /** The roller swiped (or tapped). The swipe only shapes the throw on the TV; the number was decided in code. */
  private onRoll(pid: string, power?: unknown, angle?: unknown) {
    if (this.state.phase === "roll") {
      if (this.state.rolls[0]?.playerId !== pid || this.state.revealed.includes(pid)) return;
      const num = (x: unknown, lo: number, hi: number, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
      this.set({ fling: { power: num(power, 0.1, 1, 0.55), angle: num(angle, -1, 1, 0) } });
      this.revealRoll();
      return;
    }
    if (this.state.phase === "final_roll") return this.revealFinalDie(pid);
  }

  private revealRoll(timedOut = false) {
    const roll = this.state.rolls[0];
    if (this.state.phase !== "roll" || !roll || this.state.revealed.length) return;
    this.clearTimer();
    if (timedOut) this.timedOut([roll.playerId]);
    // Nobody swiped: the table throws it with an ordinary toss.
    this.set({ revealed: [roll.playerId], fling: this.state.fling ?? { power: 0.5, angle: Math.random() * 0.6 - 0.3 } });
    this.noteRoll(roll, ROLL_ANIM_MS, timedOut);
    // The die tumbles, lands, shows its math for a beat, then the outcome.
    this.setTimer(ROLL_ANIM_MS + ROLL_HOLD_MS, () => this.showOutcome());
  }

  // ---------- what happened ----------
  /**
   * The branching writer (design/24): what the action did, plus the NEW situation the next hero faces, plus the
   * cause and effect for DM's Notes. Fixed start, fixed goal, open middle.
   */
  /** {hero name: pronouns} for every writing call, so nobody gets the wrong pronoun. */
  private pronounMap() {
    return Object.fromEntries(this.heroes().map((p) => [p.hero!.name, p.hero!.pronouns || "they/them"]));
  }

  /** The engine's AI-free turn (same as the route's): it still names the plan and applies its grade. */
  private localTurn(pitch: Pitch, roll: RollResult): TurnResult {
    const h = this.player(pitch.playerId)!.hero!;
    const g = gradeRoll(roll.total, roll.kept);
    const state = this.story ?? stateFromOpener({ goal: this.state.goal }, [], this.state.turnOrder.length);
    const next = this.nextOwner();
    const won = g.branch === "better" || g.branch === "legendary";
    const attempt = pitch.verdict?.interpretation && !pitch.verdict.fallback ? pitch.verdict.interpretation : pitch.text;
    const p = fallbackProposal(state, { hero: h.name, attempt, idea_from: won && pitch.creditId ? this.heroName(pitch.creditId) : "", grade: g.grade, next_player: next ? this.heroName(next) : "" });
    const a = applyTurn(state, p, { hero: h.name, attempt, grade: g.grade, depth: g.depth });
    return { outcome: p.outcome, scene: p.scene, right_now: a.state.right_now, progress: a.state.progress, progress_delta: a.delta, progress_why: "", finale: a.finale, act: a.state.act, act_changed: a.act_changed, state: a.state, problems: [], fallback: true };
  }

  /** design/35 step 5: the turn call. The engine checks the outcome and applies it to the story state in code. */
  private turnFor(pitch: Pitch, roll: RollResult): Promise<TurnResult> {
    const h = this.player(pitch.playerId)!.hero!;
    const g = gradeRoll(roll.total, roll.kept);
    const next = this.nextOwner();
    const won = g.branch === "better" || g.branch === "legendary";
    return this.ask<TurnResult>("turn", {
      state: this.story,
      hero: { name: h.name, power: h.ability?.text ?? "", pronouns: h.pronouns || "they/them", concept: this.player(pitch.playerId)?.concept ?? "" },
      plan: pitch.text, // the player's own words (own + the friend's idea), never shortened
      own: pitch.own,
      idea: pitch.idea,
      attempt: pitch.verdict?.interpretation ?? "",
      idea_from: won && pitch.creditId ? this.heroName(pitch.creditId) : "",
      grade: g.grade,
      total: g.total,
      depth: Math.round(g.depth * 100) / 100,
      next_player: next ? this.heroName(next) : "",
      turns_left: Math.max(0, this.state.turnOrder.length - this.state.turnIndex - 1),
    })
      .then((r) => (r.data?.state && r.data?.outcome ? { ...r.data, fallback: r.fallback || !!r.data.fallback } : this.localTurn(pitch, roll)))
      .catch(() => this.localTurn(pitch, roll));
  }

  private async showOutcome() {
    if (this.state.phase !== "roll") return;
    this.clearTimer();
    const roll = this.state.rolls[0];
    const pitch = this.state.pitches.find((p) => p.playerId === roll.playerId)!;
    // The die, its math and the plan stay on screen until the result is ready (fresh-eyes review: never a bare
    // "writing it down" screen); usually it was written before the die even landed.
    let settled = false;
    const tp = this.turnP ?? Promise.resolve(this.localTurn(pitch, roll));
    tp.then(() => (settled = true));
    setTimeout(() => !settled && this.state.phase === "roll" && this.set({ busy: "The DM is writing it down…" }), 1200);
    // The call started at the ruling; a late answer is kept as long as nothing is on screen yet (design/33).
    const landed = Date.now();
    const d = (await withTimeout(tp, 9000, () => null)) ?? this.localTurn(pitch, roll);
    if ((this.state.phase as string) !== "roll") return;
    // The outcome's audio was asked for the moment its text arrived; give it until 5 s after that, else text only.
    const clip = await this.voiceBy(d.outcome, (this.outcomeAt || Date.now()) + 5000);
    if ((this.state.phase as string) !== "roll") return;
    this.set({ phase: "outcome", outcome: "", ready: [], voice: null });
    // The picture on screen now is the one the table sees with this result (the montage reuses it).
    const onScreen = this.sceneImages[this.state.artKey] ?? this.sceneImages[this.plateFor(this.state.turnIndex)];
    if (onScreen) this.seenArt.set(this.state.turnIndex, onScreen);
    const g = gradeRoll(roll.total, roll.kept);
    this.story = d.state;
    this.finaleNext = d.finale;
    this.recordWin(pitch, roll, d.outcome);
    this.note("scene", "Progress", `${d.progress_delta >= 0 ? "+" : ""}${d.progress_delta} progress (${d.progress}/100)${d.progress_why ? `: ${d.progress_why}` : ""}.`);
    if (d.act_changed) this.note("scene", `Act ${d.act}`, d.scene || "A new situation.");
    if (d.fallback) this.note("fallback", "What happened", "The writer was slow, so the engine's own line names the plan and applies the roll.");
    if (d.problems?.length) this.note("fallback", "Checks", d.problems.slice(0, 3).join("; "));
    if (d.right_now && d.right_now !== this.state.nowGoal) this.note("scene", "Right now", d.right_now);
    this.set({ outcome: d.outcome, busy: "", situation: d.scene || this.state.situation, nowGoal: d.right_now || this.state.nowGoal, progress: d.progress, act: d.act });
    this.playStorySfx(d.sfx);
    console.info(`[wait] outcome ${Date.now() - landed}ms after the die landed (turn ${this.state.turnIndex + 1}${d.fallback ? ", fallback" : ""})`);
    const spoken = this.play(clip);
    this.setTimer(spoken ? Math.max(spoken + 1000, 4500) : outcomeMs(d.outcome), () => this.startTurn(this.state.turnIndex + 1));
  }

  /** The turn's result goes in the log (keepsake, DM's Notes, the next turn's "earlier"). */
  private recordWin(pitch: Pitch, roll: RollResult, text: string) {
    const pid = pitch.playerId;
    this.bump("rounds");
    this.set({
      wins: { ...this.state.wins, [pid]: (this.state.wins[pid] ?? 0) + 1 },
      log: [
        ...this.state.log,
        {
          scene: this.state.turnIndex,
          heroId: pid,
          hero: this.heroName(pid),
          pitch: pitch.text,
          band: roll.band,
          headline: this.state.sceneTitle,
          narration: text,
          rescue: false,
          flagged: !!pitch.verdict && pitch.verdict.moderation !== "ok",
        },
      ],
    });
  }

  // ---------- final roll (all together, one shared die) ----------
  /** The finale's winning plan: arm, one shared "3, 2, 1, SHAKE!" on the TV and every phone, then ONE die lands. */
  private startFinalRoll(pitch: Pitch, roll: RollResult) {
    if (this.state.phase !== "ruling") return;
    this.clearTimer();
    this.finalPitch = pitch;
    this.finalRoll = roll;
    const ending = this.finalRoll.ending ?? endingFromBand(this.finalRoll.band);
    this.set({
      phase: "final_roll",
      banner: "",
      rolls: [],
      revealed: [],
      finalMoves: { [pitch.playerId]: pitch.text },
      final: { dice: {}, rolled: [], best: pitch.playerId, hopeBonus: 0, total: 0, ending, stage: "arm", armed: [], shook: [], auto: [] },
    });
    this.setTimer(this.judge ? 3000 : FINAL_ARM_MS, () => this.startCountdown());
    // The die is already decided (crypto, in code), so the ending is written while everyone shakes.
    this.askEnding(this.finalRoll, pitch);
    if (this.finalSafety) clearTimeout(this.finalSafety);
    this.finalSafety = setTimeout(() => this.state.phase === "final_roll" && this.finish(), FINAL_ROLL_MS + 20_000);
    this.nudge(); // away heroes don't need to arm
  }

  private patchFinal(patch: Partial<NonNullable<GameState["final"]>>) {
    if (this.state.final) this.set({ final: { ...this.state.final, ...patch } });
  }

  private onArm(pid: string) {
    const f = this.state.final;
    if (this.state.phase !== "final_roll" || f?.stage !== "arm" || !this.player(pid)?.hero || f.armed?.includes(pid)) return;
    const armed = [...(f.armed ?? []), pid];
    this.patchFinal({ armed });
    if (this.allPresent((id) => armed.includes(id))) this.startCountdown();
  }

  private startCountdown() {
    if (this.state.phase !== "final_roll" || this.state.final?.stage !== "arm") return;
    this.patchFinal({ stage: "count" });
    // The deadline rides along with state, so the TV and every phone count down to the same moment.
    this.setTimer(FINAL_COUNT_MS, () => this.startShake());
    this.broadcastNow();
  }

  private startShake() {
    if (this.state.phase !== "final_roll" || this.state.final?.stage !== "count") return;
    this.patchFinal({ stage: "shake" });
    // The finale's build-up sound under everyone shaking (CD), picked by Muse with the ending.
    this.epilogueP?.then((e) => ["final_roll"].includes(this.state.phase) && this.cueFinale("buildup", e.buildup));
    this.setTimer(this.judge ? 3500 : FINAL_SHAKE_MS, () => this.startTumble(true));
    this.broadcastNow();
  }

  /** A shake (or the big tap fallback). A hair early is fine: phones and the TV are never perfectly in sync. */
  private revealFinalDie(pid: string) {
    const f = this.state.final;
    if (!f || !this.player(pid)?.hero || f.shook?.includes(pid)) return;
    const early = f.stage === "count" && this.deadlineAt - Date.now() < 700;
    if (f.stage !== "shake" && !early) return;
    const shook = [...(f.shook ?? []), pid];
    this.patchFinal({ shook });
    if (this.allPresent((id) => shook.includes(id))) this.startTumble();
  }

  private startTumble(timedOut = false) {
    const f = this.state.final;
    if (this.state.phase !== "final_roll" || !f || (f.stage !== "shake" && f.stage !== "count")) return;
    const ids = this.heroes().map((p) => p.id);
    const auto = ids.filter((id) => !f.shook?.includes(id));
    this.patchFinal({ stage: "tumble", shook: ids, auto });
    if (timedOut) this.timedOut(auto);
    this.setTimer(FINAL_TUMBLE_MS, () => this.landFinal());
  }

  private landFinal() {
    if (this.state.phase !== "final_roll" || !this.finalRoll) return;
    const r = this.finalRoll;
    this.patchFinal({ stage: "landed", dice: { [r.playerId]: r.kept }, rolled: [r.playerId], total: r.total });
    this.set({ rolls: [r], revealed: [r.playerId] });
    const shook = this.heroes().length - (this.state.final?.auto?.length ?? 0);
    this.note("roll", "Final roll", `${shook} of ${this.heroes().length} shook their phones. One shared die for ${this.heroName(r.playerId)}'s plan.`);
    this.noteRoll(r, 0);
    this.setTimer(FINAL_LAND_MS, () => this.finish());
  }

  /** Ask for the ending and the keepsake once, as soon as the final die is decided, so neither is ever waited on. */
  private askEnding(roll: RollResult, pitch: Pitch) {
    const key = `${this.state.questId}:${roll.kept}:${pitch.id}`;
    if (this.endingFor === key) return;
    this.endingFor = key;
    const ending = roll.ending ?? endingFromBand(roll.band);
    const sc = this.sceneList[this.state.sceneIndex];
    const heroes = this.heroes().map((p) => ({ id: p.id, name: p.hero!.name }));
    const winner = this.heroName(pitch.playerId);
    const fb = () => ({ ending: fallbackEnding(ending, winner, pitch.verdict && !pitch.verdict.fallback ? pitch.verdict.interpretation : "", (FEATURES.storyV3 ? this.story?.right_now : this.story?.finish_line) ?? ""), line: FALLBACK_LINE[ending], recap: "", skills: null as Record<string, string> | null, sfx: [] as StorySfxCue[], buildup: "", payoff: "", bridge: "" });
    this.epilogueP = this.viaAI(
      "The ending",
      this.ask<{ ending: string; line: string; recap: string; skills?: { id: string; phrase: string }[]; sfx?: unknown; sfx_buildup?: string; sfx_payoff?: string; bridge?: string; lines?: unknown }>("story_end", {
        state: this.story,
        winner_hero: { name: winner, pronouns: this.player(pitch.playerId)?.hero?.pronouns || "they/them" },
        real_story: this.seed?.the_real_story ? { headline: this.seed.the_real_story.headline, summary: this.seed.the_real_story.summary, now: this.seed.the_real_story.now ?? "" } : undefined,
        plan: pitch.text,
        grade: gradeRoll(roll.total, roll.kept).grade,
        scene: { title: sc?.title, goal: sc?.goal },
        winner,
        attempt: pitch.verdict?.interpretation ?? "",
        band: roll.band,
        ending,
        won: ending !== "GRIM_BUT_HILARIOUS",
        story_so_far: this.storySoFar(),
        real_event: this.seed?.real_event,
        pronouns: this.pronounMap(),
        players: this.heroes().map((p) => ({ id: p.id, said: `<player_input>${cleanText(this.reals[p.id]?.skill ?? "", 80)}</player_input>` })),
        heroes: heroes.map((h) => h.name),
        situation: this.state.situation,
        earlier: this.state.log.map((l) => l.narration),
        finale_plan: pitch.verdict?.interpretation ?? "",
        recent_endings: FEATURES.storyV3 ? recentEndings() : undefined,
        quick_tale: this.quick || undefined,
      }),
      15_000,
      (d, f) =>
        f
          ? fb()
          : d?.ending?.trim()
          ? {
              ending: d.ending.trim(),
              line: (d.line ?? "").trim() || fb().line,
              recap: (d.recap ?? "").trim(),
              skills: Array.isArray(d.skills) ? Object.fromEntries(d.skills.filter((x) => x && typeof x.id === "string").map((x) => [x.id, String(x.phrase ?? "").trim()])) : null,
              sfx: pickStorySfxCues(d.sfx),
              buildup: pickStorySfx(d.sfx_buildup),
              bridge: String(d.bridge ?? "").trim().slice(0, 200),
              payoff: pickStorySfx(d.sfx_payoff),
              lines: Array.isArray(d.lines) ? (d.lines as VoiceLine[]) : undefined,
            }
          : null,
      fb,
    );
    this.endingAt = 0;
    this.epilogueP.then((e) => {
      this.endingAt = Date.now();
      if (FEATURES.storyV3) rememberEnding(e.ending);
      // The final scene reads the ending; the montage closes on the sign-off alone (never the ending twice).
      this.castLine(e.ending, e.lines);
      this.voiceFor(e.ending);
      this.voiceFor(SIGN_OFF);
      if (pitch.verdict) this.paintDecision(pitch, pitch.verdict, e.ending, e.line || this.state.situation);
    });
    const images = this.artCount().map((i) => `scene_${i + 1}`);
    const log = [...this.state.log, { scene: this.state.sceneIndex, heroId: pitch.playerId, hero: winner, pitch: pitch.text, band: roll.band, headline: sc?.title ?? "", narration: `(the finale: ${ending.toLowerCase()})`, rescue: false }];
    const bookFallback = (): Storybook => ({
      title: this.state.quest?.title ?? "A Tale",
      dedication: `For ${heroes.map((h) => h.name).join(", ")}.`,
      pages: [{ text: this.state.log.map((l) => l.narration).join(" ") || "A group of people who did not know what they were doing figured it out anyway.", image_ref: images[images.length - 1] ?? "scene_1" }],
      hero_pages: heroes.map((h) => ({ hero_id: h.id, best_moment: `${h.name} was there when it mattered.`, award: "Showed Up" })),
      moral: "Go together or don't go.",
      real_story_bridge: "",
    });
    this.storybookP = this.viaAI(
      "Keepsake",
      this.ask<Storybook>("storybook", {
        title: this.state.quest?.title,
        heroes,
        log,
        ending,
        goal_reached: ending !== "GRIM_BUT_HILARIOUS",
        goal: this.state.goal,
        available_images: images,
        long: FEATURES.longStorybook,
        real_story: this.seed?.the_real_story,
      }),
      // Started with the final roll; the keepsake QR waits on it, so a slow book falls back instead (was 30 s).
      15_000,
      (d) => (Array.isArray(d?.pages) && d.pages.length ? d : null),
      bookFallback,
    );
  }

  /** The plates this story has (Quick Tale keeps all three for the keepsake). */
  private artCount() {
    const n = Math.max(3, Object.keys(this.sceneImages).length);
    return Array.from({ length: n }, (_, i) => i);
  }

  private finish() {
    if (["final_result", ...MIRROR_PHASES, "epilogue", "reveal", "storybook"].includes(this.state.phase)) return;
    this.clearTimer();
    if (this.finalSafety) clearTimeout(this.finalSafety);
    this.finalSafety = null;
    const r = this.finalRoll!;
    const pitch = this.finalPitch!;
    const ending = r.ending ?? endingFromBand(r.band);
    this.patchFinal({ stage: "landed", dice: { [r.playerId]: r.kept }, rolled: [r.playerId], total: r.total, ending });
    this.set({ phase: "final_result", rolls: [r], revealed: [r.playerId], players: this.state.players.map((p) => ({ ...p, peril: "" })), ready: [] });
    this.recordWin(pitch, r, `The finale: ${ENDING_LABEL[ending].toLowerCase()}.`);
    // The payoff sound hits the moment the result lands (CD: "a LOUD clink when we strike gold"); look adds a visual punch on kind "payoff".
    this.epilogueP?.then((e) => this.state.phase === "final_result" && this.cueFinale("payoff", e.payoff));
    this.note("roll", "The ending", `${r.kept} ${fmtMod(r.statBonus)}${r.bonus ? ` +${r.bonus}` : ""} = ${r.total} → ${BAND_LABEL[r.band]} → ${ENDING_LABEL[ending]}. Below the target fails; reaching it works with a cost; 3 over works cleanly.`);
    this.setTimer(this.judge ? 2000 : FINAL_RESULT_MS, () => this.startFinalScene());
  }

  /**
   * The final scene (CD playtest 10:17: "there was no final scene"): the finale's result gets its own narrated beat over
   * the finale painting, like every turn's outcome, before the "Because of you" montage. The ending was written while
   * everyone shook, so this never waits long.
   */
  private async startFinalScene() {
    this.clearTimer();
    const plan = this.endingPlan[this.state.mode] ?? ["epilogue"];
    const e = await withTimeout(this.epilogueP ?? Promise.resolve(null), 4000, () => null);
    if (this.state.phase !== "final_result") return;
    if (!e?.ending) return this.runEnding(plan);
    const clip = await this.voiceBy(e.ending, (this.endingAt || Date.now()) + 3000);
    if (this.state.phase !== "final_result") return;
    this.set({ phase: "outcome", outcome: e.ending, busy: "", ready: [] });
    this.playStorySfx(e.sfx);
    const spoken = this.play(clip);
    this.setTimer(spoken ? Math.max(spoken + 1200, 4500) : outcomeMs(e.ending), () => this.runEnding(plan));
  }

  // ---------- ending modules ----------
  /** Run the ending steps in order, then the reveal. */
  private runEnding(ids: string[]) {
    this.endingQueue = [...ids];
    this.nextEnding();
  }

  private nextEnding(): void {
    this.clearTimer();
    const id = this.endingQueue.shift();
    if (id === undefined) {
      void this.startReveal();
      return;
    }
    const step = this.endingSteps[id];
    if (!step) return this.nextEnding();
    let called = false;
    step(() => {
      if (called) return;
      called = true;
      this.nextEnding();
    });
  }

  // ---------- Mirror, Mirror ----------
  /** The ward's own moments from tonight, best first: what they said, and what happened. */
  private wardMoments(wardId: string) {
    const fromLog = this.state.log
      .filter((l) => l.heroId === wardId && l.pitch)
      .map((l, i) => ({ pitch: l.pitch, what_happened: l.narration, rank: BAND_RANK[l.band] * 10 + i }));
    const fin = this.state.finalMoves[wardId];
    if (fin) fromLog.push({ pitch: fin, what_happened: "their final move in the last scene", rank: 15 });
    const seen = new Set<string>();
    return fromLog
      .sort((a, b) => a.rank - b.rank)
      .filter((m) => {
        const k = m.pitch.trim().toLowerCase();
        return !seen.has(k) && !!seen.add(k);
      })
      .slice(0, 3)
      .map(({ pitch, what_happened }) => ({ pitch, what_happened }));
  }

  private mirrorDone: () => void = () => {};

  private startMirror(done: () => void) {
    this.mirrorDone = done;
    this.clearTimer();
    this.mirrorP.clear();
    const wards = this.state.wards;
    const n = Object.keys(wards).length;
    // Reveal order follows the cycle, so each card's guardian is the hero on the card before it.
    const cards: MirrorCard[] = [];
    let g = Object.keys(wards)[0];
    for (let k = 0; k < n && g; k++) {
      cards.push({ wardId: wards[g], guardianId: g, written: false, guess: "", sentence: "" });
      g = wards[g];
    }
    const mirrorMoments = Object.fromEntries(Object.entries(wards).map(([gid, wid]) => [gid, this.wardMoments(wid).map((m) => m.pitch)]));
    this.set({
      phase: "mirror_write",
      mirror: cards.filter((c) => this.player(c.wardId)?.hero && this.player(c.guardianId)?.hero),
      mirrorMoments,
      mirrorIndex: 0,
      ready: [],
      busy: "",
    });
    this.setTimer(MIRROR_WRITE_MS, () => this.endMirrorWrite(true));
    this.nudge();
  }

  /** Run one sentence through the kindness pass. Never blocks: a local version stands in after 9 s. */
  private polish(guardianId: string, draft: string) {
    const wardId = this.state.wards[guardianId];
    const h = this.player(wardId)?.hero;
    if (!h) return;
    const moments = this.wardMoments(wardId);
    // DM's Notes: remember what the kindness pass did, but only report it (without names) at the reveal,
    // so the log never gives away who was watching whom.
    const local = () => {
      this.mirrorFate.set(guardianId, "dm"); // unchecked drafts are never shown: a warm canned line stands in
      return kindFallback(h, moments);
    };
    const p = this.viaAI(
      "Mirror kindness check",
      this.ask<{ ok: boolean; sentence: string }>("kind", { ward_name: h.name, pronouns: h.pronouns, frame: mirrorFrame(h), moments, draft }),
      9000,
      (d, f) => {
        if (f) return local(); // the server's backup: unchecked, so the raw draft never shows
        if (!d?.sentence) return null;
        this.mirrorFate.set(guardianId, !draft.trim() ? "dm" : d.ok === false ? "rewritten" : "kept");
        return d.sentence;
      },
      local,
    );
    this.mirrorP.set(guardianId, p);
  }

  private onMirrorWrite(pid: string, text: string) {
    if (this.state.phase !== "mirror_write" || !this.state.mirror.some((c) => c.guardianId === pid) || this.mirrorP.has(pid)) return;
    const clean = String(text ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!clean) return;
    this.polish(pid, clean);
    const mirror = this.state.mirror.map((c) => (c.guardianId === pid ? { ...c, written: true } : c));
    this.set({ mirror });
    if (mirror.every((c) => c.written)) this.endMirrorWrite();
    else this.nudge();
  }

  private endMirrorWrite(timedOut = false) {
    if (this.state.phase !== "mirror_write") return;
    this.clearTimer();
    if (timedOut) this.timedOut(this.state.mirror.filter((c) => !c.written).map((c) => c.guardianId));
    // Whoever ran out of time: the DM writes one warm line from what their ward actually did.
    this.state.mirror.forEach((c) => {
      if (!this.mirrorP.has(c.guardianId)) this.polish(c.guardianId, "");
    });
    this.set({ phase: "mirror_guess" });
    this.setTimer(MIRROR_GUESS_MS, () => this.startMirrorReveal());
    this.nudge();
  }

  private onMirrorGuess(pid: string, text: string) {
    if (this.state.phase !== "mirror_guess") return;
    const card = this.state.mirror.find((c) => c.wardId === pid);
    const clean = String(text ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!card || card.guess || !clean) return;
    const mirror = this.state.mirror.map((c) => (c.wardId === pid ? { ...c, guess: clean } : c));
    this.set({ mirror });
    if (mirror.every((c) => c.guess)) this.startMirrorReveal();
    else this.nudge();
  }

  private async startMirrorReveal() {
    if (this.state.phase !== "mirror_guess") return;
    this.clearTimer();
    this.set({ phase: "mirror_reveal", busy: "The mirror is polishing the glass…", mirrorIndex: 0, ready: [] });
    const mirror = await Promise.all(
      this.state.mirror.map(async (c) => {
        const h = this.player(c.wardId)!.hero!;
        const sentence = (await this.mirrorP.get(c.guardianId)?.catch(() => "")) || kindFallback(h, this.wardMoments(c.wardId));
        return { ...c, sentence };
      }),
    );
    if ((this.state.phase as string) !== "mirror_reveal") return; // moved on while we waited
    const fates = mirror.map((c) => this.mirrorFate.get(c.guardianId) ?? "dm");
    const count = (f: string) => fates.filter((x) => x === f).length;
    const [kept, rewritten, dm] = [count("kept"), count("rewritten"), count("dm")];
    this.note(
      "mirror",
      "Mirror, Mirror",
      `${mirror.length} kind sentences. ${kept} in the guardian's own words${dm ? `, ${dm} written by the DM instead (time ran out or the kindness check was down, and unchecked text is never shown)` : ""}. Nobody gets rated.`,
    );
    if (rewritten) {
      this.bump("safety", rewritten);
      this.note("safety", "Mirror, Mirror", `${rewritten} sentence${rewritten > 1 ? "s" : ""} rewritten to stay kind. The hurtful part is never shown.`);
    }
    this.set({ mirror, busy: "" });
    this.stepMirror(0);
  }

  /** One card per hero (Continue / everyone Ready / timer), then the epilogue. */
  private stepMirror(i: number) {
    if (this.state.phase !== "mirror_reveal") return;
    const card = this.state.mirror[i];
    if (!card) return this.mirrorDone();
    this.set({ mirrorIndex: i });
    this.reading(`${card.guess} ${card.sentence}`, () => this.stepMirror(i + 1), 11000);
  }

  private onThanks(pid: string) {
    const phase = this.state.phase;
    if (!["mirror_reveal", "epilogue", "reveal", "storybook"].includes(phase)) return;
    const idx = this.state.mirror.findIndex((c) => c.wardId === pid);
    if (idx < 0 || (phase === "mirror_reveal" && (idx > this.state.mirrorIndex || this.state.busy))) return;
    const now = Date.now();
    if (now - (this.lastThanks[pid] ?? 0) < 600) return;
    this.lastThanks[pid] = now;
    const n = (this.state.thanks[pid] ?? 0) + 1;
    if (n > 30) return;
    this.set({ thanks: { ...this.state.thanks, [pid]: n } });
    const r = { pid, emoji: "❤️", id: ++this.reactionId };
    this.emitReaction(r);
    // A thank-you shouldn't get cut off either.
    if (READING.has(phase) && this.deadlineAt && this.deadlineAt - now < 3000 && this.pending) {
      const fn = this.pending;
      this.setTimer(this.deadlineAt - now + 2500, fn);
    }
  }

  // ---------- thank-you after a save ----------
  /** Called from applyRound: a Catch! re-roll, or a stuck hero freed by friends, is a save worth thanking. */
  private recordSaves(rolls: RollResult[], rescue: GameState["rescue"], rescued: boolean) {
    const scene = this.state.sceneIndex;
    const fresh: Save[] = [];
    rolls
      .filter((r) => r.rescuerId)
      .forEach((r) => fresh.push({ id: `c${scene}-${r.playerId}`, savedId: r.playerId, byIds: [r.rescuerId], kind: "catch", scene, thanked: false }));
    if (rescue && rescued) {
      const by = rolls.filter((r) => r.playerId !== rescue.victimId && SUCCESS_BANDS.includes(r.band)).map((r) => r.playerId);
      if (by.length) fresh.push({ id: `r${scene}-${rescue.victimId}`, savedId: rescue.victimId, byIds: by, kind: "rescue", scene, thanked: false });
    }
    const known = new Set(this.state.saves.map((x) => x.id));
    const add = fresh.filter((x) => !known.has(x.id));
    if (add.length) this.set({ saves: [...this.state.saves, ...add] });
  }

  private onThankSave(pid: string, saveId: string) {
    const phase = this.state.phase;
    if (phase !== "outcome" && phase !== "narrating") return;
    const save = this.state.saves.find((x) => x.id === saveId);
    if (!save || save.savedId !== pid || save.thanked) return;
    this.set({ saves: this.state.saves.map((x) => (x.id === saveId ? { ...x, thanked: true } : x)) });
    const by = save.byIds.map((id) => this.heroName(id)).join(" and ");
    this.note("thanks", this.heroName(pid), `Thanked ${by || "a friend"} for ${save.kind === "catch" ? "the save" : "the rescue"}. Player to player: no AI involved.`);
    // Like a reaction burst: a thank-you shouldn't get cut off by the reading timer.
    const now = Date.now();
    if (READING.has(phase) && this.deadlineAt && this.deadlineAt - now < 3000 && this.pending) {
      const fn = this.pending;
      this.setTimer(this.deadlineAt - now + 2500, fn);
    }
  }

  /** "Ricky thanked Mara for the save", for the storybook. */
  thankYous() {
    return thankYouLines(this.state);
  }

  private async startEpilogue(done: () => void) {
    this.clearTimer();
    this.set({ phase: "epilogue", busy: "The DM wraps it up…", ready: [] });
    const { ending, line, recap, skills } = await this.epilogueP!;
    this.cleanSkills = skills;
    if (this.state.phase !== "epilogue") return;
    // The ending was already read as the final scene; the montage closes on the sign-off.
    const clip = await this.voiceBy(SIGN_OFF, Date.now() + 3000);
    if (this.state.phase !== "epilogue") return;
    this.set({ epilogue: ending, endingLine: line, recap: recap || this.state.log.map((l) => l.narration).slice(0, 1).join(" "), busy: "" });
    // The finale's log line becomes the real ending, for the keepsake.
    const log = this.state.log.map((l, i, all) => (i === all.length - 1 ? { ...l, narration: ending } : l));
    this.set({ log });
    // The TV plays the ending montage: one panel per big moment, the ending last. The narrator reads the ending on
    // its panel, and the reveal follows once it's been said.
    const lead = Math.max(0, this.montage().length - 1) * MONTAGE_PANEL_MS;
    const spoken = this.play(clip, lead);
    this.setTimer(lead + (spoken ? Math.max(spoken + 1200, MONTAGE_PANEL_MS) : Math.min(11_000, Math.max(7000, ending.split(/\s+/).length * 320 + 3000))), done);
  }

  /** The grand ending's reveal data (CD): each hero's key move in their own words, the real story in beats, the bridge. */
  private async revealData() {
    const rs = this.seed?.the_real_story;
    const e = await withTimeout(this.epilogueP ?? Promise.resolve(null), 1500, () => null);
    const moves = this.heroes().map((p) => {
      const mine = this.state.log.filter((l) => l.heroId === p.id && l.pitch);
      const best = mine.slice().sort((a, b) => BAND_RANK[a.band] - BAND_RANK[b.band])[0];
      // No turn of their own (judge mode, 4+ players): their finale plan is their move.
      const finalePlan = this.state.pitches.find((x) => x.playerId === p.id && !x.auto)?.text ?? "";
      return { heroId: p.id, name: p.hero!.name, move: cleanText(best?.pitch || finalePlan, 140) };
    });
    return { moves, real: { what: rs?.headline ?? "", ending: [rs?.summary, rs?.now].filter(Boolean).join(" "), source: rs?.source ?? "", date: rs?.date ?? "" }, bridge: e?.bridge ?? "" };
  }

  private async startReveal() {
    const revealData = await this.revealData();
    this.set({ revealData });
    const seed = this.seed;
    if (seed) {
      const rs = seed.the_real_story;
      const used = this.state.scenes.map((sc) => seed.locations.find((l) => l.name === sc.location)).filter((l) => !!l);
      this.set({
        notes: {
          ...this.state.notes,
          source: {
            headline: rs.headline,
            source: rs.source,
            date: rs.date,
            link: rs.link,
            summary: rs.summary,
            mappings: [
              { story: seed.the_threat.name, real: seed.the_threat.mapped_from },
              { story: "The goal", real: seed.the_goal.mapped_from },
              ...used.map((l) => ({ story: l!.name, real: l!.mapped_from })),
            ],
          },
        },
      });
      this.note("reveal", "The source", `Now revealed: "${rs.headline}" (${rs.source}, ${rs.date}).`);
    }
    // "Solved by Ava's parallel parking and Ben's coffee.": built in code from the join answers, never by the AI.
    const won = this.state.final?.ending !== "GRIM_BUT_HILARIOUS"; // a win, or mostly fine; not when it fell apart
    // The AI only cleans each knack (or drops a joke); the line itself is built here, and code drops jokes too.
    const skills = this.cleanSkills;
    const solvedBy = solvedByLine(
      this.heroes().map((p) => ({ name: p.name, real: this.reals[p.id] && skills ? { ...this.reals[p.id], skill: skills[p.id] ?? "" } : this.reals[p.id], hero: p.hero?.name })),
      won,
    );
    if (solvedBy) this.note("reveal", "Solved by", `${solvedBy} (built from the join answers, in code)`);
    this.set({ phase: "reveal", solvedBy });
    const rsr = this.seed?.the_real_story;
    if (rsr) {
      // "based on a true story" is said ONCE in the game, here (the on-screen banner stays). Never "this really happened":
      // the game's story is based on it, it didn't happen (CD).
      const said = this.seed?.author ? `Here's the twist… it's based on ${speakableName(this.seed.author.name)}'s true story. ${rsr.summary}` : `Now, here's the strange part… it's based on a true story. ${rsr.headline}.`;
      // The bridge links the table's ending to the real one, after a beat of breathing room (CD: the grand ending).
      const bridge = this.state.revealData?.bridge ?? "";
      // It starts on the real-story beat (look: ~5 s of WHAT YOU DID first), so the result lands before she speaks.
      this.voiceBy(bridge ? `${said} ... ${bridge}` : said, Date.now() + 2500).then((clip) => this.state.phase === "reveal" && this.play(clip, 5000));
    }
    const text = `${this.seed?.the_real_story.headline ?? ""} ${this.seed?.the_real_story.summary ?? ""}`;
    // Room to breathe: the headline plus the bridge line (CD's grand ending); Continue still skips.
    if (this.quick) return this.reading(text, () => this.showStorybook(), Math.max(QUICK.revealMs, 20_000), Math.max(QUICK.revealMs, 20_000));
    this.reading(text, () => this.showStorybook(), 15000);
  }

  private async showStorybook() {
    this.clearTimer();
    // The storybook's crew page is where the "one true thing" finally comes out.
    const players = this.state.players.map((p) => (this.truths[p.id] ? { ...p, truth: this.truths[p.id] } : p));
    this.set({ phase: "storybook", busy: "Putting your story together…", players });
    if (this.startedAt && !this.endedAt) this.endedAt = Date.now();
    const game = this.state.game;
    const book = await this.storybookP!;
    if (this.state.game !== game || this.state.phase !== "storybook") return; // Play again came first
    this.set({ storybook: book, busy: "" });
    this.saveToShelf(book);
  }

  private async saveToShelf(book: Storybook) {
    try {
      const last = this.sceneImages[this.artCount().length - 1] ?? this.sceneImages[0];
      const cover = last ? await thumbnail(last, 320, 0.7) : "";
      const rs = this.seed!.the_real_story;
      const entry: ShelfBook = {
        party: this.state.partyName || "The Group",
        title: book.title,
        date: new Date().toISOString().slice(0, 10),
        heroes: this.heroes().map((p) => [p.hero!.name, ...p.titles].join(", ")),
        moral: book.moral,
        headline: rs.headline,
        source: rs.source,
        link: rs.link,
        ending: this.state.final?.ending ?? "",
        cover,
      };
      const shelf = loadShelf();
      shelf.unshift(entry);
      localStorage.setItem("ouar-shelf", JSON.stringify(shelf.slice(0, 24)));
    } catch {
      /* the shelf is a nice-to-have; never break the ending over it */
    }
  }

  get realStory() {
    return this.seed?.the_real_story;
  }

  get questSeed() {
    return this.seed;
  }

  /** "Play another": the full Play again when it's on, else the old reset (same heroes and titles, new story). */
  nextTale() {
    if (FEATURES.playAgain) return this.playAgain();
    this.backToLobby();
  }

  /**
   * Play again (CD, FEATURES.playAgain): after the ending, back to the lobby with the same room code. Everyone stays
   * joined and ready with their hero, so the host can press Start at once (a phone can still send "newhero"). All of
   * the last story is cleared, the state and the host's own bookkeeping, and `game` goes up so screens can reset.
   */
  playAgain() {
    if (!FEATURES.playAgain || this.state.phase === "lobby") return;
    const keep = this.state;
    // The old reset (timers, the seed, art, mirror, the next Quick Tale) first, then everything it didn't cover.
    this.backToLobby();
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.nudgeTimer = null;
    Object.values(this.preRuleTimers).forEach((t) => clearTimeout(t));
    this.preRuleTimers = {};
    this.bots.reset();
    this.story = null;
    this.finaleNext = false;
    this.sceneList = [];
    this.turnP = null;
    this.pendingRoll = null;
    this.finalRoll = null;
    this.finalPitch = null;
    this.epilogueP = null;
    this.storybookP = null;
    this.endingFor = null;
    this.endingQueue = [];
    this.endingAt = 0;
    this.outcomeAt = 0;
    this.verdicts.clear();
    this.preRuled.clear();
    this.quipsSaid = [];
    this.castLines.clear();
    this.turnArt.clear();
    this.seenArt.clear();
    this.cleanSkills = null;
    this.typingAt = {};
    this.lastArtAsked = 0;
    this.castP = null;
    this.ourStories = {};
    this.artSeq = 10;
    this.deadlineAt = 0;
    this.endedAt = 0;
    this.reactionCounts = {};
    const players = keep.players.map((p) => ({
      ...p,
      status: p.hero ? ("ready" as const) : p.status,
      peril: "",
      heart: 1 as const,
      abilityAvailable: true,
      away: false,
      catchUp: undefined,
      truth: p.truth === undefined ? undefined : "", // the storybook put the text on the wire; back to "answered"
    }));
    this.set({
      ...freshState(keep.code, keep.rating),
      mode: keep.mode,
      partyName: keep.partyName,
      source: keep.source,
      questOptions: keep.questOptions,
      players,
      act: undefined,
      sfx: undefined,
      revealData: undefined,
      nudge: undefined,
      timeWarn: undefined,
      kicked: [],
      game: (keep.game ?? 0) + 1,
    });
    this.note("hero", "Play again", "Back to the lobby: same room, same heroes, a fresh story.");
  }

  /** The reset to the lobby (before Play again existed): same heroes and titles, new story. */
  private backToLobby() {
    this.clearTimer();
    this.lobbyAt = Date.now();
    if (this.finalSafety) clearTimeout(this.finalSafety);
    this.finalSafety = null;
    this.startedAt = 0;
    const prev = SEEDS.findIndex((x) => x.id === this.state.questId);
    this.seed = undefined;
    this.pinned = false;
    this.artP.clear();
    this.sceneImages = {};
    this.sceneCopies.clear();
    this.set({
      phase: "lobby",
      questId: "",
      quest: undefined,
      scenes: [],
      sceneIndex: 0,
      narration: "",
      round: null,
      final: null,
      finalMoves: {},
      epilogue: "",
      storybook: null,
      wards: {},
      mirrorMoments: {},
      mirror: [],
      mirrorIndex: 0,
      thanks: {},
      saves: [],
      log: [],
      notes: emptyNotes(),
      rescue: null,
      solvedBy: "",
      wins: {},
      votes: {},
      winnerId: "",
      outcome: "",
      endingLine: "",
      storyOptions: [],
      turnOrder: [],
      turnIndex: 0,
      ideas: {},
      finale: false,
      artKey: -1,
      pitches: [],
      rolls: [],
      revealed: [],
      busy: "",
      ready: [],
    });
    this.notesStart = Date.now();
    this.mirrorP.clear();
    this.mirrorFate.clear();
    // Quick Tale: the next live story starts being made right away, so the next group just hits Start.
    void prev;
    // A live story made ready during this game (and not played) waits for the next group.
    if (!this.quickPrep?.ready) this.quickPrep = null;
    this.votePrep = [];
    this.prepareQuick();
  }

  close() {
    this.bots.stop();
    this.clearTimer();
    if (this.finalSafety) clearTimeout(this.finalSafety);
    if (this.presenceIv) clearInterval(this.presenceIv);
    this.t.close();
  }
}
