"use client";
/**
 * The phone: a controller, never a second TV. Every screen is ONE big instruction (the same words as the TV's
 * "Now:" banner, lib/now.ts), a timer when there is one, the scene's art blurred behind it, and one control.
 */
import { useEffect, useRef, useState } from "react";
import { useCountdown, usePhone } from "@/lib/usePhone";
import { REACTIONS } from "@/lib/rules";
import { eligibleIds, nowText, winnerPid } from "@/lib/now";
import { sfx } from "@/lib/sfx";
import { HeroCard } from "./HeroCard";
import { MicButton } from "./MicButton";
import type { GameState, Hero, Player } from "@/lib/types";
import quickHeroes from "@/data/quickstart_heroes.json";
import questImages from "@/data/quest_images.json";

const EXAMPLES = [
  "a night-shift barista who can hear electricity",
  "a raccoon who works security at the mall",
  "a grandma who's been a ghost hunter since 1974",
  "a substitute teacher who is secretly a cryptid",
  "an influencer whose phone sees the future, badly",
];

/** Placeholder ideas in the plan box. Plain examples, never AI suggestions (those made everyone's plans the same). */
const PLAN_EXAMPLES = [
  "I distract it with something it wants more",
  "I ask the person in charge for help",
  "I sneak around the back and look for a weak spot",
  "I use my knack for this, of course",
  "I make a deal with it",
];

const SCENE_PHASES = ["narrating", "pitch", "vote", "ruling", "roll", "outcome"];

function vibrate(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {}
}

type Send = (t: string, d?: Record<string, unknown>) => void;

/** The plate behind the current moment (the same picture the TV is showing, from the pre-painted set). */
function artFor(s: GameState | null) {
  if (!s?.questId || s.phase === "lobby" || s.phase === "story_vote") return "";
  const plates = (questImages as Record<string, string[]>)[s.questId] ?? [];
  const late = ["final_roll", "final_result", "epilogue", "reveal", "storybook"].includes(s.phase);
  const i = s.mode === "quick" ? 2 : s.phase === "quest" ? 0 : late ? 2 : s.sceneIndex;
  return plates[i] ?? plates[0] ?? "";
}

