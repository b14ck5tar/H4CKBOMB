"use client";
// No-TV mode: when a player's device hosts the game, every phone shows the story itself (what the TV would show),
// plus the lobby, the host's controls and an in-game chat so players who aren't in the same room can talk.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GameHost } from "@/lib/host";
import { BAND_LABEL, ENDING_LABEL, autoSucceeds, isFailure, stampText } from "@/lib/rules";
import type { Floating } from "@/lib/usePhone";
import type { GameState, Player } from "@/lib/types";
import { Hourglass } from "./Effects";
import { Reactions } from "./Reactions";
import { Stamp, WaxSeal } from "./Stamp";

type Send = (t: string, d?: Record<string, unknown>) => void;
const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const heroName = (s: GameState, id: string) => s.players.find((p) => p.id === id)?.hero?.name ?? "Someone";

export function useHostState(host: GameHost) {
  return useSyncExternalStore(host.subscribe, host.getState, host.getState);
}

function Face({ p, portraits, size = 40 }: { p: Player; portraits: Record<string, string>; size?: number }) {
  const url = portraits[p.id];
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="rounded-full object-cover object-top shrink-0" style={{ width: size, height: size, boxShadow: `0 0 0 2px ${p.color}` }} />;
  return <WaxSeal initials={initials(p.hero?.name ?? p.name)} color={p.color} size={size} />;
}

function Art({ url }: { url: string }) {
  return (
    <div className="relative overflow-hidden rounded bg-[var(--surface-2)] w-full" style={{ aspectRatio: "16 / 9" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover fade-in" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-parchment/70">
          <Hourglass size={28} />
          <span className="font-heading text-sm">Painting the scene…</span>
        </div>
      )}
    </div>
  );
}

function Busy({ text }: { text: string }) {
  return (
    <div className="page p-5 flex flex-col items-center gap-2 text-center">
      <Hourglass size={40} />
      <p className="font-heading">{text}</p>
    </div>
  );
}

// ---------- lobby ----------
export function RoomLobby({ state, me, portraits, host }: { state: GameState; me: Player; portraits: Record<string, string>; host?: GameHost }) {
  const [copied, setCopied] = useState(false);
  const link = typeof location !== "undefined" ? `${location.origin}/play?code=${state.code}` : "";
  const invite = async () => {
    const text = `Join our game of Group Project: ${link}`;
    try {
      if (navigator.share) return await navigator.share({ title: "Group Project", text, url: link });
    } catch {
      return; // the share sheet was closed
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  const quest = state.questOptions.find((q) => q.id === state.questId);
  return (
    <div className="flex flex-col gap-3">
      <div className="page p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-ink-soft">Room code</p>
          <p className="font-display text-4xl tracking-[0.2em]">{state.code}</p>
        </div>
        <button className="btn btn-gilt" onClick={invite}>{copied ? "Link copied ✓" : "Invite friends"}</button>
      </div>
      {host?.transportKind === "local" && (
        <p className="font-ui text-xs text-crimson text-center">Local mode: other devices can’t join until Supabase keys are set.</p>
      )}
      <div className="page p-4 flex flex-col gap-2">
        <p className="font-heading uppercase">Your crew ({state.players.length})</p>
        {state.players.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Face p={p} portraits={portraits} size={36} />
            <span className="flex-1 min-w-0 truncate">
              <b>{p.hero?.name ?? p.name}</b>
              {p.hero && <span className="text-ink-soft"> · {p.name}</span>}
              {p.id === me.id && <span className="text-ink-soft"> (you)</span>}
            </span>
            <span className="font-ui text-xs text-ink-soft">{p.status === "ready" ? "ready" : p.status === "building" ? "drawing…" : "thinking…"}</span>
          </div>
        ))}
      </div>
      {host ? (
        <HostLobby host={host} />
      ) : (
        <div className="page p-4 flex flex-col gap-1">
          <p className="font-ui text-xs uppercase tracking-widest text-ink-soft">Tonight’s story</p>
          <p className="font-heading text-lg uppercase">{quest ? quest.title : "The host is picking…"}</p>
          {quest && <p className="text-sm text-ink-soft">{quest.teaser}</p>}
        </div>
      )}
    </div>
  );
}

