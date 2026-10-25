"use client";
/**
 * Review page for the in-game TV skin (components/tvskin/*), with fake data. No GameHost, no network.
 *   /tv-preview?piece=turn      TurnCard + SuggestionBubbles (add &pick=1 for the credited idea)
 *   /tv-preview?piece=plan      PlanCard            (&tier=clever|solid|risky|wild|miracle)
 *   /tv-preview?piece=meter     QualityMeter + HUD  (&total=14 &nat=20|1)
 *   /tv-preview?piece=outcome   OutcomeCaption + HUD
 *   /tv-preview?piece=montage   EndingMontage from the first panel (&at=3 jumps to the reveal)
 *   /tv-preview?piece=reveal    straight to "Based on a true story" (&author=Maya for the Our Stories wording)
 *   /tv-preview?piece=autoplay  a full fake game on a loop: two turns (ideas, plan, roll, outcome), a nat-20 finale,
 *                               the "because of you" montage and the reveal, with paint-smear wipes between phases
 *                               (&from=meter2 starts at a step)
 *   /tv-preview?piece=finale-pitch   WRITE: sealed plan cards fly in, "2 of 4 in" (live)
 *   /tv-preview?piece=finale-vote    BACK: plans face up, vote dots land live, countdown
 *   /tv-preview?piece=finale-shake   ARM -> 3,2,1 -> SHAKE! -> ROLLING, cycling (&stage=arm|count|shake|tumble holds one)
 *   &t=600                      freeze every animation at 600 ms (for review frames), e.g. ?piece=wipe&t=560
 *                               (&fz=4000 waits 4 s before freezing, to catch later events like the picked idea)
 * Keys: Space replays the current piece.
 */
import { useEffect, useState } from "react";
import type { Tier } from "@/lib/types";
import { EndingMontage, FinalePitch, FinaleShake, FinaleVote, HudStrip, InkWipe, OutcomeCaption, PhaseSwap, PlanCard, QualityMeter, SceneArt, SuggestionBubbles, TurnCard, TvStage } from "@/components/tvskin";
import type { MontagePanel, RevealData } from "@/components/tvskin";

const ART = ["/quests/cornfield-dome/scene_1.webp", "/quests/cornfield-dome/scene_2.webp", "/quests/cornfield-dome/scene_3.webp", "/lobby/boulder_114b3c8fbac1bd2a55054597.webp"];
const ROSA = { name: "Rosa", epithet: "of the 3 AM Ovens", color: "#3de7ff", portrait: "/heroes/v2/night-baker.webp", stats: [{ label: "Guts", value: 1 }, { label: "Brains", value: -1 }, { label: "Charm", value: 3 }] };
const IDEAS = [
  { id: "a", text: "I ask the park ranger what it wants", by: "Sam", color: "#ffad3b", portrait: "/heroes/v2/mail-carrier.webp" },
  { id: "b", text: "I hum it a slow lullaby", by: "Priya", color: "#ff2e7e", portrait: "/heroes/v2/nurse.webp" },
  { id: "c", text: "Trade it my pretzel for the off switch", by: "Luis", color: "#c6ff2e" },
];
const LADDER = { steps: 4, at: 1, now: "Turn off the red light", goal: "Send the hatchling home before the sun comes up" };
const PANELS: MontagePanel[] = [
  { image: ART[0], line: "Rosa asked the ranger what the hatchling wanted, and the ranger had the key all along.", who: [{ name: "Rosa", color: "#3de7ff", portrait: "/heroes/v2/night-baker.webp" }, { name: "Sam", color: "#ffad3b" }] },
  { image: ART[1], line: "Mr. Han's lullaby echoed up the elevator shaft and woke the whole county.", who: [{ name: "Mr. Han", color: "#ffad3b", portrait: "/heroes/v2/librarian.webp" }] },
  { image: ART[2], line: "Bea hugged the giant pillow, fell asleep, and accidentally hit the off switch.", who: [{ name: "Bea", color: "#ff2e7e", portrait: "/heroes/v2/skater-grandma.webp" }, { name: "Rosa", color: "#3de7ff" }] },
];
const REVEAL: RevealData = {
  headline: "'Space object' found in rural Minnesota cornfield came from Chinese rocket, experts say",
  source: "Bring Me The News",
  date: "2026-10-23",
  summary: "An 11-foot metal dome found in a Stevens County cornfield is likely part of a rocket's upper stage that fell back to Earth.",
  now: "The object was secured. Nobody was hurt.",
  articleUrl: "https://bringmethenews.com/",
  yourTitle: "The Corn Hatchling",
  yourVersion: "Rosa asked the ranger, Mr. Han hummed too loud, Bea shared the pillow and snored, then Rosa got the red light turned off.",
  solvedBy: "Solved by Ava's parallel parking (Rosa) and Cam's finding lost things (Bea).",
  ending: "You did it",
  endingColor: "#ffd23f",
};

