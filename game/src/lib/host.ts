"use client";
import seedsJson from "@/data/seed_quests.json";
import questImages from "@/data/quest_images.json";
import quickHeroes from "@/data/quickstart_heroes.json";
import { ai, image, thumbnail, withTimeout } from "./api";
import {
  APPEAL_MS,
  BAND_LABEL,
  CATCH_MS,
  ENDING_LABEL,
  FINAL_ROLL_MS,
  HOPE_MAX,
  HOPE_START,
  PITCH_MS,
  PLAYER_COLORS,
  ROLL_ANIM_MS,
  ROLL_MS,
  STAT_LABEL,
  TIER_LABEL,
  TIER_MOD,
  autoSucceeds,
  band,
  d20,
  ending,
  isFailure,
  readMs,
} from "./rules";
import { openRoom, type Msg, type Transport } from "./transport";
import { mask } from "./mask";
import type {
  Band,
  DMNotes,
  GameState,
  Hero,
  MirrorCard,
  NoteKind,
  Pitch,
  Player,
  QuestSeed,
  RollResult,
  RoundOutcome,
  Save,
  SceneOpen,
  SceneView,
  Stat,
  Storybook,
  Verdict,
} from "./types";

const SEEDS = seedsJson as QuestSeed[];
/** Ready-made characters for fast onboarding; portraits are pre-painted in public/heroes/<id>.webp. */
export const QUICK_HEROES = quickHeroes as { id: string; pitch: string; hero: Hero }[];

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

const READING = new Set(["quest", "narrating", "outcome", "mirror_reveal", "epilogue", "reveal"]);
const MIRROR_WRITE_MS = 40_000;
const MIRROR_GUESS_MS = 20_000;
const MIRROR_PHASES = ["mirror_write", "mirror_guess", "mirror_reveal"];
// All-together Final Roll: arm (up to 8 s), "3, 2, 1" (3.5 s), SHAKE window (6 s), shared tumble, land.
const FINAL_ARM_MS = 8000;
const FINAL_COUNT_MS = 3500;
const FINAL_SHAKE_MS = 6000;
const FINAL_TUMBLE_MS = 2200;
const FINAL_LAND_MS = 1800;
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
const TIER_RANK = { miracle: 0, absurd: 1, risky: 2, solid: 3, clever: 4 } as const;
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

/** A clue from the hero's own edge, for when the AI is down. Mirrors fallbackClue on the server. */
function fallbackClue(h: Hero, location: string) {
  const text = (h.ability?.text ?? "").trim().replace(/[.!]+$/, "");
  return {
    clue: h.ability?.name ? `Your ${h.ability.name} picks up the one weak spot in ${location} that nobody else sees.` : `You spot the one weak spot in ${location} that nobody else sees.`,
    because: text ? `you can ${text[0].toLowerCase()}${text.slice(1)}` : "you were paying attention",
  };
}

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

