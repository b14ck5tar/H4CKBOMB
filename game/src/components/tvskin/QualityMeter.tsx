"use client";
import { useEffect } from "react";
import { gradeRoll, type Grade, type GradeResult } from "@/lib/grade";
import { playSfx } from "@/lib/sound";
import { D20Glyph, fmtSigned, type Css } from "./shared";

export interface QualityMeterProps {
  /** Final total (d20 + stat + bonuses + tier shift). 20+ pins to the end. */
  total: number;
  /** The natural die: 1 and 20 get the special treatment (and override the grade, as in lib/grade). */
  natural?: number;
  /** The pieces of the total, shown small under the readout: [{label:"rolled",value:11},{label:"Charm",value:2}]. */
  parts?: { label: string; value: number; signed?: boolean }[];
  /** The story director's result (lib/grade gradeRoll): wins over our own computation, so the TV never disagrees with it. */
  result?: Pick<GradeResult, "grade" | "label" | "total" | "branch">;
  /** Or just the grade band (lib/grade Grade) for the color and highlighted zone. */
  grade?: Grade;
  /** Override the grade word (default: the result/lib/grade label, e.g. "IT WORKS"). */
  label?: string;
  /** Seconds before the fill starts (lets the die land first). */
  delay?: number;
  sound?: boolean;
}

const ZONES: { grade: Grade; from: number; to: number; word: string; color: string }[] = [
  { grade: "DISASTER", from: 1, to: 1, word: "Disaster", color: "#ff3b4e" },
  { grade: "SETBACK", from: 2, to: 5, word: "Uh oh", color: "#ff6b3d" },
  { grade: "PARTIAL", from: 6, to: 9, word: "Sort of", color: "#ffad3b" },
  { grade: "PROGRESS", from: 10, to: 14, word: "It works", color: "#3de7ff" },
  { grade: "GREAT", from: 15, to: 19, word: "Great", color: "#2cf5c0" },
  { grade: "LEGENDARY", from: 20, to: 20, word: "Legend", color: "#ffd23f" },
];
const zoneOf = (n: number) => ZONES.find((z) => n >= z.from && n <= z.to) ?? ZONES[ZONES.length - 1];
const FILL_S = 1.3;

/** A 1-20 track that fills to the roll total, then slams the grade: "14 · IT WORKS". Nat 1 cracks, nat 20 bursts. */
export function QualityMeter({ total, natural, parts, result, grade, label, delay = 0.2, sound = true }: QualityMeterProps) {
  const own = gradeRoll(total, natural);
  const g = { ...own, ...(result ?? {}), ...(grade ? { grade } : {}) };
  const shown = Math.max(1, Math.min(20, g.total));
  const zone = ZONES.find((z) => z.grade === g.grade) ?? zoneOf(shown);
  const nat = natural === 20 ? 20 : natural === 1 ? 1 : 0;
  const word = (label ?? g.label).toUpperCase();
  useEffect(() => {
    if (!sound) return;
    const t = setTimeout(
      () => playSfx(nat === 20 ? "nat20" : nat === 1 ? "nat1" : g.branch === "worse" ? "fail" : g.branch === "mixed" ? "partial" : "success"),
      (delay + FILL_S) * 1000,
    );
    return () => clearTimeout(t);
  }, [g.total, g.branch, nat, delay, sound]);
  const style: Css = {
    "--zc": zone.color,
    "--x": `${((shown - 0.5) / 20) * 100}%`,
    "--fill": shown / 20,
    "--d": `${delay}s`,
    "--fs": `${FILL_S}s`,
  };
  return (
    <section className={`tvx-meter ${nat === 20 ? "is-nat20" : nat === 1 ? "is-nat1" : ""}`} style={style} aria-label={`${g.total}: ${word}`}>
      <div className="tvx-meter-readout">
        {nat ? <span className="tvx-meter-nat">Natural {nat}!</span> : null}
        <span className="tvx-meter-num">{g.total}</span>
        <span className="tvx-meter-dot">·</span>
        <span className="tvx-meter-word">{word}</span>
      </div>
      <div className="tvx-meter-track">
        <div className="tvx-meter-cells">
          {Array.from({ length: 20 }, (_, i) => {
            const n = i + 1;
            const z = zoneOf(n);
            const on = n <= shown;
            const cs: Css = { "--cc": z.color, "--ci": i, "--cd": `calc(${delay}s + ${(i / Math.max(1, shown)) * FILL_S}s)` };
            return (
              <span key={n} className={`tvx-cell ${on ? "on" : ""} ${z.from === n && n > 1 ? "edge" : ""}`} style={cs}>
                {(n === 1 || n === 5 || n === 10 || n === 15 || n === 20) && <i>{n}</i>}
              </span>
            );
          })}
        </div>
        <div className="tvx-meter-marker" aria-hidden>
          <D20Glyph label={String(g.total)} className="tvx-meter-d20" />
        </div>
      </div>
      <div className="tvx-meter-zones" aria-hidden>
        {ZONES.map((z) => (
          <span key={z.grade} className={z.grade === g.grade ? "on" : ""} style={{ ["--zc" as string]: z.color, flex: z.to - z.from + 1 }}>
            {z.word}
          </span>
        ))}
      </div>
      {parts && parts.length > 0 && (
        <p className="tvx-meter-parts">
          {parts.map((p, i) => (
            <span key={i}>
              {i > 0 && " "}
              <b>{i === 0 && !p.signed ? p.value : fmtSigned(p.value)}</b> {p.label}
            </span>
          ))}
        </p>
      )}
      {nat === 20 && <span className="tvx-meter-burst" aria-hidden />}
    </section>
  );
}
