"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import questImages from "@/data/quest_images.json";
import { recentHall, type HallEntry } from "@/lib/keepsake";

const SLIDE_MS = 8000;
const QUOTE_MS = 6000;
const ART: string[] = Object.values(questImages as Record<string, string[]>).flat();

function shuffled<T>(xs: T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Idle lobby loop for judges walking past: slow Ken Burns over the scene art, a hook, and a big QR. */
export function Attract({ code }: { code: string }) {
  const [art] = useState(() => shuffled(ART));
  const [i, setI] = useState(0);
  const [qr, setQr] = useState("");
  const [hall] = useState<HallEntry[]>(() => recentHall(3));
  const [qi, setQi] = useState(0);
  useEffect(() => {
    QRCode.toDataURL(`${location.origin}/play?code=${code}`, { margin: 1, width: 520, color: { dark: "#0A0612", light: "#F5F1FF" } }).then(setQr);
  }, [code]);
  useEffect(() => {
    const iv = setInterval(() => setI((n) => n + 1), SLIDE_MS);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (hall.length < 2) return;
    const iv = setInterval(() => setQi((n) => (n + 1) % hall.length), QUOTE_MS);
    return () => clearInterval(iv);
  }, [hall.length]);
  // Show the current slide and the previous one (fading out) so the crossfade is seamless.
  const shown = art.length ? [i - 1, i].filter((n) => n >= 0) : [];
  const q = hall[qi];
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[var(--midnight-2)]" role="dialog" aria-label="Attract screen">
      <style>{`
        @keyframes gp-kb-a { from { transform: scale(1.04) translate(0,0); } to { transform: scale(1.22) translate(-3%,-2%); } }
        @keyframes gp-kb-b { from { transform: scale(1.2) translate(-2%,2%); } to { transform: scale(1.04) translate(2%,-1%); } }
        @keyframes gp-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .gp-kb { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; animation: gp-fade-in 1.6s ease forwards, var(--kb) ${SLIDE_MS + 2000}ms linear forwards; }
        .gp-quote { animation: gp-fade-in 0.9s ease both; }
      `}</style>
      {shown.map((n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={n} src={art[n % art.length]} alt="" className="gp-kb" style={{ ["--kb" as string]: n % 2 ? "gp-kb-b" : "gp-kb-a" }} />
      ))}
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,3,9,0.92) 0%, rgba(5,3,9,0.55) 48%, rgba(5,3,9,0.25) 70%, rgba(5,3,9,0.75) 100%)" }} />
      <div className="absolute inset-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-10 px-[5vw]">
        <div className="flex flex-col gap-6 max-w-[48rem]">
          <p className="font-ui uppercase tracking-[0.35em] text-base text-[var(--signal)]">A party game · AI hosts · Friends decide</p>
          <h1 className="font-display uppercase leading-[0.9] text-[7rem] text-[var(--parchment)]" style={{ textShadow: "0 0 40px rgba(255,46,126,0.55)" }}>
            Group Project
          </h1>
          <p className="font-heading text-5xl leading-tight text-[var(--gilt-bright)]">Tonight&rsquo;s news, but you&rsquo;re the ones who fix it.</p>
          {q && (
            <div key={qi} className="gp-quote mt-6 border-l-4 border-[var(--crimson)] pl-5 flex flex-col gap-1">
              <p className="font-ui uppercase tracking-[0.25em] text-sm text-[var(--crimson)]">Earlier today</p>
              <p className="text-3xl italic leading-snug">&ldquo;{q.quote}&rdquo;</p>
              <p className="font-ui text-base text-parchment/70">
                {q.by ? `${q.by}, ` : ""}in <i>{q.title}</i>
              </p>
            </div>
          )}
        </div>
        <div className="page p-6 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-5xl uppercase text-[var(--crimson)]">Scan to play</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt="QR code to join" className="w-[22rem] h-[22rem] rounded" /> : <div className="w-[22rem] h-[22rem]" />}
          <p className="font-ui uppercase tracking-[0.2em] text-sm text-ink-soft">Room code</p>
          <p className="font-display text-7xl tracking-[0.2em]">{code}</p>
        </div>
      </div>
    </div>
  );
}
