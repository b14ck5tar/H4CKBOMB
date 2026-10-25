// Records one judge game on the LIVE site for the video: the TV (1920x1080) and one phone (390x844 @2x) as two
// 30 fps MP4s (CDP screencast frames with their arrival times -> ffmpeg), while a scripted phone plays: join, make a
// hero, take its turn (with a test player's idea, for the +1), swipe, finale plan, talk, vote, shake, then DM's Notes.
//   node scripts/video/capture.mjs [--base https://groupproject-game.vercel.app] [--out devpost-media/video/raw] [--name take2]
// Writes <name>-tv.mp4, <name>-phone.mp4 and <name>-events.json (seconds from the start of both videos).
// Real Muse calls: one custom portrait, the turns, the finale and the ending. No keys touched.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openPage, sleep, log, cdp, onEvent } from "./cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "https://groupproject-game.vercel.app");
const OUT = path.resolve(ROOT, arg("out", "devpost-media/video/raw"));
const NAME = arg("name", "take");
fs.mkdirSync(OUT, { recursive: true });
const FF = execFileSync("python", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();

// ---------------------------------------------------------------- recorder: every screencast frame to disk with its
// time, then one ffmpeg pass makes a 30 fps MP4 (each frame held until the next one arrived)
function recorder(page, file, size) {
  const dir = file + ".frames";
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  let t0 = 0, on = false;
  onEvent((m) => {
    if (m.method === "Page.screencastFrame" && m.sessionId === page.sessionId) {
      cdp("Page.screencastFrameAck", { sessionId: m.params.sessionId }, page.sessionId).catch(() => {});
      if (!on) return;
      const name = `${String(frames.length).padStart(6, "0")}.jpg`;
      fs.writeFileSync(path.join(dir, name), Buffer.from(m.params.data, "base64"));
      frames.push({ name, t: (Date.now() - t0) / 1000 });
    }
  });
  return {
    async start(at) { t0 = at; on = true; await cdp("Page.startScreencast", { format: "jpeg", quality: 85, everyNthFrame: 1 }, page.sessionId); },
    async halt() { if (!on) return; on = false; this.end = (Date.now() - t0) / 1000; await cdp("Page.stopScreencast", {}, page.sessionId).catch(() => {}); },
    async stop() {
      await this.halt();
      const end = this.end;
      if (!frames.length) return;
      // the first frame also covers 0..t1, so the video's clock matches the wall clock from start()
      const lines = frames.map((f, i) => `file '${f.name}'\nduration ${((i + 1 < frames.length ? frames[i + 1].t : end) - (i ? f.t : 0)).toFixed(4)}`);
      fs.writeFileSync(path.join(dir, "list.txt"), lines.join("\n") + `\nfile '${frames.at(-1).name}'\n`);
      log(`encoding ${path.basename(file)}: ${frames.length} frames, ${end.toFixed(1)} s`);
      execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt",
        "-vf", `scale=${size}:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", path.resolve(file)], { cwd: dir, windowsHide: true });
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------- in-page helpers
const KIT = `(() => { if (window.__v) return window.__v;
  const vis = (el) => !!el && el.offsetParent !== null && !el.disabled;
  const q = (s) => [...document.querySelectorAll(s)].filter(vis);
  const setVal = (el, v) => { const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
  const fields = () => q("textarea, input:not([type=hidden])").filter((e) => !e.readOnly);
  const btn = (re) => q("button, [role=button]").find((b) => re.test(b.innerText.replace(/\\s+/g, " ").trim()));
  const click = (re) => { const b = btn(re); if (b) { b.click(); return true; } return false; };
  return (window.__v = { q, setVal, fields, btn, click, text: () => document.body.innerText.replace(/\\s+/g, " ") }); })()`;
const run = (page, js) => page.eval(`(() => { const v = ${KIT}; ${js} })()`).catch((e) => `ERR ${e.message}`);
async function typeSlow(page, idx, text) { // types like a person (for the join shot)
  for (let i = 1; i <= text.length; i++) { await run(page, `const f = v.fields()[${idx}]; if (f) v.setVal(f, ${JSON.stringify(text.slice(0, i))}); return 1;`); await sleep(55); }
}
async function swipeUp(page) { // a real touch flick from the lower middle of the phone to the top
  const pts = [700, 620, 520, 400, 280, 160].map((y) => [{ x: 195, y }]);
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts[0] }, page.sessionId);
  for (const p of pts.slice(1)) { await sleep(16); await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: p }, page.sessionId); }
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, page.sessionId);
}
const THROW_READY = `const b = document.querySelector(".pk-tapthrow"); return !!b && !b.disabled && getComputedStyle(b).opacity !== "0";`;

async function main() {
  const browser = await launch(9347);
  const events = [];
  let T0 = Date.now();
  const mark = (name, extra = "") => { const t = (Date.now() - T0) / 1000; events.push({ t: +t.toFixed(2), name, extra }); log(`${t.toFixed(1).padStart(6)}s  ${name} ${extra}`); };
  let recTv, recPh;
  try {
    const tv = await openPage(`${BASE}/tv?judge=1&bots=1`, { width: 1920, height: 1080 });
    await sleep(7000);
    await tv.eval(`(() => { const st = document.createElement("style"); st.textContent = ".lb-bot { opacity: 0 !important; }"; document.head.appendChild(st); return 1; })()`);
    const code = (await tv.text()).match(/code=([A-Z]{4})/)?.[1];
    if (!code) throw new Error("no room code on the TV");
    const phone = await openPage(`${BASE}/play?code=${code}&as=1`, { width: 390, height: 844, scale: 2, mobile: true });
    const ptext = () => run(phone, `return v.text();`).then(String);
    const until = async (test, ms, every = 500, onTick) => { const t = Date.now(); for (;;) { const x = await ptext(); if (test(x)) return x; if (Date.now() - t > ms) return null; if (onTick) await onTick(x); await sleep(every); } };
    await until((x) => /CHARACTER/i.test(x), 60_000, 1500, async (x) => { if (/ERR_|dino|connection was/i.test(x)) { log("phone reload"); await cdp("Page.reload", {}, phone.sessionId); await sleep(4000); } });
    recTv = recorder(tv, path.join(OUT, `${NAME}-tv.mp4`), "1920:1080");
    recPh = recorder(phone, path.join(OUT, `${NAME}-phone.mp4`), "780:1688");
    T0 = Date.now();
    await recTv.start(T0);
    await recPh.start(T0);
    mark("rec");
    await sleep(2500);

    // ---- join + make a hero (S2, S3)
    mark("S2 join");
    await typeSlow(phone, 0, "Maya");
    await sleep(600);
    await run(phone, `return v.click(/^JOIN/i);`);
    if (!(await until((x) => /MAKE YOUR HERO/i.test(x), 30_000, 1500, () => run(phone, `return v.click(/^JOIN/i);`)))) throw new Error("never reached Make your hero");
    mark("S2 hero form");
    await sleep(1200);
    await typeSlow(phone, 0, "a night-shift baker who argues with her sourdough");
    await sleep(500);
    await typeSlow(phone, 1, "parallel parking");
    await sleep(1200);
    await run(phone, `return v.click(/MAKE MY HERO/i);`);
    for (let k = 0; k < 6 && !(await until((x) => !/MAKE YOUR HERO/i.test(x), 6_000)); k++) {
      log("hero submit retry", k);
      await run(phone, `const f = document.querySelector("form.pk-choices"); if (f) f.requestSubmit(); return 1;`);
    }
    mark("S3 hero made");
    mark("phone", (await ptext()).slice(0, 90));
    await sleep(2000);
    await run(tv, `return v.click(/TEST PLAYER/i);`);
    await sleep(2000);
    await run(tv, `return v.click(/TEST PLAYER/i);`);
    mark("S1 test players added");
    await sleep(25_000); // let Maya's portrait paint in on the TV
    for (let i = 0; i < 30 && (await run(tv, `return !!v.btn(/^START/i);`)) !== true; i++) await sleep(1000);
    mark("start");
    await run(tv, `return v.click(/^START/i);`);

    // ---- the game: react to whatever the phone shows
    let last = "", turnDone = false, finaleSent = false, voted = false, ready = false, shook = 0, notes = false, thrown = 0;
    const tEnd = Date.now() + 14 * 60_000;
    while (Date.now() < tEnd) {
      await sleep(600);
      const pt = await ptext();
      const tt = String(await run(tv, `return v.text();`));
      const head = pt.slice(0, 90);
      if (head !== last) { mark("phone", head); last = head; }
      if (!turnDone && /Your turn!/i.test(pt) && /What do you do/i.test(pt)) {
        mark("S5 your turn");
        for (let i = 0; i < 40 && (await run(phone, `return v.q("button.pk-plan").length;`)) < 2; i++) await sleep(1000);
        await sleep(3000);
        const took = await run(phone, `const b = v.q("button.pk-plan")[0]; if (!b) return "none"; b.click(); return b.innerText.replace(/\\s+/g, " ").slice(0, 80);`);
        mark("S5 took idea", took);
        await sleep(3500);
        if (took === "none") await typeSlow(phone, 0, "Lure the crowd away with a marching band");
        await run(phone, `return v.click(/^GO/i) || (v.q("button[type=submit]")[0]?.click(), true);`);
        mark("S5 plan sent");
        turnDone = true;
        continue;
      }
      if (thrown < 3 && (await run(phone, THROW_READY)) === true) {
        await sleep(1500);
        mark("S7 swipe");
        await swipeUp(phone);
        await sleep(1800);
        if ((await run(phone, THROW_READY)) === true) { await run(phone, `document.querySelector(".pk-tapthrow").click(); return 1;`); mark("S7 tap fallback"); }
        thrown++;
        continue;
      }
      if (!finaleSent && /final move/i.test(pt) && (await run(phone, `return v.fields().length;`)) > 0) {
        await sleep(2500);
        await typeSlow(phone, 0, "We all form a human chain and sing it home");
        await sleep(800);
        await run(phone, `return v.click(/LOCK IT IN/i) || (v.q("button[type=submit]")[0]?.click(), true);`);
        mark("finale plan sent");
        finaleSent = true;
        continue;
      }
      if (!ready && /Talk it out/i.test(pt)) {
        mark("S9 convince");
        await sleep(15_000);
        await run(phone, `return v.click(/ready to vote/i);`);
        ready = true;
        continue;
      }
      if (!voted && /Back a friend/i.test(pt)) {
        await sleep(2500);
        const r = await run(phone, `const c = v.q("button.pk-plan"); if (c.length) { c[0].click(); return c[0].innerText.replace(/\\s+/g, " ").slice(0, 60); } return "none";`);
        mark("vote", r);
        if (r !== "none") voted = true;
        continue;
      }
      if (shook < 10 && (await run(phone, `return !!document.querySelector(".pk-roll-btn");`)) === true) {
        await run(phone, `document.querySelector(".pk-roll-btn").click(); return 1;`);
        if (!shook) mark("S10 arm/shake");
        shook++;
        await sleep(400);
        continue;
      }
      if (/WHAT YOU DID/i.test(tt) && !events.some((e) => e.name === "S11 what you did")) mark("S11 what you did");
      if (/WHAT REALLY HAPPENED/i.test(tt) && !events.some((e) => e.name === "S12 what really happened")) mark("S12 what really happened");
      const s12 = events.find((e) => e.name === "S12 what really happened");
      if (s12 && !notes && Date.now() - T0 - s12.t * 1000 > 26_000) {
        mark("S13 DM's Notes");
        await tv.key("n", "KeyN");
        await sleep(2500);
        for (let k = 0; k < 6; k++) { await run(tv, `const el = [...document.querySelectorAll("*")].find(e => /DM.S NOTES/i.test(e.innerText||"") && e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 200); if (el) el.scrollBy({ top: 160, behavior: "smooth" }); return !!el;`); await sleep(1400); }
        notes = true;
        await sleep(1500);
        break;
      }
    }
    mark("end");
  } finally {
    await Promise.all([recTv?.halt(), recPh?.halt()].filter(Boolean)).catch(() => {});
    if (recTv) await recTv.stop().catch((e) => log("tv encode", e.message));
    if (recPh) await recPh.stop().catch((e) => log("phone encode", e.message));
    fs.writeFileSync(path.join(OUT, `${NAME}-events.json`), JSON.stringify(events, null, 1));
    await browser.close();
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
