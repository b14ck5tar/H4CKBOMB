"use client";
import { useEffect, useState } from "react";
import { useCountdown, usePhone } from "@/lib/usePhone";
import { BAND_LABEL, REACTIONS, stampText } from "@/lib/rules";
import { sfx } from "@/lib/sfx";
import { HeroCard } from "./HeroCard";
import { MicButton } from "./MicButton";
import { Hourglass } from "./Effects";
import { Stamp } from "./Stamp";
import type { GameState, Player } from "@/lib/types";

const EXAMPLES = [
  "a cowardly knight who is allergic to dragons",
  "a grandma witch who only casts spells by knitting",
  "a frog who insists he is secretly a prince",
  "a bard who can only speak in rhyme",
  "a retired pirate afraid of water",
];

function vibrate(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {}
}

function Shell({ children, me, portrait }: { children: React.ReactNode; me?: Player; portrait?: string }) {
  const [showCard, setShowCard] = useState(false);
  return (
    <main className="min-h-full flex flex-col gap-3 p-4 max-w-md mx-auto" onPointerDown={() => sfx.unlock()}>
      {me?.hero && (
        <button className="flex items-center gap-2 text-left font-ui text-parchment/90" onClick={() => setShowCard((s) => !s)}>
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="" className="portrait-oval w-9 h-11" />
          ) : (
            <span className="portrait-oval w-9 h-11 inline-block" />
          )}
          <span className="flex-1 min-w-0">
            <span className="font-heading font-bold block truncate">{me.hero.name}</span>
            <span className="text-xs opacity-80">
              {me.heart ? "♥ Heart ready" : "♡ Heart spent"} · {me.abilityAvailable ? "Ability ready" : "Ability used"} · tap for card
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

function Watch({ text = "Eyes on the table" }: { text?: string }) {
  return (
    <div className="page p-6 text-center flex flex-col items-center gap-3">
      <Hourglass size={48} />
      <p className="font-heading text-xl">{text}</p>
    </div>
  );
}

function ReactionBar({ send }: { send: (t: string, d?: Record<string, unknown>) => void }) {
  return (
    <div className="mt-auto pt-2 grid grid-cols-6 gap-2">
      {REACTIONS.map((e) => (
        <button
          key={e}
          className="text-3xl py-2 rounded-xl bg-white/10 active:scale-90 transition"
          onClick={() => {
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
      <h1 className="font-display text-3xl text-center">Once Upon a Roll</h1>
      <label className="font-heading" htmlFor="name">Your name</label>
      <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="e.g. Sam" autoComplete="off" />
      <button className="btn btn-crimson text-lg" type="submit">Join the party</button>
    </form>
  );
}

function ConceptForm({ send, building }: { send: (t: string, d?: Record<string, unknown>) => void; building: boolean }) {
  const [text, setText] = useState("");
  const [ex] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
  if (building) return <Watch text="The scribes are inking your legend…" />;
  return (
    <form
      className="page p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send("concept", { text: text.trim() });
      }}
    >
      <h2 className="font-heading text-2xl">Who are you in this tale?</h2>
      <p className="text-ink-soft">One line is plenty. Be weird.</p>
      <textarea id="concept" className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={ex} />
      <MicButton onTranscript={(t) => setText(t)} />
      <button className="btn btn-crimson text-lg" type="submit" disabled={!text.trim()}>Create my hero</button>
      <button type="button" className="font-ui text-sm underline text-ink-soft" onClick={() => setText(ex)}>
        Use the example
      </button>
    </form>
  );
}

function PitchForm({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: (t: string, d?: Record<string, unknown>) => void; deadlineAt: number }) {
  const [text, setText] = useState("");
  const [useAbility, setUseAbility] = useState(false);
  const [embraceFlaw, setEmbraceFlaw] = useState(false);
  const ideas = state.suggestions[me.id] ?? [];
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
      <Timer deadlineAt={deadlineAt} total={state.rescue ? 30000 : 25000} />
      {state.rescue && <p className="font-ui font-bold text-crimson">RESCUE! {state.players.find((p) => p.id === state.rescue!.victimId)?.hero?.name} needs you.</p>}
      <p className="font-heading text-lg leading-snug">{state.situation || "What do you do?"}</p>
      <textarea id="pitch" className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="I…" />
      {ideas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ideas.map((i) => (
            <button type="button" key={i} className="chip text-left" onClick={() => setText(i)}>
              {i}
            </button>
          ))}
        </div>
      )}
      <MicButton onTranscript={(t) => setText(t)} />
      {me.abilityAvailable && (
        <label className="flex items-center gap-2 font-ui">
          <input type="checkbox" checked={useAbility} onChange={(e) => setUseAbility(e.target.checked)} className="w-5 h-5 accent-[var(--forest)]" />
          Use <b>{me.hero!.ability.name}</b> (advantage, once per tale)
        </label>
      )}
      <label className="flex items-center gap-2 font-ui">
        <input type="checkbox" checked={embraceFlaw} onChange={(e) => setEmbraceFlaw(e.target.checked)} className="w-5 h-5 accent-[var(--crimson)]" />
        Embrace my flaw (+1 Hope if it works)
      </label>
      <button className="btn btn-crimson text-lg" type="submit" disabled={!text.trim()}>Seal my plan</button>
    </form>
  );
}

function Vote({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: (t: string, d?: Record<string, unknown>) => void; deadlineAt: number }) {
  if (state.busy) return <Watch text="The Tale-Spinner weighs your plans…" />;
  const rescue = state.rescue;
  const isVoter = rescue ? rescue.victimId === me.id : true;
  const options = state.pitches.filter((p) => p.playerId !== me.id);
  if (!isVoter) {
    const victim = state.players.find((p) => p.id === rescue?.victimId);
    return <Watch text={`${victim?.hero?.name} is choosing their savior…`} />;
  }
  if (!options.length) return <Watch text="The party is voting on your plan…" />;
  const myVote = state.votes[me.id];
  return (
    <div className="flex flex-col gap-3">
      <div className="page p-4 flex flex-col gap-2">
        <Timer deadlineAt={deadlineAt} total={12000} />
        <p className="font-heading text-lg">{rescue ? "Who saves you? Pick your savior." : "Which plan should we try?"}</p>
      </div>
      {options.map((p) => {
        const hero = state.players.find((x) => x.id === p.playerId)?.hero;
        const chosen = myVote === p.id;
        return (
          <button
            key={p.id}
            className={`page p-4 text-left flex flex-col gap-2 transition ${chosen ? "ring-4 ring-[var(--gilt)]" : ""}`}
            onClick={() => {
              send("vote", { pitchId: p.id });
              vibrate(15);
            }}
          >
            <span className="font-heading font-bold">{hero?.name}</span>
            <span className="text-lg leading-snug">“{p.text}”</span>
            {p.verdict && (
              <span className="flex items-center gap-2 flex-wrap">
                <Stamp text={stampText(p.verdict.tier)} size="sm" slam={false} rotate={-3} tone={p.verdict.tier === "clever" ? "forest" : p.verdict.tier === "solid" ? "ink" : "crimson"} />
                <span className="italic text-ink-soft text-sm">{p.verdict.quip}</span>
              </span>
            )}
            {chosen && <span className="font-ui text-sm font-bold text-forest">Your vote ✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function BigButton({ label, sub, onClick, tone = "crimson" }: { label: string; sub?: string; onClick: () => void; tone?: "crimson" | "gilt" }) {
  return (
    <button
      className={`btn ${tone === "crimson" ? "btn-crimson" : "btn-gilt"} w-full min-h-48 text-4xl font-display flex flex-col items-center justify-center gap-2 animate-pulse`}
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
        <p className="text-center font-ui text-sm opacity-80">Make sure the table is open on the laptop or TV.</p>
      </Shell>
    );
  }
  if (!me) {
    if (state.phase !== "lobby") return <Shell><Watch text="A tale is underway. You can join the next one!" /></Shell>;
    return <Shell><JoinForm onJoin={(name) => send("join", { name })} /></Shell>;
  }

  const name = (id: string) => state.players.find((p) => p.id === id)?.hero?.name ?? "Someone";
  let body: React.ReactNode;

  switch (state.phase) {
    case "lobby":
      body = me.hero && me.status === "ready" ? (
        <div className="flex flex-col gap-3">
          <HeroCard player={me} portrait={portrait} />
          <Watch text="Waiting for the tale to begin…" />
          <button className="font-ui text-sm underline opacity-80" onClick={() => send("concept", { text: me.concept ?? "" })}>
            Reroll my hero
          </button>
        </div>
      ) : (
        <ConceptForm send={send} building={me.status === "building"} />
      );
      break;
    case "pitch": {
      const victim = state.rescue?.victimId === me.id;
      const pitched = state.pitches.some((p) => p.playerId === me.id);
      const eligible = !victim || state.players.filter((p) => p.hero).length === 1;
      body = !eligible ? (
        <Watch text={`You're in peril! Your friends are planning your rescue…`} />
      ) : pitched ? (
        <Watch text="Your plan is sealed. Waiting for the others…" />
      ) : (
        <PitchForm key={state.sceneIndex} state={state} me={me} send={send} deadlineAt={deadlineAt} />
      );
      break;
    }
    case "vote":
      body = <Vote state={state} me={me} send={send} deadlineAt={deadlineAt} />;
      break;
    case "roll":
      body =
        state.rollerId === me.id ? (
          <BigButton
            label="ROLL"
            sub="Tap to roll the d20"
            onClick={() => {
              sfx.unlock();
              send("roll");
              vibrate([20, 40, 20]);
            }}
          />
        ) : (
          <Watch text={`${name(state.rollerId)} is rolling…`} />
        );
      break;
    case "catch":
      body = state.catchers.includes(me.id) ? (
        <BigButton
          label="CATCH!"
          sub={`Spend your Heart to reroll for ${name(state.rollerId)}`}
          tone="gilt"
          onClick={() => {
            send("catch");
            vibrate([30, 30, 80]);
          }}
        />
      ) : (
        <Watch text={state.roll ? `${BAND_LABEL[state.roll.band]}! Can anyone catch ${name(state.rollerId)}?` : "…"} />
      );
      break;
    case "final_roll":
      body = rolledFinal || state.final?.rolled.includes(me.id) ? (
        <Watch text={`You rolled a ${state.final?.dice[me.id] ?? "…"}! Waiting for the others…`} />
      ) : (
        <BigButton
          label="ROLL"
          sub="Roll for the fate of the realm!"
          onClick={() => {
            send("roll");
            setRolledFinal(true);
            vibrate([20, 40, 20, 40, 60]);
          }}
        />
      );
      break;
    case "reveal":
    case "storybook":
      body = (
        <div className="flex flex-col gap-3">
          <HeroCard player={me} portrait={portrait} showRoast={false} />
          <div className="page p-5 text-center">
            <p className="font-heading text-xl">Thanks for playing!</p>
            <p className="text-ink-soft">Your tale is on the table. The real story is on the last page.</p>
          </div>
        </div>
      );
      break;
    default:
      body = <Watch text={state.busy || "Eyes on the table"} />;
  }

  return (
    <Shell me={me} portrait={portrait}>
      {me.peril && state.phase !== "pitch" && (
        <p className="font-ui font-bold text-center text-[var(--gilt-bright)]">You are in peril: {me.peril}</p>
      )}
      {body}
      {me.hero && <ReactionBar send={send} />}
    </Shell>
  );
}
