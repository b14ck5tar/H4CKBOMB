"use client";
import { useEffect, useRef, useState } from "react";
import { useCountdown, usePhone } from "@/lib/usePhone";
import { BAND_LABEL, REACTIONS, autoSucceeds, isFailure, stampText } from "@/lib/rules";
import { sfx } from "@/lib/sfx";
import { HeroCard } from "./HeroCard";
import { MicButton } from "./MicButton";
import { Hourglass } from "./Effects";
import { Stamp } from "./Stamp";
import type { GameState, Hero, Player } from "@/lib/types";
import quickHeroes from "@/data/quickstart_heroes.json";

const EXAMPLES = [
  "a night-shift barista who can hear electricity",
  "a raccoon who works security at the mall",
  "a grandma who's been a ghost hunter since 1974",
  "a substitute teacher who is secretly a cryptid",
  "an influencer whose phone sees the future, badly",
];

const READING = ["quest", "narrating", "outcome", "mirror_reveal", "epilogue", "reveal"];
const PLAY_PHASES = ["narrating", "pitch", "appeal", "roll", "catch", "outcome", "final_roll", "final_result"];
const GUESSES = ["Probably nothing much", "Something about a mistake I made", "Something nice I did"];

function vibrate(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {}
}

type Send = (t: string, d?: Record<string, unknown>) => void;

function Shell({ children, me, portrait }: { children: React.ReactNode; me?: Player; portrait?: string }) {
  const [showCard, setShowCard] = useState(false);
  return (
    <main className="min-h-full flex flex-col gap-3 p-4 max-w-md mx-auto" onPointerDown={() => sfx.unlock()}>
      {me?.hero && (
        <button className="flex items-center gap-3 text-left font-ui text-parchment/90" onClick={() => setShowCard((s) => !s)}>
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="" className="w-11 h-11 rounded-full object-cover object-top" style={{ boxShadow: `0 0 0 2px ${me.color}` }} />
          ) : (
            <span className="w-11 h-11 rounded-full inline-block" style={{ background: me.color }} />
          )}
          <span className="flex-1 min-w-0">
            <span className="font-heading text-lg font-bold uppercase block truncate">{me.hero.name}</span>
            <span className="text-xs opacity-80">
              {me.heart ? "♥ Catch ready" : "♡ Catch used"} · {me.abilityAvailable ? "Ability ready" : "Ability used"} · tap for card
            </span>
          </span>
        </button>
      )}
      {showCard && me && <HeroCard player={me} portrait={portrait} />}
      {children}
    </main>
  );
}

function Timer({ deadlineAt, total }: { deadlineAt: number; total: number }) {
  const left = useCountdown(deadlineAt);
  const buzzed = useRef(false);
  useEffect(() => {
    if (left > 0 && left < 10_000 && !buzzed.current) {
      buzzed.current = true;
      vibrate(30);
    }
  }, [left]);
  if (!deadlineAt) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="timer-bar flex-1">
        <div style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      </div>
      <span className="font-ui text-sm tabular-nums w-8 text-right">{Math.ceil(left / 1000)}s</span>
    </div>
  );
}

function Watch({ text = "Eyes on the TV" }: { text?: string }) {
  return (
    <div className="page p-6 text-center flex flex-col items-center gap-3">
      <Hourglass size={48} />
      <p className="font-heading text-xl uppercase">{text}</p>
    </div>
  );
}

function Clue({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="rounded border-2 border-[var(--signal)] bg-black/40 p-4 flex flex-col gap-1">
      <span className="font-ui text-xs uppercase tracking-[0.2em] text-[var(--signal)]">🔍 Only you noticed</span>
      <p className="text-lg leading-snug">{text}</p>
      <span className="text-xs text-parchment/60">Tell the others, or use it in your plan.</span>
    </div>
  );
}

function ReadyButton({ state, me, send }: { state: GameState; me: Player; send: Send }) {
  const done = state.ready.includes(me.id);
  if (state.busy) return null;
  return (
    <button
      className={`btn ${done ? "btn-ghost" : "btn-gilt"} w-full text-xl`}
      disabled={done}
      onClick={() => {
        send("ready");
        vibrate(15);
      }}
    >
      {done ? "Ready ✓ waiting on the others" : "✓ I've read it"}
    </button>
  );
}

