/* SWAP-IN (for the builder, TV.tsx): the new full-bleed lobby. Pure props, no GameHost import, so it previews at /lobby-preview.
 * 1. import { Lobby } from "./Lobby";   then delete the old `function Lobby` in TV.tsx (it owns its own music + join sfx).
 * 2. In TV(): before the Mirror switch add  if (s.phase === "lobby") return (<><Lobby {...props} />{overlays}{toast…}<Reactions items={reactions} /></>);
 *    (no TopBar/Footer: the lobby is full-bleed and has its own mute button).
 * 3. props: code={s.code} players={s.players} mode={s.mode} source={s.source} rating={s.rating}
 *    portraitOf={(p) => (p.pick ? `/heroes/${p.pick}.webp` : host.thumbs[p.id] ?? host.portraits[p.id])}
 *    readOnly={host.readOnly} onMode={(m) => host.setMode(m)} onSource={(x) => host.setSource(x)} onRating={(r) => host.setRating(r)}
 *    canStart={host.canBegin()} onStart={() => host.begin()} localMode={host.transportKind === "local"}
 *    onAddBot={showBots ? () => host.addBot() : undefined}   (keep the old ?bots URL check)
 * 4. Optional: countdown={false} skips the 3-2-1; minPlayers (default 2) gates when START appears; pitch = attract line.
 * Styles live in app/lobby.css (imported here). Sizing uses its own 16:9 unit, so TV's root font-size clamp doesn't matter. */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type { GameMode, Player, Rating } from "@/lib/types";
import { RATINGS, RATING_LABEL } from "@/lib/rating";
import { STAT_LABEL } from "@/lib/rules";
import { playSfx, unlockAudio, useMusic, useSoundPrefs } from "@/lib/sound";
import { mask } from "@/lib/mask";
import { shortName } from "@/lib/now";
import "@/app/lobby.css";
import "@/app/tv-theme.css";
import { Particles } from "./tvskin/motion";

export type StorySource = "news" | "ours";

export interface LobbyProps {
  code: string;
  players: Player[];
  mode: GameMode;
  source: StorySource;
  rating: Rating;
  /** Portrait (or thumbnail) URL for a player's hero, if one exists yet. */
  portraitOf?: (p: Player) => string | undefined;
  /** /watch and other read-only views: no settings, no Start. */
  readOnly?: boolean;
  onMode?: (m: GameMode) => void;
  onSource?: (s: StorySource) => void;
  onRating?: (r: Rating) => void;
  /** host.canBegin(): heroes ready and a story loaded. */
  canStart?: boolean;
  onStart?: () => void;
  /** 3-2-1 before onStart (default true). */
  countdown?: boolean;
  /** START appears from this many players (default 2). */
  minPlayers?: number;
  /** What the QR opens. Default: <origin>/play?code=CODE. */
  joinUrl?: string;
  /** The short address printed under the QR. Default: <host>/play. */
  shortUrl?: string;
  /** Supabase keys missing: phones on other devices can't connect. */
  localMode?: boolean;
  /** Dev only: adds a test player. */
  onAddBot?: () => void;
  /** Attract-mode pitch line (nobody joined yet). */
  pitch?: string;
  /** Start the lobby music (default true). */
  music?: boolean;
}

const MAX_PLAYERS = 6;
const SLIDE_MS = 9000;

// The CD's v2 lobby paintings lead; quest scenes fill in between them. (The old /lobby/*.webp art is out.)
const HERO_ART = ["array", "boulder", "bridge", "dome", "otter", "pumpkin"].map((n) => `/lobby/v2/${n}.webp`);
const QUEST_ART = ["rust-wyrm", "galactic-signal", "hanging-boulder", "returned-otter", "cornfield-dome", "billion-pearls", "idle-island", "littlest-gardener"].flatMap(
  (q) => [1, 2, 3].map((n) => `/quests/${q}/scene_${n}.webp`),
);
const KB = ["lb-kb-a", "lb-kb-b", "lb-kb-c"];
const TILTS = [-3.5, 2.5, -1.5, 3.5, -2.5, 1.5];

