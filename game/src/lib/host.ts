"use client";
import seedsJson from "@/data/seed_quests.json";
import questImages from "@/data/quest_images.json";
import { ai, image, thumbnail, withTimeout } from "./api";
import {
  CATCH_MS,
  FINAL_ROLL_MS,
  HOPE_MAX,
  HOPE_START,
  PITCH_MS,
  PLAYER_COLORS,
  RESCUE_PITCH_MS,
  ROLL_ANIM_MS,
  ROLL_MS,
  TIER_MOD,
  VOTE_MS,
  band,
  d20,
  ending,
  isFailure,
} from "./rules";
import { openRoom, type Msg, type Transport } from "./transport";
import type {
  Band,
  GameState,
  Hero,
  Outcome,
  Pitch,
  Player,
  QuestSeed,
  RollResult,
  SceneOpen,
  SceneView,
  Stat,
  Storybook,
  Tier,
  Verdict,
} from "./types";

const SEEDS = seedsJson as QuestSeed[];
const TIER_RANK: Record<Tier, number> = { clever: 4, solid: 3, risky: 2, absurd: 1, miracle: 0 };

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

const readMs = (text: string, min = 7000, max = 16000) =>
  Math.max(min, Math.min(max, text.split(/\s+/).length * 330));

function bestStat(h?: Hero): Stat {
  if (!h) return "brave";
  return (Object.keys(h.stats) as Stat[]).sort((a, b) => h.stats[b] - h.stats[a])[0];
}

