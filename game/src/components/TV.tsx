"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { type GameHost, loadShelf, thankYouLines, type ShelfBook } from "@/lib/host";
import { BAND_LABEL, ENDING_LABEL, ROLL_ANIM_MS, STAT_LABEL, autoSucceeds, isFailure, stampText } from "@/lib/rules";
import { sfx } from "@/lib/sfx";
import type { GameState, Player, RollResult } from "@/lib/types";
import { D20 } from "./D20";
import { Stamp, WaxSeal } from "./Stamp";
import { Reactions } from "./Reactions";
import { Hourglass, ScreenFlash, TypeReveal } from "./Effects";
import { HeroCard } from "./HeroCard";
import { mask } from "@/lib/mask";
import { DMNotesPanel, HowThisWasMade } from "./DMNotes";
import { KeepsakeQR } from "./Keepsake";
import { Presenter } from "./Presenter";
import { QuickTV } from "./QuickTV";
import { RATINGS, RATING_LABEL } from "@/lib/rating";
import { FEATURES } from "@/lib/features";

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
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
  | "setMode" | "startedAt" | "endedAt" | "setRating"
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

function bandTone(b: RollResult["band"]): "gilt" | "forest" | "crimson" {
  return b === "LEGENDARY" ? "gilt" : isFailure(b) ? "crimson" : "forest";
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
      {!host.readOnly && (
        <button
          className={`gp-tb ${notesOpen ? "on" : ""}`}
          onClick={onNotes}
          title="What the AI is doing, and why (press N)"
          aria-pressed={notesOpen}
        >
          DM&apos;s Notes
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

function SceneImage({ host, index, className = "" }: { host: Stage; index: number; className?: string }) {
  const url = host.sceneImages[index];
  return (
    <div className={`relative overflow-hidden rounded bg-[var(--surface-2)] ${className}`} style={{ aspectRatio: "16 / 9" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover fade-in" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-parchment/70">
          <Hourglass size={56} />
          <span className="font-heading">Painting the scene…</span>
        </div>
      )}
    </div>
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

/** Always on screen during play: the goal, the question this scene asks, and what just happened. */
function QuestBoard({ s }: { s: GameState }) {
  const scene = s.scenes[s.sceneIndex];
  const stuck = s.players.filter((p) => p.peril);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-3 font-ui">
      <div className="rounded border border-[var(--gilt)]/50 bg-black/30 px-4 py-2">
        <span className="uppercase tracking-[0.2em] text-xs text-[var(--gilt-bright)]">The goal</span>
        <p className="text-lg leading-snug text-parchment line-clamp-2">{s.quest?.goalShort}</p>
      </div>
      <div className="rounded border border-[var(--crimson)]/70 bg-black/30 px-4 py-2">
        <span className="uppercase tracking-[0.2em] text-xs text-[var(--crimson)]">
          Right now · {scene?.kind === "climax" ? "Finale" : `Scene ${s.sceneIndex + 1}`}
          {scene ? ` · ${scene.location}` : ""}
        </span>
        <p className="text-xl leading-snug text-parchment line-clamp-2">{s.question || s.situation}</p>
      </div>
      <div className="rounded border border-[var(--signal)]/50 bg-black/30 px-4 py-2">
        <span className="uppercase tracking-[0.2em] text-xs text-[var(--signal)]">{stuck.length ? "Stuck" : "Last time"}</span>
        <p className="text-lg leading-snug text-parchment line-clamp-2">
          {stuck.length ? stuck.map((p) => `${p.hero?.name}: ${p.peril}`).join(" · ") : s.lastTime || "Nothing yet. Give it a minute."}
        </p>
      </div>
    </div>
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
        : s.mode === "quick"
          ? "Everyone's in. One scene, about three minutes."
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

// ---------- round screens ----------
function PlanCards({ host, s }: { host: Stage; s: GameState }) {
  const boosts: Record<string, number> = {};
  Object.values(s.boosts).forEach((id) => (boosts[id] = (boosts[id] ?? 0) + 1));
  return (
    <div className="grid grid-cols-2 gap-3">
      {s.pitches.map((p, i) => {
        const pl = s.players.find((x) => x.id === p.playerId)!;
        return (
          <div key={p.id} className="page p-4 flex flex-col gap-2 fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center gap-3">
              <Avatar host={host} p={pl} size={40} />
              <span className="font-heading text-xl font-bold uppercase flex-1">{pl.hero?.name}</span>
              {(p.autopilot || pl.away) && <AutopilotTag />}
              {!!boosts[p.id] && <span className="font-ui text-lg">{"🔥".repeat(boosts[p.id])}</span>}
            </div>
            <p className="text-xl leading-snug">{p.verdict && p.verdict.moderation !== "ok" ? p.verdict.interpretation : `“${mask(p.text)}”`}</p>
            {p.appeal && <p className="text-base italic text-ink-soft">Argued: “{mask(p.appeal)}”</p>}
            {p.verdict && (
              <div className="flex items-center gap-3 flex-wrap">
                <Stamp text={stampText(p.verdict.tier)} size="sm" rotate={-3} slam={false} tone={autoSucceeds(p.verdict.tier) ? "forest" : p.verdict.tier === "solid" ? "ink" : p.verdict.tier === "miracle" ? "gilt" : "crimson"} />
                <span className="italic text-ink-soft">{p.verdict.quip}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PartyDice({ host, s }: { host: Stage; s: GameState }) {
  const [settled, setSettled] = useState<Record<string, boolean>>({});
  const prev = useRef<string[]>([]);
  useEffect(() => {
    const fresh = s.revealed.filter((id) => !prev.current.includes(id));
    prev.current = s.revealed;
    fresh.forEach((id) => {
      const r = s.rolls.find((x) => x.playerId === id);
      if (!r || r.noRoll) return setSettled((m) => ({ ...m, [id]: true }));
      setSettled((m) => ({ ...m, [id]: false }));
      sfx.diceRoll(ROLL_ANIM_MS - 300);
      setTimeout(() => {
        setSettled((m) => ({ ...m, [id]: true }));
        sfx.diceLand();
        if (r.band === "LEGENDARY") sfx.choir();
        else if (r.band === "CATASTROPHE") sfx.recordScratch();
      }, ROLL_ANIM_MS - 200);
    });
  }, [s.revealed, s.rolls]);
  return (
    <div className="flex gap-8 flex-wrap justify-center items-start">
      {s.rolls.map((r) => {
        const pl = s.players.find((x) => x.id === r.playerId)!;
        const shown = s.revealed.includes(r.playerId);
        const done = shown && settled[r.playerId];
        const pitch = s.pitches.find((p) => p.playerId === r.playerId);
        return (
          <div key={r.playerId} className="flex flex-col items-center gap-2 w-56 text-center">
            {r.noRoll ? (
              <div className="h-[170px] flex items-center justify-center">
                <Stamp text="THAT WORKS" sub="no roll needed" size="lg" tone="forest" />
              </div>
            ) : (
              <D20 value={shown ? r.kept : null} rolling={shown && !settled[r.playerId]} size={170} tone={done && r.band === "CATASTROPHE" ? "crimson" : "gold"} />
            )}
            <span className="font-heading text-2xl uppercase">{pl.hero?.name.split(" ")[0]}</span>
            {r.rescuerId && <span className="font-ui text-sm text-[var(--signal)]">Caught by {s.players.find((x) => x.id === r.rescuerId)?.hero?.name}</span>}
            {!shown && <span className="font-ui text-sm text-parchment/70 animate-pulse">tap ROLL on your phone</span>}
            {done && !r.noRoll && (
              <span className="font-ui text-sm text-parchment/80 tabular-nums">
                {r.kept} {fmt(r.statBonus)} {pitch?.verdict ? STAT_LABEL[pitch.verdict.stat] : ""} {fmt(r.tierMod)} = <b>{r.total}</b>
                {r.boosted ? " · 🔥" : ""}
              </span>
            )}
            {done && <Stamp text={BAND_LABEL[r.band]} size="md" tone={bandTone(r.band)} />}
          </div>
        );
      })}
    </div>
  );
}

function BeatCards({ host, s }: { host: Stage; s: GameState }) {
  const round = s.round!;
  const i = s.beatIndex;
  const beat = round.beats[i];
  const roll = beat ? s.rolls.find((r) => r.playerId === beat.hero_id) : undefined;
  const pl = beat ? s.players.find((p) => p.id === beat.hero_id) : undefined;
  const pitch = beat ? s.pitches.find((p) => p.playerId === beat.hero_id) : undefined;
  if (!beat) {
    return (
      <div className="page p-10 flex flex-col gap-4 items-center text-center fade-in">
        <p className="font-ui uppercase tracking-[0.25em] text-sm text-ink-soft">{round.headline}</p>
        <p className="font-heading text-5xl leading-tight uppercase">{round.now}</p>
      </div>
    );
  }
  return (
    <div key={i} className="page p-8 grid grid-cols-[auto_minmax(0,1fr)] gap-8 items-center fade-in">
      <div className="flex flex-col items-center gap-3 w-56">
        {pl && host.portraits[pl.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={host.portraits[pl.id]} alt="" className="portrait-oval w-48 h-60" />
        ) : (
          pl && <Avatar host={host} p={pl} size={160} />
        )}
        {roll && <Stamp text={roll.noRoll ? "THAT WORKS" : BAND_LABEL[roll.band]} sub={roll.noRoll ? "" : `rolled ${roll.kept}`} size="md" tone={bandTone(roll.band)} />}
      </div>
      <div className="flex flex-col gap-4 min-w-0">
        <p className="font-heading text-3xl uppercase text-[var(--gilt-bright)]">{pl?.hero?.name}</p>
        {pitch && <p className="text-2xl italic text-ink-soft">“{pitch.verdict && pitch.verdict.moderation !== "ok" ? pitch.verdict.interpretation : mask(pitch.text)}”</p>}
        <TypeReveal text={beat.text} className="text-[2.1rem] leading-snug" />
        <p className="font-ui text-sm text-ink-soft">
          {i + 1} of {round.beats.length}
        </p>
      </div>
    </div>
  );
}

function RoundStage({ host, s }: { host: Stage; s: GameState }) {
  const scene = s.scenes[s.sceneIndex];
  const victim = s.rescue ? s.players.find((p) => p.id === s.rescue!.victimId) : undefined;
  const [flash, setFlash] = useState<{ kind: "legendary" | "catastrophe" | null; n: number }>({ kind: null, n: 0 });
  const lastRound = useRef<unknown>(null);

  useEffect(() => {
    if (s.phase === "outcome" && s.round && s.round !== lastRound.current) {
      lastRound.current = s.round;
      sfx.play(s.round.sfx);
      if (s.rolls.some((r) => r.band === "LEGENDARY")) setFlash((f) => ({ kind: "legendary", n: f.n + 1 }));
      else if (s.rolls.some((r) => r.band === "CATASTROPHE")) setFlash((f) => ({ kind: "catastrophe", n: f.n + 1 }));
    }
  }, [s.phase, s.round, s.rolls]);
  useEffect(() => {
    if (s.phase === "narrating") sfx.pageTurn();
    if (s.phase === "outcome" && s.round) sfx.pageTurn();
  }, [s.phase, s.beatIndex, s.round]);

  let body: React.ReactNode;
  if (s.phase === "narrating") {
    body = (
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="relative">
          <SceneImage host={host} index={s.sceneIndex} />
          {s.banner && (
            <div className="absolute left-4 bottom-4">
              <Stamp text={s.banner} size="md" rotate={-3} slam={false} />
            </div>
          )}
        </div>
        <div className="page p-7 overflow-auto max-h-full">
          {s.busy ? (
            <div className="flex flex-col items-center gap-3 py-10"><Hourglass size={64} /><p className="font-heading text-xl">{s.busy}</p></div>
          ) : (
            <div className="flex flex-col gap-5">
              <TypeReveal text={s.narration} className="text-[1.9rem] leading-snug" />
              {s.npcLine?.speaker && s.npcLine?.line && (
                <p className="text-2xl border-l-4 border-[var(--gilt)] pl-4">
                  <b className="font-heading uppercase">{s.npcLine.speaker}:</b> “{s.npcLine.line}”
                </p>
              )}
              {FEATURES.clueBox && <p className="font-ui text-[var(--signal)]">🔍 Check your phone: you each noticed something different.</p>}
            </div>
          )}
        </div>
      </div>
    );
  } else if (s.phase === "pitch" || s.phase === "appeal") {
    const final = scene?.kind === "climax";
    body = (
      <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-auto">
        {victim && <Stamp text={`SAVE ${victim.hero?.name?.toUpperCase()}`} sub={s.rescue!.peril} size="md" />}
        <p className="font-heading text-4xl leading-tight uppercase text-center">
          {s.phase === "appeal" ? "Not sure it'll work? Argue your case on your phone." : final ? "Everyone: what's your final move?" : s.situation}
        </p>
        {s.busy ? (
          <div className="flex flex-col items-center gap-3 py-6"><Hourglass size={64} /><p className="font-heading text-xl">{s.busy}</p></div>
        ) : (
          !final && s.pitches.length > 0 && <PlanCards host={host} s={s} />
        )}
        {FEATURES.boost && !final && s.phase === "pitch" && s.pitches.length > 0 && (
          <p className="text-center font-ui text-parchment/70">Like someone’s plan? 🔥 it on your phone to give them a better roll.</p>
        )}
      </div>
    );
  } else if (s.phase === "roll" || s.phase === "catch") {
    body = (
      <div className="flex-1 min-h-0 flex flex-col gap-6 justify-center">
        <p className="font-heading text-4xl text-center uppercase text-[var(--gilt-bright)]">
          {s.phase === "catch" ? "Catch! Spend your heart to re-roll a friend’s fail" : "Everyone roll!"}
        </p>
        <PartyDice host={host} s={s} />
      </div>
    );
  } else if (s.phase === "outcome") {
    body = s.round && !s.busy ? (
      <div className="flex-1 min-h-0 flex flex-col justify-center">
        <BeatCards host={host} s={s} />
      </div>
    ) : (
      <div className="flex-1 flex flex-col items-center justify-center gap-3"><Hourglass size={72} /><p className="font-heading text-2xl">{s.busy || "Writing it all down…"}</p></div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 px-8 pb-2">
      <ScreenFlash kind={flash.kind} trigger={flash.n} />
      <QuestBoard s={s} />
      {body}
      <Crew
        host={host}
        s={s}
        mark={(p) => {
          if (READING.includes(s.phase) && !s.busy) return s.ready.includes(p.id) ? "ready ✓" : "";
          if (s.phase === "pitch") return s.pitches.some((x) => x.playerId === p.id) ? "plan in ✓" : "…";
          if (s.phase === "appeal") {
            const x = s.pitches.find((q) => q.playerId === p.id);
            return x?.verdict && !autoSucceeds(x.verdict.tier) && !x.auto && !x.appealed && !x.appeal ? "deciding…" : "✓";
          }
          if (s.phase === "roll") return s.revealed.includes(p.id) ? "" : "…";
          if (s.phase === "catch") return s.catchers.includes(p.id) ? "♥ can catch" : "";
          return "";
        }}
      />
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

/** The Final Roll, all together: arm, one shared "3, 2, 1, SHAKE!", every die in the air, one drumroll, one landing. */
function FinalRollView({ host, s }: { host: Stage; s: GameState }) {
  const f = s.final;
  const heroes = s.players.filter((p) => p.hero);
  const result = s.phase === "final_result";
  const stage = result ? "landed" : f?.stage ?? "arm";
  const now = useFastNow(stage === "count");
  const left = host.deadlineAt ? Math.max(0, host.deadlineAt - now) : 0;
  const beat = stage === "count" ? Math.max(1, Math.min(3, Math.ceil(left / 1000))) : 0;
  const shook = f?.shook ?? [];
  const shookCount = useRef(0);
  useEffect(() => {
    if (s.phase === "final_roll" && stage === "arm") sfx.heartbeat();
    if (stage === "shake") sfx.countBeat(true);
    if (stage === "tumble") sfx.drumroll(2100);
    if (stage === "landed" && !result) sfx.diceLand();
  }, [s.phase, stage, result]);
  useEffect(() => {
    if (beat) sfx.countBeat(false);
  }, [beat]);
  useEffect(() => {
    if (stage === "shake" && shook.length > shookCount.current) sfx.pop();
    shookCount.current = shook.length;
  }, [stage, shook.length]);
  useEffect(() => {
    if (result) {
      if (f?.ending === "TRIUMPHANT") sfx.fanfare();
      else if (f?.ending === "GRIM_BUT_HILARIOUS") sfx.sadTrombone();
      else sfx.stamp();
    }
  }, [result, f?.ending]);
  const big = stage === "count" ? String(beat) : stage === "shake" ? "SHAKE!" : "";
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8 relative">
      <h2 className="font-display text-6xl uppercase text-[var(--gilt-bright)] text-center">The Final Roll</h2>
      <div className="flex gap-10 flex-wrap justify-center">
        {heroes.map((p) => {
          const v = f?.dice[p.id];
          const inAir = (stage === "shake" || stage === "tumble") && shook.includes(p.id);
          const sub =
            stage === "arm"
              ? p.away
                ? "on autopilot"
                : f?.armed?.includes(p.id)
                ? "armed ✓"
                : "tap to arm…"
              : stage === "shake"
                ? inAir
                  ? "in the air!"
                  : "SHAKE!"
                : stage === "tumble" && f?.auto?.includes(p.id)
                  ? "rolled for them"
                  : "";
          return (
            <div key={p.id} className="flex flex-col items-center gap-2 w-52 text-center">
              <D20 value={inAir ? null : v ?? null} rolling={inAir} size={170} tone={f?.best === p.id && result ? "gold" : "ink"} label={p.hero!.name} />
              {sub && <span className="font-ui text-base text-[var(--gilt-bright)]">{sub}</span>}
              {s.finalMoves[p.id] && <p className="italic text-parchment/80 line-clamp-3">“{mask(s.finalMoves[p.id])}”</p>}
            </div>
          );
        })}
      </div>
      {result && f && (
        <div className="flex flex-col items-center gap-3 fade-in">
          {f.best && (
            <p className="font-ui text-3xl text-parchment tabular-nums">
              Best roll {f.dice[f.best]} + Hope {f.hopeBonus} = <b className="text-4xl">{f.total}</b>
            </p>
          )}
          <Stamp text={ENDING_LABEL[f.ending]} size="xl" tone={f.ending === "TRIUMPHANT" ? "gilt" : f.ending === "BITTERSWEET" ? "forest" : "crimson"} />
        </div>
      )}
      {!result && stage === "arm" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-heading text-4xl uppercase animate-pulse">Phones out. Tap to arm your die.</p>
          <p className="font-ui text-xl text-parchment/75">Then we all shake at once. Yell your battle cry on SHAKE.</p>
        </div>
      )}
      {!result && stage === "tumble" && <p className="font-heading text-4xl uppercase animate-pulse">Here it comes…</p>}
      {!result && big && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/55">
          <span
            key={big}
            className="ouar-stamp-slam font-display leading-none text-[var(--gilt-bright)] drop-shadow-[0_0_30px_rgba(255,46,126,0.8)]"
            style={{ fontSize: stage === "count" ? "16rem" : "12rem", ["--ouar-rot" as string]: stage === "count" ? "0deg" : "-4deg" }}
          >
            {big}
          </span>
          <p className="font-heading text-5xl uppercase text-parchment mt-4">
            {stage === "count" ? "Yell your battle cry on SHAKE!" : "Battle cry! Shake your phone!"}
          </p>
        </div>
      )}
    </div>
  );
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

function Epilogue({ s }: { s: GameState }) {
  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="page p-10 max-w-5xl">
        {s.busy || !s.epilogue ? (
          <div className="flex flex-col items-center gap-3"><Hourglass size={64} /><p className="font-heading text-xl">{s.busy}</p></div>
        ) : (
          <TypeReveal text={s.epilogue} className="text-[2rem] leading-snug" />
        )}
      </div>
    </div>
  );
}

function Reveal({ host, s }: { host: Stage; s: GameState }) {
  const rs = host.realStory;
  const seed = host.questSeed;
  const [qr, setQr] = useState("");
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (rs?.link) QRCode.toDataURL(rs.link, { margin: 1, width: 220 }).then(setQr);
    sfx.whoosh();
  }, [rs?.link]);
  useEffect(() => {
    if (!rs) return;
    setTyped(0);
    const iv = setInterval(() => {
      setTyped((n) => {
        if (n >= rs.headline.length) {
          clearInterval(iv);
          return n;
        }
        if (n % 3 === 0) sfx.tick();
        return n + 1;
      });
    }, 45);
    return () => clearInterval(iv);
  }, [rs]);
  if (!rs || !seed) return null;
  return (
    <div className="flex-1 flex items-center justify-center px-8 pb-4">
      <div className="max-w-5xl w-full bg-[#f7f5ef] text-[#151515] p-10 shadow-2xl rotate-[-0.6deg] fade-in" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <p className="uppercase tracking-[0.3em] text-sm text-[#555] border-b border-[#bbb] pb-2">The official story</p>
        <h2 className="text-5xl font-bold leading-tight mt-4 min-h-[2.4em]">
          {rs.headline.slice(0, typed)}
          <span className="animate-pulse">{typed < rs.headline.length ? "▍" : ""}</span>
        </h2>
        <p className="mt-2 text-[#555]" style={{ fontFamily: "var(--font-ui), monospace" }}>
          {rs.source} · {rs.date}
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-8 mt-6">
          <div className="flex flex-col gap-3 text-xl leading-snug">
            <p>{rs.summary}</p>
            <p className="uppercase tracking-wider text-base text-[#777] mt-2" style={{ fontFamily: "var(--font-ui), monospace" }}>What your group uncovered</p>
            <p>
              <b>{seed.the_threat.name}</b> → {seed.the_threat.mapped_from}
            </p>
            <p>
              <b>Your goal</b> → {seed.the_goal.mapped_from}
            </p>
            {s.solvedBy && <p className="font-bold text-2xl mt-2">{s.solvedBy}</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <div className="flex flex-col items-center gap-2"><img src={qr} alt="QR code to the real article" className="w-44 h-44" /><span className="text-sm text-[#555]">Read the real story</span></div>}
        </div>
      </div>
    </div>
  );
}

function StorybookView({ host, s }: { host: Stage; s: GameState }) {
  const [page, setPage] = useState(0);
  const book = s.storybook;
  if (!book || s.busy) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3"><Hourglass size={72} /><p className="font-heading text-2xl">{s.busy || "Putting your story together…"}</p></div>
    );
  }
  const pages = book.pages;
  const total = pages.length + 3; // cover, pages, crew, the end, how this story was made
  const imgIndex = (ref: string) => Math.max(0, Number(String(ref).replace("scene_", "")) - 1);
  const said = (id: string) => s.mirror.find((c) => c.wardId === id)?.sentence ?? "";
  const quotes = s.log
    .filter((l) => l.band === "LEGENDARY" || l.band === "SUCCESS" || l.band === "CATASTROPHE")
    .filter((l, i, all) => all.findIndex((x) => x.pitch === l.pitch) === i)
    .slice(0, 4);
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 px-8 pb-4">
      <div className={`flex-1 min-h-0 page p-8 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-8 items-center ${page === total ? "grid-rows-[minmax(0,1fr)]" : ""}`}>
        {page === 0 && (
          <>
            <SceneImage host={host} index={s.scenes.length - 1} />
            <div className="flex flex-col gap-4">
              <h2 className="font-display text-6xl leading-none uppercase">{book.title}</h2>
              <p className="italic text-2xl text-ink-soft">{book.dedication}</p>
              <p className="font-ui uppercase tracking-widest text-sm text-ink-soft">
                {s.partyName || "The Group"} · Chapter {loadShelf().filter((b) => b.party === (s.partyName || "The Group")).length || 1}
              </p>
            </div>
          </>
        )}
        {page > 0 && page <= pages.length && (
          <>
            <SceneImage host={host} index={imgIndex(pages[page - 1].image_ref)} />
            <TypeReveal key={page} text={mask(pages[page - 1].text)} className="text-[1.8rem] leading-snug" />
          </>
        )}
        {page === pages.length + 1 && (
          <div className="col-span-2 flex flex-col gap-4 overflow-auto">
            <h2 className="font-heading text-4xl uppercase">The crew</h2>
            <div className="grid grid-cols-2 gap-4">
              {book.hero_pages.map((hp) => {
                const p = s.players.find((x) => x.id === hp.hero_id);
                if (!p?.hero) return null;
                return (
                  <div key={hp.hero_id} className="flex gap-3 items-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {host.portraits[p.id] && <img src={host.portraits[p.id]} alt="" className="portrait-oval w-20 h-24" />}
                    <div>
                      <p className="font-heading text-xl font-bold">{[p.hero.name, ...p.titles].join(", ")}</p>
                      <Stamp text={hp.award} size="sm" slam={false} tone="gilt" />
                      <p className="text-lg leading-snug mt-1">{hp.best_moment}</p>
                      {said(hp.hero_id) && (
                        <p className="text-lg leading-snug mt-1 italic">
                          <b className="not-italic font-ui text-sm uppercase tracking-widest text-[var(--crimson)]">Said about you:</b> {said(hp.hero_id)}
                        </p>
                      )}
                      {p.truth && (
                        <p className="text-lg leading-snug mt-1">
                          <b className="font-ui text-sm uppercase tracking-widest text-[var(--signal)]">Fun fact, really true:</b> {p.name} says “{mask(p.truth)}”
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {thankYouLines(s).length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-ui uppercase tracking-widest text-sm text-[var(--crimson)]">Thank-yous</p>
                {thankYouLines(s).map((t, i) => (
                  <p key={i} className="text-lg">❤️ {t}.</p>
                ))}
              </div>
            )}
            {quotes.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-ui uppercase tracking-widest text-sm text-ink-soft">In their own words</p>
                {quotes.map((l, i) => (
                  <p key={i} className="text-lg italic">
                    “{mask(l.pitch)}” — {l.hero}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {page === pages.length + 2 && (
          <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] gap-10 items-center">
          <div className="flex flex-col items-center gap-5 text-center">
            <p className="font-display text-6xl uppercase">The End</p>
            <p className="italic text-2xl">{book.moral}</p>
            {book.real_story_bridge && <p className="text-xl max-w-3xl">{book.real_story_bridge}</p>}
            <p className="font-ui text-ink-soft">Saved to {s.partyName || "your group"}’s shelf. Next chapter, same crew, whenever you’re ready.</p>
            {!host.readOnly && (
              <button className="btn btn-crimson text-xl" onClick={() => host.nextTale()}>
                Next chapter
              </button>
            )}
            <p className="font-ui text-sm text-ink-soft">One more page: how the AI made this story ▸</p>
          </div>
          <KeepsakeQR host={host} s={s} size={320} />
          </div>
        )}
        {page === pages.length + 3 && <HowThisWasMade s={s} />}
      </div>
      <div className="flex items-center justify-center gap-4">
        <button className="btn btn-ghost" disabled={page === 0} onClick={() => { setPage((p) => p - 1); sfx.pageTurn(); }}>◂ Back</button>
        <span className="font-ui tabular-nums">{page + 1} / {total + 1}</span>
        <button className="btn btn-gilt" disabled={page >= total} onClick={() => { setPage((p) => p + 1); sfx.pageTurn(); }}>Next page ▸</button>
      </div>
    </div>
  );
}

function QuestIntro({ host, s }: { host: Stage; s: GameState }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 px-8 pb-4">
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 items-center">
        <SceneImage host={host} index={0} />
        <div className="page p-8 flex flex-col gap-4">
          <p className="font-ui uppercase tracking-[0.25em] text-sm text-ink-soft">{s.quest?.realm}</p>
          <h2 className="font-display text-5xl leading-none uppercase">{s.quest?.title}</h2>
          <div className="gilt-rule" />
          <TypeReveal text={s.quest?.premise ?? ""} className="text-[1.7rem] leading-snug" />
          <p className="font-ui text-[var(--gilt-bright)] text-lg">The goal: {s.quest?.goalShort}</p>
          {Object.keys(s.wards).length > 0 && <p className="font-ui text-[var(--signal)] text-lg">🪞 Check your phone. Everyone has a secret mission tonight.</p>}
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
    case "lobby":
      main = <Lobby host={host} s={s} />;
      break;
    case "quest":
      main = <QuestIntro host={host} s={s} />;
      break;
    case "final_roll":
    case "final_result":
      main = <FinalRollView host={host} s={s} />;
      break;
    case "mirror_write":
    case "mirror_guess":
      main = <MirrorWait host={host} s={s} />;
      break;
    case "mirror_reveal":
      main = <MirrorRevealCard host={host} s={s} />;
      break;
    case "epilogue":
      main = <Epilogue s={s} />;
      break;
    case "reveal":
      main = <Reveal host={host} s={s} />;
      break;
    case "storybook":
      main = <StorybookView host={host} s={s} />;
      break;
    default:
      main = <RoundStage host={host} s={s} />;
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
