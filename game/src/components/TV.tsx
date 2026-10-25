"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { type GameHost } from "@/lib/host";
import { sfx } from "@/lib/sfx";
import type { GameState, Player } from "@/lib/types";
import { WaxSeal } from "./Stamp";
import { Reactions } from "./Reactions";
import { Hourglass, TypeReveal } from "./Effects";
import { mask } from "@/lib/mask";
import { DMNotesPanel } from "./DMNotes";
import { Presenter } from "./Presenter";
import { QuickTV } from "./QuickTV";
import { RATINGS, RATING_LABEL } from "@/lib/rating";
import { FEATURES } from "@/lib/features";

const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const READING = ["quest", "narrating", "outcome", "mirror_reveal", "epilogue", "reveal"];

/**
 * What the stage reads. GameHost (the real table) satisfies it, and so does the read-only
 * WatchSource behind /watch, which renders the same screens from the TV's broadcasts.
 */
export type Stage = Pick<
  GameHost,
  | "subscribe" | "getState" | "deadlineAt" | "portraits" | "thumbs" | "sceneImages" | "realStory" | "questSeed"
  | "transportKind" | "onReaction" | "skip" | "setPartyName" | "chooseQuest" | "canBegin" | "begin" | "nextTale"
  | "setMode" | "startedAt" | "endedAt" | "setRating" | "voiceUrl" | "setSource"
> & { readOnly?: boolean; onToast?: GameHost["onToast"] };

export function useHost(host: Stage) {
  return useSyncExternalStore(host.subscribe, host.getState, host.getState);
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [active]);
  return now;
}

// ---------- shared bits ----------
export function Hope({ hope, max }: { hope: number; max: number }) {
  return (
    <span className="font-ui text-2xl tracking-wider" aria-label={`Hope ${hope} of ${max}`} title="Group Hope">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < hope ? "text-[var(--crimson)] drop-shadow" : "text-parchment/25"}>
          ♥
        </span>
      ))}
    </span>
  );
}

function TopBar({ host, s, notesOpen, onNotes }: { host: Stage; s: GameState; notesOpen: boolean; onNotes: () => void }) {
  const now = useNow(!!host.deadlineAt);
  const left = host.deadlineAt ? Math.max(0, host.deadlineAt - now) : 0;
  const [muted, setMuted] = useState(false);
  const reading = READING.includes(s.phase) || s.phase === "final_result";
  return (
    <header className="flex items-center gap-6 px-8 py-3 font-ui text-parchment/90">
      <span className="font-display text-2xl text-[var(--gilt-bright)] uppercase">Group Project</span>
      {s.quest && <span className="font-heading text-xl truncate opacity-90">{s.quest.title}</span>}
      <span className="flex-1" />
      {s.phase !== "lobby" && FEATURES.hopeDisplay && <Hope hope={s.hope} max={s.hopeMax} />}
      {left > 0 && !reading && <span className="tabular-nums font-bold text-2xl w-14 text-right">{Math.ceil(left / 1000)}s</span>}
      {host.deadlineAt > 0 && reading && !host.readOnly && (
        <button className="gp-tb" onClick={() => host.skip()} title="Spacebar works too">
          Continue ▸
        </button>
      )}
      <button
        className="gp-tb"
        onClick={() => {
          sfx.setMuted(!muted);
          setMuted(!muted);
        }}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <span className="tracking-[0.3em] font-heading text-lg text-parchment/45">{s.code}</span>
    </header>
  );
}

export function Avatar({ host, p, size = 64 }: { host: Stage; p: Player; size?: number }) {
  const url = host.thumbs[p.id];
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="rounded-full object-cover object-top shrink-0" style={{ width: size, height: size, boxShadow: `0 0 0 3px ${p.color}` }} />;
  if (p.hero) return <Silhouette color={p.color} size={size} />;
  return <WaxSeal initials={initials(p.name)} color={p.color} size={size} />;
}

