import "server-only";
import questImages from "@/data/quest_images.json";
import seedQuests from "@/data/seed_quests.json";

// Resolves a quest + scene to its pre-painted plate and a one-line description for the prompt.

type SeedScene = { kind?: string; location?: string; situation?: string };
type SeedQuest = { id: string; scenes?: SeedScene[]; quick_scene?: SeedScene; the_threat?: unknown };

const IMAGES = questImages as Record<string, string[]>;
const SEEDS = seedQuests as unknown as SeedQuest[];

/** Quick Tale plays on the last plate (QuickTV shows sceneImages[2] for pitch/roll/outcome; host.ts uses the last scene). */
export const QUICK_INDEX = 2;

export type Plate = { url: string; text: string; kind: string };

export function resolvePlate(questId: string, scene: number | "quick" | "climax"): Plate | null {
  const imgs = IMAGES[questId];
  const seed = SEEDS.find((q) => q.id === questId);
  const index = scene === "quick" || scene === "climax" ? (imgs ? imgs.length - 1 : QUICK_INDEX) : scene;
  const url = imgs?.[index];
  if (!url) return null;
  const s: SeedScene | undefined = scene === "quick" ? (seed?.quick_scene ?? seed?.scenes?.[index]) : seed?.scenes?.[index];
  const text = s ? [s.location, s.situation].filter(Boolean).join(": ") : "";
  return { url, text, kind: s?.kind ?? (scene === "quick" || scene === "climax" ? "climax" : "hook") };
}
