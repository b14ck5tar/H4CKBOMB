"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { playSfx } from "@/lib/sound";
import { Face, Words, possessive, type Css } from "./shared";
import { Particles } from "./motion";

export interface MontagePanel {
  /** The painted scene for this big choice. */
  image: string;
  /** One line: what that choice did ("Rosa asked the ranger, and the ranger had the key"). */
  line: string;
  /** Who did it (hero or player names). The first one is the main credit. */
  who: { name: string; color: string; portrait?: string }[];
}

export interface RevealData {
  headline: string;
  source: string;
  date?: string;
  /** One or two sentences of the real story. */
  summary?: string;
  /** "What's happening now" in the real world. */
  now?: string;
  /** Link for the small "read the real article" QR. */
  articleUrl?: string;
  /** "Our stories" mode: whose true story it was. The title then reads "Based on <author>'s true story". */
  author?: string;
  /** The table's fantasy title ("The Corn Hatchling"). */
  yourTitle: string;
  /** The table's version in one or two sentences. */
  yourVersion: string;
  /** "Solved by Ava's parallel parking (Rosa) and ..." */
  solvedBy?: string;
  /** Ending stamp ("YOU DID IT") and its color. */
  ending?: string;
  endingColor?: string;
  /** The grand ending (state.revealData): each hero's key move in their own words... */
  moves?: { name: string; move: string }[];
  /** ...how the real story really ended... */
  realEnding?: string;
  /** ...and one line linking ours to the real one, shown big at the end. */
  bridge?: string;
}

export interface EndingMontageProps {
  panels: MontagePanel[];
  reveal: RevealData;
  /** Keepsake QR: pass <KeepsakeQR host s /> or let us draw one from keepsakeUrl. */
  keepsake?: React.ReactNode;
  keepsakeUrl?: string;
  /** ms per panel (default 5200). */
  panelMs?: number;
  /** Jump straight to a beat: 0..panels.length-1 = a panel, panels.length = the reveal. */
  start?: number;
  /** Called when the reveal is up (e.g. to show the keepsake on phones). */
  onReveal?: () => void;
}

/** "Because of you": 3-4 painted panels, one per big choice, then the "Based on a true story" reveal and the keepsake. */
export function EndingMontage({ panels, reveal, keepsake, keepsakeUrl, panelMs = 5200, start = 0, onReveal }: EndingMontageProps) {
  const [i, setI] = useState(start);
  const atReveal = i >= panels.length;
  useEffect(() => setI(start), [start]);
  useEffect(() => {
    if (atReveal) {
      playSfx("reveal");
      onReveal?.();
      return;
    }
    playSfx(i === 0 ? "turnStart" : "pick", { volume: 0.7 });
    const t = setTimeout(() => setI((n) => n + 1), panelMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, atReveal, panelMs]);
  const last = panels[panels.length - 1];
  return (
    <div className="tvx tvx-layer tvx-end is-live" role="region" aria-label={atReveal ? (reveal.author ? `Based on ${possessive(reveal.author)} true story` : "Based on a true story") : "Because of you"}>
      {/* painted panels, crossfading; the last one stays as the reveal's backdrop */}
      <div className="tvx-end-art" aria-hidden>
        {panels.map((p, n) =>
          n === i || n === i - 1 || (atReveal && n === panels.length - 1) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={p.image} alt="" className={`tvx-end-img ${atReveal ? "is-dim" : ""}`} style={{ ["--kb" as string]: ["tvx-pan-a", "tvx-pan-b", "tvx-pan-c"][n % 3] }} />
          ) : null,
        )}
        {!last && <div className="tvx-end-fallback" />}
        <div className="tvx-end-scrim" />
        <Particles seed={3} count={34} />
        <div className="tvx-grain" />
      </div>
      <div className="tvx-stage">
        {!atReveal ? <Panel key={i} p={panels[i]} n={i} of={panels.length} ms={panelMs} /> : <Reveal r={reveal} keepsake={keepsake} keepsakeUrl={keepsakeUrl} crew={crewOf(panels)} />}
      </div>
    </div>
  );
}

