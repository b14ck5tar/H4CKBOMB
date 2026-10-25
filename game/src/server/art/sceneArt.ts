import "server-only";
import crypto from "node:crypto";
import { museImage } from "@/server/muse";
import { getCached, markFailure, once, persist, recentFailure, store } from "./cache";
import { finalize, loadImage, toRef } from "./images";
import { posterEditPrompt, PROMPT_VERSION, sceneEditPrompt } from "./prompt";
import { resolvePlate } from "./quests";
import type { ArtHero, ArtRequest, ArtResult } from "./types";

// Paints the party's heroes INTO a quest's pre-painted scene with muse-image-1.0 /v1/images/edits.
// refs = [scene plate, ...hero portraits]. Never throws: on any failure the caller gets the original plate.

export const MAX_SCENE_HEROES = 4;
export const MAX_POSTER_HEROES = 6;
const SCENE_TIMEOUT_MS = 40_000;
const POSTER_TIMEOUT_MS = 55_000;

export class ArtInputError extends Error {}

const hash = (b: Buffer | string) => crypto.createHash("sha1").update(b).digest("hex");
const toDataUrl = (b: Buffer) => `data:image/webp;base64,${b.toString("base64")}`;

export async function paintArt(req: ArtRequest, origin?: string): Promise<ArtResult> {
  const t0 = Date.now();
  const poster = req.mode === "poster";
  if (!req || typeof req.questId !== "string" || !req.questId) throw new ArtInputError("questId required");
  if (!Array.isArray(req.heroes) || req.heroes.length === 0) throw new ArtInputError("heroes required");
  const scene = poster ? "climax" : req.sceneIndex;
  if (scene !== "climax" && scene !== "quick" && !(Number.isInteger(scene) && (scene as number) >= 0))
    throw new ArtInputError('sceneIndex must be a 0-based number or "quick"');

  const plate = resolvePlate(req.questId, scene as number | "quick" | "climax");
  const plateUrl = req.sceneUrl || plate?.url;
  if (!plateUrl) throw new ArtInputError(`no scene plate for ${req.questId}/${String(scene)} (pass sceneUrl)`);
  const sceneText = (req.sceneText ?? plate?.text ?? "").slice(0, 300);

  // De-dupe heroes by id, cap the count, keep the caller's order (it becomes left-to-right in the frame).
  const seen = new Set<string>();
  const heroes = req.heroes
    .filter((h): h is ArtHero => !!h && typeof h.id === "string" && !seen.has(h.id) && !!seen.add(h.id))
    .slice(0, poster ? MAX_POSTER_HEROES : MAX_SCENE_HEROES);

  const fallback = (error: string, key = ""): ArtResult => ({
    url: plateUrl,
    cached: false,
    fallback: true,
    error,
    key,
    ms: Date.now() - t0,
    title: poster ? req.title : undefined,
  });

  // Load refs. A hero without a loadable portrait is still described in text.
  let plateBuf: Buffer;
  try {
    plateBuf = await loadImage(plateUrl, origin);
  } catch (e) {
    return fallback(`plate: ${(e as Error).message}`);
  }
  const portraits = await Promise.all(
    heroes.map(async (h) => {
      const src = h.portraitUrl || h.base64;
      if (!src) return null;
      try {
        return await loadImage(src, origin);
      } catch (e) {
        console.warn(`[scene-art] portrait for ${h.id} skipped: ${(e as Error).message}`);
        return null;
      }
    }),
  );
  const withPortrait = heroes.filter((_, i) => portraits[i]);
  const bufs = portraits.filter((b): b is Buffer => !!b);
  if (withPortrait.length === 0) return fallback("no hero portraits could be loaded");

  // Cache key: mode, quest, scene, sorted hero ids (+ portrait hash so a repainted hero isn't stale), plate, extras.
  const heroKey = withPortrait
    .map((h, i) => `${h.id}:${hash(bufs[i]).slice(0, 8)}`)
    .sort()
    .join(",");
  const extras = poster ? "" : (req as { moment?: string }).moment ?? "";
  const style = poster ? "" : String((req as { style?: string }).style ?? "");
  const key = hash(
    [PROMPT_VERSION, poster ? "poster" : "scene", req.questId, String(scene), hash(plateBuf).slice(0, 8), heroKey, req.rating ?? "", extras, req.quality ?? "", style].join("|"),
  ).slice(0, 24);

  const hit = await getCached(key);
  if (hit) {
    store.stats.hits++;
    return { url: toDataUrl(hit), cached: true, key, ms: Date.now() - t0, title: poster ? req.title : undefined };
  }
  const failed = recentFailure(key);
  if (failed) return fallback(`recently failed, not retrying yet: ${failed}`, key);

  const { promise, shared } = once(key, async () => {
    const quality = req.quality ?? (poster ? "best" : "fast");
    const refs = [
      await toRef(plateBuf, poster ? 1280 : 1536, poster ? 1280 : 864, 84),
      ...(await Promise.all(bufs.map((b) => toRef(b, 512, 512, 82)))),
    ];
    const prompt = poster
      ? posterEditPrompt({ heroes: withPortrait, sceneText, rating: req.rating })
      : sceneEditPrompt({ heroes: withPortrait, sceneText, moment: extras || undefined, rating: req.rating, style });
    const t1 = Date.now();
    store.stats.calls++;
    const tag = `${poster ? "poster" : "scene"} ${req.questId}/${String(scene)} heroes=${withPortrait.map((h) => h.id).join(",")} q=${quality} key=${key}`;
    console.log(`[scene-art] CALL #${store.stats.calls} ${tag} refs=${refs.length} refKB=${Math.round(refs.reduce((a, r) => a + r.length, 0) / 1365)}`);
    try {
      const img = await museImage({
        prompt,
        size: poster ? "1024x1536" : "1920x1080",
        quality,
        refs,
        timeoutMs: poster ? POSTER_TIMEOUT_MS : SCENE_TIMEOUT_MS,
      });
      const out = await finalize(Buffer.from(img.b64, "base64"), poster ? 1280 : 1920);
      const ms = Date.now() - t1;
      store.stats.ok++;
      store.stats.totalMs += ms;
      console.log(`[scene-art] OK ${tag} ${ms}ms ${Math.round(out.length / 1024)}KB`);
      await persist(key, out);
      return out;
    } catch (e) {
      store.stats.failed++;
      const msg = (e as Error).name === "TimeoutError" ? "timed out" : (e as Error).message;
      console.warn(`[scene-art] FAIL ${tag} ${Date.now() - t1}ms: ${msg}`);
      markFailure(key, msg);
      throw new Error(msg);
    }
  });
  if (shared) store.stats.shared++;

  try {
    const buf = await promise;
    return { url: toDataUrl(buf), cached: shared, key, ms: Date.now() - t0, title: poster ? req.title : undefined };
  } catch (e) {
    return fallback((e as Error).message, key);
  }
}
