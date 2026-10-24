import "server-only";
import { museJSON } from "@/server/muse";
import type { QuestSeed } from "@/lib/types";
import type { NewsItem } from "./sources";
import type { Classification } from "./filter";

// Headline → QuestSeed. Source: design/02-news-to-quest.md §2 (stereotype rules, Stage C) and §3.
// World: modern urban fantasy ("what REALLY happened" behind a real, strange-but-harmless headline).

export const TRANSFORM_SYSTEM = `You are the Case Writer for "Once Upon a Roll", a co-op party game set in MODERN URBAN
FANTASY: today's real world, where something supernatural secretly explains a real news story.
Think Stranger Things, The X-Files, SCP files, Percy Jackson in the modern city, The Twilight
Zone. Turn ONE real, safe, strange-but-harmless news story into a quest seed for a 15-minute
one-shot where the players uncover "what REALLY happened". The END REVEAL puts THE OFFICIAL
STORY (the real article) next to WHAT YOU UNCOVERED (the party's version), so every
supernatural element must secretly map to a real fact. Make the mapping CLEVER and ACCURATE.

RULES
1. Map, don't invent. the_threat = the supernatural cause hiding behind the REAL CAUSE
   (CLASSIFIER.real_cause): a creature, a curse, an entity, a machine that woke up, a thing
   in the water. the_goal = the supernatural version of the REAL FIX or outcome
   (CLASSIFIER.real_fix). Every location and complication must be traceable to a fact in the
   input or to ordinary common sense about that kind of event. Fill "mapped_from" on each with
   the plain real-world fact it stands for.
2. The setting is the real world, today. realm_name = the real place or setting (a town,
   a stretch of coast, a park, an observatory). Locations are real-world-feeling places with
   texture: the shuttered rail yard, the 24-hour laundromat, the county inspector's trailer,
   the night-shift control room. Phones, flashlights, group chats and bad Wi-Fi exist.
3. Complications are "obvious in hindsight": a logical consequence of the situation that a
   smart player could have predicted (an iron-eating thing eats your crowbar; a signal that
   repeats every 88 days will repeat again). Escalate: stage 1 local snag, stage 2 bigger
   systemic snag, stage 3 finale twist. Each must be solvable by teamwork, wits or nerve,
   never by violence.
4. Never use real people's names or likenesses anywhere except the_real_story. Real place
   names are fine. Fantasize the problem, not the people: no national, ethnic, religious or
   regional stereotypes, no accents, costumes, cuisines-as-jokes or "exotic" framing. Locals
   are capable and kind. The threat stands in for an impersonal force (rust, tides, gravity,
   a glitch, a frequency), never a real group, nation, company or brand.
5. Tone: eerie, cinematic, sometimes scary-but-fun, with room for the players to be funny.
   Dread is welcome; tragedy is not. PG: no gore, no death, no injuries, no weapons, no romance.
   The threat is driven off, contained, outwitted, bargained with, switched off or set free,
   never killed.
6. fairytale_premise is the UNCANNY HOOK, read aloud to open the game: at most 70 words,
   present tense, grounded and specific (times, places, small physical details), with one
   wrong detail that makes the skin crawl. The first sentence must work alone as a teaser.
   Plain words. No purple prose, never "tapestry", "whispers" or "testament", no em-dash chains.
7. the_real_story is NEUTRAL and factual: summary is one sentence, no jokes, no supernatural
   words. Copy headline, source, link and date exactly from the input. context_note: one short
   neutral note for the host (or "" if nothing to add).
8. Keep every string short enough to read aloud on a TV: quest_title <= 60 characters,
   descriptions <= 35 words, mapped_from <= 25 words.
9. locations: 4 or 5. complications: exactly 3, stages 1, 2, 3 in order.
10. art_style_hint: one sentence naming the key image: the real-world place plus its one
    impossible supernatural element, in a bold neon graphic-novel style.
    category and tone: copy from CLASSIFIER.
Return ONLY JSON matching the schema.`;

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const QUEST_SCHEMA = obj({
  quest_title: str,
  fairytale_premise: str,
  realm_name: str,
  the_threat: obj({ name: str, description: str, mapped_from: str }),
  the_goal: obj({ description: str, mapped_from: str }),
  locations: { type: "array", minItems: 4, maxItems: 5, items: obj({ name: str, description: str, mapped_from: str }) },
  complications: {
    type: "array",
    minItems: 3,
    maxItems: 3,
    items: obj({
      stage: { type: "integer", enum: [1, 2, 3] },
      title: str,
      what_happens: str,
      why_obvious_in_hindsight: str,
      mapped_from: str,
    }),
  },
  the_real_story: obj({ summary: str, headline: str, source: str, link: str, date: str, context_note: str }),
  art_style_hint: str,
  category: str,
  tone: str,
});

type RawQuest = Omit<QuestSeed, "id">;

// ---------------------------------------------------------------- Stage C lint (code only)