function shuffled<T>(xs: T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Interleave: hero art, quest scene, hero art, quest scene... */
function playlist() {
  const q = shuffled(QUEST_ART).slice(0, 8);
  const out: string[] = [];
  for (let i = 0; i < q.length; i++) out.push(HERO_ART[i % HERO_ART.length], q[i]);
  return out;
}

// ---------- little glyphs ----------
const H = [[100, 8], [179.7, 54], [179.7, 146], [100, 192], [20.3, 146], [20.3, 54]] as const;
const T = [[100, 42], [151, 130], [49, 130]] as const;
const pt = (p: readonly number[]) => p.join(",");
const SPOKES: [readonly number[], readonly number[]][] = [
  [H[0], T[0]], [H[1], T[0]], [H[1], T[1]], [H[2], T[1]], [H[3], T[1]], [H[3], T[2]], [H[4], T[2]], [H[5], T[2]], [H[5], T[0]],
];

// facets of the front view, each with a holo tint (only the big spinning die fills them)
const FACETS: [(readonly number[])[], string][] = [
  [[H[0], H[5], T[0]], "#3de7ff"], [[H[0], H[1], T[0]], "#b46bff"], [[H[1], T[0], T[1]], "#ff2e7e"],
  [[H[1], H[2], T[1]], "#3de7ff"], [[H[2], H[3], T[1]], "#ffad3b"], [[H[3], T[1], T[2]], "#b46bff"],
  [[H[3], H[4], T[2]], "#ff2e7e"], [[H[4], H[5], T[2]], "#c6ff2e"], [[H[5], T[0], T[2]], "#3de7ff"],
];

function D20Glyph({ className, label = "20", holo = false }: { className?: string; label?: string; holo?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <polygon points={H.map(pt).join(" ")} className="lb-d20-body" />
      {holo && FACETS.map(([f, c], i) => <polygon key={`f${i}`} points={f.map(pt).join(" ")} className="lb-facet" style={{ fill: c, opacity: 0.1 + (i % 3) * 0.08 }} />)}
      <polygon points={T.map(pt).join(" ")} className="lb-d20-face" />
      {SPOKES.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      ))}
      <text x="100" y="112" textAnchor="middle" dominantBaseline="middle">
        {label}
      </text>
    </svg>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
};
function Pips({ n }: { n: 1 | 2 | 3 }) {
  return (
    <svg viewBox="0 0 100 100" className="lb-pipdie" aria-hidden>
      <rect x="6" y="6" width="88" height="88" rx="18" />
      {PIPS[n].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="11" />
      ))}
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
      {muted ? (
        <path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      ) : (
        <path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

// ---------- background: painted scenes + melting neon ----------
function SceneLoop() {
  const [art, setArt] = useState<string[]>(() => [...HERO_ART, ...QUEST_ART.slice(0, 4)]);
  const [i, setI] = useState(0);
  useEffect(() => setArt(playlist()), []); // shuffle on the client only (no hydration mismatch)
  useEffect(() => {
    const iv = setInterval(() => setI((n) => n + 1), SLIDE_MS);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const next = new Image();
    next.src = art[(i + 1) % art.length];
  }, [i, art]);
  const shown = [i - 1, i].filter((n) => n >= 0);
  return (
    <>
      {shown.map((n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={n} src={art[n % art.length]} alt="" className="lb-slide" style={{ ["--kb" as string]: KB[n % KB.length] }} />
      ))}
    </>
  );
}

// ---------- hero cards ----------
const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

function HeroCardTile({ p, i, portrait }: { p: Player; i: number; portrait?: string }) {
  const h = p.hero;
  const flipped = !h; // card back until the hero exists
  const style = { ["--c" as string]: p.color, ["--tilt" as string]: `${TILTS[i % TILTS.length]}deg`, ["--i" as string]: i } as React.CSSProperties;
  return (
    <div className="lb-slot" style={style}>
      <span className="lb-burst" aria-hidden />
      <div className="lb-float">
      <div className={`lb-card ${flipped ? "is-back" : ""}`}>
        <div className="lb-face lb-front" aria-hidden={flipped}>
          <div className="lb-portrait">
            {portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portrait} alt="" />
            ) : (
              <svg viewBox="0 0 64 80" className="lb-sil" aria-hidden>
                <circle cx="32" cy="28" r="13" />
                <path d="M6 80c1-17 11-27 26-27s25 10 26 27z" />
              </svg>
            )}
            <span className="lb-sheen" aria-hidden />
            <span className="lb-no">{i + 1}</span>
          </div>
          <div className="lb-plate">
            <span className="lb-hname">{h ? shortName(h.name, 14) : ""}</span>
          </div>
          <div className="lb-sheet">
            <span className="lb-epi">{h ? mask(h.epithet) : ""}</span>
            <span className="lb-stats">
              {h &&
                (Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).map((k) => (
                  <span key={k} className={h.stats[k] >= 3 ? "best" : h.stats[k] < 0 ? "low" : ""}>
                    <b>{fmt(h.stats[k])}</b>
                    {STAT_LABEL[k]}
                  </span>
                ))}
            </span>
          </div>
        </div>
        <div className="lb-face lb-back" aria-hidden={!flipped}>
          <D20Glyph className="lb-back-d20" label="?" />
          <span className="lb-back-txt">{p.status === "building" ? "Painting a hero" : "Picking a hero"}</span>
        </div>
      </div>
      </div>
      <span className="lb-who">{shortName(mask(p.name), 12)}</span>
    </div>
  );
}

