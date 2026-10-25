"use client";
/**
 * Review page for the in-game TV skin (components/tvskin/*), with fake data. No GameHost, no network.
 *   /tv-preview?piece=turn      TurnCard + SuggestionBubbles (add &pick=1 for the credited idea)
 *   /tv-preview?piece=plan      PlanCard            (&tier=clever|solid|risky|wild|miracle)
 *   /tv-preview?piece=meter     QualityMeter + HUD  (&total=14 &nat=20|1)
 *   /tv-preview?piece=outcome   OutcomeCaption + HUD (&danger=4)
 *   /tv-preview?piece=montage   EndingMontage from the first panel (&at=3 jumps to the reveal)
 *   /tv-preview?piece=reveal    straight to "Based on a true story" (&author=Maya for the Our Stories wording)
 *   /tv-preview?piece=autoplay  a full fake game on a loop: two turns (ideas, plan, roll, outcome), a nat-20 finale,
 *                               the "because of you" montage and the reveal, with paint-smear wipes between phases
 *                               (&from=meter2 starts at a step)
 *   &t=600                      freeze every animation at 600 ms (for review frames), e.g. ?piece=wipe&t=560
 *                               (&fz=4000 waits 4 s before freezing, to catch later events like the picked idea)
 * Keys: Space replays the current piece.
 */
import { useEffect, useState } from "react";
import type { Tier } from "@/lib/types";
import { EndingMontage, HudStrip, InkWipe, OutcomeCaption, PhaseSwap, PlanCard, QualityMeter, SceneArt, SuggestionBubbles, TurnCard, TvStage } from "@/components/tvskin";
import type { MontagePanel, RevealData } from "@/components/tvskin";

const ART = ["/quests/cornfield-dome/scene_1.webp", "/quests/cornfield-dome/scene_2.webp", "/quests/cornfield-dome/scene_3.webp", "/lobby/boulder_114b3c8fbac1bd2a55054597.webp"];
const GUS = { name: "Gus", epithet: "of Mall Security", color: "#3de7ff", portrait: "/heroes/raccoon.webp", stats: [{ label: "Guts", value: 2 }, { label: "Brains", value: 1 }, { label: "Charm", value: 0 }] };
const IDEAS = [
  { id: "a", text: "I ask the park ranger what it wants", by: "Sam", color: "#ffad3b", portrait: "/heroes/substitute.webp" },
  { id: "b", text: "I hum it a slow lullaby", by: "Priya", color: "#ff2e7e", portrait: "/heroes/grandma.webp" },
  { id: "c", text: "Trade it my pretzel for the off switch", by: "Luis", color: "#c6ff2e" },
];
const LADDER = { steps: 4, at: 1, now: "Turn off the red light", goal: "Send the hatchling home before the sun comes up" };
const PANELS: MontagePanel[] = [
  { image: ART[0], line: "Gus asked the ranger what the hatchling wanted, and the ranger had the key all along.", who: [{ name: "Gus", color: "#3de7ff", portrait: "/heroes/raccoon.webp" }, { name: "Sam", color: "#ffad3b" }] },
  { image: ART[1], line: "Mr. Pruitt's lullaby echoed up the elevator shaft and woke the whole county.", who: [{ name: "Mr. Pruitt", color: "#ffad3b", portrait: "/heroes/substitute.webp" }] },
  { image: ART[2], line: "Mabel hugged the giant pillow, fell asleep, and accidentally hit the off switch.", who: [{ name: "Mabel", color: "#ff2e7e", portrait: "/heroes/grandma.webp" }, { name: "Gus", color: "#3de7ff" }] },
];
const REVEAL: RevealData = {
  headline: "'Space object' found in rural Minnesota cornfield came from Chinese rocket, experts say",
  source: "Bring Me The News",
  date: "2026-10-23",
  summary: "An 11-foot metal dome found in a Stevens County cornfield is likely part of a rocket's upper stage that fell back to Earth.",
  now: "The object was secured. Nobody was hurt.",
  articleUrl: "https://bringmethenews.com/",
  yourTitle: "The Corn Hatchling",
  yourVersion: "Gus asked the ranger, Mr. Pruitt hummed too loud, Mabel shared the pillow and snored, then Gus got the red light turned off.",
  solvedBy: "Solved by Ava's parallel parking (Gus) and Cam's finding lost things (Mabel).",
  ending: "You did it",
  endingColor: "#ffd23f",
};