function ReactionBar({ send }: { send: Send }) {
  const last = useRef(0);
  return (
    <div className="mt-auto pt-2 grid grid-cols-6 gap-2">
      {REACTIONS.map((e) => (
        <button
          key={e}
          className="text-3xl py-2 rounded bg-white/10 active:scale-90 transition"
          onClick={() => {
            if (Date.now() - last.current < 450) return;
            last.current = Date.now();
            send("react", { emoji: e });
            vibrate(10);
          }}
          aria-label={`React ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function JoinForm({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      setName(localStorage.getItem("ouar-name") ?? "");
    } catch {}
  }, []);
  return (
    <form
      className="page p-6 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        try {
          localStorage.setItem("ouar-name", name.trim());
        } catch {}
        sfx.unlock();
        onJoin(name.trim());
      }}
    >
      <h1 className="font-display text-4xl text-center uppercase">Group Project</h1>
      <label className="font-heading uppercase" htmlFor="name">Your name</label>
      <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="e.g. Sam" autoComplete="off" />
      <button className="btn btn-crimson text-lg" type="submit">Join</button>
    </form>
  );
}

function ConceptForm({ send, building }: { send: Send; building: boolean }) {
  const [text, setText] = useState("");
  const [ex] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
  if (building) return <Watch text="Drawing your character…" />;
  return (
    <form
      className="page p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send("concept", { text: text.trim() });
      }}
    >
      <h2 className="font-heading text-2xl uppercase">Who are you tonight?</h2>
      <p className="text-ink-soft">One line. Be weird. A bit of the real you works great.</p>
      <textarea id="concept" className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={ex} />
      <MicButton onTranscript={(t) => setText(t)} />
      <button className="btn btn-crimson text-lg" type="submit" disabled={!text.trim()}>Make my character</button>
      <button type="button" className="font-ui text-sm underline text-ink-soft" onClick={() => setText(ex)}>
        Use the example
      </button>
    </form>
  );
}

const QUICK = quickHeroes as { id: string; pitch: string; hero: Hero }[];

/** Character step: ready-made characters first (fast for strangers), "make your own" one tap away. */
function CharacterPicker({ state, me, send }: { state: GameState; me: Player; send: Send }) {
  const [own, setOwn] = useState(false);
  const building = me.status === "building";
  if (own || building) {
    return (
      <div className="flex flex-col gap-2">
        <ConceptForm send={send} building={building} />
        {!building && (
          <button type="button" className="font-ui text-sm underline opacity-80" onClick={() => setOwn(false)}>
            Back to the ready-made characters
          </button>
        )}
      </div>
    );
  }
  const takenBy = (id: string) => state.players.find((p) => p.id !== me.id && p.pick === id);
  return (
    <div className="page p-4 flex flex-col gap-3">
      <h2 className="font-heading text-2xl uppercase">Who are you tonight?</h2>
      <p className="text-ink-soft -mt-2">Pick one to jump in fast.</p>
      <div className="grid grid-cols-2 gap-3">
        {QUICK.map((q) => {
          const taken = !!takenBy(q.id);
          return (
            <button
              key={q.id}
              type="button"
              disabled={taken}
              className={`relative text-left rounded border-2 border-white/15 bg-black/30 p-2 flex flex-col gap-1 transition active:scale-95 ${taken ? "opacity-40" : "hover:border-[var(--signal)]"}`}
              onClick={() => {
                sfx.unlock();
                vibrate(15);
                send("pick", { heroId: q.id });
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/heroes/${q.id}.webp`} alt="" className="w-full aspect-[2/3] object-cover rounded" loading="lazy" />
              <span className="font-heading font-bold uppercase leading-none">{q.hero.name}</span>
              <span className="text-xs leading-snug opacity-80">{q.pitch}</span>
              {taken && (
                <span className="absolute top-3 left-1/2 -translate-x-1/2 font-ui text-xs font-bold uppercase tracking-widest bg-black/80 px-2 py-0.5 rounded">
                  Taken
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" className="btn btn-ghost text-lg" onClick={() => setOwn(true)}>
        Or make your own
      </button>
    </div>
  );
}

/** Optional, skippable: one small true thing about the real person (gradual self-disclosure). Never shown during play. */
function TruthForm({ send }: { send: Send }) {
  const [text, setText] = useState("");
  return (
    <form
      className="page p-4 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send("truth", { text: text.trim() });
      }}
    >
      <label className="font-heading uppercase leading-snug" htmlFor="truth">One true thing about the real you (optional)</label>
      <p className="text-ink-soft text-sm -mt-1">A weird talent, a small fear, a dream job… It stays secret until the very end.</p>
      <input id="truth" className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="I can whistle with my mouth closed" autoComplete="off" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => send("truth", { text: "" })}>
          Skip
        </button>
        <button className="btn btn-crimson" type="submit" disabled={!text.trim()}>
          Save it
        </button>
      </div>
    </form>
  );
}

function PitchForm({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: Send; deadlineAt: number }) {
  const [text, setText] = useState("");
  const [useAbility, setUseAbility] = useState(false);
  const [embraceFlaw, setEmbraceFlaw] = useState(false);
  const final = state.scenes[state.sceneIndex]?.kind === "climax";
  const ideas = state.suggestions[me.id] ?? [];
  const victim = state.rescue?.victimId === me.id;
  return (
    <form
      className="page p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        send("pitch", { text: text.trim(), useAbility, embraceFlaw });
        vibrate(20);
      }}
    >
      <Timer deadlineAt={deadlineAt} total={final || state.mode === "quick" ? 30000 : 40000} />
      {state.rescue && !victim && <p className="font-ui font-bold text-crimson">{state.players.find((p) => p.id === state.rescue!.victimId)?.hero?.name} is stuck. Help them out.</p>}
      {victim && <p className="font-ui font-bold text-crimson">You're stuck: {me.peril}. Yell something useful.</p>}
      <p className="font-heading text-xl leading-snug">{final ? "This is it. What's your final move?" : state.situation || "What do you do?"}</p>
      <textarea id="pitch" className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="I…" />
      {ideas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ideas.map((i) => (
            <button type="button" key={i} className="chip text-left normal-case" onClick={() => setText(i)}>
              {i}
            </button>
          ))}
        </div>
      )}
      <MicButton onTranscript={(t) => setText(t)} />
      {!final && me.abilityAvailable && (
        <label className="flex items-center gap-2 font-ui text-sm">
          <input type="checkbox" checked={useAbility} onChange={(e) => setUseAbility(e.target.checked)} className="w-5 h-5" />
          Use <b>{me.hero!.ability.name}</b> (once per story)
        </label>
      )}
      {!final && (
        <label className="flex items-center gap-2 font-ui text-sm">
          <input type="checkbox" checked={embraceFlaw} onChange={(e) => setEmbraceFlaw(e.target.checked)} className="w-5 h-5" />
          Lean into my flaw (+1 Hope if it works)
        </label>
      )}
      <button className="btn btn-crimson text-lg" type="submit" disabled={!text.trim()}>{final ? "Lock it in" : "Send my plan"}</button>
    </form>
  );
}

