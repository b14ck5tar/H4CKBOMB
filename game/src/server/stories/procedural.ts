import "server-only";
import type { Rating } from "@/lib/types";
import { museJSON, MODELS, type Effort } from "@/server/muse";
import { DM_CORE, withRating } from "@/server/prompts";
import { badExamplesPrompt, callbackExamplesPrompt, outcomeExamplesPrompt } from "@/server/story-examples";
import {
  actClock,
  applyTurn,
  progressRange,
  checkTurn,
  clampOutcome,
  fallbackProposal,
  fixPronouns,
  sentences,
  trimPile,
  usesPlan,
  type Grade,
  type StoryState,
  type TurnProposal,
  type TurnResult,
} from "@/lib/procedural";

/**
 * The procedural story engine, server side (design/35-procedural-story-rules.md). One "turn" call per turn: the
 * model writes what the chosen plan did and the next obstacle; lib/procedural.ts checks it, retries once with the
 * problems if there is time, and applies it to the StoryState (progress by grade is decided in code).
 */

const TURN_MODEL = process.env.TURN_MODEL || MODELS.writing;
// "minimal": tonight Spark "low" took 7-8 s and often over 10 s on this ~6k-token prompt.
const TURN_EFFORT = (process.env.TURN_EFFORT || "minimal") as Effort;
// design/35: the call starts at the ruling (hidden behind the throw), so it gets up to ~15 s including one retry.
// Measured (Sun ~5 AM): p50 5.3 s, p90 15.8 s client side; the tail was the retry. One call gets up to 15 s, and a
// retry only runs when the first answer came back fast enough to fit both inside 15 s.
const TURN_BUDGET_MS = Number(process.env.TURN_BUDGET_MS) || 15_000;
const TURN_TOTAL_MS = 15_000;

