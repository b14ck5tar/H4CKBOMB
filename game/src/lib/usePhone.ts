"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { openRoom, type Msg, type Transport } from "./transport";
import type { GameState } from "./types";

function getPid() {
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
    let gotState = false;
    const off = t.on((m: Msg) => {
      if (m.type === "state") {
        gotState = true;
        setState(m.state as GameState);
        setDeadlineAt(m.state.deadline ? Date.now() + m.state.deadline : 0);
      } else if (m.type === "portrait" && m.pid === pid) {
        setPortrait(m.url);
      }
    });
    // Keep saying hello until the table answers (it may not be subscribed yet).
    t.send({ type: "hello", pid });
    const iv = setInterval(() => {
      if (!gotState) t.send({ type: "hello", pid });
    }, 1500);
    return () => {
      clearInterval(iv);
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
