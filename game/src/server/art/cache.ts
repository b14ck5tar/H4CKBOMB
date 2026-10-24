import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// In-memory LRU (insertion-ordered Map) + in-flight de-dupe + best-effort disk cache in the OS temp dir,
// so a dev-server restart doesn't re-pay for the same art. Lives on globalThis to survive hot reloads.

type Entry = { buf: Buffer; at: number };
type Failure = { error: string; until: number };

const MAX_ENTRIES = 40; // ~0.3–0.6 MB each
const FAIL_TTL_MS = 120_000; // don't hammer a key that just failed (each attempt may be billed)
const DISK_DIR = path.join(os.tmpdir(), "group-project-scene-art");

type Store = {
  lru: Map<string, Entry>;
  inflight: Map<string, Promise<Buffer>>;
  failures: Map<string, Failure>;
  stats: { calls: number; ok: number; failed: number; hits: number; shared: number; totalMs: number };
};

const g = globalThis as unknown as { __sceneArtStore?: Store };
export const store: Store = (g.__sceneArtStore ??= {
  lru: new Map(),
  inflight: new Map(),
  failures: new Map(),
  stats: { calls: 0, ok: 0, failed: 0, hits: 0, shared: 0, totalMs: 0 },
});

export async function getCached(key: string): Promise<Buffer | null> {
  const e = store.lru.get(key);
  if (e) {
    store.lru.delete(key);
    store.lru.set(key, e); // bump to most-recent
    return e.buf;
  }
  try {
    const buf = await fs.readFile(path.join(DISK_DIR, `${key}.webp`));
    remember(key, buf);
    return buf;
  } catch {
    return null;
  }
}

export function remember(key: string, buf: Buffer) {
  store.lru.delete(key);
  store.lru.set(key, { buf, at: Date.now() });
  while (store.lru.size > MAX_ENTRIES) store.lru.delete(store.lru.keys().next().value as string);
}

export async function persist(key: string, buf: Buffer) {
  remember(key, buf);
  try {
    await fs.mkdir(DISK_DIR, { recursive: true });
    await fs.writeFile(path.join(DISK_DIR, `${key}.webp`), buf);
  } catch {
    /* read-only FS: memory cache only */
  }
}

export function recentFailure(key: string): string | null {
  const f = store.failures.get(key);
  if (!f) return null;
  if (Date.now() > f.until) {
    store.failures.delete(key);
    return null;
  }
  return f.error;
}

export function markFailure(key: string, error: string) {
  store.failures.set(key, { error, until: Date.now() + FAIL_TTL_MS });
}

/** Runs `job` once per key; concurrent callers for the same key share the same promise. */
export function once(key: string, job: () => Promise<Buffer>): { promise: Promise<Buffer>; shared: boolean } {
  const existing = store.inflight.get(key);
  if (existing) return { promise: existing, shared: true };
  const promise = job().finally(() => store.inflight.delete(key));
  store.inflight.set(key, promise);
  return { promise, shared: false };
}

export function stats() {
  return { ...store.stats, cachedEntries: store.lru.size, inflight: store.inflight.size, diskDir: DISK_DIR };
}
