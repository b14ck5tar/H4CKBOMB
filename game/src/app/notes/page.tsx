"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DMNotesBody } from "@/components/DMNotes";
import { useWatch } from "@/lib/useWatch";

/** Judges' view: /notes?code=ABCD follows a table's DM's Notes live, without joining as a player. */
function Watching({ code }: { code: string }) {
  const { state } = useWatch(code);
  return (
    <main className="min-h-full px-4 py-5 max-w-2xl mx-auto flex flex-col gap-4">
      <header className="flex items-end gap-3">
        <div className="flex-1">
          <h1 className="font-display text-4xl uppercase text-[var(--gilt-bright)] leading-none">DM&apos;s Notes</h1>
          <p className="font-ui text-sm text-parchment/70">What the AI Dungeon Master is doing, and why. Live.</p>
        </div>
        <span className="font-heading tracking-[0.3em] text-xl text-parchment">{code}</span>
      </header>
      {state ? (
        <>
          {state.quest && <p className="font-heading text-2xl uppercase leading-tight">{state.quest.title}</p>}
          <DMNotesBody s={state} />
        </>
      ) : (
        <p className="page p-5 text-ink-soft animate-pulse">Listening for table {code}…</p>
      )}
    </main>
  );
}

function NotesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const code = (params.get("code") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const [entry, setEntry] = useState("");
  if (code.length === 4) return <Watching code={code} />;
  return (
    <main className="min-h-full flex items-center justify-center p-4">
      <form
        className="page p-6 flex flex-col gap-4 w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (entry.length === 4) router.push(`/notes?code=${entry}`);
        }}
      >
        <h1 className="font-display text-3xl text-center">DM&apos;s Notes</h1>
        <p className="text-ink-soft text-center">Follow a table&apos;s AI Dungeon Master without joining the game.</p>
        <label className="font-heading" htmlFor="code">Room code</label>
        <input
          id="code"
          className="input text-center text-3xl tracking-[0.4em] uppercase font-heading"
          value={entry}
          onChange={(e) => setEntry(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
          placeholder="ABCD"
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button className="btn btn-crimson text-lg" type="submit" disabled={entry.length !== 4}>Follow along</button>
      </form>
    </main>
  );
}

export default function NotesPage() {
  return (
    <Suspense>
      <NotesInner />
    </Suspense>
  );
}
