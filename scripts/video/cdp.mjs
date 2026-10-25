// A tiny CDP client for headless Chrome (no puppeteer): launch, open pages with their own viewport, eval, screencast.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...a);
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));

let ws, seq = 0;
const pending = new Map();
const listeners = [];
export function cdp(method, params = {}, sessionId, timeoutMs = 60_000) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => {
    pending.set(id, { res, rej, method });
    setTimeout(() => pending.has(id) && (pending.delete(id), rej(new Error(`CDP timeout: ${method}`))), timeoutMs);
  });
}
export const onEvent = (fn) => listeners.push(fn);

export async function launch(port = 9347) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gp-video-"));
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--hide-scrollbars", "--window-size=1920,1080", "about:blank"], { stdio: "ignore" });
  let ver;
  for (let i = 0; i < 60 && !ver; i++) { await sleep(250); ver = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => null); }
  if (!ver) throw new Error("Chrome did not open its debugging port");
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result); }
    else if (m.method) for (const fn of listeners) fn(m);
  };
  return { close: async () => { proc.kill(); await sleep(800); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

export async function openPage(url, { width, height, scale = 1, mobile = false }) {
  const { targetId } = await cdp("Target.createTarget", { url: "about:blank", newWindow: true });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile }, sessionId);
  if (mobile) await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await cdp("Page.navigate", { url }, sessionId, 120_000);
  return {
    sessionId,
    async eval(expr) {
      const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId);
      if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
      return r.result.value;
    },
    key: (key, code) => cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, text: key.length === 1 ? key : undefined }, sessionId)
      .then(() => cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code }, sessionId)),
    text() { return this.eval("document.body.innerText"); },
    buttons() { return this.eval(`[...document.querySelectorAll("button,a,[role=button]")].filter(e=>e.offsetParent!==null).map(e=>(e.className+"|"+e.innerText).replace(/\s+/g," ").slice(0,80))`); },
  };
}
