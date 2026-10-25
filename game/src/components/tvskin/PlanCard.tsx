"use client";
import { useEffect } from "react";
import type { Tier } from "@/lib/types";
import { TIER_SHIFT } from "@/lib/grade";
import { playSfx } from "@/lib/sound";
import { CreditChip, D20Glyph, Face, TIER_LOOK, fmtSigned, possessive, type Css } from "./shared";

export interface PlanCardProps {
  hero: { name: string; color: string; portrait?: string };
  /** The plan as the room should read it (masked / steered text). */
  plan: string;
  tier: Tier;
  /** Difficulty shift on the roll; defaults to lib/grade TIER_SHIFT[tier]. */
  shift?: number;
  /** The stat the roll uses, e.g. { label: "Charm", value: 2 }. */
  stat?: { label: string; value: number };
  /** A friend's idea worked in. */
  credit?: { name: string; color: string; bonus?: number };
  /** One short "why" line from the DM (optional, small). */
  why?: string;
  /** Bottom call to action. */
  cta?: string;
}

/** The judged action: the plan in big quotes, the DM's difficulty stamp ("WILD PLAN −5") and the roll math as dice chips. */
export function PlanCard({ hero, plan, tier, shift, stat, credit, why, cta = "Roll to see how it goes" }: PlanCardProps) {
  const look = TIER_LOOK[tier];
  const sh = shift ?? TIER_SHIFT[tier];
  const bonus = credit ? credit.bonus ?? 1 : 0;
  const total = (stat?.value ?? 0) + bonus + sh;
  useEffect(() => {
    const t = setTimeout(() => playSfx(sh < 0 ? "partial" : "success", { volume: 0.6 }), 900);
    return () => clearTimeout(t);
  }, [sh]);
  const style: Css = { "--c": hero.color, "--tier": look.color };
  const long = plan.length > 90;
  return (
    <section className="tvx-plan" style={style} aria-label={`${hero.name}'s plan`}>
      <div className="tvx-plan-card">
        <header className="tvx-plan-head">
          <Face src={hero.portrait} name={hero.name} color={hero.color} size={4.4} />
          <span className="tvx-plan-who">{possessive(hero.name)} plan</span>
          {credit && <CreditChip name={credit.name} color={credit.color} bonus={credit.bonus ?? 1} className="tvx-plan-credit" />}
        </header>
        <p className={`tvx-plan-quote ${long ? "is-long" : ""}`}>&ldquo;{plan}&rdquo;</p>
        {why && <p className="tvx-plan-why">{why}</p>}
        <footer className="tvx-plan-math" aria-label="Roll math">
          <span className="tvx-chip tvx-chip-die">
            <D20Glyph label="" className="tvx-chip-d20" />
            d20
          </span>
          {stat && (
            <span className="tvx-chip">
              <b>{fmtSigned(stat.value)}</b> {stat.label}
            </span>
          )}
          {credit && (
            <span className="tvx-chip" style={{ ["--c" as string]: credit.color }}>
              <b>{fmtSigned(bonus)}</b> idea
            </span>
          )}
          <span className="tvx-chip tvx-chip-tier">
            <b>{fmtSigned(sh)}</b> {tier}
          </span>
          <span className="tvx-chip-eq">=</span>
          <span className="tvx-chip tvx-chip-sum">
            d20 <b>{fmtSigned(total)}</b>
          </span>
        </footer>
      </div>
      <div className="tvx-plan-stamp" role="img" aria-label={`${look.word} ${fmtSigned(sh)}`}>
        <span className="tvx-plan-stamp-word">{look.word}</span>
        <span className="tvx-plan-stamp-num">{fmtSigned(sh)}</span>
      </div>
      {cta && <p className="tvx-plan-cta">{cta}</p>}
    </section>
  );
}