function Panel({ p, n, of, ms }: { p: MontagePanel; n: number; of: number; ms: number }) {
  const lead = p.who[0];
  const style: Css = { "--c": lead?.color ?? "#ff2e7e", "--ms": `${ms}ms` };
  return (
    <section className="tvx-panel" style={style}>
      <span className="tvx-panel-flash" aria-hidden />
      <p className="tvx-panel-kicker">
        <span>Because of you</span>
        <span className="tvx-panel-pips" aria-label={`${n + 1} of ${of}`}>
          {Array.from({ length: of }, (_, k) => (
            <i key={k} className={k <= n ? "on" : ""} />
          ))}
        </span>
      </p>
      <div className="tvx-panel-cap">
        <p className="tvx-panel-line">
          <Words text={p.line} start={0.3} step={0.05} /> {/* panels are 3.6 s: a 30-word line is in by ~1.8 s */}
        </p>
        <p className="tvx-panel-who">
          {p.who.map((w, k) => (
            <span key={k} className="tvx-panel-credit" style={{ ["--c" as string]: w.color, animationDelay: `${1.1 + k * 0.25}s` }}>
              <Face src={w.portrait} name={w.name} color={w.color} size={2.8} />
              {k === 0 ? `${possessive(w.name)} move` : `with ${w.name}`}
            </span>
          ))}
        </p>
      </div>
      <span className="tvx-panel-timer" aria-hidden />
    </section>
  );
}

function niceDate(d?: string) {
  if (!d) return "";
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d); // date-only strings parse as UTC
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : d;
}

function useQr(url?: string, dark = "#0A0612", light = "#FFFFFF") {
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "L", color: { dark, light } }).then(setQr).catch(() => {});
  }, [url, dark, light]);
  return qr;
}

/** Everyone who appears in the montage, once each (the heroes of "what you did"). */
function crewOf(panels: MontagePanel[]) {
  const seen = new Map<string, MontagePanel["who"][number]>();
  panels.forEach((p) => p.who.forEach((w) => !seen.has(w.name) && seen.set(w.name, w)));
  return [...seen.values()].slice(0, 6);
}

type Beat = "did" | "real" | "bridge";

/** How long "WHAT YOU DID" holds before "WHAT REALLY HAPPENED" (the reveal reads 10-20 s; the second beat stays). */
const DID_MS = 5000;

/**
 * The ending in two clear beats (CD: "here's what y'all did, here's what actually happened"): first YOUR story,
 * full screen, with its heroes; then the REAL story (the clipping, its real ending) and the take-home QR.
 */
