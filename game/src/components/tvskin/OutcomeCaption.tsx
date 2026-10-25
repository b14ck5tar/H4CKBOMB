"use client";
import { Words, type Css } from "./shared";

export interface OutcomeCaptionProps {
  /** What happened (1-3 short sentences). Long text is fine: it scales down. */
  text: string;
  /** Grade word for the little tag ("IT WORKS", "UH OH"). */
  tag?: string;
  /** Tag color (grade color); defaults to cyan. */
  tagColor?: string;
  /** Whose action this was: shows a colored speaker bar like film subtitles. */
  hero?: { name: string; color: string };
  /** Seconds between words (match the narrator; 0 = show at once). */
  pace?: number;
  /** Key so the reveal replays for each new line. */
  k?: string | number;
}

/** Subtitle-style caption over the art: big white words with a hard shadow, revealed word by word. */
export function OutcomeCaption({ text, tag, tagColor = "#3de7ff", hero, pace = 0.07, k }: OutcomeCaptionProps) {
  const size = text.length > 170 ? 2.25 : text.length > 110 ? 2.6 : 3.1;
  const style: Css = { "--tc": tagColor, "--c": hero?.color ?? "#fff", "--fs": size };
  return (
    <section key={k} className="tvx-caption" style={style} aria-live="polite">
      {(tag || hero) && (
        <p className="tvx-caption-meta">
          {tag && <span className="tvx-caption-tag">{tag}</span>}
          {hero && <span className="tvx-caption-hero">{hero.name}</span>}
        </p>
      )}
      <p className="tvx-caption-txt">{pace > 0 ? <Words text={text} step={pace} start={0.25} /> : text}</p>
    </section>
  );
}
