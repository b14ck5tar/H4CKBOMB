#!/usr/bin/env node
/**
 * Devpost gallery shots: plays one real game (TV + 2 phones + 1 test player) in headless Chrome and saves clean
 * 1920x1080 TV screenshots, 390x844 phone screenshots and two "TV + phones" composites.
 *
 *   1. Start a separate dev server (never port 3000 / .next-main):
 *        cd game && NEWS_LIVE=0 NEXT_DIST_DIR=.next-shots npx next dev -p 3012
 *      (NEWS_LIVE=0 keeps SerpApi out of it: the story cards come from the saved fixture + the story library.)
 *   2. node scripts/gallery-shots.mjs                 # defaults below
 *        --base http://localhost:3012  --out devpost-media/gallery-v2  --chrome "<path to chrome.exe>"
 *        --headed (watch it)  --keep (leave Chrome open at the end)
 *   Or against the deployed build:  node scripts/gallery-shots.mjs --base https://groupproject-game.vercel.app
 *   (production has no window.__host, so this script needs a dev server: it reads the table's state from it.)
 *
 * No dependencies beyond Node 22+ (built-in WebSocket) and sharp from game/node_modules (for JPG + composites).
 * Real Muse calls per run: 1 custom hero portrait, 4 turns (ruling + turn + painting), the finale and the ending.
 * Everything else is ready-made art. Never touches keys.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d;
};
const has = (k) => process.argv.includes(`--${k}`);
const BASE = arg("base", "http://localhost:3012").replace(/\/$/, "");
const OUT = path.resolve(ROOT, arg("out", "devpost-media/gallery-v2"));
const RAW = path.join(OUT, "raw");
const PORT = Number(arg("cdp", "9339"));
const PUBLIC_URL = arg("public", "https://groupproject-game.vercel.app");
const CHROME =
  arg("chrome") ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((p) => fs.existsSync(p));
const sharp = createRequire(path.join(ROOT, "game", "package.json"))("sharp");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
fs.mkdirSync(RAW, { recursive: true });

// ------------------------------------------------------------------ a tiny CDP client (no puppeteer needed)
let ws;
let seq = 0;
const pending = new Map();
function cdp(method, params = {}, sessionId, timeoutMs = 60_000) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => {
    pending.set(id, { res, rej, method });
    setTimeout(() => pending.has(id) && (pending.delete(id), rej(new Error(`CDP timeout: ${method}`))), timeoutMs);
  });
}

async function launch() {
  if (!CHROME) throw new Error("No Chrome/Edge found: pass --chrome <path>");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gp-shots-"));
  const proc = spawn(
    CHROME,
    [
      ...(has("headed") ? [] : ["--headless=new"]),
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--mute-audio",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--hide-scrollbars",
      "--window-size=1920,1080",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let ver;
  for (let i = 0; i < 60 && !ver; i++) {
    await sleep(250);
    ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null);
  }
  if (!ver) throw new Error("Chrome did not open its debugging port");
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result);
    }
  };
  return { proc, profile };
}

/** One tab with its own viewport. */
async function openPage(url, { width, height, scale = 1, mobile = false }) {
  const { targetId } = await cdp("Target.createTarget", { url: "about:blank", newWindow: true });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile }, sessionId);
  if (mobile) await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await cdp("Page.navigate", { url }, sessionId, 240_000); // a dev server compiles a route on first visit
  const page = {
    sessionId,
    async eval(expr) {
      const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
      return r.result.value;
    },
    async shot(name, { jpg = true } = {}) {
      if (this.clean) await this.eval(this.clean).catch(() => {});
      const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
      const buf = Buffer.from(data, "base64");
      const file = path.join(RAW, `${name}.${jpg ? "jpg" : "png"}`);
      if (jpg) await sharp(buf).jpeg({ quality: 90, mozjpeg: true }).toFile(file);
      else fs.writeFileSync(file, buf);
      log("shot", path.relative(ROOT, file));
      return file;
    },
  };
  return page;
}