/** After you've pitched: see your ruling, and 🔥 a friend's plan to give them a better roll. */
function WhileWaiting({ state, me, send }: { state: GameState; me: Player; send: Send }) {
  const mine = state.pitches.find((p) => p.playerId === me.id);
  const others = state.pitches.filter((p) => p.playerId !== me.id);
  const final = state.scenes[state.sceneIndex]?.kind === "climax";
  return (
    <div className="flex flex-col gap-3">
      <div className="page p-4 flex flex-col gap-2">
        <span className="font-ui text-xs uppercase tracking-widest text-ink-soft">Your plan</span>
        <p className="text-lg">“{mine?.text}”</p>
        {mine?.verdict ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Stamp text={stampText(mine.verdict.tier)} size="sm" slam rotate={-3} tone={autoSucceeds(mine.verdict.tier) ? "forest" : "crimson"} />
            <span className="italic text-ink-soft text-sm">{mine.verdict.quip}</span>
          </div>
        ) : (
          !final && <span className="font-ui text-sm text-ink-soft animate-pulse">The DM is reading it…</span>
        )}
      </div>
      {!final && others.length > 0 && (
        <>
          <p className="font-heading uppercase text-lg">Like a friend's plan? 🔥 it</p>
          {others.map((p) => {
            const hero = state.players.find((x) => x.id === p.playerId)?.hero;
            const mineBoost = state.boosts[me.id] === p.id;
            return (
              <button
                key={p.id}
                className={`page p-3 text-left flex flex-col gap-1 ${mineBoost ? "ring-4 ring-[var(--gilt-bright)]" : ""}`}
                onClick={() => {
                  send("boost", { pitchId: p.id });
                  vibrate(15);
                }}
              >
                <span className="font-heading font-bold uppercase">{hero?.name} {mineBoost ? "🔥" : ""}</span>
                <span>“{p.text}”</span>
              </button>
            );
          })}
        </>
      )}
      {(final || others.length === 0) && <Watch text="Waiting on the others…" />}
    </div>
  );
}

/** "Convince the DM": one shot to argue your plan should work. */
function Appeal({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: Send; deadlineAt: number }) {
  const [text, setText] = useState("");
  const mine = state.pitches.find((p) => p.playerId === me.id);
  if (!mine?.verdict) return <Watch text="The DM is reading plans…" />;
  if (state.busy) return <Watch text={state.busy} />;
  const needsRoll = !autoSucceeds(mine.verdict.tier);
  if (!needsRoll)
    return (
      <div className="page p-5 flex flex-col gap-2 items-center text-center">
        <Stamp text="THAT WORKS" sub="no roll needed" size="md" tone="forest" />
        <p className="text-ink-soft">{mine.verdict.quip}</p>
        <p className="font-heading uppercase">Waiting on the others…</p>
      </div>
    );
  if (mine.appealed || mine.appeal || mine.auto)
    return (
      <div className="page p-5 flex flex-col gap-2 items-center text-center">
        <Stamp text={stampText(mine.verdict.tier)} size="md" tone={autoSucceeds(mine.verdict.tier) ? "forest" : "crimson"} />
        <p className="text-ink-soft">{mine.appeal && !mine.appealed ? "The DM is considering your argument…" : mine.verdict.quip}</p>
      </div>
    );
  return (
    <form
      className="page p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send("appeal", { text: text.trim() });
        vibrate(20);
      }}
    >
      <Timer deadlineAt={deadlineAt} total={state.mode === "quick" ? 15000 : 20000} />
      <div className="flex items-center gap-2 flex-wrap">
        <Stamp text={stampText(mine.verdict.tier)} size="sm" slam={false} tone="crimson" />
        <span className="italic text-ink-soft text-sm">{mine.verdict.quip}</span>
      </div>
      <p className="font-heading text-xl uppercase">Convince the DM?</p>
      <p className="text-ink-soft text-sm">Say why it should work. Use your clue, your ability, or something that already happened. A good argument can make it just work.</p>
      <textarea className="input min-h-20" value={text} onChange={(e) => setText(e.target.value)} maxLength={240} placeholder="It'll work because…" />
      <MicButton onTranscript={(t) => setText(t)} />
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-crimson" type="submit" disabled={!text.trim()}>Argue it</button>
        <button className="btn btn-ghost" type="button" onClick={() => send("accept")}>Just roll</button>
      </div>
    </form>
  );
}

