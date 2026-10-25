import v2 from "@/data/quickstart_heroes_v2.json";

/** The ready-made heroes (the 12 v2 characters). Their portraits live in public/heroes/v2/<id>.webp. */
export const READY_HEROES = v2;
const V2 = new Set(v2.map((h) => h.id));

/** A ready-made hero's portrait URL (v2 art, or an older one if a saved game still points at it). */
export function heroPortrait(id: string) {
  return V2.has(id) ? `/heroes/v2/${id}.webp` : `/heroes/${id}.webp`;
}