/** While a custom hero's portrait is being painted: an instant cartoon silhouette in the player's color, never a blank. */
export function Silhouette({ color, size = 64 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="shrink-0 rounded-full" style={{ boxShadow: `0 0 0 3px ${color}`, background: "#1b122b" }} aria-hidden>
      <defs>
        <radialGradient id={`sil-${color.slice(1)}`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.45" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="25" r="12" fill={`url(#sil-${color.slice(1)})`} />
      <path d="M10 62c1-13 10-21 22-21s21 8 22 21z" fill={`url(#sil-${color.slice(1)})`} />
    </svg>
  );
}

/** Autopilot: this hero's player stepped away, so the hero is acting on its own. */
function AutopilotTag() {
  return <span className="font-ui text-xs font-bold whitespace-nowrap text-[var(--signal)]">🤖 on autopilot</span>;
}

/** Who's ready / who's acted: one chip per hero along the bottom. */
function Crew({ host, s, mark }: { host: Stage; s: GameState; mark?: (p: Player) => string }) {
  return (
    <div className="flex gap-6 justify-center flex-wrap">
      {s.players
        .filter((p) => p.hero)
        .map((p) => {
          const m = p.away ? "" : mark?.(p) ?? "";
          return (
            <div key={p.id} data-crew-pid={p.id} className={`flex flex-col items-center gap-1 w-28 text-center transition ${m === "…" ? "opacity-60" : ""}`}>
              <Avatar host={host} p={p} size={56} />
              <span className="font-heading text-base leading-tight text-parchment">{p.hero!.name.split(" ")[0]}</span>
              {m && <span className="font-ui text-xs text-[var(--gilt-bright)]">{m}</span>}
              {p.away && <AutopilotTag />}
              {p.peril && <span className="font-ui text-xs font-bold text-[var(--crimson)]">STUCK</span>}
            </div>
          );
        })}
    </div>
  );
}

function Footer() {
  return (
    <footer className="text-center font-ui text-sm tracking-[0.2em] uppercase text-parchment/55 py-2">
      Narrated by AI · Decided by friends · Dice are real
    </footer>
  );
}

// ---------- lobby ----------
function Lobby({ host, s }: { host: Stage; s: GameState }) {
  const [qr, setQr] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const known = useRef(new Set<string>());
  useEffect(() => {
    const url = `${location.origin}/play?code=${s.code}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#0A0612", light: "#F5F1FF" } }).then(setQr);
  }, [s.code]);
  useEffect(() => {
    s.players.forEach((p) => {
      if (!known.current.has(p.id)) {
        known.current.add(p.id);
        sfx.join();
      }
    });
  }, [s.players]);
  const ready = s.players.filter((p) => p.hero || p.status === "building").length;
  const status = host.readOnly
    ? "The table starts it when everyone's in."
    : ready === 0
      ? "Scan the code with your phone camera to join."
      : s.players.some((p) => !p.hero && p.status !== "building")
        ? "Someone's still picking a hero. Start whenever you're ready."
        : s.source === "ours"
          ? "Everyone's in. First, everyone writes a small true story."
          : s.mode === "quick"
            ? "Everyone's in. One scene, about four minutes."
            : "Everyone's in. You'll vote on the story first.";
  return (
    <div className="grid grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-10 px-10 pb-8 pt-2 flex-1 min-h-0">
      <div className="page p-7 flex flex-col gap-4 items-center text-center self-start">
        <p className="font-heading text-2xl uppercase">Scan to join</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="QR code to join" className="w-64 h-64 rounded" /> : <div className="w-64 h-64" />}
        <p className="font-ui uppercase tracking-[0.2em] text-sm text-ink-soft">or go to {joinUrl.replace(/^https?:\/\//, "").replace(/\/play.*$/, "/play")}</p>
        <p className="font-display text-7xl tracking-[0.2em] leading-none">{s.code}</p>
        {host.transportKind === "local" && <p className="font-ui text-xs text-crimson">Local mode: phones on other devices can’t connect until Supabase keys are set.</p>}
      </div>

      <div className="flex flex-col gap-7 min-h-0">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-3xl uppercase text-[var(--gilt-bright)]">Your crew</h2>
          {s.players.length === 0 ? (
            <p className="text-2xl text-parchment/70">Nobody yet.</p>
          ) : (
            <div className="flex gap-6 flex-wrap">
              {s.players.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-2 w-28 text-center fade-in">
                  {p.hero ? <Avatar host={host} p={p} size={88} /> : <WaxSeal initials={initials(p.name)} color={p.color} size={88} pulse />}
                  <span className="font-heading text-xl uppercase leading-none">{p.hero ? p.hero.name.split(" ")[0] : mask(p.name)}</span>
                  <span className="font-ui text-xs text-parchment/60">{p.hero ? mask(p.name) : p.status === "building" ? "drawing a hero…" : "picking a hero…"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {!host.readOnly && (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-2xl uppercase text-[var(--gilt-bright)]">How long?</h2>
              <div className="qt-mode">
                <button aria-pressed={s.mode === "quick"} onClick={() => { sfx.unlock(); sfx.pageTurn(); host.setMode("quick"); }}>
                  <span className="font-heading text-2xl font-bold uppercase block">Quick Tale · 3 min</span>
                  <span className="text-sm text-ink-soft">One scene from a real headline.</span>
                </button>
                <button aria-pressed={s.mode === "full"} onClick={() => { sfx.unlock(); sfx.pageTurn(); host.setMode("full"); }}>
                  <span className="font-heading text-2xl font-bold uppercase block">Full Story · ~7 min</span>
                  <span className="text-sm text-ink-soft">Three scenes. You pick the story.</span>
                </button>
              </div>
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-2xl uppercase text-[var(--gilt-bright)]">Tonight’s story</h2>
              <div className="qt-mode">
                <button aria-pressed={s.source === "news"} onClick={() => { sfx.unlock(); sfx.pageTurn(); host.setSource("news"); }}>
                  <span className="font-heading text-2xl font-bold uppercase block">Odd news</span>
                  <span className="text-sm text-ink-soft">A strange, harmless story from this week’s real news.</span>
                </button>
                <button aria-pressed={s.source === "ours"} onClick={() => { sfx.unlock(); sfx.pageTurn(); host.setSource("ours"); }}>
                  <span className="font-heading text-2xl font-bold uppercase block">Our stories</span>
                  <span className="text-sm text-ink-soft">Each of you writes a small true story. Play one, then hear how it really ended.</span>
                </button>
              </div>
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-2xl uppercase text-[var(--gilt-bright)]">Who’s playing?</h2>
              <div className="grid grid-cols-3 gap-3">
                {RATINGS.map((r) => (
                  <button key={r} className={`gp-pill ${s.rating === r ? "on" : ""}`} aria-pressed={s.rating === r} onClick={() => { sfx.unlock(); sfx.pageTurn(); host.setRating(r); }}>
                    {RATING_LABEL[r]}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="flex items-center gap-5 mt-auto">
          {!host.readOnly && (
            <button className="btn btn-crimson text-3xl px-10" disabled={!host.canBegin()} onClick={() => host.begin()}>
              Start
            </button>
          )}
          <span className="font-ui text-lg text-parchment/75">{status}</span>
        </div>
      </div>
    </div>
  );
}

/** Ticks fast enough for a countdown to land on the beat. */
export function useFastNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setNow(Date.now()), 60);
    return () => clearInterval(iv);
  }, [active]);
  return now;
}

// ---------- Mirror, Mirror ----------
function MirrorTitle({ sub }: { sub: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="font-ui uppercase tracking-[0.3em] text-base text-[var(--signal)]">The secret mission</p>
      <h2 className="font-display text-7xl uppercase text-[var(--gilt-bright)]">Mirror, Mirror</h2>
      <p className="font-heading text-4xl leading-tight max-w-5xl">{sub}</p>
    </div>
  );
}

function MirrorWait({ host, s }: { host: Stage; s: GameState }) {
  const write = s.phase === "mirror_write";
  useEffect(() => {
    sfx.whoosh();
  }, [write]);
  return (
    <div className="flex-1 min-h-0 flex flex-col justify-center gap-10 px-8 pb-4">
      <MirrorTitle
        sub={
          write
            ? "All night, each of you secretly watched one friend. Finish one sentence about them on your phone."
            : "Now guess: what do you think your guardian wrote about you?"
        }
      />
      <p className="text-center font-ui text-xl text-parchment/75">
        {write ? "Only nice things. Nobody gets rated. Nobody knows who has who, yet." : "Tap a guess on your phone. Be honest."}
      </p>
      <Crew
        host={host}
        s={s}
        mark={(p) => {
          const c = write ? s.mirror.find((m) => m.guardianId === p.id) : s.mirror.find((m) => m.wardId === p.id);
          if (!c) return "";
          return write ? (c.written ? "written ✓" : "…") : c.guess ? "guessed ✓" : "…";
        }}
      />
    </div>
  );
}

function MirrorRevealCard({ host, s }: { host: Stage; s: GameState }) {
  const card = s.mirror[s.mirrorIndex];
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    if (!card?.sentence) return;
    sfx.pageTurn();
    const t = setTimeout(() => {
      setShown(true);
      sfx.choir();
    }, 2200);
    return () => clearTimeout(t);
  }, [card?.wardId, card?.sentence]);
  if (s.busy || !card) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Hourglass size={72} />
        <p className="font-heading text-2xl">{s.busy || "The mirror is polishing the glass…"}</p>
      </div>
    );
  }
  const ward = s.players.find((p) => p.id === card.wardId);
  const guardian = s.players.find((p) => p.id === card.guardianId);
  return (
    <div className="flex-1 min-h-0 flex flex-col justify-center gap-4 px-8 pb-4">
      <div key={card.wardId} className="page p-10 grid grid-cols-[auto_minmax(0,1fr)] gap-10 items-center fade-in">
        <div className="flex flex-col items-center gap-3 w-60">
          {ward && host.portraits[ward.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={host.portraits[ward.id]} alt="" className="portrait-oval w-52 h-64" />
          ) : (
            ward && <Avatar host={host} p={ward} size={180} />
          )}
          <p className="font-heading text-3xl uppercase text-center leading-tight">{ward?.hero?.name}</p>
          {ward && <p className="font-ui text-base text-ink-soft">played by {mask(ward.name)}</p>}
        </div>
        <div className="flex flex-col gap-6 min-w-0">
          <p className="text-2xl italic text-ink-soft">
            You guessed: {card.guess ? `“${mask(card.guess)}”` : "you were too shy to guess"}
          </p>
          <div className="min-h-[7em]">
            {shown ? (
              <TypeReveal text={card.sentence} className="font-heading text-[2.6rem] leading-snug" />
            ) : (
              <p className="font-heading text-3xl text-ink-soft animate-pulse">Your guardian wrote…</p>
            )}
          </div>
          {shown && <p className="font-ui text-2xl text-[var(--crimson)] fade-in">From your guardian, {guardian?.hero?.name ?? "a friend"}</p>}
          <p className="font-ui text-sm text-ink-soft">
            {s.mirrorIndex + 1} of {s.mirror.length}
          </p>
        </div>
      </div>
      <Crew host={host} s={s} mark={(p) => (s.ready.includes(p.id) ? "ready ✓" : "")} />
    </div>
  );
}

/** A save got thanked: a big heart floats from the saved hero's avatar to whoever saved them. */
export function ThankHearts({ s }: { s: GameState }) {
  const seen = useRef<Set<string> | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const thanked = (s.saves ?? []).filter((x) => x.thanked);
    if (!seen.current) {
      seen.current = new Set(thanked.map((x) => x.id));
      return;
    }
    const fresh = thanked.filter((x) => !seen.current!.has(x.id));
    fresh.forEach((save) => {
      seen.current!.add(save.id);
      sfx.thanks();
      const box = layer.current;
      if (!box) return;
      const center = (pid: string) => {
        const el = document.querySelector(`[data-crew-pid="${pid}"]`);
        const r = el?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + 28 } : null;
      };
      const from = center(save.savedId) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.75 };
      const first = (pid: string) => s.players.find((p) => p.id === pid)?.hero?.name.split(" ")[0] ?? "";
      save.byIds.forEach((by, i) => {
        const to = center(by) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
        const el = document.createElement("div");
        el.style.cssText = "position:fixed;left:0;top:0;display:flex;flex-direction:column;align-items:center;pointer-events:none;";
        const heart = document.createElement("span");
        heart.textContent = "❤️";
        heart.style.cssText = "font-size:7rem;line-height:1;filter:drop-shadow(0 0 18px #FF2E7E)";
        const cap = document.createElement("span");
        cap.className = "font-heading uppercase";
        cap.style.cssText = "font-size:1.6rem;color:#fff;text-shadow:0 2px 8px #000;white-space:nowrap";
        cap.textContent = `${first(save.savedId)} → ${first(by)}: thank you!`;
        el.append(heart, cap);
        box.appendChild(el);
        const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - window.innerHeight * 0.35 };
        const at = (pt: { x: number; y: number }, sc: number) => `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%) scale(${sc})`;
        try {
          const anim = el.animate(
            [
              { transform: at(from, 0.3), opacity: 0 },
              { transform: at(from, 1.2), opacity: 1, offset: 0.15 },
              { transform: at(mid, 1.4), opacity: 1, offset: 0.55 },
              { transform: at(to, 1), opacity: 1, offset: 0.85 },
              { transform: at(to, 1.6), opacity: 0 },
            ],
            { duration: 2600, delay: i * 350, easing: "ease-in-out", fill: "both" },
          );
          anim.onfinish = () => el.remove();
        } catch {
          /* no Web Animations: the timeout below still cleans up */
        }
        setTimeout(() => el.remove(), 4000 + i * 350);
      });
    });
  }, [s.saves, s.players]);
  return <div ref={layer} aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 70 }} />;
}

// ---------- root ----------
/** The big screen. `embedded` (split view on a laptop) leaves the page's font size alone. */
export function TV({ host, embedded = false }: { host: Stage; embedded?: boolean }) {
  const s = useHost(host);
  const [notesOpen, setNotesOpen] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; color?: string }[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => host.onToast?.(setToast), [host]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  // 10-foot UI: scale every rem with the screen width so text stays readable from across a room.
  useEffect(() => {
    if (embedded) return;
    const root = document.documentElement;
    const prev = root.style.fontSize;
    root.style.fontSize = "clamp(16px, 1.3vw, 30px)";
    return () => {
      root.style.fontSize = prev;
    };
  }, [embedded]);
  // Spacebar / clicker = Continue, N = DM's Notes, plus presenter hotkeys and the attract loop: see Presenter.tsx.
  // The game lives in this tab: warn before an accidental refresh or close wipes it mid-story.
  const midGame = s.phase !== "lobby" && s.phase !== "storybook" && !host.readOnly;
  useEffect(() => {
    if (!midGame) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [midGame]);
  useEffect(
    () =>
      host.onReaction((r) => {
        const color = host.getState().players.find((p) => p.id === r.pid)?.color;
        setReactions((rs) => [...rs.slice(-40), { id: r.id, emoji: r.emoji, color }]);
        sfx.pop();
      }),
    [host],
  );

  // Quick Tale has its own full-bleed, cinematic stage once the story starts.
  // DM's Notes and the presenter layer (Space, N, S, Q, A, H) ride along on both stages.
  const overlays = !host.readOnly && (
    <>
      <DMNotesPanel s={s} open={notesOpen} onClose={() => setNotesOpen(false)} />
      <Presenter host={host} s={s} onNotes={() => setNotesOpen((o) => !o)} onCloseNotes={() => setNotesOpen(false)} />
    </>
  );
  // Both modes play the story on one full-bleed, cinematic stage (QuickTV.tsx). Mirror keeps its own screens.
  if (s.phase !== "lobby" && !(FEATURES.mirror && s.phase.startsWith("mirror")))
    return (
      <>
        <QuickTV host={host} s={s} onNotes={() => setNotesOpen((o) => !o)} notesOpen={notesOpen} />
        {toast && (
          <div key={toast.id} className="fixed top-20 left-1/2 -translate-x-1/2 z-50 page px-6 py-3 font-heading text-2xl uppercase fade-in">
            👋 {toast.text}
          </div>
        )}
        {overlays}
      </>
    );

  let main: React.ReactNode;
  switch (s.phase) {
    case "mirror_write":
    case "mirror_guess":
      main = <MirrorWait host={host} s={s} />;
      break;
    case "mirror_reveal":
      main = <MirrorRevealCard host={host} s={s} />;
      break;
    default:
      main = <Lobby host={host} s={s} />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" onPointerDown={() => sfx.unlock()}>
      <TopBar host={host} s={s} notesOpen={notesOpen} onNotes={() => setNotesOpen((o) => !o)} />
      {main}
      <Footer />
      <Reactions items={reactions} />
      <ThankHearts s={s} />
      {overlays}
      {toast && (
        <div key={toast.id} className="fixed top-20 left-1/2 -translate-x-1/2 z-50 page px-6 py-3 font-heading text-2xl uppercase fade-in">
          👋 {toast.text}
        </div>
      )}
    </div>
  );
}