function Shell({ children, me, portrait, state }: { children: React.ReactNode; me?: Player; portrait?: string; state?: GameState | null }) {
  const art = artFor(state ?? null);
  return (
    <div className="ph-root" onPointerDown={() => sfx.unlock()}>
      <div className="ph-art" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {art && <img key={art} src={art} alt="" />}
      </div>
      <main className="ph-main">
        {me?.hero && (
          <div className="flex items-center gap-2 font-ui text-parchment/85">
            {portrait || me.pick ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.pick ? `/heroes/${me.pick}.webp` : portrait} alt="" className="w-9 h-9 rounded-full object-cover object-top" style={{ boxShadow: `0 0 0 2px ${me.color}` }} />
            ) : (
              <span className="w-9 h-9 rounded-full inline-block" style={{ background: me.color }} />
            )}
            <span className="font-heading text-base font-bold uppercase truncate">{me.hero.name}</span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

function Timer({ deadlineAt, total }: { deadlineAt: number; total: number }) {
  const left = useCountdown(deadlineAt);
  const buzzed = useRef(false);
  useEffect(() => {
    if (left > 0 && left < 8000 && !buzzed.current) {
      buzzed.current = true;
      vibrate(30);
    }
  }, [left]);
  if (!deadlineAt || !left) return <div className="h-[10px]" />;
  return (
    <div className="flex items-center gap-2">
      <div className="timer-bar flex-1">
        <div style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      </div>
      <span className="font-ui text-sm tabular-nums w-8 text-right">{Math.ceil(left / 1000)}s</span>
    </div>
  );
}

/** The one instruction, big. The goal sits above it during a scene, because people forget. */
function Say({ text, goal }: { text: string; goal?: string }) {
  return (
    <div className="flex flex-col gap-3">
      {goal && (
        <p className="ph-goal">
          <span>The goal</span>
          {goal}
        </p>
      )}
      <p key={text} className="ph-say">
        {text}
      </p>
    </div>
  );
}

function ReactionBar({ send }: { send: Send }) {
  const last = useRef(0);
  return (
    <div className="mt-auto pt-2 grid grid-cols-6 gap-2">
      {REACTIONS.map((e) => (
        <button
          key={e}
          className="text-3xl py-2 rounded bg-black/35 active:scale-90 transition"
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

function ConceptForm({ send }: { send: Send }) {
  const [text, setText] = useState("");
  const [ex] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
  return (
    <form
      className="page p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send("concept", { text: text.trim() });
      }}
    >
      <h2 className="font-heading text-2xl uppercase">Make your own hero</h2>
      <p className="text-ink-soft">One line. Be weird. It gets drawn while you play.</p>
      <textarea id="concept" className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={ex} />
      <MicButton onTranscript={(t) => setText(t)} />
      <button className="btn btn-crimson text-lg" type="submit" disabled={!text.trim()}>Make my hero</button>
    </form>
  );
}

const QUICK = quickHeroes as { id: string; pitch: string; hero: Hero }[];

/** Character step: ready-made heroes first (instant), "make your own" one tap away. */
function CharacterPicker({ state, me, send }: { state: GameState; me: Player; send: Send }) {
  const [own, setOwn] = useState(false);
  if (own) {
    return (
      <div className="flex flex-col gap-2">
        <ConceptForm send={send} />
        <button type="button" className="font-ui text-sm underline opacity-80" onClick={() => setOwn(false)}>
          Back to the ready-made heroes
        </button>
      </div>
    );
  }
  const takenBy = (id: string) => state.players.find((p) => p.id !== me.id && p.pick === id);
  return (
    <div className="flex flex-col gap-3">
      <Say text="Pick your hero" />
      <div className="grid grid-cols-2 gap-3">
        {QUICK.map((q) => {
          const taken = !!takenBy(q.id);
          return (
            <button
              key={q.id}
              type="button"
              disabled={taken}
              className={`relative text-left rounded border-2 border-white/15 bg-black/55 p-2 flex flex-col gap-1 transition active:scale-95 ${taken ? "opacity-40" : "hover:border-[var(--signal)]"}`}
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

/** The two join questions, both optional. They shape your hero's power and weakness, and stay private until the reveal. */
function RealForm({ send }: { send: Send }) {
  const [skill, setSkill] = useState("");
  const [fear, setFear] = useState("");
  return (
    <form
      className="page p-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        send("real", { skill: skill.trim(), fear: fear.trim() });
        vibrate(15);
      }}
    >
      <p className="font-heading text-xl uppercase leading-snug">Two quick questions (optional)</p>
      <label className="flex flex-col gap-1">
        <span className="font-ui text-sm">What&apos;s something you&apos;re weirdly good at?</span>
        <input className="input" value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={80} placeholder="parallel parking, finding lost things" autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-ui text-sm">What&apos;s a small thing that scares you?</span>
        <input className="input" value={fear} onChange={(e) => setFear(e.target.value)} maxLength={80} placeholder="geese, voicemails, the deep end" autoComplete="off" />
      </label>
      <p className="text-ink-soft text-xs -mt-1">Your hero gets your knack. It stays secret until the end.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => send("real", { skill: "", fear: "" })}>
          Skip
        </button>
        <button className="btn btn-crimson" type="submit" disabled={!skill.trim() && !fear.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

/** Full Story: three real headlines, tap one. */
function StoryVote({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: Send; deadlineAt: number }) {
  const mine = state.votes[me.id];
  return (
    <div className="flex flex-col gap-3">
      <Timer deadlineAt={deadlineAt} total={15000} />
      <Say text={nowText(state, me.id)} />
      {state.storyOptions.map((o, i) => (
        <button
          key={o.id}
          className={`ph-choice ${mine === o.id ? "on" : ""}`}
          onClick={() => {
            sfx.unlock();
            vibrate(15);
            send("vote", { id: o.id });
          }}
        >
          <span className="font-display text-3xl text-[var(--gilt-bright)] leading-none">{i + 1}</span>
          <span className="flex flex-col gap-1 min-w-0">
            <span className="font-heading text-xl uppercase leading-tight">{o.title}</span>
            <span className="text-sm leading-snug opacity-85 line-clamp-2">{o.teaser}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Back a friend's plan: never your own, and plans that already had a turn are greyed out. */
function BackPlan({ state, me, send, deadlineAt }: { state: GameState; me: Player; send: Send; deadlineAt: number }) {
  const el = eligibleIds(state);
  const others = state.pitches.filter((p) => p.playerId !== me.id && !p.auto);
  const mine = state.votes[me.id];
  if (!others.some((p) => el.has(p.id))) return <Say text="Your plan is up. Eyes on the TV" goal={state.goal} />;
  return (
    <div className="flex flex-col gap-3">
      <Timer deadlineAt={deadlineAt} total={15000} />
      <Say text={nowText(state, me.id)} goal={state.goal} />
      {others.map((p) => {
        const ok = el.has(p.id);
        const pl = state.players.find((x) => x.id === p.playerId);
        return (
          <button
            key={p.id}
            disabled={!ok}
            className={`ph-choice ${mine === p.id ? "on" : ""} ${ok ? "" : "opacity-40"}`}
            onClick={() => {
              vibrate(15);
              send("vote", { id: p.id });
            }}
          >
            <span className="flex flex-col gap-1 min-w-0">
              <span className="font-heading text-lg uppercase leading-tight" style={{ color: pl?.color }}>
                {pl?.hero?.name}
                {ok ? "" : " · had a turn"}
              </span>
              <span className="text-base leading-snug">“{p.verdict && p.verdict.moderation !== "ok" ? p.verdict.interpretation : p.text}”</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PitchForm({ state, send, deadlineAt }: { state: GameState; send: Send; deadlineAt: number }) {
  const [text, setText] = useState("");
  const [ex] = useState(() => PLAN_EXAMPLES[Math.floor(Math.random() * PLAN_EXAMPLES.length)]);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        send("pitch", { text: text.trim() });
        vibrate(20);
      }}
    >
      <Timer deadlineAt={deadlineAt} total={40000} />
      <Say text="What does your hero do?" goal={state.goal} />
      <textarea className="input min-h-28 text-lg" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={`e.g. ${ex}`} />
      <MicButton onTranscript={(t) => setText(t)} />
      <button className="btn btn-crimson text-xl" type="submit" disabled={!text.trim()}>
        Send my plan
      </button>
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

  if (stage === "landed" || state.phase === "final_result") return <Say text="Eyes on the TV" />;
  if (stage === "tumble" || (shook && stage === "shake")) return <Say text={auto ? "The table rolled for you. Watch the TV" : "In the air! Watch the TV"} />;
  if (shakeTime) return <BigButton label="SHAKE!" sub="Shake your phone, or tap here" tone="gilt" onClick={() => roll.current()} />;
  if (stage === "count")
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <span key={beat} className="font-display leading-none ouar-stamp-slam" style={{ fontSize: "9rem", ["--ouar-rot" as string]: "0deg" }}>
          {beat}
        </span>
        <p className="ph-say">Battle cry on SHAKE!</p>
      </div>
    );
  if (armed) return <Say text="Armed. When the TV says SHAKE, shake your phone" />;
  return (
    <BigButton
      label="ARM"
      sub="Tap to arm the die. Then everyone shakes at once."
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

/** What you walk away with: your hero, your award, your own words, and the real story. */
function Keepsake({ state, me, portrait }: { state: GameState; me: Player; portrait?: string }) {
  const book = state.storybook;
  if (!book) return <Say text="Binding your keepsake…" />;
  const mine = book.hero_pages.find((h) => h.hero_id === me.id);
  const said = state.log.filter((l) => l.heroId === me.id && !l.flagged).map((l) => l.pitch)[0];
  const img = me.pick ? `/heroes/${me.pick}.webp` : portrait;
  return (
    <div className="flex flex-col gap-3">
      <div className="page p-5 flex flex-col gap-3 fade-in">
        <span className="font-ui text-xs uppercase tracking-[0.25em] text-[var(--gilt-bright)]">Your keepsake</span>
        <h2 className="font-display text-4xl uppercase leading-none">{book.title}</h2>
        <div className="flex gap-3 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img && <img src={img} alt="" className="portrait-oval w-24 h-32 shrink-0" />}
          <div className="flex flex-col gap-2 min-w-0">
            <p className="font-heading text-xl font-bold uppercase leading-tight">{me.hero?.name}</p>
            {mine && <p className="font-ui text-sm uppercase tracking-widest text-[var(--gilt-bright)]">{mine.award}</p>}
            {mine && <p className="leading-snug">{mine.best_moment}</p>}
          </div>
        </div>
        {said && (
          <p className="italic leading-snug">
            <span className="font-ui not-italic text-xs uppercase tracking-widest text-ink-soft block">Your plan</span>“{said}”
          </p>
        )}
        {state.solvedBy && <p className="font-heading uppercase leading-snug">{state.solvedBy}</p>}
      </div>
      <p className="text-center font-ui text-sm opacity-80">Scan the code on the TV to keep the whole tale.</p>
    </div>
  );
}

export function Phone({ code }: { code: string }) {
  const { state, me, portrait, deadlineAt, send } = usePhone(code);
  // Your plan won: buzz once, so you look down at the ROLL button.
  const won = !!state && !!me && winnerPid(state) === me.id && ["ruling", "roll"].includes(state.phase);
  useEffect(() => {
    if (won) vibrate([40, 60, 40, 60, 160]);
  }, [won]);

  if (!state) {
    return (
      <Shell>
        <Say text={`Finding table ${code}…`} />
        <p className="font-ui text-sm opacity-80">Make sure the game is open on the laptop or TV.</p>
      </Shell>
    );
  }
  if (!me) {
    if (state.phase !== "lobby") return <Shell state={state}><Say text="A story is underway. Jump in on the next one!" /></Shell>;
    return <Shell><JoinForm onJoin={(name) => send("join", { name })} /></Shell>;
  }

  const inStory = state.phase !== "lobby" && state.phase !== "storybook";
  if (inStory && me.away) {
    return (
      <Shell me={me} portrait={portrait} state={state}>
        <Say text={`${me.hero?.name ?? "Your hero"} is on autopilot`} />
        <BigButton label="I'M BACK" sub="Take your hero back" tone="gilt" onClick={() => send("back")} />
      </Shell>
    );
  }

  const goal = SCENE_PHASES.includes(state.phase) ? state.goal : "";
  const passive = (text = nowText(state, me.id)) => (
    <>
      <Say text={text} goal={goal} />
      <ReactionBar send={send} />
    </>
  );
  let body: React.ReactNode;

  switch (state.phase) {
    case "lobby":
      if (me.status === "building" && !me.hero) {
        body = me.real === undefined ? <RealForm send={send} /> : <Say text="Your hero is being drawn. Hang tight" />;
      } else if (me.hero) {
        body = (
          <div className="flex flex-col gap-3">
            {me.real === undefined ? <RealForm send={send} /> : <Say text="You're in. Waiting for the story to start" />}
            <HeroCard player={me} portrait={me.pick ? `/heroes/${me.pick}.webp` : me.hasPortrait ? portrait : undefined} showRoast={false} />
            <button className="font-ui text-sm underline opacity-80" onClick={() => send("redraw")}>
              Pick a different hero
            </button>
          </div>
        );
      } else {
        body = <CharacterPicker state={state} me={me} send={send} />;
      }
      break;
    case "story_vote":
      body = <StoryVote state={state} me={me} send={send} deadlineAt={deadlineAt} />;
      break;
    case "pitch":
      body = state.pitches.some((p) => p.playerId === me.id) ? passive() : <PitchForm key={state.sceneIndex} state={state} send={send} deadlineAt={deadlineAt} />;
      break;
    case "roll": {
      const mine = state.rolls[0]?.playerId === me.id;
      const shown = state.revealed.includes(me.id);
      body =
        mine && !shown ? (
          <div className="flex flex-col gap-3">
            <Timer deadlineAt={deadlineAt} total={10000} />
            <BigButton
              label="ROLL"
              sub="Your plan won. Tap to roll the die"
              onClick={() => {
                sfx.unlock();
                send("roll");
                vibrate([20, 40, 20]);
              }}
            />
          </div>
        ) : (
          passive(mine ? "Eyes on the TV" : undefined)
        );
      break;
    }
    case "vote":
      body = <BackPlan state={state} me={me} send={send} deadlineAt={deadlineAt} />;
      break;
    case "final_roll":
      body = <FinalRollPhone state={state} me={me} send={send} deadlineAt={deadlineAt} />;
      break;
    case "storybook":
      body = <Keepsake state={state} me={me} portrait={portrait} />;
      break;
    default:
      body = passive();
  }

  return (
    <Shell me={me} portrait={portrait} state={state}>
      <div key={state.phase} className="ph-screen">
        {body}
      </div>
    </Shell>
  );
}
