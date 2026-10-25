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
  RULING_MS,
  STAT_LABEL,
  STORY_VOTE_MS,
  TIER_LABEL,
  TIER_MOD,
  VOTE_MS,
  band,
  d20,
  endingFromBand,
  narrationMs,
  readMs,
} from "./rules";
import { openRoom, type Msg, type Transport } from "./transport";
import { mask } from "./mask";
import { QUICK, coldOpenTimeline } from "./quick";
import { FEATURES } from "./features";
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
const BAND_RANK: Record<Band, number> = { LEGENDARY: 0, SUCCESS: 1, YES_BUT: 2, FAIL: 3, CATASTROPHE: 4 };

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
  YES_BUT: "{name}'s plan works, mostly. It costs something on the way, but the heroes are closer to the goal.",
  SUCCESS: "{name}'s plan works the way it was meant to, and the heroes get what they came for.",
  LEGENDARY: "{name}'s plan works better than anyone hoped. Someone nearby starts clapping and can't stop.",
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
  private outcomeP: Promise<string> | null = null;
  private finalRoll: RollResult | null = null;
  private finalPitch: Pitch | null = null;
  private artP = new Map<string, Promise<void>>(); // `${questId}:${scene}` -> hero-painted scene art in flight
  private epilogueP: Promise<{ ending: string; line: string; recap: string }> | null = null;
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
    if (m.type === "away") {
      if (this.inStory()) this.setAway(pid, "stepped");
      return;
    }
    if (!PRESENCE_ONLY.has(m.type) || this.awayWhy[pid] === "silent") this.setBack(pid);
  }

  /** A phase ran out on these players. Two in a row and their hero goes on autopilot. */
  private timedOut(pids: string[]) {
    if (this.skipping) return; // the presenter cut the timer short; nobody walked away
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
    this.heroes().forEach((p) => {
      if (!p.away && now - (this.lastSeen[p.id] ?? now) > AWAY_SILENCE_MS) this.setAway(p.id, "silent");
    });
  }

  /** Someone just went away: if everyone still here has already acted, don't make them wait. */
  private nudge() {
    const s = this.state;
    switch (s.phase) {
      case "story_vote":
        if (this.storyVoters().every((p) => s.votes[p.id])) this.endStoryVote();
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
    this.note("ruling", name, `${plan} → ${TIER_LABEL[v.tier]} (${fmtMod(TIER_MOD[v.tier])}, rolls ${STAT_LABEL[v.stat]}). ${end(v.reason || "No reason given")}`);
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
      const mods = v ? ` ${fmtMod(r.statBonus)} ${STAT_LABEL[v.stat]} ${fmtMod(r.tierMod)} ${TIER_LABEL[v.tier]}` : "";
      const nat = r.kept === 1 ? " Natural 1." : r.kept === 20 ? " Natural 20." : "";
      const miracle = v?.tier === "miracle" && r.kept !== 20 ? " (only a natural 20 makes a miracle)" : "";
      this.note("roll", name, `${auto ? "Didn't tap in time, so the table rolled. " : ""}d20 rolled ${r.kept}${mods} = ${r.total} → ${end(BAND_LABEL[r.band].replace(/…$/, "") + miracle)}${nat}`);
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
        return this.onPitch(m.pid, m.text);
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
    this.patchPlayer(pid, { status: "ready", hero, abilityAvailable: true, heart: 1 });
    this.applyReal(pid);
    const url = await image({ kind: "portrait", visual: hero.visual, flaw: hero.flaw, ability: hero.ability?.text });
    if (this.player(pid)?.hero !== hero) return;
    if (!url || this.player(pid)?.hero !== hero) return;
    this.portraits[pid] = url;
    this.thumbs[pid] = await thumbnail(url);
    this.t.send({ type: "portrait", pid, url: this.thumbs[pid] });
    this.patchPlayer(pid, { hasPortrait: true });
  }

  /** A ready-made character: instant, no AI call, pre-painted portrait. One of each per table. */
  async pickHero(pid: string, heroId: string) {
    const p = this.player(pid);
    const q = QUICK_HEROES.find((h) => h.id === heroId);
    if (!p || !q || p.status === "building" || this.state.phase !== "lobby") return;
    if (this.state.players.some((o) => o.id !== pid && o.pick === q.id)) return;
    const hero: Hero = structuredClone(q.hero);
    delete this.basePowers[pid];
    this.patchPlayer(pid, { status: "ready", pick: q.id, concept: q.pitch, hero, hasPortrait: false, abilityAvailable: true, heart: 1 });
    this.applyReal(pid);
    this.note("hero", hero.name, "Ready-made hero picked: written and painted ahead of time, so no AI call.");
    const url = `/heroes/${q.id}.webp`;
    this.portraits[pid] = url;
    const thumb = await thumbnail(url);
    if (this.player(pid)?.hero !== hero) return;
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

  /** "Who's playing?" Kids / Teens / Adults. Filters the stories and sets the DM's tone. Lobby only. */
  setRating(r: Rating) {
    if (this.state.phase !== "lobby" || !isRating(r)) return;
    const questOptions = questOptionsFor(r);
    this.set({ rating: r, questOptions });
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
      ability: skill ? { name: "Weirdly Good At It", text: `Brings ${skill} to any problem, and it helps.` } : base.ability,
      flaw: fear ? `Has the worst luck with ${fear}, at the worst moments.` : base.flaw,
    };
    this.patchPlayer(pid, { hero });
  }

  /** Pick a story by hand (the /tv?quest= link, the connector). A picked story skips the Full Story vote. */
  chooseQuest(id: string) {
    if (this.useQuest(id)) this.pinned = true;
  }

  private useQuest(id: string) {
    const seed = SEEDS.find((s) => s.id === id);
    if (!seed || !questAllowed(seed.rating, this.state.rating)) return false;
    this.seed = seed;
    this.sceneImages = {};
    this.artP.clear();
    this.sceneCopies.clear();
    this.set({ notes: { ...this.state.notes, safety: SAFETY_NOTES[seed.id] ?? SAFETY_GENERIC } });
    // Pre-painted plates, keyed by plate: 0 = scene 1, 1 = scene 2, 2 = the climax (also Quick Tale's scene).
    const pre = (questImages as Record<string, string[]>)[id] ?? [];
    pre.forEach((url, i) => url && (this.sceneImages[i] = url));
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

  /** Which pre-painted plate a played scene uses. */
  private plateFor(i: number) {
    return this.quick ? 2 : i;
  }

  /**
   * The art hook: paint the party's heroes into scene i (server/art via /api/scene-art, muse-image edits, ~15 s,
   * cached). Fires in the background; when it lands, the TV crossfades from the pre-painted plate to the new art.
   * Never blocks: a failure just keeps the plate.
   */
  private getSceneArt(i: number) {
    if (!FEATURES.heroArt || !this.seed) return;
    const questId = this.seed.id;
    const key = `${questId}:${i}`;
    if (this.artP.has(key) || i >= this.sceneList.length) return;
    const heroes = this.heroes()
      .slice(0, 4)
      .map((p) => ({ id: p.pick ?? p.id, name: p.hero!.name, portraitUrl: p.pick ? `/heroes/${p.pick}.webp` : this.portraits[p.id], visual: p.hero!.visual }));
    if (!heroes.length) return;
    const plate = this.plateFor(i);
    const t0 = Date.now();
    const p = fetch("/api/scene-art", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId, sceneIndex: this.quick ? "quick" : i, heroes, rating: this.state.rating }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { url?: string; fallback?: boolean; cached?: boolean } | null) => {
        if (!res?.url || res.fallback || this.state.questId !== questId) return;
        this.sceneImages[plate] = res.url;
        this.sceneCopies.delete(`${questId}:${plate}`);
        this.note("scene", "Scene art", `Painted the heroes into the scene with muse-image edits (${res.cached ? "cached" : `${Math.round((Date.now() - t0) / 1000)}s`}). The pre-painted scene showed until it was ready.`);
        this.set({ scenes: this.state.scenes.map((sc, j) => (j === i ? { ...sc, hasImage: true } : sc)) });
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
  /** Three random stories allowed for this group. Every phone taps one (15 s). Ties are broken at random. */
  private startStoryVote() {
    const pool = [...this.state.questOptions];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const storyOptions = pool.slice(0, 3);
    if (storyOptions.length < 2) {
      this.useQuest(storyOptions[0].id);
      return this.startStory();
    }
    this.set({ phase: "story_vote", storyOptions, votes: {}, ready: [] });
    this.setTimer(STORY_VOTE_MS, () => this.endStoryVote());
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
    this.useQuest(pick.id);
    this.startStory();
  }

  // ---------- the story ----------
  private startStory() {
    const seed = this.seed!;
    const quick = this.quick;
    this.sceneList = this.seedScenes(seed, quick);
    const scenes: SceneView[] = this.sceneList.map((sc, i) => ({
      kind: sc.kind,
      location: sc.location,
      description: sc.situation,
      twist: "",
      hasImage: !!this.sceneImages[this.plateFor(i)],
    }));
    this.note("safety", "Why it's safe", SAFETY_NOTES[seed.id] ?? SAFETY_GENERIC);
    this.note(
      "source",
      "The story",
      quick
        ? `Quick Tale (one scene) built from a real news story. The cold open shows the real headline; how each part maps to it is revealed at the end.`
        : `Built from a real news story${seed.category ? ` (${seed.category.replace(/_/g, " ")})` : ""}. The headline stays hidden until the end so it can't spoil the twist.`,
    );
    this.note("scene", "How scenes are written", "Every scene was written by the team in plain English ahead of time. The AI only rules on plans and says what happened.");
    this.set({ phase: "quest", scenes, sceneIndex: 0, narration: "", sceneTitle: "", goal: "", ready: [] });
    this.getSceneArt(0);
    // Quick Tale: the real headline types out, then the title card. Full Story: a short title card.
    const ms = quick ? coldOpenTimeline(seed.the_real_story.headline).total : TITLE_CARD_MS;
    this.setTimer(ms, () => this.openScene(0));
  }

  private isFinal() {
    return this.state.scenes[this.state.sceneIndex]?.kind === "climax";
  }

  private sceneLabel(i = this.state.sceneIndex) {
    return this.state.scenes[i]?.kind === "climax" ? "Finale" : `Scene ${i + 1}`;
  }

  /** A hand-written scene: the narration reveals line by line on the TV and moves on by itself (Space skips). */
  private openScene(i: number) {
    this.clearTimer();
    const sc = this.sceneList[i];
    if (!sc) return;
    this.set({
      phase: "narrating",
      sceneIndex: i,
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
    this.note("scene", this.sceneLabel(i), `"${sc.title}". Goal: ${end(sc.goal)}`);
    this.setTimer(narrationMs(sc.narration, sc.npc_line?.line ?? ""), () => this.startPitch());
    this.getSceneArt(i + 1); // paint the next scene while this one plays
  }

  // ---------- 1. everyone types a plan ----------
  private startPitch() {
    this.clearTimer();
    this.verdicts.clear();
    this.giveLateHeroes();
    this.set({ phase: "pitch", pitches: [], votes: {}, winnerId: "", rolls: [], revealed: [], ready: [] });
    this.setTimer(PITCH_MS, () => this.endPitch(true));
  }

  /** A custom hero still drawing when play starts gets a ready-made one, so nobody ever waits on a portrait. */
  private giveLateHeroes() {
    this.state.players
      .filter((p) => !p.hero)
      .forEach((p) => {
        const taken = new Set(this.state.players.map((o) => o.pick).filter(Boolean));
        const q = QUICK_HEROES.find((h) => !taken.has(h.id)) ?? QUICK_HEROES[0];
        this.portraits[p.id] = `/heroes/${q.id}.webp`;
        this.patchPlayer(p.id, { status: "ready", pick: q.id, hero: structuredClone(q.hero), hasPortrait: true });
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

  private onPitch(pid: string, text: string) {
    if (this.state.phase !== "pitch") return;
    if (!this.player(pid)?.hero || this.state.pitches.some((p) => p.playerId === pid)) return;
    const clean = String(text ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!clean) return;
    const pitch: Pitch = { id: `${this.state.sceneIndex}-${pid}`, playerId: pid, text: clean, useAbility: false, embraceFlaw: false };
    this.set({ pitches: [...this.state.pitches, pitch] });
    // No visible loading: every plan is ruled the moment it's sent, so the winner's ruling is ready when the vote ends.
    this.verdicts.set(pitch.id, this.askRuling(pitch));
    if (this.allPresent((id) => this.state.pitches.some((x) => x.playerId === id))) this.endPitch();
  }

  private endPitch(timedOut = false) {
    if (this.state.phase !== "pitch") return;
    this.clearTimer();
    // Out of time with nothing typed: your hero hangs back this time, and a plan that wasn't made can't win.
    const missing = this.heroes().filter((h) => !this.state.pitches.some((p) => p.playerId === h.id));
    if (timedOut) this.timedOut(missing.map((h) => h.id));
    const autos: Pitch[] = missing.map((h) => ({
      id: `${this.state.sceneIndex}-${h.id}`,
      playerId: h.id,
      text: `${h.hero!.name} hangs back.`,
      useAbility: false,
      embraceFlaw: false,
      auto: true,
      autopilot: !!h.away,
    }));
    const pitches = [...this.state.pitches, ...autos];
    this.set({ pitches });
    if (missing.length) this.note("ruling", "Plans", `${pitches.length - missing.length} of ${pitches.length} plans in. ${missing.map((h) => h.hero!.name).join(", ")} hung back, so ${missing.length > 1 ? "those plans" : "that plan"} can't win.`);
    let el = this.eligible();
    if (!el.length) {
      // Nobody typed anything: someone still has to do something.
      const h = this.heroes()[randInt(this.heroes().length)];
      const fill: Pitch = { ...pitches.find((p) => p.playerId === h.id)!, text: "tries the first thing that comes to mind", auto: false };
      this.set({ pitches: pitches.map((p) => (p.id === fill.id ? fill : p)) });
      this.verdicts.set(fill.id, this.askRuling(fill));
      el = [fill];
    }
    const voters = this.planVoters(el);
    if (el.length === 1 || !voters.length) {
      this.note("ruling", "The vote", el.length === 1 ? (this.heroes().length === 1 ? "Solo game: your plan wins." : "Only one plan could win this scene, so no vote.") : "Nobody else could back a plan, so no vote.");
      return this.startRuling(el[0]);
    }
    this.set({ phase: "vote", votes: {} });
    this.setTimer(VOTE_MS, () => this.endVote(true));
  }

  /**
   * Plans that can win. The spotlight rule: a player whose plan already won can't win again until every present
   * player has won once. If that leaves nothing, the rule resets.
   */
  private eligible(): Pitch[] {
    const real = this.state.pitches.filter((p) => !p.auto);
    const here = this.present().map((p) => p.id);
    const wins = this.state.wins;
    const minWins = here.length ? Math.min(...here.map((id) => wins[id] ?? 0)) : 0;
    const el = real.filter((p) => (wins[p.playerId] ?? 0) <= minWins);
    return el.length ? el : real;
  }

  /** Who backs a plan: everyone here who has a friend's plan they can back (never their own). */
  private planVoters(el = this.eligible()) {
    return this.present().filter((p) => el.some((x) => x.playerId !== p.id));
  }

  // ---------- 2. back a friend's plan ----------
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
    const wins = (p: Pitch) => this.state.wins[p.playerId] ?? 0;
    const top = Math.max(...el.map((p) => count(p.id)));
    let best = el.filter((p) => count(p.id) === top);
    const tieWins = best.length > 1;
    const fewest = Math.min(...best.map(wins));
    best = best.filter((p) => wins(p) === fewest);
    const winner = best[randInt(best.length)];
    const tally = el.map((p) => `${this.heroName(p.playerId)} ${count(p.id)}`).join(", ");
    const tie = tieWins ? (best.length > 1 ? " Tie, broken at random." : " Tie, broken by who has won least.") : "";
    this.note("ruling", "The vote", `Backs: ${tally}.${tie} ${this.heroName(winner.playerId)}'s plan goes ahead.`);
    this.startRuling(winner);
  }

  // ---------- 3. the DM rules on the winning plan ----------
  private askRuling(pitch: Pitch): Promise<Verdict> {
    const p = this.player(pitch.playerId)!;
    const h = p.hero!;
    const sc = this.sceneList[this.state.sceneIndex];
    const fb = (): Verdict => this.verdictFallback(pitch);
    return this.viaAI(
      `Ruling on ${h.name}'s plan`,
      this.ask<Partial<Verdict>>("verdict", {
        scene: { title: sc?.title, goal: sc?.goal, situation: sc?.situation, who_is_there: sc?.npc_line?.speaker ?? "" },
        finale: sc?.kind === "climax",
        hero: { name: h.name, best_stat: bestStat(h), stats: h.stats, power: h.ability?.text ?? "", weakness: h.flaw },
        plan: pitch.text,
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
    const scene = this.state.sceneIndex;
    const vp = this.verdicts.get(pitch.id) ?? this.askRuling(pitch);
    let settled = false;
    vp.then(() => (settled = true));
    // Only if the ruling isn't already in (it usually is), say so after a moment.
    setTimeout(() => !settled && this.state.phase === "ruling" && this.set({ busy: "The DM is reading the plan…" }), 600);
    const v = await vp;
    if (this.state.phase !== "ruling" || this.state.sceneIndex !== scene) return;
    const judged = { ...pitch, verdict: v };
    this.noteRuling(judged, v);
    this.set({ pitches: this.state.pitches.map((x) => (x.id === pitch.id ? judged : x)), busy: "" });
    if (this.isFinal()) return this.setTimer(RULING_MS, () => this.startFinalRoll(judged));
    // The die is decided now (crypto, in code), so the outcome is written while the table watches the roll.
    const roll = this.makeRoll(judged);
    this.pendingRoll = roll;
    this.outcomeP = this.askOutcome(judged, roll);
    this.setTimer(RULING_MS, () => this.startRoll());
  }

  /** One d20 + the stat the DM picked + the tier's modifier. All in code; the AI never touches a number. */
  private makeRoll(pitch: Pitch, die = d20()): RollResult {
    const p = this.player(pitch.playerId)!;
    const v = pitch.verdict ?? this.verdictFallback(pitch);
    const statBonus = p.hero!.stats[v.stat] ?? 0;
    const tierMod = TIER_MOD[v.tier] ?? 0;
    const total = die + statBonus + tierMod;
    return { playerId: p.id, dice: [die], kept: die, advantage: "none", statBonus, tierMod, total, band: band(die, total, v.tier), rescuerId: "", noRoll: false, boosted: false };
  }

  // ---------- 4. the winner rolls ----------
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

  // ---------- 5. what happened ----------
  private askOutcome(pitch: Pitch, roll: RollResult): Promise<string> {
    const h = this.player(pitch.playerId)!.hero!;
    const sc = this.sceneList[this.state.sceneIndex];
    const next = this.sceneList[this.state.sceneIndex + 1];
    const fb = () => FALLBACK_OUTCOME[roll.band].replaceAll("{name}", h.name);
    return this.viaAI(
      "What happened",
      this.ask<{ text: string }>("outcome", {
        scene: { title: sc?.title, goal: sc?.goal, situation: sc?.situation },
        hero: { name: h.name, power: h.ability?.text ?? "", weakness: h.flaw },
        attempt: pitch.verdict?.interpretation ?? "",
        plan: pitch.text,
        band: roll.band,
        natural: roll.kept === 1 || roll.kept === 20 ? roll.kept : null,
        finale: false,
        next_scene: next?.title ?? "",
      }),
      12_000,
      (d, f) => (f ? fb() : d?.text?.trim() || null),
      fb,
    );
  }

  private async showOutcome() {
    if (this.state.phase !== "roll") return;
    this.clearTimer();
    const roll = this.state.rolls[0];
    const pitch = this.state.pitches.find((p) => p.playerId === roll.playerId)!;
    this.set({ phase: "outcome", outcome: "", ready: [] });
    let settled = false;
    const op = this.outcomeP ?? Promise.resolve(FALLBACK_OUTCOME[roll.band].replaceAll("{name}", this.heroName(roll.playerId)));
    op.then(() => (settled = true));
    setTimeout(() => !settled && this.state.phase === "outcome" && this.set({ busy: "The DM is writing it down…" }), 600);
    const text = await op;
    if ((this.state.phase as string) !== "outcome") return;
    this.recordWin(pitch, roll, text);
    this.set({ outcome: text, busy: "" });
    this.setTimer(outcomeMs(text), () => this.openScene(this.state.sceneIndex + 1));
  }

  /** The scene's result goes in the log (keepsake, DM's Notes) and the winner's spotlight count goes up. */
  private recordWin(pitch: Pitch, roll: RollResult, text: string) {
    const pid = pitch.playerId;
    this.bump("rounds");
    this.set({
      wins: { ...this.state.wins, [pid]: (this.state.wins[pid] ?? 0) + 1 },
      log: [
        ...this.state.log,
        {
          scene: this.state.sceneIndex,
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
  private startFinalRoll(pitch: Pitch) {
    if (this.state.phase !== "ruling") return;
    this.clearTimer();
    this.finalPitch = pitch;
    this.finalRoll = this.makeRoll(pitch);
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
        earlier: this.state.log.map((l) => l.narration),
        finale_plan: pitch.verdict?.interpretation ?? "",
        quick_tale: this.quick || undefined,
      }),
      15_000,
      (d, f) => (f ? fb() : d?.ending?.trim() ? { ending: d.ending.trim(), line: (d.line ?? "").trim() || fb().line, recap: (d.recap ?? "").trim() } : null),
      fb,
    );
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
    this.note("roll", "The ending", `${r.kept} ${fmtMod(r.statBonus)} ${fmtMod(r.tierMod)} = ${r.total} → ${BAND_LABEL[r.band]} → ${ENDING_LABEL[ending]}. 15+ works, 10+ works with a cost.`);
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
    this.set({ epilogue: ending, endingLine: line, recap: recap || this.state.log.map((l) => l.narration).slice(0, 1).join(" "), busy: "" });
    // The finale's log line becomes the real ending, for the keepsake.
    const log = this.state.log.map((l, i, all) => (i === all.length - 1 ? { ...l, narration: ending } : l));
    this.set({ log });
    this.setTimer(Math.min(12_000, Math.max(8000, ending.split(/\s+/).length * 330 + 3500)), done);
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
    const solvedBy = solvedByLine(this.heroes().map((p) => ({ name: p.name, real: this.reals[p.id] })));
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
