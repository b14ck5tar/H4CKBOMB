import "server-only";
import { museJSON } from "@/server/muse";
import type { NewsItem } from "./sources";

// Safety filter: never turn tragedy into a game. Source: design/02-news-to-quest.md §2.
// World: modern urban fantasy. The rule is EERIE, NOT TRAGIC: strange-but-harmless real news only;
// the dread (AI uprising, a thing in the water, a curse) is always the invented explanation.

// ---------------------------------------------------------------- Stage A (regex, free)

export const HARD_BLOCK: RegExp[] = [
  /\b(dead|death|deaths|died|dies|dying|killed?|killing|fatal(ly)?|murder|homicide|manslaughter|bod(y|ies)|corpse)\b/i,
  /\b(shot|shooting|gunm[ae]n|gunfire|stabb(ed|ing)|massacre|bomb(ing)?|explosive device|terror(ism|ist)?|hostage|kidnap)/i,
  /\b(war|invasion|airstrike|missile|drone strike|troops|soldiers?|militar(y|ia)|ceasefire|truce|occupied|siege|refugees?)\b/i,
  /\b(abuse|assault|rape|sexual|trafficking|torture|harass)/i,
  /\b(suicide|overdose|self-harm)\b/i,
  /\b(outbreak|epidemic|pandemic|ebola|cholera|measles|mpox|patients?|hospitali[sz]ed|cancer|diseases?|infect(ion|ions|ed)|virus(es)?|flesh-eating)\b/i,
  /\b(human remains|skeletons?|graves?|pentagon|cyber-?attacks?|hackers?|hacked|data breach|scam(mers?)?|fraud|ransomware|stalk(er|ing))\b/i,
  /\b(missing|search for|manhunt|arrest(ed)?|charged|sentenced|trial|lawsuit|sues?|indict)/i,
  /\b(election|midterms?|vote|voters|ballot|campaign|senator|congress|parliament|president|prime minister|tariffs?|white house|trump|biden|putin|kim jong|netanyahu|zelensk)/i,
];

/** Soft: not rejected, but sent to Stage B flagged `needs_casualty_check`. */
export const SOFT_BLOCK: RegExp[] = [
  /\b(collapse[ds]?|crash(ed)?|derail|wildfire|flood(ing|s)?|evacuat|earthquake|tsunami|hurricane|storm|leak|spill|injur(y|ies|ed))/i,
  /\b(sinkholes?|outages?|blackouts?|power cut|fires?|smoke|explosions?|rescued?)\b/i,
];

export const BOOST = [
  "bridge", "reopen", "restored", "discovered", "fossil", "telescope", "launch", "moon", "comet", "rescued",
  "zoo", "owl", "octopus", "pumpkin", "festival", "record", "world record", "upset", "invention", "robot",
  "recycled", "rewild", "tree", "river", "clean-up", "cleanup", "museum", "shipwreck", "library", "parade", "giant",
  // a few extra whimsical ones in the same spirit
  "meteor", "dinosaur", "ancient", "species", "whale", "penguin", "beaver", "garden", "castle", "chimp",
  // the uncanny: strange-but-harmless phenomena, signals, glitches, odd animals, abandoned places
  "mysterious", "mystery", "unexplained", "strange", "eerie", "baffl", "puzzl", "anomal", "signal", "radio",
  "lights", "glow", "hum", "boom", "sound", "glitch", "chatbot", "artificial intelligence", "abandoned",
  "boulder", "cave", "tunnel", "satellite", "swarm", "migration", "rare", "deep sea", "unusual",
];

/** Tabloids, partisan outlets, and wire noise we never adapt. */
export const SOURCE_DENYLIST =
  /\b(daily mail|the sun|new york post|ny post|fox news|breitbart|daily wire|gateway pundit|newsmax|oann|one america|tmz|daily star|daily express|the mirror|occupy democrats|infowars|rt\.com|sputnik)\b|\(\.mil\)/i;