// ---------- autoplay: one full fake game ----------
const MABEL = { name: "Mabel", epithet: "Ghost Hunter Since 1974", color: "#ff2e7e", portrait: "/heroes/grandma.webp", stats: [{ label: "Guts", value: 2 }, { label: "Brains", value: -1 }, { label: "Charm", value: 1 }] };
const IDEAS2 = [
  { id: "d", text: "Give it a giant pillow to hug", by: "Jay", color: "#3de7ff", portrait: "/heroes/raccoon.webp" },
  { id: "e", text: "Sing the pumpkin song backwards", by: "Luis", color: "#c6ff2e" },
];
type Step = { k: string; ms: number; art: number; at: number; danger: number };
const STEPS: Step[] = [
  { k: "turn", ms: 7600, art: 0, at: 1, danger: 1 },
  { k: "plan", ms: 5200, art: 0, at: 1, danger: 1 },
  { k: "meter", ms: 5200, art: 0, at: 1, danger: 1 },
  { k: "outcome", ms: 6500, art: 1, at: 2, danger: 1 },
  { k: "turn2", ms: 6800, art: 1, at: 2, danger: 2 },
  { k: "plan2", ms: 4800, art: 1, at: 2, danger: 2 },
  { k: "meter2", ms: 5200, art: 1, at: 2, danger: 2 },
  { k: "outcome2", ms: 6200, art: 2, at: 3, danger: 4 },
  { k: "finale", ms: 5600, art: 2, at: 3, danger: 4 },
  { k: "montage", ms: 26000, art: 2, at: 3, danger: 4 },
];

function AutoPlay({ from }: { from?: string }) {
  const [i, setI] = useState(() => Math.max(0, STEPS.findIndex((x) => x.k === from)));
  const [ideas, setIdeas] = useState<typeof IDEAS>([]);
  const [picked, setPicked] = useState<string | undefined>();
  const step = STEPS[i];
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [setTimeout(() => setI((n) => (n + 1) % STEPS.length), step.ms)];
    if (step.k === "turn" || step.k === "turn2") {
      const list = step.k === "turn" ? IDEAS : IDEAS2;
      setIdeas([]);
      setPicked(undefined);
      list.forEach((x, n) => ts.push(setTimeout(() => setIdeas((xs) => [...xs, x]), 1500 + n * 900)));
      ts.push(setTimeout(() => setPicked(list[0].id), 1500 + list.length * 900 + 900));
    }
    return () => ts.forEach(clearTimeout);
  }, [i, step.k, step.ms]);
  const turn2 = ["turn2", "plan2", "meter2", "outcome2"].includes(step.k);
  const ladder = { steps: 4, at: step.at, now: ["", "Turn off the red light", "Get the key from the ranger", "Tuck the hatchling in before sunrise"][step.at], goal: LADDER.goal };
  let body: React.ReactNode = null;
  switch (step.k) {
    case "turn":
    case "turn2":
      body = (
        <>
          <TurnCard hero={turn2 ? MABEL : GUS} playedBy={turn2 ? "Priya" : "Jay"} turn={{ n: turn2 ? 2 : 1, of: 3 }} prompt="Everyone else: suggest a move" k={step.k} />
          <SuggestionBubbles items={ideas} pickedId={picked} />
        </>
      );
      break;
    case "plan":
      body = <PlanCard hero={{ name: "Gus", color: "#3de7ff", portrait: "/heroes/raccoon.webp" }} plan="I ask the park ranger what it wants" tier="solid" stat={{ label: "Charm", value: 0 }} credit={{ name: "Sam", color: "#ffad3b" }} />;
      break;
    case "plan2":
      body = <PlanCard hero={{ name: "Mabel", color: "#ff2e7e", portrait: "/heroes/grandma.webp" }} plan="I give it a giant pillow to hug" tier="risky" stat={{ label: "Charm", value: 1 }} credit={{ name: "Jay", color: "#3de7ff" }} />;
      break;
    case "meter":
      body = <QualityMeter total={14} parts={[{ label: "rolled", value: 13 }, { label: "Sam's idea", value: 1, signed: true }]} />;
      break;
    case "meter2":
      body = <QualityMeter total={1} natural={1} parts={[{ label: "rolled", value: 1 }, { label: "Charm", value: 1, signed: true }, { label: "risky plan", value: -3, signed: true }]} />;
      break;
    case "finale":
      body = <QualityMeter total={22} natural={20} parts={[{ label: "rolled", value: 20 }, { label: "Guts", value: 2, signed: true }]} />;
      break;
    case "outcome":
      body = <OutcomeCaption text="Gus asks the park ranger what the hatchling wants. The ranger says it wants the red light off so it can finally sleep." tag="It works" tagColor="#3de7ff" hero={{ name: "Gus", color: "#3de7ff" }} k="o1" />;
      break;
    case "outcome2":
      body = <OutcomeCaption text="Mabel hugs the giant pillow herself and falls asleep on the switch box. The red light starts blinking faster." tag="Disaster" tagColor="#ff3b4e" hero={{ name: "Mabel", color: "#ff2e7e" }} k="o2" />;
      break;
    case "montage":
      body = <EndingMontage panels={PANELS} reveal={REVEAL} keepsakeUrl="https://groupproject-game.vercel.app/tale#demo" panelMs={5200} />;
      break;
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "#07040d", overflow: "hidden" }}>
      <SceneArt src={ART[step.art]} />
      <TvStage>
        {step.k !== "montage" && <HudStrip ladder={ladder} danger={{ level: step.danger, max: 5 }} />}
        <PhaseSwap k={step.k}>{body}</PhaseSwap>
      </TvStage>
    </div>
  );
}

