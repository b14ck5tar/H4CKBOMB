/**
 * Keepsake links and the Hall of Tales.
 *
 * A keepsake is the finished storybook packed into the URL hash of /tale#<data>: deflate-raw + base64url.
 * Nothing is uploaded or stored on a server (the hash never leaves the browser). Private things are never
 * included: per-hero clues, Mirror sentences and guesses, and anything about a player that wasn't on the TV.
 */
import { ENDING_LABEL } from "./rules";
import type { GameState, LogEntry } from "./types";

export interface Keepsake {
  v: 1;
  t: string; // title
  g: string; // group / party name
  d: string; // date (YYYY-MM-DD)
  x: string; // ending label
  c: string; // cover image (static /quests path only) or ""
  h: { p: string; n: string; c: string; a: string; m: string; i: string }[]; // player, hero, color, award, best moment, portrait (static path)
  q: { l: string; n: string }[]; // key lines: what they said, which hero
  s: string[]; // storybook pages
  e: string; // epilogue
  m: string; // moral
  r: { h: string; s: string; l: string; d: string } | null; // the real story
}

/** Only static, same-origin art can ride along in a URL (generated art is a multi-MB data URL). */
export const staticArt = (u?: string) => (u && /^\/(quests|heroes)\/[\w\-/.]+\.(webp|png|jpe?g)$/i.test(u) ? u : "");
export const safeLink = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : "");

const BEST: LogEntry["band"][] = ["LEGENDARY", "SUCCESS", "CATASTROPHE", "YES_BUT", "FAIL"];

/** The table's most quotable lines, best first, no repeats. */
export function keyLines(log: LogEntry[], max = 4) {
  const seen = new Set<string>();
  return [...log]
    .filter((l) => l.pitch?.trim())
    .sort((a, b) => BEST.indexOf(a.band) - BEST.indexOf(b.band))
    .filter((l) => {
      const k = l.pitch.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max)
    .map((l) => ({ l: l.pitch.trim(), n: l.hero }));
}

export function buildKeepsake(s: GameState, art: { cover?: string; portraits: Record<string, string> }, real?: { headline: string; source: string; link: string; date: string }): Keepsake | null {
  const book = s.storybook;
  if (!book) return null;
  const awards = new Map(book.hero_pages.map((hp) => [hp.hero_id, hp]));
  return {
    v: 1,
    t: book.title,
    g: s.partyName || "",
    d: new Date().toISOString().slice(0, 10),
    x: s.final ? ENDING_LABEL[s.final.ending] : "",
    c: staticArt(art.cover),
    h: s.players
      .filter((p) => p.hero)
      .map((p) => ({
        p: p.name,
        n: [p.hero!.name, ...p.titles].join(", "),
        c: p.color,
        a: awards.get(p.id)?.award ?? "",
        m: awards.get(p.id)?.best_moment ?? "",
        i: staticArt(art.portraits[p.id]),
      })),
    q: keyLines(s.log),
    s: book.pages.map((pg) => pg.text),
    e: s.epilogue,
    m: book.moral,
    r: real ? { h: real.headline, s: real.source, l: safeLink(real.link), d: real.date } : null,
  };
}

// ---------- encoding ----------
function toB64url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const buf = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(buf);
}

export async function encodeKeepsake(k: Keepsake) {
  const raw = new TextEncoder().encode(JSON.stringify(k));
  return "1." + toB64url(await pipe(raw, new CompressionStream("deflate-raw")));
}

export async function decodeKeepsake(hash: string): Promise<Keepsake | null> {
  try {
    const h = hash.replace(/^#/, "");
    if (!h.startsWith("1.")) return null;
    const bytes = await pipe(fromB64url(h.slice(2)), new DecompressionStream("deflate-raw"));
    const k = JSON.parse(new TextDecoder().decode(bytes));
    return k && k.v === 1 && typeof k.t === "string" ? (k as Keepsake) : null;
  } catch {
    return null;
  }
}

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);

/** Encode, dropping the least important things until the hash fits (QR codes get hard to scan past ~2000 chars). */
export async function fitKeepsake(k: Keepsake, budget = 1800) {
  let cur: Keepsake = { ...k, h: k.h.map((x) => ({ ...x })), q: [...k.q], s: [...k.s] };
  const steps: ((x: Keepsake) => Keepsake | null)[] = [
    (x) => (x.s.length > 2 ? { ...x, s: x.s.slice(0, -1) } : null),
    (x) => (x.e.length > 420 ? { ...x, e: clip(x.e, 420) } : null),
    (x) => (x.s.length ? { ...x, s: x.s.slice(0, -1) } : null),
    (x) => (x.q.length > 2 ? { ...x, q: x.q.slice(0, -1) } : null),
    (x) => (x.h.some((h) => h.m.length > 90) ? { ...x, h: x.h.map((h) => ({ ...h, m: clip(h.m, 90) })) } : null),
    (x) => (x.e.length > 200 ? { ...x, e: clip(x.e, 200) } : null),
    (x) => (x.h.some((h) => h.m) ? { ...x, h: x.h.map((h) => ({ ...h, m: "" })) } : null),
    (x) => (x.q.length ? { ...x, q: x.q.slice(0, -1) } : null),
    (x) => (x.e ? { ...x, e: "" } : null),
  ];
  let enc = await encodeKeepsake(cur);
  for (const step of steps) {
    while (enc.length > budget) {
      const next = step(cur);
      if (!next) break;
      cur = next;
      enc = await encodeKeepsake(cur);
    }
    if (enc.length <= budget) break;
  }
  return enc;
}

// ---------- Hall of Tales (this TV's browser only) ----------
export interface HallEntry {
  title: string;
  quote: string;
  by: string; // the hero who said it
  heroes: string[];
  time: number;
}
const HALL_KEY = "gp_hall";

export function loadHall(): HallEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HALL_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveToHall(s: GameState) {
  try {
    if (!s.storybook) return;
    const line = keyLines(s.log, 1)[0];
    const entry: HallEntry = {
      title: s.storybook.title,
      quote: line?.l ?? s.storybook.moral,
      by: line?.n ?? "",
      heroes: s.players.filter((p) => p.hero).map((p) => p.hero!.name),
      time: Date.now(),
    };
    const hall = loadHall().filter((h) => !(h.title === entry.title && h.quote === entry.quote));
    localStorage.setItem(HALL_KEY, JSON.stringify([entry, ...hall].slice(0, 20)));
  } catch {
    /* nice-to-have */
  }
}

/** The last few tales from today (last 16 h), newest first. */
export function recentHall(n = 3) {
  const cutoff = Date.now() - 16 * 3600_000;
  return loadHall()
    .filter((h) => h.time > cutoff && h.quote)
    .slice(0, n);
}
