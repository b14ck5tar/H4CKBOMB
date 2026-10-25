"use client";
/**
 * Review page for the new phone UI (components/phone/*), with fake data. No GameHost, no network.
 *   /phone-preview?screen=join|make-hero|skill|lobby|vote|suggest|your-turn|throw|watching|finale|reveal|story
 *   finale: &step=pitch|vote|arm|armed|count|shake|thrown      reveal: &step=reveal|keepsake (default keepsake)
 *   lobby: &building=1 (card back)    suggest: &sent=1    join: &code=0 (type the code)    nav: &nav=1 (screen links)
 * Best viewed at 390x844 (browser device mode).
 */
import { useEffect, useMemo, useState } from "react";
import quick from "@/data/quickstart_heroes.json";
import questImages from "@/data/quest_images.json";
import { REACTIONS, PLAN_MAX } from "@/lib/rules";
import type { FinalRoll, Hero, Pitch, Player, Storybook } from "@/lib/types";
import {
  BackPlanScreen,
  FinalePitchScreen,
  JoinScreen,
  KeepsakeScreen,
  LobbyScreen,
  MakeHeroScreen,
  PhoneFrame,
  QuestVoteScreen,
  RevealScreen,
  ShakeScreen,
  SkillScreen,
  StoryWriteScreen,
  SuggestScreen,
  ThrowScreen,
  WatchingScreen,
  YourTurnScreen,
  heroImg,
  type ReadyHero,
} from "@/components/phone/index"; // "/index" on purpose: on Windows "@/components/phone" resolves to Phone.tsx

const QUICK = quick as ReadyHero[];
const ART = questImages as Record<string, string[]>;
const NAMES = ["Ava", "Ben", "Cam", "Dee"];
const COLORS = ["#ff2e7e", "#3de7ff", "#ffad3b", "#c6ff2e"];
const PICKS = ["raccoon", "grandma", "substitute", "barista"];

function fake(i: number, withHero = true): Player {
  const q = QUICK.find((x) => x.id === PICKS[i]) ?? QUICK[i];
  return {
    id: `p${i}`,
    name: NAMES[i],
    color: COLORS[i],
    status: withHero ? "ready" : "building",
    pick: withHero ? q.id : undefined,
    hero: withHero ? (q.hero as Hero) : undefined,
    hasPortrait: withHero,
    abilityAvailable: true,
    heart: 1,
    titles: [],
    peril: "",
  };
}

const GOAL = "Send the hatchling home before the sun comes up";
const NOW = "Get the egg past the sleeping farm dogs";
const LADDER = ["Find the egg", "Get past the dogs", "Reach the dome", "Send it home"];

const SCREENS = ["join", "make-hero", "skill", "lobby", "vote", "suggest", "your-turn", "throw", "watching", "finale", "reveal", "story"];

