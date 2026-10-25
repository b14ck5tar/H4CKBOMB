// Plain-English checks for story openers: Flesch-Kincaid grade, banned words, dashes, invented jargon.
// No imports, so scripts can load it directly. The rules mirror the DM's WRITING rules in prompts.ts.

const VOWELS = /[aeiouy]+/g;

/** Heuristic English syllable count (good to about ±1 per long word; fine for a grade estimate). */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w
    .replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, (m) => m[0]) // silent e / -es / -ed
    .replace(/^y/, "");
  const n = (w.match(VOWELS) ?? []).length;
  return Math.max(1, n);
}

export function words(text: string): string[] {
  return text
    .replace(/[0-9]+([.,][0-9]+)*/g, "num") // "80-ton" and "1,000" read as short words
    .split(/[\s\-/]+/)
    .map((w) => w.replace(/[^A-Za-z']/g, ""))
    .filter(Boolean);
}

export function sentences(text: string): number {
  return Math.max(1, (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).length);
}

/** Flesch-Kincaid grade level. Each part is passed separately so a goal or a line without a period counts as a sentence. */
export function fkGrade(parts: string[]): number {
  let w = 0;
  let s = 0;
  let syl = 0;
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    const ws = words(p);
    w += ws.length;
    s += sentences(/[.!?]$/.test(p) ? p : `${p}.`);
    syl += ws.reduce((a, x) => a + syllables(x), 0);
  }
  if (!w) return 0;
  return Math.round((0.39 * (w / s) + 11.8 * (syl / w) - 15.59) * 10) / 10;
}

export const BANNED = [
  "tapestry", "testament", "delve", "intricate", "vibrant", "pivotal", "nestled", "ethereal", "otherworldly",
  "shimmering", "palpable", "cacophony", "symphony", "unwavering", "embark", "whimsical", "delightful", "magical",
  "epic", "chaos", "chaotic", "suddenly", "behold", "alas", "ominous", "unleash", "flourish", "realm", "arcane",
  "eldritch", "mystical", "enchanted", "adventurers", "brave heroes", "against all odds", "little did", "a sense of",
  "the air is thick", "washes over", "whispers of", "echoes through", "what will you do", "only time will tell",
  "in hindsight", "beware", "fate", "destiny", "prophecy",
];

const BANNED_RE = new RegExp(`\\b(${BANNED.map((b) => b.replace(/ /g, "\\s+")).join("|")})\\b`, "i");

/**
 * Invented-jargon heuristic: a capitalized hyphenated coinage ("Iron-Maw", "Hatch-Mother") or CamelCase word
 * that does not appear in the source text. Real places and names from the source pass.
 */
export function inventedNames(text: string, sourceText: string): string[] {
  const src = sourceText.toLowerCase();
  const hits = text.match(/\b[A-Z][a-z]+(?:-[A-Za-z]+)+\b|\b[A-Z][a-z]+[A-Z][a-z]+\b/g) ?? [];
  return [...new Set(hits)].filter((h) => !src.includes(h.toLowerCase()));
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Replace the punctuation the style bans, as a last resort after the retry. */
export function sanitize(s: string): string {
  return String(s ?? "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+--\s+/g, ", ")
    .replace(/;\s*/g, ". ")
    .replace(/…|\.\.\./g, ".")
    .replace(/\.\s+([a-z])/g, (_, c: string) => `. ${c.toUpperCase()}`)
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

export function styleProblems(text: string): string[] {
  const out: string[] = [];
  if (/[—–]|\s--\s/.test(text)) out.push("uses a dash (use a comma or a new sentence)");
  if (/;/.test(text)) out.push("uses a semicolon");
  const m = text.match(BANNED_RE);
  if (m) out.push(`uses the banned word "${m[0]}"`);
  return out;
}