function HostLobby({ host }: { host: GameHost }) {
  const s = useHostState(host);
  const ready = s.players.filter((p) => p.status === "ready").length;
  return (
    <div className="page p-4 flex flex-col gap-3 ring-2 ring-[var(--gilt-bright)]">
      <p className="font-ui text-xs uppercase tracking-[0.2em] text-[var(--gilt-bright)]">You’re the host</p>
      <label className="font-heading uppercase text-sm" htmlFor="party">Group name</label>
      <input id="party" className="input" placeholder="The Cousins, Floor 3…" value={s.partyName} onChange={(e) => host.setPartyName(e.target.value)} />
      <p className="font-heading uppercase text-sm">Pick tonight’s story</p>
      <p className="text-xs text-ink-soft -mt-2">Each one starts from a real news story. You’ll find out which at the end.</p>
      <div className="flex flex-col gap-2">
        {s.questOptions.map((q) => (
          <button
            key={q.id}
            className={`rounded border p-3 text-left flex flex-col gap-1 ${s.questId === q.id ? "border-[var(--gilt-bright)] bg-white/10" : "border-white/15"}`}
            onClick={() => host.chooseQuest(q.id)}
          >
            <span className="font-heading font-bold uppercase leading-tight">{q.title}</span>
            <span className="text-sm text-ink-soft leading-snug line-clamp-2">{q.teaser}</span>
          </button>
        ))}
      </div>
      <button className="btn btn-crimson text-xl" disabled={!host.canBegin()} onClick={() => host.begin()}>
        Start the story
      </button>
      <p className="font-ui text-sm text-ink-soft text-center">
        {!s.questId ? "Pick a story." : ready === 0 ? "Waiting for at least one character." : s.players.some((p) => p.status === "building") ? "Finishing characters…" : "Ready when you are."}
      </p>
    </div>
  );
}

/** Host-only strip during the game: skip ahead on reading screens, keep the screen awake. */
export function HostBar({ host }: { host: GameHost }) {
  const s = useHostState(host);
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  // The game lives on this device: keep it awake, and warn before a refresh or close wipes it mid-story.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const grab = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {}
    };
    grab();
    const onVis = () => document.visibilityState === "visible" && grab();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);
  const midGame = s.phase !== "lobby" && s.phase !== "storybook";
  useEffect(() => {
    if (!midGame) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [midGame]);
  if (s.phase === "lobby") return null;
  const reading = ["quest", "narrating", "outcome", "mirror_reveal", "epilogue", "reveal"].includes(s.phase);
  return (
    <div className="flex items-center gap-2 font-ui text-xs text-parchment/80">
      <span className="flex-1">You’re hosting · keep this tab open</span>
      {reading && host.deadlineAt > 0 && !s.busy && (
        <button className="btn btn-ghost !py-1 !px-3 text-sm" onClick={() => host.skip()}>
          Continue ▸
        </button>
      )}
    </div>
  );
}