export default function PhonePreview() {
  const [q, setQ] = useState<URLSearchParams | null>(null);
  const [now] = useState(() => Date.now());
  const [votes, setVotes] = useState<Record<string, string>>({ p1: "galactic-signal", p2: "cornfield-dome" });
  const [idea, setIdea] = useState("");
  const [finalVote, setFinalVote] = useState("");
  const [skillDone, setSkillDone] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    setQ(qs);
    if (qs.get("sent") === "1") setIdea("Hum it the lullaby from the cereal ad");
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const players = useMemo(() => [0, 1, 2, 3].map((i) => fake(i)), []);
  const me = players[0];
  const log = (t: string, d?: unknown) => {
    console.log("[phone-preview] send", t, d ?? "");
    setToast(`send("${t}")`);
  };

  if (!q) return null;
  const screen = q.get("screen") ?? "join";
  const step = q.get("step") ?? "";
  const timer = { deadlineAt: now + 21_000, total: 30_000 };
  const art = ["join", "make-hero", "skill", "lobby", "vote", "story"].includes(screen) ? "" : ART["cornfield-dome"]?.[screen === "finale" || screen === "reveal" ? 2 : 1] ?? "";

  let body: React.ReactNode = null;
  let who: Player | undefined = me;
  switch (screen) {
    case "join":
      who = undefined;
      body = <JoinScreen code={q.get("code") === "0" ? "" : "WXYZ"} onJoin={(name, code) => log("join", { name, code })} />;
      break;
    case "make-hero":
      who = undefined;
      body = <MakeHeroScreen readyMade={QUICK} takenIds={["grandma"]} onCreate={(a) => log("concept", a)} onPick={(heroId) => log("pick", { heroId })} />;
      break;
    case "skill":
      body = skillDone ? (
        <LobbyScreen me={me} portrait={heroImg(me)} players={players} />
      ) : (
        <SkillScreen
          me={me}
          portrait={heroImg(me)}
          onAnswer={(skill) => {
            log("real", { skill });
            setSkillDone(true);
          }}
        />
      );
      break;
    case "lobby": {
      const building = q.get("building") === "1";
      const m = building ? fake(0, false) : me;
      who = building ? undefined : me;
      body = <LobbyScreen me={m} portrait={heroImg(m)} players={players.slice(0, 3)} onRedraw={() => log("redraw")} />;
      break;
    }
    case "vote":
      body = (
        <QuestVoteScreen
          options={[
            { id: "cornfield-dome", title: "The Sky Egg in the Cornfield", teaser: "Something fell into Farmer Ruth’s corn and it is humming. Loudly. At night.", art: ART["cornfield-dome"]?.[0] },
            { id: "galactic-signal", title: "The Signal from Very Far Away", teaser: "A radio dish keeps catching the same polite knock from deep space.", art: ART["galactic-signal"]?.[0] },
            { id: "rust-wyrm", title: "The Rust Wyrm of Pier Nine", teaser: "The old pier is eating bolts again, and the fishing fair is tomorrow.", art: ART["rust-wyrm"]?.[0] },
          ]}
          votes={votes}
          players={players}
          meId={me.id}
          onVote={(id) => {
            log("vote", { id });
            setVotes((v) => ({ ...v, [me.id]: id }));
          }}
          timer={{ deadlineAt: now + 11_000, total: 15_000 }}
        />
      );
      break;
    case "suggest":
      body = (
        <SuggestScreen
          owner={players[1]}
          ownerPortrait={heroImg(players[1])}
          sent={idea}
          goal={GOAL}
          nowGoal={NOW}
          ladder={LADDER}
          step={1}
          max={PLAN_MAX}
          onIdea={(t) => {
            log("idea", { text: t });
            setIdea(t);
          }}
          onTyping={() => {}}
          timer={timer}
        />
      );
      break;
    case "your-turn":
      body = (
        <YourTurnScreen
          ideas={{ p1: "I ask the park ranger what it wants", p2: "Hum it the slow lullaby from the cereal ad", p3: "Trade the dogs my emergency sandwich" }}
          players={players}
          goal={GOAL}
          nowGoal={NOW}
          ladder={LADDER}
          step={1}
          max={PLAN_MAX}
          onPitch={(text, creditId) => log("pitch", { text, creditId })}
          timer={{ deadlineAt: now + 24_000, total: 30_000 }}
        />
      );
      break;
    case "throw":
      body = (
        <ThrowScreen
          plan="I ask the park ranger what it wants"
          bonuses={[
            { label: "Charm", value: 2 },
            { label: "Ben’s idea", value: 1 },
          ]}
          onThrow={(power, angle) => log("roll", { power, angle })}
          timer={{ deadlineAt: now + 8_500, total: 10_000 }}
        />
      );
      break;
    case "watching":
      body = <WatchingScreen text="The DM rules on Ben’s plan" goal={GOAL} nowGoal={NOW} ladder={LADDER} step={1} reactions={REACTIONS} onReact={(emoji) => log("react", { emoji })} />;
      break;
    case "finale": {
      const pitches: Pitch[] = [
        { id: "x0", playerId: "p0", text: "I distract the dome with my security flashlight", useAbility: false, embraceFlaw: false },
        { id: "x1", playerId: "p1", text: "We all hum the lullaby together, really badly", useAbility: false, embraceFlaw: false },
        { id: "x2", playerId: "p2", text: "I ask the hatchling to point at home on my star map", useAbility: false, embraceFlaw: false },
        { id: "x3", playerId: "p3", text: "I plug the egg into the tractor battery", useAbility: false, embraceFlaw: false },
      ];
      if (step === "vote") {
        body = (
          <BackPlanScreen
            pitches={pitches}
            players={players}
            meId={me.id}
            mine={finalVote}
            eligible={new Set(["x1", "x2", "x0"])}
            goal={GOAL}
            onVote={(id) => {
              log("vote", { id });
              setFinalVote(id);
            }}
            timer={{ deadlineAt: now + 12_000, total: 15_000 }}
          />
        );
      } else if (["arm", "armed", "count", "shake", "thrown"].includes(step)) {
        const stage = step === "armed" ? "arm" : step === "thrown" ? "tumble" : (step as FinalRoll["stage"]);
        const final: FinalRoll = {
          dice: {},
          rolled: [],
          best: "",
          hopeBonus: 0,
          total: 0,
          ending: "TRIUMPHANT",
          stage,
          armed: step === "armed" ? ["p0"] : [],
          shook: step === "thrown" ? ["p0"] : [],
          auto: [],
        };
        body = (
          <ShakeScreen
            final={final}
            phase="final_roll"
            meId={me.id}
            deadlineAt={step === "count" ? now + 2_600 : 0}
            onArm={() => log("arm")}
            onShake={() => log("roll")}
          />
        );
      } else {
        body = <FinalePitchScreen goal={GOAL} max={PLAN_MAX} onPitch={(text) => log("pitch", { text })} timer={{ deadlineAt: now + 40_000, total: 60_000 }} />;
      }
      break;
    }
    case "reveal": {
      const book: Storybook = {
        title: "The Sky Egg in the Cornfield",
        dedication: "",
        pages: [],
        hero_pages: [{ hero_id: "p0", best_moment: "Asked the ranger what the hatchling wanted, then promised to help until the red light went off.", award: "Best nighttime negotiator" }],
        moral: "",
        real_story_bridge: "",
      };
      body =
        step === "reveal" ? (
          <RevealScreen />
        ) : (
          <KeepsakeScreen book={book} me={me} portrait={heroImg(me)} said="I ask the park ranger what it wants" solvedBy="Solved by Ava’s parallel parking (Gus) and Cam’s finding lost things (Mabel)." />
        );
      break;
    }
    case "story":
      who = undefined;
      body = <StoryWriteScreen sent={false} onSend={(s) => log("story", s)} timer={{ deadlineAt: now + 95_000, total: 120_000 }} />;
      break;
  }

  return (
    <>
      <PhoneFrame me={who} portrait={heroImg(who)} art={art} screenKey={`${screen}-${step}`}>
        {body}
      </PhoneFrame>
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 99, padding: "6px 12px", borderRadius: 8, background: "#000c", color: "#c6ff2e", font: "600 12px var(--font-ui), monospace" }}>
          {toast}
        </div>
      )}
      {q.get("nav") === "1" && (
        <nav style={{ position: "fixed", top: 0, right: 0, zIndex: 99, display: "flex", flexDirection: "column", gap: 2, padding: 4, background: "#000a", font: "600 10px var(--font-ui), monospace" }}>
          {SCREENS.map((s) => (
            <a key={s} href={`?screen=${s}&nav=1`} style={{ color: s === screen ? "#c6ff2e" : "#fff" }}>
              {s}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
