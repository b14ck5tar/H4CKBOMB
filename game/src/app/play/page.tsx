"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone } from "@/components/Phone";
import { WatchView } from "@/components/WatchView";

/** /play?code=ABCD&split=1: on a laptop, the big screen on the left and your controls on the right. */
function Split({ code }: { code: string }) {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    window.addEventListener("resize", on);
    return () => {
      mq.removeEventListener("change", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  if (wide === null) return null;
  if (!wide) return <Phone code={code} />;
  return (
    <div className="h-full grid grid-cols-[minmax(0,1fr)_400px]">
      <div className="h-full min-h-0 overflow-hidden border-r border-[var(--gilt)]/30">
        <WatchView code={code} embedded />
      </div>
      <div className="h-full min-h-0 overflow-auto">
        <Phone code={code} />
      </div>
    </div>
  );
}

function PlayInner() {
  const params = useSearchParams();
  const router = useRouter();
  const code = (params.get("code") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const [entry, setEntry] = useState("");

  if (code.length === 4) return params.get("split") === "1" ? <Split code={code} /> : <Phone code={code} />;

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