// ------------------------------------------------------------------ in-page helpers for the phones
const PHONE_KIT = `
window.__gp = window.__gp || (() => {
  const vis = (el) => !!el && el.offsetParent !== null && !el.disabled;
  const q = (s) => [...document.querySelectorAll(s)].filter(vis);
  const setVal = (el, v) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const fields = () => q("textarea, input:not([type=hidden]):not([aria-label='Room code'])").filter((e) => !e.readOnly);
  const submit = () => { const b = q("button[type=submit]")[0]; if (b) { b.click(); return true; } return false; };
  const text = () => document.body.innerText;
  return { q, setVal, fields, submit, text };
})()`;

/** Runs `js` on a phone until it reports success (true or a count > 0); phones can lag the TV by a few seconds. */
async function phoneDo(page, js, timeout = 45_000) {
  const t0 = Date.now();
  let r;
  for (;;) {
    r = await page.eval(`(() => { ${PHONE_KIT}; const g = window.__gp; ${js} })()`).catch((e) => e.message);
    if (r === true || (typeof r === "number" && r > 0)) return r;
    if (Date.now() - t0 > timeout) {
      log("phone step gave up:", JSON.stringify(r), "|", js.replace(/\s+/g, " ").slice(0, 80));
      return r;
    }
    await sleep(500);
  }
}

// ------------------------------------------------------------------ the table
const tvState = (tv) =>
  tv.eval(`(() => { const s = window.__host?.state; if (!s) return null; return {
    code: s.code, phase: s.phase, players: s.players.map(p => ({ id: p.id, name: p.name, hero: !!p.hero, portrait: !!p.hasPortrait })),
    turnOrder: s.turnOrder, turnIndex: s.turnIndex, ideas: Object.keys(s.ideas || {}).length, nowGoal: s.nowGoal, goal: s.goal,
    pitches: (s.pitches || []).length, votes: Object.keys(s.votes || {}).length, artKey: s.artKey, sceneArt: s.sceneArt,
    rolls: (s.rolls || []).length, outcome: s.outcome, finale: s.finale, storyOptions: (s.storyOptions || []).length,
    final: !!s.final, busy: s.busy }; })()`);

async function waitFor(tv, test, { timeout = 90_000, label = "condition", every = 400 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const s = await tvState(tv).catch(() => null);
    if (s && test(s)) return s;
    if (Date.now() - t0 > timeout) {
      for (const [i, p] of DEBUG_PAGES.entries()) log(`page ${i}:`, (await p.eval("document.body.innerText").catch(() => "?")).replace(/\s+/g, " ").slice(0, 400));
      throw new Error(`timed out waiting for ${label} (phase ${s?.phase}; players ${JSON.stringify(s?.players)})`);
    }
    await sleep(every);
  }
}

const DEBUG_PAGES = [];
const lc = (t) => (t || "").replace(/[.!?]+$/, "").replace(/^\w/, (c) => c.toLowerCase());
const GIMMICKS = ["with a megaphone and total confidence", "by bribing everyone with warm cinnamon rolls", "using a very long ladder and a calm voice", "while humming the theme from a cooking show"];
const IDEAS = ["Ask the oldest person in town what they know", "Build a ramp out of folding tables", "Distract it with a marching band", "Call in a favor from the local bakery"];

