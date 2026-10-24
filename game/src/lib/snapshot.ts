"use client";
// A refreshed (or OS-reloaded) host tab picks the game back up from sessionStorage. Every call here is
// best-effort: storage can be missing, full or blocked, and none of that is allowed to break the game.

const VERSION = 1;
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const key = (code: string) => `ouar-game-${code}`;

export function loadSnapshot<T extends object>(code: string): T | null {
  try {
    const raw = sessionStorage.getItem(key(code));
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || snap.v !== VERSION || typeof snap.at !== "number" || Date.now() - snap.at > MAX_AGE_MS) return null;
    return snap as T;
  } catch {
    return null;
  }
}

/**
 * Saves `core` plus as many of the `extras` as fit. Extras are dropped from the end first
 * (so put the most expendable last). If even the core doesn't fit, the old snapshot is removed
 * rather than left behind to resume from an older moment.
 */
export function saveSnapshot(code: string, core: object, extras: Record<string, unknown> = {}) {
  const names = Object.keys(extras);
  for (let n = names.length; n >= 0; n--) {
    try {
      const snap = { v: VERSION, at: Date.now(), ...core, ...Object.fromEntries(names.slice(0, n).map((k) => [k, extras[k]])) };
      sessionStorage.setItem(key(code), JSON.stringify(snap));
      return;
    } catch {
      // Too big, or storage unavailable. First make room by dropping other rooms' old games
      // (one tab only runs one game at a time), then try again with less.
      if (n === names.length && forgetOtherGames(code)) n++;
    }
  }
  try {
    sessionStorage.removeItem(key(code));
  } catch {}
}

/** Removes saved games for every other room code. Returns true if anything was removed. */
function forgetOtherGames(code: string) {
  try {
    const stale: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("ouar-game-") && k !== key(code)) stale.push(k);
    }
    stale.forEach((k) => sessionStorage.removeItem(k));
    return stale.length > 0;
  } catch {
    return false;
  }
}
