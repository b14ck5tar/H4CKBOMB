"use client";
/**
 * The grand finale, three beats:
 *   FinalePitchScreen  everyone types the final move            onPitch(text) -> send("pitch", { text })
 *   BackPlanScreen     back a friend's plan (never your own)     onVote(id)    -> send("vote", { id })
 *   ShakeScreen        ARM, 3-2-1, SHAKE (one shared die)        onArm -> send("arm"), onShake -> send("roll")
 * ShakeScreen carries the builder's FinalRollPhone logic as-is (optimistic arm/shake, iOS motion permission asked
 * inside the tap, devicemotion threshold, count-beat buzzes), restyled.
 */
import { useEffect, useRef, useState } from "react";
import type { FinalRoll, Pitch, Player } from "@/lib/types";
import { shortName } from "@/lib/now";
import { sfx } from "@/lib/sfx";
import { Face, Fuse, GameButton, Goal, Kicker, PlanBox, Say, TvGlyph, heroImg, vibrate, type TimerSpec } from "./kit";

const PLAN_EXAMPLES = ["I use my knack for this, of course", "We all pull at once on three", "I ask it nicely, one last time"];

export function FinalePitchScreen({
  sent,
  goal,
  max,
  onPitch,
  onTyping,
  voice = false,
  timer,
}: {
  /** show the small "hold to speak" under the box (typing stays the default) */
  voice?: boolean;
  /** this player's pitch text if already in (state.pitches) */
  sent?: string;
  goal?: string;
  max: number;
  onPitch: (text: string) => void;
  onTyping?: () => void;
  timer?: TimerSpec;
}) {
  const [text, setText] = useState("");
  const [ex] = useState(() => PLAN_EXAMPLES[Math.floor(Math.random() * PLAN_EXAMPLES.length)]);
  if (sent)
    return (
      <>
        {timer && <Fuse {...timer} />}
        <Kicker tone="amber">Grand finale</Kicker>
        <Say text="Final move in. *Talk it over*" small />
        <p className="pk-note">
          <small>Your final move</small>“{sent}”
        </p>
        <Goal goal={goal} />
      </>
    );
  return (
    <form
      className="pk-choices"
      style={{ flex: 1, gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        vibrate([20, 40, 30]);
        onPitch(text.trim());
      }}
    >
      {timer && <Fuse {...timer} />}
      <div className="pk-burst" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Kicker tone="amber">Grand finale</Kicker>
        <Say text="What’s the *final move?*" />
      </div>
      <Goal goal={goal} />
      <PlanBox value={text} onChange={setText} max={max} onTyping={onTyping} placeholder={`e.g. ${ex}`} hint="Everyone writes one. The table backs the best." onVoice={voice ? setText : undefined} />
      <div className="pk-bottom">
        <GameButton type="submit" tone="amber" xl disabled={!text.trim()}>
          Lock it in
        </GameButton>
      </div>
    </form>
  );
}

