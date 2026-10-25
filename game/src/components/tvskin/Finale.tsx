"use client";
/**
 * The grand finale, three screens in the TV skin. One verb per step, matching the phone:
 *   FinalePitch  WRITE  "What's the final move?"  sealed plan cards fly in, "2 of 4 in"
 *   FinaleVote   BACK   the plans face up, live vote dots, can't back your own, countdown
 *   FinaleShake  ARM -> 3,2,1 -> SHAKE! -> ROLLING   one shared d20, a fill meter of phones
 */
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sound";
import { D20Glyph, Face, Words, possessive, type Css } from "./shared";
import { flashScreen, shakeStage } from "./motion";

export interface FinaleHero {
  /** Player id. */
  id: string;
  /** Hero name (what the table calls them). */
  name: string;
  color: string;
  portrait?: string;
}
export interface FinalePlan {
  id: string;
  /** Who wrote it (FinaleHero.id). */
  playerId: string;
  /** The plan as the room should read it (masked / steered). */
  text: string;
  /** false = this hero hung back and can't be backed (shown dimmed). Default true. */
  eligible?: boolean;
}

const TILTS = [-4, 3, -2, 4, -3, 2];
/** Seconds left from a deadline timestamp, ticking. */
function useSecondsLeft(deadlineAt?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineAt) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [deadlineAt]);
  return deadlineAt ? Math.max(0, Math.ceil((deadlineAt - now) / 1000)) : undefined;
}
/** Plays `name` whenever `n` grows. */
function useGrowSfx(n: number, name: string, volume = 0.7) {
  const last = useRef(n);
  useEffect(() => {
    if (n > last.current) playSfx(name, { volume, pitch: Math.min(10, n * 2) });
    last.current = n;
  }, [n, name, volume]);
}

function Countdown({ deadlineAt, totalSeconds }: { deadlineAt?: number; totalSeconds?: number }) {
  const left = useSecondsLeft(deadlineAt);
  if (left === undefined || !deadlineAt) return null;
  return (
    <div className={`tvx-fin-clock ${left <= 5 ? "is-low" : ""}`} aria-label={`${left} seconds left`}>
      <ClockBar key={deadlineAt} deadlineAt={deadlineAt} totalSeconds={totalSeconds} />
      <span key={left} className="tvx-fin-clock-n">
        {left}
      </span>
    </div>
  );
}
/** The draining bar: one CSS animation per deadline (transform only), so it never jumps on re-render. */
function ClockBar({ deadlineAt, totalSeconds }: { deadlineAt: number; totalSeconds?: number }) {
  const [st] = useState<Css>(() => {
    const left = Math.max(0, (deadlineAt - Date.now()) / 1000);
    const total = Math.max(left, totalSeconds ?? left, 0.1);
    return { "--left": `${left.toFixed(2)}s`, "--from": (left / total).toFixed(3) };
  });
  return <span className="tvx-fin-clock-bar" style={st} />;
}

// ---------- WRITE ----------
export interface FinalePitchProps {
  heroes: FinaleHero[];
  /** Plans submitted so far (text stays sealed on this screen). */
  plans: { id: string; playerId: string }[];
  /** Player ids typing right now (their slot shows "writing…"). */
  typing?: string[];
  /** The situation, one or two sentences. */
  situation?: string;
  question?: string;
  deadlineAt?: number;
  totalSeconds?: number;
  sound?: boolean;
}

