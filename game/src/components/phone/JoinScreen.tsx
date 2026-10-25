"use client";
/**
 * Join: the logo, the room code as four neon tiles, your name, one huge JOIN.
 * With `code` (from the URL) the tiles are locked in; without it the tiles are the code input.
 * Remembers the last name in localStorage ("ouar-name"), like the old form.
 */
import { useEffect, useRef, useState } from "react";
import { GameButton, Kicker, PrivacyLine, vibrate } from "./kit";

export function JoinScreen({ code = "", onJoin }: { code?: string; onJoin: (name: string, code: string) => void }) {
  const [name, setName] = useState("");
  const [entry, setEntry] = useState(code);
  const [focus, setFocus] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const locked = code.length === 4;
  useEffect(() => {
    try {
      setName(localStorage.getItem("ouar-name") ?? "");
    } catch {}
  }, []);
  const room = (locked ? code : entry).toUpperCase();
  const ok = name.trim().length > 0 && room.length === 4;
  return (
    <form
      className="pk-choices pk-center"
      style={{ flex: 1, gap: 18 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        try {
          localStorage.setItem("ouar-name", name.trim());
        } catch {}
        vibrate([20, 30, 20]);
        onJoin(name.trim(), room);
      }}
    >
      <div className="pk-logo" aria-label="Group Project" role="img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-group-project.jpg" alt="" className="pk-logo-glow" />
        <span className="pk-logo-jelly">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-group-project.jpg" alt="" />
        </span>
      </div>

      <Kicker>{locked ? "You found the table" : "Join a table"}</Kicker>

      <div className="pk-field" style={{ gap: 10 }}>
        <span className="pk-code-cap">Room code</span>
        <div className="pk-code" aria-label={`Room code ${room.split("").join(" ")}`} onClick={() => !locked && codeRef.current?.focus()}>
          {[0, 1, 2, 3].map((i) => {
            const ch = room[i] ?? "";
            const cursor = !locked && focus && i === Math.min(3, room.length);
            return (
              <span key={i} className={`pk-code-ch ${ch ? "" : "is-empty"} ${cursor ? "is-cursor" : ""}`} style={{ ["--k" as string]: i } as React.CSSProperties}>
                {ch || "·"}
              </span>
            );
          })}
          {!locked && (
            <input
              ref={codeRef}
              aria-label="Room code"
              value={entry}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
                if (v.length > entry.length) vibrate(8);
                setEntry(v);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          )}
        </div>
      </div>

      <label className="pk-field" style={{ width: "100%" }}>
        <span className="pk-label" style={{ justifyContent: "center" }}>
          Your character’s name
        </span>
        <input
          className="pk-input pk-input-big"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="Doug the Panda"
          autoComplete="off"
          enterKeyHint="go"
        />
      </label>

      <div style={{ width: "100%", marginTop: 4 }}>
        <GameButton type="submit" tone="pink" xl disabled={!ok}>
          Join
        </GameButton>
      </div>

      <PrivacyLine />
    </form>
  );
}
