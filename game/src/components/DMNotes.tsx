"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { DMNote, GameState, NoteKind } from "@/lib/types";
import { mask } from "@/lib/mask";

// DM's Notes: what the AI Dungeon Master knows, the rules it plays by, and every call it made, live.
// Shown as a slide-in panel on the TV (press N) and full screen at /notes?code=ABCD for judges.

export const FILTER_NOTE = "Every story passes a tragedy filter first: no deaths, injuries, crime, war, disease or politics.";

const RULES: { icon: string; text: string }[] = [
  { icon: "🎲", text: "Dice are real random numbers from code. The AI never picks a number." },
  { icon: "🧠", text: "The AI only judges ideas and narrates. Bonuses, totals and Hope are plain math." },
  { icon: "🚫", text: "No real people or brands in the story. Real places only in the broadest sense." },
  { icon: "🛡️", text: "Tragedies are filtered out. Only strange-but-harmless news becomes a story." },
  { icon: "🪞", text: "Mirror sentences are kind-only. Anything mean is rewritten and never shown." },
];

const KIND: Record<NoteKind, { label: string; color: string }> = {
  source: { label: "Source", color: "#FFB648" },
  reveal: { label: "Reveal", color: "#FFB648" },
  scene: { label: "Scene", color: "#3DE7FF" },
  hero: { label: "Hero", color: "#7CC4FF" },
  clue: { label: "Clue", color: "#8FDCFF" },
  ruling: { label: "Ruling", color: "#FF9A1F" },
  appeal: { label: "Argument", color: "#B98CFF" },
  roll: { label: "Dice", color: "#2CF5C0" },
  boost: { label: "Boost", color: "#FF7A45" },
  catch: { label: "Catch!", color: "#FF7A45" },
  hope: { label: "Hope", color: "#FF2E7E" },
  safety: { label: "Safety", color: "#9CFF8A" },
  fallback: { label: "Backup", color: "#FFE14D" },
  mirror: { label: "Mirror", color: "#D9B8FF" },
};

const SECRET_PHASES = ["lobby", "quest", "narrating", "pitch"];

const clock = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

function Section({ title, children, accent = "var(--gilt-bright)" }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-ui uppercase tracking-[0.2em] text-sm font-bold" style={{ color: accent }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function LogLine({ n }: { n: DMNote }) {
  const k = KIND[n.kind] ?? KIND.scene;
  return (
    <li className="flex gap-3 items-start border-l-4 pl-3 py-1" style={{ borderColor: k.color }}>
      <div className="flex flex-col items-start shrink-0 w-[5.5em]">
        <span className="font-ui text-xs font-bold uppercase tracking-wider px-1.5 rounded-sm text-[#0A0612]" style={{ background: k.color }}>
          {k.label}
        </span>
        <span className="font-ui text-xs text-parchment/55 tabular-nums mt-0.5">{clock(n.t)}</span>
      </div>
      <p className="leading-snug min-w-0">
        <b className="font-heading uppercase tracking-wide" style={{ color: k.color }}>
          {mask(n.who)}
        </b>{" "}
        <span className="text-parchment/95">{mask(n.text)}</span>
      </p>
    </li>
  );
}

