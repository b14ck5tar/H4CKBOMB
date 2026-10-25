// Devpost cover: the TV lobby + one phone screen side by side, 1800x1200 (3:2).
//   node devpost-media/gallery-final/make-cover.mjs <phone.png|jpg> [tv.jpg]
// Writes devpost-media/gallery-final/1-lobby-and-phone.jpg. Uses sharp from game/node_modules.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const sharp = createRequire(path.join(root, "game", "package.json"))("sharp");
const phonePath = path.resolve(process.argv[2] ?? "");
const tvPath = path.resolve(process.argv[3] ?? path.join(root, "devpost-media/gallery-v2/raw/01-lobby-title.jpg"));
if (!process.argv[2] || !fs.existsSync(phonePath)) throw new Error("usage: make-cover.mjs <phone screenshot> [tv screenshot]");

const W = 1800, H = 1200, TVW = 1240, TVH = 698, PH = 1000;
const tv = await sharp(tvPath).resize(TVW, TVH, { fit: "cover" }).toBuffer();
const phone = await sharp(phonePath).resize({ height: PH }).toBuffer();
const pw = (await sharp(phone).metadata()).width;
const gap = Math.max(20, Math.round((W - TVW - pw) / 3));
const out = await sharp({ create: { width: W, height: H, channels: 3, background: "#0a0612" } })
  .composite([
    { input: tv, left: gap, top: Math.round((H - TVH) / 2) },
    { input: phone, left: Math.min(W - pw - gap, gap * 2 + TVW), top: Math.round((H - PH) / 2) },
  ])
  .jpeg({ quality: 88 })
  .toBuffer();
fs.writeFileSync(path.join(here, "1-lobby-and-phone.jpg"), out);
console.log(`cover written (phone ${pw}px wide, gap ${gap}px)`);
