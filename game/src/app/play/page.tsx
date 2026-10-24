"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone } from "@/components/Phone";
import { GameHost } from "@/lib/host";
import { newCode } from "@/lib/transport";

const hostKey = (code: string) => `ouar-hosting-${code}`;

function isHosting(code: string) {
  try {
    return sessionStorage.getItem(hostKey(code)) === "1";
  } catch {
    return false;
  }
}

/** No TV: this device runs the game for the room and is also a player. */
function HostedPhone({ code }: { code: string }) {
  const [host, setHost] = useState<GameHost | null>(null);
  useEffect(() => {
    const h = new GameHost(code, { screen: "phones" });
    setHost(h);
    return () => h.close();
  }, [code]);
  if (!host) return null;
  return <Phone code={code} host={host} />;
}

function PlayInner() {
  const params = useSearchParams();
  const router = useRouter();
  const code = (params.get("code") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const [entry, setEntry] = useState("");
  const [hosting, setHosting] = useState<boolean | null>(null);
  useEffect(() => setHosting(code.length === 4 && isHosting(code)), [code]);

  if (code.length === 4) {
    if (hosting === null) return null;
    return hosting ? <HostedPhone code={code} /> : <Phone code={code} />;
  }

  const startGame = () => {
    const c = newCode();
    try {
      sessionStorage.setItem(hostKey(c), "1");
    } catch {}
    // The URL stays a plain join link, so sharing it from the address bar never makes someone else a host.
    router.push(`/play?code=${c}`);
  };

  return (
    <main className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <form
          className="page p-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (entry.length === 4) router.push(`/play?code=${entry}`);
          }}
        >
          <h1 className="font-display text-3xl text-center">Join a game</h1>
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
        <div className="page p-6 flex flex-col gap-3 text-center">
          <p className="font-heading uppercase">No TV? Not in the same place?</p>
          <p className="text-sm text-ink-soft">Start a game here and invite friends. Everyone plays on their own device, from anywhere.</p>
          <button className="btn btn-gilt text-lg" onClick={startGame}>Start a new game</button>
        </div>
      </div>
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