// ---------- Mirror, Mirror ----------
function frameFor(h?: Hero) {
  if (!h) return "They were at their best when";
  const poss = h.pronouns === "he/him" ? "his" : h.pronouns === "she/her" ? "her" : "their";
  return `${h.name} was at ${poss} best when`;
}

function MissionCard({ state, me }: { state: GameState; me: Player }) {
  const ward = state.players.find((p) => p.id === state.wards[me.id]);
  if (!ward?.hero) return null;
  return (
    <div className="rounded border-2 border-[var(--gilt-bright)] bg-black/40 p-4 flex flex-col gap-1">
      <span className="font-ui text-xs uppercase tracking-[0.2em] text-[var(--gilt-bright)]">🪞 Secret mission</span>
      <p className="text-xl leading-snug">
        You're <b>{ward.hero.name}</b>'s guardian tonight{ward.name && ward.name !== ward.hero.name ? ` (that's ${ward.name})` : ""}. Watch for one great moment.
      </p>
      <span className="text-xs text-parchment/60">Keep it secret. You'll write one nice sentence about them at the end.</span>
    </div>
  );
}

function MirrorWrite({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: Send; deadlineAt: number }) {
  const [text, setText] = useState("");
  const card = state.mirror.find((c) => c.guardianId === me.id);
  const ward = state.players.find((p) => p.id === state.wards[me.id]);
  if (!card || !ward?.hero) return <Watch text="Eyes on the TV" />;
  if (card.written)
    return (
      <div className="page p-6 flex flex-col items-center gap-3 text-center">
        <p className="font-heading text-2xl uppercase">Sent ✓</p>
        <p className="text-ink-soft">Your words stay secret until the end. {ward.hero.name} has no idea.</p>
      </div>
    );
  const moments = state.mirrorMoments[me.id] ?? [];
  const frame = frameFor(ward.hero);
  return (
    <form
      className="page p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        send("mirror", { text: text.trim() });
        vibrate(20);
      }}
    >
      <Timer deadlineAt={deadlineAt} total={40000} />
      <span className="font-ui text-xs uppercase tracking-[0.2em] text-[var(--crimson)]">🪞 Your ward: {ward.hero.name}</span>
      {moments.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-ui text-xs uppercase tracking-widest text-ink-soft">What they said tonight</span>
          {moments.map((m, i) => (
            <p key={i} className="italic leading-snug">“{m}”</p>
          ))}
        </div>
      )}
      <p className="font-heading text-xl leading-snug">{frame}…</p>
      <textarea className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="…they kept going when it got silly" />
      <MicButton onTranscript={(t) => setText(t)} />
      <p className="text-ink-soft text-sm">Only nice things. One true moment beats a big compliment.</p>
      <button className="btn btn-crimson text-lg" type="submit" disabled={!text.trim()}>Send it</button>
    </form>
  );
}

function MirrorGuess({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: Send; deadlineAt: number }) {
  const [text, setText] = useState("");
  const card = state.mirror.find((c) => c.wardId === me.id);
  if (!card) return <Watch text="Eyes on the TV" />;
  if (card.guess)
    return (
      <div className="page p-6 flex flex-col items-center gap-3 text-center">
        <p className="font-ui text-xs uppercase tracking-widest text-ink-soft">Your guess</p>
        <p className="text-xl italic">“{card.guess}”</p>
        <p className="font-heading uppercase">Waiting on the others…</p>
      </div>
    );
  const guess = (g: string) => {
    send("guess", { text: g });
    vibrate(15);
  };
  return (
    <div className="page p-5 flex flex-col gap-3">
      <Timer deadlineAt={deadlineAt} total={20000} />
      <p className="font-heading text-2xl leading-snug">Someone was secretly watching you tonight. What do you think they wrote about you?</p>
      {GUESSES.map((g) => (
        <button key={g} className="btn btn-ghost text-lg text-left" onClick={() => guess(g)}>
          {g}
        </button>
      ))}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) guess(text.trim());
        }}
      >
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="Or say it in your own words" />
        <button className="btn btn-crimson" type="submit" disabled={!text.trim()}>Send my guess</button>
      </form>
    </div>
  );
}

