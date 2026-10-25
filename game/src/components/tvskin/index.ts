/* In-game TV skin: the lobby's Jackbox x neon club x D&D look for every story screen. Pure props, no GameHost.
 * Preview every piece at /tv-preview?piece=turn|plan|meter|outcome|montage|reveal, or watch a whole fake game at
 * /tv-preview?piece=autoplay.
 * MOTION: wrap the per-phase content in <PhaseSwap k={s.phase + turnIndex}> inside <TvStage> for the paint-smear wipe
 * (keep HudStrip outside it so the ladder spark plays across phases). <Particles/> adds idle dust/sparks over any
 * backdrop. All pieces animate themselves on mount; key them per turn (TurnCard k=, OutcomeCaption k=) to replay.
 *
 * import { TurnCard, ... } from "@/components/tvskin";   (folder is "tvskin", not "tv": "tv" collides with TV.tsx on Windows/macOS)
 * SWAP-IN (QuickTV.tsx, builder): keep QuickTV's Backdrop + top bar; render ONE <TvStage> over the scene
 * (it is position:absolute inset 0, so QuickTV's stage root must be positioned) and drop the pieces in it:
 *   turn     <TurnCard hero={{name, epithet, color, portrait, stats}} playedBy={p.name} turn={{n, of}} prompt="Everyone else: suggest a move" k={p.id} />
 *            + <SuggestionBubbles items={suggestions.map(...)} pickedId={creditPitchId} />   (replaces Turn/TypingLine)
 *   ruling   <PlanCard hero plan={planText(p)} tier={p.verdict.tier} stat={{label, value}} credit={...} />   (replaces Ruling)
 *   roll     <QualityMeter total={g.total} natural={r.kept} result={g} parts={[{label:"rolled",value:r.kept}, ...]} delay={ROLL_ANIM_MS/1000} />  (g = gradeRoll(total, die) from lib/grade)
 *   always   <HudStrip ladder={{steps: s.ladder.length, at: s.step, now: s.nowGoal, goal: s.goal}} danger={{level, max}} />
 *            (replaces GoalBar/NowBanner; omit danger until the host has a danger value)
 *   outcome  <OutcomeCaption text={line} tag={grade label} tagColor hero={{name,color}} k={s.scenes.length} />
 *   finale   WRITE <FinalePitch heroes plans={s.pitches} typing={s.typing} situation={s.situation} deadlineAt={host.deadlineAt} />
 *            BACK  <FinaleVote heroes plans={pitches as {id, playerId, text: planText(p), eligible}} votes={s.votes} deadlineAt />
 *            ARM/SHAKE <FinaleShake stage={s.final.stage} heroes armed={s.final.armed} shook={s.final.shook} beat planBy plan />
 *            (stage "landed" / final_result: show QualityMeter instead)
 *   ending   <EndingMontage panels={[{image: host.sceneImages[i], line, who}]} reveal={{headline, source, date, summary, now,
 *            articleUrl, yourTitle, yourVersion, solvedBy, ending, author (Our Stories: "Based on <author>'s true story")}} keepsake={<KeepsakeQR host={host} s={s} size={260} />} />
 *            (it is position:fixed full screen; replaces EndingSlot/RevealCard/Keepsake). SceneArt is optional.
 */
export { TvStage, SceneArt, HeroTradingCard, CreditChip, D20Glyph, Face, TIER_LOOK } from "./shared";
export { PayoffPunch } from "./PayoffPunch";
export { Banner } from "./Banner";
export type { PayoffTone } from "./PayoffPunch";
export type { CardHero } from "./shared";
export { Particles, PhaseSwap, InkWipe, Letters, shakeStage, flashScreen, useReducedMotion } from "./motion";
export { TurnCard } from "./TurnCard";
export type { TurnCardProps } from "./TurnCard";
export { SuggestionBubbles } from "./SuggestionBubbles";
export type { Suggestion, SuggestionBubblesProps } from "./SuggestionBubbles";
export { PlanCard } from "./PlanCard";
export type { PlanCardProps } from "./PlanCard";
export { QualityMeter } from "./QualityMeter";
export type { QualityMeterProps } from "./QualityMeter";
export { LadderDots, DangerBar, HudStrip } from "./Hud";
export type { LadderDotsProps, DangerBarProps } from "./Hud";
export { OutcomeCaption } from "./OutcomeCaption";
export type { OutcomeCaptionProps } from "./OutcomeCaption";
export { FinalePitch, FinaleVote, FinaleShake } from "./Finale";
export type { FinaleHero, FinalePlan, FinalePitchProps, FinaleVoteProps, FinaleShakeProps } from "./Finale";
export { EndingMontage } from "./EndingMontage";
export type { MontagePanel, RevealData, EndingMontageProps } from "./EndingMontage";