function JudgeQR({ code }: { code: string }) {
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${location.origin}/notes?code=${code}`;
    setUrl(u);
    QRCode.toDataURL(u, { margin: 1, width: 220, color: { dark: "#0A0612", light: "#F5F1FF" } }).then(setQr);
  }, [code]);
  return (
    <div className="flex items-center gap-4 rounded border border-[var(--signal)]/50 bg-black/30 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt="QR code for the judges' DM's Notes view" className="w-28 h-28 rounded shrink-0" />}
      <div className="flex flex-col gap-1 min-w-0">
        <p className="font-heading text-xl uppercase text-[var(--signal)]">Judges: scan to follow along</p>
        <p className="font-ui text-xs text-parchment/60 break-all">{url}</p>
      </div>
    </div>
  );
}

/** The panel body: shared by the TV slide-in and the judges' full-screen page. */
export function DMNotesBody({ s, showQR = false }: { s: GameState; showQR?: boolean }) {
  const n = s.notes;
  const src = n.source;
  const heroes = s.players.filter((p) => p.hero);
  const secret = SECRET_PHASES.includes(s.phase);
  const scene = s.scenes[s.sceneIndex];
  const log = [...n.log].reverse();
  const st = n.stats;
  return (
    <div className="flex flex-col gap-6">
      {showQR && <JudgeQR code={s.code} />}

      <Section title="The source">
        {src ? (
          <div className="flex flex-col gap-1">
            <p className="font-heading text-2xl leading-tight">“{src.headline}”</p>
            <p className="font-ui text-sm text-parchment/70">
              {src.source} · {src.date}
            </p>
            <p className="leading-snug text-parchment/90">{src.summary}</p>
            <ul className="flex flex-col gap-1 mt-1">
              {src.mappings.map((m, i) => (
                <li key={i} className="leading-snug">
                  <b className="text-[var(--gilt-bright)]">{m.story}</b> <span className="text-parchment/60">←</span> {m.real}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="font-heading text-2xl leading-tight">Real story: hidden until the end</p>
            <p className="text-parchment/75 leading-snug">So it can&apos;t spoil the twist. Every story element maps to a real fact, shown at the reveal.</p>
          </div>
        )}
        <p className="leading-snug">
          <b className="text-[#9CFF8A]">Why it&apos;s safe:</b> {n.safety || "Pick a story to see why it's safe to play."}
        </p>
      </Section>

      <Section title="The rules the DM follows">
        <ul className="flex flex-col gap-1.5">
          {RULES.map((r) => (
            <li key={r.text} className="flex gap-2 leading-snug">
              <span aria-hidden>{r.icon}</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What the DM knows right now" accent="var(--signal)">
        {!s.quest ? (
          <p className="text-parchment/70">Nothing yet. The DM gets its notes when a story starts.</p>
        ) : (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 leading-snug">
            <dt className="font-ui text-sm uppercase text-parchment/60 pt-0.5">Goal</dt>
            <dd>{s.quest.goal}</dd>
            {scene && (
              <>
                <dt className="font-ui text-sm uppercase text-parchment/60 pt-0.5">Where</dt>
                <dd>
                  {scene.kind === "climax" ? "Finale" : `Scene ${s.sceneIndex + 1}`} · {scene.location}
                </dd>
              </>
            )}
            <dt className="font-ui text-sm uppercase text-parchment/60 pt-0.5">Question</dt>
            <dd>{s.question || "Not asked yet."}</dd>
            <dt className="font-ui text-sm uppercase text-parchment/60 pt-0.5">Hope</dt>
            <dd>
              {s.hope} of {s.hopeMax}
            </dd>
            <dt className="font-ui text-sm uppercase text-parchment/60 pt-0.5">Canon</dt>
            <dd>
              {n.canon.length ? (
                <ul className="list-disc pl-5">
                  {n.canon.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-parchment/60">No new facts yet. The DM may never contradict these.</span>
              )}
            </dd>
            <dt className="font-ui text-sm uppercase text-parchment/60 pt-0.5">Open</dt>
            <dd>
              {n.open.length ? (
                <ul className="list-disc pl-5">
                  {n.open.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-parchment/60">No open complications.</span>
              )}
            </dd>
            <dt className="font-ui text-sm uppercase text-parchment/60 pt-0.5">Clues</dt>
            <dd className="flex flex-col gap-1">
              {heroes.map((p) => (
                <span key={p.id}>
                  <b style={{ color: p.color }}>{p.hero!.name}:</b>{" "}
                  {!s.clues[p.id] ? (
                    <span className="text-parchment/60">none this scene</span>
                  ) : secret ? (
                    <span className="text-parchment/60">🔒 secret until plans are in (it&apos;s on their phone)</span>
                  ) : (
                    s.clues[p.id]
                  )}
                </span>
              ))}
            </dd>
          </dl>
        )}
      </Section>

      <Section title={`Decision log · ${n.log.length}`} accent="var(--crimson)">
        <p className="font-ui text-xs text-parchment/60">
          {st.plans} plans ruled · {st.appealsChanged}/{st.appeals} arguments changed a ruling · {st.rolls} dice · {st.safety} safety · {st.fallbacks} backups
        </p>
        {log.length ? (
          <ol className="flex flex-col gap-2">
            {log.map((e, i) => (
              <LogLine key={`${e.t}-${n.log.length - i}`} n={e} />
            ))}
          </ol>
        ) : (
          <p className="text-parchment/60">Empty so far. Every call the DM makes lands here, newest first.</p>
        )}
      </Section>
    </div>
  );
}

/** TV slide-in panel (right side). */
export function DMNotesPanel({ s, open, onClose }: { s: GameState; open: boolean; onClose: () => void }) {
  return (
    <aside
      aria-label="DM's Notes"
      aria-hidden={!open}
      className={`fixed top-0 right-0 bottom-0 z-40 flex flex-col bg-[#0d0818]/95 backdrop-blur border-l-4 border-[var(--crimson)] shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
      style={{ width: "min(44vw, 58rem)" }}
    >
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <div className="flex-1">
          <h2 className="font-display text-4xl uppercase text-[var(--gilt-bright)] leading-none">DM&apos;s Notes</h2>
          <p className="font-ui text-sm text-parchment/70">What the AI is doing, and why. Press N to close.</p>
        </div>
        <button className="btn btn-ghost !py-1 !px-3" onClick={onClose} aria-label="Close DM's Notes" tabIndex={open ? 0 : -1}>
          ✕
        </button>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 text-lg">{open && <DMNotesBody s={s} showQR />}</div>
    </aside>
  );
}

