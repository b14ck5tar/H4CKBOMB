"use client";
/**
 * The ending on your phone.
 *   RevealScreen    (phase "reveal")     a BASED ON A TRUE STORY stamp slams down + "look at the TV"
 *   KeepsakeScreen  (phase "storybook")  your holo-foil keepsake card: story title, your hero, award, best moment,
 *                                         your own plan, and "Solved by…"
 */
import type { Player, Storybook } from "@/lib/types";
import { Kicker, ReactionBar, Say, SceneThumb } from "./kit";

/**
 * `text` may mark words with *stars* (lime); the stamp already says "based on a true story". Never dark: the scene,
 * how your version ended, and big reactions stay on the phone while the TV tells the real story.
 */
export function RevealScreen({
  text = "The real story is *on the TV*",
  art,
  line,
  reactions,
  onReact,
}: {
  text?: string;
  art?: string;
  /** how the table's version ended (state.endingLine / state.recap) */
  line?: string;
  reactions?: readonly string[];
  onReact?: (emoji: string) => void;
}) {
  return (
    <>
      <div className="pk-choices pk-center" style={{ gap: 14 }}>
        <div className="pk-truth" role="status">
          Based on a<br />
          true story
        </div>
        {art && <SceneThumb art={art} live="The real story" />}
        <Kicker tone="pink">The reveal</Kicker>
        <Say text={text} small />
      </div>
      {line && (
        <p className="pk-quote pk-latest">
          <small>Your version</small>
          {line}
        </p>
      )}
      {reactions && onReact && <ReactionBar reactions={reactions} onReact={onReact} big />}
    </>
  );
}

export function KeepsakeScreen({
  book,
  me,
  portrait,
  said,
  solvedBy,
}: {
  book: Storybook | null;
  me: Player;
  /** heroImg(me, portrait) */
  portrait?: string;
  /** this player's first unflagged plan from state.log */
  said?: string;
  solvedBy?: string;
}) {
  if (!book)
    return (
      <div className="pk-choices pk-center" style={{ flex: 1, justifyContent: "center", gap: 14 }}>
        <Kicker tone="amber">Almost there</Kicker>
        <Say text="Binding your *keepsake*…" small />
      </div>
    );
  const mine = book.hero_pages.find((h) => h.hero_id === me.id);
  return (
    <>
      <Kicker tone="amber">Your keepsake</Kicker>
      <div className="pk-keep">
        <div className="pk-keep-in">
          <span className="pk-keep-k">The tale of</span>
          <h2 className="pk-keep-t">{book.title}</h2>
          <div className="pk-keep-hero">
            {portrait && (
              <span className="pk-keep-portrait" style={{ ["--c" as string]: me.color } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={portrait} alt="" />
                <span className="pk-sheen" aria-hidden />
              </span>
            )}
            <div className="pk-choices" style={{ gap: 4, minWidth: 0, flex: 1 }}>
              <span className="pk-hrow-name" style={{ whiteSpace: "normal" }}>
                {me.hero?.name}
              </span>
              {mine?.award && <span className="pk-award">{mine.award}</span>}
              {mine?.best_moment && <p className="pk-hint" style={{ margin: 0, color: "#fff", fontSize: "0.98rem" }}>{mine.best_moment}</p>}
            </div>
          </div>
          {said && (
            <p className="pk-keep-said">
              <small>Your plan</small>“{said}”
            </p>
          )}
          {solvedBy && <p className="pk-solved">{solvedBy}</p>}
        </div>
      </div>
      <p className="pk-hint" style={{ textAlign: "center", fontFamily: "var(--font-ui), monospace", fontSize: "0.8rem" }}>
        Scan the code on the TV to keep the whole tale.
      </p>
    </>
  );
}
