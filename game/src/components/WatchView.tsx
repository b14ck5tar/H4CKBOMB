"use client";
import { useState } from "react";
import { useWatch } from "@/lib/useWatch";
import { sfx } from "@/lib/sfx";
import { TV } from "./TV";
import { Hourglass } from "./Effects";

/**
 * The big screen for friends who aren't in the room: the same TV view, rendered from the table's broadcasts.
 * Read-only. Browsers block sound until a tap, so the first screen is "Tap to join the table".
 */
export function WatchView({ code, embedded = false }: { code: string; embedded?: boolean }) {
  const { src, state } = useWatch(code);
  const [joined, setJoined] = useState(false);

  if (!joined || !src || !state) {
    return (
      <main className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <p className="font-display text-5xl uppercase text-[var(--gilt-bright)]">Group Project</p>
        <p className="font-ui tracking-[0.3em] text-2xl">{code}</p>
        {!state && (
          <div className="flex flex-col items-center gap-2 text-parchment/80">
            <Hourglass size={48} />
            <p className="font-heading text-xl">Finding table {code}…</p>
            <p className="font-ui text-sm">Make sure the game is open on the host’s laptop or TV.</p>
          </div>
        )}
        {!joined && (
          <button
            className="btn btn-crimson text-2xl"
            onClick={() => {
              sfx.unlock();
              sfx.pageTurn();
              setJoined(true);
            }}
          >
            Tap to join the table
          </button>
        )}
        <p className="font-ui text-sm text-parchment/60 max-w-md">
          This is the big screen, with sound. Play on your phone at /play?code={code}.
        </p>
      </main>
    );
  }
  return <TV host={src} embedded={embedded} />;
}