/** Fiction-side block list: Stage A hard terms minus words that are normal in fiction (trial of weight, missing signal…). */
const FICTION_BLOCK: RegExp[] = [
  /\b(dead|death|deaths|died|dies|dying|killed?|killing|fatal(ly)?|murder|homicide|manslaughter|corpse|blood|gore)\b/i,
  /\b(shot|shooting|gunm[ae]n|gunfire|guns?|stabb(ed|ing)|massacre|bomb(ing)?|explosive device|terror(ism|ist)?|hostage|kidnap)/i,
  /\b(invasion|airstrike|missile|drone strike|militar(y|ia)|ceasefire|refugees?)\b/i,
  /\b(abuse|assault|rape|sexual|sexy|trafficking|torture|harass)/i,
  /\b(suicide|overdose|self-harm)\b/i,
  /\b(outbreak|epidemic|pandemic|ebola|cholera|measles|mpox|cancer|injur(y|ies|ed))\b/i,
  /\b(election|midterms?|voters|ballot|senator|congress|parliament|president|prime minister|tariffs?|white house|trump|biden|putin|kim jong|netanyahu|zelensk)/i,
];

const DEMONYM =
  /\b(american|mexican|canadian|chinese|japanese|korean|indian|pakistani|african|arab(ic|ian)?|jewish|jew|muslim|islamic|christian|catholic|hindu|buddhist|sikh|russian|ukrainian|french|german|british|english|scottish|irish|welsh|italian|spanish|danish|dutch|swedish|norwegian|viking|gyps(y|ies)|roma|tribal|tribe|asian|european|latin[oa]?|hispanic|indigenous|aboriginal|native|eskimo|oriental|texan)\b/i;