// ---------- the story, on the phone ----------
export function StoryView({
  state: s,
  me,
  portraits,
  sceneArt,
  host,
}: {
  state: GameState;
  me: Player;
  portraits: Record<string, string>;
  sceneArt: (i: number) => string;
  host?: GameHost;
}) {
  switch (s.phase) {
    case "quest":
      return (
        <div className="page p-4 flex flex-col gap-3 fade-in">
          <Art url={sceneArt(0)} />
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-ink-soft">{s.quest?.realm}</p>
          <h2 className="font-display text-3xl leading-none uppercase">{s.quest?.title}</h2>
          <p className="text-lg leading-snug">{s.quest?.premise}</p>
          <p className="font-ui text-[var(--gilt-bright)]">The goal: {s.quest?.goalShort}</p>
        </div>
      );
    case "narrating":
      return (
        <div className="page p-4 flex flex-col gap-3">
          <SceneLabel s={s} />
          <div className="relative">
            <Art url={sceneArt(s.sceneIndex)} />
            {s.banner && (
              <div className="absolute left-2 bottom-2">
                <Stamp text={s.banner} size="sm" rotate={-3} slam={false} />
              </div>
            )}
          </div>
          {s.busy ? (
            <Busy text={s.busy} />
          ) : (
            <>
              <p className="text-lg leading-snug fade-in">{s.narration}</p>
              {s.npcLine?.speaker && s.npcLine?.line && (
                <p className="border-l-4 border-[var(--gilt)] pl-3">
                  <b className="font-heading uppercase">{s.npcLine.speaker}:</b> “{s.npcLine.line}”
                </p>
              )}
            </>
          )}
        </div>
      );
    case "pitch":
    case "appeal": {
      const others = s.pitches.filter((p) => p.playerId !== me.id);
      return (
        <div className="flex flex-col gap-2">
          <SceneLabel s={s} />
          {s.rescue && <Stamp text={`SAVE ${heroName(s, s.rescue.victimId).toUpperCase()}`} sub={s.rescue.peril} size="sm" />}
          {s.phase === "appeal" && others.some((p) => p.verdict) && (
            <div className="flex flex-col gap-2">
              {others.map((p) => (
                <div key={p.id} className="page p-3 flex flex-col gap-1">
                  <span className="font-heading font-bold uppercase">{heroName(s, p.playerId)}</span>
                  <span>“{p.text}”</span>
                  {p.verdict && <Stamp text={stampText(p.verdict.tier)} size="sm" slam={false} rotate={-2} tone={autoSucceeds(p.verdict.tier) ? "forest" : "crimson"} />}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "roll":
    case "catch":
      return (
        <div className="page p-4 flex flex-col gap-2">
          <p className="font-heading uppercase text-[var(--gilt-bright)]">{s.phase === "catch" ? "Catch! Anyone with a ♥ can re-roll a friend" : "Everyone rolls"}</p>
          {s.rolls.map((r) => {
            const p = s.players.find((x) => x.id === r.playerId);
            if (!p) return null;
            const shown = s.revealed.includes(r.playerId);
            return (
              <div key={r.playerId} className="flex items-center gap-3">
                <Face p={p} portraits={portraits} size={36} />
                <span className="flex-1 min-w-0 truncate font-heading uppercase">{p.hero?.name}</span>
                {r.noRoll ? (
                  <span className="font-ui text-sm text-[var(--forest,#6c6)]">THAT WORKS</span>
                ) : shown ? (
                  <span className="font-ui text-sm tabular-nums">
                    <b className="text-2xl">{r.kept}</b> {BAND_LABEL[r.band]}
                    {r.rescuerId ? ` · caught by ${heroName(s, r.rescuerId)}` : ""}
                  </span>
                ) : (
                  <span className="font-ui text-sm text-ink-soft animate-pulse">rolling…</span>
                )}
              </div>
            );
          })}
        </div>
      );
    case "outcome": {
      if (!s.round || s.busy) return <Busy text={s.busy || "Writing it all down…"} />;
      const beat = s.round.beats[s.beatIndex];
      if (!beat)
        return (
          <div className="page p-5 flex flex-col gap-2 text-center fade-in">
            <p className="font-ui text-xs uppercase tracking-[0.2em] text-ink-soft">{s.round.headline}</p>
            <p className="font-heading text-2xl uppercase leading-tight">{s.round.now}</p>
          </div>
        );
      const p = s.players.find((x) => x.id === beat.hero_id);
      const roll = s.rolls.find((r) => r.playerId === beat.hero_id);
      const pitch = s.pitches.find((x) => x.playerId === beat.hero_id);
      return (
        <div key={s.beatIndex} className="page p-4 flex flex-col gap-2 fade-in">
          <div className="flex items-center gap-3">
            {p && <Face p={p} portraits={portraits} size={48} />}
            <span className="flex-1 font-heading text-xl uppercase text-[var(--gilt-bright)]">{p?.hero?.name}</span>
            {roll && <Stamp text={roll.noRoll ? "THAT WORKS" : BAND_LABEL[roll.band]} size="sm" slam={false} tone={isFailure(roll.band) ? "crimson" : roll.band === "LEGENDARY" ? "gilt" : "forest"} />}
          </div>
          {pitch && <p className="italic text-ink-soft">“{pitch.text}”</p>}
          <p className="text-lg leading-snug">{beat.text}</p>
          <p className="font-ui text-xs text-ink-soft">
            {s.beatIndex + 1} of {s.round.beats.length}
          </p>
        </div>
      );
    }
    case "final_roll":
    case "final_result": {
      const f = s.final;
      return (
        <div className="page p-4 flex flex-col gap-2">
          <p className="font-display text-2xl uppercase text-[var(--gilt-bright)]">The Final Roll</p>
          {s.players
            .filter((p) => p.hero)
            .map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <Face p={p} portraits={portraits} size={36} />
                <span className="flex-1 min-w-0 truncate">{s.finalMoves[p.id] ? `“${s.finalMoves[p.id]}”` : p.hero!.name}</span>
                <b className="text-2xl tabular-nums">{f?.dice[p.id] ?? "…"}</b>
              </div>
            ))}
          {s.phase === "final_result" && f && (
            <div className="flex flex-col items-center gap-2 pt-2 fade-in">
              {f.best && (
                <p className="font-ui tabular-nums">
                  Best roll {f.dice[f.best]} + Hope {f.hopeBonus} = <b className="text-xl">{f.total}</b>
                </p>
              )}
              <Stamp text={ENDING_LABEL[f.ending]} size="md" tone={f.ending === "TRIUMPHANT" ? "gilt" : f.ending === "BITTERSWEET" ? "forest" : "crimson"} />
            </div>
          )}
        </div>
      );
    }
    case "mirror_write":
    case "mirror_guess":
      return (
        <div className="text-center flex flex-col gap-1">
          <p className="font-display text-2xl uppercase text-[var(--gilt-bright)]">Mirror, Mirror</p>
          <p className="text-sm text-ink-soft">All night, each of you secretly watched one friend. Only nice things. Nobody gets rated.</p>
        </div>
      );
    case "mirror_reveal": {
      const card = s.mirror[s.mirrorIndex];
      if (s.busy || !card) return <Busy text={s.busy || "The mirror is polishing the glass…"} />;
      if (card.wardId === me.id) return null; // the phone shows your own card
      const ward = s.players.find((p) => p.id === card.wardId);
      return (
        <div key={card.wardId} className="page p-4 flex flex-col gap-2 fade-in">
          <div className="flex items-center gap-3">
            {ward && <Face p={ward} portraits={portraits} size={48} />}
            <span className="font-heading text-xl uppercase">{ward?.hero?.name}</span>
          </div>
          <p className="italic text-ink-soft">They guessed: {card.guess ? `“${card.guess}”` : "too shy to guess"}</p>
          {card.sentence && <p className="font-heading text-xl leading-snug">{card.sentence}</p>}
          <p className="font-ui text-sm text-[var(--crimson)]">From their guardian, {heroName(s, card.guardianId)}</p>
        </div>
      );
    }
    case "epilogue":
      return s.busy || !s.epilogue ? <Busy text={s.busy || "The DM wraps it up…"} /> : <div className="page p-5 text-lg leading-snug fade-in">{s.epilogue}</div>;
    case "reveal": {
      const r = s.reveal;
      if (!r) return null;
      return (
        <div className="bg-[#f7f5ef] text-[#151515] p-5 shadow-2xl rotate-[-0.6deg] fade-in flex flex-col gap-2" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          <p className="uppercase tracking-[0.3em] text-xs text-[#555] border-b border-[#bbb] pb-1">The official story</p>
          <h2 className="text-2xl font-bold leading-tight">{r.headline}</h2>
          <p className="text-sm text-[#555]">
            {r.source} · {r.date}
          </p>
          <p>{r.summary}</p>
          <p className="uppercase tracking-wider text-xs text-[#777] mt-1">What your group uncovered</p>
          <p>
            <b>{r.threat}</b> → {r.threatFrom}
          </p>
          <p>
            <b>Your goal</b> → {r.goalFrom}
          </p>
          {r.link && (
            <a href={r.link} target="_blank" rel="noreferrer" className="underline text-sm">
              Read the real story
            </a>
          )}
        </div>
      );
    }
    case "storybook":
      return <PhoneStorybook s={s} portraits={portraits} sceneArt={sceneArt} host={host} />;
    default:
      return null;
  }
}

function SceneLabel({ s }: { s: GameState }) {
  const scene = s.scenes[s.sceneIndex];
  if (!scene) return null;
  return (
    <p className="font-ui text-xs uppercase tracking-[0.2em] text-[var(--crimson)]">
      {scene.kind === "climax" ? "Finale" : `Scene ${s.sceneIndex + 1}`} · {scene.location}
    </p>
  );
}

function PhoneStorybook({ s, portraits, sceneArt, host }: { s: GameState; portraits: Record<string, string>; sceneArt: (i: number) => string; host?: GameHost }) {
  const [page, setPage] = useState(0);
  const book = s.storybook;
  if (!book || s.busy) return <Busy text={s.busy || "Putting your story together…"} />;
  const imgIndex = (ref: string) => Math.max(0, Number(String(ref).replace("scene_", "")) - 1);
  const last = book.pages.length + 1;
  let body: React.ReactNode;
  if (page === 0)
    body = (
      <>
        <Art url={sceneArt(s.scenes.length - 1)} />
        <h2 className="font-display text-3xl leading-none uppercase">{book.title}</h2>
        <p className="italic text-ink-soft">{book.dedication}</p>
      </>
    );
  else if (page < last)
    body = (
      <>
        <Art url={sceneArt(imgIndex(book.pages[page - 1].image_ref))} />
        <p className="text-lg leading-snug">{book.pages[page - 1].text}</p>
      </>
    );
  else
    body = (
      <>
        <p className="font-heading text-xl uppercase">The crew</p>
        {book.hero_pages.map((hp) => {
          const p = s.players.find((x) => x.id === hp.hero_id);
          if (!p?.hero) return null;
          return (
            <div key={hp.hero_id} className="flex gap-3 items-start">
              <Face p={p} portraits={portraits} size={40} />
              <div>
                <p className="font-heading font-bold">{[p.hero.name, ...p.titles].join(", ")}</p>
                <p className="text-sm">{hp.award}: {hp.best_moment}</p>
              </div>
            </div>
          );
        })}
        <p className="italic">{book.moral}</p>
        {host && (
          <button className="btn btn-crimson" onClick={() => host.nextTale()}>
            Next chapter
          </button>
        )}
      </>
    );
  return (
    <div className="page p-4 flex flex-col gap-3">
      {body}
      <div className="flex items-center justify-between">
        <button className="btn btn-ghost !py-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>◂</button>
        <span className="font-ui text-sm tabular-nums">{page + 1} / {last + 1}</span>
        <button className="btn btn-gilt !py-1" disabled={page >= last} onClick={() => setPage((p) => p + 1)}>▸</button>
      </div>
    </div>
  );
}

// ---------- chat ----------
export function ChatDock({ state, me, send }: { state: GameState; me: Player; send: Send }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [seen, setSeen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = state.chat.at(-1)?.id ?? 0;
  const unread = open ? 0 : state.chat.filter((m) => m.id > seen && m.pid !== me.id).length;
  useEffect(() => {
    if (open) {
      setSeen(lastId);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [open, lastId]);
  const color = (pid: string) => state.players.find((p) => p.id === pid)?.color;
  const who = (pid: string) => {
    const p = state.players.find((x) => x.id === pid);
    return p?.hero?.name.split(" ")[0] ?? p?.name ?? "Someone";
  };
  return (
    <>
      <button
        className="fixed bottom-24 right-3 z-40 w-14 h-14 rounded-full bg-[var(--crimson)] text-2xl shadow-xl flex items-center justify-center"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? "✕" : "💬"}
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-[var(--gilt-bright)] text-black font-ui text-sm font-bold flex items-center justify-center">{unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-2 bottom-40 z-40 max-w-md mx-auto page p-3 flex flex-col gap-2 shadow-2xl" style={{ maxHeight: "60vh" }}>
          <p className="font-heading uppercase text-sm">Crew chat</p>
          <div ref={listRef} className="flex-1 min-h-24 overflow-y-auto flex flex-col gap-1">
            {state.chat.length === 0 && <p className="text-sm text-ink-soft italic">Say hi. Plan your next move. Blame the raccoon.</p>}
            {state.chat.map((m) => (
              <p key={m.id} className="leading-snug break-words">
                <b style={{ color: color(m.pid) }}>{m.pid === me.id ? "You" : who(m.pid)}:</b> {m.text}
              </p>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              send("chat", { text: text.trim() });
              setText("");
            }}
          >
            <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Message the crew" autoComplete="off" />
            <button className="btn btn-crimson !px-4" type="submit" disabled={!text.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export function PhoneReactions({ items, state }: { items: Floating[]; state: GameState }) {
  return <Reactions items={items.map((r) => ({ id: r.id, emoji: r.emoji, color: state.players.find((p) => p.id === r.pid)?.color }))} />;
}
