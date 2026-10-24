"use client";
import { useEffect, useState } from "react";
import { openRoom, type Msg } from "./transport";
import type { GameState } from "./types";

/**
 * Read-only view of a room (the judges' DM's Notes link): receives the table's state like a phone does,
 * but never joins as a player. Its "hello" only asks the table to re-send state.
 */
export function useWatch(code: string | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [heardAt, setHeardAt] = useState(0);

  useEffect(() => {
    if (!code) return;
    const t = openRoom(code);
    const pid = "watch" + Math.random().toString(36).slice(2, 8);
    let lastHeard = 0;
    const off = t.on((m: Msg) => {
      if (m.type !== "state") return;
      lastHeard = Date.now();
      setHeardAt(lastHeard);
      setState(m.state as GameState);
    });
    t.send({ type: "hello", pid });
    const iv = setInterval(() => {
      if (Date.now() - lastHeard > (lastHeard ? 5000 : 1500)) t.send({ type: "hello", pid });
    }, 1500);
    const onVisible = () => document.visibilityState === "visible" && t.send({ type: "hello", pid });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      off();
      t.close();
    };
  }, [code]);

  return { state, heardAt };
}