const FALLBACK_BEAT: Record<Band, string[]> = {
  CATASTROPHE: ["{name}, it goes wrong fast and in an order nobody predicted. You end up stuck somewhere you really shouldn't be."],
  FAIL: ["{name}, you try it. The world declines, politely, and makes it a little worse."],
  YES_BUT: ["{name}, it works. It also costs you something you'll miss later."],
  SUCCESS: ["{name}, it works the way you said it would. Nobody is more surprised than you."],
  LEGENDARY: ["{name}, it works better than it has any right to. Someone nearby starts clapping and can't stop."],
};

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
  private verdicts = new Map<string, Promise<Verdict>>();
  private appeals = new Map<string, Promise<Verdict>>();
  private roundP: Promise<RoundOutcome> | null = null;
  private caughtThisRound = false;
  private finalDice: Record<string, number> = {};
  private epilogueP: Promise<string> | null = null;
  private storybookP: Promise<Storybook> | null = null;
  private canon: string[] = [];
  private ledger: string[] = [];
  private recaps: string[] = [];
  private recentLines: string[] = [];
  private threatMood = "";
  private reactionId = 0;
  private lastReact: Record<string, number> = {};
  private lastPortraitSend: Record<string, number> = {};
  private mirrorP = new Map<string, Promise<string>>(); // guardian id -> their finished, kind sentence
  private lastThanks: Record<string, number> = {};
  private notesStart = Date.now();
  private mirrorFate = new Map<string, "kept" | "rewritten" | "dm">(); // guardian id -> what the kindness pass did
  private finalSafety: ReturnType<typeof setTimeout> | null = null;

  constructor(code: string) {
    this.state = {
      code,
      phase: "lobby",
      partyName: "",
      players: [],
      questId: "",
      questOptions: SEEDS.map((s) => ({ id: s.id, title: s.quest_title, teaser: s.fairytale_premise.split(/(?<=[.!?])\s/)[0] })),
      scenes: [],
      sceneIndex: 0,
      hope: HOPE_START,
      hopeMax: HOPE_MAX,
      question: "",
      lastTime: "",
      narration: "",
      situation: "",
      banner: "",
      npcLine: { speaker: "", line: "" },
      suggestions: {},
      clues: {},
      clueBecause: {},
      rescue: null,
      pitches: [],
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
      notes: emptyNotes(),
      busy: "",
    };
    this.t = openRoom(code);
    this.t.on((m) => this.handle(m));
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
    f();
    this.broadcastSoon();
  }

  /** A reading screen: advances on Continue, when every hero taps Ready, or after a generous safety timer. */
  private reading(text: string, next: () => void, minMs = 7000) {
    this.set({ ready: [] });
    this.setTimer(readMs(text, minMs), next);
  }

  private onReady(pid: string) {
    if (!READING.has(this.state.phase) || this.state.busy || !this.pending) return;
    if (!this.player(pid)?.hero || this.state.ready.includes(pid)) return;
    const ready = [...this.state.ready, pid];
    this.set({ ready });
    if (this.heroes().every((h) => ready.includes(h.id))) this.skip();
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

  private heroName(pid: string) {
    return this.player(pid)?.hero?.name ?? this.player(pid)?.name ?? "Someone";
  }

  /** What the DM ruled, in plain words. Redirected plans are described, never quoted. */
  private noteRuling(pitch: Pitch, v: Verdict) {
    this.bump("plans");
    const name = this.heroName(pitch.playerId);
    // Safety: player text that never reached the AI's moderation is not printed.
    const plan = v.fallback ? "(plan hidden: not reviewed)" : v.moderation === "ok" ? `"${clip(mask(pitch.text), 90)}"` : `(${clip(v.interpretation, 80)})`;
    const tier = `${TIER_LABEL[v.tier]}${autoSucceeds(v.tier) ? ", no roll" : ` (${STAT_LABEL[v.stat]})`}`;
    this.note("ruling", name, `${pitch.auto ? "Out of time, so the DM used a suggestion: " : ""}${plan} → ${tier}. ${end(v.reason || "No reason given")}`);
    if (v.moderation === "redirected") {
      this.bump("safety");
      this.note("safety", name, "Plan steered to the nearest harmless version. The original is never repeated.");
    } else if (v.moderation === "flag") {
      this.bump("safety");
      this.note("safety", name, "Plan flagged for care. The DM answered gently and kept it at Solid.");
    }
  }

  /** The die, the bonuses, the total and the band: all computed in code, never by the AI. */
  private noteRoll(r: RollResult, delay = ROLL_ANIM_MS) {
    const write = () => {
      const name = this.heroName(r.playerId);
      const v = this.state.pitches.find((p) => p.playerId === r.playerId)?.verdict;
      if (r.noRoll) return this.note("roll", name, "No roll: a Clever plan just works.");
      this.bump("rolls");
      if (r.kept === 1) this.bump("nat1");
      if (r.kept === 20) this.bump("nat20");
      const pitch = this.state.pitches.find((p) => p.playerId === r.playerId);
      const advWhy = [r.boosted && "🔥 table boost", pitch?.useAbility && v?.ability_fits && "used their ability"].filter(Boolean).join(" + ");
      const dice =
        r.dice.length > 1
          ? `d20 rolled ${r.dice.join(" and ")}, kept ${r.kept} (${r.advantage === "adv" ? `advantage: ${advWhy}` : "disadvantage: walked into their flaw"})`
          : `d20 rolled ${r.kept}`;
      const mods = v ? `, ${fmtMod(r.statBonus)} ${STAT_LABEL[v.stat]}, ${fmtMod(r.tierMod)} ${TIER_LABEL[v.tier]}` : "";
      const nat = r.kept === 1 ? " Natural 1." : r.kept === 20 ? " Natural 20." : "";
      const miracle = v?.tier === "miracle" && r.kept !== 20 ? " (only a natural 20 makes a miracle)" : "";
      this.note("roll", name, `${dice}${mods} = ${r.total} → ${end(BAND_LABEL[r.band].replace(/…$/, "") + miracle)}${nat}${r.rescuerId ? ` Caught by ${this.heroName(r.rescuerId)}.` : ""}`);
    };
    if (delay > 0) setTimeout(write, delay);
    else write();
  }

  // ---------- messages from phones ----------
  private handle(m: Msg) {
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
      case "pitch":
        return this.onPitch(m.pid, m.text, !!m.useAbility, !!m.embraceFlaw);
      case "boost":
        return this.onBoost(m.pid, m.pitchId);
      case "appeal":
        return this.onAppeal(m.pid, m.text);
      case "accept":
        return this.onAccept(m.pid);
      case "roll":
        return this.onRoll(m.pid);
      case "catch":
        return this.onCatch(m.pid, m.target);
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
    this.reactionSubs.forEach((f) => f(r));
    // Laughter shouldn't get cut off: a burst of reactions buys a reading screen a few more seconds.
    if (READING.has(this.state.phase) && this.deadlineAt && this.deadlineAt - now < 3000 && this.pending) {
      const fn = this.pending;
      this.setTimer(this.deadlineAt - now + 2500, fn);
    }
  }

  // ---------- lobby ----------
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
      ai<Hero>("character", {
        concept: text,
        partySoFar: others.map((o) => o.hero!.visual.anchor),
        avoidNames: others.map((o) => o.hero!.name),
      }),
      45_000,
      (d) => d,
      () => undefined,
    );
    if (!hero) return this.patchPlayer(pid, { status: "joined" });
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
    this.patchPlayer(pid, { status: "ready", hero, abilityAvailable: true, heart: 1 });
    const url = await image({ kind: "portrait", visual: hero.visual, flaw: hero.flaw, ability: hero.ability?.text });
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
    this.patchPlayer(pid, { status: "ready", pick: q.id, concept: q.pitch, hero, hasPortrait: false, abilityAvailable: true, heart: 1 });
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
    this.patchPlayer(pid, { truth });
    // The truth itself is PRIVATE: never put its text in the log.
    if (truth) this.note("hero", p.hero?.name ?? p.name, "Shared one true thing about themselves. It stays private: the DM may nod to it once, gently, in one scene.");
  }

  chooseQuest(id: string) {
    const seed = SEEDS.find((s) => s.id === id);
    if (!seed) return;
    this.seed = seed;
    this.sceneImages = {};
    this.set({ notes: { ...this.state.notes, safety: SAFETY_NOTES[seed.id] ?? SAFETY_GENERIC } });
    const locs = seed.locations;
    const idx = [0, Math.floor(locs.length / 2), locs.length - 1];
    const kinds = ["hook", "twist", "climax"] as const;
    const scenes: SceneView[] = kinds.map((kind, i) => ({
      kind,
      location: locs[idx[i]].name,
      description: locs[idx[i]].description,
      twist: seed.complications[i]?.what_happens ?? "",
      hasImage: false,
    }));
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
      scenes,
    });
    const pre = (questImages as Record<string, string[]>)[id];
    scenes.forEach((s, i) => {
      if (pre?.[i]) {
        // Pre-painted for the demo quests: instant and free.
        this.sceneImages[i] = pre[i];
        this.set({ scenes: this.state.scenes.map((sc, j) => (j === i ? { ...sc, hasImage: true } : sc)) });
        return;
      }
      image({
        kind: "scene",
        location: s.location,
        description: s.description,
        realm: seed.realm_name,
        threat: s.kind === "climax" ? seed.the_threat.description : "",
        quality: "best",
      }).then((url) => {
        if (!url || this.state.questId !== id) return;
        this.sceneImages[i] = url;
        this.set({ scenes: this.state.scenes.map((sc, j) => (j === i ? { ...sc, hasImage: true } : sc)) });
      });
    });
  }

  canBegin() {
    return !!this.seed && this.heroes().length > 0 && this.state.players.every((p) => p.status !== "building");
  }

  begin() {
    if (!this.canBegin()) return;
    const players = this.state.players.filter((p) => p.hero).map((p) => ({ ...p, peril: "", abilityAvailable: true, heart: 1 as const }));
    this.canon = [];
    this.ledger = [];
    this.recaps = [];
    this.recentLines = [];
    this.threatMood = this.seed!.the_threat.description.split(".")[0];
    this.reactionCounts = {};
    this.mirrorP.clear();
    this.mirrorFate.clear();
    const seed = this.seed!;
    // Keep anything the notes caught in the lobby (character safety, backups); the story starts fresh.
    this.set({
      notes: { ...this.state.notes, safety: SAFETY_NOTES[seed.id] ?? SAFETY_GENERIC, source: null, canon: [], open: [] },
    });
    this.note(
      "source",
      "The story",
      `Built from a real news story${seed.category ? ` (${seed.category.replace(/_/g, " ")})` : ""}. The headline stays hidden until the end so it can't spoil the twist.`,
    );
    this.note("safety", "Why it's safe", SAFETY_NOTES[seed.id] ?? SAFETY_GENERIC);
    this.set({
      players,
      wards: this.assignWards(players.map((p) => p.id)),
      mirrorMoments: {},
      mirror: [],
      mirrorIndex: 0,
      thanks: {},
      phase: "quest",
      saves: [],
      hope: HOPE_START,
      log: [],
      narration: this.seed!.fairytale_premise,
      question: this.state.quest?.goalShort ?? "",
      lastTime: "",
      round: null,
      final: null,
      finalMoves: {},
      epilogue: "",
      storybook: null,
      rescue: null,
    });
    this.reading(this.seed!.fairytale_premise, () => this.openScene(0), 9000);
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

  // ---------- DM state ----------
  private dmState() {
    const s = this.state;
    const scene = s.scenes[s.sceneIndex];
    return {
      quest: {
        title: s.quest?.title,
        setting: s.quest?.realm,
        goal: s.quest?.goal,
        threat: { name: this.seed?.the_threat.name, look: this.seed?.the_threat.description, mood: this.threatMood },
      },
      scene: { n: s.sceneIndex + 1, of: s.scenes.length, kind: scene?.kind, location: scene?.location, seeded_twist: scene?.twist },
      meters: { hope: s.hope, hope_max: s.hopeMax },
      party: this.heroes().map((p) => ({
        id: p.id,
        name: p.hero!.name,
        epithet: p.hero!.epithet,
        pronouns: p.hero!.pronouns,
        stats: p.hero!.stats,
        ability: { ...p.hero!.ability, available: p.abilityAvailable },
        flaw: p.hero!.flaw,
        titles: p.titles,
        peril: p.peril,
        clue: s.clues[p.id] ?? "",
        truth_hint: s.sceneIndex === 1 ? p.truth ?? "" : "", // offered in one scene only, so the nod happens at most once
      })),
      canon: this.canon.slice(-10),
      ledger: this.ledger.slice(-3),
      recaps: this.recaps.slice(-2),
      recent_lines: this.recentLines.slice(-6),
    };
  }

  // ---------- scenes ----------
  private async openScene(i: number) {
    this.clearTimer();
    const scene = this.state.scenes[i];
    const isClimax = scene.kind === "climax";
    const victim = this.heroes().find((p) => p.peril);
    const rescue = victim && !isClimax ? { victimId: victim.id, peril: victim.peril } : null;
    this.set({
      phase: "narrating",
      sceneIndex: i,
      narration: "",
      situation: "",
      banner: "",
      npcLine: { speaker: "", line: "" },
      clues: {},
      clueBecause: {},
      rescue,
      pitches: [],
      boosts: {},
      rolls: [],
      revealed: [],
      round: null,
      beatIndex: 0,
      ready: [],
      busy: "The DM flips to the next page of notes…",
    });
    const heroIds = this.heroes().map((p) => p.id);
    const input = {
      state: this.dmState(),
      scene_plan: { n: i + 1, kind: scene.kind, location: scene.location, description: scene.description, seeded_twist: scene.twist },
      recap_needed: i > 0,
      rescue: victim ? { hero_id: victim.id, hero_name: victim.hero!.name, peril: victim.peril } : undefined,
      hero_ids: heroIds,
      last_scene_outcomes: this.state.log.filter((l) => l.scene === i - 1).map((l) => `${l.hero} (${l.band}): ${l.pitch}`),
    };
    const fb = (): SceneOpen => ({
      recap: "",
      narration: `${scene.location}. ${scene.twist}`,
      question: isClimax ? "Can you end this tonight?" : "Can you get past this?",
      situation: isClimax ? "This is it. What's your final move?" : rescue ? `${victim!.hero!.name} is stuck. How do you get them out?` : "What do you do?",
      banner: rescue ? "Someone's Stuck" : "Trouble",
      npc_line: { speaker: "", line: "" },
      clues: this.heroes().map((p) => ({ hero_id: p.id, ...fallbackClue(p.hero!, scene.location) })),
      suggestions: heroIds.map((id) => ({ hero_id: id, ideas: ["Go straight at it", "Look for another way in", "Talk to whoever's in charge"] })),
      music: "eerie",
    });
    const next = () => (isClimax ? this.startPitch(true) : this.startPitch(false));
    const sceneLabel = isClimax ? "Finale" : `Scene ${i + 1}`;
    try {
      const res = await this.viaAI(`${sceneLabel} opening`, ai<SceneOpen>("scene", input), 16_000, (d, f) => (f ? fb() : d), fb);
      if (this.state.phase !== "narrating" || this.state.sceneIndex !== i) return;
      this.note("scene", `${sceneLabel} · ${scene.kind}`, `The DM was given: the place (${scene.location}) and a twist seeded from a real fact: ${clip(scene.twist, 120)}`);
      this.note("scene", sceneLabel, `Question for the table: ${res.question || fb().question}`);
      if (rescue) this.note("scene", victim!.hero!.name, `In peril from last scene (${victim!.peril}). This scene is a rescue.`);
      const truths = i === 1 ? this.heroes().filter((p) => p.truth).length : 0;
      if (truths) this.note("scene", sceneLabel, `The DM was offered ${truths} player${truths > 1 ? "s'" : "'s"} "one true thing" for one gentle nod (private, not shown here).`);
      if (res.recap) this.recaps.push(res.recap);
      const suggestions: Record<string, string[]> = {};
      res.suggestions?.forEach((s) => s?.hero_id && Array.isArray(s.ideas) && (suggestions[s.hero_id] = s.ideas));
      const clues: Record<string, string> = {};
      const clueBecause: Record<string, string> = {};
      res.clues?.forEach((c) => {
        if (!c?.hero_id || !c.clue) return;
        clues[c.hero_id] = c.clue;
        const h = this.player(c.hero_id)?.hero;
        clueBecause[c.hero_id] = String(c.because ?? "").trim() || (h ? fallbackClue(h, scene.location).because : "");
      });
      const npcLine = res.npc_line ?? { speaker: "", line: "" };
      this.set({
        narration: res.narration || fb().narration,
        situation: res.situation || fb().situation,
        question: res.question || fb().question,
        lastTime: res.recap || this.state.lastTime,
        banner: res.banner ?? "",
        npcLine,
        suggestions,
        clues,
        clueBecause,
        busy: "",
      });
      this.reading(`${res.narration ?? ""} ${npcLine.line ?? ""}`, next);
    } catch (e) {
      console.error("[host] openScene failed", e);
      const f = fb();
      const clues = Object.fromEntries(f.clues.map((c) => [c.hero_id, c.clue]));
      const clueBecause = Object.fromEntries(f.clues.map((c) => [c.hero_id, c.because ?? ""]));
      this.set({ narration: f.narration, situation: f.situation, question: f.question, banner: f.banner, npcLine: f.npc_line, clues, clueBecause, busy: "" });
      this.reading(f.narration, next);
    }
  }

  // ---------- pitch (everyone) ----------
  private isFinal() {
    return this.state.scenes[this.state.sceneIndex]?.kind === "climax";
  }

  private startPitch(final: boolean) {
    this.verdicts.clear();
    this.appeals.clear();
    this.caughtThisRound = false;
    this.set({ phase: "pitch", pitches: [], boosts: {}, rolls: [], revealed: [], round: null, beatIndex: 0, ready: [] });
    this.setTimer(final ? 30_000 : PITCH_MS, () => this.endPitch());
  }

  private onPitch(pid: string, text: string, useAbility: boolean, embraceFlaw: boolean) {
    if (this.state.phase !== "pitch") return;
    if (!this.player(pid)?.hero || this.state.pitches.some((p) => p.playerId === pid)) return;
    const clean = String(text ?? "").replace(/[<>]/g, "").trim().slice(0, 200);
    if (!clean) return;
    const pitch: Pitch = { id: `${this.state.sceneIndex}-${pid}`, playerId: pid, text: clean, useAbility, embraceFlaw };
    this.set({ pitches: [...this.state.pitches, pitch] });
    if (!this.isFinal()) this.fireVerdict(pitch);
    if (this.heroes().every((h) => this.state.pitches.some((x) => x.playerId === h.id))) this.endPitch();
  }

  private onBoost(pid: string, pitchId: string) {
    if (this.state.phase !== "pitch" || this.isFinal()) return;
    const target = this.state.pitches.find((p) => p.id === pitchId);
    if (!target || target.playerId === pid || !this.player(pid)?.hero) return;
    if (this.state.boosts[pid] === pitchId) return;
    this.set({ boosts: { ...this.state.boosts, [pid]: pitchId } });
    this.note("boost", this.heroName(pid), `🔥 boosted ${this.heroName(target.playerId)}'s plan.`);
  }

  private verdictFallback(pitch: Pitch): Verdict {
    const p = this.player(pitch.playerId);
    return {
      interpretation: "tries their plan",
      fallback: true,
      stat: bestStat(p?.hero),
      tier: "solid",
      ability_fits: false,
      flaw_walk_in: false,
      quip: "Sure. Roll for it.",
      on_success: "It works.",
      on_failure: "It doesn't.",
      moderation: "ok",
      reason: "Backup ruling: the AI didn't answer in time, so it counts as Solid",
    };
  }

  private askVerdict(pitch: Pitch, appeal?: { text: string; previous: Verdict }) {
    const p = this.player(pitch.playerId)!;
    const r = this.state.rescue;
    const others = this.state.pitches.filter((x) => x.id !== pitch.id).map((x) => x.text);
    const fb = (): Verdict =>
      appeal ? { ...appeal.previous, reason: "The DM didn't answer in time, so the first ruling stands", appealUnreviewed: true } : this.verdictFallback(pitch);
    return this.viaAI(
      appeal ? `Ruling on ${p.hero?.name}'s argument` : `Ruling on ${p.hero?.name}'s plan`,
      ai<{ verdicts: (Verdict & { pitch_id: string })[] }>("verdict", {
        state: this.dmState(),
        rescue: r ? { hero_in_peril: this.player(r.victimId)?.hero?.name, peril: r.peril } : undefined,
        pitches: [
          {
            pitch_id: pitch.id,
            hero_id: p.id,
            hero_name: p.hero?.name,
            clue: this.state.clues[p.id] ?? "",
            use_ability: pitch.useAbility && p.abilityAvailable,
            embrace_flaw: pitch.embraceFlaw,
            best_stat: bestStat(p.hero),
            text: pitch.text,
            appeal: appeal?.text ?? "",
            previous_tier: appeal?.previous.tier ?? "",
          },
        ],
        other_pitches: others,
      }),
      9000,
      (d, f): Verdict | null => (f ? fb() : (d?.verdicts?.[0] ?? null)),
      fb,
    );
  }

  private fireVerdict(pitch: Pitch) {
    const v = this.askVerdict(pitch);
    this.verdicts.set(pitch.id, v);
    // Show each stamp as soon as it lands, so the phone can offer "Convince the DM" right away.
    v.then((verdict) => {
      if (this.state.phase !== "pitch" && this.state.phase !== "appeal") return;
      this.noteRuling(pitch, verdict);
      this.set({ pitches: this.state.pitches.map((x) => (x.id === pitch.id ? { ...x, verdict } : x)) });
    });
  }

  private async endPitch() {
    if (this.state.phase !== "pitch") return;
    this.clearTimer();
    // Nobody is skipped: whoever ran out of time does the first thing that comes to mind.
    const missing = this.heroes().filter((h) => !this.state.pitches.some((p) => p.playerId === h.id));
    const autos: Pitch[] = missing.map((h) => ({
      id: `${this.state.sceneIndex}-${h.id}`,
      playerId: h.id,
      text: this.state.suggestions[h.id]?.[0] ?? "does the first thing that comes to mind",
      useAbility: false,
      embraceFlaw: false,
      auto: true,
    }));
    this.set({ pitches: [...this.state.pitches, ...autos] });
    // Plans are locked, so the secret clues can go public in the notes.
    this.heroes().forEach((h) => this.state.clues[h.id] && this.note("clue", h.hero!.name, `Secret clue the DM gave them${this.state.clueBecause[h.id] ? ` (because ${this.state.clueBecause[h.id]})` : ""}: ${this.state.clues[h.id]}`));
    if (this.isFinal()) {
      this.note("ruling", "Finale", "Final moves are in. No rulings in the finale: one shared roll decides (best die + Hope).");
      this.set({ finalMoves: Object.fromEntries(this.state.pitches.map((p) => [p.playerId, p.text])) });
      return this.startFinalRoll();
    }
    autos.forEach((p) => this.fireVerdict(p));
    this.set({ busy: "The DM is reading your plans…" });
    const judged = await Promise.all(this.state.pitches.map(async (p) => ({ ...p, verdict: await this.verdicts.get(p.id)! })));
    if (this.state.phase !== "pitch") return;
    this.set({ pitches: judged, busy: "" });
    // "Convince the DM": anyone whose plan needs a roll gets one shot to argue for it.
    if (judged.some((p) => !autoSucceeds(p.verdict!.tier) && !p.auto)) {
      this.set({ phase: "appeal" });
      this.setTimer(APPEAL_MS, () => this.endAppeal());
    } else {
      this.startRoll();
    }
  }

  private appealable(pid: string) {
    const p = this.state.pitches.find((x) => x.playerId === pid);
    return p && p.verdict && !autoSucceeds(p.verdict.tier) && !p.auto && !p.appealed && !this.appeals.has(p.id) ? p : undefined;
  }

  private onAppeal(pid: string, text: string) {
    if (this.state.phase !== "appeal") return;
    const pitch = this.appealable(pid);
    const clean = String(text ?? "").replace(/[<>]/g, "").trim().slice(0, 240);
    if (!pitch || !clean) return;
    this.set({ pitches: this.state.pitches.map((x) => (x.id === pitch.id ? { ...x, appeal: clean } : x)) });
    const previous = pitch.verdict!;
    const v = this.askVerdict({ ...pitch, appeal: clean }, { text: clean, previous }).then((nv) => {
      // An argument can only help: never lower the tier.
      if (TIER_RANK[nv.tier] >= TIER_RANK[previous.tier]) return nv;
      return { ...nv, tier: previous.tier, reason: `${nv.reason ? nv.reason + ". " : ""}An argument can only help, so it stays ${TIER_LABEL[previous.tier]}` };
    });
    this.appeals.set(pitch.id, v);
    v.then((verdict) => {
      const changed = verdict.tier !== previous.tier;
      this.bump("appeals");
      if (changed) this.bump("appealsChanged");
      const arg = verdict.appealUnreviewed
        ? "Made an argument (hidden: not reviewed). "
        : verdict.moderation === "ok"
          ? `Argued "${clip(mask(clean), 80)}". `
          : "Made an argument (steered to a harmless version). ";
      const ruling = changed ? `${TIER_LABEL[previous.tier]} → ${TIER_LABEL[verdict.tier]}` : `Stays ${TIER_LABEL[verdict.tier]}`;
      this.note("appeal", this.heroName(pid), `${arg}${ruling}: ${end(verdict.reason || "no reason given")}`);
      if (verdict.moderation !== "ok" && previous.moderation === "ok") this.bump("safety");
      if (this.state.phase !== "appeal") return;
      this.set({ pitches: this.state.pitches.map((x) => (x.id === pitch.id ? { ...x, verdict, appealed: true } : x)) });
      this.maybeEndAppeal();
    });
  }

  private onAccept(pid: string) {
    if (this.state.phase !== "appeal") return;
    const pitch = this.appealable(pid);
    if (!pitch) return;
    this.set({ pitches: this.state.pitches.map((x) => (x.id === pitch.id ? { ...x, appealed: true } : x)) });
    this.maybeEndAppeal();
  }

  private maybeEndAppeal() {
    const waiting = this.state.pitches.some((p) => p.verdict && !autoSucceeds(p.verdict.tier) && !p.auto && !p.appealed);
    if (!waiting) this.endAppeal();
  }

  private async endAppeal() {
    if (this.state.phase !== "appeal") return;
    this.clearTimer();
    if (this.appeals.size) {
      this.set({ busy: "The DM is considering your arguments…" });
      const settled = await Promise.all(
        this.state.pitches.map(async (p) => (this.appeals.has(p.id) ? { ...p, verdict: await this.appeals.get(p.id)!, appealed: true } : p)),
      );
      if (this.state.phase !== "appeal") return;
      this.set({ pitches: settled, busy: "" });
    }
    this.startRoll();
  }

  // ---------- roll (everyone) ----------
  private boostedPitchId() {
    const counts: Record<string, number> = {};
    Object.values(this.state.boosts).forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) return "";
    return ranked[0][0];
  }

  private makeRoll(pitch: Pitch, rescuerId = "", forceDice = false): RollResult {
    const p = this.player(pitch.playerId)!;
    const v = pitch.verdict ?? this.verdictFallback(pitch);
    const boosted = this.boostedPitchId() === pitch.id;
    const statBonus = p.hero!.stats[v.stat] ?? 0;
    const tierMod = TIER_MOD[v.tier];
    if (autoSucceeds(v.tier) && !forceDice) {
      return { playerId: p.id, dice: [], kept: 0, advantage: "none", statBonus, tierMod, total: 15 + statBonus + tierMod, band: "SUCCESS", rescuerId, noRoll: true, boosted };
    }
    const usesAbility = pitch.useAbility && v.ability_fits;
    const adv = boosted || usesAbility;
    const dis = v.flaw_walk_in && !pitch.embraceFlaw;
    const advantage = adv && !dis ? "adv" : dis && !adv ? "dis" : "none";
    const dice = advantage === "none" ? [d20()] : [d20(), d20()];
    const kept = advantage === "adv" ? Math.max(...dice) : advantage === "dis" ? Math.min(...dice) : dice[0];
    const total = kept + statBonus + tierMod;
    return { playerId: p.id, dice, kept, advantage, statBonus, tierMod, total, band: band(kept, total, v.tier), rescuerId, noRoll: false, boosted };
  }

  private sortRolls(rolls: RollResult[]) {
    // Lowest result first, so the round ends on its best moment.
    return [...rolls].sort((a, b) => a.total - b.total);
  }

  private startRoll() {
    const rolls = this.sortRolls(this.state.pitches.map((p) => this.makeRoll(p)));
    // Spend abilities that were used.
    this.state.pitches.forEach((p) => {
      if (p.useAbility && p.verdict?.ability_fits && this.player(p.playerId)?.abilityAvailable) this.patchPlayer(p.playerId, { abilityAvailable: false });
    });
    const revealed = rolls.filter((r) => r.noRoll).map((r) => r.playerId);
    const boostedId = this.boostedPitchId();
    if (boostedId) {
      const n = Object.values(this.state.boosts).filter((id) => id === boostedId).length;
      const owner = this.state.pitches.find((p) => p.id === boostedId)?.playerId ?? "";
      this.note("boost", this.heroName(owner), `Most 🔥 from the table (${n}): rolls with advantage, 2 dice, keep the higher.`);
    } else if (Object.keys(this.state.boosts).length) {
      this.note("boost", "The table", "🔥 votes tied, so nobody gets the boost this round.");
    }
    rolls.filter((r) => r.noRoll).forEach((r) => this.noteRoll(r, 0));
    this.roundP = this.fetchRound(rolls);
    this.set({ phase: "roll", rolls, revealed, catchers: [] });
    if (revealed.length === rolls.length) return this.afterRoll();
    this.setTimer(ROLL_MS, () => this.revealAll());
  }

  private onRoll(pid: string) {
    if (this.state.phase === "roll") {
      if (!this.state.rolls.some((r) => r.playerId === pid) || this.state.revealed.includes(pid)) return;
      const revealed = [...this.state.revealed, pid];
      this.set({ revealed });
      const r = this.state.rolls.find((x) => x.playerId === pid);
      if (r) this.noteRoll(r);
      if (revealed.length === this.state.rolls.length) {
        this.clearTimer();
        setTimeout(() => this.afterRoll(), ROLL_ANIM_MS);
      }
      return;
    }
    if (this.state.phase === "final_roll") return this.revealFinalDie(pid);
  }

  private revealAll() {
    if (this.state.phase !== "roll") return;
    this.clearTimer();
    this.state.rolls.filter((r) => !this.state.revealed.includes(r.playerId)).forEach((r) => this.noteRoll(r));
    this.set({ revealed: this.state.rolls.map((r) => r.playerId) });
    setTimeout(() => this.afterRoll(), ROLL_ANIM_MS);
  }

  private afterRoll() {
    if (this.state.phase !== "roll") return;
    const failed = this.state.rolls.filter((r) => isFailure(r.band) && !r.rescuerId);
    if (failed.length && !this.caughtThisRound) {
      const catchers = this.heroes()
        .filter((p) => p.heart === 1 && failed.some((f) => f.playerId !== p.id))
        .map((p) => p.id);
      if (catchers.length) {
        this.set({ phase: "catch", catchers });
        this.setTimer(CATCH_MS, () => this.resolveRound());
        return;
      }
    }
    this.resolveRound();
  }

  private onCatch(pid: string, targetPid?: string) {
    if (this.state.phase !== "catch" || !this.state.catchers.includes(pid) || this.caughtThisRound) return;
    const failed = this.state.rolls.filter((r) => isFailure(r.band) && r.playerId !== pid);
    const target = failed.find((r) => r.playerId === targetPid) ?? [...failed].sort((a, b) => a.total - b.total)[0];
    if (!target) return;
    this.clearTimer();
    this.caughtThisRound = true;
    this.patchPlayer(pid, { heart: 0 });
    const pitch = this.state.pitches.find((p) => p.playerId === target.playerId)!;
    const reroll = this.makeRoll(pitch, pid, true);
    this.note("catch", this.heroName(pid), `Catch! Spent their one heart to re-roll ${this.heroName(target.playerId)}'s ${BAND_LABEL[target.band]}.`);
    this.noteRoll(reroll);
    const rolls = this.sortRolls(this.state.rolls.map((r) => (r.playerId === target.playerId ? reroll : r)));
    this.roundP = this.fetchRound(rolls);
    this.set({ phase: "roll", rolls, catchers: [], revealed: this.state.revealed });
    setTimeout(() => this.resolveRound(true), ROLL_ANIM_MS + 400);
  }

  private fetchRound(rolls: RollResult[]): Promise<RoundOutcome> {
    const r = this.state.rescue;
    const actions = rolls.map((roll) => {
      const pitch = this.state.pitches.find((p) => p.playerId === roll.playerId)!;
      const hero = this.player(roll.playerId)!.hero!;
      return {
        hero_id: roll.playerId,
        hero_name: hero.name,
        pitch: pitch.text,
        appeal: pitch.appeal ?? "",
        interpretation: pitch.verdict?.interpretation ?? pitch.text,
        stat: pitch.verdict?.stat,
        tier: pitch.verdict?.tier,
        band: roll.band,
        no_roll_needed: roll.noRoll,
        natural: roll.kept === 1 || roll.kept === 20 ? roll.kept : null,
        caught_by: roll.rescuerId ? this.player(roll.rescuerId)?.hero?.name ?? "" : "",
        boosted: roll.boosted,
        embrace_flaw: pitch.embraceFlaw,
        on_success: pitch.verdict?.on_success ?? "",
        on_failure: pitch.verdict?.on_failure ?? "",
      };
    });
    const p: Promise<RoundOutcome> = ai<RoundOutcome>("round", {
      state: this.dmState(),
      rescue_of: r ? this.player(r.victimId)?.hero?.name ?? "" : "",
      actions,
      recent_lines: this.recentLines.slice(-6),
    }).then((res) => {
      if (res.fallback && this.roundP === p) this.fellBack("Round narration", "the AI call failed");
      return res.data;
    });
    p.catch(() => {});
    return p;
  }

  private roundFallback(): RoundOutcome {
    const worst = this.state.rolls.find((r) => r.band === "CATASTROPHE");
    return {
      headline: "Well, That Happened",
      beats: this.state.rolls.map((r) => ({
        hero_id: r.playerId,
        text: FALLBACK_BEAT[r.band][0].replaceAll("{name}", this.player(r.playerId)?.hero?.name ?? "You"),
      })),
      now: "Everyone is still here, which counts for something.",
      complication: "",
      titles: [],
      peril: worst && !this.state.rescue ? { hero_id: worst.playerId, text: "stuck somewhere very inconvenient" } : { hero_id: "", text: "" },
      new_canon: [],
      threat_mood: "",
      highlight_score: 5,
      sfx: "none",
    };
  }

  private async resolveRound(fromCatch = false) {
    if (this.state.phase !== "catch" && !(fromCatch && this.state.phase === "roll") && this.state.phase !== "roll") return;
    this.clearTimer();
    this.set({ phase: "outcome", catchers: [], busy: "The DM is writing it all down…", beatIndex: 0, round: null });
    // withTimeout calls its fallback when the timer fires even if the call already won, so only log a real miss.
    let settled = false;
    const rp = (this.roundP ?? Promise.resolve(this.roundFallback())).then((o) => ((settled = true), o));
    let out = await withTimeout(rp, 14_000, () => {
      if (!settled) this.fellBack("Round narration", "no answer within 14s");
      return this.roundFallback();
    });
    if (!out || !Array.isArray(out.beats)) {
      this.fellBack("Round narration", "the AI's answer was unusable");
      out = this.roundFallback();
    }
    // One beat per hero, in roll order, even if the model dropped one.
    const fb = this.roundFallback();
    const beats = this.state.rolls.map((r) => out.beats.find((b) => b.hero_id === r.playerId) ?? fb.beats.find((b) => b.hero_id === r.playerId)!);
    out = { ...fb, ...out, beats, new_canon: Array.isArray(out.new_canon) ? out.new_canon : [], titles: Array.isArray(out.titles) ? out.titles : [] };
    try {
      this.applyRound(out);
    } catch (e) {
      console.error("[host] applyRound failed", e);
    }
    this.set({ round: out, busy: "", beatIndex: 0 });
    this.stepBeat(0);
  }

  /** Beat cards one at a time (Continue / all Ready / timer), then the wrap line, then the next scene. */
  private stepBeat(i: number) {
    const out = this.state.round!;
    this.set({ beatIndex: i });
    if (i < out.beats.length) return this.reading(out.beats[i].text, () => this.stepBeat(i + 1), 6000);
    this.reading(out.now, () => this.afterRound(), 5000);
  }

  private applyRound(out: RoundOutcome) {
    const rolls = this.state.rolls;
    const rescue = this.state.rescue;
    const fails = rolls.filter((r) => isFailure(r.band)).length;
    const wins = rolls.length - fails;
    const nat1s = rolls.filter((r) => r.kept === 1).length;
    const before = this.state.hope;
    let hope = before;
    const why: string[] = [];
    if (fails > wins) {
      hope -= 1;
      why.push("more plans failed than worked (−1)");
    }
    if (nat1s) {
      hope -= Math.min(2, nat1s);
      why.push(`natural 1 (−${Math.min(2, nat1s)})`);
    }
    if (rolls.some((r) => r.kept === 20)) {
      hope += 1;
      why.push("natural 20 (+1)");
    }
    if (this.state.pitches.some((p) => p.embraceFlaw && SUCCESS_BANDS.includes(rolls.find((r) => r.playerId === p.playerId)?.band ?? "FAIL"))) {
      hope += 1;
      why.push("someone leaned into their flaw and it worked (+1)");
    }
    hope = Math.max(0, Math.min(this.state.hopeMax, hope));
    this.bump("rounds");
    this.note(
      "hope",
      "Hope",
      hope === before
        ? `Stays at ${hope}${why.length ? `: ${why.join(", ")}` : ": failures didn't outnumber wins, and no natural 1s or 20s"}${why.length && hope === this.state.hopeMax ? " (already full)" : ""}.`
        : `${before} → ${hope}: ${why.join(", ")}${hope === 0 ? ". Hope ran out, so the story ends early" : ""}.`,
    );

    const rescued = rescue && rolls.some((r) => r.playerId !== rescue.victimId && SUCCESS_BANDS.includes(r.band));
    const catastrophes = rolls.filter((r) => r.band === "CATASTROPHE");
    let perilId = "";
    let perilText = "";
    if (!rescue && catastrophes.length) {
      const named = catastrophes.find((r) => r.playerId === out.peril?.hero_id);
      perilId = (named ?? catastrophes[0]).playerId;
      perilText = named && out.peril.text ? out.peril.text : "stuck somewhere very inconvenient";
    }

    const players = this.state.players.map((p) => {
      const roll = rolls.find((r) => r.playerId === p.id);
      const titles = [...p.titles, ...out.titles.filter((t) => t.hero_id === p.id && t.title).map((t) => t.title)];
      let { peril, abilityAvailable } = p;
      if (roll?.kept === 20) abilityAvailable = true;
      if (p.id === perilId) peril = perilText;
      if (rescued && p.id === rescue!.victimId) peril = "";
      return { ...p, titles: [...new Set(titles)].slice(-4), peril, abilityAvailable };
    });

    this.recordSaves(rolls, rescue, !!rescued);
    if (out.complication) this.ledger.push(out.complication);
    this.canon.push(...out.new_canon);
    if (out.threat_mood) this.threatMood = out.threat_mood;
    if (perilId) this.note("roll", this.heroName(perilId), `Natural 1: now stuck (${clip(perilText, 80)}). Friends rescue them next scene.`);
    if (rescued) this.note("roll", this.heroName(rescue!.victimId), "Rescued: a friend's plan worked, so they're free.");
    this.set({ notes: { ...this.state.notes, canon: this.canon.slice(-10), open: this.ledger.slice(-3) } });
    this.recentLines.push(...out.beats.map((b) => b.text));
    this.set({
      hope,
      players,
      lastTime: out.now || this.state.lastTime,
      log: [
        ...this.state.log,
        ...rolls.map((r) => {
          const pitch = this.state.pitches.find((p) => p.playerId === r.playerId);
          return {
            scene: this.state.sceneIndex,
            heroId: r.playerId,
            hero: this.player(r.playerId)?.hero?.name ?? "",
            pitch: pitch?.text ?? "",
            band: r.band,
            headline: out.headline,
            narration: out.beats.find((b) => b.hero_id === r.playerId)?.text ?? "",
            rescue: !!rescue,
          };
        }),
      ],
    });
  }

  private afterRound() {
    if (this.state.hope <= 0) return this.finish(true);
    this.openScene(this.state.sceneIndex + 1);
  }

  // ---------- final roll (all together) ----------
  /** Arm your die, then one shared "3, 2, 1, SHAKE!" on the TV and every phone, then all the dice land at once. */
  private startFinalRoll() {
    this.finalDice = {};
    this.heroes().forEach((p) => (this.finalDice[p.id] = d20()));
    this.set({
      phase: "final_roll",
      final: { dice: {}, rolled: [], best: "", hopeBonus: this.state.hope, total: 0, ending: "BITTERSWEET", stage: "arm", armed: [], shook: [], auto: [] },
    });
    this.setTimer(FINAL_ARM_MS, () => this.startCountdown());
    // Safety net: whatever happens to the phones, the ending always arrives.
    if (this.finalSafety) clearTimeout(this.finalSafety);
    this.finalSafety = setTimeout(() => this.state.phase === "final_roll" && this.finish(false), FINAL_ROLL_MS + 20_000);
  }

  private patchFinal(patch: Partial<NonNullable<GameState["final"]>>) {
    if (this.state.final) this.set({ final: { ...this.state.final, ...patch } });
  }

  private onArm(pid: string) {
    const f = this.state.final;
    if (this.state.phase !== "final_roll" || f?.stage !== "arm" || !(pid in this.finalDice) || f.armed?.includes(pid)) return;
    const armed = [...(f.armed ?? []), pid];
    this.patchFinal({ armed });
    if (Object.keys(this.finalDice).every((id) => armed.includes(id))) this.startCountdown();
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
    this.setTimer(FINAL_SHAKE_MS, () => this.startTumble());
    this.broadcastNow();
  }

  /** A shake (or the big tap fallback). A hair early is fine: phones and the TV are never perfectly in sync. */
  private revealFinalDie(pid: string) {
    const f = this.state.final;
    if (!f || !(pid in this.finalDice) || f.shook?.includes(pid)) return;
    const early = f.stage === "count" && this.deadlineAt - Date.now() < 700;
    if (f.stage !== "shake" && !early) return;
    const shook = [...(f.shook ?? []), pid];
    this.patchFinal({ shook });
    if (Object.keys(this.finalDice).every((id) => shook.includes(id))) this.startTumble();
  }

  /** Whoever didn't shake in time gets rolled for, then every die tumbles together under one drumroll. */
  private startTumble() {
    const f = this.state.final;
    if (this.state.phase !== "final_roll" || !f || (f.stage !== "shake" && f.stage !== "count")) return;
    const ids = Object.keys(this.finalDice);
    const auto = ids.filter((id) => !f.shook?.includes(id));
    this.patchFinal({ stage: "tumble", shook: ids, auto });
    this.setTimer(FINAL_TUMBLE_MS, () => this.landFinal());
  }

  private landFinal() {
    if (this.state.phase !== "final_roll") return;
    const dice = { ...this.finalDice };
    this.patchFinal({ stage: "landed", dice, rolled: Object.keys(dice) });
    const auto = new Set(this.state.final?.auto ?? []);
    Object.entries(dice).forEach(([pid, die]) => {
      this.bump("rolls");
      if (die === 1) this.bump("nat1");
      if (die === 20) this.bump("nat20");
      const how = auto.has(pid) ? "Didn't shake in time, so the game rolled for them" : "Shook their phone";
      this.note("roll", this.heroName(pid), `Final roll: ${how}. d20 rolled ${die}.${die === 20 ? " Natural 20." : die === 1 ? " Natural 1." : ""}`);
    });
    this.setTimer(FINAL_LAND_MS, () => this.finish(false));
  }

  private finish(grim: boolean) {
    if (["final_result", ...MIRROR_PHASES, "epilogue", "reveal", "storybook"].includes(this.state.phase)) return;
    this.clearTimer();
    if (this.finalSafety) clearTimeout(this.finalSafety);
    this.finalSafety = null;
    const dice = grim ? {} : { ...this.finalDice };
    const best = Object.entries(dice).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const total = grim ? 0 : (dice[best] ?? 0) + this.state.hope;
    const final = {
      dice,
      rolled: Object.keys(dice),
      best,
      hopeBonus: this.state.hope,
      total,
      ending: grim ? ("GRIM_BUT_HILARIOUS" as const) : ending(total, this.state.hope),
    };
    const players = this.state.players.map((p) => ({ ...p, peril: "" }));
    const tapped = this.state.final?.rolled ?? [];
    this.set({ phase: "final_result", final, players, ready: [] });
    if (grim) {
      this.note("roll", "The ending", `Hope hit 0, so it ends early: ${ENDING_LABEL[final.ending]}. Still a happy-ish ending, never a cruel one.`);
    } else {
      this.bump("rounds");
      const unrolled = Object.keys(dice).filter((id) => !tapped.includes(id));
      unrolled.forEach((id) => {
        this.bump("rolls");
        if (dice[id] === 1) this.bump("nat1");
        if (dice[id] === 20) this.bump("nat20");
      });
      const auto = unrolled.length ? ` (the game rolled for ${unrolled.length} who didn't tap in time)` : "";
      // After the last die's own note (those wait for the roll animation).
      setTimeout(
        () => this.note("roll", "The ending", `Best die ${dice[best] ?? 0} + Hope ${final.hopeBonus} = ${total} → ${ENDING_LABEL[final.ending]}${auto}. 20+ wins, 12+ mostly works.`),
        ROLL_ANIM_MS + 200,
      );
    }

    const heroes = this.heroes().map((p) => ({ id: p.id, name: p.hero!.name }));
    const st = this.dmState();
    const name = (id: string) => this.player(id)?.hero?.name ?? "";
    const finalInfo = {
      dice: Object.fromEntries(Object.entries(dice).map(([k, v]) => [name(k), v])),
      best: name(best),
      hope_bonus: final.hopeBonus,
      total,
      ending: final.ending,
      final_moves: Object.fromEntries(Object.entries(this.state.finalMoves).map(([k, v]) => [name(k), v])),
    };
    this.epilogueP = this.viaAI(
      "Epilogue",
      ai<string>("epilogue", { state: st, final: finalInfo, log: this.state.log.map((l) => `${l.hero}: ${l.pitch} (${l.band})`) }),
      20_000,
      (d) => (typeof d === "string" && d.trim() ? d : null),
      () => "The dice land and, somehow, it holds. Everyone goes home with a story nobody will believe. And that's the version they'll never print.",
    );
    const crowd = Object.entries(this.reactionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const images = this.state.scenes.map((_, i) => `scene_${i + 1}`);
    const bookFallback = (): Storybook => ({
      title: this.state.quest?.title ?? "A Tale",
      dedication: `For ${heroes.map((h) => h.name).join(", ")}.`,
      pages: this.state.log.length
        ? this.state.log.slice(0, 5).map((l, i) => ({ text: `${l.hero}: "${l.pitch}" ${l.narration}`, image_ref: images[Math.min(i, images.length - 1)] }))
        : [{ text: "A group of people who did not know what they were doing figured it out anyway.", image_ref: images[0] }],
      hero_pages: heroes.map((h) => ({ hero_id: h.id, best_moment: `${h.name} was there when it mattered.`, award: "Showed Up" })),
      moral: "Go together or don't go.",
      real_story_bridge: "",
    });
    this.storybookP = this.viaAI(
      "Storybook",
      ai<Storybook>("storybook", {
        state: st,
        title: this.state.quest?.title,
        heroes,
        log: this.state.log,
        final_moves: finalInfo.final_moves,
        ending: final.ending,
        crowd_favorite: crowd,
        thank_yous: this.thankYous(),
        available_images: images,
        real_story: this.seed?.the_real_story,
      }),
      30_000,
      (d) => (Array.isArray(d?.pages) && d.pages.length ? d : null),
      bookFallback,
    );
    this.setTimer(grim ? 2500 : 4500, () => (Object.keys(this.state.wards).length ? this.startMirror() : this.startEpilogue()));
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

  private startMirror() {
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
    this.setTimer(MIRROR_WRITE_MS, () => this.endMirrorWrite());
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
      ai<{ ok: boolean; sentence: string }>("kind", { ward_name: h.name, pronouns: h.pronouns, frame: mirrorFrame(h), moments, draft }),
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
  }

  private endMirrorWrite() {
    if (this.state.phase !== "mirror_write") return;
    this.clearTimer();
    // Whoever ran out of time: the DM writes one warm line from what their ward actually did.
    this.state.mirror.forEach((c) => {
      if (!this.mirrorP.has(c.guardianId)) this.polish(c.guardianId, "");
    });
    this.set({ phase: "mirror_guess" });
    this.setTimer(MIRROR_GUESS_MS, () => this.startMirrorReveal());
  }

  private onMirrorGuess(pid: string, text: string) {
    if (this.state.phase !== "mirror_guess") return;
    const card = this.state.mirror.find((c) => c.wardId === pid);
    const clean = String(text ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!card || card.guess || !clean) return;
    const mirror = this.state.mirror.map((c) => (c.wardId === pid ? { ...c, guess: clean } : c));
    this.set({ mirror });
    if (mirror.every((c) => c.guess)) this.startMirrorReveal();
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
    if (!card) return this.startEpilogue();
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
    this.reactionSubs.forEach((f) => f(r));
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
    const name = (id: string) => this.player(id)?.hero?.name ?? "";
    return this.state.saves
      .filter((x) => x.thanked)
      .map((x) => {
        const by = x.byIds.map(name).filter(Boolean);
        const list = by.length > 1 ? `${by.slice(0, -1).join(", ")} and ${by[by.length - 1]}` : by[0] ?? "a friend";
        return `${name(x.savedId)} thanked ${list} for ${x.kind === "catch" ? "the save" : "the rescue"}`;
      });
  }

  private async startEpilogue() {
    this.clearTimer();
    this.set({ phase: "epilogue", busy: "The DM wraps it up…", ready: [] });
    const text = await this.epilogueP!;
    this.set({ epilogue: text, busy: "" });
    this.reading(text, () => this.startReveal(), 10000);
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
    this.set({ phase: "reveal" });
    this.reading(`${this.seed?.the_real_story.headline ?? ""} ${this.seed?.the_real_story.summary ?? ""}`, () => this.showStorybook(), 15000);
  }

  private async showStorybook() {
    this.clearTimer();
    this.set({ phase: "storybook", busy: "Putting your story together…" });
    const book = await this.storybookP!;
    this.set({ storybook: book, busy: "" });
    this.saveToShelf(book);
  }

  private async saveToShelf(book: Storybook) {
    try {
      const last = this.sceneImages[this.state.scenes.length - 1] ?? this.sceneImages[0];
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
    this.seed = undefined;
    this.sceneImages = {};
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
      busy: "",
      ready: [],
    });
    this.notesStart = Date.now();
    this.mirrorP.clear();
    this.mirrorFate.clear();
  }

  close() {
    this.clearTimer();
    this.t.close();
  }
}