export function loadShelf(): ShelfBook[] {
  try {
    return JSON.parse(localStorage.getItem("ouar-shelf") ?? "[]");
  } catch {
    return [];
  }
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
  private verdicts = new Map<string, Promise<Verdict>>();
  private pendingRoll: RollResult | null = null;
  private outcomeP: Promise<Outcome> | null = null;
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
      narration: "",
      situation: "",
      banner: "",
      npcLine: { speaker: "", line: "" },
      suggestions: {},
      rescue: null,
      pitches: [],
      votes: {},
      deadline: 0,
      rollerId: "",
      winningPitchId: "",
      roll: null,
      catchers: [],
      outcome: null,
      final: null,
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
    return () => this.subs.delete(fn);
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

  /** TV "Continue ▸" / host hotkey: run whatever the current timer would run, right now. */
  skip() {
    const f = this.pending;
    if (!f) return;
    this.clearTimer();
    f();
    this.broadcastSoon();
  }

  // ---------- messages from phones ----------
  private handle(m: Msg) {
    switch (m.type) {
      case "hello":
        this.broadcastNow();
        if (this.thumbs[m.pid]) this.t.send({ type: "portrait", pid: m.pid, url: this.thumbs[m.pid] });
        break;
      case "join":
        return this.onJoin(m.pid, m.name);
      case "concept":
        return this.buildCharacter(m.pid, m.text);
      case "pitch":
        return this.onPitch(m.pid, m.text, !!m.useAbility, !!m.embraceFlaw);
      case "vote":
        return this.onVote(m.pid, m.pitchId);
      case "roll":
        return this.onRoll(m.pid);
      case "catch":
        return this.onCatch(m.pid);
      case "react":
        return this.onReact(m.pid, m.emoji);
    }
  }

  private onJoin(pid: string, rawName: string) {
    const name = String(rawName ?? "").replace(/[<>]/g, "").trim().slice(0, 16) || "Hero";
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
  }

  // ---------- lobby ----------
  setPartyName(name: string) {
    this.set({ partyName: name.slice(0, 40) });
  }

  async buildCharacter(pid: string, concept: string) {
    const p = this.player(pid);
    if (!p || p.status === "building") return;
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
    const url = await image({ kind: "portrait", visual: hero.visual, flaw: hero.flaw });
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
    // Players who joined but never made a hero sit this tale out.
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
      outcome: null,
      final: null,
      epilogue: "",
      storybook: null,
      rescue: null,
    });
    this.setTimer(readMs(this.seed!.fairytale_premise, 9000, 20000), () => this.openScene(0));
  }

  // ---------- DM state ----------
  private dmState() {
    const s = this.state;
    const scene = s.scenes[s.sceneIndex];
    return {
      mode: "quick",
      quest: {
        title: s.quest?.title,
        realm: s.quest?.realm,
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
      })),
      canon: this.canon.slice(-10),
      ledger: this.ledger.slice(-3),
      recaps: this.recaps.slice(-2),
      recent_lines: this.recentLines.slice(-3),
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
      rescue,
      pitches: [],
      votes: {},
      roll: null,
      outcome: null,
      busy: "The Tale-Spinner turns the page…",
    });
    const heroIds = this.heroes().map((p) => p.id);
    const input = {
      state: this.dmState(),
      scene_plan: { n: i + 1, kind: scene.kind, location: scene.location, description: scene.description, seeded_twist: scene.twist },
      recap_needed: i > 0,
      rescue: victim ? { hero_id: victim.id, hero_name: victim.hero!.name, peril: victim.peril } : undefined,
      hero_ids: heroIds,
      last_scene_outcomes: this.state.log.filter((l) => l.scene === i - 1).map((l) => `${l.hero} (${l.band}): ${l.headline}`),
    };
    const fb = (): SceneOpen => ({
      recap_of_previous: "",
      narration: `${scene.location}. ${scene.twist}`,
      situation: rescue ? `${victim!.hero!.name} is in peril! How do you save them?` : "What do you do?",
      banner: rescue ? "A HERO IN PERIL" : "TROUBLE AHEAD",
      npc_line: { speaker: "", line: "" },
      suggestions: heroIds.map((id) => ({ hero_id: id, ideas: ["Charge in bravely", "Try a clever trick", "Sing at it, loudly"] })),
      music: "tense",
    });
    const res = await withTimeout(
      ai<SceneOpen>("scene", input).then((r) => r.data),
      16_000,
      fb,
    );
    if (res.recap_of_previous) this.recaps.push(res.recap_of_previous);
    const suggestions: Record<string, string[]> = {};
    res.suggestions?.forEach((s) => (suggestions[s.hero_id] = s.ideas));
    this.set({
      narration: res.narration,
      situation: res.situation,
      banner: res.banner,
      npcLine: res.npc_line,
      suggestions,
      busy: "",
    });
    const ms = readMs(res.narration + " " + res.npc_line.line);
    this.setTimer(ms, () => (isClimax ? this.startFinalRoll() : this.startPitch()));
  }

  // ---------- pitch → verdict ----------
  private pitchers() {
    const r = this.state.rescue;
    const all = this.heroes();
    if (!r) return all;
    const others = all.filter((p) => p.id !== r.victimId);
    return others.length ? others : all;
  }

  private startPitch() {
    this.verdicts.clear();
    this.set({ phase: "pitch", pitches: [], votes: {}, roll: null, outcome: null });
    this.setTimer(this.state.rescue ? RESCUE_PITCH_MS : PITCH_MS, () => this.endPitch());
  }

  private onPitch(pid: string, text: string, useAbility: boolean, embraceFlaw: boolean) {
    if (this.state.phase !== "pitch") return;
    if (!this.pitchers().some((p) => p.id === pid)) return;
    if (this.state.pitches.some((p) => p.playerId === pid)) return;
    const clean = String(text ?? "").replace(/[<>]/g, "").trim().slice(0, 200);
    if (!clean) return;
    const pitch: Pitch = { id: `${this.state.sceneIndex}-${pid}`, playerId: pid, text: clean, useAbility, embraceFlaw };
    this.set({ pitches: [...this.state.pitches, pitch] });
    this.fireVerdict(pitch);
    if (this.pitchers().every((p) => this.state.pitches.some((x) => x.playerId === p.id))) this.endPitch();
  }

  private fireVerdict(pitch: Pitch) {
    const p = this.player(pitch.playerId)!;
    const others = this.state.pitches.filter((x) => x.id !== pitch.id).map((x) => `${this.player(x.playerId)?.hero?.name}: ${x.text}`);
    const fb = (): Verdict => ({
      interpretation: pitch.text.slice(0, 80),
      stat: bestStat(p.hero),
      tier: "solid",
      ability_fits: false,
      flaw_walk_in: false,
      quip: "The DM squints… fine.",
      on_success: "It works.",
      on_failure: "It doesn't.",
      moderation: "ok",
    });
    const r = this.state.rescue;
    const v = withTimeout(
      ai<{ verdicts: (Verdict & { pitch_id: string })[] }>("verdict", {
        state: this.dmState(),
        rescue: r ? { hero_in_peril: this.player(r.victimId)?.hero?.name, peril: r.peril } : undefined,
        pitches: [
          {
            pitch_id: pitch.id,
            hero_id: p.id,
            hero_name: p.hero?.name,
            use_ability: pitch.useAbility && p.abilityAvailable,
            embrace_flaw: pitch.embraceFlaw,
            best_stat: bestStat(p.hero),
            text: pitch.text,
          },
        ],
        other_pitches: others,
      }).then((res) => res.data.verdicts[0] ?? fb()),
      9000,
      fb,
    );
    this.verdicts.set(pitch.id, v);
  }

  private async endPitch() {
    if (this.state.phase !== "pitch") return;
    this.clearTimer();
    if (this.state.pitches.length === 0) {
      // Nobody pitched in time: the DM volunteers someone with one of their own suggestions.
      const pool = this.pitchers();
      const p = pool[Math.floor(Math.random() * pool.length)];
      const text = this.state.suggestions[p.id]?.[0] ?? "Charges in bravely, hoping for the best";
      const pitch: Pitch = { id: `${this.state.sceneIndex}-${p.id}`, playerId: p.id, text, useAbility: false, embraceFlaw: false };
      this.set({ pitches: [pitch] });
      this.fireVerdict(pitch);
    }
    this.set({ phase: "vote", busy: "The Tale-Spinner weighs your plans…" });
    const judged = await Promise.all(this.state.pitches.map(async (p) => ({ ...p, verdict: await this.verdicts.get(p.id)! })));
    this.set({ pitches: judged, busy: "" });
    if (judged.length === 1) return this.startRoll(judged[0], false);
    if (this.voters().length === 0) return this.endVote();
    this.setTimer(VOTE_MS, () => this.endVote());
  }

  // ---------- vote ----------
  /** Players who have at least one pitch (not their own) to vote for. In a rescue, only the hero in peril votes. */
  private voters() {
    const r = this.state.rescue;
    const base = r ? this.heroes().filter((p) => p.id === r.victimId) : this.heroes();
    return base.filter((v) => this.state.pitches.some((p) => p.playerId !== v.id));
  }

  private onVote(pid: string, pitchId: string) {
    if (this.state.phase !== "vote" || this.state.busy) return;
    if (!this.voters().some((v) => v.id === pid)) return;
    const target = this.state.pitches.find((p) => p.id === pitchId);
    if (!target || target.playerId === pid) return;
    this.set({ votes: { ...this.state.votes, [pid]: pitchId } });
    if (this.voters().every((v) => this.state.votes[v.id])) this.endVote();
  }

  private endVote() {
    if (this.state.phase !== "vote") return;
    this.clearTimer();
    const counts: Record<string, number> = {};
    Object.values(this.state.votes).forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
    const picked = (pid: string) => this.state.log.filter((l) => l.heroId === pid).length;
    const ranked = [...this.state.pitches].sort(
      (a, b) =>
        (counts[b.id] ?? 0) - (counts[a.id] ?? 0) ||
        TIER_RANK[b.verdict!.tier] - TIER_RANK[a.verdict!.tier] ||
        picked(a.playerId) - picked(b.playerId),
    );
    const winner = ranked[0];
    const totalVotes = Object.keys(this.state.votes).length;
    const believes = !this.state.rescue && totalVotes >= 3 && (counts[winner.id] ?? 0) / totalVotes >= 0.75;
    this.startRoll(winner, believes);
  }

  // ---------- roll ----------
  private makeRoll(pid: string, v: Verdict, advantage: RollResult["advantage"], rescuerId: string): RollResult {
    const hero = this.player(pid)!.hero!;
    const dice = advantage === "none" ? [d20()] : [d20(), d20()];
    const kept = advantage === "adv" ? Math.max(...dice) : advantage === "dis" ? Math.min(...dice) : dice[0];
    const statBonus = hero.stats[v.stat];
    const tierMod = TIER_MOD[v.tier];
    const total = kept + statBonus + tierMod;
    return { playerId: pid, dice, kept, advantage, statBonus, tierMod, total, band: band(kept, total, v.tier), rescuerId };
  }

  private startRoll(pitch: Pitch, believes: boolean) {
    const p = this.player(pitch.playerId)!;
    const v = pitch.verdict!;
    const usesAbility = pitch.useAbility && p.abilityAvailable;
    const adv = usesAbility || believes;
    const dis = v.flaw_walk_in && !pitch.embraceFlaw;
    const advantage = adv && !dis ? "adv" : dis && !adv ? "dis" : "none";
    if (usesAbility) this.patchPlayer(p.id, { abilityAvailable: false });
    this.pendingRoll = this.makeRoll(p.id, v, advantage, "");
    this.outcomeP = this.fetchOutcome(pitch, this.pendingRoll);
    this.set({ phase: "roll", rollerId: p.id, winningPitchId: pitch.id, roll: null, catchers: [] });
    this.setTimer(ROLL_MS, () => this.revealRoll());
  }

  private onRoll(pid: string) {
    if (this.state.phase === "roll" && pid === this.state.rollerId) return this.revealRoll();
    if (this.state.phase === "final_roll") return this.revealFinalDie(pid);
  }

  private revealRoll() {
    if (this.state.phase !== "roll") return;
    this.clearTimer();
    this.set({ phase: "rolling", roll: this.pendingRoll });
    setTimeout(() => this.afterRoll(), ROLL_ANIM_MS);
  }

  private afterRoll() {
    const roll = this.state.roll!;
    if (isFailure(roll.band) && !roll.rescuerId) {
      const catchers = this.heroes().filter((p) => p.heart === 1 && p.id !== roll.playerId).map((p) => p.id);
      if (catchers.length) {
        this.set({ phase: "catch", catchers });
        this.setTimer(CATCH_MS, () => this.resolveOutcome());
        return;
      }
    }
    this.resolveOutcome();
  }

  private onCatch(pid: string) {
    if (this.state.phase !== "catch" || !this.state.catchers.includes(pid)) return;
    this.clearTimer();
    const pitch = this.state.pitches.find((p) => p.id === this.state.winningPitchId)!;
    const old = this.state.roll!;
    this.patchPlayer(pid, { heart: 0 });
    this.pendingRoll = this.makeRoll(old.playerId, pitch.verdict!, old.advantage, pid);
    this.outcomeP = this.fetchOutcome(pitch, this.pendingRoll);
    this.set({ phase: "rolling", roll: this.pendingRoll, catchers: [] });
    setTimeout(() => this.resolveOutcome(), ROLL_ANIM_MS);
  }

  private fetchOutcome(pitch: Pitch, roll: RollResult): Promise<Outcome> {
    const p = this.player(pitch.playerId)!;
    const v = pitch.verdict!;
    const r = this.state.rescue;
    const rescuer = roll.rescuerId ? this.player(roll.rescuerId)?.hero?.name ?? "" : "";
    const input = {
      state: this.dmState(),
      hero_name: p.hero!.name,
      action: {
        hero_id: p.id,
        hero_name: p.hero!.name,
        pitch: pitch.text,
        interpretation: v.interpretation,
        stat: v.stat,
        tier: v.tier,
        on_success: v.on_success,
        on_failure: v.on_failure,
      },
      roll: {
        dice: roll.dice,
        kept: roll.kept,
        advantage: roll.advantage,
        stat_bonus: roll.statBonus,
        tier_mod: roll.tierMod,
        total: roll.total,
        band: roll.band,
      },
      embrace_flaw: pitch.embraceFlaw,
      rescuer,
      rescue_of: r ? this.player(r.victimId)?.hero?.name ?? "" : "",
      ability: { ...p.hero!.ability, fits: v.ability_fits },
    };
    return ai<Outcome>("outcome", input).then((res) => res.data);
  }

  private async resolveOutcome() {
    if (this.state.phase === "outcome") return;
    this.clearTimer();
    const roll = this.state.roll!;
    const pitch = this.state.pitches.find((p) => p.id === this.state.winningPitchId)!;
    const roller = this.player(roll.playerId)!;
    this.set({ phase: "outcome", catchers: [], busy: "The Tale-Spinner is writing…" });
    const fb = (): Outcome => ({
      headline: { CATASTROPHE: "Oh No.", FAIL: "Not Quite!", YES_BUT: "Sort Of!", SUCCESS: "Nailed It!", LEGENDARY: "LEGEND!" }[roll.band],
      narration: `${roller.hero!.name} tries. The realm reacts. History will remember it, one way or another.`,
      yes_but_cost: roll.band === "YES_BUT" ? "hope" : "none",
      complication: "",
      shame_title: roll.band === "CATASTROPHE" ? "the Unlucky" : "",
      glory_title: roll.band === "LEGENDARY" ? "the Legendary" : "",
      savior_title: "",
      peril: roll.band === "CATASTROPHE" ? "stuck somewhere very inconvenient" : "",
      new_canon: [],
      threat_mood: "",
      highlight_score: 5,
      sfx: "none",
    });
    const out = await withTimeout(this.outcomeP ?? Promise.resolve(fb()), 12_000, fb);
    this.applyOutcome(roll, pitch, roller, out);
    this.set({ outcome: out, busy: "" });
    this.setTimer(readMs(out.narration), () => this.afterOutcome());
  }

  private applyOutcome(roll: RollResult, pitch: Pitch, roller: Player, out: Outcome) {
    const b: Band = roll.band;
    const rescue = this.state.rescue;
    const success = b === "YES_BUT" || b === "SUCCESS" || b === "LEGENDARY";
    let hope = this.state.hope;
    if (b === "CATASTROPHE") hope -= 2;
    if (b === "FAIL") hope -= 1;
    if (b === "YES_BUT" && out.yes_but_cost === "hope") hope -= 1;
    if (b === "LEGENDARY") hope += 1;
    if (pitch.embraceFlaw && roll.total >= 10) hope += 1;
    hope = Math.max(0, Math.min(this.state.hopeMax, hope));

    const players = this.state.players.map((p) => {
      const titles = [...p.titles];
      let { peril, abilityAvailable } = p;
      if (p.id === roller.id) {
        if (b === "CATASTROPHE" && out.shame_title) titles.push(out.shame_title);
        if (b === "LEGENDARY") {
          if (out.glory_title) titles.push(out.glory_title);
          abilityAvailable = true;
        }
        if (b === "CATASTROPHE" && !rescue) peril = out.peril || "in terrible, comic peril";
        if (rescue && success && out.savior_title) titles.push(out.savior_title);
      }
      if (roll.rescuerId && p.id === roll.rescuerId && success && out.savior_title && !rescue) titles.push(out.savior_title);
      if (rescue && success && p.id === rescue.victimId) peril = "";
      return { ...p, titles: [...new Set(titles)].slice(-4), peril, abilityAvailable };
    });

    if (out.complication) this.ledger.push(out.complication);
    this.canon.push(...out.new_canon);
    if (out.threat_mood) this.threatMood = out.threat_mood;
    this.recentLines.push(out.headline);
    this.set({
      hope,
      players,
      log: [
        ...this.state.log,
        {
          scene: this.state.sceneIndex,
          heroId: roller.id,
          hero: roller.hero!.name,
          pitch: pitch.text,
          band: b,
          headline: out.headline,
          narration: out.narration,
          rescue: !!rescue,
        },
      ],
    });
  }

  private afterOutcome() {
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
    this.set({ phase: "final_result", final, players });

    const heroes = this.heroes().map((p) => ({ id: p.id, name: p.hero!.name }));
    const st = this.dmState();
    const finalInfo = { dice: Object.fromEntries(Object.entries(dice).map(([k, v]) => [this.player(k)?.hero?.name, v])), best: this.player(best)?.hero?.name ?? "", hope_bonus: final.hopeBonus, total, ending: final.ending };
    this.epilogueP = withTimeout(
      ai<string>("epilogue", { state: st, final: finalInfo, log: this.state.log.map((l) => `${l.hero}: ${l.headline}`) }).then((r) => r.data),
      20_000,
      () => "The dice land, the realm holds its breath, and somehow it all works out. And that is how it really happened... more or less.",
    );
    const crowd = Object.entries(this.reactionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const images = this.state.scenes.map((_, i) => `scene_${i + 1}`);
    this.storybookP = this.epilogueP.then((epilogue) =>
      withTimeout(
        ai<Storybook>("storybook", {
          state: st,
          title: this.state.quest?.title,
          heroes,
          log: this.state.log,
          epilogue,
          crowd_favorite: crowd,
          available_images: images,
          real_story: this.seed?.the_real_story,
        }).then((r) => r.data),
        45_000,
        () => ({
          title: this.state.quest?.title ?? "A Tale",
          dedication: `For ${heroes.map((h) => h.name).join(", ")}.`,
          pages: [{ text: epilogue, image_ref: images[images.length - 1] }],
          hero_pages: heroes.map((h) => ({ hero_id: h.id, best_moment: `${h.name} was there when it mattered.`, award: "Present & Heroic" })),
          moral: "Always roll with friends.",
          real_story_bridge: "",
        }),
      ),
    );
    this.setTimer(grim ? 2500 : 4500, () => this.startEpilogue());
  }

  private async startEpilogue() {
    this.set({ phase: "epilogue", busy: "The Tale-Spinner closes the book…" });
    const text = await this.epilogueP!;
    this.set({ epilogue: text, busy: "" });
    this.setTimer(readMs(text, 10000, 22000), () => this.startReveal());
  }

  private startReveal() {
    this.set({ phase: "reveal" });
    this.setTimer(20_000, () => this.showStorybook());
  }

  private async showStorybook() {
    this.clearTimer();
    this.set({ phase: "storybook", busy: "Binding your storybook…" });
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
        party: this.state.partyName || "The Party",
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

  /** "Next chapter": same heroes and titles, new quest. */
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
      outcome: null,
      final: null,
      epilogue: "",
      storybook: null,
      log: [],
      rescue: null,
      busy: "",
    });
  }

  close() {
    this.clearTimer();
    this.t.close();
  }
}
