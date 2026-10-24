"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startRecording, type Recorder } from "@/lib/wav";

type Phase = "idle" | "recording" | "transcribing" | "error";
const MAX_SECONDS = 15;

export function MicButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [note, setNote] = useState("");

  const rec = useRef<Recorder | null>(null);
  const holding = useRef(false); // pointer is currently down
  const starting = useRef(false);
  const startedAt = useRef(0);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const finish = useCallback(async () => {
    const r = rec.current;
    rec.current = null;
    holding.current = false;
    if (!r) return;
    const elapsed = Date.now() - startedAt.current;
    if (elapsed < 400) {
      r.cancel();
      setPhase("idle");
      setNote("Hold the button while you speak");
      return;
    }
    setPhase("transcribing");
    try {
      const blob = await r.stop();
      const res = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: blob });
      const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const text = (j.text ?? "").trim();
      setPhase("idle");
      if (text) {
        setNote("");
        onTranscriptRef.current(text);
      } else {
        setNote("The scribe dozed off. Type it instead?");
      }
    } catch {
      setPhase("error");
    }
  }, []);

  const begin = useCallback(
    async (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || starting.current || rec.current || phase === "transcribing") return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      holding.current = true;
      starting.current = true;
      setNote("");
      setPhase("recording");
      setSeconds(0);
      try {
        const r = await startRecording(); // AudioContext is created synchronously inside this gesture
        startedAt.current = Date.now();
        rec.current = r;
        if (!holding.current) {
          await finish(); // released while the permission prompt / mic was starting
        }
      } catch {
        holding.current = false;
        setPhase("error");
      } finally {
        starting.current = false;
      }
    },
    [disabled, phase, finish],
  );

  const end = useCallback(() => {
    holding.current = false;
    if (rec.current) void finish();
  }, [finish]);

  // Meter + seconds counter + 15 s cap while recording.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      const r = rec.current;
      if (!r) return;
      setLevel(r.level());
      const s = (Date.now() - startedAt.current) / 1000;
      setSeconds(Math.min(MAX_SECONDS, Math.floor(s)));
      if (s >= MAX_SECONDS) void finish();
    }, 60);
    return () => clearInterval(id);
  }, [phase, finish]);

  useEffect(() => () => rec.current?.cancel(), []);

  const recording = phase === "recording";
  const busy = phase === "transcribing";
  const label =
    phase === "recording"
      ? `Listening… ${seconds}s`
      : phase === "transcribing"
        ? "The scribe is listening…"
        : phase === "error"
          ? "Mic unavailable — type instead"
          : "🎙 Hold to speak";

  return (
    <div style={{ width: "100%" }}>
      <style>{`@keyframes mic-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}`}</style>
      <button
        type="button"
        disabled={disabled || busy}
        onPointerDown={begin}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Hold to speak"
        style={{
          width: "100%",
          minHeight: 64,
          padding: "14px 16px",
          borderRadius: 16,
          border: `2px solid ${recording ? "#A3282E" : "#C8952E"}`,
          background: recording ? "#A3282E" : phase === "error" ? "#E8D8B4" : "#F4E9D0",
          color: recording ? "#F4E9D0" : "#2A1E16",
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.2,
          fontFamily: "inherit",
          cursor: disabled || busy ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
          boxShadow: recording
            ? `0 0 0 ${4 + Math.round(level * 18)}px rgba(200,149,46,${0.25 + level * 0.5})`
            : "0 2px 0 rgba(42,30,22,0.25)",
          transition: "box-shadow 80ms linear, background 120ms",
          animation: recording ? "mic-pulse 1s ease-in-out infinite" : undefined,
        }}
      >
        {label}
      </button>
      {note && phase === "idle" && (
        <p style={{ margin: "6px 2px 0", fontSize: 13, color: "#2A1E16", opacity: 0.75 }}>{note}</p>
      )}
    </div>
  );
}