const TURN_BASE = `${DM_CORE}

TASK: THE TURN. Players steer, you react. It was one hero's turn: they chose a plan, and the game rolled how well it went. THE CHOSEN PLAN IS WHAT HAPPENS. Show its consequence clearly and hand the spotlight to the next friend. There is no script.

LOGIC CHAIN (above every other rule): take the player's action literally. Assume it really happens the way they wrote it. Then ask "what would realistically follow, in this place, with these people and this problem?" and build only from that. The grade only sets how well it goes. Every line follows a logical line of reasoning from what the player wrote.

Input: state (where, problem, stakes, finish_line = what solved looks like, progress 0-100, cast = the side characters (the only named people besides the heroes), facts = what is true in this story, open_thread, last_moments = the last outcomes, memorable, pronouns = each hero's pronouns, right_now = the obstacle they faced, act = 1-3 (each act is a different situation), hook = the opener's fantasy twist, real_event = HIDDEN: the real kind of place, the real people by role and the real order of events; never say real names), hero (name, power, pronouns), plan (the player's words, inside <player_input>, for meaning), attempt (what they tried, in plain words), idea_from (the friend whose idea it was, or ""), grade (how well it went), tier (how far-fetched the plan was: clever, solid, risky = bold, wild = long shot, miracle), progress_range ([min, max] progress this grade guarantees), next_player (whose turn is next, or "" before the finale), turns_left, finale_next (true when the next thing is the grand finale).

RULES (every one, every time):
1. THE PLAN HAPPENS. Say the action the hero chose in plain words (paraphrase, never paste). If idea_from is set and it worked, credit that friend by name in a few words ("Rosa's idea", "just like Rosa said", "on Rosa's advice"); never "with Rosa's help". On a miss never name the friend: the miss belongs to the hero.
2. THE GRADE SETS HOW WELL:
   - LEGENDARY / GREAT: it works better than planned, and the story jumps forward. LEGENDARY: someone reacts in a specific, human way.
   - PROGRESS: it works, with a small cost or twist ("yes, but").
   - PARTIAL: half works, and something new gets in the way.
   - SETBACK / DISASTER: it backfires BECAUSE OF THE PLAN ITSELF, funnily, and things get harder. DISASTER is the most spectacular version, a picture the table will retell. It never repeats or undoes the past.
   - If the plan opens a new path (challenge it to chess, hire it, throw it a party), follow that path. Never snap back to an old plan of yours.
3. MOMENTUM: something moves every turn, as a logical result of the plan: progress, a new problem, or a new place. Small is fine; "nothing happens" is not. Never cancel a success with a new barrier, and never invent a random change that the plan did not cause.
4. PROGRESS: progress_range is the guaranteed range for this grade. Pick progress_gain inside it by logic: the top when the plan hit the heart of the problem, the bottom when it barely touched it. Say why in progress_why (one plain line).
PAYOFF, BUT SIMPLE (hard rule, the creative director's top rule: simple, playable and followable beats complex and confusing). The plan happens the way the player meant it, then ONE clear consequence: one plain cause, then its effect, that a tired 8-year-old gets on first hearing. No wordplay, no double meanings, no inside jokes, no clever phrasing. The funny comes from the situation, not the words.
  Bad: "The bison mom eats a rook and lets the calf go as a sore winner." (a pun on chess, two ideas at once, and you have to know what a rook is)
  Good: "Gus sets up a chessboard in the mud. The bison mom stares at it so long that the little dog trots away."
POWERS HELP, NEVER WIN: a hero's power makes their plan a little easier when it truly applies, and shows doing the work, but it never solves the whole problem by itself and never makes a far-fetched plan work without a big result. Everyone at the table matters the same.
5. PLAYERS CAN DO ANYTHING: whatever a player brings in (a kazoo, a chess set, a cousin) is real now. Only what YOU invent is limited: at most one new thing of your own per turn (new_fact OR new_character, the cast holds 3), and props of your own matter only if a player uses them.
6. CONTINUITY: never contradict facts, where, or pronouns. Use each hero's pronouns exactly; a they/them hero is always "they". If unsure, stay with what is known.
PLAIN WORDS (hard rule): everyday words only. Call every person, animal and thing by its plain everyday name ("the crab", never "the current crab"; "the ice hand", never "the cone juggling ice hand"), even if the input uses an odd name. No stacked modifiers, no odd word pairs ("calf soft", "drops soft"), no similes ("like popcorn"), no sounds or feelings for things ("the wire hums its snore"). One idea per sentence. Every it, he, she or they points to ONE clear person or thing; if two could match, use the name ("Bev calls the dog by her name", not "calls the name").
READ-ALOUD TEST (hard rule): the narrator reads your lines ONCE to a noisy room. Every line must make sense the first time, with no second read. Say it the way a kid tells a friend what happened: who did what, then what happened because of it. Never count or measure things, never name a thing by a part or a material, never pair words that fight each other, never describe a look or a feeling in an odd way. Reuse the story's own odd terms only in their plain form ("the old tapes", not "the tape rail").
  Bad: "Juno blinks wide and holds it." Good: "Juno stares at the turtle without blinking."
  Bad: "The blink fits zero past cases in the tapes." Good: "Nobody on the old tapes ever saw the turtle blink."
  Bad: "The crab shows empty pockets full of sand." Good: "The crab turns out its pockets. Only sand falls out."
  Bad: "Gus slides it down the tape rail." Good: "Gus slides it down the railing."
  Bad: "Juno hears a slow wet blink." Good: "Juno hears a slow beep in the wire." (you hear sounds and see lights: only say what someone could really see, hear or do)
  Bad: "The turtle pauses mid doze and lifts one lid." Good: "The sleepy turtle opens one eye."
  If the story calls something by an odd name (a radio signal called "the blink"), say what it really is: "the signal", "the light".
  Bad right_now: "Calm the cone juggling ice hand". Good: "Calm down the ice hand".
7. CLARITY: outcome is 2 sentences at most, 30 words at most, plain and simple, that an 8-year-old follows the first time: concrete nouns, cause then effect. Even when the player did something odd, say it in plain words. No made-up terms, no oddly phrased lines, no kennings ("pale fliers" is banned: say "owls"). No game words (roll, dice, needs, natural, points, luck).
8. VOICE: dry, witty, unexpected but it makes sense. The humor comes from the situation and the plan, never random props.
9. RIGHT NOW: the next obstacle in plain words a kid gets on first read (a verb, then one plain thing: "Tuck the ice hand into the snow", never "Calm the cone juggling ice hand"), one concrete step, 8 words max, verb first, that follows from what just happened and leads toward finish_line. Never a repeat of right_now or anything already done, never "again". If finale_next is true, it is the final push toward finish_line.
10. SPOTLIGHT: the outcome makes the acting hero look cool or hilariously human, by name (start with their name).
11. HAND-OFF: scene (1 sentence, 24 words max) says where things stand now and addresses next_player by name with the new obstacle ("Juno, the bison is staring at the hay."). If next_player is "", address the whole group.
12. CALLBACKS: at most once before the ending, when it fits, pay off a line from memorable in a new way.
13. Stay inside real_event: its kind of place, its real roles (as cast), its everyday objects, its real stakes. The fantasy problem is the one twist on top.
NEVER RETELL: read last_moments. Never repeat a moment that already happened (a secret told stays told, a thing found stays found); build on it instead.
14. THE PLAN IS THE CAUSE: the outcome uses the player's own key word or idea from plan (their noun, their joke: chess stays chess, a kazoo stays a kazoo). Never wash the idea into something safer or smarter.
15. A SUCCESS CAN FINISH THE STEP: if this plan solved right_now, set step_solved true; it is solved, it stays solved (it becomes a fact), and the next twist arrives BECAUSE of it. Nothing achieved is ever undone, not even by a later miss.
16. THREE ACTS: act 1, act 2, act 3, then the finale, each a different situation. When act_changes_next is true, the scene opens the next act: a new place or a new turn of the problem, caused by what just happened. Keep hook (the opener's twist) in play: it must show up in act 2 and in the finale push.

WRITE: outcome, scene, right_now, progress_gain, progress_why (12 words max), step_solved, new_fact (12 words max, or ""), new_character (name + role, or both ""), where (8 words max if the heroes moved, else ""), open_thread (12 words max, a loose end, or ""), memorable (10 words max, the funniest detail of this turn, or "").

${outcomeExamplesPrompt({ games: 1 })}

${badExamplesPrompt()}`;

