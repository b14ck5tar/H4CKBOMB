"use client";

/**
 * Once Upon a Roll: the original sound-effect API, kept for every existing call site.
 * Since the CD's "no loud dings, one family" note, every method here plays a voice from the single
 * house family in lib/sound/sfx.ts (warm plucks, soft wood, rounded blips, low whooshes, dice textures,
 * all through the same room and the same 4 kHz-and-below tone, loudness-normalised).
 * New code: prefer playSfx() / playResult() / dice from "@/lib/sound".
 */

import { isAllMuted, isServer, setAllMuted, unlockAudio, getBuses } from "./sound/context";
import { playSfx, type SfxOpts } from "./sound/sfx";

/** Old names (and the DM's sfx enum) -> the house family. */
const LEGACY: Record<string, string> = {
  diceroll: "diceRoll", roll: "diceRoll",
  diceland: "diceLand", land: "diceLand",
  stamp: "stamp",
  fanfare: "legendary", trumpet: "legendary",
  sadtrombone: "bad", trombone: "bad",
  recordscratch: "thud", scratch: "thud",
  choir: "swell",
  pageturn: "cardFlip", page: "cardFlip",
  pop: "pop",
  tick: "timerTick",
  join: "join",
  heartbeat: "heartbeat",
  whoosh: "whoosh",
  explosion: "boom", boom: "boom",
  sparkle: "swell", magic: "swell",
  thud: "thud",
  splash: "whoosh",
  thanks: "good",
};

function play(name: string, opts?: SfxOpts) {
  const key = String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key || key === "none") return;
  playSfx(LEGACY[key] ?? name, opts); // unknown legacy names fall through to the house names; else ignored
}

export const sfx = {
  /** Call from a user gesture (tap/click) to unlock audio on mobile + Chrome autoplay policy. */
  unlock(): void {
    if (isServer()) return;
    unlockAudio();
    getBuses();
  },
  /** Global mute: sound effects AND music (persisted). */
  setMuted(m: boolean): void {
    setAllMuted(!!m);
  },
  muted(): boolean {
    return isAllMuted();
  },
  diceRoll(ms: number = 1400): void {
    playSfx("diceRoll", { ms });
  },
  diceLand(): void {
    playSfx("diceLand");
  },
  stamp(): void {
    play("stamp");
  },
  fanfare(): void {
    play("fanfare");
  },
  sadTrombone(): void {
    play("sadTrombone"); // the old "womp womp" is retired: the comic "bad" phrase instead
  },
  recordScratch(): void {
    play("recordScratch");
  },
  choir(): void {
    play("choir");
  },
  pageTurn(): void {
    play("pageTurn");
  },
  pop(): void {
    play("pop");
  },
  tick(): void {
    play("tick");
  },
  join(): void {
    play("join");
  },
  heartbeat(): void {
    play("heartbeat");
  },
  whoosh(): void {
    play("whoosh");
  },
  explosion(): void {
    play("explosion");
  },
  sparkle(): void {
    play("sparkle");
  },
  thud(): void {
    play("thud");
  },
  splash(): void {
    play("splash");
  },
  countBeat(go = false): void {
    playSfx("countBeat", { final: go });
  },
  drumroll(ms: number = 2000): void {
    playSfx("drumroll", { ms });
  },
  thanks(): void {
    play("thanks");
  },
  play(name: string): void {
    play(name);
  },
  /** The house family with options, e.g. sfx.fx("diceRoll", { ms: 1800 }). Same as playSfx(). */
  fx(name: string, opts?: SfxOpts): void {
    playSfx(name, opts);
  },
};

export default sfx;
