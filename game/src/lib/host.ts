"use client";
import seedsJson from "@/data/seed_quests.json";
import questImages from "@/data/quest_images.json";
import { ai, image, thumbnail, withTimeout } from "./api";
import {
  APPEAL_MS,
  CATCH_MS,
  FINAL_ROLL_MS,
  HOPE_MAX,
  HOPE_START,
  PITCH_MS,
  PLAYER_COLORS,
  ROLL_ANIM_MS,
  ROLL_MS,
  TIER_MOD,
  autoSucceeds,
  band,
  d20,
  ending,
  isFailure,
  readMs,
} from "./rules";
import { openRoom, type Msg, type Transport } from "./transport";
import type {
  Band,
  GameState,
  Hero,
  Pitch,
  Player,
  QuestSeed,
  RollResult,
  RoundOutcome,
  SceneOpen,
  SceneView,
  Stat,
  Storybook,
  Verdict,
} from "./types";

const SEEDS = seedsJson as QuestSeed[];

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

const READING = new Set(["quest", "narrating", "outcome", "epilogue", "reveal"]);
const SUCCESS_BANDS: Band[] = ["YES_BUT", "SUCCESS", "LEGENDARY"];

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
      rescue: null,
      pitches: [],
      boosts: {},
      rolls: [],
      revealed: [],
      catchers: [],
      round: null,
      beatIndex: 0,
      ready: [],
      deadline: 0,
      final: null,
      finalMoves: {},
      epilogue: "",
      storybook: null,
      log: [],
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
    const { data: hero } = await ai<Hero>("character", {
      concept: text,
      partySoFar: others.map((o) => o.hero!.visual.anchor),
      avoidNames: others.map((o) => o.hero!.name),
    }).catch(() => ({ data: undefined as unknown as Hero }));
    if (!hero) return this.patchPlayer(pid, { status: "joined" });
    this.patchPlayer(pid, { status: "ready", hero, abilityAvailable: true, heart: 1 });
    const url = await image({ kind: "portrait", visual: hero.visual, flaw: hero.flaw, ability: hero.ability?.text });
    if (!url || this.player(pid)?.hero !== hero) return;
    this.portraits[pid] = url;
    this.thumbs[pid] = await thumbnail(url);
    this.t.send({ type: "portrait", pid, url: this.thumbs[pid] });
    this.patchPlayer(pid, { hasPortrait: true });
  }

  chooseQuest(id: string) {
    const seed = SEEDS.find((s) => s.id === id);
    if (!seed) return;
    this.seed = seed;
    this.sceneImages = {};
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
    this.set({
      players,
      phase: "quest",
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
      clues: [],
      suggestions: heroIds.map((id) => ({ hero_id: id, ideas: ["Go straight at it", "Look for another way in", "Talk to whoever's in charge"] })),
      music: "eerie",
    });
    const next = () => (isClimax ? this.startPitch(true) : this.startPitch(false));
    try {
      const res = await withTimeout(
        ai<SceneOpen>("scene", input).then((r) => (r.fallback ? fb() : r.data)),
        16_000,
        fb,
      );
      if (this.state.phase !== "narrating" || this.state.sceneIndex !== i) return;
      if (res.recap) this.recaps.push(res.recap);
      const suggestions: Record<string, string[]> = {};
      res.suggestions?.forEach((s) => s?.hero_id && Array.isArray(s.ideas) && (suggestions[s.hero_id] = s.ideas));
      const clues: Record<string, string> = {};
      res.clues?.forEach((c) => c?.hero_id && c.clue && (clues[c.hero_id] = c.clue));
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
        busy: "",
      });
      this.reading(`${res.narration ?? ""} ${npcLine.line ?? ""}`, next);
    } catch (e) {
      console.error("[host] openScene failed", e);
      const f = fb();
      this.set({ narration: f.narration, situation: f.situation, question: f.question, banner: f.banner, npcLine: f.npc_line, busy: "" });
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
    this.set({ boosts: { ...this.state.boosts, [pid]: pitchId } });
  }

  private verdictFallback(pitch: Pitch): Verdict {
    const p = this.player(pitch.playerId);
    return {
      interpretation: pitch.text.slice(0, 80),
      stat: bestStat(p?.hero),
      tier: "solid",
      ability_fits: false,
      flaw_walk_in: false,
      quip: "Sure. Roll for it.",
      on_success: "It works.",
      on_failure: "It doesn't.",
      moderation: "ok",
    };
  }

  private askVerdict(pitch: Pitch, appeal?: { text: string; previous: Verdict }) {
    const p = this.player(pitch.playerId)!;
    const r = this.state.rescue;
    const others = this.state.pitches.filter((x) => x.id !== pitch.id).map((x) => x.text);
    return withTimeout(
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
      }).then((res) => res.data.verdicts[0] ?? appeal?.previous ?? this.verdictFallback(pitch)),
      9000,
      () => appeal?.previous ?? this.verdictFallback(pitch),
    );
  }

  private fireVerdict(pitch: Pitch) {
    const v = this.askVerdict(pitch);
    this.verdicts.set(pitch.id, v);
    // Show each stamp as soon as it lands, so the phone can offer "Convince the DM" right away.
    v.then((verdict) => {
      if (this.state.phase !== "pitch" && this.state.phase !== "appeal") return;
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
    if (this.isFinal()) {
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
      const rank = { miracle: 0, absurd: 1, risky: 2, solid: 3, clever: 4 } as const;
      return rank[nv.tier] >= rank[previous.tier] ? nv : { ...nv, tier: previous.tier };
    });
    this.appeals.set(pitch.id, v);
    v.then((verdict) => {
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
    const p = ai<RoundOutcome>("round", {
      state: this.dmState(),
      rescue_of: r ? this.player(r.victimId)?.hero?.name ?? "" : "",
      actions,
      recent_lines: this.recentLines.slice(-6),
    }).then((res) => res.data);
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
    let out = await withTimeout(this.roundP ?? Promise.resolve(this.roundFallback()), 14_000, () => this.roundFallback());
    if (!out || !Array.isArray(out.beats)) out = this.roundFallback();
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
    let hope = this.state.hope;
    if (fails > wins) hope -= 1;
    hope -= Math.min(2, nat1s);
    if (rolls.some((r) => r.kept === 20)) hope += 1;
    if (this.state.pitches.some((p) => p.embraceFlaw && SUCCESS_BANDS.includes(rolls.find((r) => r.playerId === p.playerId)?.band ?? "FAIL"))) hope += 1;
    hope = Math.max(0, Math.min(this.state.hopeMax, hope));

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

    if (out.complication) this.ledger.push(out.complication);
    this.canon.push(...out.new_canon);
    if (out.threat_mood) this.threatMood = out.threat_mood;
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

  // ---------- final roll ----------
  private startFinalRoll() {
    this.finalDice = {};
    this.heroes().forEach((p) => (this.finalDice[p.id] = d20()));
    this.set({
      phase: "final_roll",
      final: { dice: {}, rolled: [], best: "", hopeBonus: this.state.hope, total: 0, ending: "BITTERSWEET" },
    });
    this.setTimer(FINAL_ROLL_MS, () => this.finish(false));
  }

  private revealFinalDie(pid: string) {
    const f = this.state.final;
    if (!f || f.rolled.includes(pid) || !(pid in this.finalDice)) return;
    const next = { ...f, rolled: [...f.rolled, pid], dice: { ...f.dice, [pid]: this.finalDice[pid] } };
    this.set({ final: next });
    if (next.rolled.length === Object.keys(this.finalDice).length) {
      this.clearTimer();
      setTimeout(() => this.finish(false), 1500);
    }
  }

  private finish(grim: boolean) {
    if (["final_result", "epilogue", "reveal", "storybook"].includes(this.state.phase)) return;
    this.clearTimer();
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
    this.set({ phase: "final_result", final, players, ready: [] });

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
    this.epilogueP = withTimeout(
      ai<string>("epilogue", { state: st, final: finalInfo, log: this.state.log.map((l) => `${l.hero}: ${l.pitch} (${l.band})`) }).then((r) => r.data),
      20_000,
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
    this.storybookP = withTimeout(
      ai<Storybook>("storybook", {
        state: st,
        title: this.state.quest?.title,
        heroes,
        log: this.state.log,
        final_moves: finalInfo.final_moves,
        ending: final.ending,
        crowd_favorite: crowd,
        available_images: images,
        real_story: this.seed?.the_real_story,
      }).then((r) => (Array.isArray(r.data?.pages) && r.data.pages.length ? r.data : bookFallback())),
      30_000,
      bookFallback,
    );
    this.setTimer(grim ? 2500 : 4500, () => this.startEpilogue());
  }

  private async startEpilogue() {
    this.set({ phase: "epilogue", busy: "The DM wraps it up…", ready: [] });
    const text = await this.epilogueP!;
    this.set({ epilogue: text, busy: "" });
    this.reading(text, () => this.startReveal(), 10000);
  }

  private startReveal() {
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
      log: [],
      rescue: null,
      busy: "",
      ready: [],
    });
  }

  close() {
    this.clearTimer();
    this.t.close();
  }
}