async function main() {
  const t0 = Date.now();
  // Warm the routes first (a dev server compiles each one on its first visit, which can take a minute).
  for (const r of ["/tv", "/play?code=WARM"]) {
    const t = Date.now();
    await fetch(`${BASE}${r}`).then((x) => x.text()).catch(() => "");
    log("warm", r, `${Date.now() - t} ms`);
  }
  const { proc, profile } = await launch();
  log("chrome up:", path.basename(CHROME), "base:", BASE);
  const tv = await openPage(`${BASE}/tv?bots=1`, { width: 1920, height: 1080 });
  // Clean frames: no Next.js dev badge, no "+ test player" button, and the public address + QR instead of localhost.
  const qr = await createRequire(path.join(ROOT, "game", "package.json"))("qrcode").toDataURL(`${PUBLIC_URL}/play`, { margin: 1, width: 600 });
  tv.clean = `(() => {
    if (!document.getElementById("gp-clean")) {
      const st = document.createElement("style");
      st.id = "gp-clean";
      st.textContent = "nextjs-portal, .lb-bot { display: none !important; }";
      document.head.appendChild(st);
    }
    for (const b of document.querySelectorAll(".lb-url b")) b.textContent = ${JSON.stringify(PUBLIC_URL.replace(/^https?:\/\//, ""))} + "/play";
    for (const i of document.querySelectorAll(".lb-qr img, img[alt^='QR code']")) if (i.src !== ${JSON.stringify(qr)}) i.src = ${JSON.stringify(qr)};
    return true;
  })()`;
  const s0 = await waitFor(tv, (s) => s.phase === "lobby" && /^[A-Z]{4}$/.test(s.code), { label: "the TV lobby" });
  const code = s0.code;
  log("room", code);
  // Full Story, odd news, teens: the story vote (Quick Tale skips it).
  await tv.eval(`(() => { const h = window.__host; h.setMode("full"); h.setSource("news"); h.setRating("teens"); return true; })()`);
  await sleep(6000);
  await tv.shot("01-lobby-title");

  const phoneOpts = { width: 390, height: 844, scale: 2, mobile: true };
  const p1 = await openPage(`${BASE}/play?code=${code}&as=1`, phoneOpts);
  const p2 = await openPage(`${BASE}/play?code=${code}&as=2`, phoneOpts);
  p1.clean = p2.clean = `(() => { if (!document.getElementById("gp-clean")) { const st = document.createElement("style"); st.id = "gp-clean"; st.textContent = "nextjs-portal { display: none !important; }"; document.head.appendChild(st); } return true; })()`;
  const phones = [p1, p2];
  DEBUG_PAGES.push(tv, p1, p2);
  // Join (the room code is locked in from the link; only a name is needed).
  for (const [i, p] of phones.entries()) {
    await phoneDo(p, `const f = g.fields()[0]; if (!f) return "no field"; g.setVal(f, ${JSON.stringify(["Maya", "Leo"][i])}); return true;`);
    await sleep(300);
    if (i === 0) await p.shot("p01-join");
    await phoneDo(p, `return g.submit();`);
  }
  await sleep(2500);
  // Phone 1 makes a custom hero (the one live portrait); phone 2 grabs a ready-made one.
  await phoneDo(
    p1,
    `const [t, s] = g.fields(); if (!t) return "no hero form";
     g.setVal(t, "a night-shift baker who argues with her sourdough and usually wins");
     if (s) g.setVal(s, "parallel parking"); return true;`,
  );
  await sleep(500);
  await p1.shot("p02-make-hero");
  await phoneDo(p1, `return g.submit();`);
  await phoneDo(p2, `const m = g.q(".pk-mini:not(.is-taken)"); if (!m.length) return "no ready-made"; m[1 % m.length].click(); return true;`);
  await sleep(2500);
  await phoneDo(p2, `if (!g.text().toUpperCase().includes("ONE QUICK QUESTION")) return "not on the talent screen"; const f = g.fields()[0]; if (!f) return "no skill field"; g.setVal(f, "remembering every birthday"); return g.submit();`);
  await tv.eval(`window.__host.addBot(), true`);
  await waitFor(tv, (s) => s.players.length >= 3 && s.players.every((p) => p.hero), { label: "3 heroes", timeout: 120_000 });
  // Wait for the live portrait to land (max ~45 s), then let the cards settle.
  await waitFor(tv, (s) => s.players.every((p) => p.portrait), { label: "portraits", timeout: 45_000 }).catch((e) => log("note:", e.message));
  await sleep(5000);
  await tv.shot("02-heroes-lobby");
  await p1.shot("p03-lobby-ready");

  // ---- the story pick
  await tv.eval(`window.__host.begin(), true`);
  await waitFor(tv, (s) => s.phase === "story_vote" && s.storyOptions > 0, { label: "the story vote", timeout: 120_000 });
  await sleep(3500);
  await p1.shot("p04-story-vote");
  await phoneDo(p1, `const b = g.q(".pk-quest"); if (!b.length) return "no cards"; b[0].click(); return true;`);
  await sleep(1500);
  await tv.shot("03-story-pick");
  await phoneDo(p2, `const b = g.q(".pk-quest"); if (!b.length) return "no cards"; b[0].click(); return true;`);

  // ---- the opener
  await waitFor(tv, (s) => s.phase === "narrating", { label: "the opener", timeout: 150_000 });
  await sleep(7000);
  await tv.shot("04-opener");

  // ---- turns
  const humanIds = (await tvState(tv)).players.filter((p) => ["Maya", "Leo"].includes(p.name)).map((p) => p.id);
  let turnNo = 0;
  for (;;) {
    const s = await waitFor(tv, (x) => x.phase === "turn" || x.phase === "pitch", { label: "a turn", timeout: 180_000 });
    if (s.phase === "pitch") break;
    turnNo++;
    const ownerId = s.turnOrder[s.turnIndex];
    const owner = phones[humanIds.indexOf(ownerId)] ?? p1;
    const friend = owner === p1 ? p2 : p1;
    const goal = s.nowGoal || s.goal;
    log(`turn ${turnNo}: owner ${owner === p1 ? "Maya" : "Leo"}; right now: ${goal}`);
    await sleep(2500);
    // The friend suggests a move.
    await phoneDo(friend, `const f = g.fields()[0]; if (!f) return "no idea box"; g.setVal(f, ${JSON.stringify(IDEAS[(turnNo - 1) % IDEAS.length])}); return true;`);
    await sleep(400);
    if (turnNo === 1) await friend.shot("p05-suggest");
    await phoneDo(friend, `return g.submit();`);
    // Wait for the ideas (the friend + the test player), then the owner takes a friend's idea and adds a spin.
    await waitFor(tv, (x) => x.ideas >= 2 || x.phase !== "turn", { label: "ideas", timeout: 30_000 }).catch(() => {});
    await sleep(1500);
    if (turnNo === 1) await tv.shot("05-turn-suggestions");
    await phoneDo(owner, `const b = g.q("button.pk-plan"); if (b.length) b[0].click(); return b.length;`, 8000);
    await sleep(500);
    await phoneDo(owner, `const f = g.fields()[0]; if (f) g.setVal(f, ${JSON.stringify(`I ${lc(goal) || "save the day"} ${GIMMICKS[(turnNo - 1) % GIMMICKS.length]}`.slice(0, 130))}); return !!f;`, 15_000);
    await sleep(600);
    if (turnNo === 1) await owner.shot("p06-your-turn");
    await phoneDo(owner, `return g.submit();`);
    // The plan card (the ruling), then the throw.
    await waitFor(tv, (x) => x.phase === "ruling", { label: "the ruling", timeout: 40_000 });
    await sleep(2600);
    if (turnNo === 1) await tv.shot("06-plan-card");
    await waitFor(tv, (x) => x.phase === "roll", { label: "the roll", timeout: 40_000 });
    await sleep(1200);
    if (turnNo === 1) await owner.shot("p07-throw");
    await phoneDo(owner, `const b = document.querySelector(".pk-tapthrow"); if (b) b.click(); return !!b;`);
    if (turnNo <= 2) {
      for (const ms of [500, 500, 600, 1400, 2500]) {
        await sleep(ms);
        await tv.shot(`07-dice-t${turnNo}-${ms}`);
      }
    }
    // The outcome: wait for the new painting (artKey moves), then let the crossfade finish.
    const before = (await tvState(tv)).artKey;
    await waitFor(tv, (x) => x.phase === "outcome", { label: "the outcome", timeout: 40_000 });
    await waitFor(tv, (x) => x.artKey !== before || x.phase !== "outcome", { label: "new painting", timeout: 40_000 }).catch((e) => log("note:", e.message));
    await sleep(3500);
    await tv.shot(`08-outcome-t${turnNo}`);
    await sleep(3000);
    await tv.shot(`08-outcome-t${turnNo}-late`);
    if (turnNo === 1) await friend.shot("p08-watching");
  }

  // ---- the finale: everyone pitches, backs a plan (not their own) and shakes at once
  log("finale");
  await sleep(2000);
  for (const [i, p] of phones.entries()) {
    await phoneDo(p, `const f = g.fields()[0]; if (!f) return "no box"; g.setVal(f, ${JSON.stringify(["We all push together while Leo counts us in", "Throw the biggest party anyone has ever seen"][i])}); return true;`);
    await sleep(300);
    if (i === 0) await p.shot("p09-finale-pitch");
    await phoneDo(p, `return g.submit();`);
  }
  await waitFor(tv, (x) => x.phase === "vote", { label: "the finale vote", timeout: 60_000 });
  await sleep(3000);
  await tv.shot("09-finale-vote");
  for (const p of phones) await phoneDo(p, `const b = g.q("button.pk-plan"); if (b.length) b[0].click(); return b.length;`, 15_000);
  await waitFor(tv, (x) => x.phase === "final_roll", { label: "the shake", timeout: 60_000 });
  await sleep(1500);
  await p1.shot("p10-shake");
  for (const p of phones) await phoneDo(p, `const b = document.querySelector(".pk-arcade"); if (b) b.click(); return !!b;`, 15_000);
  await sleep(1200);
  await tv.shot("10-finale-armed");
  for (let k = 0; k < 6; k++) {
    for (const p of phones) await phoneDo(p, `const b = document.querySelector(".pk-arcade.is-shake, .pk-arcade"); if (b) b.click(); return !!b;`, 3000);
    await sleep(700);
    const x = await tvState(tv);
    if (x.phase !== "final_roll") break;
  }
  await sleep(600);
  await tv.shot("10-finale-roll");
  await waitFor(tv, (x) => x.phase === "final_result", { label: "the final result", timeout: 40_000 }).catch(() => {});
  await sleep(2500);
  await tv.shot("10-finale-result");

  // ---- the ending ("Because of you") and the reveal ("Based on a true story")
  await waitFor(tv, (x) => x.phase === "epilogue", { label: "the ending", timeout: 90_000 });
  await sleep(6000);
  await tv.shot("11-ending");
  await waitFor(tv, (x) => x.phase === "reveal" || x.phase === "storybook", { label: "the reveal", timeout: 120_000 });
  await sleep(6000);
  await tv.shot("12-reveal");
  await p1.shot("p11-reveal");
  await sleep(6000);
  await tv.shot("12-reveal-late");
  await sleep(10_000);
  await tv.shot("13-keepsake");

  log(`game done in ${Math.round((Date.now() - t0) / 1000)} s`);
  await compose();
  if (!has("keep")) {
    proc.kill();
    await sleep(800);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ pick the gallery set + composites
const PICK = [
  ["01-lobby.jpg", ["02-heroes-lobby", "01-lobby-title"]],
  ["02-title-screen.jpg", ["01-lobby-title"]],
  ["03-story-pick.jpg", ["03-story-pick"]],
  ["04-opener.jpg", ["04-opener"]],
  ["05-turn-suggestions.jpg", ["05-turn-suggestions"]],
  ["06-plan-card.jpg", ["06-plan-card"]],
  ["07-dice-roll.jpg", ["07-dice-t1-600", "07-dice-t1-500"]],
  ["08-dice-landed.jpg", ["07-dice-t1-2500", "07-dice-t1-1400"]],
  ["09-outcome-scene-art.jpg", ["08-outcome-t1-late", "08-outcome-t1"]],
  ["10-finale-vote.jpg", ["09-finale-vote"]],
  ["11-finale-shake.jpg", ["10-finale-roll", "10-finale-result"]],
  ["12-ending.jpg", ["11-ending"]],
  ["13-reveal.jpg", ["12-reveal", "12-reveal-late"]],
  ["phone-1-make-hero.jpg", ["p02-make-hero"]],
  ["phone-2-your-turn.jpg", ["p06-your-turn"]],
  ["phone-3-suggest.jpg", ["p05-suggest"]],
  ["phone-4-throw.jpg", ["p07-throw"]],
  ["phone-5-shake.jpg", ["p10-shake"]],
];

const rawPath = (n) => path.join(RAW, `${n}.jpg`);
const first = (names) => names.map(rawPath).find((f) => fs.existsSync(f));

async function rounded(file, w, h, r) {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`);
  return sharp(file).resize(w, h).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

/** The TV big on the left, two phones standing on the right, on a dark neon-tinted backdrop. */
async function composite(out, tvFile, phoneFiles, caption) {
  const W = 1920;
  const H = 1080;
  const tvW = 1300;
  const tvH = Math.round((tvW * 9) / 16);
  const phH = 700;
  const phW = Math.round((phH * 390) / 844);
  const bg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="g" cx="30%" cy="35%" r="85%"><stop offset="0" stop-color="#2a0f3d"/><stop offset="0.6" stop-color="#120a1f"/><stop offset="1" stop-color="#07060c"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="${58}" y="${148}" width="${tvW + 24}" height="${tvH + 24}" rx="26" fill="#000" stroke="#ff2e7e" stroke-opacity="0.55" stroke-width="3"/>
    ${phoneFiles.map((_, i) => `<rect x="${1430 + i * 225 - 10}" y="${190 + i * 80 - 10}" width="${phW + 20}" height="${phH + 20}" rx="48" fill="#000" stroke="${i ? "#3de7ff" : "#c6ff2e"}" stroke-opacity="0.7" stroke-width="3"/>`).join("")}
    <text x="70" y="104" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="800" fill="#fff">${caption}</text>
  </svg>`);
  const layers = [{ input: await rounded(tvFile, tvW, tvH, 16), left: 70, top: 160 }];
  for (const [i, f] of phoneFiles.entries()) layers.push({ input: await rounded(f, phW, phH, 38), left: 1430 + i * 225, top: 190 + i * 80 });
  await sharp(bg).composite(layers).jpeg({ quality: 90, mozjpeg: true }).toFile(out);
  log("composite", path.relative(ROOT, out));
}

async function compose() {
  for (const [name, from] of PICK) {
    const src = first(from);
    if (src) fs.copyFileSync(src, path.join(OUT, name));
    else log("missing", name);
  }
  const c1 = [first(["05-turn-suggestions"]), first(["p06-your-turn"]), first(["p05-suggest"])];
  if (c1.every(Boolean)) await composite(path.join(OUT, "composite-1-turn.jpg"), c1[0], c1.slice(1), "Your friends pitch you ideas. Use one, they get the credit.");
  const c2 = [first(["07-dice-t1-2500", "07-dice-t1-1400"]), first(["p07-throw"]), first(["p10-shake"])];
  if (c2.every(Boolean)) await composite(path.join(OUT, "composite-2-roll.jpg"), c2[0], c2.slice(1), "Swipe to throw. Shake together for the finale.");
}

if (has("compose-only")) compose().then(() => process.exit(0));
else
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
