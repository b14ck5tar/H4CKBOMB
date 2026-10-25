"use client";
/**
 * The phone: a controller, never a second TV. Every screen is ONE big instruction (the same words as the TV's
 * "Now:" banner, lib/now.ts), a timer when there is one, the scene's art blurred behind it, and one control.
 */
import { useCallback, useEffect } from "react";
import { usePhone } from "@/lib/usePhone";
import { TYPE_MAX, QUICK_TURN_MS, REACTIONS, STAT_LABEL, TURN_MS, stampText } from "@/lib/rules";
import { eligibleIds, heroFirst, nowText, plateFor, turnOwner, winnerPid } from "@/lib/now";
import { sfx } from "@/lib/sfx";
import { playSfx } from "@/lib/sound";
import {
  BackPlanScreen,
  FinalePitchScreen,
  GameButton,
  JoinScreen,
  KeepsakeScreen,
  LobbyScreen,
  MakeHeroScreen,
  PhoneFrame,
  QuestVoteScreen,
  RevealScreen,
  Say as PSay,
  ShakeScreen,
  SkillScreen,
  StoryWriteScreen,
  SuggestScreen,
  ThrowScreen,
  WatchingScreen,
  YourTurnScreen,
  heroImg,
  type ReadyHero,
} from "./phone/index"; // "/index" on purpose: on Windows "./phone" resolves to this file
import type { GameState } from "@/lib/types";
import quickHeroes from "@/data/quickstart_heroes_v2.json";
import questImages from "@/data/quest_images.json";

function vibrate(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {}
}

type Send = (t: string, d?: Record<string, unknown>) => void;

const QUICK = quickHeroes as ReadyHero[];

/** The plate behind the current moment (the same picture the TV is showing, from the pre-painted set). */
function artFor(s: GameState | null) {
  if (!s?.questId || s.phase === "lobby" || s.phase === "story_vote") return "";
  if (s.sceneArt) return s.sceneArt; // the painting on the TV right now (the host sends a small copy)
  const plates = (questImages as Record<string, string[]>)[s.questId] ?? [];
  return plates[plateFor(s)] ?? plates[0] ?? s.storyOptions.find((o) => o.id === s.questId)?.art ?? "";
}

/** The small label over the big line while the TV has the floor. */
const KICKER: Record<string, string> = {
  quest: "The story",
  narrating: "The story",
  ruling: "The DM rules",
  roll: "The throw",
  outcome: "What happened",
  final_roll: "The final roll",
  final_result: "The final roll",
  epilogue: "The ending",
};

/** Every message from this phone gets its sound: send = submit, back = vote, pick = pick, the rest a tap. */
const SEND_SFX: Record<string, string> = { pitch: "submit", idea: "submit", story: "submit", concept: "submit", real: "submit", join: "submit", vote: "vote", pick: "pick", arm: "tap", react: "tap", redraw: "tap" };