/** Last page of the storybook: the pipeline, with this game's actual data. */
export function HowThisWasMade({ s }: { s: GameState }) {
  const n = s.notes;
  const src = n.source;
  const st = n.stats;
  const Step = ({ k, title, children }: { k: number; title: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-2 min-w-0">
      <p className="font-ui uppercase tracking-[0.2em] text-sm text-[var(--signal)]">Step {k}</p>
      <h3 className="font-heading text-2xl uppercase leading-none">{title}</h3>
      {children}
    </div>
  );
  const nums: [string, number | string][] = [
    ["Rounds played", st.rounds],
    ["Plans the DM ruled", st.plans],
    ["Arguments that won", `${st.appealsChanged} of ${st.appeals}`],
    ["Dice rolled (all by code)", st.rolls],
    ["Natural 1s / 20s", `${st.nat1} / ${st.nat20}`],
    ["Safety rewrites", st.safety],
    ["AI backups used", st.fallbacks],
  ];
  return (
    <div className="col-span-2 self-stretch h-full flex flex-col gap-4 min-h-0 overflow-auto">
      <h2 className="font-display text-4xl uppercase leading-none">How this story was made</h2>
      <div className="columns-2 gap-x-10 [&>*]:break-inside-avoid [&>*]:mb-5">
        <Step k={1} title="A real headline">
          {src ? (
            <>
              <p className="text-lg leading-snug font-bold">“{src.headline}”</p>
              <p className="font-ui text-sm text-ink-soft">
                {src.source} · {src.date}
              </p>
            </>
          ) : (
            <p className="text-xl">A real news story.</p>
          )}
          <p className="leading-snug">
            <b>Why it passed the filter:</b> {n.safety} {FILTER_NOTE}
          </p>
        </Step>
        <Step k={3} title="Tonight's numbers">
          <dl className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[0.95rem] leading-tight">
            {nums.map(([label, v]) => (
              <div key={label} className="contents">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="font-ui font-bold tabular-nums text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Step>
        <Step k={2} title="Real facts became the story">
          <ul className="flex flex-col gap-1 leading-snug">
            {(src?.mappings ?? []).map((m, i) => (
              <li key={i}>
                <b className="text-[var(--gilt-bright)]">{m.story}</b> ← {m.real}
              </li>
            ))}
          </ul>
        </Step>
        <Step k={4} title="What the AI never did">
          <ul className="flex flex-col gap-1.5 leading-snug">
            <li>
              <b>Rolled a die.</b> All {st.rolls} came from the computer&apos;s random numbers. The AI picked ideas, never numbers.
            </li>
            <li>
              <b>Named a real person.</b> The only real names tonight are on the reveal page, straight from the article.
            </li>
            <li>
              <b>Rated a player.</b> It judged plans, not people. Mirror sentences are kind-only, and nobody got a score.
            </li>
          </ul>
        </Step>
      </div>
    </div>
  );
}
