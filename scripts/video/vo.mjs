// The video's narrator lines: Sarah on ElevenLabs Flash v2.5 at the game's Combo settings (game/src/server/tts.ts),
// one 24 kHz WAV per EDL beat in devpost-media/video/vo/<id>.wav. Only lines that are missing or whose text changed
// are generated (vo/lines.json remembers the text), so a rewrite costs only that line's characters.
//   node scripts/video/vo.mjs --check        remaining ElevenLabs characters + what this run would cost
//   node scripts/video/vo.mjs                generate
//   node scripts/video/vo.mjs --only d5      just one line
// The key is read from .env.local and never printed.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..", "..");
const VID = path.join(ROOT, "devpost-media", "video");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
);
const KEY = env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY missing in .env.local");
const SARAH = "EXAVITQu4vr4xnSDxMaL";
const COMBO = { stability: 0.2, similarity_boost: 0.75, style: 0.65, use_speaker_boost: true, speed: 1.08 }; // tts.ts FLASH

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const edl = JSON.parse(fs.readFileSync(path.join(VID, "edl.json"), "utf8"));
const donePath = path.join(VID, "vo", "lines.json");
const done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : {};
const todo = edl.beats.filter((b) => b.vo && (!only || b.id === only) && (done[b.id] !== b.vo || !fs.existsSync(path.join(VID, "vo", `${b.id}.wav`))));
const cost = todo.reduce((n, b) => n + b.vo.length, 0);

const subRes = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": KEY } });
const sub = subRes.ok ? await subRes.json() : null; // the key may lack "User: Read"
const left = sub ? sub.character_limit - sub.character_count : "unknown";
console.log(`ElevenLabs credits left: ${left}. This run: ${todo.length} lines, ${cost} characters (~${Math.ceil(cost / 2)} credits on Flash).`);
if (args.includes("--check")) process.exit(0);

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

let prev = null;
let spent = 0;
for (const b of edl.beats.filter((x) => x.vo)) {
  if (!todo.includes(b)) { prev = b.vo; continue; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${SARAH}?output_format=pcm_24000`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    // previous_text keeps the read continuous across lines (same pitch and pace), free of charge
    body: JSON.stringify({ text: b.vo, model_id: "eleven_flash_v2_5", voice_settings: COMBO, ...(prev ? { previous_text: prev } : {}) }),
  });
  if (!res.ok) throw new Error(`${b.id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(path.join(VID, "vo", `${b.id}.wav`), wav(Buffer.from(await res.arrayBuffer())));
  done[b.id] = b.vo;
  fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
  spent += Number(res.headers.get("character-cost")) || 0;
  console.log(`  ${b.id}  ${b.vo}`);
  prev = b.vo;
}
console.log(`credits spent: ${spent}`);
