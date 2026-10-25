import { NextResponse } from "next/server";
import { isRating, DEFAULT_RATING } from "@/lib/rating";
import { makeOpener, type NewsSource, type PartyMember, type PersonalSource } from "@/server/stories/opener";

// POST /api/story/opener
//   { mode: "news" | "personal", rating, party: [{hero_id, name, power}], source }
//   news source:     { headline, snippet, source, url, date, place? }
//   personal source: { author_id, title, setup, steps, real_ending }
// → { opener: {title, narration, goal, situation, npc_line?: {speaker, line}} | null,
//     ending_facts: {kind:"news", official_line, whats_happening_now, headline, source, url, date}
//                 | {kind:"personal", author_id, real_ending} | null,
//     safe, fallback, message?, meta }
// safe:false → opener and ending_facts are null, and `message` is a gentle line for the author.
// Always answers within ~25 s; on any AI failure it returns a canned opener with fallback:true.

export const maxDuration = 30;

const s = (x: unknown) => (typeof x === "string" ? x : "");

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const mode = b.mode === "personal" ? "personal" : b.mode === "news" ? "news" : null;
  if (!mode) return NextResponse.json({ error: "mode must be news or personal" }, { status: 400 });
  const rating = isRating(b.rating) ? b.rating : DEFAULT_RATING;
  const party: PartyMember[] = (Array.isArray(b.party) ? b.party : [])
    .slice(0, 8)
    .map((p: Record<string, unknown>) => ({ hero_id: s(p?.hero_id), name: s(p?.name), power: s(p?.power) }));
  const src = (b.source ?? {}) as Record<string, unknown>;

  let source: NewsSource | PersonalSource;
  if (mode === "news") {
    source = { headline: s(src.headline), snippet: s(src.snippet), source: s(src.source), url: s(src.url), date: s(src.date), place: s(src.place) };
    if (!source.headline) return NextResponse.json({ error: "source.headline is required" }, { status: 400 });
  } else {
    const steps = Array.isArray(src.steps) ? src.steps.map(s) : s(src.steps);
    source = { author_id: s(src.author_id), title: s(src.title), setup: s(src.setup), steps, real_ending: s(src.real_ending) };
    if (!source.setup && !source.title) return NextResponse.json({ error: "source.setup is required" }, { status: 400 });
  }

  const result = await makeOpener({ mode, rating, party, source });
  return NextResponse.json(result);
}