export function Phone({ code }: { code: string }) {
  const { state, me, portrait, deadlineAt, send: rawSend } = usePhone(code);
  const send = useCallback<Send>(
    (t, d) => {
      const fx = SEND_SFX[t];
      if (fx) playSfx(fx);
      rawSend(t, d);
    },
    [rawSend],
  );
  // Your turn: the phone chimes (and buzzes) the moment it's yours.
  const myTurn = !!state && !!me && state.phase === "turn" && state.turnOrder[state.turnIndex] === me.id;
  useEffect(() => {
    if (myTurn) {
      playSfx("turnStart");
      vibrate([30, 40, 30]);
    }
  }, [myTurn]);
  // Your plan won: buzz once, so you look down at the ROLL button.
  const won = !!state && !!me && winnerPid(state) === me.id && ["ruling", "roll"].includes(state.phase);
  useEffect(() => {
    if (won) vibrate([40, 60, 40, 60, 160]);
  }, [won]);

  if (!state) {
    return (
      <PhoneFrame>
        <PSay text={`Finding table ${code}…`} />
      </PhoneFrame>
    );
  }
  if (!me) {
    if (state.phase !== "lobby")
      return (
        <PhoneFrame art={artFor(state)}>
          <PSay text="A story is underway. Jump in on the next one!" />
        </PhoneFrame>
      );
    return (
      <PhoneFrame onPointerDown={() => sfx.unlock()}>
        <JoinScreen code={code} onJoin={(name) => send("join", { name })} />
      </PhoneFrame>
    );
  }

  const timer = (total: number) => ({ deadlineAt, total });
  const ladderProps = { goal: state.goal, nowGoal: state.nowGoal, ladder: state.ladder, step: state.step };
  const owner = state.players.find((p) => p.id === turnOwner(state));
  const turnMs = state.mode === "quick" ? QUICK_TURN_MS : TURN_MS;
  const art = artFor(state);
  // Never a dark screen: while the TV has the floor, the phone shows the scene, what's happening (the outcome itself
  // once it's in), the plan on the table, the latest thing that happened, the goal, and big reactions for the TV.
  const tablePitch = state.pitches.find((p) => p.id === state.winnerId) ?? (state.finale ? undefined : state.pitches[0]);
  const showPlan = !!tablePitch && ["ruling", "roll"].includes(state.phase);
  // the same words as the TV: the DM's version once it's ruled (CD playtest: phone showed the raw text, TV the DM's)
  const planText = tablePitch?.verdict?.interpretation && !tablePitch.verdict.fallback ? tablePitch.verdict.interpretation : tablePitch?.text;
  const latest =
    state.phase === "epilogue"
      ? { label: "How it ended", text: state.epilogue || state.endingLine }
      : state.phase === "narrating" || state.phase === "quest"
        ? { label: "The story", text: state.outcome || state.narration }
        : state.phase !== "outcome" && state.outcome
          ? { label: "What just happened", text: state.outcome }
          : undefined;
  const watching = (text = nowText(state, me.id)) => (
    <WatchingScreen
      text={state.phase === "outcome" && state.outcome ? state.outcome : text}
      kicker={KICKER[state.phase] ?? "Eyes up"}
      art={art}
      plan={showPlan && tablePitch && planText ? { who: heroFirst(state, tablePitch.playerId), color: state.players.find((p) => p.id === tablePitch.playerId)?.color, text: planText, idea: tablePitch.creditId ? heroFirst(state, tablePitch.creditId) : undefined } : undefined}
      latest={latest}
      {...ladderProps}
      reactions={REACTIONS}
      onReact={(emoji) => send("react", { emoji })}
    />
  );

  // Never cover the climax (final roll, ending, reveal) with the away screen.
  const inStory = !["lobby", "story_write", "story_vote", "final_roll", "final_result", "epilogue", "reveal", "storybook"].includes(state.phase);
  let body: React.ReactNode;
  if (inStory && me.away) {
    body = (
      <>
        <PSay text={`${me.hero?.name ?? "Your hero"} is on autopilot`} />
        <GameButton tone="lime" xl onClick={() => send("back")} sub="Take your hero back">
          I&apos;M BACK
        </GameButton>
      </>
    );
  } else
    switch (state.phase) {
      case "lobby":
        if (me.status === "building" && !me.hero) body = <LobbyScreen me={me} players={state.players} />;
        else if (me.hero && me.real === undefined) body = <SkillScreen me={me} portrait={heroImg(me, portrait)} onAnswer={(skill) => send("real", { skill, fear: "" })} />;
        else if (me.hero) body = <LobbyScreen me={me} portrait={heroImg(me, me.hasPortrait ? portrait : undefined)} players={state.players} onRedraw={() => send("redraw")} />;
        else
          body = (
            <MakeHeroScreen
              seed={code}
              readyMade={QUICK}
              defaultName={me.name}
              takenIds={state.players.filter((p) => p.id !== me.id && p.pick).map((p) => p.pick!)}
              onCreate={({ text, skill, name }) => {
                sfx.unlock();
                send("real", { skill, fear: "" });
                send("concept", { text, name });
              }}
              onPick={(heroId, name) => {
                sfx.unlock();
                send("pick", { heroId, name });
              }}
            />
          );
        break;
      case "story_write":
        body = <StoryWriteScreen sent={state.written.includes(me.id)} onSend={(st) => send("story", st)} timer={timer(state.mode === "quick" ? 90_000 : 120_000)} />;
        break;
      case "story_vote":
        body = <QuestVoteScreen options={state.storyOptions} votes={state.votes} players={state.players} meId={me.id} onVote={(id) => send("vote", { id })} timer={timer(15_000)} />;
        break;
      case "turn":
        body =
          turnOwner(state) === me.id ? (
            <YourTurnScreen
              key={state.turnIndex}
              ideas={state.ideas}
              players={state.players}
              portraitOf={(p) => heroImg(p, undefined)}
              {...ladderProps}
              max={TYPE_MAX}
              onPitch={(text, creditId, { own, idea }) => send("pitch", { text, creditId, own, idea })}
              onTyping={() => send("typing")}
              voice
              timer={timer(turnMs)}
            />
          ) : (
            <SuggestScreen
              key={state.turnIndex}
              owner={owner}
              ownerPortrait={heroImg(owner)}
              sent={state.ideas[me.id]}
              {...ladderProps}
              max={TYPE_MAX}
              onIdea={(text) => send("idea", { text })}
              onTyping={() => send("typing")}
              voice
              timer={timer(turnMs)}
            />
          );
        break;
      case "pitch":
        body = (
          <FinalePitchScreen
            key={state.sceneIndex}
            sent={state.pitches.find((p) => p.playerId === me.id)?.text}
            goal={state.goal}
            max={TYPE_MAX}
            onPitch={(text) => send("pitch", { text })}
            onTyping={() => send("typing")}
            voice
            timer={timer(turnMs)}
          />
        );
        break;
      case "vote":
        body = (
          <BackPlanScreen
            pitches={state.pitches}
            players={state.players}
            meId={me.id}
            mine={state.votes[me.id]}
            eligible={eligibleIds(state)}
            portraitOf={(p) => heroImg(p, undefined)}
            goal={state.goal}
            onVote={(id) => send("vote", { id })}
            timer={timer(20_000)}
          />
        );
        break;
      case "roll": {
        const r = state.rolls[0];
        const mine = r?.playerId === me.id;
        if (mine && !state.revealed.includes(me.id)) {
          const pitch = state.pitches.find((p) => p.playerId === me.id);
          const v = pitch?.verdict;
          const bonuses = [
            ...(v ? [{ label: STAT_LABEL[v.stat], value: r.statBonus }] : []),
            ...(r.bonus ? [{ label: pitch?.creditId ? `${heroFirst(state, pitch.creditId)}'s idea` : "backed", value: r.bonus }] : []),
            ...(r.tierMod ? [{ label: v ? `${stampText(v.tier).toLowerCase()} plan` : "plan", value: r.tierMod }] : []),
          ];
          body = (
            <ThrowScreen
              onThrow={(power, angle) => {
                sfx.unlock();
                send("roll", { power, angle });
                vibrate([20, 40, 20]);
              }}
              plan={v?.interpretation && !v.fallback ? v.interpretation : pitch?.text}
              bonuses={bonuses}
              timer={timer(10_000)}
            />
          );
        } else body = watching(mine ? "Thrown! Watch it land on the TV" : undefined);
        break;
      }
      case "final_result":
        body = watching();
        break;
      case "final_roll":
        if (state.final?.stage === "landed") {
          body = watching();
          break;
        }
        body = <ShakeScreen final={state.final} phase={state.phase} meId={me.id} deadlineAt={deadlineAt} onArm={() => send("arm")} onShake={() => send("roll")} onUnlock={() => sfx.unlock()} />;
        break;
      case "reveal":
        body = <RevealScreen art={art} line={state.recap || state.endingLine} reactions={REACTIONS} onReact={(emoji) => send("react", { emoji })} onDone={() => send("ready")} done={state.ready.includes(me.id)} />;
        break;
      case "storybook":
        body = (
          <KeepsakeScreen
            book={state.storybook && { ...state.storybook, title: state.quest?.title || state.storybook.title }}
            me={me}
            portrait={heroImg(me, portrait)}
            said={state.log.filter((l) => l.heroId === me.id && !l.flagged).map((l) => l.pitch)[0]}
            solvedBy={state.solvedBy}
          />
        );
        break;
      default:
        body = watching();
    }

  return (
    <PhoneFrame me={me} portrait={heroImg(me, portrait)} art={art} code={code} screenKey={state.phase} onPointerDown={() => sfx.unlock()}>
      {body}
    </PhoneFrame>
  );
}
