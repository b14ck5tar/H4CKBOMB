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
        {!atReveal ? <Panel key={i} p={panels[i]} n={i} of={panels.length} ms={panelMs} /> : <Reveal r={reveal} keepsake={keepsake} keepsakeUrl={keepsakeUrl} />}
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

function Reveal({ r, keepsake, keepsakeUrl }: { r: RevealData; keepsake?: React.ReactNode; keepsakeUrl?: string }) {
  const article = useQr(r.articleUrl, "#16110a", "#f3ecdc");
  const take = useQr(keepsake ? undefined : keepsakeUrl);
  const headSize = r.headline.length > 95 ? 2.3 : r.headline.length > 65 ? 2.7 : 3.2;
  return (
    <section className="tvx-reveal">
      <h2 className="tvx-reveal-title">
        <span className="tvx-reveal-small">{r.author ? `Based on ${possessive(r.author)}` : "Based on a"}</span>
        <span className="tvx-reveal-big">true story</span>
      </h2>

      <article className="tvx-clip" style={{ ["--hs" as string]: headSize } as Css}>
        <i className="tvx-tape tl" aria-hidden />
        <i className="tvx-tape br" aria-hidden />
        <p className="tvx-clip-kicker">
          {r.source}
          {r.date ? ` · ${niceDate(r.date)}` : ""}
        </p>
        <h3 className="tvx-clip-head">{r.headline}</h3>
        {r.summary && <p className="tvx-clip-sum">{r.summary}</p>}
        {r.now && (
          <p className="tvx-clip-now">
            <b>Now:</b> {r.now}
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

      <span className="tvx-vs" aria-hidden>
        vs
      </span>

      <article className="tvx-yours">
        <p className="tvx-yours-kicker">Your version</p>
        <h3 className="tvx-yours-title">{r.yourTitle}</h3>
        <p className="tvx-yours-txt">{r.yourVersion}</p>
        {r.solvedBy && <p className="tvx-yours-solved">{r.solvedBy}</p>}
        {r.ending && (
          <span className="tvx-yours-stamp" style={{ ["--ec" as string]: r.endingColor ?? "#ffd23f" } as Css}>
            {r.ending}
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
    </section>
  );
}