function MirrorMine({ state, me, send, delay }: { state: GameState; me: Player; send: Send; delay: boolean }) {
  const card = state.mirror.find((c) => c.wardId === me.id);
  const [shown, setShown] = useState(!delay);
  const [sent, setSent] = useState(0);
  useEffect(() => {
    if (shown) return;
    const t = setTimeout(() => {
      setShown(true);
      vibrate([20, 60, 20]);
    }, 2200);
    return () => clearTimeout(t);
  }, [shown]);
  if (!card?.sentence) return null;
  const guardian = state.players.find((p) => p.id === card.guardianId)?.hero?.name ?? "a friend";
  return (
    <div className="page p-5 flex flex-col gap-3 ring-4 ring-[var(--gilt-bright)]">
      <span className="font-ui text-xs uppercase tracking-widest text-[var(--crimson)]">🪞 About you</span>
      <p className="italic text-ink-soft">You guessed: {card.guess ? `“${card.guess}”` : "you were too shy to guess"}</p>
      {shown ? (
        <>
          <p className="font-heading text-2xl leading-snug fade-in">{card.sentence}</p>
          <p className="font-ui text-[var(--crimson)]">From your guardian, {guardian}</p>
          <button
            className="btn btn-crimson text-2xl relative"
            onClick={() => {
              send("thanks");
              setSent((n) => n + 1);
              vibrate(25);
            }}
          >
            ❤️ Thank them
            {sent > 0 && (
              <span key={sent} className="absolute -top-6 right-6 text-4xl fade-in pointer-events-none">
                ❤️
              </span>
            )}
          </button>
          {sent > 0 && <p className="text-center text-sm text-ink-soft">{guardian} just felt that.</p>}
        </>
      ) : (
        <p className="font-heading text-xl text-ink-soft animate-pulse">Your guardian wrote…</p>
      )}
    </div>
  );
}

function BigButton({ label, sub, onClick, tone = "crimson" }: { label: string; sub?: string; onClick: () => void; tone?: "crimson" | "gilt" }) {
  return (
    <button
      className={`btn ${tone === "crimson" ? "btn-crimson" : "btn-gilt"} w-full min-h-48 text-5xl font-display flex flex-col items-center justify-center gap-2 animate-pulse`}
      onClick={onClick}
    >
      {label}
      {sub && <span className="font-ui text-base font-bold normal-case tracking-normal">{sub}</span>}
    </button>
  );
}

// ---------- Final Roll, all together ----------
const SHAKE_THRESHOLD = 14; // m/s² of motion (gravity removed): a deliberate shake, not a wobble

/** iOS only lets a page read motion after asking, and only from inside a tap. */
function askMotion(): Promise<unknown> {
  try {
    const DME = (typeof window !== "undefined" ? window.DeviceMotionEvent : undefined) as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (DME && typeof DME.requestPermission === "function") return DME.requestPermission().catch(() => "denied");
  } catch {}
  return Promise.resolve("granted");
}

