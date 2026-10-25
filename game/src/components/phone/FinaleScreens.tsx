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
      <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 14 }}>
        <TvGlyph />
        <Kicker tone="lime">{auto ? "Rolled for you" : "Nice shake"}</Kicker>
        <Say text={auto ? "The table rolled for you. *Watch the TV*" : "In the air! *Watch the TV*"} small />
      </div>
    );
  if (shakeTime)
    return (
      <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 18 }}>
        <PhoneShakeIcon />
        <Say text="*SHAKE* your phone!" />
        <button className="pk-arcade is-shake" data-tone="amber" onClick={() => roll.current()} aria-label="Shake: roll the die">
          <span className="pk-arcade-halo" />
          <span className="pk-arcade-ring" />
          <span className="pk-arcade-base" />
          <span className="pk-arcade-cap">
            Shake!
            <small>or tap here</small>
          </span>
        </button>
      </div>
    );
  if (stage === "count")
    return (
      <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 6 }}>
        <Kicker tone="pink">Get ready</Kicker>
        <div className="pk-countdown">
          <span key={beat}>{beat}</span>
        </div>
        <Say text="Get ready to *shake*. Battle cry on SHAKE!" small />
      </div>
    );
  return (
    <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 18 }}>
      <Kicker tone="amber">The final roll · one die, all of you</Kicker>
      <Say text={armed ? "Armed. Wait for *SHAKE*" : "Tap *ARM* on your phone"} small />
      <button
        className="pk-arcade"
        data-tone={armed ? "lime" : undefined}
        disabled={armed}
        onClick={() => {
          if (armed) return;
          onUnlock?.();
          vibrate(30);
          setArmedAt(Date.now());
          // Ask for motion inside the tap (iOS), then tell the table we're ready.
          askMotion().then(() => onArm());
        }}
        aria-label={armed ? "Armed" : "Arm the die"}
      >
        {!armed && <span className="pk-arcade-halo" />}
        {!armed && <span className="pk-arcade-ring" />}
        <span className="pk-arcade-base" />
        <span className="pk-arcade-cap">
          {armed ? "Armed" : "Arm"}
          <small>{armed ? "locked in" : "tap to arm"}</small>
        </span>
      </button>
      {armed ? (
        <span className="pk-armed">
          <i /> When the TV says SHAKE, shake your phone
        </span>
      ) : (
        <p className="pk-hint">Then everyone shakes at once.</p>
      )}
    </div>
  );
}
