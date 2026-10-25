"use client";
/** Hero trading cards for the phone: the big one (your card), the mini one (ready-made picks), a row (a friend). */
import type { Hero, Player, Stat } from "@/lib/types";
import { STAT_LABEL } from "@/lib/rules";
import { D20Glyph, Face } from "./kit";

const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const STATS = Object.keys(STAT_LABEL) as Stat[];

export function bestStat(h: Hero): Stat {
  return STATS.reduce((a, b) => ((h.stats[b] ?? 0) > (h.stats[a] ?? 0) ? b : a), STATS[0]);
}

export function StatRow({ hero }: { hero: Hero }) {
  const best = bestStat(hero);
  return (
    <span className="pk-stats">
      {STATS.map((k) => (
        <span key={k} className={k === best ? "best" : hero.stats[k] < 0 ? "low" : ""}>
          <b>{fmt(hero.stats[k])}</b>
          {STAT_LABEL[k]}
        </span>
      ))}
    </span>
  );
}

function Silhouette() {
  return (
    <svg viewBox="0 0 64 80" className="pk-sil" aria-hidden>
      <circle cx="32" cy="28" r="13" />
      <path d="M6 80c1-17 11-27 26-27s25 10 26 27z" />
    </svg>
  );
}

/**
 * Your hero as a holo trading card. It flips in face-up the first time it mounts; with no hero yet
 * (`player.hero` missing) it shows the card back with a spinning d20 ("Painting your hero…").
 */
export function HeroTCG({ player, portrait, number, tag = "Hero", backText }: { player: Player; portrait?: string; number?: number; tag?: string; backText?: string }) {
  const h = player.hero;
  const style = { ["--c" as string]: player.color } as React.CSSProperties;
  return (
    <div className={`pk-tcg ${h ? "" : "is-back"}`} style={style}>
      <div className="pk-tcg-inner">
        <div className="pk-tcg-face pk-tcg-front" aria-hidden={!h}>
          <div className="pk-tcg-art">
            {portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portrait} alt="" />
            ) : (
              <Silhouette />
            )}
            <span className="pk-sheen" aria-hidden />
          </div>
          {number != null && <span className="pk-tcg-badge">{number}</span>}
          <span className="pk-tcg-tag">{tag}</span>
          <div className="pk-tcg-plate">
            <span className="pk-tcg-name">{h?.name ?? ""}</span>
          </div>
          <div className="pk-tcg-sheet">
            <span className="pk-tcg-epi">{h?.epithet ?? ""}</span>
            {h && <StatRow hero={h} />}
            {h?.ability?.name && (
              <span className="pk-ability">
                <b>{h.ability.name}</b>
                {h.ability.text}
              </span>
            )}
          </div>
        </div>
        <div className="pk-tcg-face pk-tcg-back" aria-hidden={!!h}>
          <D20Glyph label="?" />
          <span className="pk-tcg-back-txt">{backText ?? "Painting your hero…"}</span>
        </div>
      </div>
    </div>
  );
}

const TILTS = [-2.5, 2, -1.5, 2.5, -2, 1.5];

/** A ready-made hero in the picker rail. */
export function HeroMini({
  id,
  hero,
  pitch,
  color,
  index,
  taken,
  chosen,
  onPick,
}: {
  id: string;
  hero: Hero;
  pitch: string;
  color: string;
  index: number;
  taken?: boolean;
  chosen?: boolean;
  onPick: (id: string) => void;
}) {
  const best = bestStat(hero);
  return (
    <button
      type="button"
      className={`pk-mini ${taken ? "is-taken" : ""} ${chosen ? "is-chosen" : ""}`}
      style={{ ["--c" as string]: color, ["--i" as string]: index, ["--tilt" as string]: `${TILTS[index % TILTS.length]}deg` } as React.CSSProperties}
      disabled={taken}
      aria-label={`Play as ${hero.name}: ${pitch}${taken ? " (taken)" : ""}`}
      onClick={() => onPick(id)}
    >
      <span className="pk-mini-in">
        <span className="pk-mini-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/heroes/${id}.webp`} alt="" loading="lazy" />
          <span className="pk-sheen" aria-hidden />
          <span className="pk-mini-best">
            {fmt(hero.stats[best])} {STAT_LABEL[best]}
          </span>
        </span>
        <span className="pk-mini-plate">{hero.name}</span>
        <span className="pk-mini-txt">{pitch}</span>
      </span>
      {taken && <span className="pk-taken">Taken</span>}
    </button>
  );
}

/** A friend's hero, compact: who you're helping this turn. */
export function HeroRow({ player, portrait, label }: { player: Player; portrait?: string; label?: string }) {
  const h = player.hero;
  return (
    <div className="pk-hrow" style={{ ["--c" as string]: player.color } as React.CSSProperties}>
      <span className="pk-sheen" aria-hidden />
      <Face player={player} src={portrait} large />
      <span className="pk-hrow-body">
        {label && <span className="pk-plan-who">{label}</span>}
        <span className="pk-hrow-name">{h?.name ?? player.name}</span>
        {h && <span className="pk-hrow-epi">{h.epithet}</span>}
        {h && <StatRow hero={h} />}
      </span>
    </div>
  );
}