function FinalRollPhone({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: Send; deadlineAt: number }) {
  const f = state.final;
  const stage = f?.stage ?? "arm";
  const [armedAt, setArmedAt] = useState(0);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60);
    return () => clearInterval(iv);
  }, []);
  const left = deadlineAt ? Math.max(0, deadlineAt - now) : 0;
  const beat = stage === "count" && left > 0 ? Math.max(1, Math.min(3, Math.ceil(left / 1000))) : 0;
  const shakeTime = stage === "shake" || (stage === "count" && left === 0);
  // Optimistic for a moment after a tap; if the table never heard it, the button comes back.
  const armed = !!f?.armed?.includes(me.id) || (armedAt > 0 && now - armedAt < 2500);
  const shook = !!f?.shook?.includes(me.id) || (sentAt > 0 && now - sentAt < 1500);
  const auto = !!f?.auto?.includes(me.id);

  const roll = useRef<() => void>(() => {});
  roll.current = () => {
    if (shook) return;
    send("roll");
    setSentAt(Date.now());
    vibrate([30, 30, 30, 30, 120]);
  };

  useEffect(() => {
    if (beat) vibrate(beat === 1 ? 120 : 70);
  }, [beat]);
  useEffect(() => {
    if (shakeTime) vibrate(250);
  }, [shakeTime]);
  useEffect(() => {
    if (!shakeTime || shook) return;
    const onMotion = (e: DeviceMotionEvent) => {
      let mag = 0;
      const a = e.acceleration;
      if (a && a.x != null) mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      else {
        const g = e.accelerationIncludingGravity;
        if (g && g.x != null) mag = Math.abs(Math.hypot(g.x ?? 0, g.y ?? 0, g.z ?? 0) - 9.81);
      }
      if (mag > SHAKE_THRESHOLD) roll.current();
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [shakeTime, shook]);

  if (stage === "landed" || state.phase === "final_result")
    return <Watch text={`You rolled a ${f?.dice[me.id] ?? "…"}! Eyes on the TV`} />;
  if (stage === "tumble" || (shook && stage === "shake"))
    return (
      <div className="page p-6 flex flex-col items-center gap-3 text-center">
        <p className="font-display text-5xl uppercase">In the air!</p>
        <p className="font-heading text-xl uppercase">{auto ? "The table rolled for you. Watch the TV" : "Watch the TV: everyone lands together"}</p>
      </div>
    );
  if (shakeTime)
    return <BigButton label="SHAKE!" sub="Shake your phone, or tap here" tone="gilt" onClick={() => roll.current()} />;
  if (stage === "count")
    return (
      <div className="page p-6 flex flex-col items-center gap-2 text-center">
        <span key={beat} className="font-display leading-none ouar-stamp-slam" style={{ fontSize: "9rem", ["--ouar-rot" as string]: "0deg" }}>
          {beat}
        </span>
        <p className="font-heading text-2xl uppercase">Yell your battle cry on SHAKE!</p>
      </div>
    );
  if (armed)
    return (
      <div className="page p-6 flex flex-col items-center gap-3 text-center">
        <p className="font-display text-5xl uppercase">Armed ✓</p>
        <p className="font-heading text-xl uppercase">Waiting for everyone. When the TV says SHAKE, shake your phone.</p>
      </div>
    );
  return (
    <BigButton
      label="ARM"
      sub="Tap to arm your die. Then we all shake at once."
      onClick={() => {
        sfx.unlock();
        vibrate(30);
        setArmedAt(Date.now());
        // Ask for motion inside the tap (iOS), then tell the table we're ready.
        askMotion().then(() => send("arm"));
      }}
    />
  );
}

// ---------- Quick Tale keepsake ----------
/** What a stranger walks away with: their hero, their award, their own words, and the real story. */
function QuickKeepsake({ state, me, portrait }: { state: GameState; me: Player; portrait?: string }) {
  const book = state.storybook;
  if (!book || state.busy) return <Watch text={state.busy || "Binding your storybook…"} />;
  const mine = book.hero_pages.find((h) => h.hero_id === me.id);
  const said = state.pitches.find((p) => p.playerId === me.id)?.text;
  const img = me.pick ? `/heroes/${me.pick}.webp` : portrait;
  return (
    <div className="flex flex-col gap-3">
      <div className="page p-5 flex flex-col gap-3 fade-in">
        <span className="font-ui text-xs uppercase tracking-[0.25em] text-[var(--gilt-bright)]">Your keepsake · {state.partyName || "The Group"}</span>
        <h2 className="font-display text-4xl uppercase leading-none">{book.title}</h2>
        <div className="flex gap-3 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img && <img src={img} alt="" className="portrait-oval w-24 h-32 shrink-0" />}
          <div className="flex flex-col gap-2 min-w-0">
            <p className="font-heading text-xl font-bold uppercase leading-tight">{[me.hero?.name, ...me.titles].join(", ")}</p>
            {mine && <Stamp text={mine.award} size="sm" slam={false} rotate={-2} tone="gilt" />}
            {mine && <p className="leading-snug">{mine.best_moment}</p>}
          </div>
        </div>
        {said && (
          <p className="italic leading-snug">
            <span className="font-ui not-italic text-xs uppercase tracking-widest text-ink-soft block">In your own words</span>“{said}”
          </p>
        )}
        <p className="italic text-ink-soft">{book.moral}</p>
      </div>
      {book.real_story_bridge && (
        <div className="page p-4 flex flex-col gap-1">
          <span className="font-ui text-xs uppercase tracking-widest text-[var(--signal)]">Inspired by real events</span>
          <p className="leading-snug">{book.real_story_bridge}</p>
        </div>
      )}
      <p className="text-center font-ui text-sm opacity-80">Screenshot this page to keep it. Thanks for playing.</p>
    </div>
  );
}

// ---------- Thank-you after a save ----------
function ThankSave({ state, me, send }: { state: GameState; me: Player; send: Send }) {
  const [sent, setSent] = useState<string[]>([]);
  const mine = (state.saves ?? []).filter((x) => x.savedId === me.id && x.scene === state.sceneIndex);
  const save = mine.find((x) => !x.thanked && !sent.includes(x.id)) ?? mine[mine.length - 1];
  if (!save || state.busy) return null;
  const names = save.byIds.map((id) => state.players.find((p) => p.id === id)?.hero?.name.split(" ")[0] ?? "them");
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0];
  if (save.thanked || sent.includes(save.id))
    return (
      <div className="page p-4 text-center flex flex-col gap-1">
        <p className="font-heading text-2xl uppercase">❤️ Sent</p>
        <p className="text-ink-soft">{who} just felt that.</p>
      </div>
    );
  return (
    <button
      className="btn btn-crimson w-full min-h-32 flex flex-col items-center justify-center gap-1"
      onClick={() => {
        send("thank_save", { saveId: save.id });
        setSent((s) => [...s, save.id]);
        sfx.thanks();
        vibrate(25);
      }}
    >
      <span className="font-display text-4xl">❤️ Thank {who}</span>
      <span className="font-ui text-base normal-case tracking-normal">{save.kind === "catch" ? "They spent their heart to catch you" : "They got you out"}</span>
    </button>
  );
}

