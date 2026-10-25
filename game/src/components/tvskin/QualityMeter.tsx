"use client";
import { useEffect, useRef } from "react";
import { gradeRoll, type Grade, type GradeResult } from "@/lib/grade";
import { playSfx } from "@/lib/sound";
import { D20Glyph, fmtSigned, type Css } from "./shared";
import { flashScreen, shakeStage } from "./motion";

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
const FILL_S = 1.0; // the host holds 2.2 s after the die lands: the grade has to land by ~1.2 s and settle by ~1.75 s
/** When segment i (0-based) lights, as a fraction of the fill: matches the marker's ease-out travel (quadratic). */
const litAt = (i: number, shown: number) => 1 - Math.sqrt(Math.max(0, 1 - (i + 1) / Math.max(1, shown)));

/** A 1-20 track that fills to the roll total, then slams the grade: "14 · IT WORKS". Nat 1 cracks, nat 20 bursts. */
export function QualityMeter({ total, natural, parts, result, grade, label, delay = 0.2, sound = true }: QualityMeterProps) {
  const own = gradeRoll(total, natural);
  const g = { ...own, ...(result ?? {}), ...(grade ? { grade } : {}) };
  const shown = Math.max(1, Math.min(20, g.total));
  const zone = ZONES.find((z) => z.grade === g.grade) ?? zoneOf(shown);
  const nat = natural === 20 ? 20 : natural === 1 ? 1 : 0;
  const word = (label ?? g.label).toUpperCase();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    // a tick per segment as the track fills (rising pitch), then the verdict hit
    if (sound)
      for (let i = 0; i < shown; i++)
        ts.push(setTimeout(() => playSfx("tap", { volume: 0.32, pitch: Math.min(14, i * 0.7) }), (delay + litAt(i, shown) * FILL_S) * 1000));
    ts.push(
      setTimeout(() => {
        if (sound) playSfx(nat === 20 ? "nat20" : nat === 1 ? "nat1" : g.branch === "worse" ? "fail" : g.branch === "mixed" ? "partial" : "success");
        if (nat === 1) {
          shakeStage(ref.current, 1.4);
          flashScreen(ref.current, "rgba(255,40,60,0.55)", 600);
        } else if (nat === 20) {
          flashScreen(ref.current, "rgba(255,214,80,0.75)", 700);
        } else if (g.branch === "worse") shakeStage(ref.current, 0.5);
      }, (delay + FILL_S + 0.05) * 1000),
    );
    return () => ts.forEach(clearTimeout);
  }, [g.total, g.branch, nat, delay, sound, shown]);
  const style: Css = {
    "--zc": zone.color,
    "--x": `${((shown - 0.5) / 20) * 100}%`,
    "--fill": shown / 20,
    "--d": `${delay}s`,
    "--fs": `${FILL_S}s`,
  };
  return (
    <section ref={ref} className={`tvx-meter ${nat === 20 ? "is-nat20" : nat === 1 ? "is-nat1" : ""}`} style={style} aria-label={`${g.total}: ${word}`}>
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
            const cs: Css = { "--cc": z.color, "--ci": i, "--cd": `${(delay + litAt(i, shown) * FILL_S * 0.82).toFixed(3)}s` };
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
      {nat === 20 && (
        <span className="tvx-confetti" aria-hidden>
          {Array.from({ length: 22 }, (_, k) => (
            <i key={k} style={{ ["--a" as string]: `${(k * 360) / 22 + (k % 3) * 7}deg`, ["--r" as string]: 10 + (k % 5) * 3.5, ["--cc" as string]: ["#ffd23f", "#ff2e7e", "#3de7ff", "#c6ff2e"][k % 4] } as Css} />
          ))}
        </span>
      )}
    </section>
  );
}
