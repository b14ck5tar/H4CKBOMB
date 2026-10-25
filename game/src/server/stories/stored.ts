import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import storedFile from "@/data/story_bibles.json";
import type { StoryBible } from "@/lib/beat";

/**
 * Pre-built story bibles (design/30 "Stored bibles"): Muse can be slow, so every story in the story library gets its
 * bible written ahead of time (scripts/prebuild-bibles.mjs) and saved in game/src/data/story_bibles.json, next to
 * the pipeline's story_library.json (kept separate so the two writers never clobber each other's file).
 *
 * A stored bible is used only when it was planned from the SAME opener the table heard (fingerprint of the
 * opener's situation + problem name), for the same audience, with at least as many acts as the game has turns
 * (extra acts are dropped evenly, keeping the first and last, by fitBible).
 * In dev, every freshly written bible for a library story is saved here too; on Vercel the file is read-only.
 */

export type StoredBible = {
  story_id: string;
  rating: string;
  turns: number;
  fingerprint: string;
  model: string;
  made_at: string;
  opener_title: string;
  /** The opener this bible was planned from, and its reveal facts: a stored "story pack" the host can play as is. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opener?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ending_facts?: any;
  bible: StoryBible;
};
type StoredFile = { version: number; updated: string; bibles: StoredBible[] };

const FILE = path.join(process.cwd(), "src", "data", "story_bibles.json");
const canWrite = () => process.env.NODE_ENV !== "production" && process.env.STORY_LIBRARY_WRITE !== "0";
const g = globalThis as unknown as { __storedBibles?: StoredBible[]; __storedBiblesWrite?: Promise<void> };

function all(): StoredBible[] {
  if (!g.__storedBibles) g.__storedBibles = [...((storedFile as StoredFile).bibles ?? [])];
  return g.__storedBibles;
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Which opener a bible was planned from: its first situation + the problem's name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function openerFingerprint(opener: any) {
  return `${norm(opener?.situation).slice(0, 120)}|${norm(opener?.problem?.name ?? opener?.threat?.name)}`;
}

/** Keep `turns` acts: the first, the last, and evenly spaced ones between (each act still leads into the next). */
export function fitBible(b: StoryBible, turns: number): StoryBible | null {
  const n = b.acts.length;
  if (turns > n || turns < 1) return null;
  if (turns === n) return b;
  if (turns === 1) return { ...b, acts: [b.acts[0]] };
  const idx = Array.from({ length: turns }, (_, i) => Math.round((i * (n - 1)) / (turns - 1)));
  return { ...b, acts: [...new Set(idx)].map((i) => b.acts[i]) };
}

/** The best stored bible for this story, opener, audience and turn count, fitted to the turns; or null. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findStored(storyId: string, opener: any, rating: string, turns: number): { bible: StoryBible; entry: StoredBible } | null {
  if (!storyId) return null;
  const fp = openerFingerprint(opener);
  const hits = all()
    .filter((e) => e.story_id === storyId && e.rating === rating && e.fingerprint === fp && e.turns >= turns)
    .sort((a, b) => a.turns - b.turns); // the closest act count first
  for (const e of hits) {
    const b = fitBible(e.bible, turns);
    if (b) return { bible: b, entry: e };
  }
  return null;
}

/**
 * The stored story pack for a story (opener + reveal facts + bible), whatever opener the table would otherwise get:
 * the host plays this opener so the pre-built bible always matches (design/30). Closest act count first.
 */
export function findPack(storyId: string, rating: string, turns: number): { bible: StoryBible; entry: StoredBible } | null {
  if (!storyId) return null;
  const hits = all()
    .filter((e) => e.story_id === storyId && e.rating === rating && e.turns >= turns && e.opener)
    .sort((a, b) => a.turns - b.turns || b.made_at.localeCompare(a.made_at));
  for (const e of hits) {
    const b = fitBible(e.bible, turns);
    if (b) return { bible: b, entry: e };
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveStored(storyId: string, opener: any, rating: string, turns: number, bible: StoryBible, model: string, endingFacts?: any) {
  if (!storyId) return;
  const fp = openerFingerprint(opener);
  // Replace the same pack, and any older pack for this story that has no opener of its own.
  const list = all().filter((e) => !(e.story_id === storyId && e.rating === rating && e.turns === turns && (e.fingerprint === fp || !e.opener)));
  list.push({ story_id: storyId, rating, turns, fingerprint: fp, model, made_at: new Date().toISOString(), opener_title: String(opener?.quest_title ?? opener?.title ?? ""), opener, ending_facts: endingFacts ?? null, bible });
  g.__storedBibles = list;
  if (!canWrite()) return;
  const prev = g.__storedBiblesWrite ?? Promise.resolve();
  g.__storedBiblesWrite = prev.then(async () => {
    try {
      const body: StoredFile = { version: 1, updated: new Date().toISOString(), bibles: [...list].sort((a, b) => a.story_id.localeCompare(b.story_id) || a.turns - b.turns) };
      await fs.writeFile(FILE, `${JSON.stringify(body, null, 1)}\n`, "utf8");
    } catch (e) {
      console.warn(`[bible] store write failed: ${(e as Error).message}`);
    }
  });
}
