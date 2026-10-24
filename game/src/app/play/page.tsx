"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone } from "@/components/Phone";

function PlayInner() {
  const params = useSearchParams();
  const router = useRouter();
  const code = (params.get("code") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const [entry, setEntry] = useState("");

  if (code.length === 4) return <Phone code={code} />;

  return (
    <main className="min-h-full flex items-center justify-center p-4">
      <form
        className="page p-6 flex flex-col gap-4 w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (entry.length === 4) router.push(`/play?code=${entry}`);
        }}
      >
        <h1 className="font-display text-3xl text-center">Join a table</h1>
        <label className="font-heading" htmlFor="code">Room code</label>
        <input
          id="code"
          className="input text-center text-3xl tracking-[0.4em] uppercase font-heading"
          value={entry}
          onChange={(e) => setEntry(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
          placeholder="ABCD"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
        />
        <button className="btn btn-crimson text-lg" type="submit" disabled={entry.length !== 4}>Join</button>
      </form>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense>
      <PlayInner />
    </Suspense>
  );
}