function turnSystem(avoid: string) {
  // The examples block is stable unless an example game overlaps the live story (then it is left out).
  return TURN_BASE.replace(outcomeExamplesPrompt({ games: 1 }), outcomeExamplesPrompt({ games: 1, avoid }));
}

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
export const TURN_SCHEMA = obj({
  outcome: str,
  scene: str,
  right_now: str,
  progress_gain: { type: "integer" },
  progress_why: str,
  new_fact: str,
  new_character: obj({ name: str, role: str }),
  where: str,
  open_thread: str,
  memorable: str,
  step_solved: { type: "boolean" },
});

const GRADES: Grade[] = ["DISASTER", "SETBACK", "PARTIAL", "PROGRESS", "GREAT", "LEGENDARY"];
const clip = (s: unknown, n: number) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type TurnInput = {
  state: StoryState;
  hero: { name: string; power?: string; pronouns?: string };
  plan: string; // already wrapped in <player_input> by the route
  /** The player's plan as typed (for the "plan is the cause" check in code; never sent to the model raw). */
  plan_raw?: string;
  attempt?: string;
  idea_from?: string;
  grade: Grade;
  total?: number;
  depth?: number;
  next_player?: string;
  turns_left?: number;
  /** The ruling's tier (how far-fetched the plan was). */
  tier?: string;
};

export function gradeOf(x: unknown): Grade {
  return GRADES.includes(x as Grade) ? (x as Grade) : "PROGRESS";
}

