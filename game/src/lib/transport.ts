"use client";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Msg = { type: string; [k: string]: any };

export interface Transport {
  kind: "supabase" | "local";
  send(msg: Msg): void;
  on(fn: (msg: Msg) => void): () => void;
  close(): void;
}

/**
 * One broadcast channel per room. Uses Supabase Realtime when keys are configured,
 * otherwise falls back to BroadcastChannel (same-browser tabs only — handy for local testing).
 */
export function openRoom(code: string): Transport {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const listeners = new Set<(m: Msg) => void>();
  const emit = (m: Msg) => listeners.forEach((l) => l(m));

  if (url && anon) {
    const sb = createClient(url, anon, { realtime: { params: { eventsPerSecond: 30 } } });
    let ready = false;
    const queue: Msg[] = [];
    const ch: RealtimeChannel = sb.channel(`ouar-${code}`, { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: "m" }, ({ payload }) => emit(payload as Msg));
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ready = true;
        queue.splice(0).forEach((m) => ch.send({ type: "broadcast", event: "m", payload: m }));
      }
    });
    return {
      kind: "supabase",
      send(m) {
        if (ready) ch.send({ type: "broadcast", event: "m", payload: m });
        else queue.push(m);
      },
      on(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      close() {
        sb.removeChannel(ch);
      },
    };
  }

  const bc = new BroadcastChannel(`ouar-${code}`);
  bc.onmessage = (e) => emit(e.data as Msg);
  return {
    kind: "local",
    send: (m) => bc.postMessage(m),
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close: () => bc.close(),
  };
}

export function newCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => letters[n % letters.length]).join("");
}