// ---------- autoplay: one full fake game ----------
const BEA = { name: "Bea", epithet: "the Skater Grandma", color: "#ff2e7e", portrait: "/heroes/v2/skater-grandma.webp", stats: [{ label: "Guts", value: 3 }, { label: "Brains", value: 1 }, { label: "Charm", value: -1 }] };
const IDEAS2 = [
  { id: "d", text: "Give it a giant pillow to hug", by: "Jay", color: "#3de7ff", portrait: "/heroes/v2/night-baker.webp" },
  { id: "e", text: "Sing the pumpkin song backwards", by: "Luis", color: "#c6ff2e" },
];
type Step = { k: string; ms: number; art: number; at: number };
const STEPS: Step[] = [
  { k: "turn", ms: 7600, art: 0, at: 1 },
  { k: "plan", ms: 5200, art: 0, at: 1 },
  { k: "meter", ms: 5200, art: 0, at: 1 },
  { k: "outcome", ms: 6500, art: 1, at: 2 },
  { k: "turn2", ms: 6800, art: 1, at: 2 },
  { k: "plan2", ms: 4800, art: 1, at: 2 },
  { k: "meter2", ms: 5200, art: 1, at: 2 },
  { k: "outcome2", ms: 6200, art: 2, at: 3 },
  { k: "finale", ms: 5600, art: 2, at: 3 },
  { k: "montage", ms: 26000, art: 2, at: 3 },
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
          <TurnCard hero={turn2 ? BEA : ROSA} playedBy={turn2 ? "Priya" : "Jay"} turn={{ n: turn2 ? 2 : 1, of: 3 }} prompt="Everyone else: suggest a move" k={step.k} />
          <SuggestionBubbles items={ideas} pickedId={picked} />
        </>
      );
      break;
    case "plan":
      body = <PlanCard hero={{ name: "Rosa", color: "#3de7ff", portrait: "/heroes/v2/night-baker.webp" }} plan="I ask the park ranger what it wants" tier="solid" stat={{ label: "Charm", value: 0 }} credit={{ name: "Mo", color: "#ffad3b", by: "Sam", portrait: "/heroes/v2/mail-carrier.webp" }} />;
      break;
    case "plan2":
      body = <PlanCard hero={{ name: "Bea", color: "#ff2e7e", portrait: "/heroes/v2/skater-grandma.webp" }} plan="I give it a giant pillow to hug" tier="risky" stat={{ label: "Charm", value: 1 }} credit={{ name: "Jay", color: "#3de7ff" }} />;
      break;
    case "meter":
      body = <QualityMeter total={14} parts={[{ label: "rolled", value: 13 }, { label: "Sam's idea", value: 1, signed: true }]} />;
      break;
    case "meter2":
      body = <QualityMeter total={1} natural={1} parts={[{ label: "rolled", value: 1 }, { label: "Charm", value: 1, signed: true }, { label: "bold plan", value: -3, signed: true }]} />;
      break;
    case "finale":
      body = <QualityMeter total={22} natural={20} parts={[{ label: "rolled", value: 20 }, { label: "Guts", value: 2, signed: true }]} />;
      break;
    case "outcome":
      body = <OutcomeCaption text="Rosa asks the park ranger what the hatchling wants. The ranger says it wants the red light off so it can finally sleep." tag="It works" tagColor="#3de7ff" hero={{ name: "Rosa", color: "#3de7ff" }} k="o1" />;
      break;
    case "outcome2":
      body = <OutcomeCaption text="Bea hugs the giant pillow herself and falls asleep on the switch box. The red light starts blinking faster." tag="Disaster" tagColor="#ff3b4e" hero={{ name: "Bea", color: "#ff2e7e" }} k="o2" />;
      break;
    case "montage":
      body = <EndingMontage panels={PANELS} reveal={REVEAL} keepsakeUrl="https://groupproject-game.vercel.app/tale#demo" panelMs={5200} />;
      break;
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "#07040d", overflow: "hidden" }}>
      <SceneArt src={ART[step.art]} />
      <TvStage>
        {step.k !== "montage" && <HudStrip ladder={ladder} />}
        <PhaseSwap k={step.k}>{body}</PhaseSwap>
      </TvStage>
    </div>
  );
}

// ---------- finale ----------
const FIN_HEROES = [
  { id: "p1", name: "Rosa", color: "#3de7ff", portrait: "/heroes/v2/night-baker.webp" },
  { id: "p2", name: "Bea", color: "#ff2e7e", portrait: "/heroes/v2/skater-grandma.webp" },
  { id: "p3", name: "Mr. Han", color: "#ffad3b", portrait: "/heroes/v2/librarian.webp" },
  { id: "p4", name: "DJ Kiko", color: "#c6ff2e", portrait: "/heroes/v2/dj.webp" },
];
const FIN_PLANS = [
  { id: "f1", playerId: "p1", text: "I ask the ranger for the key and promise to turn the light back on at dawn" },
  { id: "f2", playerId: "p2", text: "I sing the hatchling a lullaby while Rosa flips the switch" },
  { id: "f3", playerId: "p3", text: "I hand out pop quizzes until the light gets bored and turns itself off" },
  { id: "f4", playerId: "p4", text: "Espresso for everyone, then we carry the hatchling home together", eligible: false },
];
const VOTE_ORDER: [string, string][] = [["p2", "f1"], ["p3", "f1"], ["p1", "f2"], ["p4", "f3"]];
const SHAKE_STAGES = ["arm", "count", "shake", "tumble"] as const;

