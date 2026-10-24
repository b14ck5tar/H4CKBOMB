"use client";
import { useEffect, useState } from "react";
import seedsJson from "@/data/seed_quests.json";
import { openRoom, type Msg, type Transport } from "./transport";
import type { GameState, QuestSeed } from "./types";

const SEEDS = seedsJson as QuestSeed[];
type Reaction = { pid: string; emoji: string; id: number };

/**
 * A read-only copy of the table for /watch (friends playing remotely). It only listens to the TV's
 * broadcasts and asks for missing pictures. It never sends state and never changes the game.
 * Shape-compatible with the parts of GameHost that the TV components read.
 */
export class WatchSource {
  readonly readOnly = true;
  state: GameState | null = null;
  deadlineAt = 0;
  portraits: Record<string, string> = {};
  thumbs: Record<string, string> = {};
  sceneImages: Record<number, string> = {};

  private t: Transport;
  private subs = new Set<() => void>();
  private reactionSubs = new Set<(r: Reaction) => void>();
  private lastHeard = 0;
  private lastAsk = 0;
  private pid = "watch" + Math.random().toString(36).slice(2, 8);
  private iv: ReturnType<typeof setInterval>;
  private onVisible = () => document.visibilityState === "visible" && this.ask(true);

  /** media=false (the judges' /notes page): state only, never asks for pictures, so the table spends no bandwidth on it. */
  constructor(
    code: string,
    private media = true,
  ) {
    this.t = openRoom(code);
    this.t.on((m) => this.handle(m));
    this.ask(true);
    this.iv = setInterval(() => {
      if (Date.now() - this.lastHeard > (this.lastHeard ? 5000 : 1500)) this.ask(true);
      else this.ask(); // still missing a picture? ask again (throttled)
    }, 1500);
    document.addEventListener("visibilitychange", this.onVisible);
  }

  get transportKind() {
    return this.t.kind;
  }
  get questSeed() {
    return this.state?.questId ? SEEDS.find((s) => s.id === this.state!.questId) : undefined;
  }
  get realStory() {
    return this.questSeed?.the_real_story;
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };
  getState = () => this.state as GameState;
  onReaction(fn: (r: Reaction) => void) {
    this.reactionSubs.add(fn);
    return () => {
      this.reactionSubs.delete(fn);
    };
  }

  // The watch screen has no controls: these exist so the shared TV components type-check.
  skip() {}
  setPartyName() {}
  chooseQuest() {}
  canBegin() {
    return false;
  }
  begin() {}
  nextTale() {}
  setMode() {}
  startedAt = 0;
  endedAt = 0;

  private emit() {
    this.subs.forEach((f) => f());
  }

  /** New pictures arrived: hand React a fresh state object so it re-renders. */
  private bump() {
    if (this.state) this.state = { ...this.state };
    this.emit();
  }

  /** Ask the table for state, plus any portraits or scene paintings we don't have yet. */
  private ask(force = false) {
    if (!this.media) {
      if (force) this.t.send({ type: "hello", pid: this.pid });
      return;
    }
    const s = this.state;
    const portraits = s ? s.players.filter((p) => p.hasPortrait && !this.thumbs[p.id]).map((p) => p.id) : [];
    const scenes = s ? s.scenes.map((sc, i) => (sc.hasImage && !this.sceneImages[i] ? i : -1)).filter((i) => i >= 0) : [];
    if (!force && !portraits.length && !scenes.length) return;
    if (!force && Date.now() - this.lastAsk < 3000) return;
    this.lastAsk = Date.now();
    this.t.send({ type: "watch", portraits, scenes });
  }

  private handle(m: Msg) {
    if (m.type === "state") {
      const next = m.state as GameState;
      if (this.state && next.questId !== this.state.questId) this.sceneImages = {};
      this.lastHeard = Date.now();
      this.state = next;
      this.deadlineAt = next.deadline ? Date.now() + next.deadline : 0;
      this.emit();
      this.ask();
    } else if (m.type === "portrait" && typeof m.url === "string") {
      this.thumbs[m.pid] = m.url;
      this.portraits[m.pid] = m.url;
      this.bump();
    } else if (m.type === "scene" && typeof m.url === "string") {
      if (this.state && m.questId === this.state.questId) {
        this.sceneImages[Number(m.index)] = m.url;
        this.bump();
      }
    } else if (m.type === "reaction") {
      const r = { pid: String(m.pid), emoji: String(m.emoji).slice(0, 4), id: Number(m.id) };
      this.reactionSubs.forEach((f) => f(r));
    }
  }

  close() {
    clearInterval(this.iv);
    document.removeEventListener("visibilitychange", this.onVisible);
    this.t.close();
  }
}

/** Opens a read-only view of room `code`. Returns the source and its latest state (null until the table answers). */
export function useWatch(code: string | null, opts: { media?: boolean } = {}) {
  const media = opts.media ?? true;
  const [src, setSrc] = useState<WatchSource | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => {
    if (!code) return;
    const w = new WatchSource(code, media);
    setSrc(w);
    const off = w.subscribe(() => setState(w.state));
    return () => {
      off();
      w.close();
      setSrc(null);
      setState(null);
    };
  }, [code, media]);
  return { src, state };
}