export function Phone({ code }: { code: string }) {
  const { state, me, portrait, deadlineAt, send } = usePhone(code);
  // Someone you saved said thanks: buzz, and show it for a few seconds.
  const thankedMe = me ? (state?.saves ?? []).filter((x) => x.thanked && x.byIds.includes(me.id)) : [];
  const thankKey = thankedMe.map((x) => x.id).join(",");
  const seenThanks = useRef<Set<string> | null>(null);
  const [thankNote, setThankNote] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (!state || !me) return;
    if (!seenThanks.current) {
      seenThanks.current = new Set(thankedMe.map((x) => x.id));
      return;
    }
    const fresh = thankedMe.find((x) => !seenThanks.current!.has(x.id));
    if (!fresh) return;
    seenThanks.current.add(fresh.id);
    setThankNote({ id: fresh.id, name: state.players.find((p) => p.id === fresh.savedId)?.hero?.name ?? "A friend" });
    vibrate([40, 60, 40, 60, 120]);
    sfx.thanks();
    setTimeout(() => setThankNote((n) => (n?.id === fresh.id ? null : n)), 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thankKey, !!state, !!me]);
  const myWard = me ? state?.wards?.[me.id] : undefined;
  const thanked = myWard ? state?.thanks?.[myWard] ?? 0 : 0;
  const lastThanked = useRef(0);
  useEffect(() => {
    if (thanked > lastThanked.current) {
      vibrate([40, 60, 40, 60, 120]);
      sfx.pop();
    }
    lastThanked.current = thanked;
  }, [thanked]);

  if (!state) {
    return (
      <Shell>
        <Watch text={`Finding table ${code}…`} />
        <p className="text-center font-ui text-sm opacity-80">Make sure the game is open on the laptop or TV.</p>
      </Shell>
    );
  }
  if (!me) {
    if (state.phase !== "lobby") return <Shell><Watch text="A story is underway. Jump in on the next one!" /></Shell>;
    return <Shell><JoinForm onJoin={(name) => send("join", { name })} /></Shell>;
  }

  const name = (id: string) => state.players.find((p) => p.id === id)?.hero?.name ?? "Someone";
  const myClue = state.clues[me.id];
  const saidAboutMe = state.mirror?.find((c) => c.wardId === me.id)?.sentence ?? "";
  const wardHero = myWard ? state.players.find((p) => p.id === myWard)?.hero : undefined;
  let body: React.ReactNode;

  switch (state.phase) {
    case "lobby":
      body = me.hero && me.status === "ready" ? (
        <div className="flex flex-col gap-3">
          <HeroCard player={me} portrait={me.pick ? `/heroes/${me.pick}.webp` : me.hasPortrait ? portrait : undefined} />
          {me.truth === undefined ? <TruthForm send={send} /> : <Watch text="Waiting for the story to start…" />}
          <button className="font-ui text-sm underline opacity-80" onClick={() => send("redraw")}>
            Redraw my character
          </button>
        </div>
      ) : (
        <CharacterPicker state={state} me={me} send={send} />
      );
      break;
    case "quest":
      if (state.mode === "quick") {
        body = (
          <div className="page p-6 text-center flex flex-col items-center gap-3">
            <span className="on-air">Real news</span>
            <p className="font-heading text-2xl uppercase leading-tight">Eyes on the TV. This one really happened.</p>
            <p className="text-ink-soft">In a moment you'll get a secret clue. Say it out loud.</p>
          </div>
        );
        break;
      }
    // falls through
    case "narrating":
    case "epilogue":
    case "reveal":
      body = (
        <div className="flex flex-col gap-3">
          {state.phase === "quest" && <MissionCard state={state} me={me} />}
          {state.phase === "narrating" && <Clue text={myClue} />}
          {state.busy ? <Watch text={state.busy} /> : <Watch text={state.phase === "reveal" ? "Look at the TV. This really happened." : "Eyes on the TV"} />}
          <ReadyButton state={state} me={me} send={send} />
        </div>
      );
      break;
    case "pitch": {
      const pitched = state.pitches.some((p) => p.playerId === me.id);
      body = (
        <div className="flex flex-col gap-3">
          <Clue text={myClue} />
          {pitched ? <WhileWaiting state={state} me={me} send={send} /> : <PitchForm key={state.sceneIndex} state={state} me={me} send={send} deadlineAt={deadlineAt} />}
        </div>
      );
      break;
    }
    case "appeal":
      body = <Appeal state={state} me={me} send={send} deadlineAt={deadlineAt} />;
      break;
    case "roll": {
      const mine = state.rolls.find((r) => r.playerId === me.id);
      const shown = state.revealed.includes(me.id);
      body = !mine ? (
        <Watch text="Everyone's rolling…" />
      ) : mine.noRoll ? (
        <div className="page p-6 flex flex-col items-center gap-3 text-center">
          <Stamp text="THAT WORKS" sub="no roll needed" size="lg" tone="forest" />
          <p className="font-heading uppercase">Watch the others roll</p>
        </div>
      ) : !shown ? (
        <BigButton
          label="ROLL"
          sub="Tap to roll your die"
          onClick={() => {
            sfx.unlock();
            send("roll");
            vibrate([20, 40, 20]);
          }}
        />
      ) : (
        <div className="page p-6 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-7xl">{mine.kept}</p>
          <Stamp text={BAND_LABEL[mine.band]} size="md" tone={isFailure(mine.band) ? "crimson" : mine.band === "LEGENDARY" ? "gilt" : "forest"} />
          {isFailure(mine.band) && me.heart === 0 && <p className="text-ink-soft">A friend with a ♥ can still catch you.</p>}
        </div>
      );
      break;
    }
    case "catch": {
      const failed = state.rolls.filter((r) => isFailure(r.band) && r.playerId !== me.id && !r.rescuerId);
      body = state.catchers.includes(me.id) && failed.length ? (
        <div className="flex flex-col gap-3">
          <p className="font-heading text-2xl uppercase text-center">Catch someone?</p>
          <p className="text-center text-ink-soft">Spend your one ♥ to re-roll a friend's fail.</p>
          {failed.map((r) => (
            <BigButton
              key={r.playerId}
              label="CATCH!"
              sub={`Save ${name(r.playerId)}`}
              tone="gilt"
              onClick={() => {
                send("catch", { target: r.playerId });
                vibrate([30, 30, 80]);
              }}
            />
          ))}
        </div>
      ) : (
        <Watch text="Can anyone catch them?" />
      );
      break;
    }
    case "outcome": {
      const round = state.round;
      const myBeat = round?.beats.find((b) => b.hero_id === me.id);
      const myTurn = round && round.beats[state.beatIndex]?.hero_id === me.id;
      body = (
        <div className="flex flex-col gap-3">
          {myBeat && (state.beatIndex >= (round?.beats.findIndex((b) => b.hero_id === me.id) ?? 99)) && (
            <div className={`page p-4 flex flex-col gap-1 ${myTurn ? "ring-4 ring-[var(--gilt-bright)]" : ""}`}>
              <span className="font-ui text-xs uppercase tracking-widest text-[var(--gilt-bright)]">Your moment</span>
              <p className="text-lg leading-snug">{myBeat.text}</p>
            </div>
          )}
          <ThankSave state={state} me={me} send={send} />
          {state.busy ? <Watch text={state.busy} /> : <Watch text="Eyes on the TV" />}
          <ReadyButton state={state} me={me} send={send} />
        </div>
      );
      break;
    }
    case "final_roll":
      body = <FinalRollPhone state={state} me={me} send={send} deadlineAt={deadlineAt} />;
      break;
    case "mirror_write":
      body = <MirrorWrite state={state} me={me} send={send} deadlineAt={deadlineAt} />;
      break;
    case "mirror_guess":
      body = <MirrorGuess state={state} me={me} send={send} deadlineAt={deadlineAt} />;
      break;
    case "mirror_reveal": {
      const idx = state.mirror.findIndex((c) => c.wardId === me.id);
      const mineNow = !state.busy && idx === state.mirrorIndex;
      body = (
        <div className="flex flex-col gap-3">
          {state.busy ? (
            <Watch text={state.busy} />
          ) : (
            <>
              {idx >= 0 && idx <= state.mirrorIndex && <MirrorMine key={idx} state={state} me={me} send={send} delay={mineNow} />}
              {!mineNow && <Watch text={`Eyes on the TV: this one's about ${name(state.mirror[state.mirrorIndex]?.wardId ?? "")}`} />}
            </>
          )}
          <ReadyButton state={state} me={me} send={send} />
        </div>
      );
      break;
    }
    case "storybook":
      if (state.mode === "quick") {
        body = <QuickKeepsake state={state} me={me} portrait={portrait} />;
        break;
      }
      body = (
        <div className="flex flex-col gap-3">
          <HeroCard player={me} portrait={portrait} showRoast={false} />
          {saidAboutMe && (
            <div className="page p-5 flex flex-col gap-1">
              <span className="font-ui text-xs uppercase tracking-widest text-[var(--crimson)]">Said about you</span>
              <p className="text-lg leading-snug">{saidAboutMe}</p>
            </div>
          )}
          <div className="page p-5 text-center">
            <p className="font-heading text-2xl uppercase">Thanks for playing</p>
            <p className="text-ink-soft">Your story's on the TV. Next chapter, same crew, whenever you're ready.</p>
          </div>
        </div>
      );
      break;
    default:
      body = <Watch text={state.busy || "Eyes on the TV"} />;
  }

  return (
    <Shell me={me} portrait={portrait}>
      {me.peril && state.phase !== "pitch" && <p className="font-ui font-bold text-center text-[var(--gilt-bright)]">You're stuck: {me.peril}</p>}
      {wardHero && PLAY_PHASES.includes(state.phase) && (
        <p className="font-ui text-xs text-center text-parchment/70">🪞 Secretly watching {wardHero.name}. Look for one great moment.</p>
      )}
      {thankNote && (
        <p key={thankNote.id} className="page p-4 text-center font-heading text-2xl uppercase fade-in ring-4 ring-[var(--crimson)]">❤️ {thankNote.name} says thanks</p>
      )}
      {wardHero && thanked > 0 && (
        <p key={thanked} className="page p-3 text-center font-heading text-xl fade-in">❤️ {wardHero.name} says thanks</p>
      )}
      {body}
      {me.hero && <ReactionBar send={send} />}
    </Shell>
  );
}