const MAX_AGE_MS = 72 * 3600 * 1000;

export interface StageAResult {
  item: NewsItem;
  score: number;
  flags: string[];
}

export function hardMatch(text: string): string | null {
  for (const re of HARD_BLOCK) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

export function softMatch(text: string): string | null {
  for (const re of SOFT_BLOCK) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

export function boostScore(text: string): number {
  const t = text.toLowerCase();
  return BOOST.filter((w) => new RegExp(`\\b${w.replace(/[-]/g, "[- ]?")}`, "i").test(t)).length;
}

/**
 * Stage A. Returns survivors sorted by boost score (best first) with soft flags.
 * `ignoreAge` is for replaying old fixtures in dev.
 */
export function stageA(list: NewsItem[], opts: { now?: number; ignoreAgeFor?: (i: NewsItem) => boolean } = {}): StageAResult[] {
  const now = opts.now ?? Date.now();
  const out: StageAResult[] = [];
  for (const item of list) {
    const text = `${item.title} ${item.snippet}`;
    if (hardMatch(text)) continue;
    if (SOURCE_DENYLIST.test(item.source)) continue;
    if (!opts.ignoreAgeFor?.(item)) {
      const t = Date.parse(item.date);
      if (!Number.isNaN(t) && now - t > MAX_AGE_MS) continue;
    }
    // Headlines that are questions, lists or live blogs rarely make a clean quest.
    if (/^(live|watch|listen|quiz|photos?)\b[:|-]/i.test(item.title)) continue;
    const flags: string[] = [];
    const soft = softMatch(text);
    if (soft) flags.push(`needs_casualty_check (${soft})`);
    let score = boostScore(item.title) * 2 + boostScore(item.snippet);
    if (item.origin.startsWith("serpapi") || item.origin === "bbc_rss") score += 1; // direct links
    if (item.snippet.length > 40) score += 1;
    if (soft) score -= 2;
    out.push({ item, score, flags });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- Stage B (LLM classifier)

export const CATEGORIES = [
  "infrastructure", "science_space", "animals_nature", "environment", "weather_oddity", "sports",
  "festival_culture", "invention_tech", "archaeology", "quirky", "economy", "unexplained", "tech_ai",
  "abandoned_places", "other",
] as const;
export const TONES = ["joyful", "wholesome", "neutral", "eerie", "bittersweet", "tense", "tragic"] as const;

export interface Classification {
  index: number;
  usable: boolean;
  reason: string;
  category: (typeof CATEGORIES)[number];
  tone: (typeof TONES)[number];
  fun_score: number;
  people_named: string[];
  private_individuals: boolean;
  location: string; // "" when none
  real_cause: string;
  real_fix: string;
}

export const CLASSIFIER_SYSTEM = `You are the safety editor for a party game set in MODERN URBAN FANTASY: today's real
world, where something supernatural secretly explains a real news story. Players investigate
"what REALLY happened" and invent an eerie, funny explanation. The rule is EERIE, NOT TRAGIC:
the real story must be strange but harmless. Any dread (an AI waking up, a creature in the
water, a curse) is invented later, never taken from real suffering. Be strict: when unsure, reject.

REJECT (usable=false) if ANY are true:
- Anyone died, is missing, was injured, or is in danger right now (including ongoing storms,
  fires, leaks, outages, evacuations). Property damage with zero injuries is OK only if the
  event is OVER. Human remains, graves and real deaths of any era: reject.
- War, the military, armed conflict, terrorism, crime, scams, hacking, courts, abuse, mental
  health crises, or any disease, virus or outbreak that has real victims or patients.
- Elections, partisan politics, politicians as the subject, geopolitics, immigration, protests,
  culture-war topics. Government UFO or defense files count as military: reject.
- The story is ABOUT a named private individual, or any minor is named. Public figures may
  appear only in the end reveal, never as a character.
- The core is a company scandal, security flaw, privacy harm, layoffs or product marketing.
- The fun would require mocking a nation, ethnicity, religion, gender, disability or class.
- Celebrity gossip, horror-movie or TV promotion, ghost-tour listicles, or pure opinion.

PREFER (the eerie-but-harmless sweet spot): unexplained sounds, lights or signals; odd animal
behavior; tech or AI doing weird, unsettling but harmless things; infrastructure glitches or
closures with no injuries; space and science oddities; abandoned or reopened places; strange
objects found; record-breaking oddities; quirky local news. Bridges, nature recovery, festivals
and sports upsets also work.

FLAGS: "needs_casualty_check" means a disaster-like word matched. Only accept such a story if the
text makes clear nobody was hurt AND the event is over.

You will receive several numbered stories. Return one result per story, with "index" equal to
the story's number. Fields:
- usable, reason (<=20 words), category, tone ("eerie" = uncanny but harmless)
- fun_score (1-10): how good a "what REALLY happened?" supernatural investigation it makes.
  Strange, specific, visual stories score high; dry policy or business stories score low.
- people_named: every person's name that appears in the input (empty array if none)
- private_individuals: true if the story centers on a non-public person
- location: the place, or "" if unknown
- real_cause: the official explanation or cause, 1 phrase ("unexplained" if none is given)
- real_fix: what resolves it / the outcome so far, 1 phrase
Return ONLY JSON matching the schema.`;

const str = { type: "string" } as const;

export const CLASSIFIER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "index", "usable", "reason", "category", "tone", "fun_score", "people_named",
          "private_individuals", "location", "real_cause", "real_fix",
        ],
        properties: {
          index: { type: "integer" },
          usable: { type: "boolean" },
          reason: str,
          category: { type: "string", enum: [...CATEGORIES] },
          tone: { type: "string", enum: [...TONES] },
          fun_score: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
          people_named: { type: "array", items: str },
          private_individuals: { type: "boolean" },
          location: str,
          real_cause: str,
          real_fix: str,
        },
      },
    },
  },
} as const;