export function BackPlanScreen({
  pitches,
  players,
  meId,
  mine,
  eligible,
  portraitOf,
  goal,
  onVote,
  timer,
}: {
  pitches: Pitch[];
  players: Player[];
  meId: string;
  /** state.votes[me.id] */
  mine?: string;
  /** eligibleIds(state) */
  eligible: Set<string>;
  portraitOf?: (p: Player) => string | undefined;
  goal?: string;
  onVote: (id: string) => void;
  timer?: TimerSpec;
}) {
  const others = pitches.filter((p) => p.playerId !== meId && !p.auto);
  if (!others.some((p) => eligible.has(p.id)))
    return (
      <>
        <div className="pk-choices pk-center" style={{ gap: 12 }}>
          <TvGlyph />
          <Kicker tone="pink">The table decides</Kicker>
          <Say text="Your plan is up. *Eyes on the TV*" small />
        </div>
        <Goal goal={goal} />
      </>
    );
  return (
    <>
      {timer && <Fuse {...timer} />}
      <Kicker tone="amber">Grand finale</Kicker>
      <Say text={mine ? "Backed! Tap another to *switch*" : "Back a *friend’s* plan"} small />
      <p className="pk-hint">Not your own. The plan with the most backers gets the final roll.</p>
      <div className="pk-choices">
        {others.map((p, i) => {
          const ok = eligible.has(p.id);
          const on = mine === p.id;
          const pl = players.find((x) => x.id === p.playerId);
          const text = p.verdict && p.verdict.moderation !== "ok" ? p.verdict.interpretation : p.text;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!ok}
              className={`pk-plan ${on ? "is-on" : ""}`}
              style={{ ["--c" as string]: pl?.color ?? "#3de7ff", ["--i" as string]: i } as React.CSSProperties}
              aria-pressed={on}
              onClick={() => {
                vibrate(on ? 8 : [12, 30, 18]);
                onVote(p.id);
              }}
            >
              <Face player={pl} src={heroImg(pl, pl ? portraitOf?.(pl) : undefined)} />
              <span className="pk-plan-body">
                <span className="pk-plan-who">
                  {shortName(pl?.hero?.name) || "A friend"}
                  {!ok && <small> · had a turn</small>}
                </span>
                <span className="pk-plan-txt">“{text}”</span>
              </span>
              {on && <span className="pk-plus" style={{ fontSize: "0.9rem" }}>Yes!</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------- the shared final roll ----------
const SHAKE_THRESHOLD = 14; // m/s² of motion (gravity removed): a deliberate shake, not a wobble

/** iOS only lets a page read motion after asking, and only from inside a tap. */
function askMotion(): Promise<unknown> {
  try {
    const DME = (typeof window !== "undefined" ? window.DeviceMotionEvent : undefined) as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (DME && typeof DME.requestPermission === "function") return DME.requestPermission().catch(() => "denied");
  } catch {}
  return Promise.resolve("granted");
}

function PhoneShakeIcon() {
  return (
    <svg className="pk-phone-ico" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden>
      <rect x="20" y="8" width="24" height="48" rx="5" />
      <path d="M29 48h6" />
      <path d="M10 22c-3 6-3 14 0 20M54 22c3 6 3 14 0 20" />
    </svg>
  );
}

/** Finale talk: the plans are on the TV; argue out loud, then tap ready (everyone ready = the vote starts early). */
export function TalkScreen({ ready, onReady, goal, deadlineAt }: { ready: boolean; onReady: () => void; goal?: string; deadlineAt?: number }) {
  // The full length comes from the host's deadline (30 s in judge mode, 60 s otherwise), never hard-coded here.
  const first = useRef<{ dl: number; ms: number } | null>(null);
  if (deadlineAt && first.current?.dl !== deadlineAt) first.current = { dl: deadlineAt, ms: Math.max(5000, Math.round((deadlineAt - Date.now()) / 5000) * 5000) };
  return (
    <>
      {deadlineAt && first.current && <Fuse deadlineAt={deadlineAt} total={first.current.ms} />}
      <div className="pk-choices pk-center" style={{ gap: 16 }}>
        <Kicker tone="pink">The final move</Kicker>
        <Say text="*Talk it out!* Convince the table out loud" />
        <p className="pk-hint pk-hint-bright">Every plan is on the TV. Which one saves the day?</p>
        {ready ? (
          <p className="pk-hint">Ready. Waiting for the others…</p>
        ) : (
          <GameButton
            tone="lime"
            xl
            onClick={() => {
              vibrate(20);
              onReady();
            }}
          >
            I&apos;m ready to vote
          </GameButton>
        )}
      </div>
      <Goal goal={goal} />
    </>
  );
}

export function ShakeScreen({
  final,
  phase,
  meId,
  deadlineAt,
  onArm,
  onShake,
  onUnlock,
}: {
  final: FinalRoll | null;
  /** state.phase ("final_roll" | "final_result") */
  phase: string;
  meId: string;
  deadlineAt: number;
  onArm: () => void;
  onShake: () => void;
  /** sfx.unlock() inside the ARM tap */
  onUnlock?: () => void;
}) {
  const stage = final?.stage ?? "arm";
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
  const armed = !!final?.armed?.includes(meId) || (armedAt > 0 && now - armedAt < 2500);
  const shook = !!final?.shook?.includes(meId) || (sentAt > 0 && now - sentAt < 1500);
  const auto = !!final?.auto?.includes(meId);

  const roll = useRef<() => void>(() => {});
  roll.current = () => {
    if (shook) return;
    onShake();
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

  // One clear state at every step (CD: "the buttons needed work for the final roll").
  const Step = ({ n, children, tone }: { n: string; children: React.ReactNode; tone: "amber" | "lime" | "pink" }) => (
    <span className={`pk-step is-${tone}`}>
      <b>{n}</b>
      {children}
    </span>
  );
  const press = () => {
    vibrate(25);
    sfx.pop();
  };

  if (stage === "landed" || phase === "final_result")
    return (
      <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 14 }}>
        <TvGlyph />
        <Kicker tone="pink">The final roll</Kicker>
        <Say text="Eyes on the *TV*" />
      </div>
    );
  if (stage === "tumble" || (shook && stage === "shake"))
    return (
      <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 16 }}>
        <Step n="✓" tone="lime">
          Done
        </Step>
        <TvGlyph />
        <Say text={auto ? "The table rolled for you. *Watch the TV*" : "In the air! *Watch the TV*"} />
        <p className="pk-hint">Waiting for the others…</p>
      </div>
    );
  if (shakeTime)
    return (
      <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 18 }}>
        <Step n="3" tone="amber">
          Shake or tap!
        </Step>
        <PhoneShakeIcon />
        <Say text="*SHAKE* your phone!" />
        <GameButton
          tone="amber"
          xl
          className="pk-roll-btn"
          onClick={() => {
            press();
            roll.current();
          }}
        >
          Or tap here to roll
        </GameButton>
      </div>
    );
  if (stage === "count")
    return (
      <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 6 }}>
        <Step n="2" tone="lime">
          Armed: get ready
        </Step>
        <div className="pk-countdown">
          <span key={beat}>{beat}</span>
        </div>
        <Say text="On *SHAKE*: shake your phone or tap the button" small />
      </div>
    );
  return (
    <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 18 }}>
      <Step n={armed ? "2" : "1"} tone={armed ? "lime" : "pink"}>
        {armed ? "Armed: wait for SHAKE" : "Tap to arm"}
      </Step>
      <Kicker tone="amber">The final roll · one die, all of you</Kicker>
      {armed ? (
        <>
          <span className="pk-armed-big" role="status">
            Armed ✓
          </span>
          <p className="pk-hint">When the TV says SHAKE: shake your phone or tap the big button.</p>
        </>
      ) : (
        <GameButton
          tone="pink"
          xl
          className="pk-roll-btn"
          onClick={() => {
            press();
            onUnlock?.();
            setArmedAt(Date.now());
            // Ask for motion inside the tap (iOS), then tell the table we're ready.
            askMotion().then(() => onArm());
          }}
        >
          Tap to arm
        </GameButton>
      )}
    </div>
  );
}
