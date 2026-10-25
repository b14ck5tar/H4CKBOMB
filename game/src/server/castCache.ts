import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Muse casts each story's narrator ONCE; the pick (voice, style, art, music, stakes) is stored on disk and reused on
// every later play of that story. The same story always gets the same voice, so its pre-made opener audio is
// instant and costs no voice credits (judge mode replays the same 3 stories). Keyed by rating + story text, so a
// changed story is cast again.

const DIR = path.join(os.tmpdir(), "group-project-cast");
const CAST_VOICES = new Set(["vesper", "hollis", "wren"]);

function keyOf(input: unknown, rating: string) {
  const i = (input ?? {}) as { title?: unknown; premise?: unknown; problem?: { name?: unknown } };
  return crypto.createHash("sha1").update(`c1|${rating}|${String(i.title ?? "")}|${String(i.premise ?? "")}|${String(i.problem?.name ?? "")}`).digest("hex");
}

export function storedCast(input: unknown, rating: string): Record<string, unknown> | null {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, `${keyOf(input, rating)}.json`), "utf8"));
    return d && CAST_VOICES.has(d.voice) ? d : null;
  } catch {
    return null;
  }
}

export function storeCast(input: unknown, rating: string, data: unknown) {
  const d = data as { voice?: unknown } | null;
  if (!d || !CAST_VOICES.has(String(d.voice))) return; // only a real Muse pick, never a fallback
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, `${keyOf(input, rating)}.json`), JSON.stringify(d));
  } catch {}
}
