"use client";
import { useEffect, useRef, useState } from "react";
import { useCountdown, usePhone } from "@/lib/usePhone";
import { BAND_LABEL, REACTIONS, autoSucceeds, isFailure, stampText } from "@/lib/rules";
import { sfx } from "@/lib/sfx";
import { HeroCard } from "./HeroCard";
import { MicButton } from "./MicButton";
import { Hourglass } from "./Effects";
import { Stamp } from "./Stamp";
import type { GameState, Player } from "@/lib/types";

const EXAMPLES = [
  "a night-shift barista who can hear electricity",
  "a raccoon who works security at the mall",
  "a grandma who's been a ghost hunter since 1974",
  "a substitute teacher who is secretly a cryptid",
  "an influencer whose phone sees the future, badly",
];

const READING = ["quest", "narrating", "outcome", "epilogue", "reveal"];

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
      <Timer deadlineAt={deadlineAt} total={final ? 30000 : 40000} />
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
      <Timer deadlineAt={deadlineAt} total={20000} />
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

export function Phone({ code }: { code: string }) {
  const { state, me, portrait, deadlineAt, send } = usePhone(code);
  const [rolledFinal, setRolledFinal] = useState(false);
  useEffect(() => {
    if (state?.phase !== "final_roll") setRolledFinal(false);
  }, [state?.phase]);

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
  let body: React.ReactNode;

  switch (state.phase) {
    case "lobby":
      body = me.hero && me.status === "ready" ? (
        <div className="flex flex-col gap-3">
          <HeroCard player={me} portrait={portrait} />
          <Watch text="Waiting for the story to start…" />
          <button className="font-ui text-sm underline opacity-80" onClick={() => send("concept", { text: me.concept ?? "" })}>
            Redraw my character
          </button>
        </div>
      ) : (
        <ConceptForm send={send} building={me.status === "building"} />
      );
      break;
    case "quest":
    case "narrating":
    case "epilogue":
    case "reveal":
      body = (
        <div className="flex flex-col gap-3">
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
          {state.busy ? <Watch text={state.busy} /> : <Watch text="Eyes on the TV" />}
          <ReadyButton state={state} me={me} send={send} />
        </div>
      );
      break;
    }
    case "final_roll":
      body = rolledFinal || state.final?.rolled.includes(me.id) ? (
        <Watch text={`You rolled a ${state.final?.dice[me.id] ?? "…"}! Waiting on the others…`} />
      ) : (
        <BigButton
          label="ROLL"
          sub="Everyone rolls together"
          onClick={() => {
            send("roll");
            setRolledFinal(true);
            vibrate([20, 40, 20, 40, 60]);
          }}
        />
      );
      break;
    case "storybook":
      body = (
        <div className="flex flex-col gap-3">
          <HeroCard player={me} portrait={portrait} showRoast={false} />
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
      {body}
      {me.hero && !READING.includes("never") && <ReactionBar send={send} />}
    </Shell>
  );
}
