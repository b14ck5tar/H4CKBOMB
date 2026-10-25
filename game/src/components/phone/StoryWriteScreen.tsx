"use client";
/**
 * "Our stories": write a small true story from your life. The real ending stays secret until the reveal.
 *   onSend(story)  ->  send("story", { title, setup, steps, ending })
 */
import { useState } from "react";
import { Fuse, GameButton, Kicker, PrivacyLine, Say, vibrate, type TimerSpec } from "./kit";

export function StoryWriteScreen({
  sent,
  onSend,
  timer,
}: {
  /** state.written.includes(me.id) */
  sent: boolean;
  onSend: (s: { title: string; setup: string; steps: string; ending: string }) => void;
  timer?: TimerSpec;
}) {
  const [title, setTitle] = useState("");
  const [setup, setSetup] = useState("");
  const [steps, setSteps] = useState("");
  const [ending, setEnding] = useState("");
  if (sent)
    return (
      <>
        {timer && <Fuse {...timer} />}
        <Kicker tone="lime">Sent</Kicker>
        <Say text="It stays *secret* until the end" />
        <p className="pk-hint">Nobody sees who wrote it until the reveal.</p>
      </>
    );
  return (
    <form
      className="pk-choices"
      style={{ gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!setup.trim() || !ending.trim()) return;
        vibrate([20, 40, 20]);
        onSend({ title: title.trim(), setup: setup.trim(), steps: steps.trim(), ending: ending.trim() });
      }}
    >
      {timer && <Fuse {...timer} />}
      <Kicker tone="pink">Our stories</Kicker>
      <Say text="Write a small *true story*" small />
      <label className="pk-field">
        <span className="pk-label">A title</span>
        <input className="pk-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="The night the dog ate my keys" autoComplete="off" />
      </label>
      <label className="pk-field">
        <span className="pk-label">How it started</span>
        <textarea className="pk-input" style={{ minHeight: 92 }} value={setup} onChange={(e) => setSetup(e.target.value)} maxLength={400} placeholder="I was locked out at midnight and…" />
      </label>
      <label className="pk-field">
        <span className="pk-label">
          What happened next <small>optional</small>
        </span>
        <textarea className="pk-input" style={{ minHeight: 76 }} value={steps} onChange={(e) => setSteps(e.target.value)} maxLength={400} placeholder="Then I tried…" />
      </label>
      <label className="pk-field">
        <span className="pk-label">
          How it really ended <small>secret until the end</small>
        </span>
        <textarea className="pk-input" style={{ minHeight: 76 }} value={ending} onChange={(e) => setEnding(e.target.value)} maxLength={300} placeholder="A neighbor had a ladder…" />
      </label>
      <p className="pk-hint">Keep it light and kind. Nobody sees who wrote it until the end.</p>
      <PrivacyLine />
      <GameButton type="submit" disabled={!setup.trim() || !ending.trim()}>
        Send my story
      </GameButton>
    </form>
  );
}
