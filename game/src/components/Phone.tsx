"use client";
import { useEffect, useRef, useState } from "react";
import { useCountdown, usePhone } from "@/lib/usePhone";
import { BAND_LABEL, REACTIONS, autoSucceeds, isFailure, stampText } from "@/lib/rules";
import { sfx } from "@/lib/sfx";
import { HeroCard } from "./HeroCard";
import { MicButton } from "./MicButton";
import { Hourglass } from "./Effects";
import { Stamp } from "./Stamp";
import { ChatDock, HostBar, PhoneReactions, RatingNote, RoomLobby, SideQuestCard, StoryView } from "./Remote";
import type { GameHost } from "@/lib/host";
import type { GameState, Hero, Player, Rating, RealAnswers } from "@/lib/types";

const EXAMPLES = [
  "a night-shift barista who can hear electricity",
  "a raccoon who works security at the mall",
  "a grandma who's been a ghost hunter since 1974",
  "a substitute teacher who is secretly a cryptid",
  "an influencer whose phone sees the future, badly",
];
const KID_EXAMPLES = [
  "a kid detective whose backpack talks back",
  "a dragon who is scared of birthday candles",
  "a lunch lady with a magic ladle",
  "a skateboarder who can talk to squirrels",
  "a librarian who can hear what books are thinking",
];