function Reveal({ r, keepsake, keepsakeUrl, crew }: { r: RevealData; keepsake?: React.ReactNode; keepsakeUrl?: string; crew: MontagePanel["who"] }) {
  const article = useQr(r.articleUrl, "#16110a", "#f3ecdc");
  const take = useQr(keepsake ? undefined : keepsakeUrl);
  const grand = !!r.moves?.length;
  const order: Beat[] = grand && r.bridge ? ["did", "real", "bridge"] : ["did", "real"];
  const [k, setK] = useState(0);
  const beat = order[Math.min(k, order.length - 1)];
  // Paced to breathe: your moves get time per hero, the real story 7 s, the bridge stays. A click moves on.
  const holdMs = beat === "did" ? (grand ? Math.min(9000, 3500 + 1300 * r.moves!.length) : DID_MS) : 7000;
  useEffect(() => {
    if (k >= order.length - 1) return;
    const t = setTimeout(() => setK((n) => n + 1), holdMs);
    return () => clearTimeout(t);
  }, [k, holdMs, order.length]);
  const crewByName = new Map(crew.map((w) => [w.name, w]));
  const headSize = r.headline.length > 95 ? 2.6 : r.headline.length > 65 ? 3 : 3.6;
  return (
    <section className={`tvx-reveal is-${beat}`} onClick={() => setK((n) => Math.min(order.length - 1, n + 1))}>
      <p key={beat} className="tvx-beat-label">
        {beat === "did" ? "What you did" : beat === "real" ? "What really happened" : "Based on a true story"}
      </p>

      {beat === "did" && grand ? (
        <div className={`tvx-moves n-${Math.min(6, r.moves!.length)}`}>
          {r.moves!.slice(0, 6).map((m, i) => {
            const w = crewByName.get(m.name);
            return (
              <article key={m.name + i} className="tvx-move" style={{ ["--c" as string]: w?.color ?? "#ff2e7e", ["--i" as string]: i } as Css}>
                <header className="tvx-move-who">
                  <Face src={w?.portrait} name={m.name} color={w?.color ?? "#ff2e7e"} size={4.6} />
                  <span>{m.name}</span>
                </header>
                <p className="tvx-move-txt">&ldquo;{m.move}&rdquo;</p>
              </article>
            );
          })}
          {r.ending && (
            <span className="tvx-yours-stamp tvx-moves-stamp" style={{ ["--ec" as string]: r.endingColor ?? "#ffd23f" } as Css}>
              {r.ending}
            </span>
          )}
        </div>
      ) : beat === "bridge" ? (
        <>
          <p className="tvx-bridge">{r.bridge}</p>
          <aside className="tvx-take tvx-take-bridge">
            <p className="tvx-take-head">Take your tale home</p>
            {keepsake ?? (
              <span className="tvx-take-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {take ? <img src={take} alt="QR code: your storybook" /> : <span className="tvx-take-wait">Binding your storybook…</span>}
              </span>
            )}
            <p className="tvx-take-sub">Scan for your storybook</p>
          </aside>
        </>
      ) : beat === "did" ? (
        <article className="tvx-yours tvx-yours-solo">
          <p className="tvx-yours-kicker">Your story</p>
          <h3 className="tvx-yours-title">{r.yourTitle}</h3>
          {crew.length > 0 && (
            <p className="tvx-yours-crew">
              {crew.map((w) => (
                <span key={w.name} className="tvx-yours-hero">
                  <Face src={w.portrait} name={w.name} color={w.color} size={4} />
                  {w.name}
                </span>
              ))}
            </p>
          )}
          <p className="tvx-yours-txt">{r.yourVersion}</p>
          {r.solvedBy && <p className="tvx-yours-solved">{r.solvedBy}</p>}
          {r.ending && (
            <span className="tvx-yours-stamp" style={{ ["--ec" as string]: r.endingColor ?? "#ffd23f" } as Css}>
              {r.ending}
            </span>
          )}
        </article>
      ) : (
        <>
          <h2 className="tvx-reveal-title">
            <span className="tvx-reveal-small">{r.author ? `Based on ${possessive(r.author)}` : "Based on a"}</span>
            <span className="tvx-reveal-big">true story</span>
          </h2>
          <article className="tvx-clip tvx-clip-solo" style={{ ["--hs" as string]: headSize } as Css}>
            <i className="tvx-tape tl" aria-hidden />
            <i className="tvx-tape br" aria-hidden />
            <p className="tvx-clip-kicker">
              {r.source}
              {r.date ? ` · ${niceDate(r.date)}` : ""}
            </p>
            <h3 className="tvx-clip-head">{r.headline}</h3>
            {r.summary && <p className="tvx-clip-sum">{r.summary}</p>}
            {(r.realEnding || r.now) && (
              <p className="tvx-clip-now">
                <b>How it really ended:</b> {r.realEnding || r.now}
              </p>
            )}
            {article && (
              <span className="tvx-clip-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article} alt="QR code to the real article" />
                <small>Read it</small>
              </span>
            )}
          </article>
          <aside className="tvx-take">
            <p className="tvx-take-head">Take your tale home</p>
            {keepsake ?? (
              <span className="tvx-take-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {take ? <img src={take} alt="QR code: your storybook" /> : <span className="tvx-take-wait">Binding your storybook…</span>}
              </span>
            )}
            <p className="tvx-take-sub">Scan for your storybook</p>
          </aside>
        </>
      )}
    </section>
  );
}