const BRANDS =
  /\b(starlink|spacex|tesla|apple|iphone|google|amazon|meta|facebook|instagram|tiktok|microsoft|openai|nvidia|samsung|disney|netflix|walmart|coca-?cola|pepsi|mcdonald'?s|nike|adidas|boeing|airbus|uber|exxon|shell|bp)\b/i;

/** House style for the read-aloud hook: no purple prose. */
const PURPLE = /\b(tapestry|tapestries|whisper(s|ed|ing)?|testament|delve|realm of)\b/i;

function fictionStrings(q: RawQuest): string[] {
  return [
    q.quest_title,
    q.fairytale_premise,
    q.realm_name,
    q.the_threat.name,
    q.the_threat.description,
    q.the_goal.description,
    q.art_style_hint,
    ...q.locations.flatMap((l) => [l.name, l.description]),
    ...q.complications.flatMap((c) => [c.title, c.what_happens, c.why_obvious_in_hindsight]),
  ];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Name fragments worth checking: the full name and any token ≥ 4 letters (surnames, distinctive first names). */
function nameNeedles(people: string[]): { needle: string; flags: string }[] {
  const out = new Map<string, string>();
  for (const p of people) {
    const clean = p.replace(/[^\p{L}\p{N}' -]/gu, " ").replace(/\s+/g, " ").trim();
    if (clean.length < 3) continue;
    out.set(clean, "iu"); // full name: any case
    // single tokens: case-sensitive, so the surname "Wall" doesn't trip on "a stone wall"
    for (const tok of clean.split(" ")) if (tok.length >= 4 && /^\p{Lu}/u.test(tok) && !out.has(tok)) out.set(tok, "u");
  }
  return [...out].map(([needle, flags]) => ({ needle, flags }));
}

/**
 * Stage C. Returns a list of problems ("" list = clean). `mapped_from` fields are allowed to
 * mention real facts (they are the reveal), so only player-facing fiction is linted for names.
 */
export function lintQuest(q: RawQuest, cls: Pick<Classification, "people_named">, item: Pick<NewsItem, "source">): string[] {
  const problems: string[] = [];
  const fiction = fictionStrings(q);
  const blob = fiction.join(" \n ");

  for (const { needle, flags } of nameNeedles(cls.people_named ?? [])) {
    if (new RegExp(`(^|[^\\p{L}])${escapeRe(needle)}($|[^\\p{L}])`, flags).test(blob)) problems.push(`real person's name "${needle}" appears in the fiction`);
  }
  for (const re of FICTION_BLOCK) {
    const m = blob.match(re);
    if (m) problems.push(`blocked word "${m[0]}" in the fiction`);
  }
  const villain = `${q.the_threat.name} ${q.the_threat.description}`;
  const dm = villain.match(DEMONYM);
  if (dm) problems.push(`demonym/ethnic/religious term "${dm[0]}" in the threat`);
  const br = villain.match(BRANDS);
  if (br) problems.push(`real brand "${br[0]}" in the threat`);
  if (item.source.length > 3 && new RegExp(`\\b${escapeRe(item.source)}\\b`, "i").test(villain)) problems.push(`publisher name in the threat`);

  // Shape checks the strict schema can't fully enforce.
  if (q.locations.length < 4 || q.locations.length > 5) problems.push("locations must be 4–5");
  if (q.complications.length !== 3) problems.push("complications must be exactly 3");
  if (q.quest_title.length > 70) problems.push("quest_title too long");
  if (q.fairytale_premise.split(/\s+/).length > 80) problems.push("fairytale_premise too long (70 words max)");
  const purple = q.fairytale_premise.match(PURPLE);
  if (purple) problems.push(`purple-prose word "${purple[0]}" in the premise`);
  if ((q.fairytale_premise.match(/—|--/g) ?? []).length > 1) problems.push("too many em dashes in the premise");
  return problems;
}

// ---------------------------------------------------------------- transform

function userPrompt(item: NewsItem, facts: string, cls: Classification, feedback?: string[]) {
  const date = item.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const { index: _i, ...stageB } = cls; // eslint-disable-line @typescript-eslint/no-unused-vars
  let u = `HEADLINE: ${item.title}\nSOURCE: ${item.source}\nLINK: ${item.link}\nDATE: ${date}\nSNIPPET: ${item.snippet || "(none)"}\nEXTRA FACTS: ${facts || "(none)"}\nCLASSIFIER: ${JSON.stringify(stageB)}`;
  if (feedback?.length) u += `\n\nYOUR PREVIOUS DRAFT WAS REJECTED. Fix these problems: ${feedback.join("; ")}.`;
  return u;
}

/** Overwrite reveal facts with the real data (never trust the model to copy a link) and tidy shape. */
function finalize(raw: RawQuest, item: NewsItem, cls: Classification, id: string): QuestSeed {
  const date = item.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const note = raw.the_real_story?.context_note?.trim();
  return {
    id,
    quest_title: raw.quest_title.trim(),
    realm_name: raw.realm_name.trim(),
    fairytale_premise: raw.fairytale_premise.trim(),
    the_threat: raw.the_threat,
    the_goal: raw.the_goal,
    locations: raw.locations.slice(0, 5),
    complications: [...raw.complications].sort((a, b) => a.stage - b.stage).map((c, i) => ({ ...c, stage: i + 1 })),
    the_real_story: {
      summary: raw.the_real_story.summary.trim(),
      headline: item.title,
      source: item.source,
      link: item.link,
      date,
      ...(note ? { context_note: note } : {}),
    },
    art_style_hint: raw.art_style_hint,
    category: cls.category,
    tone: cls.tone,
  };
}

/**
 * One headline → one QuestSeed, with Stage C lint and up to `maxRetries` regenerations (lint
 * problems are fed back). Returns null if it never passes. Throws only on LLM/network errors.
 */
export async function transformToQuest(
  item: NewsItem,
  facts: string,
  cls: Classification,
  id: string,
  opts: { maxRetries?: number; onCall?: () => void } = {},
): Promise<QuestSeed | null> {
  const maxRetries = opts.maxRetries ?? 2;
  let feedback: string[] | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    opts.onCall?.();
    const raw = await museJSON<RawQuest>({
      task: "news-transform",
      system: TRANSFORM_SYSTEM,
      user: userPrompt(item, facts, cls, feedback),
      schema: QUEST_SCHEMA,
      effort: "low",
      maxTokens: 5000,
      timeoutMs: 60_000,
    });
    const problems = lintQuest(raw, cls, item);
    if (!problems.length) return finalize(raw, item, cls, id);
    console.warn(`[news] stage C rejected "${raw.quest_title}" (attempt ${attempt + 1}): ${problems.join("; ")}`);
    feedback = problems;
  }
  return null;
}

/** Runtime validator for the QuestSeed shape (used by the pipeline and tests). */
export function isQuestSeed(q: unknown): q is QuestSeed {
  const o = q as QuestSeed;
  const s = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const triple = (v: { name?: unknown; description?: unknown; mapped_from?: unknown }) => s(v?.name) && s(v?.description) && s(v?.mapped_from);
  return (
    !!o &&
    s(o.id) &&
    s(o.quest_title) &&
    s(o.realm_name) &&
    s(o.fairytale_premise) &&
    triple(o.the_threat) &&
    s(o.the_goal?.description) &&
    s(o.the_goal?.mapped_from) &&
    Array.isArray(o.locations) &&
    o.locations.length >= 4 &&
    o.locations.length <= 5 &&
    o.locations.every(triple) &&
    Array.isArray(o.complications) &&
    o.complications.length === 3 &&
    o.complications.every(
      (c, i) => c.stage === i + 1 && s(c.title) && s(c.what_happens) && s(c.why_obvious_in_hindsight) && s(c.mapped_from),
    ) &&
    s(o.the_real_story?.summary) &&
    s(o.the_real_story?.headline) &&
    s(o.the_real_story?.source) &&
    /^https?:\/\//.test(o.the_real_story?.link ?? "") &&
    s(o.the_real_story?.date) &&
    s(o.art_style_hint)
  );
}