/** One procedural turn: model call, code checks, one retry if time allows, then code applies it. Never throws. */
export async function runTurn(i: TurnInput, rating: Rating): Promise<TurnResult> {
  const t0 = Date.now();
  const state = i.state;
  const hero = clip(i.hero?.name, 40) || "The hero";
  const grade = gradeOf(i.grade);
  const idea = WONISH(grade) ? clip(i.idea_from, 40) : "";
  const nextPlayer = clip(i.next_player, 40);
  const finaleNext = !nextPlayer || state.progress >= 75;
  const planRaw = String(i.plan_raw ?? i.plan ?? "").replace(/<[^>]*>/g, " ");
  const ctx = { state, hero, idea_from: clip(i.idea_from, 40), grade, next_player: nextPlayer, plan: planRaw, hook_due: state.act >= 2 || finaleNext };
  // Will the act clock move after this turn? (applyTurn also moves it when a success solves the step.)
  const t1 = state.turn + 1;
  const clockNext = actClock(t1, state.turns_total);
  const user = {
    state: { ...state, credits: undefined, goals_done: state.goals_done.slice(-6) },
    hero: { name: hero, power: clip(i.hero?.power, 140), pronouns: clip(i.hero?.pronouns || state.pronouns[hero], 20) },
    plan: i.plan,
    attempt: clip(i.attempt, 160),
    idea_from: idea,
    grade,
    next_player: nextPlayer,
    turns_left: Number(i.turns_left ?? 0),
    finale_next: finaleNext,
    tier: clip(i.tier, 10),
    progress_range: progressRange(grade, state.turns_total),
    act_changes_next: clockNext > state.act && !finaleNext,
  };
  const avoid = [state.problem, state.where, state.real_event?.place_type].join(" ");
  const system = withRating(turnSystem(avoid), rating);
  const call = (extra = "", timeoutMs = TURN_BUDGET_MS) =>
    museJSON<TurnProposal>({ task: `story-turn-${rating}`, model: TURN_MODEL, effort: TURN_EFFORT, system, schema: TURN_SCHEMA, user: JSON.stringify(user) + extra, timeoutMs, maxTokens: 1500 }); // answers run 280-750 tokens

  let p: TurnProposal | null = null;
  let probs: string[] = [];
  let fallback = false;
  try {
    // Two drafts at once (generate ahead, CD): the first one that passes every check wins right away; if the first
    // back has problems, the other gets a short grace. Cheaper on the clock than a sequential retry (that was the
    // whole p90 tail), and the better of two drafts is more often followable on first hearing.
    const best = await draftRace(call, (x) => checkTurn(x, ctx), TURN_PARALLEL);
    if (!best) throw new Error("no draft came back");
    [p, probs] = [best.p, best.probs];
    const left = TURN_TOTAL_MS - (Date.now() - t0);
    // A hard problem (the plan, the hero, a friend, game words) is worth one retry if 6 s are left; soft ones are
    // fixed in code or let go (the better draft already won).
    const hardNow = probs.some((x) => HARD.test(x) || REDO.test(x));
    if (hardNow && left > 6_000) {
      try {
        const again = await call(`\n\nYour last answer had problems. Fix ALL of them and keep what worked.\nLAST ANSWER: ${JSON.stringify(p)}\nPROBLEMS:\n${probs.map((x) => `- ${x}`).join("\n")}`, left);
        const p2 = checkTurn(again, ctx);
        if (p2.length < probs.length) [p, probs] = [again, p2];
      } catch (e) {
        console.warn(`[turn] retry failed: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    console.warn(`[turn] failed, plan-respecting fallback: ${(e as Error).message}`);
  }
  // Hard problems that code cannot fix in place -> the plan-respecting fallback.
  // A they/them slip is repaired in code (cheaper than losing a good line to the fallback).
  if (p && probs.some((x) => x.startsWith("wrong pronoun"))) {
    p.outcome = fixPronouns(p.outcome, state.pronouns);
    p.scene = fixPronouns(p.scene, state.pronouns);
  }
  const hard = probs.filter((x) => HARD.test(x));
  if (!p || hard.length) {
    if (p) console.warn(`[turn] using fallback: ${hard.join(" | ")}`);
    p = fallbackProposal(state, { hero, attempt: i.attempt, idea_from: idea, grade, next_player: nextPlayer });
    fallback = true;
  }
  // Soft problems are fixed in code: clamp the outcome, hand the scene to the next player.
  p.outcome = clampOutcome(p.outcome);
  if (nextPlayer && !new RegExp(`\\b${nextPlayer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(p.scene)) p.scene = p.scene ? `${nextPlayer}, ${p.scene.charAt(0).toLowerCase()}${p.scene.slice(1)}` : `${nextPlayer}, you're up.`;
  p.scene = sentences(p.scene)[0] ?? p.scene;
  p.right_now = trimPile(p.right_now);
  const applied = applyTurn(state, p, { hero, attempt: i.attempt, grade, depth: i.depth });
  console.log(`[turn] ${grade} ${hero} ${Date.now() - t0}ms progress ${state.progress}->${applied.state.progress}${fallback ? " FALLBACK" : ""}${probs.length ? ` problems: ${probs.join(" | ")}` : ""}`);
  return { outcome: p.outcome, scene: p.scene, right_now: applied.state.right_now, progress: applied.state.progress, progress_delta: applied.delta, progress_why: String(p.progress_why ?? "").slice(0, 140), finale: applied.finale, act: applied.state.act, act_changed: applied.act_changed, state: applied.state, problems: probs, fallback };
}

const HARD = /must name the acting hero|game words|never name|outcome is empty|the plan is the cause|banned filler/;
const TURN_PARALLEL = Math.max(1, Math.min(3, Number(process.env.TURN_PARALLEL) || 2));
const GRACE_MS = 2_500;
// A retold moment isn't worth the plan-aware fallback, but it is worth waiting for the other draft or one retry.
const REDO = /repeats an earlier moment/;
const score = (probs: string[]) => probs.filter((x) => HARD.test(x) || REDO.test(x)).length * 10 + probs.length;

/**
 * Run `n` drafts in parallel. Resolves with the first draft that has no problems; otherwise, once a draft with only
 * soft problems is in, waits GRACE_MS for a cleaner one; a draft with hard problems waits for the rest. Null if all fail.
 */
function draftRace(call: () => Promise<TurnProposal>, check: (p: TurnProposal) => string[], n: number): Promise<{ p: TurnProposal; probs: string[] } | null> {
  return new Promise((resolve) => {
    let best: { p: TurnProposal; probs: string[] } | null = null;
    let done = 0;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(best);
    };
    for (let k = 0; k < n; k++)
      call()
        .then((p) => {
          const probs = check(p);
          if (!best || score(probs) < score(best.probs)) best = { p, probs };
          if (!probs.length) return finish();
          if (!probs.some((x) => HARD.test(x) || REDO.test(x))) setTimeout(finish, GRACE_MS);
        })
        .catch((e) => console.warn(`[turn] draft failed: ${(e as Error).message}`))
        .finally(() => ++done === n && finish());
  });
}

function WONISH(g: Grade) {
  return g === "PROGRESS" || g === "GREAT" || g === "LEGENDARY";
}

// ---------------------------------------------------------------- the ending (rule 15)

export const STORY_END_SYSTEM = `${DM_CORE}

TASK: THE ENDING. The table backed one hero's final plan, everyone shook their phones, and one shared die decided how it went. The real news story is revealed right after you.
Input: state (where, problem, finish_line, progress, cast, facts, memorable = the funniest moments, credits = what each hero did on their turns, in order, pronouns, real_event = HIDDEN: the real kind of place, roles and the real order of events, ending with where the real story landed), winner (name, pronouns), attempt (the final plan in plain words), plan (inside <player_input>), grade, won (true = they reached the finish line), players (id + what each player said their secret talent is, inside <player_input>).
- The final plan is what happens, at the grade's strength. The ending lands where the real story landed (the last step of real_event.arc), told through the fantasy problem. Never say real names, places, numbers or dates.
- PLAIN WORDS (hard rule): everyday words only. Call every person, animal and thing by its plain everyday name ("the crab", never "the current crab"; "the ice hand", never "the cone juggling ice hand"), even if the input uses an odd name. No stacked modifiers, no odd word pairs ("calf soft", "drops soft"), no similes ("like popcorn"), no sounds or feelings for things ("the wire hums its snore"). One idea per sentence. Every it, he, she or they points to ONE clear person or thing; if two could match, use the name ("Bev calls the dog by her name", not "calls the name").
- PAYOFF, BUT SIMPLE: one plain cause, then its effect, that a tired 8-year-old gets on first hearing. No wordplay or clever phrasing.
- ending: exactly 2 short sentences, 30 words max, each with ONE idea. Sentence 1: the winner's final plan, in plain words with its own key word, and what it did right away. Sentence 2: how it ended for the problem, plainly (won = solved, else kindly not). Nothing else: no extra callbacks, no extra jokes, no cast lines here. Nobody is defeated.
  Bad: "The bison picks hay over babysitting and the dog squeaks back, and the lodge worker waves them home." (three ideas, and "squeaks back" is unclear)
  Good: "Gus leads a snack parade to the cabin, and the bison mom follows the snacks. The little dog runs inside to her family."
- line: 12 words max, the last card, said flatly ("The snake works at the scrapyard now."). This is where ONE callback from memorable may go, in plain words.
- line: 12 words max, the last card, said flatly ("The snake works at the scrapyard now.").
- recap: 2 sentences, 40 words max, that credits EVERY hero by name with what they actually did (from credits), in order, and ends with how it ended (won = they reached the finish line, else kindly that they didn't). Only things that happened. Use exactly the pronouns given.
- skills: one entry per player: id, and phrase = a clean 1 to 4 word skill in lowercase ("parallel parking"), or "" if what they said is a joke, crude, mean, or not a real skill. Never invent one.
- Only mention things that appear in state (facts, memorable, credits, cast, where): no new objects. No game words (roll, dice, needs, natural, luck).

${callbackExamplesPrompt()}`;

export const STORY_END_SCHEMA = obj({ ending: str, line: str, recap: str, skills: { type: "array", items: obj({ id: str, phrase: str }) } });

export async function runEnding(input: Any, rating: Rating) {
  const s: StoryState = input.state;
  const user = {
    state: { where: s?.where, problem: s?.problem, finish_line: s?.finish_line, progress: s?.progress, cast: s?.cast, facts: s?.facts, memorable: s?.memorable, credits: s?.credits, pronouns: s?.pronouns, real_event: s?.real_event },
    winner: { name: clip(input.winner?.name ?? input.winner_hero?.name ?? input.winner, 40), pronouns: clip(input.winner?.pronouns ?? input.winner_hero?.pronouns, 20) },
    attempt: clip(input.attempt, 160),
    plan: input.plan,
    grade: gradeOf(input.grade),
    won: !!input.won,
    players: Array.isArray(input.players) ? input.players.slice(0, 8) : [],
  };
  const call = (extra = "", timeoutMs = 12_000) => museJSON<Any>({ task: `story-end-${rating}`, model: TURN_MODEL, effort: TURN_EFFORT, system: withRating(STORY_END_SYSTEM, rating), schema: STORY_END_SCHEMA, user: JSON.stringify(user) + extra, timeoutMs, maxTokens: 2500 });
  // The final plan is the cause, and the ending stays 2 plain sentences: one retry with the problems if not.
  const planRaw = String(input.plan_raw ?? input.plan ?? "").replace(/<[^>]*>/g, " ");
  const check = (d: Any) => {
    const e = String(d?.ending ?? "");
    const out: string[] = [];
    if (!usesPlan(e, planRaw)) out.push("the ending must use the final plan's own key word");
    if (sentences(e).length > 2 || e.split(/\s+/).length > 32) out.push("exactly 2 short sentences, 30 words max");
    return out;
  };
  const t0 = Date.now();
  const d = await call();
  // The host waits 15 s in all: retry only a hard miss (the plan, the length) and only inside ~13.5 s.
  const probs = check(d);
  const left = 13_500 - (Date.now() - t0);
  if (!probs.length || left < 4_000) return d;
  try {
    const again = await call(`\n\nYour last answer had problems. Fix them.\nLAST ANSWER: ${JSON.stringify(d)}\nPROBLEMS:\n${probs.map((x) => `- ${x}`).join("\n")}`, left);
    return check(again).length < probs.length ? again : d;
  } catch {
    return d;
  }
}