/** "Real in, magic out": the three join questions (copy from design/18). */
const QUESTIONS: { key: keyof RealAnswers; q: string; hint: string; ex: string[]; kids: string[] }[] = [
  {
    key: "skill",
    q: "What's something you're weirdly good at?",
    hint: "This becomes your hidden power.",
    ex: ["parallel parking", "remembering birthdays", "finding lost things"],
    kids: ["drawing dragons", "finding lost socks", "making people laugh"],
  },
  {
    key: "fear",
    q: "What's a small thing that scares you?",
    hint: "It only ever shows up as a joke in the story. Nobody has to actually do anything scary.",
    ex: ["pigeons", "voicemails", "the dark"],
    kids: ["spiders", "thunder", "the dark"],
  },
  {
    key: "talk",
    q: "What could you talk about for hours?",
    hint: "The group sees this at the end. It's how you'll find a reason to hang out again.",
    ex: ["street food", "old horror movies", "Formula 1"],
    kids: ["dinosaurs", "Minecraft", "my dog"],
  },
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

/** The DM's pick gave you this scene: a nudge that your real skill could matter here. Never a requirement. */
function Spotlight({ how }: { how?: string }) {
  if (!how) return null;
  return (
    <div className="rounded border-2 border-[var(--gilt-bright)] bg-black/40 p-3 flex flex-col gap-1">
      <span className="font-ui text-xs uppercase tracking-[0.2em] text-[var(--gilt-bright)]">✨ Your spotlight</span>
      <p className="leading-snug">{how}</p>
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

/** The old path: describe an invented character in one line. */
function ConceptForm({ send, rating, onBack }: { send: Send; rating: Rating; onBack: () => void }) {
  const [text, setText] = useState("");
  const list = rating === "kids" ? KID_EXAMPLES : EXAMPLES;
  const [ex] = useState(() => list[Math.floor(Math.random() * list.length)]);
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
      <button type="button" className="font-ui text-sm underline text-ink-soft" onClick={onBack}>
        ◂ Answer the three questions instead
      </button>
    </form>
  );
}

/** Real in, magic out: three light questions about the real you, one at a time, each skippable. */
function RealForm({ send, building, rating }: { send: Send; building: boolean; rating: Rating }) {
  const [mode, setMode] = useState<"real" | "concept">("real");
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<RealAnswers>({ skill: "", fear: "", talk: "" });
  if (building) return <Watch text="Drawing your character…" />;
  if (mode === "concept") return <ConceptForm send={send} rating={rating} onBack={() => setMode("real")} />;
  const q = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;
  const value = ans[q.key];
  const setValue = (v: string) => setAns((a) => ({ ...a, [q.key]: v }));
  const trimmed = (a: RealAnswers): RealAnswers => ({ skill: a.skill.trim(), fear: a.fear.trim(), talk: a.talk.trim() });
  const anyAnswer = (a: RealAnswers) => !!(a.skill.trim() || a.fear.trim() || a.talk.trim());
  const skipped = { ...ans, [q.key]: "" };
  const go = (next: RealAnswers) => {
    setAns(next);
    if (!last) return setStep(step + 1);
    if (!anyAnswer(next)) return;
    send("concept", { text: "", real: trimmed(next) });
    vibrate(20);
  };
  return (
    <form
      className="page p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() || last) go(ans);
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-ui text-xs uppercase tracking-[0.2em] text-ink-soft">The real you · {step + 1} of {QUESTIONS.length}</span>
        {step > 0 && (
          <button type="button" className="font-ui text-xs underline text-ink-soft" onClick={() => setStep(step - 1)}>
            ◂ Back
          </button>
        )}
      </div>
      {step === 0 && <p className="text-sm text-ink-soft -mt-1">You play yourself, with a hidden magical side. Skip anything you like.</p>}
      <label className="font-heading text-2xl leading-tight" htmlFor={`real-${q.key}`}>{q.q}</label>
      <p className="text-sm text-ink-soft -mt-1">{q.hint}</p>
      <input
        key={q.key}
        id={`real-${q.key}`}
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={80}
        placeholder={(rating === "kids" ? q.kids : q.ex).join(", ")}
        autoComplete="off"
        autoFocus
      />
      <MicButton key={`mic-${q.key}`} onTranscript={(t) => setValue(t.slice(0, 80))} />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <button type="button" className="btn btn-ghost" disabled={last && !anyAnswer(skipped)} onClick={() => go(skipped)}>
          Skip
        </button>
        <button className="btn btn-crimson text-lg" type="submit" disabled={last ? !anyAnswer(ans) : !value.trim()}>
          {last ? "Make my character" : "Next ▸"}
        </button>
      </div>
      {last && !anyAnswer(ans) && <p className="text-sm text-center text-ink-soft">Answer at least one, or describe a character instead.</p>}
      <button type="button" className="font-ui text-sm underline text-ink-soft" onClick={() => setMode("concept")}>
        or just describe a character
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

export function Phone({ code, host }: { code: string; host?: GameHost }) {
  const { state, me, portrait, portraits, sceneArt, reactions, deadlineAt, send } = usePhone(code);
  const [rolledFinal, setRolledFinal] = useState(false);
  useEffect(() => {
    if (state?.phase !== "final_roll") setRolledFinal(false);
  }, [state?.phase]);
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
        <p className="text-center font-ui text-sm opacity-80">
          {host ? "Setting up your room…" : "Make sure the game is still open on the host’s device (or the laptop/TV)."}
        </p>
      </Shell>
    );
  }
  if (!me) {
    if (state.phase !== "lobby") return <Shell><Watch text="A story is underway. Jump in on the next one!" /></Shell>;
    return <Shell><JoinForm onJoin={(name) => send("join", { name })} /></Shell>;
  }

  // No TV: this phone shows the story itself, so "eyes on the TV" prompts go away.
  const onPhones = state.screen === "phones";
  const eyes = (text = "Eyes on the TV") => (onPhones ? null : <Watch text={text} />);
  const busyOrEyes = (text?: string) => (state.busy ? (onPhones ? null : <Watch text={state.busy} />) : eyes(text));
  const name = (id: string) => state.players.find((p) => p.id === id)?.hero?.name ?? "Someone";
  const myClue = state.clues[me.id];
  const saidAboutMe = state.mirror?.find((c) => c.wardId === me.id)?.sentence ?? "";
  const wardHero = myWard ? state.players.find((p) => p.id === myWard)?.hero : undefined;
  const pick = state.questPick?.quest_id === state.questId ? state.questPick : null;
  const mySpot = pick?.spotlights.find((sp) => sp.hero_id === me.id && sp.scene === state.sceneIndex)?.how ?? "";
  let body: React.ReactNode;

  switch (state.phase) {
    case "lobby":
      body = me.hero && me.status === "ready" ? (
        <div className="flex flex-col gap-3">
          <HeroCard player={me} portrait={portrait} />
          {!host && <Watch text="Waiting for the story to start…" />}
          <button className="font-ui text-sm underline opacity-80" onClick={() => send("concept", { text: me.concept ?? "", real: me.real })}>
            Redraw my character
          </button>
        </div>
      ) : (
        <RealForm send={send} building={me.status === "building"} rating={state.rating ?? "teens"} />
      );
      if (!onPhones)
        body = (
          <div className="flex flex-col gap-3">
            {body}
            <div className="page p-3">
              <RatingNote state={state} />
            </div>
          </div>
        );
      if (onPhones)
        body = (
          <div className="flex flex-col gap-3">
            {body}
            <RoomLobby state={state} me={me} portraits={portraits} host={host} />
          </div>
        );
      break;
    case "quest":
    case "narrating":
    case "epilogue":
    case "reveal":
      body = (
        <div className="flex flex-col gap-3">
          {state.phase === "quest" && <MissionCard state={state} me={me} />}
          {state.phase === "narrating" && <Spotlight how={mySpot} />}
          {state.phase === "narrating" && <Clue text={myClue} />}
          {busyOrEyes(state.phase === "reveal" ? "Look at the TV. This really happened." : undefined)}
          {state.phase === "reveal" && !onPhones && state.solvedBy && <p className="page p-4 font-heading text-xl leading-snug text-center">{state.solvedBy}.</p>}
          <ReadyButton state={state} me={me} send={send} />
        </div>
      );
      break;
    case "pitch": {
      const pitched = state.pitches.some((p) => p.playerId === me.id);
      body = (
        <div className="flex flex-col gap-3">
          {!pitched && <Spotlight how={mySpot} />}
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
          {busyOrEyes()}
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
            busyOrEyes()
          ) : (
            <>
              {idx >= 0 && idx <= state.mirrorIndex && <MirrorMine key={idx} state={state} me={me} send={send} delay={mineNow} />}
              {!mineNow && eyes(`Eyes on the TV: this one's about ${name(state.mirror[state.mirrorIndex]?.wardId ?? "")}`)}
            </>
          )}
          <ReadyButton state={state} me={me} send={send} />
        </div>
      );
      break;
    }
    case "storybook":
      body = (
        <div className="flex flex-col gap-3">
          <HeroCard player={me} portrait={portrait} showRoast={false} />
          {saidAboutMe && (
            <div className="page p-5 flex flex-col gap-1">
              <span className="font-ui text-xs uppercase tracking-widest text-[var(--crimson)]">Said about you</span>
              <p className="text-lg leading-snug">{saidAboutMe}</p>
            </div>
          )}
          {!onPhones && <SideQuestCard state={state} />}
          <div className="page p-5 text-center">
            <p className="font-heading text-2xl uppercase">Thanks for playing</p>
            <p className="text-ink-soft">
              {onPhones ? "Flip through your story above." : "Your story's on the TV."} Next chapter, same crew, whenever you're ready.
            </p>
          </div>
        </div>
      );
      break;
    default:
      body = onPhones ? null : <Watch text={state.busy || "Eyes on the TV"} />;
  }

  return (
    <Shell me={me} portrait={portrait}>
      {host && <HostBar host={host} />}
      {onPhones && state.phase !== "lobby" && <StoryView state={state} me={me} portraits={portraits} sceneArt={sceneArt} host={host} />}
      {me.peril && state.phase !== "pitch" && <p className="font-ui font-bold text-center text-[var(--gilt-bright)]">You're stuck: {me.peril}</p>}
      {wardHero && PLAY_PHASES.includes(state.phase) && (
        <p className="font-ui text-xs text-center text-parchment/70">🪞 Secretly watching {wardHero.name}. Look for one great moment.</p>
      )}
      {wardHero && thanked > 0 && (
        <p key={thanked} className="page p-3 text-center font-heading text-xl fade-in">❤️ {wardHero.name} says thanks</p>
      )}
      {body}
      {me.hero && <ReactionBar send={send} />}
      {onPhones && <PhoneReactions items={reactions} state={state} />}
      {onPhones && <ChatDock state={state} me={me} send={send} />}
    </Shell>
  );
}
