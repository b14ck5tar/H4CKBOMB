"use client";
import seedsJson from "@/data/seed_quests.json";
import questImages from "@/data/quest_images.json";
import quickHeroes from "@/data/quickstart_heroes.json";
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
import { DEFAULT_CAST, VOICES, isVoice } from "./voices";
import { ART_STYLES, isArtStyle } from "./artStyles";
import { DEFAULT_RATING, isRating, questAllowed } from "./rating";
import { HEAVY, fearPhrase, realOf, skillPhrase, solvedByLine } from "./real";
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
const FINAL_ARM_MS = 8000;
const FINAL_COUNT_MS = 3500;
const FINAL_SHAKE_MS = 6000;
const FINAL_TUMBLE_MS = 2200;
const FINAL_LAND_MS = 1800;
const FINAL_RESULT_MS = 4500;
const TITLE_CARD_MS = 5200; // Full Story: the title card before scene 1
const ROLL_HOLD_MS = 1800; // after the die lands: its math stays up for a beat
/** The outcome stays up long enough to read it out loud, and no longer. */
const outcomeMs = (text: string) => Math.min(12_000, Math.max(6500, text.split(/\s+/).length * 330 + 3200));
// Autopilot: a phone that's said nothing for this long (mid-story) is away; its hero keeps playing on its own.
const AWAY_SILENCE_MS = 25_000;
const AWAY_AFTER_TIMEOUTS = 2;
const PRESENCE_ONLY = new Set(["hello", "ping", "away"]); // these don't count as "I'm back"
/** Every phone silent this long = the table pauses ("Reconnecting phones…"). Phones ping every 3 s. */
const ALL_QUIET_MS = 8000;
/** The climax: nobody is put on autopilot here, and the phone never covers it with "I'm back". */
const CLIMAX = new Set(["final_roll", "final_result", "epilogue", "reveal", "storybook"]);
const BAND_RANK: Record<Band, number> = { LEGENDARY: 0, SUCCESS: 1, YES_BUT: 2, FAIL: 3, CATASTROPHE: 4 };

/** What the narrator reads for the opener: the narration, then the character's line. */
function openerText(sc: SeedScene) {
  const npc = sc.npc_line?.speaker && sc.npc_line?.line ? ` ${sc.npc_line.speaker} says: "${sc.npc_line.line}"` : "";
  return `${sc.narration}${npc}`;
}

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
  opener: { title: string; narration: string; goal: string; situation: string; npc_line?: { speaker: string; line: string } };
  ending_facts?: { kind: "news"; whats_happening_now?: string; official_line?: string } | { kind: "personal"; real_ending?: string };
  safe?: boolean;
  fallback?: boolean;
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
    realm_name: c.place || "Somewhere real",
    fairytale_premise: o.opener.narration,
    the_threat: { name: o.opener.title, description: o.opener.situation, mapped_from: facts?.official_line || c.snippet },
    the_goal: { description: o.opener.goal, mapped_from: "" },
    locations: [],
    complications: [],
    the_real_story: { summary: c.snippet, headline: c.headline, source: c.source, link: c.url, date: c.date, now: facts?.whats_happening_now || "" },
    art_style_hint: o.opener.situation,
    rating: "teens",
    opener: openerScene(o.opener, c.place),
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

/** One action, ~140 characters, one line. */
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

export function loadShelf(): ShelfBook[] {
  try {
    return JSON.parse(localStorage.getItem("ouar-shelf") ?? "[]");
  } catch {
    return [];
  }
}

/** Backups when the AI is down. They never quote the plan (it was never reviewed). */
const FALLBACK_OUTCOME: Record<Band, string> = {
  CATASTROPHE: "{name} tries it, and it goes wrong fast. Nobody is hurt, but the problem just got bigger.",
  FAIL: "{name} gives it a real try, but it doesn't work this time. The problem is still right there.",
  YES_BUT: "{name}'s plan helps a little, but it costs something. The problem isn't solved yet.",
  SUCCESS: "{name}'s plan works, and the heroes get one step closer. The problem isn't solved yet.",
  LEGENDARY: "{name}'s plan works better than anyone hoped, and the heroes get a big step closer.",
};
const FALLBACK_ENDING: Record<Ending, string> = {
  TRIUMPHANT: "The die lands, and {name}'s plan works. The whole crew pulled it off, and the town will never know how close it was.",
  BITTERSWEET: "The die lands, and {name}'s plan mostly works. It's fixed, but one silly thing is never going back to normal.",
  GRIM_BUT_HILARIOUS: "The die lands, and {name}'s plan doesn't quite work. Everyone is fine, and somehow the town likes it better this way.",
};
const FALLBACK_LINE: Record<Ending, string> = {
  TRIUMPHANT: "They pulled it off together.",
  BITTERSWEET: "It worked, mostly.",
  GRIM_BUT_HILARIOUS: "It didn't work, and somehow that's fine.",
};


