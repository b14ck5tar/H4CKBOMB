/* SWAP-IN guide for the builder (Phone.tsx). New phone UI: one component per screen, pure props, no transport.
 * Import as `from "./phone/index"` (with /index: on Windows "./phone" collides with Phone.tsx by case).
 * Preview every screen with fake data at /phone-preview?screen=join|make-hero|skill|lobby|vote|suggest|your-turn|
 * throw|watching|finale|reveal|story   (finale: &step=pitch|vote|arm|armed|count|shake|thrown; reveal: &step=reveal|keepsake).
 *
 *  Old piece in Phone.tsx            -> New
 *  Shell                             -> <PhoneFrame me={me} portrait={portrait} art={artFor(state)} screenKey={state.phase} onPointerDown={() => sfx.unlock()}>
 *  Timer                             -> pass timer={{ deadlineAt, total }} to the screen (it draws the fuse)
 *  JoinForm                          -> <JoinScreen code={code} onJoin={(name) => send("join", { name })} />
 *  CharacterPicker / CreateHero      -> <MakeHeroScreen readyMade={QUICK} takenIds={state.players.filter(p => p.id !== me.id && p.pick).map(p => p.pick!)}
 *                                         onCreate={({ text, skill }) => { sfx.unlock(); send("real", { skill, fear: "" }); send("concept", { text }); }}
 *                                         onPick={(heroId) => { sfx.unlock(); send("pick", { heroId }); }} />
 *  RealForm                          -> <SkillScreen me={me} portrait={heroImg(me, portrait)} onAnswer={(skill) => send("real", { skill, fear: "" })} />
 *  lobby (building / ready)          -> <LobbyScreen me={me} portrait={heroImg(me, me.hasPortrait ? portrait : undefined)} players={state.players} onRedraw={() => send("redraw")} />
 *  StoryVote                         -> <QuestVoteScreen options={state.storyOptions} votes={state.votes} players={state.players} meId={me.id} onVote={(id) => send("vote", { id })} timer={{ deadlineAt, total: 15000 }} />
 *  IdeaForm                          -> <SuggestScreen key={state.turnIndex} owner={owner} ownerPortrait={heroImg(owner)} sent={state.ideas[me.id]} goal={state.goal} nowGoal={state.nowGoal}
 *                                         ladder={state.ladder} step={state.step} max={PLAN_MAX} onIdea={(text) => send("idea", { text })} onTyping={() => send("typing")} timer={{ deadlineAt, total }} />
 *  OwnerTurn                         -> <YourTurnScreen key={state.turnIndex} ideas={state.ideas} players={state.players} goal=… nowGoal=… ladder=… step=… max={PLAN_MAX}
 *                                         onPitch={(text, creditId) => send("pitch", { text, creditId })} onTyping={() => send("typing")} timer=… />
 *  SwipeThrow (roll, mine)           -> <ThrowScreen onThrow={(power, angle) => { sfx.unlock(); send("roll", { power, angle }); vibrate([20, 40, 20]); }}
 *                                         plan={winning pitch text} bonuses={[{ label: "Brains", value: 2 }, …]} timer={{ deadlineAt, total: 10000 }} />
 *  passive() + ReactionBar           -> <WatchingScreen text={nowText(state, me.id)} goal=… nowGoal=… ladder=… step=… reactions={REACTIONS} onReact={(emoji) => send("react", { emoji })} />
 *  PitchForm (finale)                -> <FinalePitchScreen key={state.sceneIndex} sent={state.pitches.find(p => p.playerId === me.id)?.text} goal={state.goal} max={PLAN_MAX} onPitch={(text) => send("pitch", { text })} onTyping=… timer=… />
 *  BackPlan                          -> <BackPlanScreen pitches={state.pitches} players={state.players} meId={me.id} mine={state.votes[me.id]} eligible={eligibleIds(state)} goal={state.goal} onVote={(id) => send("vote", { id })} timer=… />
 *  FinalRollPhone                    -> <ShakeScreen final={state.final} phase={state.phase} meId={me.id} deadlineAt={deadlineAt} onArm={() => send("arm")} onShake={() => send("roll")} onUnlock={() => sfx.unlock()} />
 *  phase "reveal"                    -> <RevealScreen />
 *  Keepsake                          -> <KeepsakeScreen book={state.storybook} me={me} portrait={heroImg(me, portrait)} said={…same as before…} solvedBy={state.solvedBy} />
 *  StoryWriteForm                    -> <StoryWriteScreen sent={state.written.includes(me.id)} onSend={(s) => send("story", s)} timer=… />
 * Sounds stay in Phone.tsx's send wrapper (SEND_SFX); the screens only vibrate. For the safe-area insets to be non-zero
 * on iPhones, add viewportFit: "cover" to the viewport export in app/layout.tsx.
 */
export * from "./kit";
export * from "./cards";
export { JoinScreen } from "./JoinScreen";
export { MakeHeroScreen, type ReadyHero } from "./MakeHeroScreen";
export { SkillScreen } from "./SkillScreen";
export { LobbyScreen } from "./LobbyScreen";
export { QuestVoteScreen, type QuestOption } from "./QuestVoteScreen";
export { SuggestScreen } from "./SuggestScreen";
export { YourTurnScreen } from "./YourTurnScreen";
export { ThrowScreen, type Bonus } from "./ThrowScreen";
export { WatchingScreen } from "./WatchingScreen";
export { FinalePitchScreen, BackPlanScreen, ShakeScreen, TalkScreen } from "./FinaleScreens";
export { RevealScreen, KeepsakeScreen } from "./RevealScreen";
export { StoryWriteScreen } from "./StoryWriteScreen";
