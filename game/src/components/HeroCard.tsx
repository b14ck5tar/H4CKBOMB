"use client";
import type { Player } from "@/lib/types";
import { STAT_LABEL } from "@/lib/rules";

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function HeroCard({ player, portrait, compact = false, showRoast = true }: { player: Player; portrait?: string; compact?: boolean; showRoast?: boolean }) {
  const h = player.hero;
  if (!h) return null;
  return (
    <div className={`page ${compact ? "p-3" : "p-4"} flex gap-3 items-start fade-in`}>
      <div className={`${compact ? "w-16 h-20" : "w-24 h-32"} shrink-0`}>
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait} alt={h.name} className="portrait-oval w-full h-full" />
        ) : (
          <div className="portrait-oval w-full h-full flex items-center justify-center text-ink-soft font-heading text-2xl animate-pulse">
            {h.name[0]}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div>
          <p className={`font-heading font-bold leading-tight ${compact ? "text-base" : "text-xl"}`}>{h.name}</p>
          <p className="italic text-ink-soft leading-tight">
            {[h.epithet, ...player.titles].join(", ")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).map((s) => (
            <span key={s} className={`chip stat ${h.stats[s] < 0 ? "!bg-crimson/15 !border-crimson/40" : ""}`}>
              {STAT_LABEL[s]} {fmt(h.stats[s])}
            </span>
          ))}
        </div>
        {!compact && (
          <>
            <p className="text-sm leading-snug">
              <b className="font-heading">{h.ability.name}</b>
              {player.abilityAvailable ? "" : " (used)"}: {h.ability.text}
            </p>
            <p className="text-sm leading-snug">
              <b className="font-heading">Flaw:</b> {h.flaw}
            </p>
            {showRoast && h.roast && <p className="text-sm italic text-ink-soft">“{h.roast}”</p>}
          </>
        )}
        {player.peril && <p className="text-sm font-ui font-bold text-crimson">IN PERIL: {player.peril}</p>}
      </div>
    </div>
  );
}