export default function TvPreview() {
  const [q, setQ] = useState<URLSearchParams | null>(null);
  const [run, setRun] = useState(0);
  const [picked, setPicked] = useState<string | undefined>();
  const [ideas, setIdeas] = useState(IDEAS.slice(0, 0));
  useEffect(() => setQ(new URLSearchParams(location.search)), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === " " && setRun((n) => n + 1);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const piece = q?.get("piece") ?? "turn";
  // review frames: pause every CSS/WAAPI animation at the same time offset
  useEffect(() => {
    const t = q?.get("t");
    if (!t) return;
    const id = setTimeout(() => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = Number(t);
      }
    }, Number(q?.get("fz") ?? 1500));
    return () => clearTimeout(id);
  }, [q]);
  // ideas fly in one by one, then one gets picked
  useEffect(() => {
    if (!q || piece !== "turn") return;
    setIdeas([]);
    setPicked(undefined);
    const ts = IDEAS.map((x, i) => setTimeout(() => setIdeas((xs) => [...xs, x]), 900 + i * 700));
    if (q.has("pick")) ts.push(setTimeout(() => setPicked("a"), 900 + IDEAS.length * 700 + 400));
    return () => ts.forEach(clearTimeout);
  }, [q, piece, run]);
  if (!q) return <div style={{ position: "fixed", inset: 0, background: "#07040d" }} />;
  if (piece === "autoplay") return <AutoPlay key={run} from={q.get("from") ?? undefined} />;

  const tier = (q.get("tier") ?? "wild") as Tier;
  const total = Number(q.get("total") ?? 14);
  const nat = q.get("nat") ? Number(q.get("nat")) : undefined;
  const danger = Number(q.get("danger") ?? 2);

  if (piece === "montage" || piece === "reveal")
    return (
      <div key={run} style={{ position: "fixed", inset: 0, background: "#07040d" }}>
        <EndingMontage panels={PANELS} reveal={q.get("author") ? { ...REVEAL, author: q.get("author")! } : REVEAL} keepsakeUrl="https://groupproject-game.vercel.app/tale#demo" start={piece === "reveal" ? PANELS.length : Number(q.get("at") ?? 0)} />
      </div>
    );

  return (
    <div key={run} style={{ position: "fixed", inset: 0, background: "#07040d", overflow: "hidden" }}>
      <SceneArt src={piece === "plan" ? ART[1] : piece === "outcome" ? ART[2] : ART[0]} />
      <TvStage>
        {piece === "turn" && (
          <>
            <HudStrip ladder={LADDER} danger={{ level: danger, max: 5 }} />
            <TurnCard hero={GUS} playedBy="Jay" turn={{ n: 1, of: 3 }} prompt="Everyone else: suggest a move" k="gus" />
            <SuggestionBubbles items={ideas} pickedId={picked} />
          </>
        )}
        {piece === "wipe" && (
          <>
            <QualityMeter total={14} sound={false} />
            <InkWipe />
          </>
        )}
        {piece === "plan" && (
          <>
            <HudStrip ladder={LADDER} danger={{ level: danger, max: 5 }} />
            <PlanCard
              hero={{ name: "Gus", color: "#3de7ff", portrait: "/heroes/raccoon.webp" }}
              plan="I hum it a slow lullaby and then I tuck it in with a blanket"
              tier={tier}
              stat={{ label: "Charm", value: 2 }}
              credit={{ name: "Sam", color: "#ffad3b", bonus: 1 }}
            />
          </>
        )}
        {piece === "meter" && (
          <>
            <HudStrip ladder={LADDER} danger={{ level: danger, max: 5 }} />
            <QualityMeter
              total={total}
              natural={nat}
              parts={[
                { label: "rolled", value: nat ?? 16 },
                { label: "Charm", value: 2, signed: true },
                { label: "Sam's idea", value: 1, signed: true },
                { label: "wild plan", value: -5, signed: true },
              ]}
            />
          </>
        )}
        {piece === "outcome" && (
          <>
            <HudStrip ladder={{ ...LADDER, at: 2, now: "Get the key from the ranger" }} danger={{ level: danger, max: 5 }} />
            <OutcomeCaption
              text="Gus asks the park ranger about the creature with Mr. Pruitt. The ranger says it wants the red light off so it can finally sleep."
              tag="It works"
              tagColor="#3de7ff"
              hero={{ name: "Gus", color: "#3de7ff" }}
              k={run}
            />
          </>
        )}
      </TvStage>
    </div>
  );
}
