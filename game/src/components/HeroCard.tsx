"use client";
import type { Player } from "@/lib/types";
import { STAT_LABEL } from "@/lib/rules";

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** short, stable case number from the player id, e.g. "26-4F1C" */
function fileNo(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return "26-" + (h % 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export function HeroCard({ player, portrait, compact = false, showRoast = true }: { player: Player; portrait?: string; compact?: boolean; showRoast?: boolean }) {
  const h = player.hero;
  if (!h) return null;
  return (
    <div className={`page ${compact ? "p-3" : "p-4"} flex gap-3 items-start fade-in`}>
      <div className={`${compact ? "w-16 h-20" : "w-24 h-32"} shrink-0 relative`}>
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait} alt={h.name} className="portrait-oval w-full h-full" />
        ) : (
          <div className="portrait-oval w-full h-full flex items-center justify-center text-ink-soft font-display text-3xl animate-pulse">
            {h.name[0]}
          </div>
        )}
        {!compact && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-ui text-[0.6rem] font-bold tracking-[0.15em] uppercase bg-[var(--signal)] text-[#0a0612] px-1.5 whitespace-nowrap">
            {fileNo(player.id)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        {!compact && <p className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-ink-soft">Character</p>}
        <div>
          <p className={`font-heading font-extrabold uppercase tracking-wide leading-none ${compact ? "text-lg" : "text-2xl"}`}>{h.name}</p>
          <p className="italic text-ink-soft leading-tight mt-0.5">
            {[h.epithet, ...player.titles].join(", ")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).map((s) => (
            <span key={s} className={`chip stat ${h.stats[s] < 0 ? "!bg-crimson/15 !border-crimson/60" : ""}`}>
              {STAT_LABEL[s]} {fmt(h.stats[s])}
            </span>
          ))}
        </div>
        {!compact && (
          <>
            <p className="text-sm leading-snug">
              <b className="font-ui text-[0.72rem] uppercase tracking-[0.14em] text-[var(--signal)] mr-1">Ability</b>
              <b className="font-heading text-base">{h.ability.name}</b>
              {player.abilityAvailable ? "" : " (used)"}: {h.ability.text}
            </p>
            <p className="text-sm leading-snug">
              <b className="font-ui text-[0.72rem] uppercase tracking-[0.14em] text-crimson mr-1">Flaw</b> {h.flaw}
            </p>
            {showRoast && h.roast && <p className="text-sm italic text-ink-soft">“{h.roast}”</p>}
          </>
        )}
        {player.peril && (
          <p className="text-sm font-ui font-bold uppercase tracking-wide text-crimson">
            <span className="animate-pulse">●</span> In peril: {player.peril}
          </p>
        )}
      </div>
    </div>
  );
}
