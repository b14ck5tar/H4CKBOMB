import "server-only";
import type { QuestPick } from "@/lib/types";
import { fallbackPickQuest, spotlightHow } from "@/server/fallbacks";
import { cleanText, type PickInput } from "@/server/real";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/**
 * QuestPick checks: quest_id must be a candidate (else null, and the caller uses the fallback). Every hero gets
 * exactly one spotlight in scene 0-2, spread out (at most ceil(n/3) per scene). Bad or missing ones are patched,
 * unknown heroes and duplicates are dropped, and the result is in party order.
 */
export function normalizePick(data: Any, inp: PickInput): QuestPick | null {
  if (!inp.candidates.some((c) => c.id === data?.quest_id)) return null;
  const fb = fallbackPickQuest(inp);
  const cap = Math.max(1, Math.ceil(inp.party.length / 3));
  const counts = [0, 0, 0];
  const given = new Map<string, { scene: number; how: string }>();
  for (const s of Array.isArray(data.spotlights) ? data.spotlights : []) {
    const id = String(s?.hero_id ?? "");
    if (!given.has(id)) given.set(id, { scene: Number(s?.scene), how: cleanText(s?.how, 160) });
  }
  const placed: (QuestPick["spotlights"][number] | null)[] = inp.party.map((p) => {
    const g = given.get(p.hero_id);
    if (!g || ![0, 1, 2].includes(g.scene) || counts[g.scene] >= cap) return null;
    counts[g.scene]++;
    const scene = g.scene as 0 | 1 | 2;
    return { hero_id: p.hero_id, scene, how: g.how || spotlightHow(p.hero_name || p.name, p.skill, scene, inp.rating) };
  });
  const spotlights = placed.map((s, i) => {
    if (s) return s;
    // Least-used scene, earliest first. The model's "how" was written for another scene, so use the canned line.
    const scene = counts.indexOf(Math.min(...counts)) as 0 | 1 | 2;
    counts[scene]++;
    const p = inp.party[i];
    return { hero_id: p.hero_id, scene, how: spotlightHow(p.hero_name || p.name, p.skill, scene, inp.rating) };
  });
  return { quest_id: data.quest_id, why: cleanText(data.why, 200) || fb.why, spotlights };
}
