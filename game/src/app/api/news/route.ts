import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { getNewsCandidates, lastStats, type NewsCandidate } from "@/server/news/candidates";
import { fillFromLibrary, isExcluded } from "@/server/news/library";
import { DEFAULT_RATING, isRating, questAllowed } from "@/lib/rating";
import SEEDS from "@/data/seed_quests.json";
import type { Rating } from "@/lib/types";

/** The vote shows 3 cards; below this the hand-written seeds top the list up (played ones last). */
const MIN_STORIES = 3;
type SeedLike = { id: string; quest_title?: string; realm_name?: string; rating?: Rating; the_real_story?: { headline?: string; summary?: string; source?: string; link?: string; date?: string } };

// GET /api/news?rating=kids|teens|adults&played=id1,id2
//   → { quests: [{id, origin, headline, snippet, source, url, date, place, rating, storyability, scores, has_opener}], generatedAt }
// Up to 10 stories, best first, every one storyable:
//   1. "live": this refresh's gated stories (past week; widened to the past month if the week kept < 3),
//   2. "library": stories that passed the gate before (game/src/data/story_library.json), best score first,
//   3. "curated": the hand-written seeds (id = the seed id, so the client can use its scenes).
// `played` (optional) = ids the table played recently; they are skipped. The vote's 3 cards = quests[0..2];
// the Quick Tale can pick from the list. Never errors.
//
// Credits: one refresh = 2 SerpApi calls (3 if the month is needed). The live list is cached 4 h in Next's Data
// Cache and in memory; the rating filter and library fill run AFTER the cache, so they never cost a call.
// Empty live results throw inside the cached fn, so a bad run is never cached.

export const revalidate = 14400;
export const maxDuration = 120;

type Payload = { list: NewsCandidate[]; generatedAt: string };

const cached = unstable_cache(
  async (): Promise<Payload> => {
    const { list } = await getNewsCandidates();
    if (!list.length) throw new Error("no candidates (not caching)");
    return { list, generatedAt: new Date().toISOString() };
  },
  ["story-news-candidates-v6-checklist"],
  { revalidate: 14400, tags: ["news-candidates"] },
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const r = sp.get("rating");
  const rating = isRating(r) ? r : DEFAULT_RATING;
  const played = new Set((sp.get("played") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50));
  const dev = process.env.NODE_ENV !== "production";
  const debug = dev && sp.get("debug") === "1";

  let live: NewsCandidate[] = [];
  let generatedAt = new Date().toISOString();
  let error = "";
  try {
    ({ list: live, generatedAt } = await cached());
  } catch (e) {
    // Never re-run the pipeline here: an empty run isn't cached, so a retry would spend SerpApi credits again.
    error = (e as Error).message;
    console.warn(`[api/news] ${error}`);
  }
  const quests = fillFromLibrary(live, rating, played);
  // Never run out (the vote needs 3, the Quick Tale needs 1): top up from the hand-written seeds, gated or not.
  if (quests.length < MIN_STORIES) {
    const have = new Set(quests.map((q) => q.id));
    const seeds = (SEEDS as SeedLike[]).filter((x) => !have.has(x.id) && !isExcluded({ id: x.id, headline: x.the_real_story?.headline }) && questAllowed(x.rating ?? "teens", rating));
    const fresh = seeds.filter((x) => !played.has(x.id));
    for (const x of [...fresh, ...seeds.filter((x) => played.has(x.id))]) {
      if (quests.length >= MIN_STORIES) break;
      const r = x.the_real_story ?? {};
      quests.push({ id: x.id, origin: "curated", headline: r.headline ?? x.quest_title ?? x.id, snippet: r.summary ?? "", source: r.source ?? "", url: r.link ?? "", date: r.date ?? "", place: x.realm_name ?? "", rating: x.rating ?? "teens", storyability: 3, checklist: null, one_sentence_setup: "", dilemma: "", has_opener: false });
      have.add(x.id);
    }
    // Still short (a table that played almost everything): bring back gated stories it already played.
    for (const q of fillFromLibrary(live, rating, new Set())) {
      if (quests.length >= MIN_STORIES) break;
      if (!have.has(q.id)) quests.push(q), have.add(q.id);
    }
  }
  const body: Record<string, unknown> = { quests, generatedAt };
  if (debug) Object.assign(body, { stats: lastStats(), all: live, ...(error ? { error } : {}) });
  return NextResponse.json(body, {
    headers: { "Cache-Control": live.length && !played.size ? "public, s-maxage=3600, stale-while-revalidate=14400" : "no-store" },
  });
}

// POST (dev only): the design/37 8-box checklist outside the live pipeline. No SerpApi calls.
//   {action: "check", stories: [{id, headline, source, date, text}]} → each story's boxes (judge seeds, spot checks)
//   {action: "rescore"} → re-check every library story; failures are dropped from story_library.json
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "dev only" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; stories?: { id: string; headline: string; source?: string; date?: string; text?: string }[] };
  const { checkStories, checklistOf, failedBoxes, passes, blocked } = await import("@/server/news/candidates");
  const { allStories, applyChecklist } = await import("@/server/news/library");
  const items =
    b.action === "rescore"
      ? allStories().map((s) => ({ id: s.id, headline: s.headline, source: s.source, date: s.date, text: s.snippet }))
      : (b.stories ?? []).slice(0, 40).map((s) => ({ id: s.id, headline: s.headline, source: s.source ?? "", date: s.date ?? "", text: s.text ?? "" }));
  const gates = await checkStories(items);
  const results = items.map((it, i) => {
    const g = gates[i];
    const regex = blocked(`${it.headline} ${it.text}`);
    if (!g) return { id: it.id, headline: it.headline, pass: false, error: "no answer", regex };
    const checklist = checklistOf(g);
    const pass = passes(g) && !regex;
    return { id: it.id, headline: it.headline, pass, safe: g.safe && !regex, safety_reason: regex ? `regex: ${regex}` : g.safety_reason, failed: failedBoxes(checklist), checklist, one_sentence_setup: g.one_sentence_setup, dilemma: g.dilemma, talk: g.talk };
  });
  // Re-score only applies stories that got an answer (a failed batch never empties the library).
  const applied = b.action === "rescore" ? applyChecklist(results.filter((r) => !("error" in r)) as Parameters<typeof applyChecklist>[0]) : undefined;
  return NextResponse.json({ results, applied });
}