function FinalePreview({ piece, stageParam }: { piece: string; stageParam?: string }) {
  const [n, setN] = useState(0); // generic step counter driving the fake live updates
  const [deadline] = useState(() => Date.now() + 30000);
  useEffect(() => {
    const iv = setInterval(() => setN((x) => x + 1), piece === "finale-shake" ? 700 : 1300);
    return () => clearInterval(iv);
  }, [piece]);
  if (piece === "finale-pitch") {
    const k = Math.min(FIN_HEROES.length, Math.max(0, n - 1));
    return (
      <FinalePitch
        heroes={FIN_HEROES}
        plans={FIN_PLANS.slice(0, k)}
        typing={FIN_HEROES.slice(k, k + 2).map((h) => h.id)}
        situation="The ranger holds the key. The hatchling clutches the pillow. The sun is twenty minutes away."
        deadlineAt={deadline}
        totalSeconds={45}
      />
    );
  }
  if (piece === "finale-vote") {
    const votes = Object.fromEntries(VOTE_ORDER.slice(0, Math.max(0, n - 1)));
    return <FinaleVote heroes={FIN_HEROES} plans={FIN_PLANS} votes={votes} deadlineAt={deadline} totalSeconds={30} />;
  }
  // shake: cycle arm (fill) -> count 3,2,1 -> shake (fill) -> tumble
  const held = SHAKE_STAGES.find((x) => x === stageParam);
  const cyc = n % 16;
  const stage = held ?? (cyc < 5 ? "arm" : cyc < 8 ? "count" : cyc < 13 ? "shake" : "tumble");
  const filled = held ? 3 : stage === "arm" ? cyc : stage === "shake" ? cyc - 8 : 4;
  const ids = FIN_HEROES.slice(0, Math.min(4, filled)).map((h) => h.id);
  return (
    <FinaleShake
      stage={stage}
      heroes={FIN_HEROES}
      armed={stage === "arm" ? ids : FIN_HEROES.map((h) => h.id)}
      shook={stage === "shake" ? ids : stage === "tumble" ? FIN_HEROES.map((h) => h.id) : []}
      beat={stage === "count" ? 3 - (cyc - 5) : undefined}
      planBy={FIN_HEROES[0]}
      plan={FIN_PLANS[0].text}
    />
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
  if (piece.startsWith("finale-"))
    return (
      <div key={run} style={{ position: "fixed", inset: 0, background: "#07040d", overflow: "hidden" }}>
        <SceneArt src={ART[2]} dim={0.6} />
        <TvStage>
          {piece !== "finale-vote" && <HudStrip ladder={{ steps: 4, at: 3, now: "Send the hatchling home", goal: LADDER.goal }} />}
          <FinalePreview piece={piece} stageParam={q.get("stage") ?? undefined} />
        </TvStage>
      </div>
    );
  if (piece === "autoplay") return <AutoPlay key={run} from={q.get("from") ?? undefined} />;

  const tier = (q.get("tier") ?? "wild") as Tier;
  const total = Number(q.get("total") ?? 14);
  const nat = q.get("nat") ? Number(q.get("nat")) : undefined;

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
            <HudStrip ladder={LADDER} />
            <TurnCard hero={ROSA} playedBy="Jay" turn={{ n: 1, of: 3 }} prompt="Everyone else: suggest a move" k="rosa" />
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
            <HudStrip ladder={LADDER} />
            <PlanCard
              hero={{ name: "Rosa", color: "#3de7ff", portrait: "/heroes/v2/night-baker.webp" }}
              plan="I hum it a slow lullaby and then I tuck it in with a blanket"
              tier={tier}
              stat={{ label: "Charm", value: 2 }}
              credit={{ name: "Mo", color: "#ffad3b", bonus: 1, by: "Sam", portrait: "/heroes/v2/mail-carrier.webp" }}
            />
          </>
        )}
        {piece === "meter" && (
          <>
            <HudStrip ladder={LADDER} />
            <QualityMeter
              total={total}
              natural={nat}
              parts={[
                { label: "rolled", value: nat ?? 16 },
                { label: "Charm", value: 2, signed: true },
                { label: "Sam's idea", value: 1, signed: true },
                { label: "long shot", value: -5, signed: true },
              ]}
            />
          </>
        )}
        {piece === "outcome" && (
          <>
            <HudStrip ladder={{ ...LADDER, at: 2, now: "Get the key from the ranger" }} />
            <OutcomeCaption
              text="Rosa asks the park ranger about the creature with Mr. Han. The ranger says it wants the red light off so it can finally sleep."
              tag="It works"
              tagColor="#3de7ff"
              hero={{ name: "Rosa", color: "#3de7ff" }}
              k={run}
            />
          </>
        )}
      </TvStage>
    </div>
  );
}
