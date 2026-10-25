"use client";
import { useEffect, useRef, useState } from "react";
import type { Stage } from "./TV";
import type { GameState } from "@/lib/types";
import { saveToHall } from "@/lib/keepsake";
import { FEATURES } from "@/lib/features";

const READING = ["quest", "narrating", "outcome", "mirror_reveal", "epilogue", "reveal"];
const KEYS: [string, string][] = [
  ["Space", "Continue (reading screens)"],
  ["S", "Skip the current timer"],
  ["N", "DM's Notes: what the AI is doing"],
  ["Q", "Quick Tale: ~5-minute mode + begin"],
  ["B", "Add a test player (lobby, with ?bots=1)"],
  ["H", "This help"],
];

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/**
 * Presenter layer on the TV: hotkeys and saving finished tales to the Hall. No standby screen (CD, Sun): the lobby
 * is always the lobby.
 * Nothing here is shown on screen except a faint "?" in the corner.
 */
export function Presenter({ host, s, onNotes, onCloseNotes }: { host: Stage; s: GameState; onNotes: () => void; onCloseNotes: () => void }) {
  // Latest callbacks without re-binding the key listener.
  const notesRef = useRef({ onNotes, onCloseNotes });
  notesRef.current = { onNotes, onCloseNotes };
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  // Hall of Tales: remember each finished tale once.
  const saved = useRef<unknown>(null);
  useEffect(() => {
    if (s.phase === "storybook" && s.storybook && saved.current !== s.storybook) {
      saved.current = s.storybook;
      saveToHall(s);
    }
  }, [s]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "n") {
        notesRef.current.onNotes();
        return;
      }
      if (k === "h" || k === "?") {
        setHelp((v) => !v);
        return;
      }
      if (k === "Escape") {
        setHelp(false);
        notesRef.current.onCloseNotes();
        return;
      }
      const st = host.getState();
      // The manual ending owns ←/→/Space (its slides drive the host); never skip a beat out from under it.
      if (FEATURES.manualEnding && ["epilogue", "reveal", "storybook"].includes(st.phase) && [" ", "PageDown", "PageUp", "ArrowRight", "ArrowLeft"].includes(k)) return;
      if (k === " " || k === "PageDown" || k === "ArrowRight") {
        e.preventDefault();
        if (READING.includes(st.phase)) host.skip();
      } else if (k === "s") {
        if (host.deadlineAt) host.skip();
      } else if ((k === "b" || k === "B") && st.phase === "lobby" && new URLSearchParams(window.location.search).has("bots")) {
        const name = host.addBot();
        setToast(name ? `Test player ${name} joined.` : "No room for another test player.");
      } else if (k === "q" && st.phase === "lobby") {
        // Quick Tale (it preselects the demo story), or the first story if none is picked yet.
        host.setMode("quick");
        const first = st.questOptions[0];
        if (!host.getState().questId && first) host.chooseQuest(first.id);
        if (host.canBegin()) host.begin();
        else setToast(host.getState().questId ? "Quick Tale picked. Waiting for a finished character to start." : "No stories loaded yet.");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [host]);

  return (
    <>
      <button
        className="fixed bottom-2 left-3 z-50 font-ui text-sm text-parchment/25 hover:text-parchment/80 w-7 h-7 rounded-full border border-parchment/15"
        onClick={(e) => {
          e.stopPropagation();
          setHelp((v) => !v);
        }}
        aria-label="Presenter hotkeys"
        title="Presenter hotkeys (H)"
      >
        ?
      </button>
      {help && (
        <div className="fixed bottom-12 right-3 z-50 page p-4 font-ui text-sm flex flex-col gap-1 min-w-[18rem]" role="dialog" aria-label="Hotkeys">
          <p className="uppercase tracking-[0.2em] text-xs text-[var(--signal)] mb-1">Presenter hotkeys</p>
          {KEYS.map(([key, what]) => (
            <p key={key} className="flex gap-3">
              <kbd className="min-w-[3.5rem] text-center rounded border border-[var(--line)] bg-black/40 px-1">{key}</kbd>
              <span>{what}</span>
            </p>
          ))}
        </div>
      )}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 page px-5 py-2 font-ui text-base fade-in">{toast}</div>
      )}
    </>
  );
}