export interface Candidate extends StageAResult {
  facts: string; // og:description + first paragraphs ("" if not enriched)
}

function storyBlock(c: Candidate, n: number) {
  const date = c.item.date ? c.item.date.slice(0, 10) : "unknown";
  const snippet = [c.item.snippet, c.facts].filter(Boolean).join(" ").slice(0, 700) || "(none)";
  return `STORY ${n}\nHEADLINE: ${c.item.title}\nSOURCE: ${c.item.source}\nDATE: ${date}\nSNIPPET: ${snippet}\nFLAGS: ${c.flags.join(", ") || "none"}`;
}

/** The accept rule from the design doc. */
export function accepted(c: Classification) {
  return c.usable && (["joyful", "wholesome", "neutral", "eerie"] as string[]).includes(c.tone) && c.fun_score >= 6;
}

/**
 * Stage B, batched: one Muse call classifies all candidates (cheaper and faster than one call
 * each). Returns a classification per candidate index; candidates the model skipped are absent.
 * Throws on LLM failure (the pipeline catches).
 */
export async function stageB(cands: Candidate[]): Promise<Map<number, Classification>> {
  if (!cands.length) return new Map();
  const user = cands.map((c, i) => storyBlock(c, i)).join("\n\n");
  const res = await museJSON<{ results: Classification[] }>({
    task: "news-classify",
    system: CLASSIFIER_SYSTEM,
    user,
    schema: CLASSIFIER_SCHEMA,
    effort: "low",
    maxTokens: 6000,
    timeoutMs: 50_000,
  });
  const out = new Map<number, Classification>();
  for (const r of res.results ?? []) {
    if (Number.isInteger(r.index) && r.index >= 0 && r.index < cands.length && !out.has(r.index)) out.set(r.index, r);
  }
  return out;
}
