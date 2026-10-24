import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

// Loading refs: only data: URLs and same-site /public paths are accepted (never arbitrary http URLs: SSRF).

type SharpFn = typeof import("sharp");
let sharpMod: SharpFn | null | undefined;
async function getSharp(): Promise<SharpFn | null> {
  if (sharpMod !== undefined) return sharpMod;
  try {
    sharpMod = (await import("sharp")).default as unknown as SharpFn;
  } catch {
    sharpMod = null; // still works, just sends bigger refs
  }
  return sharpMod;
}

const PUBLIC_DIR = path.join(process.cwd(), "public");

function decodeDataUrl(s: string): Buffer {
  const m = s.match(/^data:image\/[\w.+-]+;base64,([\s\S]+)$/);
  if (!m) throw new Error("bad data URL");
  return Buffer.from(m[1], "base64");
}

/** Accepts a data: URL, raw base64, or a "/public/path". `origin` is used only if the file isn't on disk (Vercel). */
export async function loadImage(src: string, origin?: string): Promise<Buffer> {
  if (src.startsWith("data:")) return decodeDataUrl(src);
  if (src.startsWith("/") && !src.startsWith("//")) {
    const clean = decodeURIComponent(src.split(/[?#]/)[0]);
    const file = path.resolve(PUBLIC_DIR, "." + clean);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new Error("path escapes public/");
    try {
      return await fs.readFile(file);
    } catch {
      // On Vercel, public/ isn't in the function bundle: fetch the static asset from our own deployment.
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : origin;
      if (!base) throw new Error(`not found: ${clean}`);
      const res = await fetch(new URL(clean, base), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`fetch ${clean}: HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(src) && src.length > 100) return Buffer.from(src, "base64");
  throw new Error("unsupported image source (use a data: URL or a /public path)");
}

/** Downscale to fit inside maxW×maxH and re-encode as webp → data URL (small refs = faster, cheaper calls). */
export async function toRef(buf: Buffer, maxW: number, maxH: number, quality = 82): Promise<string> {
  const sharp = await getSharp();
  if (!sharp) return `data:image/webp;base64,${buf.toString("base64")}`;
  const out = await sharp(buf).resize(maxW, maxH, { fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
  return `data:image/webp;base64,${out.toString("base64")}`;
}

/** Final output: cap width (2048×1152 → 1920×1080) and re-encode to keep the TV payload ~300–500 KB. */
export async function finalize(buf: Buffer, maxW: number): Promise<Buffer> {
  const sharp = await getSharp();
  if (!sharp) return buf;
  try {
    return await sharp(buf).resize({ width: maxW, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  } catch {
    return buf;
  }
}
