"use client";
/**
 * Quick Tale on the TV: one continuous, full-bleed "broadcast". The painted scene stays on screen the whole time
 * (Ken Burns drift, parallax motes, vignette) and crossfades between moments; each phase is an overlay on top.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type { Stage } from "./TV";
import { BAND_LABEL, ENDING_LABEL, autoSucceeds, isFailure, stampText } from "@/lib/rules";
import { coldOpenTimeline, quickArtIndex } from "@/lib/quick";
import { sfx } from "@/lib/sfx";
import type { GameState, Player, RollResult } from "@/lib/types";
import { D20 } from "./D20";
import { Stamp } from "./Stamp";
import { Hourglass, ScreenFlash, TypeReveal } from "./Effects";
import { Reactions } from "./Reactions";
import { Avatar, Hope, PartyDice, ThankHearts, useFastNow } from "./TV";
import { KeepsakeQR } from "./Keepsake";

const READING = ["quest", "narrating", "outcome", "epilogue", "reveal"];
type Mood = "push" | "scene" | "action" | "final" | "end";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** Milliseconds since this component mounted, ticking every `step` ms while `active`. */
function useElapsed(active = true, step = 40) {
  const start = useRef(0);
  const [t, setT] = useState(0);
  useEffect(() => {
    start.current = Date.now();
    setT(0);
    if (!active) return;
    const iv = setInterval(() => setT(Date.now() - start.current), step);
    return () => clearInterval(iv);
  }, [active, step]);
  return t;
}

function bandTone(b: RollResult["band"]): "gilt" | "forest" | "crimson" {
  return b === "LEGENDARY" ? "gilt" : isFailure(b) ? "crimson" : "forest";
}

// ---------- the painted world behind everything ----------
/** Deterministic little neon motes, drifting up at their own speeds: the parallax layer in front of the art. */
const MOTES = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    left: r(1) * 100,
    size: 2 + r(2) * 4,
    dur: 14 + r(3) * 18,
    delay: -r(4) * 30,
    sway: (r(5) - 0.5) * 80,
    color: ["#3DE7FF", "#FF2E7E", "#FFB648"][i % 3],
  };
});

