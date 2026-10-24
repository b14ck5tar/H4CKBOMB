"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WatchView } from "@/components/WatchView";

function WatchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const code = (params.get("code") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const [entry, setEntry] = useState("");

  if (code.length === 4) return <WatchView code={code} />;

  return (
    <main className="min-h-full flex items-center justify-center p-4">
      <form
        className="page p-6 flex flex-col gap-4 w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (entry.length === 4) router.push(`/watch?code=${entry}`);
        }}
      >
        <h1 className="font-display text-3xl text-center">Watch a table</h1>
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
        <button className="btn btn-crimson text-lg" type="submit" disabled={entry.length !== 4}>Open the big screen</button>
      </form>
    </main>
  );
}

export default function WatchPage() {
  return (
    <Suspense>
      <WatchInner />
    </Suspense>
  );
}