/** "What's the final move?" Everyone writes on their phone; each plan lands as a sealed card. */
export function FinalePitch({ heroes, plans, typing = [], situation, question = "What’s the final move?", deadlineAt, totalSeconds, sound = true }: FinalePitchProps) {
  const inIds = new Set(plans.map((p) => p.playerId));
  useGrowSfx(sound ? plans.length : 0, "submit");
  const all = heroes.length > 0 && plans.length >= heroes.length;
  return (
    <section className="tvx-fin tvx-fin-pitch" aria-label="The grand finale: write your final move">
      <header className="tvx-fin-head">
        <p className="tvx-fin-kicker">The grand finale</p>
        <h2 className="tvx-fin-q">
          <Words text={question} step={0.07} start={0.2} />
        </h2>
        {situation && <p className="tvx-fin-sit">{situation}</p>}
      </header>
      <div className={`tvx-fin-tally ${all ? "is-all" : ""}`} aria-live="polite">
        <span key={plans.length} className="tvx-fin-tally-n">
          {plans.length}
        </span>
        <span className="tvx-fin-tally-of">of {heroes.length} in</span>
      </div>
      <Countdown deadlineAt={deadlineAt} totalSeconds={totalSeconds} />
      <div className="tvx-fin-row">
        {heroes.map((h, i) => {
          const done = inIds.has(h.id);
          const st: Css = { "--c": h.color, "--tilt": `${TILTS[i % TILTS.length]}deg`, "--i": i };
          return (
            <div key={h.id} className={`tvx-seal ${done ? "is-in" : typing.includes(h.id) ? "is-typing" : ""}`} style={st}>
              {done ? (
                <div className="tvx-seal-card">
                  <D20Glyph label="" className="tvx-seal-d20" />
                  <Face src={h.portrait} name={h.name} color={h.color} size={4.4} />
                  <span className="tvx-seal-name">{h.name}</span>
                  <span className="tvx-seal-in">Plan in!</span>
                </div>
              ) : (
                <div className="tvx-seal-empty">
                  <Face src={h.portrait} name={h.name} color={h.color} size={3.4} />
                  <span className="tvx-seal-name">{h.name}</span>
                  <span className="tvx-seal-dots" aria-label={typing.includes(h.id) ? "writing" : "waiting"}>
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="tvx-fin-verb">Write your final move on your phone</p>
    </section>
  );
}

// ---------- BACK ----------
export interface FinaleVoteProps {
  heroes: FinaleHero[];
  plans: FinalePlan[];
  /** voter id -> plan id. */
  votes: Record<string, string>;
  deadlineAt?: number;
  totalSeconds?: number;
  title?: string;
  sound?: boolean;
}

/** The plans face up; every phone backs a friend's plan (never their own). Vote dots land live; the leader glows. */
export function FinaleVote({ heroes, plans, votes, deadlineAt, totalSeconds, title = "Back a friend’s plan", sound = true }: FinaleVoteProps) {
  const byId = new Map(heroes.map((h) => [h.id, h]));
  const tally = new Map<string, string[]>();
  for (const [voter, plan] of Object.entries(votes)) tally.set(plan, [...(tally.get(plan) ?? []), voter]);
  const max = Math.max(0, ...plans.map((p) => tally.get(p.id)?.length ?? 0));
  const leaders = plans.filter((p) => max > 0 && (tally.get(p.id)?.length ?? 0) === max).map((p) => p.id);
  const n = plans.length;
  const cols = n <= 2 ? n : n === 4 ? 2 : 3;
  useGrowSfx(sound ? Object.keys(votes).length : 0, "vote");
  const voted = Object.keys(votes).length;
  return (
    <section className="tvx-fin tvx-fin-vote" aria-label="Back a friend's final plan">
      <header className="tvx-fin-vhead">
        <h2 className="tvx-fin-vtitle">
          <Words text={title} step={0.06} start={0.1} />
        </h2>
        <p className="tvx-fin-rule">You can&apos;t back your own</p>
        <p className="tvx-fin-vcount">
          <b key={voted}>{voted}</b> of {heroes.length} backed
        </p>
        <Countdown deadlineAt={deadlineAt} totalSeconds={totalSeconds} />
      </header>
      <div className={`tvx-fin-grid cols-${cols} n-${n}`}>
        {plans.map((p, i) => {
          const h = byId.get(p.playerId);
          if (!h) return null;
          const voters = tally.get(p.id) ?? [];
          const lead = leaders.length === 1 && leaders[0] === p.id;
          const st: Css = { "--c": h.color, "--tilt": `${TILTS[i % TILTS.length] * 0.5}deg`, "--i": i };
          return (
            <article key={p.id} className={`tvx-vcard ${p.eligible === false ? "is-out" : ""} ${lead ? "is-lead" : ""}`} style={st}>
              <div className="tvx-vcard-in">
                <header className="tvx-vcard-who">
                  <Face src={h.portrait} name={h.name} color={h.color} size={3.6} />
                  <span>{possessive(h.name)} plan</span>
                  {lead && <span className="tvx-vcard-lead">Leading</span>}
                  {p.eligible === false && <span className="tvx-vcard-out">Hung back</span>}
                </header>
                <p className={`tvx-vcard-txt ${p.text.length > 90 ? "is-long" : ""}`}>&ldquo;{p.text}&rdquo;</p>
                <footer className="tvx-vcard-votes" aria-label={`${voters.length} backing`}>
                  {voters.map((v) => {
                    const vh = byId.get(v);
                    return (
                      <span key={v} className="tvx-vdot" style={{ ["--vc" as string]: vh?.color ?? "#fff" } as Css}>
                        <Face src={vh?.portrait} name={vh?.name ?? "?"} color={vh?.color ?? "#fff"} size={2.6} />
                      </span>
                    );
                  })}
                  {voters.length > 0 && <b key={voters.length} className="tvx-vcount">{voters.length}</b>}
                </footer>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------- TALK (convince each other, before the vote) ----------
export interface FinaleTalkProps {
  heroes: FinaleHero[];
  plans: FinalePlan[];
  /** Heroes who tapped "I'm ready to vote". */
  ready: string[];
  deadlineAt?: number;
  totalSeconds?: number;
}

/** Every final plan face up and BIG, a 60 s clock: the table argues out loud, phones tap "ready to vote". */
export function FinaleTalk({ heroes, plans, ready, deadlineAt, totalSeconds = 60 }: FinaleTalkProps) {
  const byId = new Map(heroes.map((h) => [h.id, h]));
  const n = plans.length;
  const cols = n <= 2 ? n : n === 4 ? 2 : 3;
  useGrowSfx(ready.length, "pop", 0.5);
  return (
    <section className="tvx-fin tvx-fin-vote tvx-fin-talk" aria-label="Convince each other">
      <header className="tvx-fin-vhead">
        <h2 className="tvx-fin-vtitle">
          <Words text="Convince each other!" step={0.06} start={0.1} />
        </h2>
        <p className="tvx-fin-rule">Talk it out loud. Which plan saves the day?</p>
        <p className="tvx-fin-vcount">
          <b key={ready.length}>{ready.length}</b> of {heroes.length} ready to vote
        </p>
        <Countdown deadlineAt={deadlineAt} totalSeconds={totalSeconds} />
      </header>
      <div className={`tvx-fin-grid cols-${cols} n-${n}`}>
        {plans.map((p, i) => {
          const h = byId.get(p.playerId);
          if (!h) return null;
          const st: Css = { "--c": h.color, "--tilt": `${TILTS[i % TILTS.length] * 0.5}deg`, "--i": i };
          return (
            <article key={p.id} className={`tvx-vcard ${ready.includes(p.playerId) ? "is-ready" : ""}`} style={st}>
              <div className="tvx-vcard-in">
                <header className="tvx-vcard-who">
                  <Face src={h.portrait} name={h.name} color={h.color} size={3.6} />
                  <span>{possessive(h.name)} plan</span>
                  {ready.includes(p.playerId) && <span className="tvx-vcard-lead">Ready</span>}
                </header>
                <p className={`tvx-vcard-txt ${p.text.length > 90 ? "is-long" : ""}`}>&ldquo;{p.text}&rdquo;</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------- ARM -> SHAKE ----------
export interface FinaleShakeProps {
  /** Host stage: arm (tap "arm your die"), count (3-2-1), shake (SHAKE!), tumble (die in the air). */
  stage: "arm" | "count" | "shake" | "tumble";
  heroes: FinaleHero[];
  /** Phones armed (arm stage) and phones shaken (shake/tumble). */
  armed?: string[];
  shook?: string[];
  /** The count beat during "count" (3, 2, 1). */
  beat?: number;
  /** Whose plan is being rolled, and the plan text. */
  planBy?: FinaleHero;
  plan?: string;
  sound?: boolean;
}

const CALL: Record<FinaleShakeProps["stage"], { verb: string; sub: string }> = {
  arm: { verb: "Arm", sub: "Tap ARM on your phone" },
  count: { verb: "", sub: "Get ready to shake" },
  shake: { verb: "Shake!", sub: "Shake your phone! Yell your battle cry!" },
  tumble: { verb: "Rolling", sub: "One die for all of you" },
};

/** One shared d20. Every phone arms, then shakes; the meter fills with faces and the die rattles harder as it fills. */
export function FinaleShake({ stage, heroes, armed = [], shook = [], beat, planBy, plan, sound = true }: FinaleShakeProps) {
  const ref = useRef<HTMLElement>(null);
  const done = stage === "arm" ? armed : shook;
  const total = Math.max(1, heroes.length);
  const frac = Math.min(1, done.length / total);
  useGrowSfx(sound ? done.length : 0, stage === "arm" ? "tap" : "diceRoll", stage === "arm" ? 0.6 : 0.5);
  useEffect(() => {
    if (stage === "shake") {
      flashScreen(ref.current, "rgba(255,214,80,0.6)", 500);
      shakeStage(ref.current, 0.8);
    }
  }, [stage]);
  const call = CALL[stage];
  const verb = stage === "count" ? String(beat ?? 3) : call.verb;
  // the die rattles harder the more phones are in (duration shrinks, amplitude grows)
  const st: Css = { "--fill": frac, "--rattle": `${(0.5 - frac * 0.32).toFixed(2)}s`, "--amp": (0.4 + frac * 1.4).toFixed(2) };
  return (
    <section ref={ref} className={`tvx-fin tvx-fin-shake is-${stage}`} style={st} aria-label={`Final roll: ${verb || call.sub}`}>
      <header className="tvx-shake-head">
        <p className="tvx-fin-kicker">The final roll · one die · everyone</p>
        {planBy && (
          <p className="tvx-shake-plan" style={{ ["--c" as string]: planBy.color } as Css}>
            <Face src={planBy.portrait} name={planBy.name} color={planBy.color} size={3} />
            <b>{possessive(planBy.name)} plan</b>
            {plan && <span>&ldquo;{plan}&rdquo;</span>}
          </p>
        )}
      </header>
      <div className="tvx-bigdie" aria-hidden>
        <span className="tvx-bigdie-halo" />
        <div className="tvx-bigdie-rattle">
          <D20Glyph label="?" className="tvx-bigdie-svg" />
        </div>
      </div>
      {verb && (
        <p key={verb} className={`tvx-shake-call ${stage === "count" ? "is-beat" : ""}`}>
          {verb}
        </p>
      )}
      <p key={stage} className="tvx-shake-sub">
        {call.sub}
      </p>
      <div className="tvx-shake-meter" aria-label={`${done.length} of ${heroes.length} ${stage === "arm" ? "armed" : "shaken"}`}>
        <div className="tvx-shake-track">
          <span className="tvx-shake-fill" />
          {heroes.map((h, i) => {
            const on = done.includes(h.id);
            return (
              <span key={h.id} className={`tvx-shake-slot ${on ? "on" : ""}`} style={{ ["--c" as string]: h.color, ["--i" as string]: i } as Css}>
                <Face src={h.portrait} name={h.name} color={h.color} size={3.2} />
              </span>
            );
          })}
        </div>
        <p className="tvx-shake-count">
          <b key={done.length}>{done.length}</b> of {heroes.length} {stage === "arm" ? "armed" : "shaken"}
        </p>
      </div>
    </section>
  );
}
