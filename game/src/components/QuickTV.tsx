"use client";
/**
 * The story on the TV, for both Quick Tale and Full Story: one continuous, full-bleed "broadcast".
 * The painted scene stays on screen the whole time (Ken Burns drift, parallax motes, scrim) and crossfades when the
 * scene changes or the hero-painted version arrives. Each moment is one overlay with ONE "Now:" line.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type { Stage } from "./TV";
import { firstAction } from "@/lib/host";
import { BAND_LABEL, ENDING_LABEL, ROLL_ANIM_MS, STAT_LABEL, TIER_DC, TITLE_BEAT_MS, isFailure, lineMs, narrationLines, stampText } from "@/lib/rules";
import { coldOpenTimeline } from "@/lib/quick";
import { eligibleIds, heroFirst, nowText, plateFor, turnOwner, winnerPid, shortName } from "@/lib/now";
import { sfx } from "@/lib/sfx";
import { mask } from "@/lib/mask";
import type { GameState, Pitch, Player, RollResult, Tier } from "@/lib/types";
import { D20 } from "./D20";
import { Stamp } from "./Stamp";
import { ScreenFlash, TypeReveal, phraseCount } from "./Effects";
import { Reactions } from "./Reactions";
import { Avatar, Hope, ThankHearts, useFastNow } from "./TV";
import { KeepsakeQR } from "./Keepsake";
import { FEATURES } from "@/lib/features";
import { music, playSfx, useMusic } from "@/lib/sound";

const READING = ["quest", "narrating", "ruling", "outcome", "epilogue", "reveal"];
const SCENE_PHASES = ["narrating", "turn", "pitch", "vote", "ruling", "roll", "outcome"];
type Mood = "push" | "title" | "scene" | "action" | "final" | "end";
const fmt = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

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

/** "The giant squash weighs… The giant squash weighs…": a snippet that repeats itself, said once. */
function dedupeSentences(text: string) {
  const seen = new Set<string>();
  return (text ?? "")
    .split(/(?<=[.!?])\s+/)
    .filter((x) => {
      const k = x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(" ");
}

/** "What's happening now", minus anything that only says what we don't know. Empty = the line is left out. */
function knownNow(text?: string) {
  return (text ?? "")
    .split(/(?<=[.!?])\s+/)
    .filter((x) => x.trim() && !/(does not|doesn't|do not|don't|did not) (say|mention|state|specify|report)|no (information|details)|not (known|clear|stated|reported)|unclear|unknown|the (text|article|source|story) (says|does)/i.test(x))
    .join(" ")
    .trim();
}

/** "2026-10-23T21:46:39Z" -> "Oct 23, 2026". Anything unparseable is shown as it came. */
function niceDate(d?: string) {
  if (!d) return "";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return d;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function bandTone(b: RollResult["band"]): "gilt" | "forest" | "crimson" {
  return b === "LEGENDARY" ? "gilt" : isFailure(b) ? "crimson" : "forest";
}

function tierTone(t: Tier): "gilt" | "forest" | "crimson" | "ink" {
  return t === "clever" ? "forest" : t === "solid" ? "ink" : t === "miracle" ? "gilt" : "crimson";
}

/** A plan as the room sees it: the player's words, unless the DM had to steer it to a harmless version. */
function planText(p: Pitch) {
  return p.verdict && p.verdict.moderation !== "ok" ? p.verdict.interpretation : mask(p.text);
}

// ---------- the painted world behind everything ----------
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
  // Crossfade: every new picture is a new layer that fades in over the old one, once it has loaded (never a flash).
  const [layers, setLayers] = useState<{ url: string; id: number; anim: "push" | "drift" }[]>([]);
  const id = useRef(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const img = new Image();
    const add = () =>
      alive &&
      setLayers((ls) => {
        if (ls[ls.length - 1]?.url === url) return ls;
        return [...ls.slice(-1), { url, id: ++id.current, anim: mood === "push" ? "push" : "drift" }];
      });
    img.onload = add;
    img.onerror = add;
    img.src = url;
    return () => {
      alive = false;
    };
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
    <span className="font-ui tabular-nums text-lg text-parchment/50" title="Time since the tale started">
      <span className="text-xs uppercase tracking-[0.2em] mr-1.5">played</span>
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
      {s.mode === "quick" && <span className="on-air">Quick Tale</span>}
      {s.quest && s.phase !== "story_vote" && <span className="font-heading text-xl uppercase truncate text-parchment/85">{s.quest.title}</span>}
      <span className="flex-1" />
      {s.narrated && s.cast && <span className="font-ui text-sm uppercase tracking-[0.2em] text-parchment/50">Narrated by {s.cast.name}</span>}
      {FEATURES.hopeDisplay && <Hope hope={s.hope} max={s.hopeMax} />}
      {left > 0 && !reading && (
        <span className="flex items-baseline gap-1.5">
          <span className="qt-secs tabular-nums">{Math.ceil(left / 1000)}</span>
          <span className="font-ui text-xs uppercase tracking-[0.2em] text-parchment/50">sec left</span>
        </span>
      )}
      {host.deadlineAt > 0 && reading && !host.readOnly && (
        <button className="gp-tb" onClick={() => host.skip()} title="Spacebar works too">
          Skip ▸
        </button>
      )}
      <RunClock host={host} />
      {notesOpen && onNotes && (
        <button className="gp-tb on" onClick={onNotes}>
          Close notes
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

/** The scene's goal: on screen the whole scene, so nobody ever wonders what they're trying to do. */
function GoalBar({ s }: { s: GameState }) {
  if (!s.goal) return null;
  const now = s.nowGoal && s.nowGoal !== s.goal ? s.nowGoal : "";
  const turn = s.finale ? "Grand finale" : s.phase === "narrating" || !s.turnOrder.length ? "" : `Turn ${s.turnIndex + 1} of ${s.turnOrder.length}`;
  return (
    <>
      <div className="gp-goal-row">
        <div className="gp-goal" key={now || s.goal}>
          <span className="gp-goal-k">{[turn, now ? "Right now" : "The goal"].filter(Boolean).join(" · ")}</span>
          <span className="gp-goal-t">{now || s.goal}</span>
        </div>
      </div>
      {now && (
        <div className="gp-goal-corner" title="The story's goal">
          <span>The goal</span> {s.goal}
        </div>
      )}
    </>
  );
}

/** The ONE instruction on the TV right now. Phones show the same words. */
function NowBanner({ s }: { s: GameState }) {
  const text = nowText(s);
  if (!text || ["storybook", "reveal", "final_result"].includes(s.phase)) return null;
  return (
    <div className="gp-now" key={text}>
      <span className="gp-now-k">Now</span>
      <span className="gp-now-t">{text}</span>
    </div>
  );
}

/** Who has done the thing (typed a plan, backed one, armed): one avatar per hero, lit when done. */
function CrewRow({ host, s, done, label }: { host: Stage; s: GameState; done: (p: Player) => boolean; label?: string }) {
  const heroes = s.players.filter((p) => p.hero);
  const n = heroes.filter(done).length;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-6 justify-center">
        {heroes.map((p) => (
          <div key={p.id} className={`gp-crew ${done(p) ? "on" : ""}`} style={{ ["--pc" as string]: p.color }}>
            <Avatar host={host} p={p} size={64} />
            <span className="font-heading text-lg uppercase leading-none">{shortName(p.hero!.name)}</span>
            <span className="gp-crew-tick" aria-hidden>
              ✓
            </span>
          </div>
        ))}
      </div>
      {label && (
        <p className="font-ui uppercase tracking-[0.25em] text-base text-parchment/80 tabular-nums">
          {n} of {heroes.length} {label}
        </p>
      )}
    </div>
  );
}

// ---------- Our stories: everyone writes a small true story ----------
function StoryWrite({ host, s }: { host: Stage; s: GameState }) {
  return (
    <div className="qt-stage qt-center">
      <div className="text-center flex flex-col gap-3 qt-rise max-w-[70rem]">
        <p className="qt-pill !text-[var(--signal)]">Our stories</p>
        <h2 className="qt-question">Write a small true story</h2>
        <p className="text-[1.6rem] leading-snug text-parchment/85">
          Something that really happened to you: how it started, what happened, and how it really ended. The ending stays secret until the very end.
        </p>
      </div>
      <CrewRow host={host} s={s} done={(p) => s.written.includes(p.id)} label="stories in" />
    </div>
  );
}

// ---------- story vote (Full Story) ----------
function StoryVote({ host, s }: { host: Stage; s: GameState }) {
  return (
    <div className="qt-stage qt-center">
      <div className="text-center flex flex-col gap-2 qt-rise">
        <p className="qt-pill !text-[var(--signal)]">{s.source === "ours" ? "One of these really happened to someone here" : "Each quest hides a real story. You'll find out at the end"}</p>
        <h2 className="qt-question">{s.busy || "Which quest tonight?"}</h2>
      </div>
      <div className="grid grid-cols-3 gap-6 w-full max-w-[96rem]">
        {s.storyOptions.map((o, i) => {
          const voters = s.players.filter((p) => s.votes[p.id] === o.id);
          return (
            <div key={o.id} className="qt-glass p-7 flex flex-col gap-3 qt-pop" style={{ animationDelay: `${i * 120}ms` }}>
              {(o.art || host.optionArt(o.id)) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.art || host.optionArt(o.id)} alt="" className="w-full aspect-video object-cover rounded fade-in" />
              )}
              <span className="font-display text-5xl text-[var(--gilt-bright)] leading-none">{i + 1}</span>
              <h3 className="font-heading text-3xl uppercase leading-tight">{o.title}</h3>
              <p className="text-xl leading-snug text-parchment/80 line-clamp-3">{o.teaser}</p>
              <div className="flex gap-2 mt-auto min-h-[48px]">
                {voters.map((p) => (
                  <span key={p.id} className="qt-pop">
                    <Avatar host={host} p={p} size={48} />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- the opening ----------
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
      {title && <TitleCard s={s} kicker={s.cast ? `Tonight: ${s.cast.kind}` : "Tonight we find out why"} sub={s.cast ? `Painted in ${s.cast.artName}` : "A quick tale"} />}
    </div>
  );
}

function TitleCard({ s, kicker, sub }: { s: GameState; kicker: string; sub: string }) {
  useEffect(() => {
    if (s.mode === "full") {
      sfx.whoosh();
      sfx.stamp();
    }
  }, [s.mode]);
  return (
    <div className="qt-titlecard">
      <div className="qt-flash" />
      <p className="font-ui uppercase tracking-[0.5em] text-xl text-[var(--signal)] qt-rise" style={{ animationDelay: "0.35s" }}>
        {kicker}
      </p>
      <h1 className="qt-title">{s.quest?.title}</h1>
      <div className="qt-title-rule qt-rise" style={{ animationDelay: "0.7s" }} />
      {s.quest?.realm && (
        <p className="font-heading uppercase text-3xl tracking-[0.2em] text-parchment/90 qt-rise" style={{ animationDelay: "0.9s" }}>
          {s.quest.realm}
        </p>
      )}
      <p className="font-ui uppercase tracking-[0.3em] text-base text-parchment/60 qt-rise" style={{ animationDelay: "1.2s" }}>
        {sub}
      </p>
      <p className="font-ui uppercase tracking-[0.35em] text-sm text-[var(--signal)] qt-rise" style={{ animationDelay: "1.5s" }}>
        Your Dungeon Master: Muse
      </p>
    </div>
  );
}

// ---------- 1. the scene: the art alone, then narration line by line in a lower third ----------
function Narration({ s, onTitle }: { s: GameState; onTitle: (on: boolean) => void }) {
  const lines = useMemo(() => narrationLines(s.narration), [s.narration]);
  const npc = s.npcLine?.speaker && s.npcLine?.line ? s.npcLine : null;
  const all = npc ? [...lines, npc.line] : lines;
  // The same pacing the table's timer uses (lib/rules.ts), so the last line lands just before plans open.
  const voiceMs = s.voice?.ms ?? 0;
  const starts = useMemo(() => {
    if (voiceMs) {
      // In step with the narrator: each line appears when the voice reaches it (by share of characters).
      const total = all.reduce((n, l) => n + l.length, 0) || 1;
      let chars = 0;
      return all.map((l) => {
        const at = TITLE_BEAT_MS + Math.round((chars / total) * voiceMs);
        chars += l.length;
        return at;
      });
    }
    let t = TITLE_BEAT_MS + 600;
    return all.map((l) => {
      const at = t;
      t += lineMs(l);
      return at;
    });
  }, [all.join("|"), voiceMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const reduced = usePrefersReducedMotion();
  const t = useElapsed(true, 100);
  const shown = reduced ? all.length : starts.filter((at) => t >= at).length;
  const titleBeat = !reduced && t < TITLE_BEAT_MS;
  useEffect(() => onTitle(titleBeat), [titleBeat, onTitle]);
  const last = useRef(0);
  useEffect(() => {
    if (shown > last.current) sfx.tick();
    last.current = shown;
  }, [shown]);
  useEffect(() => {
    sfx.pageTurn();
  }, [s.sceneIndex]);
  if (titleBeat)
    return (
      <div className="qt-stage">
        <div className="gp-scene-title">
          <p className="font-ui uppercase tracking-[0.4em] text-lg text-[var(--gilt-bright)]">The story</p>
          <h2 className="qt-title !text-[6.5rem]">{s.sceneTitle}</h2>
        </div>
      </div>
    );
  // Like subtitles: the line being read, with the one before it dimmed above it. The upper art stays clear.
  const from = Math.max(0, Math.min(shown, lines.length) - 2);
  return (
    <div className="qt-stage">
      <div className="gp-lowerthird">
        <p className="kicker !text-[var(--gilt-bright)] !text-base">{s.sceneTitle}</p>
        {lines.slice(from, shown).map((l, k) => {
          const i = from + k;
          return (
            <p key={i} className={`qt-narration gp-line ${i < Math.min(shown, lines.length) - 1 ? "gp-line-old" : ""}`}>
              {l}
            </p>
          );
        })}
        {npc && shown > lines.length && (
          <p className="text-[2rem] leading-snug border-l-4 border-[var(--crimson)] pl-5 gp-line">
            <b className="font-heading uppercase text-[var(--crimson)]">{npc.speaker}:</b> “{npc.line}”
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- 2. a turn: the owner picks, everyone else suggests (ideas appear as they come in) ----------
function Turn({ host, s }: { host: Stage; s: GameState }) {
  const owner = s.players.find((p) => p.id === turnOwner(s));
  const ideas = Object.entries(s.ideas);
  const count = useRef(0);
  useEffect(() => {
    if (ideas.length > count.current) sfx.pop();
    count.current = ideas.length;
  }, [ideas.length]);
  useEffect(() => {
    sfx.whoosh();
  }, [s.turnIndex]);
  if (!owner) return null;
  const typing = s.typing.map((pid) => s.players.find((p) => p.id === pid)).filter((p): p is Player => !!p);
  return (
    <div className="qt-stage">
      <div className="gp-lowerthird !max-w-[110rem] !gap-4">
        <div className="flex items-center gap-5 qt-pop">
          <div className="gp-owner" style={{ ["--pc" as string]: owner.color }}>
            <Avatar host={host} p={owner} size={96} />
          </div>
          <h2 className="qt-question !text-[4rem]" style={{ color: owner.color }}>
            {shortName(owner.hero?.name)}&apos;s turn
          </h2>
        </div>
        <p className="qt-narration !text-[2rem] max-w-[80rem]">{s.situation}</p>
        <div className="flex gap-4 flex-wrap items-stretch min-h-[5.5rem]">
          {ideas.map(([pid, text]) => {
            const pl = s.players.find((p) => p.id === pid);
            if (!pl) return null;
            return (
              <div key={pid} className="qt-glass qt-plan qt-pop !py-3 max-w-[30rem]" style={{ ["--pc" as string]: pl.color }}>
                <div className="flex items-center gap-2">
                  <Avatar host={host} p={pl} size={32} />
                  <span className="font-heading text-lg uppercase">{shortName(pl.hero?.name)} suggests</span>
                </div>
                <p className="text-[1.35rem] leading-snug">“{mask(text)}”</p>
              </div>
            );
          })}
          <TypingLine s={s} players={typing} />
        </div>
      </div>
    </div>
  );
}

/** "Marvin is typing…": live, so a suggestion phase is never just a clock. */
function TypingLine({ s, players }: { s: GameState; players: Player[] }) {
  if (!players.length) return null;
  const names = players.map((p) => shortName(p.hero?.name)).join(", ");
  return (
    <p className="gp-typing self-center" key={players.map((p) => p.id).join(",")}>
      <span className="gp-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {names} {players.length > 1 ? "are" : "is"} typing{s.phase === "pitch" ? " a final move" : ""}…
    </p>
  );
}

// ---------- 2b. the grand finale: everyone types a final move ----------
function Planning({ host, s }: { host: Stage; s: GameState }) {
  const heroes = s.players.filter((p) => p.hero);
  const count = useRef(0);
  useEffect(() => {
    if (s.pitches.length > count.current) sfx.pop();
    count.current = s.pitches.length;
  }, [s.pitches.length]);
  return (
    <div className="qt-stage qt-center">
      <div className="text-center flex flex-col gap-3 qt-rise max-w-[70rem]">
        {s.finale && <p className="qt-pill !text-[var(--gilt-bright)]">The grand finale</p>}
        <h2 className="qt-question">{s.finale ? "What's the final move?" : "What do you do?"}</h2>
        <p className="text-[1.7rem] leading-snug text-parchment/85">{s.situation}</p>
      </div>
      <CrewRow host={host} s={s} done={(p) => s.pitches.some((x) => x.playerId === p.id)} label={heroes.length > 1 ? "plans in" : undefined} />
      <TypingLine s={s} players={s.typing.filter((pid) => !s.pitches.some((x) => x.playerId === pid)).map((pid) => s.players.find((p) => p.id === pid)).filter((p): p is Player => !!p)} />
    </div>
  );
}

// ---------- 3. back a friend's plan ----------
function Vote({ host, s }: { host: Stage; s: GameState }) {
  const el = eligibleIds(s);
  const cols = Math.min(s.pitches.length, s.pitches.length === 4 ? 2 : 3);
  return (
    <div className="qt-stage qt-center !gap-8">
      <h2 className="qt-question text-center qt-rise">Which final move?</h2>
      <div className="grid gap-5 w-full max-w-[100rem]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {s.pitches.map((p, i) => {
          const pl = s.players.find((x) => x.id === p.playerId);
          if (!pl) return null;
          const ok = el.has(p.id);
          return (
            <div key={p.id} className={`qt-glass qt-plan qt-pop ${ok ? "" : "opacity-45"}`} style={{ ["--pc" as string]: pl.color, animationDelay: `${i * 90}ms` }}>
              <div className="flex items-center gap-3">
                <Avatar host={host} p={pl} size={52} />
                <span className="font-heading text-2xl uppercase flex-1">{pl.hero?.name}</span>
                {!ok && <span className="font-ui text-sm uppercase tracking-widest text-parchment/70">hung back</span>}
              </div>
              <p className="text-[1.7rem] leading-snug">{p.auto ? "…" : p.verdict?.interpretation && !p.verdict.fallback ? p.verdict.interpretation : `“${planText(p)}”`}</p>
            </div>
          );
        })}
      </div>
      <CrewRow host={host} s={s} done={(p) => !!s.votes[p.id]} />
    </div>
  );
}

// ---------- 4. the ruling ----------
function Ruling({ host, s }: { host: Stage; s: GameState }) {
  const pitch = s.pitches.find((p) => p.id === s.winnerId);
  const pl = s.players.find((p) => p.id === pitch?.playerId);
  const v = pitch?.verdict;
  useEffect(() => {
    sfx.whoosh();
  }, []);
  useEffect(() => {
    if (v) sfx.stamp();
  }, [v]);
  if (!pitch || !pl) return null;
  const votes = Object.values(s.votes).filter((id) => id === pitch.id).length;
  const credit = pitch.creditId ? s.players.find((p) => p.id === pitch.creditId) : undefined;
  const need = s.rolls[0]?.need;
  return (
    <div className="qt-stage qt-center">
      <div className="qt-glass gp-card qt-pop" style={{ ["--pc" as string]: pl.color }}>
        <div className="flex items-center gap-4">
          <Avatar host={host} p={pl} size={88} />
          <div className="flex flex-col">
            <span className="font-ui uppercase tracking-[0.3em] text-base text-[var(--signal)]">
              {s.finale ? (votes > 0 ? `The final move · backed by ${votes}` : "The final move") : "The plan"}
            </span>
            <span className="font-heading text-4xl uppercase" style={{ color: pl.color }}>
              {pl.hero?.name}&apos;s plan
            </span>
          </div>
        </div>
        {/* What the DM actually judged: the one action, in plain words. */}
        <p className="text-[2.2rem] leading-snug">{v && v.interpretation && !v.fallback ? v.interpretation : `“${planText(pitch)}”`}</p>
        {firstAction(pitch.text).cut && <p className="font-ui text-base uppercase tracking-[0.2em] text-[var(--signal)] -mt-3">Only the first action counts</p>}
        {credit && (
          <p className="font-heading text-2xl uppercase -mt-2" style={{ color: credit.color }}>
            + {shortName(credit.hero?.name)}&apos;s idea · +1
          </p>
        )}
        <div className="min-h-[7.5rem] flex items-center gap-6">
          {v ? (
            <>
              <Stamp text={stampText(v.tier)} size="xl" rotate={-4} tone={tierTone(v.tier)} />
              <span className="flex-1" />
              {need ? <NeedBadge need={need} mods={modsOf(s.rolls[0])} /> : null}
            </>
          ) : (
            <p className="font-heading text-2xl uppercase text-parchment/70 qt-throb">The DM is reading the plan…</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- 5. the roll ----------
/** "Needs 12+": what the die has to show, shown before every roll so the room knows what it's cheering for. */
function NeedBadge({ need, mods }: { need: number; mods: number }) {
  const miracle = need > 20;
  return (
    <div className="gp-need gp-line">
      <span>Needs</span>
      <b>{miracle ? "a 20" : `${need}+`}</b>
      <i>{miracle ? "a perfect roll" : `d20 ${mods >= 0 ? "+" : "−"} ${Math.abs(mods)}`}</i>
    </div>
  );
}

const modsOf = (r?: RollResult) => (r ? r.statBonus + (r.bonus ?? 0) : 0);

function RollMath({ s, r }: { s: GameState; r: RollResult }) {
  const v = s.pitches.find((p) => p.playerId === r.playerId)?.verdict;
  return (
    <p className="font-ui text-3xl tabular-nums text-parchment gp-line">
      {r.kept} <span className="text-parchment/70">{fmt(r.statBonus)} {v ? STAT_LABEL[v.stat] : ""}</span>
      {r.bonus ? <span className="text-parchment/70"> +{r.bonus} {r.bonusWhy === "backed" ? "backed" : "idea"}</span> : null} = <b className="text-5xl text-[var(--gilt-bright)]">{r.total}</b>
      {v && <span className="text-parchment/60 text-2xl"> · {v.tier === "miracle" ? "needed a 20" : `needed ${TIER_DC[v.tier]}+`}</span>}
    </p>
  );
}

function Roll({ host, s }: { host: Stage; s: GameState }) {
  const r = s.rolls[0];
  const pl = s.players.find((p) => p.id === r?.playerId);
  const shown = !!r && s.revealed.includes(r.playerId);
  const [settled, setSettled] = useState(false);
  const [flash, setFlash] = useState<{ kind: "legendary" | "catastrophe" | null; n: number }>({ kind: null, n: 0 });
  useEffect(() => {
    if (!shown || !r) return;
    sfx.diceRoll(ROLL_ANIM_MS - 300);
    const t = setTimeout(() => {
      setSettled(true);
      sfx.diceLand();
      if (r.band === "LEGENDARY") {
        sfx.choir();
        setFlash((f) => ({ kind: "legendary", n: f.n + 1 }));
      } else if (r.band === "CATASTROPHE") {
        sfx.recordScratch();
        setFlash((f) => ({ kind: "catastrophe", n: f.n + 1 }));
      }
    }, ROLL_ANIM_MS - 200);
    return () => clearTimeout(t);
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r || !pl) return null;
  return (
    <div className="qt-stage qt-center !gap-6">
      <ScreenFlash kind={flash.kind} trigger={flash.n} />
      <D20 value={shown ? r.kept : null} rolling={shown && !settled} size={300} tone={settled && r.band === "CATASTROPHE" ? "crimson" : "gold"} />
      <div className="flex items-center gap-3">
        <Avatar host={host} p={pl} size={56} />
        <span className="font-heading text-3xl uppercase">{pl.hero?.name}</span>
      </div>
      <div className="min-h-[9rem] flex flex-col items-center gap-3 relative z-[70]">
        {settled ? (
          <>
            <RollMath s={s} r={r} />
            <Stamp text={BAND_LABEL[r.band]} size="lg" tone={bandTone(r.band)} />
          </>
        ) : (
          !shown && (
            <>
              {r.need ? <NeedBadge need={r.need} mods={modsOf(r)} /> : null}
              <p className="font-heading text-2xl uppercase text-parchment/80 qt-throb">Tap ROLL on your phone</p>
            </>
          )
        )}
      </div>
    </div>
  );
}

// ---------- 6. what happened ----------
function Outcome({ host, s }: { host: Stage; s: GameState }) {
  const r = s.rolls[0];
  const pl = s.players.find((p) => p.id === r?.playerId);
  useEffect(() => {
    if (s.outcome) sfx.pageTurn();
  }, [s.outcome]);
  if (!r || !pl) return null;
  return (
    <div className="qt-stage">
      <div className="gp-lowerthird">
        <div className="flex items-end gap-8">
          <div className="gp-out-portrait qt-pop" style={{ ["--pc" as string]: pl.color }}>
            {host.portraits[pl.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={host.portraits[pl.id]} alt="" />
            ) : (
              <Avatar host={host} p={pl} size={150} />
            )}
          </div>
          <div className="flex flex-col gap-3 min-w-0 flex-1">
            <Stamp text={BAND_LABEL[r.band]} sub={`rolled ${r.kept}`} size="md" tone={bandTone(r.band)} slam={false} rotate={-3} />
            {s.outcome ? (
              <TypeReveal text={s.outcome} className="qt-narration" phraseMs={s.voice ? Math.max(150, Math.round(s.voice.ms / phraseCount(s.outcome))) : 300} />
            ) : (
              <p className="font-heading text-3xl uppercase text-parchment/70 qt-throb">{s.busy || "…"}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 7. the Final Roll: everyone shakes, ONE shared die ----------
function Final({ host, s }: { host: Stage; s: GameState }) {
  const f = s.final;
  const result = s.phase === "final_result";
  const stage = result ? "landed" : f?.stage ?? "arm";
  const now = useFastNow(stage === "count");
  const left = host.deadlineAt ? Math.max(0, host.deadlineAt - now) : 0;
  const beat = stage === "count" ? Math.max(1, Math.min(3, Math.ceil(left / 1000))) : 0;
  const shook = f?.shook ?? [];
  const shookCount = useRef(0);
  const [flash, setFlash] = useState<{ kind: "legendary" | "catastrophe" | null; n: number }>({ kind: null, n: 0 });
  const w = winnerPid(s) || f?.best || "";
  const r = s.rolls[0];
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
  const value = stage === "landed" && f ? f.dice[w] ?? null : null;
  return (
    <div className="qt-stage qt-center !gap-6">
      <ScreenFlash kind={flash.kind} trigger={flash.n} />
      <div className="text-center flex flex-col gap-1 qt-rise">
        <p className="qt-pill">One die · everyone shakes · {heroFirst(s, w)}&apos;s plan</p>
        <h2 className="qt-final-title">The Final Roll</h2>
      </div>
      <D20 value={value} rolling={stage === "tumble" || (stage === "shake" && shook.length > 0)} size={280} tone="gold" />
      <div className="min-h-[8rem] flex flex-col items-center gap-3">
        {result && r && f ? (
          <>
            <RollMath s={s} r={r} />
            <Stamp text={ENDING_LABEL[f.ending]} size="xl" tone={f.ending === "TRIUMPHANT" ? "gilt" : f.ending === "BITTERSWEET" ? "forest" : "crimson"} />
          </>
        ) : (
          <div className="flex items-center gap-10">
            {r?.need ? <NeedBadge need={r.need} mods={modsOf(r)} /> : null}
            <CrewRow host={host} s={s} done={(p) => (stage === "arm" ? !!f?.armed?.includes(p.id) || !!p.away : shook.includes(p.id))} />
          </div>
        )}
      </div>
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

// ---------- 8. the ending ----------
function EndingSlot({ s }: { s: GameState }) {
  return (
    <div className="qt-stage qt-center">
      <div className="qt-letterbox top" />
      <div className="qt-letterbox bottom" />
      {s.epilogue ? (
        <div className="max-w-[64rem] flex flex-col gap-6 text-center">
          <p className="font-ui uppercase tracking-[0.4em] text-lg text-[var(--gilt-bright)]">How it ended</p>
          <TypeReveal text={s.epilogue} className="qt-epilogue" phraseMs={s.voice ? Math.max(150, Math.round(s.voice.ms / phraseCount(s.epilogue))) : 380} />
        </div>
      ) : (
        <p className="font-heading text-3xl uppercase text-parchment/70 qt-throb">{s.busy || "…"}</p>
      )}
    </div>
  );
}

// ---------- 9. the reveal: this really happened ----------
function RevealCard({ host, s }: { host: Stage; s: GameState }) {
  const rs = host.realStory;
  const seed = host.questSeed;
  const [qr, setQr] = useState("");
  const reduced = usePrefersReducedMotion();
  const t = useElapsed(true, 40);
  const typed = !rs ? 0 : reduced ? rs.headline.length : Math.max(0, Math.min(rs.headline.length, Math.floor((t - 600) / 32)));
  useEffect(() => {
    if (rs?.link && /^https?:/.test(rs.link)) QRCode.toDataURL(rs.link, { margin: 1, width: 220, color: { dark: "#151515", light: "#f3efe4" } }).then(setQr);
    sfx.whoosh();
  }, [rs?.link]);
  if (!rs || !seed) return null;
  const f = s.final;
  const personal = !!seed.author;
  return (
    <div className="qt-stage qt-center">
      <div className="qt-reveal">
        {personal ? (
          // Our stories: it really happened to someone at this table. Their real ending, finally.
          <div className="qt-paper qt-slide-l">
            <p className="qt-paper-kicker">This really happened to {seed.author!.name}</p>
            <h2 className="qt-paper-head">{rs.headline}</h2>
            <p className="text-[1.15rem] leading-snug mt-3 text-[#333] line-clamp-3">{seed.the_threat.mapped_from}</p>
            <p className="qt-paper-meta mt-4">How it really ended</p>
            <p className="text-[1.5rem] leading-snug mt-1 line-clamp-5">{rs.summary}</p>
          </div>
        ) : (
        <div className="qt-paper qt-slide-l">
          <p className="qt-paper-kicker">This really happened</p>
          <h2 className="qt-paper-head" style={{ fontSize: rs.headline.length > 90 ? "1.85rem" : undefined }}>
            <span className="invisible">{rs.headline}</span>
            <span className="absolute inset-0">
              {rs.headline.slice(0, typed)}
              {typed < rs.headline.length && <span className="animate-pulse">▍</span>}
            </span>
          </h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="qt-paper-meta flex-1">
              {rs.source} · {niceDate(rs.date)}
              <span className="block mt-1">Scan to read the real article</span>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt="QR code to the real article" className="w-24 h-24 shrink-0" /> : <div className="w-24 h-24 shrink-0" />}
          </div>
          <p className="text-[1.2rem] leading-snug mt-3 line-clamp-3">{dedupeSentences(rs.summary)}</p>
          {knownNow(rs.now) ? (
            <p className="text-[1.05rem] leading-snug mt-3 line-clamp-3">
              <b>What&apos;s happening now:</b> {knownNow(rs.now)}
            </p>
          ) : (
            <p className="text-[1rem] leading-snug mt-2 text-[#444] line-clamp-2">
              <b>Officially:</b> {seed.the_threat.mapped_from}
            </p>
          )}
        </div>
        )}
        <div className="qt-seam" aria-hidden>
          <span>vs</span>
        </div>
        <div className="qt-glass qt-uncovered qt-slide-r !justify-center">
          <p className="font-ui uppercase tracking-[0.3em] text-lg text-[var(--signal)]">Your version</p>
          <h2 className={`font-display uppercase leading-none text-[var(--crimson)] qt-glow ${seed.the_threat.name.length > 18 ? "text-[2.6rem]" : "text-5xl"}`}>{seed.the_threat.name}</h2>
          {(s.recap || s.epilogue) && <p className="text-[1.3rem] leading-snug qt-rise" style={{ animationDelay: "0.9s" }}>{s.recap || s.epilogue}</p>}
          {s.solvedBy && (
            <p className="font-heading text-[1.4rem] uppercase leading-tight text-[var(--gilt-bright)] qt-rise" style={{ animationDelay: "1.4s" }}>
              {s.solvedBy}
            </p>
          )}
          {f && (
            <div className="flex items-center gap-5 pt-2 qt-rise" style={{ animationDelay: "1.8s" }}>
              <Stamp text={ENDING_LABEL[f.ending]} size="md" rotate={-4} slam={false} tone={f.ending === "TRIUMPHANT" ? "gilt" : f.ending === "BITTERSWEET" ? "forest" : "crimson"} />
              {s.endingLine && !s.recap && <p className="text-lg italic leading-snug text-parchment/85">{s.endingLine}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- 10. the keepsake ----------
function Keepsake({ host, s, onNotes }: { host: Stage; s: GameState; onNotes?: () => void }) {
  const book = s.storybook;
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!book) return;
    sfx.pageTurn();
    if (book.pages.length < 2) return;
    const iv = setInterval(() => setPage((p) => (p + 1) % book.pages.length), 9000);
    return () => clearInterval(iv);
  }, [book]);
  if (!book)
    return (
      <div className="qt-stage qt-center">
        <p className="font-heading text-3xl uppercase text-parchment/70 qt-throb">{s.busy || "Binding your keepsake…"}</p>
      </div>
    );
  const cover = (s.artKey >= 0 ? host.sceneImages[s.artKey] : undefined) ?? host.sceneImages[2] ?? host.sceneImages[0];
  const pg = book.pages[page % book.pages.length];
  const told = host.startedAt && host.endedAt ? Math.round((host.endedAt - host.startedAt) / 1000) : 0;
  return (
    <div className="qt-stage qt-keep">
      <div className="qt-book qt-pop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover && <img src={cover} alt="" className="qt-book-art" />}
        <div className="qt-book-shade" />
        <div className="qt-book-sheen" />
        <div className="qt-book-text">
          <p className="font-ui uppercase tracking-[0.35em] text-sm text-[var(--gilt-bright)]">{s.partyName || "The Group"}</p>
          <h2 className="font-display text-[3.6rem] leading-[0.95] uppercase qt-glow">{book.title}</h2>
          <p className="italic text-lg text-parchment/85 mt-auto">{book.dedication}</p>
        </div>
      </div>
      <div className="flex flex-col gap-5 min-w-0 qt-rise" style={{ animationDelay: "0.4s" }}>
        <div className="qt-glass p-6">
          <TypeReveal key={page} text={mask(pg?.text ?? "")} className="text-[1.6rem] leading-snug" phraseMs={240} />
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
        <div className="flex items-start gap-6">
          <KeepsakeQR host={host} s={s} size={130} />
          <div className="flex flex-col gap-3 pt-10">
            <p className="italic text-2xl text-parchment/90">{book.moral}</p>
            {told > 0 && (
              <p className="font-ui text-lg text-parchment/60">
                Told in {Math.floor(told / 60)}:{String(told % 60).padStart(2, "0")}
              </p>
            )}
            {!host.readOnly && (
              <div className="flex items-center gap-4">
                <button className="btn btn-crimson text-xl whitespace-nowrap" onClick={() => host.nextTale()}>
                  Play another
                </button>
                {onNotes && (
                  <button className="gp-tb !opacity-80 !text-base" onClick={onNotes}>
                    How the AI decided ▸
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- root ----------
function moodFor(s: GameState, title: boolean): Mood {
  if (s.phase === "quest") return "push";
  if (s.phase === "narrating" && title) return "title";
  if (s.phase === "final_roll" || s.phase === "final_result") return "final";
  if (["vote", "ruling"].includes(s.phase)) return "action";
  if (["turn", "pitch", "roll"].includes(s.phase)) return "scene"; // keep the art bright while people type and roll
  if (["epilogue", "reveal", "storybook", "story_vote", "story_write"].includes(s.phase)) return "end";
  return "scene";
}

/** Plays the narrator's current line on the TV (respects mute). Text never waits for it. */
function useNarrator(host: Stage, s: GameState) {
  const id = s.voice?.id ?? 0;
  useEffect(() => {
    if (!id || !s.voice) return;
    const url = host.voiceUrl(id);
    if (!url) return;
    const audio = new Audio(url);
    audio.playbackRate = s.voice.rate || 1;
    (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    const unduck = music.duckWhile(audio); // the music dips under the narrator
    const t = setTimeout(() => {
      if (!sfx.muted()) audio.play().catch(() => {});
    }, s.voice.delay);
    return () => {
      clearTimeout(t);
      audio.pause();
      unduck();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}

/**
 * Something is always playing: the story's mood from the first scene to the end (the AI picks it with the narrator),
 * brighter at the final roll, softer for the reveal. Plus the house SFX for the big moments.
 */
function useStorySound(s: GameState) {
  const resolved = ["reveal", "storybook"].includes(s.phase);
  // Cues: the finale turns tense (kids keep their story's music, just louder), the reveal resolves warm.
  const mood =
    s.phase === "story_vote" || s.phase === "story_write"
      ? "lobby"
      : resolved
      ? "warm"
      : s.finale && s.rating !== "kids"
      ? "tense"
      : s.cast?.music || "mysterious";
  const intensity = s.phase === "final_roll" ? 0.8 : resolved ? 0.1 : s.finale ? 0.55 : 0.2;
  useMusic(mood, intensity);
  useEffect(() => {
    if (s.finale) music.swell(0.8, 3000);
  }, [s.finale]);
  useEffect(() => {
    if (resolved) music.swell(0.5, 2500);
  }, [resolved]);
  const turnKey = s.phase === "turn" ? s.turnIndex : -1;
  useEffect(() => {
    if (turnKey >= 0) playSfx("turnStart");
  }, [turnKey]);
  const r = s.rolls[0];
  const landed = (s.phase === "roll" && s.revealed.length > 0) || s.phase === "final_result";
  const band = landed ? r?.band : undefined;
  useEffect(() => {
    if (!band) return;
    const t = setTimeout(() => {
      if (band === "LEGENDARY") {
        playSfx("nat20");
        music.swell(1, 4000);
      } else if (band === "CATASTROPHE") playSfx("nat1");
      else if (band === "SUCCESS") playSfx("success");
      else if (band === "YES_BUT") playSfx("partial");
      else playSfx("fail");
    }, s.phase === "final_result" ? 0 : ROLL_ANIM_MS);
    return () => clearTimeout(t);
  }, [band, s.phase]);
  useEffect(() => {
    if (s.phase === "final_roll" && s.final?.stage === "shake") playSfx("finaleShake", { ms: 2000 });
    if (s.phase === "final_roll" && s.final?.stage === "landed") music.swell(1, 3500);
    if (s.phase === "reveal") playSfx("reveal");
    if (s.phase === "storybook") playSfx("keepsake");
  }, [s.phase, s.final?.stage]);
}

/** The last five seconds of any timer tick (TV). */
function useTimerTicks(host: Stage) {
  const now = useFastNow(!!host.deadlineAt);
  const left = host.deadlineAt ? Math.ceil(Math.max(0, host.deadlineAt - now) / 1000) : 0;
  useEffect(() => {
    if (left >= 1 && left <= 5) playSfx("timerTick", { index: left, final: left === 1 });
  }, [left]);
}

export function QuickTV({ host, s, onNotes, notesOpen }: { host: Stage; s: GameState; onNotes?: () => void; notesOpen?: boolean }) {
  useNarrator(host, s);
  useStorySound(s);
  useTimerTicks(host);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; color?: string }[]>([]);
  useEffect(
    () =>
      host.onReaction((r) => {
        const color = host.getState().players.find((p) => p.id === r.pid)?.color;
        setReactions((rs) => [...rs.slice(-40), { id: r.id, emoji: r.emoji, color }]); // TV.tsx already plays the pop
      }),
    [host],
  );
  // Preload every plate the moment the story is known, so a scene change never waits on a download.
  const plates = [0, 1, 2].map((i) => host.sceneImages[i] ?? "").join("|");
  useEffect(() => {
    plates.split("|").forEach((u) => {
      if (u && !u.startsWith("data:")) new Image().src = u;
    });
  }, [plates]);
  const [title, setTitle] = useState(false);
  const mood = moodFor(s, title && s.phase === "narrating");
  // The latest painting of what the heroes did, once there is one; before that, the (hero-painted) plate.
  const painted = s.artKey >= 0 ? host.sceneImages[s.artKey] : undefined;
  const art = s.phase === "story_vote" || s.phase === "story_write" ? undefined : painted ?? host.sceneImages[plateFor(s)] ?? host.sceneImages[0];
  // One key per "shot": a new key plays the dip-to-dark transition and the enter animation.
  const shot = s.phase === "final_result" ? "final_roll" : ["turn", "ruling", "roll", "outcome"].includes(s.phase) ? `${s.phase}-${s.turnIndex}-${s.finale}` : s.phase;

  let main: React.ReactNode;
  switch (s.phase) {
    case "story_write":
      main = <StoryWrite host={host} s={s} />;
      break;
    case "story_vote":
      main = <StoryVote host={host} s={s} />;
      break;
    case "quest":
      main =
        false ? (
          <ColdOpen host={host} s={s} />
        ) : (
          <div className="qt-stage qt-cold">
            <TitleCard s={s} kicker={s.cast ? `Tonight: ${s.cast.kind}` : "Tonight's story"} sub={s.cast ? `Painted in ${s.cast.artName}` : "\u00a0"} />
          </div>
        );
      break;
    case "narrating":
      main = <Narration s={s} onTitle={setTitle} />;
      break;
    case "turn":
      main = <Turn host={host} s={s} />;
      break;
    case "pitch":
      main = <Planning host={host} s={s} />;
      break;
    case "vote":
      main = <Vote host={host} s={s} />;
      break;
    case "ruling":
      main = <Ruling host={host} s={s} />;
      break;
    case "roll":
      main = <Roll host={host} s={s} />;
      break;
    case "outcome":
      main = <Outcome host={host} s={s} />;
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
      main = <Keepsake host={host} s={s} onNotes={onNotes} />;
      break;
    default:
      main = (
        <div className="qt-stage qt-center">
          <p className="font-heading text-3xl uppercase">{s.busy || "Eyes on your phones"}</p>
        </div>
      );
  }

  const inScene = SCENE_PHASES.includes(s.phase);
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
      {["story_write", "story_vote", "turn", "pitch", "vote", "roll"].includes(s.phase) && <Fuse host={host} phase={shot} />}
      <div key={shot + "-c"} className="qt-shot">
        {main}
      </div>
      {inScene && !(title && s.phase === "narrating") && <GoalBar s={s} />}
      {s.phase !== "quest" && !(title && s.phase === "narrating") && <NowBanner s={s} />}
      {s.paused && (
        <div className="gp-paused" role="status">
          <p className="font-heading text-5xl uppercase">Reconnecting phones…</p>
          <p className="font-ui text-xl text-parchment/80">The game is paused. It picks up the moment a phone is back.</p>
        </div>
      )}
      <Reactions items={reactions} />
      <ThankHearts s={s} />
    </div>
  );
}

/** Both modes play on the same stage now. */
export const StoryStage = QuickTV;
