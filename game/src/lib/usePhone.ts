"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { openRoom, type Msg, type Transport } from "./transport";
import type { GameState } from "./types";

function getPid() {
  // Testing aid: /play?code=ABCD&as=2 lets several tabs in one browser be different players.
  const as = new URLSearchParams(location.search).get("as");
  if (as) return `ptest${as.replace(/\W/g, "").slice(0, 8)}`;
  try {
    let id = localStorage.getItem("ouar-pid");
    if (!id) {
      id = "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      localStorage.setItem("ouar-pid", id);
    }
    return id;
  } catch {
    return "p" + Math.random().toString(36).slice(2, 12);
  }
}

/** Phone side of a room: receives the TV's state, sends intents. */
export function usePhone(code: string | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [portrait, setPortrait] = useState<string>("");
  const [deadlineAt, setDeadlineAt] = useState(0);
  const [pid, setPid] = useState("");
  const tRef = useRef<Transport | null>(null);

  useEffect(() => setPid(getPid()), []);

  useEffect(() => {
    if (!code || !pid) return;
    const t = openRoom(code);
    tRef.current = t;
    let lastHeard = 0;
    let lastPing = 0;
    // Autopilot presence: a quiet "still here" every few seconds (the table marks a silent phone away after ~25 s).
    // Also sent from the message handler, because background tabs throttle timers but still get events.
    const ping = () => {
      if (Date.now() - lastPing < 3000) return; // the table pauses if every phone is quiet for 8 s
      lastPing = Date.now();
      t.send({ type: "ping", pid });
    };
    const off = t.on((m: Msg) => {
      if (m.type === "state") {
        lastHeard = Date.now(); // only the table's state counts; other phones chatting doesn't mean we're in sync
        ping();
        setState(m.state as GameState);
        setDeadlineAt(m.state.deadline ? Date.now() + m.state.deadline : 0);
      } else if (m.type === "portrait" && m.pid === pid) {
        setPortrait(m.url);
      }
    });
    // Say hello until the table answers, and again whenever it's been quiet for a while,
    // so a dropped message (flaky Wi-Fi, phone asleep) heals itself within seconds.
    t.send({ type: "hello", pid });
    const iv = setInterval(() => {
      if (Date.now() - lastHeard > (lastHeard ? 5000 : 1500)) t.send({ type: "hello", pid });
      else ping();
    }, 1500);
    const onVisible = () => document.visibilityState === "visible" && t.send({ type: "hello", pid });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      off();
      t.close();
      tRef.current = null;
    };
  }, [code, pid]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const send = useCallback((type: string, data: Record<string, any> = {}) => {
    tRef.current?.send({ type, pid, ...data });
  }, [pid]);

  const me = state?.players.find((p) => p.id === pid);
  return { state, me, pid, portrait, deadlineAt, send };
}

/** Re-renders every 250ms while a deadline is active; returns ms remaining. */
export function useCountdown(deadlineAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineAt) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [deadlineAt]);
  return deadlineAt ? Math.max(0, deadlineAt - now) : 0;
}
