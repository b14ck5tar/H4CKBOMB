"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { decodeKeepsake, safeLink, staticArt, type Keepsake } from "@/lib/keepsake";

const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : "#ff2e7e");

/** A keepsake storybook. Everything shown here came from the URL hash; nothing is fetched or stored. */
export default function TalePage() {
  const [k, setK] = useState<Keepsake | null | undefined>(undefined);
  useEffect(() => {
    const load = () => decodeKeepsake(location.hash).then(setK);
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  if (k === undefined) return <main className="min-h-full grid place-items-center font-ui text-parchment/60">Opening your tale…</main>;
  if (!k)
    return (
      <main className="min-h-full grid place-items-center px-6 text-center">
        <div className="flex flex-col gap-4 max-w-sm">
          <p className="font-display text-4xl uppercase text-[var(--crimson)]">This page is blank</p>
          <p className="text-parchment/80">The link looks cut short. Keepsake links carry the whole story, so copy all of it.</p>
          <Link className="btn btn-crimson" href="/">Play Group Project</Link>
        </div>
      </main>
    );

  const cover = staticArt(k.c);
  const link = safeLink(k.r?.l);
  return (
    <main className="min-h-full mx-auto max-w-xl px-4 pb-12">
      <header className="relative -mx-4 mb-6 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="w-full aspect-[4/3] object-cover" />
        ) : (
          <div className="w-full aspect-[4/3]" style={{ background: "radial-gradient(80% 80% at 30% 20%, rgba(255,46,126,0.45), transparent 60%), radial-gradient(70% 70% at 80% 90%, rgba(61,231,255,0.35), transparent 60%), #150e22" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,3,9,0.1) 20%, rgba(5,3,9,0.97) 100%)" }} />
        <div className="absolute bottom-0 inset-x-0 px-4 pb-4 flex flex-col gap-1">
          <p className="font-ui uppercase tracking-[0.3em] text-xs text-[var(--signal)]">
            {k.g ? `${k.g} · ` : ""}
            {k.d}
          </p>
          <h1 className="font-display uppercase text-5xl leading-[0.95]" style={{ textShadow: "0 0 24px rgba(255,46,126,0.6)" }}>
            {k.t}
          </h1>
          {k.x && <p className="font-heading text-xl uppercase text-[var(--gilt-bright)]">{k.x}</p>}
        </div>
      </header>

      {k.h.length > 0 && (
        <section className="flex flex-col gap-3 mb-8">
          <h2 className="font-heading text-2xl uppercase text-[var(--crimson)]">The crew</h2>
          {k.h.map((h, i) => (
            <div key={i} className="page p-4 flex gap-3 items-start">
              {staticArt(h.i) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={staticArt(h.i)} alt="" className="w-14 h-14 rounded-full object-cover object-top shrink-0" style={{ boxShadow: `0 0 0 3px ${safeColor(h.c)}` }} />
              ) : (
                <span className="w-14 h-14 rounded-full shrink-0 grid place-items-center font-heading text-xl font-bold text-[var(--void)]" style={{ background: safeColor(h.c), boxShadow: `0 0 18px ${safeColor(h.c)}` }}>
                  {initials(h.n)}
                </span>
              )}
              <div className="min-w-0 flex flex-col gap-1">
                <p className="font-heading text-xl font-bold leading-tight">{h.n}</p>
                <p className="font-ui text-xs text-ink-soft">played by {h.p}</p>
                {h.a && <p className="font-ui text-xs uppercase tracking-widest text-[var(--gilt-bright)]">{h.a}</p>}
                {h.m && <p className="leading-snug">{h.m}</p>}
              </div>
            </div>
          ))}
        </section>
      )}

      {k.q.length > 0 && (
        <section className="flex flex-col gap-3 mb-8">
          <h2 className="font-heading text-2xl uppercase text-[var(--signal)]">In their own words</h2>
          {k.q.map((q, i) => (
            <blockquote key={i} className="border-l-4 border-[var(--crimson)] pl-4">
              <p className="text-xl italic leading-snug">&ldquo;{q.l}&rdquo;</p>
              <p className="font-ui text-sm text-parchment/60 mt-1">{q.n}</p>
            </blockquote>
          ))}
        </section>
      )}

      {(k.s.length > 0 || k.e) && (
        <section className="flex flex-col gap-4 mb-8">
          <h2 className="font-heading text-2xl uppercase text-[var(--gilt-bright)]">The story</h2>
          {k.s.map((t, i) => (
            <p key={i} className="text-lg leading-relaxed">{t}</p>
          ))}
          {k.e && <p className="text-lg leading-relaxed text-parchment/90">{k.e}</p>}
          {k.m && <p className="font-heading text-2xl italic text-center text-[var(--crimson)] mt-2">{k.m}</p>}
        </section>
      )}

      {k.r?.h && (
        <section className="mb-8 bg-[#f7f5ef] text-[#151515] p-5 rotate-[-0.5deg] shadow-2xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          <p className="uppercase tracking-[0.3em] text-xs text-[#555] border-b border-[#bbb] pb-2">Inspired by real events</p>
          <p className="text-2xl font-bold leading-tight mt-3">{k.r.h}</p>
          <p className="text-sm text-[#555] mt-1">{[k.r.s, k.r.d].filter(Boolean).join(" · ")}</p>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-block mt-3 underline text-[#151515]">
              Read the real story
            </a>
          )}
        </section>
      )}

      <footer className="flex flex-col items-center gap-3 text-center">
        <Link href="/" className="btn btn-crimson">Play Group Project</Link>
        <p className="font-ui text-xs text-parchment/55 max-w-xs">This link holds your story. Nothing is stored on our servers.</p>
      </footer>
    </main>
  );
}
