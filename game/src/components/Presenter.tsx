"use client";
import { useEffect, useRef, useState } from "react";
import type { Stage } from "./TV";
import type { GameState } from "@/lib/types";
import { saveToHall } from "@/lib/keepsake";
import { Attract } from "./Attract";

const IDLE_MS = 20_000;
const READING = ["quest", "narrating", "outcome", "mirror_reveal", "epilogue", "reveal"];
const KEYS: [string, string][] = [
  ["Space", "Continue (reading screens)"],
  ["S", "Skip the current timer"],
  ["N", "DM's Notes: what the AI is doing"],
  ["Q", "Quick start: first story + begin"],
  ["A", "Attract screen on/off"],
  ["H", "This help"],
];

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/**
 * Presenter layer on the TV: hotkeys, the idle attract loop, and saving finished tales to the Hall.
 * Nothing here is shown on screen except a faint "?" in the corner.
 */
export function Presenter({ host, s, onNotes, onCloseNotes }: { host: Stage; s: GameState; onNotes: () => void; onCloseNotes: () => void }) {
  // Latest callbacks without re-binding the key listener.
  const notesRef = useRef({ onNotes, onCloseNotes });
  notesRef.current = { onNotes, onCloseNotes };
  const [attract, setAttract] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const [idleTick, setIdleTick] = useState(0); // bumps on activity, restarting the idle timer
  const empty = s.phase === "lobby" && s.players.length === 0;
  const count = useRef(s.players.length);

  // Idle: an empty lobby for 20 s starts the attract loop.
  useEffect(() => {
    if (!empty || attract) return;
    const t = setTimeout(() => setAttract(true), IDLE_MS);
    return () => clearTimeout(t);
  }, [empty, attract, idleTick]);

  // Any join, or leaving the lobby, dismisses it.
  useEffect(() => {
    if (s.players.length > count.current || s.phase !== "lobby") setAttract(false);
    count.current = s.players.length;
  }, [s.players.length, s.phase]);

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
      setIdleTick((n) => n + 1);
      if (k === "a") {
        setAttract((v) => !v);
        return;
      }
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
        setAttract(false);
        notesRef.current.onCloseNotes();
        return;
      }
      setAttract(false);
      const st = host.getState();
      if (k === " " || k === "PageDown" || k === "ArrowRight") {
        e.preventDefault();
        if (READING.includes(st.phase)) host.skip();
      } else if (k === "s") {
        if (host.deadlineAt) host.skip();
      } else if (k === "q" && st.phase === "lobby") {
        const first = st.questOptions[0];
        if (first && st.questId !== first.id) host.chooseQuest(first.id);
        if (host.canBegin()) host.begin();
        else setToast(first ? "Story picked. Waiting for a finished character to start." : "No stories loaded yet.");
      }
    };
    const onPointer = () => {
      setIdleTick((n) => n + 1);
      setAttract(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [host]);

  return (
    <>
      {attract && <Attract code={s.code} />}
      <button
        className="fixed bottom-2 right-3 z-50 font-ui text-sm text-parchment/25 hover:text-parchment/80 w-7 h-7 rounded-full border border-parchment/15"
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