function Backdrop({ url, mood }: { url?: string; mood: Mood }) {
  // Crossfade: every new picture is a new layer that fades in over the old one.
  const [layers, setLayers] = useState<{ url: string; id: number; anim: "push" | "drift" }[]>([]);
  const id = useRef(0);
  useEffect(() => {
    if (!url) return;
    setLayers((ls) => {
      if (ls[ls.length - 1]?.url === url) return ls;
      return [...ls.slice(-1), { url, id: ++id.current, anim: mood === "push" ? "push" : "drift" }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return (
    <div className="qt-bd" data-mood={mood} aria-hidden>
      <div className="qt-bd-zoom">
        {layers.map((l) => (
          <div key={l.id} className="qt-bd-layer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.url} alt="" className={`qt-bd-img qt-${l.anim}`} />
          </div>
        ))}
      </div>
      <div className="qt-halftone" />
      <div className="qt-motes">
        {MOTES.map((m, i) => (
          <span
            key={i}
            style={{
              left: `${m.left}%`,
              width: m.size,
              height: m.size,
              background: m.color,
              boxShadow: `0 0 ${m.size * 3}px ${m.color}`,
              animationDuration: `${m.dur}s`,
              animationDelay: `${m.delay}s`,
              ["--sway" as string]: `${m.sway}px`,
            }}
          />
        ))}
      </div>
      <div className="qt-shade" />
      <div className="qt-vignette" />
      <div className="qt-pulse" />
      <div className="qt-scan" />
    </div>
  );
}

// ---------- chrome ----------
function RunClock({ host }: { host: Stage }) {
  const now = useFastNow(!!host.startedAt && !host.endedAt);
  if (!host.startedAt) return null;
  const ms = (host.endedAt || now) - host.startedAt;
  const sec = Math.max(0, Math.floor(ms / 1000));
  return (
    <span className="font-ui tabular-nums text-lg text-parchment/70" title="Time since the tale started">
      {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
    </span>
  );
}

function QTopBar({ host, s, onNotes, notesOpen }: { host: Stage; s: GameState; onNotes?: () => void; notesOpen?: boolean }) {
  const now = useFastNow(!!host.deadlineAt);
  const left = host.deadlineAt ? Math.max(0, host.deadlineAt - now) : 0;
  const reading = READING.includes(s.phase) || s.phase === "final_result";
  const [muted, setMuted] = useState(false);
  return (
    <header className="qt-top">
      <span className="font-display text-xl text-[var(--gilt-bright)] uppercase tracking-wide">Group Project</span>
      <span className="on-air">Quick Tale</span>
      {s.quest && <span className="font-heading text-xl uppercase truncate text-parchment/85">{s.quest.title}</span>}
      <span className="flex-1" />
      <Hope hope={s.hope} max={s.hopeMax} />
      {left > 0 && !reading && <span className="qt-secs tabular-nums">{Math.ceil(left / 1000)}</span>}
      {host.deadlineAt > 0 && reading && !host.readOnly && (
        <button className="btn btn-ghost !py-1 !px-4 text-base" onClick={() => host.skip()} title="Spacebar works too">
          Continue ▸
        </button>
      )}
      <RunClock host={host} />
      {onNotes && !host.readOnly && (
        <button
          className={`btn btn-ghost !py-1 !px-3 text-sm ${notesOpen ? "ring-2 ring-[var(--crimson)]" : ""}`}
          onClick={onNotes}
          title="What the AI is doing, and why (press N)"
          aria-pressed={!!notesOpen}
        >
          DM&apos;s Notes
        </button>
      )}
      <button
        className="btn btn-ghost !py-1 !px-3 text-sm"
        onClick={() => {
          sfx.setMuted(!muted);
          setMuted(!muted);
        }}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <span className="tracking-[0.3em] font-heading text-xl">{s.code}</span>
    </header>
  );
}

/** A thin neon fuse along the top for timed phases: it burns down with the clock. */
function Fuse({ host, phase }: { host: Stage; phase: string }) {
  const now = useFastNow(!!host.deadlineAt);
  const total = useRef({ phase: "", ms: 1 });
  const left = host.deadlineAt ? Math.max(0, host.deadlineAt - now) : 0;
  if (total.current.phase !== phase && left > 0) total.current = { phase, ms: left };
  if (!left) return null;
  const pct = Math.min(100, (left / total.current.ms) * 100);
  return (
    <div className="qt-fuse" aria-hidden>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- 1. cold open ----------
function ColdOpen({ host, s }: { host: Stage; s: GameState }) {
  const rs = host.realStory;
  const headline = rs?.headline ?? "";
  const tl = useMemo(() => coldOpenTimeline(headline), [headline]);
  const reduced = usePrefersReducedMotion();
  const t = useElapsed(true, 30);
  const typed = reduced ? headline.length : Math.max(0, Math.min(headline.length, Math.floor((t - tl.typeStart) / tl.charMs)));
  const title = t >= tl.titleAt;
  const lastTick = useRef(0);
  useEffect(() => {
    if (title || typed <= 0 || typed >= headline.length) return;
    if (typed - lastTick.current >= 3) {
      lastTick.current = typed;
      sfx.tick();
    }
  }, [typed, title, headline.length]);
  useEffect(() => {
    sfx.whoosh();
  }, []);
  useEffect(() => {
    if (title) {
      sfx.stamp();
      sfx.choir();
    }
  }, [title]);
  return (
    <div className="qt-stage qt-cold">
      <div className="qt-letterbox top" />
      <div className="qt-letterbox bottom" />
      {!title && (
        <div className="qt-chyron" style={{ opacity: t > tl.fadeIn ? 1 : 0 }}>
          <div className="flex items-center gap-4">
            <span className="on-air !text-base">Real news</span>
            <span className="font-ui uppercase tracking-[0.25em] text-lg text-parchment/85">
              {rs?.source} · {rs?.date}
            </span>
          </div>
          <h1 className="qt-headline">
            {headline.slice(0, typed)}
            <span className={`qt-caret ${typed >= headline.length ? "qt-caret-blink" : ""}`} />
          </h1>
        </div>
      )}
      {title && (
        <div className="qt-titlecard">
          <div className="qt-flash" />
          <p className="font-ui uppercase tracking-[0.5em] text-xl text-[var(--signal)] qt-rise" style={{ animationDelay: "0.35s" }}>
            Tonight we find out why
          </p>
          <h1 className="qt-title">{s.quest?.title}</h1>
          <div className="qt-title-rule qt-rise" style={{ animationDelay: "0.7s" }} />
          <p className="font-heading uppercase text-3xl tracking-[0.2em] text-parchment/90 qt-rise" style={{ animationDelay: "0.9s" }}>
            {s.quest?.realm}
          </p>
          <p className="font-ui uppercase tracking-[0.3em] text-base text-parchment/60 qt-rise" style={{ animationDelay: "1.2s" }}>
            A quick tale · about three minutes
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- 2. the scene ----------
function Scene({ s }: { s: GameState }) {
  const scene = s.scenes[s.sceneIndex];
  return (
    <div className="qt-stage">
      <div className="qt-scene-top qt-rise">
        <p className="kicker !text-parchment/80 !text-base">{scene?.location}</p>
        {s.banner && !s.busy && (
          <div className="mt-3">
            <Stamp text={s.banner} size="md" rotate={-4} />
          </div>
        )}
      </div>
      <div className="qt-lower">
        {s.busy ? (
          <div className="flex items-center gap-5">
            <Hourglass size={64} />
            <p className="font-heading text-3xl uppercase text-parchment/90">{s.busy}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 max-w-[68rem]">
            <TypeReveal text={s.narration} className="qt-narration" />
            {s.npcLine?.speaker && s.npcLine?.line && (
              <p className="text-[1.9rem] leading-snug border-l-4 border-[var(--crimson)] pl-5 qt-rise" style={{ animationDelay: "2.4s" }}>
                <b className="font-heading uppercase text-[var(--crimson)]">{s.npcLine.speaker}:</b> “{s.npcLine.line}”
              </p>
            )}
            <p className="qt-cluehint qt-rise" style={{ animationDelay: "3.2s" }}>
              <span className="qt-phone" aria-hidden>▯</span> Check your phone. Only you noticed something. Say it out loud.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 3. plans + Convince the DM ----------
function PlanSlot({ host, s, p }: { host: Stage; s: GameState; p: Player }) {
  const pitch = s.pitches.find((x) => x.playerId === p.id);
  const boosts = Object.values(s.boosts).filter((id) => id === pitch?.id).length;
  if (!pitch)
    return (
      <div className="qt-glass qt-plan opacity-70">
        <div className="flex items-center gap-3">
          <Avatar host={host} p={p} size={52} />
          <span className="font-heading text-2xl uppercase">{p.hero?.name}</span>
        </div>
        <p className="qt-typing" aria-label="typing">
          <span />
          <span />
          <span />
        </p>
      </div>
    );
  const v = pitch.verdict;
  return (
    <div className="qt-glass qt-plan qt-pop" style={{ ["--pc" as string]: p.color }}>
      <div className="flex items-center gap-3">
        <Avatar host={host} p={p} size={52} />
        <span className="font-heading text-2xl uppercase flex-1">{p.hero?.name}</span>
        {boosts > 0 && <span className="text-2xl">{"🔥".repeat(boosts)}</span>}
      </div>
      <p className="text-[1.6rem] leading-snug">“{pitch.text}”</p>
      {pitch.appeal && <p className="text-xl italic text-[var(--signal)]">Argued: “{pitch.appeal}”</p>}
      {v ? (
        <div className="flex items-center gap-3 flex-wrap">
          <Stamp
            key={v.tier + (pitch.appealed ? "a" : "")}
            text={stampText(v.tier)}
            size="md"
            rotate={-3}
            tone={autoSucceeds(v.tier) ? "forest" : v.tier === "solid" ? "ink" : v.tier === "miracle" ? "gilt" : "crimson"}
          />
          <span className="italic text-xl text-parchment/80">{v.quip}</span>
        </div>
      ) : (
        <span className="font-ui text-base text-parchment/60 animate-pulse">The DM is reading it…</span>
      )}
    </div>
  );
}

function Plans({ host, s }: { host: Stage; s: GameState }) {
  const heroes = s.players.filter((p) => p.hero);
  const appeal = s.phase === "appeal";
  return (
    <div className="qt-stage qt-center">
      <div className="text-center flex flex-col gap-2 qt-rise">
        <p className="qt-pill !text-[var(--signal)]">{appeal ? "One shot" : "Everyone, at once"}</p>
        <h2 className="qt-question">{appeal ? "Convince the DM" : s.situation || "What do you do?"}</h2>
        <p className="font-heading text-2xl uppercase text-parchment/80">
          {appeal ? "Not happy with your stamp? Argue your case on your phone." : "Type your plan on your phone. Talk it over out loud."}
        </p>
      </div>
      {s.busy && (
        <div className="flex items-center gap-4 justify-center">
          <Hourglass size={56} />
          <p className="font-heading text-2xl uppercase">{s.busy}</p>
        </div>
      )}
      <div className="qt-plans" style={{ gridTemplateColumns: `repeat(${Math.min(3, heroes.length)}, minmax(0, 1fr))` }}>
        {heroes.map((p) => (
          <PlanSlot key={p.id} host={host} s={s} p={p} />
        ))}
      </div>
    </div>
  );
}

// ---------- 4. dice ----------
function Dice({ host, s }: { host: Stage; s: GameState }) {
  return (
    <div className="qt-stage qt-center">
      <h2 className="qt-question text-center qt-rise">{s.phase === "catch" ? "Catch!" : "Everyone roll!"}</h2>
      <p className="font-heading text-2xl uppercase text-center text-parchment/80 -mt-4">
        {s.phase === "catch" ? "Spend your one heart to re-roll a friend's fail" : "Tap ROLL on your phone"}
      </p>
      <div className="qt-glass py-8 px-10">
        <PartyDice host={host} s={s} />
      </div>
    </div>
  );
}

// ---------- 5. one beat per hero ----------
function Beat({ host, s }: { host: Stage; s: GameState }) {
  const round = s.round;
  const [flash, setFlash] = useState<{ kind: "legendary" | "catastrophe" | null; n: number }>({ kind: null, n: 0 });
  const seen = useRef<unknown>(null);
  useEffect(() => {
    if (round && round !== seen.current) {
      seen.current = round;
      sfx.play(round.sfx);
      if (s.rolls.some((r) => r.band === "LEGENDARY")) setFlash((f) => ({ kind: "legendary", n: f.n + 1 }));
      else if (s.rolls.some((r) => r.band === "CATASTROPHE")) setFlash((f) => ({ kind: "catastrophe", n: f.n + 1 }));
    }
  }, [round, s.rolls]);
  useEffect(() => {
    if (round) sfx.pageTurn();
  }, [round, s.beatIndex]);
  if (!round || s.busy)
    return (
      <div className="qt-stage qt-center">
        <Hourglass size={80} />
        <p className="font-heading text-3xl uppercase">{s.busy || "The DM is writing it down…"}</p>
      </div>
    );
  const beat = round.beats[s.beatIndex];
  const pl = beat ? s.players.find((p) => p.id === beat.hero_id) : undefined;
  const roll = beat ? s.rolls.find((r) => r.playerId === beat.hero_id) : undefined;
  const pitch = beat ? s.pitches.find((p) => p.playerId === beat.hero_id) : undefined;
  return (
    <div className="qt-stage">
      <ScreenFlash kind={flash.kind} trigger={flash.n} />
      <div className="qt-scene-top qt-rise">
        <p className="kicker !text-parchment/80 !text-base">{round.headline}</p>
      </div>
      {beat && pl && (
        <div key={s.beatIndex} className="qt-lower qt-beat">
          <div className="qt-beat-portrait qt-pop" style={{ ["--pc" as string]: pl.color }}>
            {host.portraits[pl.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={host.portraits[pl.id]} alt="" />
            ) : (
              <Avatar host={host} p={pl} size={200} />
            )}
            {roll && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <Stamp text={roll.noRoll ? "THAT WORKS" : BAND_LABEL[roll.band]} sub={roll.noRoll ? "" : `rolled ${roll.kept}`} size="md" tone={bandTone(roll.band)} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 min-w-0">
            <p className="font-heading text-3xl uppercase" style={{ color: pl.color }}>
              {pl.hero?.name}
            </p>
            {pitch && <p className="text-2xl italic text-parchment/75">“{pitch.text}”</p>}
            <TypeReveal text={beat.text} className="qt-narration" />
            <p className="font-ui text-base text-parchment/55">
              {s.beatIndex + 1} of {round.beats.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 6. the Final Roll, all together ----------
function Final({ host, s }: { host: Stage; s: GameState }) {
  const f = s.final;
  const heroes = s.players.filter((p) => p.hero);
  const result = s.phase === "final_result";
  const stage = result ? "landed" : f?.stage ?? "arm";
  const now = useFastNow(stage === "count");
  const left = host.deadlineAt ? Math.max(0, host.deadlineAt - now) : 0;
  const beat = stage === "count" ? Math.max(1, Math.min(3, Math.ceil(left / 1000))) : 0;
  const shook = f?.shook ?? [];
  const shookCount = useRef(0);
  const [flash, setFlash] = useState<{ kind: "legendary" | "catastrophe" | null; n: number }>({ kind: null, n: 0 });
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
    if (!result) return;
    if (f?.ending === "TRIUMPHANT") {
      sfx.fanfare();
      setFlash((x) => ({ kind: "legendary", n: x.n + 1 }));
    } else if (f?.ending === "GRIM_BUT_HILARIOUS") {
      sfx.sadTrombone();
      setFlash((x) => ({ kind: "catastrophe", n: x.n + 1 }));
    } else sfx.stamp();
  }, [result, f?.ending]);
  const big = stage === "count" ? String(beat) : stage === "shake" ? "SHAKE!" : "";
  return (
    <div className="qt-stage qt-center">
      <ScreenFlash kind={flash.kind} trigger={flash.n} />
      <div className="text-center flex flex-col gap-1 qt-rise">
        <p className="qt-pill">Last roll · everyone at once</p>
        <h2 className="qt-final-title">The Final Roll</h2>
      </div>
      <div className="flex gap-12 flex-wrap justify-center items-end">
        {heroes.map((p) => {
          const v = f?.dice[p.id];
          const inAir = (stage === "shake" || stage === "tumble") && shook.includes(p.id);
          const best = result && f?.best === p.id;
          const sub =
            stage === "arm" ? (f?.armed?.includes(p.id) ? "armed ✓" : "tap to arm") : stage === "shake" ? (inAir ? "in the air!" : "SHAKE!") : stage === "tumble" && f?.auto?.includes(p.id) ? "rolled for them" : "";
          return (
            <div key={p.id} className={`flex flex-col items-center gap-2 w-56 text-center ${best ? "qt-best" : ""}`}>
              <D20 value={inAir ? null : v ?? null} rolling={inAir} size={170} tone={best ? "gold" : "ink"} />
              <div className="flex items-center gap-2">
                <Avatar host={host} p={p} size={40} />
                <span className="font-heading text-2xl uppercase">{p.hero!.name.split(" ")[0]}</span>
              </div>
              {sub && <span className="font-ui text-lg text-[var(--gilt-bright)]">{sub}</span>}
              {s.finalMoves[p.id] && <p className="italic text-lg text-parchment/75 line-clamp-2">“{s.finalMoves[p.id]}”</p>}
            </div>
          );
        })}
      </div>
      {result && f && (
        <div className="flex flex-col items-center gap-4 qt-pop">
          {f.best && (
            <p className="font-ui text-3xl text-parchment tabular-nums">
              Best roll {f.dice[f.best]} + Hope {f.hopeBonus} = <b className="text-5xl text-[var(--gilt-bright)]">{f.total}</b>
            </p>
          )}
          <Stamp text={ENDING_LABEL[f.ending]} size="xl" tone={f.ending === "TRIUMPHANT" ? "gilt" : f.ending === "BITTERSWEET" ? "forest" : "crimson"} />
        </div>
      )}
      {!result && stage === "arm" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-heading text-5xl uppercase qt-throb">Phones out. Tap to arm your die.</p>
          <p className="font-ui text-2xl text-parchment/75">Then we all shake at once. Yell your battle cry on SHAKE.</p>
        </div>
      )}
      {!result && stage === "tumble" && <p className="font-heading text-5xl uppercase qt-throb">Here it comes…</p>}
      {!result && big && (
        <div className="qt-count">
          <div key={big} className="qt-ring" />
          <span key={big + "n"} className="qt-count-n" style={{ fontSize: stage === "count" ? "18rem" : "12rem" }}>
            {big}
          </span>
          <p className="font-heading text-5xl uppercase text-parchment">{stage === "count" ? "Yell your battle cry on SHAKE!" : "Battle cry! Shake your phone!"}</p>
        </div>
      )}
    </div>
  );
}

// ---------- 7. the ending slot ----------
function EndingSlot({ s }: { s: GameState }) {
  return (
    <div className="qt-stage qt-center">
      <div className="qt-letterbox top" />
      <div className="qt-letterbox bottom" />
      {s.busy || !s.epilogue ? (
        <div className="flex items-center gap-4">
          <Hourglass size={64} />
          <p className="font-heading text-3xl uppercase">{s.busy}</p>
        </div>
      ) : (
        <div className="max-w-[62rem] flex flex-col gap-6 text-center">
          <p className="font-ui uppercase tracking-[0.4em] text-lg text-[var(--gilt-bright)]">How it ended</p>
          <TypeReveal text={s.epilogue} className="qt-epilogue" phraseMs={420} />
        </div>
      )}
    </div>
  );
}

// ---------- 8. the reveal: official story vs what you uncovered ----------
function RevealCard({ host, s }: { host: Stage; s: GameState }) {
  const rs = host.realStory;
  const seed = host.questSeed;
  const [qr, setQr] = useState("");
  const reduced = usePrefersReducedMotion();
  const t = useElapsed(true, 40);
  const typed = !rs ? 0 : reduced ? rs.headline.length : Math.max(0, Math.min(rs.headline.length, Math.floor((t - 600) / 32)));
  useEffect(() => {
    if (rs?.link) QRCode.toDataURL(rs.link, { margin: 1, width: 220, color: { dark: "#151515", light: "#f3efe4" } }).then(setQr);
    sfx.whoosh();
  }, [rs?.link]);
  if (!rs || !seed) return null;
  const quotes = s.pitches.slice(0, 4);
  const f = s.final;
  return (
    <div className="qt-stage qt-center">
      <div className="qt-reveal">
        <div className="qt-paper qt-slide-l">
          <p className="qt-paper-kicker">The official story</p>
          {/* The full headline holds the space (invisible) so typing never reflows the card. */}
          <h2 className="qt-paper-head" style={{ fontSize: rs.headline.length > 90 ? "1.85rem" : undefined }}>
            <span className="invisible">{rs.headline}</span>
            <span className="absolute inset-0">
              {rs.headline.slice(0, typed)}
              {typed < rs.headline.length && <span className="animate-pulse">▍</span>}
            </span>
          </h2>
          <p className="qt-paper-meta">
            {rs.source} · {rs.date}
          </p>
          <p className="text-[1.3rem] leading-snug mt-3 line-clamp-5">{rs.summary}</p>
          {qr && (
            <div className="flex items-center gap-3 mt-auto pt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code to the real article" className="w-28 h-28" />
              <span className="qt-paper-meta">Read the real story</span>
            </div>
          )}
        </div>
        <div className="qt-seam" aria-hidden>
          <span>vs</span>
        </div>
        <div className="qt-glass qt-uncovered qt-slide-r">
          <p className="font-ui uppercase tracking-[0.3em] text-lg text-[var(--signal)]">What your group uncovered</p>
          <h2 className="font-display text-6xl uppercase leading-none text-[var(--crimson)] qt-glow">{seed.the_threat.name}</h2>
          <p className="text-xl leading-snug text-parchment/80">
            <span className="font-ui uppercase tracking-widest text-sm text-parchment/60 block">Officially</span>
            {seed.the_threat.mapped_from}
          </p>
          <div className="flex flex-col gap-3 mt-2">
            {quotes.map((p) => {
              const pl = s.players.find((x) => x.id === p.playerId);
              if (!pl) return null;
              return (
                <div key={p.id} className="flex items-start gap-3">
                  <Avatar host={host} p={pl} size={44} />
                  <p className="text-xl leading-snug">
                    “{p.text}” <span className="font-heading uppercase text-lg" style={{ color: pl.color }}>{pl.hero?.name.split(" ")[0]}</span>
                  </p>
                </div>
              );
            })}
          </div>
          {f && (
            <div className="mt-auto pt-3">
              <Stamp text={ENDING_LABEL[f.ending]} size="md" rotate={-4} slam={false} tone={f.ending === "TRIUMPHANT" ? "gilt" : f.ending === "BITTERSWEET" ? "forest" : "crimson"} />
            </div>
          )}
        </div>
      </div>
      {s.solvedBy && (
        <p className="font-heading text-4xl uppercase text-[var(--gilt-bright)] text-center qt-rise" style={{ animationDelay: "1.6s" }}>
          {s.solvedBy}
        </p>
      )}
      <p className="font-heading text-2xl uppercase tracking-[0.2em] text-parchment/75 qt-rise" style={{ animationDelay: "2s" }}>
        This tale was inspired by real events
      </p>
    </div>
  );
}

// ---------- 9. the keepsake ----------
function Keepsake({ host, s }: { host: Stage; s: GameState }) {
  const book = s.storybook;
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!book) return;
    sfx.pageTurn();
    const iv = setInterval(() => setPage((p) => (p + 1) % book.pages.length), 9000);
    return () => clearInterval(iv);
  }, [book]);
  if (!book || s.busy)
    return (
      <div className="qt-stage qt-center">
        <Hourglass size={80} />
        <p className="font-heading text-3xl uppercase">{s.busy || "Binding your storybook…"}</p>
      </div>
    );
  const cover = host.sceneImages[2] ?? host.sceneImages[0];
  const pg = book.pages[page % book.pages.length];
  const pgImg = host.sceneImages[Math.max(0, Number(String(pg?.image_ref ?? "").replace("scene_", "")) - 1)] ?? cover;
  const told = host.startedAt && host.endedAt ? Math.round((host.endedAt - host.startedAt) / 1000) : 0;
  return (
    <div className="qt-stage qt-keep">
      <div className="qt-book qt-pop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover && <img src={cover} alt="" className="qt-book-art" />}
        <div className="qt-book-shade" />
        <div className="qt-book-sheen" />
        <div className="qt-book-text">
          <p className="font-ui uppercase tracking-[0.35em] text-sm text-[var(--gilt-bright)]">{s.partyName || "The Group"} · Chapter 1</p>
          <h2 className="font-display text-[3.6rem] leading-[0.95] uppercase qt-glow">{book.title}</h2>
          <p className="italic text-lg text-parchment/85 mt-auto">{book.dedication}</p>
        </div>
      </div>
      <div className="flex flex-col gap-5 min-w-0 qt-rise" style={{ animationDelay: "0.4s" }}>
        <div className="qt-glass qt-page">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {pgImg && <img key={page + "i"} src={pgImg} alt="" className="qt-page-img" />}
          <TypeReveal key={page} text={pg?.text ?? ""} className="text-[1.55rem] leading-snug" phraseMs={260} />
          <div className="flex gap-2 justify-center mt-1">
            {book.pages.map((_, i) => (
              <span key={i} className={`qt-dot ${i === page % book.pages.length ? "on" : ""}`} />
            ))}
          </div>
        </div>
        <div className="flex gap-6 flex-wrap">
          {book.hero_pages.map((hp) => {
            const p = s.players.find((x) => x.id === hp.hero_id);
            if (!p?.hero) return null;
            return (
              <div key={hp.hero_id} className="flex items-center gap-3">
                <Avatar host={host} p={p} size={64} />
                <div className="flex flex-col gap-1">
                  <span className="font-heading text-2xl uppercase leading-none">{p.hero.name}</span>
                  <Stamp text={hp.award} size="sm" slam={false} rotate={-2} tone="gilt" />
                </div>
              </div>
            );
          })}
        </div>
        <p className="italic text-2xl text-parchment/90">{book.moral}</p>
        <div className="flex items-center gap-5 flex-wrap">
          <p className="font-heading text-2xl uppercase text-[var(--signal)]">Your keepsake is on your phone.</p>
          <KeepsakeQR host={host} s={s} size={150} />
          {told > 0 && <p className="font-ui text-lg text-parchment/60">Told in {Math.floor(told / 60)}:{String(told % 60).padStart(2, "0")}</p>}
          <span className="flex-1" />
          {!host.readOnly && (
            <button className="btn btn-crimson text-xl" onClick={() => host.nextTale()}>
              Next chapter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- root ----------
function moodFor(s: GameState): Mood {
  if (s.phase === "quest") return "push";
  if (s.phase === "final_roll" || s.phase === "final_result") return "final";
  if (["pitch", "appeal", "roll", "catch"].includes(s.phase)) return "action";
  if (["epilogue", "reveal", "storybook"].includes(s.phase)) return "end";
  return "scene";
}

export function QuickTV({ host, s, onNotes, notesOpen }: { host: Stage; s: GameState; onNotes?: () => void; notesOpen?: boolean }) {
  const [reactions, setReactions] = useState<{ id: number; emoji: string; color?: string }[]>([]);
  useEffect(
    () =>
      host.onReaction((r) => {
        const color = host.getState().players.find((p) => p.id === r.pid)?.color;
        setReactions((rs) => [...rs.slice(-40), { id: r.id, emoji: r.emoji, color }]); // TV.tsx already plays the pop
      }),
    [host],
  );
  const mood = moodFor(s);
  const art = host.sceneImages[quickArtIndex(s.phase)] ?? host.sceneImages[2] ?? host.sceneImages[0];
  // One key per "shot": a new key plays the dip-to-dark transition and the enter animation.
  const shot = s.phase === "outcome" ? `outcome-${s.round ? "r" : "w"}` : s.phase === "appeal" ? "pitch" : s.phase === "catch" ? "roll" : s.phase === "final_result" ? "final_roll" : s.phase;

  let main: React.ReactNode;
  switch (s.phase) {
    case "quest":
      main = <ColdOpen host={host} s={s} />;
      break;
    case "narrating":
      main = <Scene s={s} />;
      break;
    case "pitch":
    case "appeal":
      main = <Plans host={host} s={s} />;
      break;
    case "roll":
    case "catch":
      main = <Dice host={host} s={s} />;
      break;
    case "outcome":
      main = <Beat host={host} s={s} />;
      break;
    case "final_roll":
    case "final_result":
      main = <Final host={host} s={s} />;
      break;
    case "epilogue":
      main = <EndingSlot s={s} />;
      break;
    case "reveal":
      main = <RevealCard host={host} s={s} />;
      break;
    case "storybook":
      main = <Keepsake host={host} s={s} />;
      break;
    default:
      // A phase Quick Tale doesn't use (an ending module someone plugged in later): keep the art, show the DM's status.
      main = (
        <div className="qt-stage qt-center">
          <Hourglass size={72} />
          <p className="font-heading text-3xl uppercase">{s.busy || "Eyes on your phones"}</p>
        </div>
      );
  }

  return (
    <div className="qt-root" onPointerDown={() => sfx.unlock()}>
      <Backdrop url={art} mood={mood} />
      <div key={shot} className="qt-dip" aria-hidden />
      {s.phase !== "quest" && <QTopBar host={host} s={s} onNotes={onNotes} notesOpen={notesOpen} />}
      {s.phase === "quest" && !host.readOnly && (
        <button className="qt-skip font-ui" onClick={() => host.skip()}>
          Skip ▸
        </button>
      )}
      {["pitch", "appeal", "roll", "catch"].includes(s.phase) && <Fuse host={host} phase={shot} />}
      <div key={shot + "-c"} className="qt-shot">
        {main}
      </div>
      <Reactions items={reactions} />
      <ThankHearts s={s} />
    </div>
  );
}

