// Public types for the scene-art module (see README.md in this folder).

export type ArtHeroVisual = {
  anchor: string;
  outfit?: string;
  palette?: string[];
  prop?: string;
  expression?: string;
};

export type ArtHero = {
  /** Stable id (ready-made hero id like "raccoon", or the player id). Part of the cache key. */
  id: string;
  name?: string;
  /** "/heroes/raccoon.webp" (a file under game/public) or a data: URL. */
  portraitUrl?: string;
  /** Raw base64 or a data: URL. Used when portraitUrl is missing. */
  base64?: string;
  /** The hero's `visual` block (Hero.visual) or a short free-text description. */
  visual?: ArtHeroVisual | string;
};

export type Rating = "kids" | "teens" | "adults";

type Common = {
  questId: string;
  heroes: ArtHero[];
  rating?: Rating | string;
  /** Override the pre-painted plate (a /public path or data: URL), e.g. for live-news quests. */
  sceneUrl?: string;
  /** Override the scene description used in the prompt (location + situation). */
  sceneText?: string;
  /** "fast" = low reasoning (default for scenes), "best" = high (default for posters). */
  quality?: "fast" | "best";
};

export type SceneArtRequest = Common & {
  mode?: "scene";
  /** 0-based (0 → scene_1.webp), or "quick" (the Quick Tale plate, scene_3.webp). */
  sceneIndex: number | "quick";
  /** Optional one-line action for the heroes, e.g. the outcome narration. Changes the cache key. */
  moment?: string;
  /** design/24 P5b: one art style per story (lib/artStyles.ts). Missing = Neon Uncanny. Changes the cache key. */
  style?: string;
  /** The real event's kind of place (opener.real_setting.place_type, spoiler-free). Paints the new shot there. */
  setting?: string;
  /** true = paint a NEW shot of the next moment (sceneText + moment); Image 1 is only a style/continuity reference. */
  newScene?: boolean;
};

export type PosterRequest = Common & {
  mode: "poster";
  /** Not painted (Muse garbles text). Echoed back so the caller can overlay it in HTML. */
  title?: string;
};

export type ArtRequest = SceneArtRequest | PosterRequest;

export type ArtResult = {
  /** data:image/webp;base64,… on success, or the original plate path ("/quests/…") on fallback. */
  url: string;
  cached: boolean;
  ms: number;
  key: string;
  fallback?: boolean;
  error?: string;
  title?: string;
};
