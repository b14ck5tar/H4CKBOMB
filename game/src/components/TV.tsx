"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { GameHost, loadShelf, type ShelfBook } from "@/lib/host";
import { BAND_LABEL, ENDING_LABEL, ROLL_ANIM_MS, STAT_LABEL, stampText } from "@/lib/rules";
import { sfx } from "@/lib/sfx";
import type { GameState, Pitch, Player } from "@/lib/types";
import { D20 } from "./D20";
import { Stamp, WaxSeal } from "./Stamp";
import { Reactions } from "./Reactions";
import { Hourglass, ScreenFlash, TypeReveal } from "./Effects";
import { HeroCard } from "./HeroCard";

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function useHost(host: GameHost) {
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
function Hope({ hope, max }: { hope: number; max: number }) {
  return (
    <span className="font-ui text-2xl tracking-wider" aria-label={`Hope ${hope} of ${max}`} title="Party Hope">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < hope ? "text-[var(--crimson)] drop-shadow" : "text-parchment/25"}>
          ♥
        </span>
      ))}
    </span>
  );
}

function TopBar({ host, s }: { host: GameHost; s: GameState }) {
  const now = useNow(!!host.deadlineAt);
  const left = host.deadlineAt ? Math.max(0, host.deadlineAt - now) : 0;
  const [muted, setMuted] = useState(false);
  return (
    <header className="flex items-center gap-6 px-8 py-3 font-ui text-parchment/90">
      <span className="font-display text-xl text-[var(--gilt-bright)]">Once Upon a Roll</span>
      {s.quest && <span className="font-heading truncate opacity-90">{s.quest.title}</span>}
      <span className="flex-1" />
      {s.phase !== "lobby" && <Hope hope={s.hope} max={s.hopeMax} />}
      {s.scenes.length > 0 && s.phase !== "lobby" && (
        <span className="flex gap-1.5" aria-label="Scene progress">
          {s.scenes.map((_, i) => (
            <span key={i} className={`w-3 h-3 rotate-45 border border-[var(--gilt)] ${i < s.sceneIndex || (i === s.sceneIndex && s.phase !== "quest") ? "bg-[var(--gilt)]" : ""}`} />
          ))}
        </span>
      )}
      {left > 0 && <span className="tabular-nums font-bold text-xl w-12 text-right">{Math.ceil(left / 1000)}s</span>}
      {host.deadlineAt > 0 && ["quest", "narrating", "outcome", "final_result", "epilogue", "reveal"].includes(s.phase) && (
        <button className="btn btn-ghost !py-1 !px-3 text-sm" onClick={() => host.skip()}>
          Continue ▸
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
      <span className="tracking-[0.3em] font-heading">{s.code}</span>
    </header>
  );
}

function SceneImage({ host, index, className = "" }: { host: GameHost; index: number; className?: string }) {
  const url = host.sceneImages[index];
  return (
    <div className={`relative overflow-hidden rounded-lg bg-[#2a2f50] ${className}`} style={{ aspectRatio: "16 / 9" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover fade-in" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-parchment/70">
          <Hourglass size={56} />
          <span className="font-heading">The illustrator is painting…</span>
        </div>
      )}
    </div>
  );
}

function Seals({ s, mark }: { s: GameState; mark?: (p: Player) => string }) {
  return (
    <div className="flex gap-5 justify-center flex-wrap">
      {s.players
        .filter((p) => p.hero)
        .map((p) => {
          const m = mark?.(p) ?? "";
          return (
            <div key={p.id} className="flex flex-col items-center gap-1 w-28 text-center">
              <WaxSeal initials={initials(p.hero!.name)} color={p.color} size={56} pulse={m === "…"} />
              <span className="font-heading text-sm leading-tight text-parchment">{p.hero!.name.split(" ")[0]}</span>
              {m && <span className="font-ui text-xs text-[var(--gilt-bright)]">{m}</span>}
              {p.peril && <span className="font-ui text-xs font-bold text-[#ff8a8f]">IN PERIL</span>}
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
function Lobby({ host, s }: { host: GameHost; s: GameState }) {
  const [qr, setQr] = useState("");
  const [shelf, setShelf] = useState<ShelfBook[]>([]);
  const [joinUrl, setJoinUrl] = useState("");
  const known = useRef(new Set<string>());
  useEffect(() => {
    const url = `${location.origin}/play?code=${s.code}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#2A1E16", light: "#F4E9D0" } }).then(setQr);
    setShelf(loadShelf());
  }, [s.code]);
  useEffect(() => {
    s.players.forEach((p) => {
      if (!known.current.has(p.id)) {
        known.current.add(p.id);
        sfx.join();
      }
    });
  }, [s.players]);
  const ready = s.players.filter((p) => p.status === "ready").length;
  return (
    <div className="grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-8 px-8 pb-6 flex-1 min-h-0">
      <div className="page p-6 flex flex-col gap-4 items-center text-center overflow-auto">
        <p className="font-heading text-xl">Scan to join the party</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="QR code to join" className="w-60 h-60 rounded" />}
        <p className="font-ui text-ink-soft break-all text-sm">{joinUrl}</p>
        <p className="font-ui uppercase tracking-[0.2em] text-sm text-ink-soft">Room code</p>
        <p className="font-display text-6xl tracking-[0.2em]">{s.code}</p>
        <div className="gilt-rule w-full" />
        <label className="font-heading self-start" htmlFor="party">Party name</label>
        <input
          id="party"
          className="input"
          placeholder="The Cousins, Floor 3, The Night Owls…"
          value={s.partyName}
          onChange={(e) => host.setPartyName(e.target.value)}
        />
        {host.transportKind === "local" && (
          <p className="font-ui text-xs text-crimson">Local mode: phones on other devices can’t connect until Supabase keys are set.</p>
        )}
      </div>

      <div className="flex flex-col gap-5 min-h-0 overflow-auto pr-1">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl text-[var(--gilt-bright)]">The party ({ready} ready)</h2>
          {s.players.length === 0 && <p className="font-body text-xl text-parchment/80 italic">Waiting for heroes. Scan the code with your phone camera.</p>}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {s.players.map((p) =>
              p.hero ? (
                <HeroCard key={p.id} player={p} portrait={host.portraits[p.id]} />
              ) : (
                <div key={p.id} className="page p-4 flex items-center gap-3">
                  <WaxSeal initials={initials(p.name)} color={p.color} size={48} pulse />
                  <div>
                    <p className="font-heading font-bold">{p.name}</p>
                    <p className="italic text-ink-soft">{p.status === "building" ? "The scribes are inking a legend…" : "Dreaming up a hero…"}</p>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl text-[var(--gilt-bright)]">Tales from today’s news</h2>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {s.questOptions.map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  sfx.unlock();
                  sfx.pageTurn();
                  host.chooseQuest(q.id);
                }}
                className={`page p-4 text-left flex flex-col gap-1 transition ${s.questId === q.id ? "ring-4 ring-[var(--gilt-bright)] scale-[1.01]" : "opacity-90 hover:opacity-100"}`}
              >
                <span className="font-heading font-bold leading-tight">{q.title}</span>
                <span className="text-sm text-ink-soft leading-snug line-clamp-3">{q.teaser}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button className="btn btn-crimson text-2xl" disabled={!host.canBegin()} onClick={() => host.begin()}>
            Begin the tale
          </button>
          <span className="font-ui text-parchment/70">
            {!s.questId ? "Pick a tale." : ready === 0 ? "Waiting for at least one hero." : s.players.some((p) => p.status === "building") ? "Finishing hero cards…" : "Ready when you are."}
          </span>
        </div>

        {shelf.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-xl text-[var(--gilt-bright)]">The bookshelf</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {shelf.map((b, i) => (
                <div key={i} className="page p-2 w-44 shrink-0 flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {b.cover && <img src={b.cover} alt="" className="rounded w-full aspect-video object-cover" />}
                  <span className="font-heading text-sm font-bold leading-tight">{b.title}</span>
                  <span className="font-ui text-xs text-ink-soft">{b.party} · {b.date}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Always on screen during play, so anyone glancing at the TV knows the goal and the current problem. */
function QuestPanel({ s }: { s: GameState }) {
  const scene = s.scenes[s.sceneIndex];
  const now = s.rescue
    ? `Save ${s.players.find((p) => p.id === s.rescue!.victimId)?.hero?.name}: ${s.rescue.peril}`
    : s.situation || s.banner || scene?.location || "";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 font-ui">
      <div className="rounded-lg border border-[var(--gilt)]/50 bg-black/25 px-4 py-2">
        <span className="uppercase tracking-[0.2em] text-xs text-[var(--gilt-bright)]">The quest</span>
        <p className="text-lg leading-snug text-parchment line-clamp-2">{s.quest?.goal}</p>
      </div>
      <div className="rounded-lg border border-[var(--crimson)]/60 bg-black/25 px-4 py-2">
        <span className="uppercase tracking-[0.2em] text-xs text-[#ff9aa0]">
          Right now · Scene {s.sceneIndex + 1} of {s.scenes.length}
          {scene ? ` · ${scene.location}` : ""}
        </span>
        <p className="text-lg leading-snug text-parchment line-clamp-2">{now}</p>
      </div>
    </div>
  );
}

// ---------- scene phases ----------
function PitchWall({ s }: { s: GameState }) {
  const counts: Record<string, number> = {};
  Object.values(s.votes).forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
  const name = (p: Pitch) => s.players.find((x) => x.id === p.playerId)?.hero?.name ?? "";
  return (
    <div className="grid grid-cols-2 gap-4">
      {s.pitches.length >= 2 && (
        <div className="col-span-2 text-center font-heading text-xl text-[var(--gilt-bright)]">
          ⚔ Team up the top two: <span className="font-ui">{"●".repeat(counts.combo ?? 0) || "no votes yet"}</span>
        </div>
      )}
      {s.pitches.filter((p) => !p.partnerId).map((p, i) => (
        <div key={p.id} className="page p-4 flex flex-col gap-2 fade-in" style={{ animationDelay: `${i * 120}ms` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-heading font-bold">{name(p)}</span>
            <span className="font-ui text-xl" aria-label={`${counts[p.id] ?? 0} votes`}>
              {"●".repeat(counts[p.id] ?? 0)}
            </span>
          </div>
          <p className="text-xl leading-snug">“{p.text}”</p>
          {p.verdict && (
            <div className="flex items-center gap-3 flex-wrap">
              <Stamp
                text={stampText(p.verdict.tier)}
                size="sm"
                rotate={-4}
                tone={p.verdict.tier === "clever" ? "forest" : p.verdict.tier === "solid" ? "ink" : p.verdict.tier === "miracle" ? "gilt" : "crimson"}
              />
              <span className="italic text-ink-soft">{p.verdict.quip}</span>
            </div>
          )}
          {(p.useAbility || p.embraceFlaw) && (
            <span className="font-ui text-xs text-ink-soft">{[p.useAbility && "uses ability", p.embraceFlaw && "embraces flaw"].filter(Boolean).join(" · ")}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function RollView({ s }: { s: GameState }) {
  const roll = s.roll;
  const [settled, setSettled] = useState(false);
  const pitch = s.pitches.find((p) => p.id === s.winningPitchId);
  const roller = s.players.find((p) => p.id === s.rollerId);
  const partner = pitch?.partnerId ? s.players.find((p) => p.id === pitch.partnerId) : undefined;
  const who = partner ? `${roller?.hero?.name} & ${partner.hero?.name}` : roller?.hero?.name;
  useEffect(() => {
    if (!roll) return;
    setSettled(false);
    sfx.diceRoll(ROLL_ANIM_MS - 300);
    const t = setTimeout(() => {
      setSettled(true);
      sfx.diceLand();
      if (roll.band === "LEGENDARY") sfx.choir();
      else if (roll.band === "CATASTROPHE") sfx.recordScratch();
      else sfx.stamp();
    }, ROLL_ANIM_MS - 200);
    return () => clearTimeout(t);
  }, [roll]);
  const v = pitch?.verdict;
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {pitch && (
        <div className="page px-6 py-3 max-w-3xl">
          <p className="font-heading">{partner ? `⚔ Team Up! ${who} attempt:` : `${who} attempts:`}</p>
          <p className="text-2xl leading-snug">“{v?.interpretation || pitch.text}”</p>
        </div>
      )}
      <D20 value={roll ? roll.kept : null} rolling={!!roll && !settled} size={260} tone={roll?.band === "CATASTROPHE" && settled ? "crimson" : "gold"} label={roll?.rescuerId ? `Caught by ${s.players.find((p) => p.id === roll.rescuerId)?.hero?.name}!` : undefined} />
      {!roll && <p className="font-heading text-3xl text-[var(--gilt-bright)] animate-pulse">{who}, roll the die!</p>}
      {roll && settled && v && roller?.hero && (
        <div className="flex flex-col items-center gap-3 fade-in">
          <p className="font-ui text-2xl tabular-nums text-parchment">
            {roll.dice.length > 1 && <span className="opacity-70">({roll.advantage === "adv" ? "advantage" : "disadvantage"}: {roll.dice.join(" & ")}) </span>}
            {roll.kept} {fmt(roll.statBonus)} {STAT_LABEL[v.stat]} {fmt(roll.tierMod)} {v.tier} = <b className="text-3xl">{roll.total}</b>
          </p>
          <Stamp text={BAND_LABEL[roll.band]} size="xl" tone={roll.band === "LEGENDARY" ? "gilt" : roll.band === "SUCCESS" || roll.band === "YES_BUT" ? "forest" : "crimson"} />
          {pitch && !s.outcome && v && <p className="italic text-parchment/80">{roll.band === "FAIL" || roll.band === "CATASTROPHE" ? v.on_failure : v.on_success}</p>}
        </div>
      )}
    </div>
  );
}

function SceneStage({ host, s }: { host: GameHost; s: GameState }) {
  const scene = s.scenes[s.sceneIndex];
  const victim = s.rescue ? s.players.find((p) => p.id === s.rescue!.victimId) : undefined;
  const [flash, setFlash] = useState<{ kind: "legendary" | "catastrophe" | null; n: number }>({ kind: null, n: 0 });
  const lastOutcome = useRef<unknown>(null);

  useEffect(() => {
    if (s.phase === "outcome" && s.outcome && s.outcome !== lastOutcome.current) {
      lastOutcome.current = s.outcome;
      sfx.play(s.outcome.sfx);
      const b = s.roll?.band;
      if (b === "LEGENDARY" || b === "CATASTROPHE") setFlash((f) => ({ kind: b === "LEGENDARY" ? "legendary" : "catastrophe", n: f.n + 1 }));
    }
  }, [s.phase, s.outcome, s.roll]);

  useEffect(() => {
    if (s.phase === "narrating") sfx.pageTurn();
    if (s.phase === "vote" && !s.busy) sfx.stamp();
  }, [s.phase, s.busy]);

  let right: React.ReactNode = null;
  if (s.phase === "narrating") {
    right = s.busy ? (
      <div className="flex flex-col items-center gap-3 py-10"><Hourglass size={64} /><p className="font-heading">{s.busy}</p></div>
    ) : (
      <div className="flex flex-col gap-4">
        <TypeReveal text={s.narration} className="text-[1.65rem] leading-snug" />
        {s.npcLine?.speaker && s.npcLine?.line && (
          <p className="text-xl italic border-l-4 border-[var(--gilt)] pl-4">
            <b className="font-heading not-italic">{s.npcLine.speaker}:</b> “{s.npcLine.line}”
          </p>
        )}
      </div>
    );
  } else if (s.phase === "pitch") {
    right = (
      <div className="flex flex-col gap-4">
        {victim && <Stamp text="RESCUE ROUND" sub={`${victim.hero?.name}: ${s.rescue!.peril}`} size="md" />}
        <p className="font-heading text-3xl leading-snug">{s.situation}</p>
        <p className="text-xl text-ink-soft italic">Pitch your plan on your phone{victim ? `. ${victim.hero?.name} will pick their savior.` : "."}</p>
      </div>
    );
  } else if (s.phase === "outcome" && s.outcome) {
    right = (
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-4xl leading-tight">{s.outcome.headline}</h2>
        <TypeReveal text={s.outcome.narration} className="text-[1.6rem] leading-snug" />
      </div>
    );
  } else if (s.phase === "outcome") {
    right = <div className="flex flex-col items-center gap-3 py-10"><Hourglass size={64} /><p className="font-heading">{s.busy || "The Tale-Spinner is writing…"}</p></div>;
  }

  const fullStage = s.phase === "vote" || s.phase === "roll" || s.phase === "rolling" || s.phase === "catch";

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 px-8 pb-2">
      <ScreenFlash kind={flash.kind} trigger={flash.n} />
      <QuestPanel s={s} />
      {fullStage ? (
        <div className="flex-1 min-h-0 flex flex-col gap-5 justify-center overflow-auto">
          {s.phase === "vote" &&
            (s.busy ? (
              <div className="flex flex-col items-center gap-3"><Hourglass size={72} /><p className="font-heading text-2xl">{s.busy}</p></div>
            ) : (
              <>
                <p className="font-heading text-3xl text-center text-[var(--gilt-bright)]">
                  {victim ? `${victim.hero?.name}, choose your savior!` : "Vote for the plan on your phone!"}
                </p>
                <PitchWall s={s} />
              </>
            ))}
          {(s.phase === "roll" || s.phase === "rolling" || s.phase === "catch") && <RollView s={s} />}
          {s.phase === "catch" && (
            <p className="font-display text-4xl text-center text-[var(--gilt-bright)] animate-pulse">CATCH! A friend can spend their Heart to reroll!</p>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6 items-start">
          <div className="relative">
            <SceneImage host={host} index={s.sceneIndex} />
            {s.banner && (
              <div className="absolute left-4 bottom-4">
                <Stamp text={s.banner} size="md" rotate={-3} slam={false} />
              </div>
            )}
            {scene && <p className="mt-2 font-heading text-parchment/80">{scene.location}</p>}
          </div>
          <div className="page p-6 overflow-auto max-h-full">{right}</div>
        </div>
      )}
      <Seals
        s={s}
        mark={(p) => {
          if (s.phase === "pitch") {
            if (s.rescue?.victimId === p.id) return "awaiting rescue";
            return s.pitches.some((x) => x.playerId === p.id) ? "sealed ✓" : "…";
          }
          if (s.phase === "vote" && !s.busy) return s.votes[p.id] ? "voted ✓" : "";
          if (s.phase === "catch") return s.catchers.includes(p.id) ? "♥ can catch" : "";
          return "";
        }}
      />
    </div>
  );
}

function FinalRollView({ s }: { s: GameState }) {
  const f = s.final;
  const heroes = s.players.filter((p) => p.hero);
  const result = s.phase === "final_result";
  useEffect(() => {
    if (s.phase === "final_roll") sfx.heartbeat();
    if (result) {
      if (f?.ending === "TRIUMPHANT") sfx.fanfare();
      else if (f?.ending === "GRIM_BUT_HILARIOUS") sfx.sadTrombone();
      else sfx.stamp();
    }
  }, [s.phase, result, f?.ending]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
      <h2 className="font-display text-5xl text-[var(--gilt-bright)] text-center">The Final Roll</h2>
      {s.narration && s.phase === "final_roll" && <p className="text-2xl italic text-center max-w-4xl text-parchment/90">{s.narration}</p>}
      <div className="flex gap-10 flex-wrap justify-center">
        {heroes.map((p) => {
          const v = f?.dice[p.id];
          return <D20 key={p.id} value={v ?? null} rolling={!result && v === undefined} size={170} tone={f?.best === p.id && result ? "gold" : "ink"} label={p.hero!.name} />;
        })}
      </div>
      {result && f && (
        <div className="flex flex-col items-center gap-3 fade-in">
          {f.best && (
            <p className="font-ui text-3xl text-parchment tabular-nums">
              Best die {f.dice[f.best]} + Hope {f.hopeBonus} = <b className="text-4xl">{f.total}</b>
            </p>
          )}
          <Stamp text={ENDING_LABEL[f.ending]} size="xl" tone={f.ending === "TRIUMPHANT" ? "gilt" : f.ending === "BITTERSWEET" ? "forest" : "crimson"} />
        </div>
      )}
      {!result && <p className="font-heading text-2xl animate-pulse">Everyone, roll on your phone!</p>}
    </div>
  );
}

function Epilogue({ s }: { s: GameState }) {
  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="page p-10 max-w-4xl">
        {s.busy || !s.epilogue ? (
          <div className="flex flex-col items-center gap-3"><Hourglass size={64} /><p className="font-heading text-xl">{s.busy}</p></div>
        ) : (
          <TypeReveal text={s.epilogue} className="text-[1.8rem] leading-snug" />
        )}
      </div>
    </div>
  );
}

function Reveal({ host, s }: { host: GameHost; s: GameState }) {
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
        <p className="uppercase tracking-[0.3em] text-sm text-[#555] border-b border-[#bbb] pb-2">This tale was inspired by real events</p>
        <h2 className="text-5xl font-bold leading-tight mt-4 min-h-[2.4em]">
          {rs.headline.slice(0, typed)}
          <span className="animate-pulse">{typed < rs.headline.length ? "▍" : ""}</span>
        </h2>
        <p className="mt-2 text-[#555] font-ui">
          {rs.source} · {rs.date}
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-8 mt-6">
          <div className="flex flex-col gap-3 text-xl leading-snug">
            <p>{rs.summary}</p>
            <p className="font-ui text-base uppercase tracking-wider text-[#777] mt-2">How the tale was told</p>
            <p>
              <b>{seed.the_threat.name}</b> → {seed.the_threat.mapped_from}
            </p>
            <p>
              <b>The quest</b> → {seed.the_goal.mapped_from}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <div className="flex flex-col items-center gap-2"><img src={qr} alt="QR code to the real article" className="w-44 h-44" /><span className="font-ui text-sm text-[#555]">Read the real story</span></div>}
        </div>
      </div>
    </div>
  );
}

function StorybookView({ host, s }: { host: GameHost; s: GameState }) {
  const [page, setPage] = useState(0);
  const book = s.storybook;
  if (!book || s.busy) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3"><Hourglass size={72} /><p className="font-heading text-2xl">{s.busy || "Binding your storybook…"}</p></div>
    );
  }
  const pages = book.pages;
  const total = pages.length + 2; // + hero page + ending
  const imgIndex = (ref: string) => Math.max(0, Number(ref.replace("scene_", "")) - 1);
  const winning = s.log.filter((l) => l.band === "LEGENDARY" || l.band === "SUCCESS" || l.band === "CATASTROPHE").slice(0, 3);
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 px-8 pb-4">
      <div className="flex-1 min-h-0 page p-8 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-8 items-center">
        {page === 0 && (
          <>
            <SceneImage host={host} index={s.scenes.length - 1} />
            <div className="flex flex-col gap-4">
              <h2 className="font-display text-5xl leading-tight">{book.title}</h2>
              <p className="italic text-xl text-ink-soft">{book.dedication}</p>
              <p className="font-ui uppercase tracking-widest text-sm text-ink-soft">{s.partyName || "The Party"} · Chapter {loadShelf().filter((b) => b.party === (s.partyName || "The Party")).length || 1}</p>
            </div>
          </>
        )}
        {page > 0 && page <= pages.length && (
          <>
            <SceneImage host={host} index={imgIndex(pages[page - 1].image_ref)} />
            <TypeReveal key={page} text={pages[page - 1].text} className="text-[1.6rem] leading-snug" />
          </>
        )}
        {page === pages.length + 1 && (
          <div className="col-span-2 flex flex-col gap-4 overflow-auto">
            <h2 className="font-heading text-3xl">The Heroes</h2>
            <div className="grid grid-cols-2 gap-4">
              {book.hero_pages.map((hp) => {
                const p = s.players.find((x) => x.id === hp.hero_id);
                if (!p?.hero) return null;
                return (
                  <div key={hp.hero_id} className="flex gap-3 items-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {host.portraits[p.id] && <img src={host.portraits[p.id]} alt="" className="portrait-oval w-20 h-24" />}
                    <div>
                      <p className="font-heading font-bold">{[p.hero.name, ...p.titles].join(", ")}</p>
                      <Stamp text={hp.award} size="sm" slam={false} tone="gilt" />
                      <p className="text-lg leading-snug mt-1">{hp.best_moment}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {winning.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-ui uppercase tracking-widest text-sm text-ink-soft">In their own words</p>
                {winning.map((l, i) => (
                  <p key={i} className="text-lg italic">
                    “{l.pitch}” — {l.hero} ({BAND_LABEL[l.band].toLowerCase()})
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {page === pages.length + 2 && (
          <div className="col-span-2 flex flex-col items-center gap-5 text-center">
            <p className="font-display text-4xl">The End</p>
            <p className="italic text-2xl">Moral: {book.moral}</p>
            {book.real_story_bridge && <p className="text-xl max-w-3xl">{book.real_story_bridge}</p>}
            <p className="font-ui text-ink-soft">Saved to {s.partyName || "your party"}’s bookshelf. Chapter 2 unlocks next week.</p>
            <button className="btn btn-crimson text-xl" onClick={() => host.nextTale()}>
              Next chapter, same heroes
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-4">
        <button className="btn btn-ghost" disabled={page === 0} onClick={() => { setPage((p) => p - 1); sfx.pageTurn(); }}>◂ Back</button>
        <span className="font-ui tabular-nums">{page + 1} / {total + 1}</span>
        <button className="btn btn-gilt" disabled={page >= total} onClick={() => { setPage((p) => p + 1); sfx.pageTurn(); }}>Turn the page ▸</button>
      </div>
    </div>
  );
}

function QuestIntro({ host, s }: { host: GameHost; s: GameState }) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6 px-8 pb-4 items-center">
      <SceneImage host={host} index={0} />
      <div className="page p-8 flex flex-col gap-4">
        <p className="font-ui uppercase tracking-[0.25em] text-sm text-ink-soft">{s.quest?.realm}</p>
        <h2 className="font-display text-4xl leading-tight">{s.quest?.title}</h2>
        <div className="gilt-rule" />
        <TypeReveal text={s.quest?.premise ?? ""} className="text-[1.5rem] leading-snug" />
      </div>
    </div>
  );
}

// ---------- root ----------
export function TV({ host }: { host: GameHost }) {
  const s = useHost(host);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; color?: string }[]>([]);
  // 10-foot UI: scale every rem with the screen width so text stays readable from across a room.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.fontSize;
    root.style.fontSize = "clamp(16px, 1.3vw, 30px)";
    return () => {
      root.style.fontSize = prev;
    };
  }, []);
  // The game lives in this tab: warn before an accidental refresh or close wipes it mid-tale.
  const midGame = s.phase !== "lobby" && s.phase !== "storybook";
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
      main = <FinalRollView s={s} />;
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
      main = <SceneStage host={host} s={s} />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" onPointerDown={() => sfx.unlock()}>
      <TopBar host={host} s={s} />
      {main}
      <Footer />
      <Reactions items={reactions} />
    </div>
  );
}