/** The stories this group's rating allows (lib/rating.ts). */
function questOptionsFor(rating: Rating) {
  return SEEDS.filter((q) => questAllowed(q.rating, rating)).map((q) => ({ id: q.id, title: q.quest_title, teaser: q.fairytale_premise.split(/(?<=[.!?])\s/)[0] }));
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
  private outcomeP: Promise<{ text: string; situation: string; why: string }> | null = null;
  private outcomeAt = 0; // when the outcome text arrived (its audio was asked for then)
  private finalRoll: RollResult | null = null;
  private finalPitch: Pitch | null = null;
  private artP = new Map<string, Promise<void>>(); // `${questId}:${scene}` -> hero-painted scene art in flight
  private artSeq = 10; // keys for per-decision paintings in sceneImages (0-2 are the plates)
  private epilogueP: Promise<{ ending: string; line: string; recap: string }> | null = null;
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
    this.state = {
      code,
      rating: DEFAULT_RATING,
      phase: "lobby",
      mode: "full",
      partyName: "",
      players: [],
      questId: "",
      questOptions: questOptionsFor(DEFAULT_RATING),
      scenes: [],
      sceneIndex: 0,
      hope: HOPE_START,
      hopeMax: HOPE_MAX,
      question: "",
      lastTime: "",
      sceneTitle: "",
      goal: "",
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
    const target = v.tier === "miracle" ? "only a natural 20" : `needs ${TIER_DC[v.tier]}+ in total (d20 + bonuses)`;
    this.note("ruling", name, `${plan}${pitch.creditId ? ` (+ ${this.heroName(pitch.creditId)}'s idea, +1)` : ""} → ${TIER_LABEL[v.tier]}, ${target}, rolls ${STAT_LABEL[v.stat]}. ${end(v.reason || "No reason given")}`);
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
      const vs = v ? ` vs ${v.tier === "miracle" ? "a natural 20" : `${TIER_DC[v.tier]}+`}` : "";
      const nat = r.kept === 1 ? " Natural 1." : r.kept === 20 ? " Natural 20." : "";
      const miracle = v?.tier === "miracle" && r.kept !== 20 ? " (only a natural 20 makes a miracle)" : "";
      this.note("roll", name, `${auto ? "Didn't tap in time, so the table rolled. " : ""}d20 rolled ${r.kept}${mods} = ${r.total}${vs} → ${end(BAND_LABEL[r.band].replace(/…$/, "") + miracle)}${nat}`);
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
        return this.buildCharacter(m.pid, m.text);
      case "pick":
        return this.pickHero(m.pid, m.heroId);
      case "redraw":
        return this.redraw(m.pid);
      case "truth":
        return this.onTruth(m.pid, m.text);
      case "real":
        return this.onReal(m.pid, m.skill, m.fear);
      case "pitch":
        return this.onPitch(m.pid, m.text, String(m.creditId ?? ""));
      case "idea":
        return this.onIdea(m.pid, m.text);
      case "story":
        return this.onStory(m.pid, m.title, m.setup, m.steps, m.ending);
      case "vote":
        return this.onVote(m.pid, String(m.id ?? ""));
      case "roll":
        return this.onRoll(m.pid);
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
    const name = String(rawName ?? "").replace(/[<>]/g, "").trim().slice(0, 16) || "Player";
    const existing = this.player(pid);
    if (existing) return this.patchPlayer(pid, { name });
    if (this.state.phase !== "lobby" || this.state.players.length >= 6) return;
    const color = PLAYER_COLORS[this.state.players.length % PLAYER_COLORS.length];
    this.set({
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
    if (mode === "quick" && !this.seed) this.useQuest(QUICK.defaultQuest);
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
    return this.quick ? Math.min(ms, Math.max(capMs, minMs)) : ms;
  }

  setPartyName(name: string) {
    this.set({ partyName: name.slice(0, 40) });
  }

  async buildCharacter(pid: string, concept: string) {
    const p = this.player(pid);
    if (!p || p.status === "building" || this.state.phase !== "lobby") return;
    const text = String(concept ?? "").slice(0, 200);
    this.patchPlayer(pid, { status: "building", concept: text, hasPortrait: false });
    const others = this.heroes().filter((o) => o.id !== pid);
    const hero = await this.viaAI<Hero, Hero | undefined>(
      `${p.name}'s character card`,
      this.ask<Hero>("character", {
        concept: text,
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
  async pickHero(pid: string, heroId: string) {
    const p = this.player(pid);
    const q = QUICK_HEROES.find((h) => h.id === heroId);
    if (!p || !q || p.status === "building" || this.state.phase !== "lobby") return;
    if (this.state.players.some((o) => o.id !== pid && o.pick === q.id)) return;
    const hero: Hero = { ...structuredClone(q.hero), stats: evenStats(q.hero.stats) };
    delete this.basePowers[pid];
    this.patchPlayer(pid, { status: "ready", pick: q.id, concept: q.pitch, hero, hasPortrait: false, abilityAvailable: true, heart: 1 });
    this.applyReal(pid);
    this.note("hero", hero.name, "Ready-made hero picked: written and painted ahead of time, so no AI call.");
    const url = `/heroes/${q.id}.webp`;
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
  }

  /** Live odd-news candidates for this rating (GET /api/news, cached server-side for 4 h). Never throws. */
  loadNews() {
    const rating = this.state.rating;
    fetch(`/api/news?rating=${rating}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (this.state.rating !== rating) return;
        const raw: unknown[] = Array.isArray(j?.candidates) ? j.candidates : Array.isArray(j?.quests) ? j.quests : [];
        this.newsCands = raw.map(toCandidate).filter((c): c is NewsCand => !!c);
        if (this.newsCands.length) this.note("source", "Odd news", `${this.newsCands.length} live headlines ready for the story vote.`);
      })
      .catch(() => {});
  }

  /** "Who's playing?" Kids / Teens / Adults. Filters the stories and sets the DM's tone. Lobby only. */
  setRating(r: Rating) {
    if (this.state.phase !== "lobby" || !isRating(r)) return;
    const questOptions = questOptionsFor(r);
    this.set({ rating: r, questOptions });
    this.newsCands = [];
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
      ability: skill ? { name: base.ability.name, text: `${base.ability.text.replace(/[.!\s]+$/, "")}, and weirdly good at ${skill}.` } : base.ability,
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
        realm: seed.realm_name,
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
      .map((p) => ({ id: p.pick ?? p.id, name: p.hero!.name, portraitUrl: p.pick ? `/heroes/${p.pick}.webp` : this.portraits[p.id], visual: p.hero!.visual }));
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
        this.note("scene", "Scene art", `Painted the heroes into the scene with muse-image edits (${res.cached ? "cached" : `${Math.round((Date.now() - t0) / 1000)}s`}). The pre-painted scene showed until it was ready.`);
        this.set({});
      })
      .catch(() => {});
    this.artP.set(key, p);
  }

  canBegin() {
    const playing = this.state.players.some((p) => p.hero || p.status === "building");
    return playing && (this.quick ? !!this.seed || this.state.questOptions.length > 0 : this.state.questOptions.length > 0);
  }

  begin() {
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
    // Quick Tale: the demo story (or a random allowed one). Full Story: the table votes, unless one was picked by link.
    if (this.quick && !this.seed) {
      const allowed = this.state.questOptions;
      this.useQuest(allowed.find((q) => q.id === QUICK.defaultQuest)?.id ?? allowed[randInt(allowed.length)].id);
    }
    if (this.state.source === "ours") return this.startStoryWrite();
    if (!this.quick && !this.pinned) return this.startStoryVote();
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
  private startStoryVote(given?: { id: string; title: string; teaser: string }[]) {
    let storyOptions = given ?? [];
    if (!given) {
      const live = shuffle(this.newsCands).slice(0, 3);
      if (FEATURES.liveNews && live.length >= 3) {
        storyOptions = live.map((c) => {
          const optionId = `news-${c.id}`;
          this.prepareStory(optionId, { mode: "news", source: { headline: c.headline, snippet: c.snippet, source: c.source, url: c.url, date: c.date } }, (o) => newsSeed(optionId, c, o));
          return { id: optionId, title: c.headline, teaser: [c.place, c.source].filter(Boolean).join(" · ") };
        });
        this.note("source", "Odd news", "Three live headlines. Each one's opening is being written from the article's facts while you vote.");
      } else storyOptions = shuffle(this.state.questOptions).slice(0, 3);
    }
    if (storyOptions.length < 2) return this.playOption(storyOptions[0]?.id ?? this.state.questOptions[0]?.id);
    this.set({ phase: "story_vote", storyOptions, votes: {}, ready: [] });
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
      this.set({ busy: "Writing tonight's story…" });
      const seed = await withTimeout(p, 15_000, () => null);
      this.set({ busy: "" });
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
    this.set({
      scenes: [{ kind: "hook", location: opener.location, description: opener.situation, twist: "", hasImage: !!this.sceneImages[this.plateFor(0)] }],
      turnOrder: this.makeTurnOrder(),
      turnIndex: 0,
      ideas: {},
      finale: false,
      cast: null,
      voice: null,
      narrated: false,
      paused: false,
      artKey: -1,
    });
    this.note("safety", "Why it's safe", SAFETY_NOTES[seed.id] ?? SAFETY_GENERIC);
    this.note(
      "source",
      "The story",
      seed.author
        ? `A true story from someone at this table. Who wrote it, and how it really ended, stays hidden until the reveal.`
        : quick
        ? `Quick Tale built from a real news story. The cold open shows the real headline; how each part maps to it is revealed at the end.`
        : `Built from a real news story${seed.category ? ` (${seed.category.replace(/_/g, " ")})` : ""}. The headline stays hidden until the end so it can't spoil the twist.`,
    );
    const n = this.state.turnOrder.length;
    this.note("turn", "Turns", `${n} turns (${this.heroes().length} players × ${this.heroes().length ? n / this.heroes().length : 0}), then the grand finale. The opener and the goal were written by the team; the AI writes what each action does.`);
    this.set({ phase: "quest", sceneIndex: 0, narration: "", sceneTitle: "", goal: "", ready: [], cast: null, voice: null, busy: "" });
    this.getSceneArt(0);
    this.askCast(seed);
    this.openerAsked = Date.now();
    this.voiceFor(openerText(opener));
    const ms = quick && !seed.author ? coldOpenTimeline(seed.the_real_story.headline).total : TITLE_CARD_MS;
    this.setTimer(ms, () => this.openStory());
  }

  private openerAsked = 0;

  /** Turn order: everyone in join order, repeated. 2-4 players get 2 turns each, 5-8 get 1, Quick Tale 1. */
  private makeTurnOrder() {
    const ids = this.heroes().map((p) => p.id);
    const cycles = this.quick || ids.length >= 5 ? 1 : 2;
    return Array.from({ length: cycles }, () => ids).flat();
  }

  private isFinal() {
    return this.state.finale;
  }

  /** The hand-written opener: read aloud (if the voice is ready) while it reveals line by line. Space skips. */
  private async openStory() {
    this.clearTimer();
    const sc = this.sceneList[0];
    if (!sc) return;
    // The opener's audio was asked for at the title card; wait at most 5 s from then, else text only.
    const clip = await this.voiceBy(openerText(sc), this.openerAsked + 5000);
    if (this.state.phase !== "quest") return;
    this.set({
      phase: "narrating",
      sceneIndex: 0,
      sceneTitle: sc.title,
      goal: sc.goal,
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
    const spoken = this.play(clip, TITLE_BEAT_MS);
    const ms = spoken ? TITLE_BEAT_MS + spoken + 1800 : narrationMs(sc.narration, sc.npc_line?.line ?? "");
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
    this.verdicts.clear();
    const owner = order[k];
    this.set({ phase: "turn", turnIndex: k, ideas: {}, pitches: [], votes: {}, winnerId: "", outcome: "", rolls: [], revealed: [], ready: [], busy: "" });
    this.setTimer(this.turnMs(), () => this.endTurn(true));
    this.getSceneArt(this.plateFor(k + 1));
    this.note("turn", this.heroName(owner), `Turn ${k + 1} of ${order.length}. Everyone else can suggest one action; ${this.heroName(owner)} picks.`);
  }

  private owner() {
    return this.state.turnOrder[this.state.turnIndex] ?? "";
  }

  /** A friend's suggestion for the turn owner (one action, ~140 characters). They can change it until the owner picks. */
  private onIdea(pid: string, text: string) {
    if (this.state.phase !== "turn" || pid === this.owner() || !this.player(pid)?.hero) return;
    const clean = cleanPlan(text);
    if (!clean) return;
    this.set({ ideas: { ...this.state.ideas, [pid]: clean } });
  }

  /** The owner picks: their own words, or a friend's suggestion (maybe edited). Using a friend's idea is +1 and credited. */
  private onPitch(pid: string, text: string, creditId = "") {
    const s = this.state;
    if (s.phase === "turn") {
      if (pid !== this.owner()) return this.onIdea(pid, text);
      const clean = cleanPlan(text);
      if (!clean) return;
      const credit = creditId && creditId !== pid && s.ideas[creditId] ? creditId : "";
      return this.takePlan({ id: `t${s.turnIndex}-${pid}`, playerId: pid, text: clean, useAbility: false, embraceFlaw: false, creditId: credit || undefined });
    }
    if (s.phase !== "pitch") return;
    if (!this.player(pid)?.hero || s.pitches.some((p) => p.playerId === pid)) return;
    const clean = cleanPlan(text);
    if (!clean) return;
    const pitch: Pitch = { id: `f-${pid}`, playerId: pid, text: clean, useAbility: false, embraceFlaw: false };
    this.set({ pitches: [...s.pitches, pitch] });
    // No visible loading: every finale plan is ruled the moment it's sent, so the winner's ruling is ready when the vote ends.
    this.verdicts.set(pitch.id, this.askRuling(pitch));
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
        this.portraits[p.id] = `/heroes/${q.id}.webp`;
        this.patchPlayer(p.id, { status: "ready", pick: q.id, hero: { ...structuredClone(q.hero), stats: evenStats(q.hero.stats) }, hasPortrait: true });
        this.applyReal(p.id);
        this.note("hero", q.hero.name, `${p.name}'s custom hero wasn't ready, so they play a ready-made one. Nobody waits.`);
        thumbnail(`/heroes/${q.id}.webp`).then((t) => {
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
    this.set({ phase: "pitch", finale: true, pitches: [], votes: {}, winnerId: "", outcome: "", rolls: [], revealed: [], ready: [], busy: "" });
    this.note("turn", "Grand finale", "Everyone proposes the final move, everyone backs a friend's plan (never their own), and the winning plan gets one shared die.");
    this.getSceneArt(this.plateFor(this.state.turnOrder.length));
    this.setTimer(this.turnMs(), () => this.endPitch(true));
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
    this.set({ phase: "vote", votes: {} });
    this.setTimer(VOTE_MS, () => this.endVote(true));
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
        scene: { title: this.state.sceneTitle, goal: this.state.goal, situation: this.state.situation, who_is_there: this.sceneList[0]?.npc_line?.speaker ?? "" },
        finale: this.state.finale,
        hero: { name: h.name, best_stat: bestStat(h), stats: h.stats, power: h.ability?.text ?? "", weakness: h.flaw },
        plan: firstAction(pitch.text).action,
        earlier: this.state.log.map((l) => `${l.hero} (${l.band}): ${l.narration}`).slice(-4),
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
    const vp = this.verdicts.get(pitch.id) ?? this.askRuling(pitch);
    this.verdicts.set(pitch.id, vp);
    let settled = false;
    vp.then(() => (settled = true));
    // Only if the ruling isn't already in, say so after a moment.
    setTimeout(() => !settled && this.state.phase === "ruling" && this.set({ busy: "The DM is reading the plan…" }), 600);
    const v = await vp;
    if (this.state.phase !== "ruling" || this.state.turnIndex !== turn || this.state.finale !== finale) return;
    const judged = { ...pitch, verdict: v };
    this.noteRuling(judged, v);
    this.paintDecision(judged, v);
    // The die is decided now (crypto, in code), so the outcome is written while the table watches the roll.
    const roll = this.makeRoll(judged);
    this.set({ pitches: this.state.pitches.map((x) => (x.id === pitch.id ? judged : x)), busy: "", rolls: [{ ...roll, dice: [], kept: 0 }], revealed: [] });
    if (finale) return this.setTimer(RULING_MS, () => this.startFinalRoll(judged, roll));
    this.pendingRoll = roll;
    this.outcomeAt = 0;
    this.outcomeP = this.askOutcome(judged, roll);
    this.outcomeP.then((o) => {
      this.outcomeAt = Date.now();
      this.voiceFor(o.text);
    });
    this.setTimer(RULING_MS, () => this.startRoll());
  }

  /**
   * design/24 P4: every decision gets a new painting. The moment the plan is ruled (1-2 s after the owner picks),
   * muse-image edits the CURRENT picture: the heroes, doing this action, in this situation. ~15 s; the outcome shows
   * over the previous art and the TV crossfades when it lands. Never waited on. Steered plans are never painted.
   */
  private paintDecision(pitch: Pitch, v: Verdict) {
    if (!FEATURES.heroArt || !this.seed || v.fallback || v.moderation !== "ok") return;
    const questId = this.seed.id;
    const plate = this.plateFor(this.state.turnIndex);
    const prev = this.sceneImages[this.state.artKey] ?? this.sceneImages[plate];
    const heroes = this.heroes()
      .slice(0, 4)
      .map((p) => ({ id: p.pick ?? p.id, name: p.hero!.name, portraitUrl: p.pick ? `/heroes/${p.pick}.webp` : this.portraits[p.id], visual: p.hero!.visual }));
    if (!heroes.length || !prev) return;
    const t0 = Date.now();
    const asked = this.artSeq;
    fetch("/api/scene-art", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questId,
        sceneIndex: this.quick ? "quick" : plate,
        heroes,
        rating: this.state.rating,
        sceneUrl: prev,
        sceneText: this.state.situation,
        moment: v.interpretation,
        style: this.state.cast?.art ?? "neon",
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
              heroes: heroes.map((h) => ({ id: `${h.id}-plain`, name: "", visual: "a friendly cartoon hero in everyday clothes" })),
              rating: this.state.rating,
              sceneUrl: prev,
              sceneText: this.state.situation,
              moment: "the heroes try their plan",
              style: this.state.cast?.art ?? "neon",
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
        this.note("scene", "Scene art", `Painted ${this.heroName(pitch.playerId)}'s move into the scene (${Math.round((Date.now() - t0) / 1000)}s): ${clip(v.interpretation, 80)}`);
        this.set({ artKey: key });
      })
      .catch(() => {});
    this.artSeq++;
  }

  private lastArtAsked = 0;

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
    this.plateP.set(
      seed.id,
      image({ kind: "scene", location: o.location || seed.realm_name, description: o.situation, realm: seed.realm_name, threat: o.narration, quality: "fast" }),
    );
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
    const written = [...new Set([...this.state.written, pid])];
    this.set({ written });
    this.note("source", this.player(pid)?.name ?? "A player", "Wrote a true story. Its real ending stays hidden until the reveal.");
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
      const st = this.ourStories[pid];
      const optionId = `ours-${pid}`;
      const author = this.player(pid)?.name ?? "Someone";
      this.prepareStory(
        optionId,
        { mode: "personal", source: { author_id: pid, title: st.title, setup: st.setup, steps: st.steps, real_ending: st.ending } },
        (o) => personalSeed(optionId, pid, author, st, o),
        () => localOpener(st),
      );
      return { id: optionId, title: st.title, teaser: "A true story from someone at this table." };
    });
    this.startStoryVote(options);
  }

  // ---------- the narrator's voice (design/24 P5) ----------
  private voiceClips = new Map<string, Promise<{ url: string; ms: number; rate: number } | null>>();
  private voiceUrls: Record<number, string> = {};
  private voiceSeq = 0;
  private castP: Promise<NonNullable<GameState["cast"]>> | null = null;

  /** The audio for voice line `id` (the TV plays it; nothing goes over the network to phones). */
  voiceUrl(id: number) {
    return this.voiceUrls[id] ?? "";
  }

  /** At game start the AI casts one narrator for the story's mood and writes how to read it. */
  private askCast(seed: QuestSeed) {
    const fb = () => ({ voice: DEFAULT_CAST.voice, name: VOICES[DEFAULT_CAST.voice].name, style: DEFAULT_CAST.style, kind: "a strange true story", art: "neon", artName: ART_STYLES.neon.name });
    this.castP = this.viaAI(
      "Casting the narrator",
      this.ask<{ voice: string; style: string; kind: string; art: string }>("cast", {
        title: seed.quest_title,
        premise: seed.fairytale_premise,
        category: seed.category ?? "",
        tone: seed.tone ?? "",
      }),
      8000,
      (d, f) => {
        if (f || !isVoice(d?.voice)) return fb();
        const art = FEATURES.artStyles && isArtStyle(d.art) ? d.art : "neon";
        return { voice: d.voice, name: VOICES[d.voice].name, style: String(d.style ?? "").slice(0, 160) || DEFAULT_CAST.style, kind: String(d.kind ?? "").slice(0, 60) || "a strange true story", art, artName: ART_STYLES[art].name };
      },
      fb,
    ).then((cast) => {
      this.set({ cast });
      this.note("hero", "Narrator", `Cast ${cast.name} (${VOICES[cast.voice as keyof typeof VOICES]?.gemini ?? cast.voice} voice) for ${cast.kind}: "${cast.style}". Painted in ${cast.artName}.`);
      return cast;
    });
    return this.castP;
  }

  /**
   * One line of narration as audio: cast voice + style + a brisk-pace note. Cached per text. Resolves null on any
   * failure, and callers never wait more than 5 s for it: the story falls back to text alone.
   */
  private voiceFor(text: string) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || !FEATURES.voice) return Promise.resolve(null);
    const hit = this.voiceClips.get(clean);
    if (hit) return hit;
    const p = (async () => {
      const cast = await (this.castP ?? Promise.resolve(null));
      if (!cast) return null;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, voice: cast.voice, style: `${cast.style}, at a brisk, flowing storytelling pace with only short pauses` }),
        });
        if (!res.ok) return null;
        // Gemini's calm reads slowly, so the TV plays it at 1.25x; OpenAI's pace is already natural (1x).
        const rate = Number(res.headers.get("X-Voice-Rate") ?? 1) || 1;
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
    const bonus = pitch.creditId ? 1 : 0;
    const total = die + statBonus + bonus;
    return {
      playerId: p.id,
      dice: [die],
      kept: die,
      advantage: "none",
      statBonus,
      tierMod: 0,
      bonus,
      need: TIER_DC[v.tier],
      total,
      band: judge(die, total, v.tier),
      rescuerId: "",
      noRoll: false,
      boosted: false,
    };
  }

  // ---------- the owner rolls ----------
  private startRoll() {
    const roll = this.pendingRoll;
    if (this.state.phase !== "ruling" || !roll) return;
    this.set({ phase: "roll", rolls: [roll], revealed: [] });
    // Their phone shows a big ROLL button; after 10 s the table rolls for them (and their phone buzzes).
    if (this.player(roll.playerId)?.away) return this.setTimer(1500, () => this.revealRoll());
    this.setTimer(ROLL_MS, () => this.revealRoll(true));
  }

  private onRoll(pid: string) {
    if (this.state.phase === "roll") {
      if (this.state.rolls[0]?.playerId === pid && !this.state.revealed.includes(pid)) this.revealRoll();
      return;
    }
    if (this.state.phase === "final_roll") return this.revealFinalDie(pid);
  }

  private revealRoll(timedOut = false) {
    const roll = this.state.rolls[0];
    if (this.state.phase !== "roll" || !roll || this.state.revealed.length) return;
    this.clearTimer();
    if (timedOut) this.timedOut([roll.playerId]);
    this.set({ revealed: [roll.playerId] });
    this.noteRoll(roll, ROLL_ANIM_MS, timedOut);
    // The die tumbles, lands, shows its math for a beat, then the outcome.
    this.setTimer(ROLL_ANIM_MS + ROLL_HOLD_MS, () => this.showOutcome());
  }

  // ---------- what happened ----------
  /**
   * The branching writer (design/24): what the action did, plus the NEW situation the next hero faces, plus the
   * cause and effect for DM's Notes. Fixed start, fixed goal, open middle.
   */
  private askOutcome(pitch: Pitch, roll: RollResult) {
    const h = this.player(pitch.playerId)!.hero!;
    const fb = () => ({ text: FALLBACK_OUTCOME[roll.band].replaceAll("{name}", h.name), situation: "", why: "" });
    return this.viaAI(
      "What happened",
      this.ask<{ text: string; situation: string; why: string }>("outcome", {
        story: { title: this.state.quest?.title ?? this.state.sceneTitle, goal: this.state.goal },
        situation: this.state.situation,
        hero: { name: h.name, power: h.ability?.text ?? "", weakness: h.flaw },
        attempt: pitch.verdict?.interpretation ?? "",
        plan: firstAction(pitch.text).action,
        helped_by: pitch.creditId ? this.heroName(pitch.creditId) : "",
        band: roll.band,
        natural: roll.kept === 1 || roll.kept === 20 ? roll.kept : null,
        earlier: this.state.log.map((l) => l.narration).slice(-4),
        turns_left: Math.max(0, this.state.turnOrder.length - this.state.turnIndex - 1),
      }),
      12_000,
      (d, f) => (f ? fb() : d?.text?.trim() ? { text: d.text.trim(), situation: (d.situation ?? "").trim(), why: (d.why ?? "").trim() } : null),
      fb,
    );
  }

  private async showOutcome() {
    if (this.state.phase !== "roll") return;
    this.clearTimer();
    const roll = this.state.rolls[0];
    const pitch = this.state.pitches.find((p) => p.playerId === roll.playerId)!;
    this.set({ phase: "outcome", outcome: "", ready: [], voice: null });
    let settled = false;
    const op = this.outcomeP ?? Promise.resolve({ text: FALLBACK_OUTCOME[roll.band].replaceAll("{name}", this.heroName(roll.playerId)), situation: "", why: "" });
    op.then(() => (settled = true));
    setTimeout(() => !settled && this.state.phase === "outcome" && this.set({ busy: "The DM is writing it down…" }), 600);
    const { text, situation, why } = await op;
    if ((this.state.phase as string) !== "outcome") return;
    // The outcome's audio was asked for the moment its text arrived; give it until 5 s after that, else text only.
    const clip = await this.voiceBy(text, (this.outcomeAt || Date.now()) + 5000);
    if ((this.state.phase as string) !== "outcome") return;
    this.recordWin(pitch, roll, text);
    if (why) this.note("ruling", "Why it went that way", why);
    if (situation) this.note("scene", "Now", situation);
    // The story branches: the next turn starts from what just happened.
    this.set({ outcome: text, busy: "", situation: situation || this.state.situation });
    const spoken = this.play(clip);
    this.setTimer(spoken ? Math.max(spoken + 1800, 5000) : outcomeMs(text), () => this.startTurn(this.state.turnIndex + 1));
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
    const ending = endingFromBand(this.finalRoll.band);
    this.set({
      phase: "final_roll",
      rolls: [],
      revealed: [],
      finalMoves: { [pitch.playerId]: pitch.text },
      final: { dice: {}, rolled: [], best: pitch.playerId, hopeBonus: 0, total: 0, ending, stage: "arm", armed: [], shook: [], auto: [] },
    });
    this.setTimer(FINAL_ARM_MS, () => this.startCountdown());
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
    this.setTimer(FINAL_SHAKE_MS, () => this.startTumble(true));
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
    const ending = endingFromBand(roll.band);
    const sc = this.sceneList[this.state.sceneIndex];
    const heroes = this.heroes().map((p) => ({ id: p.id, name: p.hero!.name }));
    const winner = this.heroName(pitch.playerId);
    const fb = () => ({ ending: FALLBACK_ENDING[ending].replaceAll("{name}", winner), line: FALLBACK_LINE[ending], recap: "" });
    this.epilogueP = this.viaAI(
      "The ending",
      this.ask<{ ending: string; line: string; recap: string }>("epilogue", {
        scene: { title: sc?.title, goal: sc?.goal },
        winner,
        attempt: pitch.verdict?.interpretation ?? "",
        band: roll.band,
        ending,
        heroes: heroes.map((h) => h.name),
        situation: this.state.situation,
        earlier: this.state.log.map((l) => l.narration),
        finale_plan: pitch.verdict?.interpretation ?? "",
        quick_tale: this.quick || undefined,
      }),
      15_000,
      (d, f) => (f ? fb() : d?.ending?.trim() ? { ending: d.ending.trim(), line: (d.line ?? "").trim() || fb().line, recap: (d.recap ?? "").trim() } : null),
      fb,
    );
    this.endingAt = 0;
    this.epilogueP.then((e) => {
      this.endingAt = Date.now();
      this.voiceFor(e.ending);
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
      30_000,
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
    const ending = endingFromBand(r.band);
    this.patchFinal({ stage: "landed", dice: { [r.playerId]: r.kept }, rolled: [r.playerId], total: r.total, ending });
    this.set({ phase: "final_result", rolls: [r], revealed: [r.playerId], players: this.state.players.map((p) => ({ ...p, peril: "" })), ready: [] });
    this.recordWin(pitch, r, `The finale: ${ENDING_LABEL[ending].toLowerCase()}.`);
    this.note("roll", "The ending", `${r.kept} ${fmtMod(r.statBonus)}${r.bonus ? ` +${r.bonus}` : ""} = ${r.total} → ${BAND_LABEL[r.band]} → ${ENDING_LABEL[ending]}. Below the target fails; reaching it works with a cost; 3 over works cleanly.`);
    this.setTimer(FINAL_RESULT_MS, () => this.runEnding(this.endingPlan[this.state.mode] ?? ["epilogue"]));
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
    if (id === undefined) return this.startReveal();
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
    const { ending, line, recap } = await this.epilogueP!;
    if (this.state.phase !== "epilogue") return;
    const clip = await this.voiceBy(ending, (this.endingAt || Date.now()) + 5000);
    if (this.state.phase !== "epilogue") return;
    this.set({ epilogue: ending, endingLine: line, recap: recap || this.state.log.map((l) => l.narration).slice(0, 1).join(" "), busy: "" });
    // The finale's log line becomes the real ending, for the keepsake.
    const log = this.state.log.map((l, i, all) => (i === all.length - 1 ? { ...l, narration: ending } : l));
    this.set({ log });
    const spoken = this.play(clip);
    this.setTimer(spoken ? Math.max(spoken + 2000, 6000) : Math.min(12_000, Math.max(8000, ending.split(/\s+/).length * 330 + 3500)), done);
  }

  private startReveal() {
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
    const solvedBy = solvedByLine(this.heroes().map((p) => ({ name: p.name, real: this.reals[p.id], hero: p.hero?.name })), won);
    if (solvedBy) this.note("reveal", "Solved by", `${solvedBy} (built from the join answers, in code)`);
    this.set({ phase: "reveal", solvedBy });
    const text = `${this.seed?.the_real_story.headline ?? ""} ${this.seed?.the_real_story.summary ?? ""}`;
    if (this.quick) return this.reading(text, () => this.showStorybook(), QUICK.revealMs, QUICK.revealMs);
    this.reading(text, () => this.showStorybook(), 15000);
  }

  private async showStorybook() {
    this.clearTimer();
    // The storybook's crew page is where the "one true thing" finally comes out.
    const players = this.state.players.map((p) => (this.truths[p.id] ? { ...p, truth: this.truths[p.id] } : p));
    this.set({ phase: "storybook", busy: "Putting your story together…", players });
    if (this.startedAt && !this.endedAt) this.endedAt = Date.now();
    const book = await this.storybookP!;
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

  /** "Next chapter": same heroes and titles, new story. */
  nextTale() {
    this.clearTimer();
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
    // Quick Tale: the next story is already on the table, so the next group just hits Start.
    if (this.quick) {
      const allowed = this.state.questOptions;
      const next = SEEDS.slice(prev + 1).concat(SEEDS.slice(0, prev + 1)).find((q) => allowed.some((o) => o.id === q.id));
      if (next) this.useQuest(next.id);
    }
  }

  close() {
    this.clearTimer();
    if (this.finalSafety) clearTimeout(this.finalSafety);
    if (this.presenceIv) clearInterval(this.presenceIv);
    this.t.close();
  }
}