function JoinGhost({ i }: { i: number }) {
  return (
    <div className="lb-slot lb-ghost" style={{ ["--tilt" as string]: `${TILTS[i % TILTS.length]}deg`, ["--i" as string]: i } as React.CSSProperties}>
      <div className="lb-ghost-card">
        <span className="lb-ghost-plus">+</span>
        <span className="lb-ghost-txt">Your hero here</span>
      </div>
      <span className="lb-who">&nbsp;</span>
    </div>
  );
}

// ---------- settings ----------
function Choice<T extends string>({ label, value, options, onPick, tone }: { label: string; value: T; options: { v: T; text: string; sub?: string }[]; onPick: (v: T) => void; tone: string }) {
  return (
    <div className="lb-group" style={{ ["--tone" as string]: tone } as React.CSSProperties}>
      <span className="lb-glabel">{label}</span>
      <div className="lb-gbtns" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.v}
            role="radio"
            aria-checked={value === o.v}
            className={`lb-btn ${value === o.v ? "on" : ""}`}
            onClick={() => {
              unlockAudio();
              if (value !== o.v) playSfx("pick");
              onPick(o.v);
            }}
          >
            <span className="lb-btn-in">
              {o.text}
              {o.sub && <small>{o.sub}</small>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- countdown ----------
function Countdown({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [n, setN] = useState(3);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (n > 0) playSfx("timerTick", { volume: 1.4 });
    else playSfx("diceLand");
    const t = setTimeout(() => (n > 0 ? setN(n - 1) : done.current()), n > 0 ? 900 : 650);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div className="lb-count" role="alert" onClick={onCancel}>
      <span key={n} className={`lb-count-n ${n === 0 ? "go" : ""}`}>
        {n > 0 ? n : "Roll!"}
      </span>
      <span className="lb-count-hint">Tap to wait</span>
    </div>
  );
}

// ---------- the lobby ----------
export function Lobby(props: LobbyProps) {
  const {
    code, players, mode, source, rating, portraitOf, readOnly = false,
    onMode, onSource, onRating, canStart = false, onStart, countdown = true, minPlayers = 2,
    localMode = false, onAddBot, music = true,
    pitch = "The news is real. The heroes are your friends.",
  } = props;
  useMusic(music ? "lobby" : null, 0); // starts on the first tap anywhere (browsers need one)
  const sound = useSoundPrefs();

  // QR + addresses
  const [qr, setQr] = useState("");
  const [addr, setAddr] = useState({ join: props.joinUrl ?? "", short: props.shortUrl ?? "" });
  useEffect(() => {
    const join = props.joinUrl ?? `${location.origin}/play?code=${code}`;
    const short = props.shortUrl ?? `${location.host}/play`;
    setAddr({ join, short });
    QRCode.toDataURL(join, { margin: 1, width: 600, errorCorrectionLevel: "M", color: { dark: "#0A0612", light: "#FFFFFF" } }).then(setQr);
  }, [code, props.joinUrl, props.shortUrl]);

  // a sound for every new face (not for the ones already here when the screen opened)
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!known.current) {
      known.current = new Set(players.map((p) => p.id));
      return;
    }
    players.forEach((p, i) => {
      if (!known.current!.has(p.id)) {
        known.current!.add(p.id);
        setTimeout(() => playSfx("join", { pitch: (i % 3) * 2 }), 120);
      }
    });
  }, [players]);
  // ...and a little sting when a card flips to its hero
  const heroed = useRef<Set<string> | null>(null);
  useEffect(() => {
    const now = players.filter((p) => p.hero).map((p) => p.id);
    if (!heroed.current) {
      heroed.current = new Set(now);
      return;
    }
    now.forEach((id) => {
      if (!heroed.current!.has(id)) {
        heroed.current!.add(id);
        playSfx("reveal", { volume: 0.6 });
      }
    });
  }, [players]);

  const [counting, setCounting] = useState(false);
  const enough = players.length >= minPlayers;
  const showStart = !readOnly && !!onStart && enough;
  const start = useCallback(() => {
    if (!canStart || !onStart) return;
    unlockAudio();
    if (countdown) setCounting(true);
    else onStart();
  }, [canStart, onStart, countdown]);
  useEffect(() => {
    if (counting && !canStart) setCounting(false);
  }, [counting, canStart]);

  const attract = players.length === 0;
  const picking = players.some((p) => !p.hero && p.status !== "building");
  const status = readOnly
    ? "The table starts it when everyone’s in."
    : !enough
      ? players.length === 0
        ? "Point your phone camera at the code."
        : `${minPlayers - players.length} more and you can start.`
      : picking
        ? "Someone’s still picking a hero."
        : !canStart
          ? "Shuffling tonight’s story…"
          : source === "ours"
            ? "First, everyone writes one small true story."
            : mode === "quick"
              ? "One turn each. About five minutes."
              : "You’ll vote on tonight’s story first.";

  const cards = useMemo(() => players.slice(0, MAX_PLAYERS), [players]);

  return (
    <div className={`lb ${attract ? "is-attract" : ""}`} onPointerDown={() => unlockAudio()}>
      {/* ---- background stack ---- */}
      <div className="lb-bg" aria-hidden>
        <SceneLoop />
        <div className="lb-tint" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-group-project.jpg" alt="" className="lb-smear lb-smear-a" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-group-project.jpg" alt="" className="lb-smear lb-smear-b" />
        <div className="lb-beam lb-beam-a" />
        <div className="lb-beam lb-beam-b" />
        <div className="lb-scrim" />
        <div className="lb-candle" />
        <Particles count={36} seed={7} className="lb-particles" />
        <div className="lb-halftone" />
        <div className="lb-grain" />
        <div className="lb-vignette" />
      </div>

      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id="lb-liquid">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="7">
            <animate attributeName="baseFrequency" dur="6s" values="0.012 0.03;0.016 0.045;0.012 0.03" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="18" />
        </filter>
      </svg>

      {/* ---- the 16:9 stage ---- */}
      <div className="lb-stage">
        <div className="lb-d20-wrap" aria-hidden>
          <D20Glyph className="lb-d20" holo />
        </div>

        <h1 className="lb-logo" aria-label="Group Project">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-group-project.jpg" alt="" className="lb-logo-glow" />
          <span className="lb-logo-jelly">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-group-project.jpg" alt="" className="lb-logo-img" />
          </span>
          <span className="lb-drip" style={{ ["--x" as string]: "27%", ["--y" as string]: "77%", ["--d" as string]: "0s", ["--dc" as string]: "#ff2e9a" } as React.CSSProperties} />
          <span className="lb-drip" style={{ ["--x" as string]: "50.5%", ["--y" as string]: "79%", ["--d" as string]: "2.6s", ["--dc" as string]: "#ff3b4e" } as React.CSSProperties} />
          <span className="lb-drip" style={{ ["--x" as string]: "66%", ["--y" as string]: "70%", ["--d" as string]: "5.1s", ["--dc" as string]: "#c6ff2e" } as React.CSSProperties} />
          <span className="lb-drip" style={{ ["--x" as string]: "80.5%", ["--y" as string]: "74%", ["--d" as string]: "1.4s", ["--dc" as string]: "#ff2e9a" } as React.CSSProperties} />
        </h1>

        <p className="lb-tag">
          <span className="lb-tag-a">Grab your phone.</span>
          <span className="lb-tag-b">Tonight’s story is real.</span>
        </p>

        <ol className="lb-how" aria-label="How it works">
          <li>
            <Pips n={1} /> Suggest
          </li>
          <li className="lb-how-arrow" aria-hidden>
            ›
          </li>
          <li>
            <Pips n={2} /> Pick
          </li>
          <li className="lb-how-arrow" aria-hidden>
            ›
          </li>
          <li>
            <Pips n={3} /> Roll
          </li>
          <li className="lb-how-dm">Your Dungeon Master: Muse</li>
        </ol>

        {attract ? (
          <div className="lb-pitch">
            <p className="lb-pitch-line">{pitch}</p>
            <p className="lb-pitch-sub">2–6 players. Your phone is the controller.</p>
          </div>
        ) : (
          <div className="lb-cards" aria-label="Who's here">
            {cards.map((p, i) => (
              <HeroCardTile key={p.id} p={p} i={i} portrait={p.hero ? portraitOf?.(p) : undefined} />
            ))}
            {cards.length < MAX_PLAYERS && <JoinGhost i={cards.length} />}
          </div>
        )}

        {!readOnly && (onMode || onSource || onRating) && (
          <div className="lb-band">
            {onMode && (
              <Choice<GameMode>
                label="How long?"
                value={mode}
                tone="#3de7ff"
                onPick={onMode}
                options={[
                  { v: "quick", text: "Quick", sub: "5 min" },
                  { v: "full", text: "Full", sub: "10 min" },
                ]}
              />
            )}
            {onSource && (
              <Choice<StorySource>
                label="Tonight’s story"
                value={source}
                tone="#ff2e7e"
                onPick={onSource}
                options={[
                  { v: "news", text: "Odd news" },
                  { v: "ours", text: "Our stories" },
                ]}
              />
            )}
            {onRating && (
              <Choice<Rating> label="Who’s playing?" value={rating} tone="#c6ff2e" onPick={onRating} options={RATINGS.map((r) => ({ v: r, text: RATING_LABEL[r] }))} />
            )}
          </div>
        )}

        {/* ---- the join poster ---- */}
        <section className="lb-join" aria-label="Join this game">
          <div className="lb-join-frame">
            <p className="lb-join-head">Scan to join</p>
            <div className="lb-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr ? <img src={qr} alt={`QR code: ${addr.join}`} /> : <span className="lb-qr-wait" />}
              <i className="lb-corner tl" />
              <i className="lb-corner tr" />
              <i className="lb-corner bl" />
              <i className="lb-corner br" />
            </div>
            <div className="lb-code" aria-label={`Room code ${code.split("").join(" ")}`}>
              {code.split("").map((ch, i) => (
                <span key={i} className="lb-code-ch" style={{ ["--k" as string]: i } as React.CSSProperties}>
                  {ch}
                </span>
              ))}
            </div>
            <p className="lb-url">
              or go to <b>{addr.short}</b>
            </p>
            {localMode && <p className="lb-local">Local mode: other devices can’t join until Supabase keys are set.</p>}
          </div>
          {onAddBot && (
            <button className="lb-bot" onClick={onAddBot} disabled={players.length >= MAX_PLAYERS}>
              + test player
            </button>
          )}
        </section>

        {/* ---- start ---- */}
        <div className="lb-go">
          {showStart ? (
            <button className={`lb-start ${canStart ? "" : "is-wait"}`} onClick={start} disabled={!canStart} aria-label="Start the game">
              <span className="lb-start-in">
                Start
                <D20Glyph className="lb-start-d20" />
              </span>
            </button>
          ) : (
            <p className="lb-waiting" aria-live="polite">
              {attract ? "Waiting for heroes" : `${players.length} / ${minPlayers} heroes`}
            </p>
          )}
          <p className="lb-status">{status}</p>
        </div>

        <button className={`lb-mute ${sound.muted ? "is-muted" : ""}`} onClick={() => sound.toggleMuted()} aria-label={sound.muted ? "Unmute" : "Mute"}>
          <SpeakerIcon muted={sound.muted} />
        </button>
      </div>

      {counting && onStart && (
        <Countdown
          onDone={() => {
            setCounting(false);
            onStart();
          }}
          onCancel={() => setCounting(false)}
        />
      )}
    </div>
  );
}

export default Lobby;
