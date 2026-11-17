import { Container, type BitmapText } from 'pixi.js';
import type { InputManager } from '../../core/InputManager.js';
import type { GameEvents } from '../../core/EventBus.js';
import type { ActionResult, BattleStateMachine, DamageEvent, NextActionInfo } from '../../battle/BattleStateMachine.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';
import type { Window } from '../../ui/Window.js';
import { TurnList } from './TurnList.js';
import { advanceAt, advanceFrames, returnAt, RETURN_FRAMES, parseAttackOverride, pickAttackStyle, castAt, castReturnAt, CAST_FRAMES, type AttackFrame,
  type AttackStyle, MIN_ATTACK_REACH } from './attackChoreography.js';
import { emitActionSounds, measureReach } from './actionHelpers.js';
import { ActionNumbers } from './actionNumbers.js';
import { BattleEffects } from './BattleEffects.js';
import { ACTION_BEAT_FRAMES, ANNOUNCE_FRAMES, RESULT_FRAMES, ROUND_END_FRAMES, ConfirmSkip, holdFrames } from './battleTiming.js';
import { formatAnnouncement } from './battleMessageUtils.js';
import { noopActionFx, noopStatusFx, type ActionFx, type StatusFx } from './fx/index.js';
import { actionTargetIds, diffStatuses, pendingHolds, statusSets, type StatusDiff } from './presentedState.js';
import { afraidSkip, isAfraid } from './fearAnnounce.js';
import type { SpellData } from '../../types/index.js';
import { noopFormChange, type FormChangeHook } from './formChangeView.js';
export { ELEMENT_COLORS } from './BattleEffects.js';
export { ANNOUNCE_FRAMES, RESULT_FRAMES, ROUND_END_FRAMES } from './battleTiming.js';
export { formatAnnouncement } from './battleMessageUtils.js';
/** Runs each action: announce, step forward / lunge, resolve, the effect until its impact, present, results, return,
 *  then a still beat before the next announcement. The holds live in battleTiming.ts (re-exported above for older
 *  callers) and scale with the message speed; confirm skips any of them, one hold per press. */
export class BattleAnimationController {
  animPhase: 'announce' | 'step_forward' | 'enemy_lunge' | 'execute' | 'effect' | 'result' | 'step_back' | 'beat' | 'round_end' | 'interlude' = 'announce';
  animTimer = 0;
  animActorSprite: Container | null = null;
  animActorOrigX = 0;
  animActorOrigY = 0;
  /** Melee choreography for the current party attack: drawn at random per attack unless `?attack=` forces one. */
  attackStyle: AttackStyle = 'lunge';
  attackOverride: AttackStyle | null = typeof location === 'undefined' ? null : parseAttackOverride(location.search);
  /** Random source for the attack style (tests inject a fixed one). */
  attackRng: () => number = Math.random;
  private lastAdvance: AttackFrame = { dx: 0, dy: 0, pose: 'ready' };
  /** BA-9: how far this melee attack advances: from the attacker's place in line to the target's right edge. */
  attackReachPx = MIN_ATTACK_REACH;
  /** U3: how far down (or up, < 0) it moves to meet the target's feet row. */
  attackRisePx = 0;
  /** The sprite the current action aims at (for the miss number), or null. */
  private targetSprite: Container | null = null;
  animMessages: { text: string }[] = [];
  animMessageIndex = 0;
  // N2: Track if current animation actor is an enemy (skip step_forward/step_back)
  animActorIsEnemy = false;
  /** Floating numbers, flashes and the dying fade. */
  readonly effects: BattleEffects;
  get dyingEnemies(): Map<number, number> { return this.effects.dyingEnemies; }
  /** Index of the acting enemy (preview pose art), or -1. */
  private animEnemyIndex = -1;
  /** K4 / B12: the round's actions in the command window during execution. */
  readonly turnList: TurnList;
  get turnListTexts(): BitmapText[] { return this.turnList.texts; }
  private currentActionInfo: NextActionInfo | null = null;
  private announcement = ''; private lostTurn = false;
  /** Spell / item effects and status overlays (BattleScene sets them from the fx factories; no-ops by default). */
  fx: ActionFx = noopActionFx; statusFx: StatusFx = noopStatusFx; formView: FormChangeHook = noopFormChange;
  /** The battle's spells (the target set of an all-target spell). */
  spells: readonly SpellData[] = [];
  /** The target set captured at announce time, the effect's impact frame, and the resolved action. */
  private targetIds: string[] = []; private impactAt = 0;
  private resolved: { result: ActionResult; diff: StatusDiff } | null = null;
  /** Re-test C: a feared party member's action, run at announce time so a fear skip is never announced. */
  private early: { result: ActionResult; diff: StatusDiff } | null = null;
  private readonly numbers: ActionNumbers;
  /** One skip per press (shared with the scene's own text holds). */
  skipGuard = new ConfirmSkip();
  constructor(
    mainContainer: Container,
    private readonly battle: BattleStateMachine,
    private readonly display: BattleDisplayManager,
    private readonly input: InputManager,
    commandWindow: Window,
    turnListContainer: Container,
    private readonly setMessageText: (text: string) => void,
    private readonly onResolveRound: () => void,
    /** I3: battle sound events (battleHit, battleMiss, spellCast), raised on the contact frame. */
    private readonly emit: (event: 'battleHit' | 'battleMiss' | 'spellCast', data: GameEvents['battleHit']) => void = () => {},
  ) {
    // `mainContainer` is the layer root (a plain Container gets the layers built inside it); attack cues start effects
    this.effects = new BattleEffects(mainContainer, () => display.enemySprites);
    this.turnList = new TurnList(turnListContainer, commandWindow);
    this.numbers = new ActionNumbers(battle, display, this.effects);
    if (display.enemyView) display.enemyView.onCue = (_i, cue, sprite, at) => this.fx.playCue(cue === 'hold' ? 'glint' : 'impact_dust', sprite, at);
  }
  /** The actor's sprite by battle id (party_i / enemy_i), so equal names never share a sprite. */
  findActorSprite(actorId: string): { sprite: Container; isEnemy: boolean } | null {
    const [side, index] = actorId.split('_');
    const i = Number(index);
    if (!Number.isInteger(i)) return null;
    const sprite = side === 'party' ? this.display.partySprites[i] : side === 'enemy' ? this.display.enemySprites[i] : undefined;
    return sprite ? { sprite, isEnemy: side === 'enemy' } : null;
  }
  updateAnimating(dt: number): void {
    // re-test E: a frozen frame (the dev step clock's dt 0) is no frame: `animTimer === 0` would start the phase again
    if (dt <= 0) return;
    const confirmSkip = this.skipGuard.take(this.input.isJustPressed('confirm'), dt);
    switch (this.animPhase) {
      case 'announce': {
        if (this.animTimer === 0) {
          const info = this.battle.peekNextAction();
          if (!info) { this.onResolveRound(); return; }
          if (!this.battle.isNextActorAlive()) { this.battle.executeNextAction(); return; }
          this.currentActionInfo = info;
          // play-test item 3: a turn certain to be lost (asleep, stunned, stone) is not announced; its tick line shows
          this.lostTurn = this.battle.nextActorLosesTurn();
          this.targetIds = actionTargetIds(info, this.battle, this.spells.find((s) => s.id === info.spellId)?.targeting);
          // re-test C: fear is rolled at execute time (O1); a party member's action runs now, so a skip shows only its line
          this.early = !this.lostTurn && isAfraid(info, this.battle) ? this.execute() : null;
          if (this.early && afraidSkip(this.early.result, info)) this.lostTurn = true;
          this.announcement = this.lostTurn ? '' : formatAnnouncement(info);
          if (!this.lostTurn) this.setMessageText(this.announcement);
          this.turnList.add(this.lostTurn ? { ...info, actionType: 'skip' } : info);
          const found = this.findActorSprite(info.actorId);
          this.animActorSprite = found?.sprite ?? null;
          this.animActorIsEnemy = found?.isEnemy ?? false;
          // B2/B6/B11: the target sprite by its battle id (the state machine has already resolved a retarget)
          this.targetSprite = info.targetId ? this.findActorSprite(info.targetId)?.sprite ?? null : null;
          if (this.animActorSprite) {
            this.animActorOrigX = this.animActorSprite.x;
            this.animActorOrigY = this.animActorSprite.y;
            this.lastAdvance = { dx: 0, dy: 0, pose: 'ready' };
            if (info.actionType === 'fight') {
              this.attackStyle = this.attackOverride ?? pickAttackStyle(this.attackRng);
              ({ dx: this.attackReachPx, dy: this.attackRisePx } = measureReach(this.animActorSprite, this.targetSprite));
            }
            // spells and items gather in place first; every party action then poses frame by frame in step_forward
            if (!found!.isEnemy && info.actionType !== 'fight' && !this.lostTurn) this.display.setActorPose(this.animActorSprite, 'cast_gather');
          }
        }
        this.animTimer += dt;
        if (this.lostTurn || this.animTimer >= holdFrames(ANNOUNCE_FRAMES) || confirmSkip) {
          this.animTimer = 0;
          // N2: Enemies skip step_forward; with preview pose art they lunge in their attack pose instead.
          // E1: an actor that is certain to lose its turn (sleep, stun, stone) never winds up or steps.
          const lunge = this.animActorIsEnemy && !this.lostTurn && this.startEnemyLunge();
          this.animPhase = this.lostTurn || this.animActorIsEnemy ? (lunge ? 'enemy_lunge' : 'execute') : 'step_forward';
        }
        break;
      }
      case 'step_forward': {
        const melee = this.currentActionInfo?.actionType === 'fight';
        const frames = melee ? advanceFrames(this.attackStyle) : CAST_FRAMES;
        this.animTimer += dt;
        if (confirmSkip) this.animTimer = frames;
        const rise = { rise: this.display.isRising(this.animActorSprite) };   // D-K3: an acting kneeler rises first
        this.placeActor(melee ? advanceAt(this.attackStyle, this.animTimer, { dx: this.attackReachPx, dy: this.attackRisePx }, rise) : castAt(this.animTimer, rise));
        // BA-9: the action resolves on the contact frame itself, so the number and the result line meet the blow
        if (this.animTimer >= frames) this.resolveAction();
        break;
      }
      case 'enemy_lunge': {
        // wait until the lunge reaches the party side, then resolve the action (the return plays on its own)
        if (this.display.enemyView?.poses.attackOutDone(this.animEnemyIndex) ?? true) this.resolveAction();
        break;
      }
      case 'execute': {
        this.resolveAction();
        break;
      }
      case 'effect': { // the action is presented at the effect's impact frame (animations are never skipped)
        this.animTimer += dt;
        if (this.animTimer >= this.impactAt) this.presentAction();
        break;
      }
      case 'result': {
        // Auto-advance through result messages on timer (no confirm-wait)
        const hasMsg = this.animMessageIndex < this.animMessages.length;
        if (!hasMsg) {
          if (this.animActorIsEnemy || this.lostTurn) { if (!this.enemyStillAttacking()) this.completeAction(); } else { this.animPhase = 'step_back'; this.animTimer = 0; }
          break;
        }
        if (this.animTimer === 0) this.showLine(this.animMessageIndex);
        this.animTimer += dt;
        if (this.animTimer >= holdFrames(RESULT_FRAMES) || confirmSkip) {
          this.animMessageIndex++; this.animTimer = 0;
          if (this.animMessageIndex >= this.animMessages.length) {
            if (this.animActorIsEnemy || this.lostTurn) { if (!this.enemyStillAttacking()) this.completeAction(); } else { this.animPhase = 'step_back'; }
          }
        }
        break;
      }
      case 'step_back': {
        this.animTimer += dt;
        if (confirmSkip) this.animTimer = RETURN_FRAMES;
        this.placeActor(this.currentActionInfo?.actionType === 'fight' || !this.currentActionInfo
          ? returnAt(this.lastAdvance, this.animTimer, this.attackStyle)
          : castReturnAt(this.lastAdvance, this.animTimer), false);
        if (this.animTimer >= RETURN_FRAMES) {
          if (this.animActorSprite) this.animActorSprite.position.set(this.animActorOrigX, this.animActorOrigY);
          this.completeAction();
        }
        break;
      }
      case 'beat': { // nothing moves: the result and the HP change register before the next announcement
        this.animTimer += dt;
        if (this.animTimer >= holdFrames(ACTION_BEAT_FRAMES) || confirmSkip) { this.animTimer = 0; this.animPhase = 'announce'; }
        break;
      }
      case 'interlude': if (this.formView.update(dt, confirmSkip)) this.completeAction(); break;   // pass C: a form change
      case 'round_end': {
        // The last result line stays up for a moment, then the round resolves by itself (confirm skips the wait).
        // Fades and lunges always finish first, so the next menu never opens over a dying or attacking enemy.
        this.animTimer += dt;
        const hold = holdFrames(ROUND_END_FRAMES);
        if (confirmSkip) this.animTimer = Math.max(this.animTimer, hold);
        if (this.animTimer >= hold && this.dyingEnemies.size === 0 && !this.anyEnemyAttacking()) {
          this.animTimer = 0;
          this.onResolveRound();
        }
        break;
      }
    }
  }
  /** Run the action in the state machine and start its effect (the status diff snapshots every combatant around it);
   *  it is presented now, or at the effect's impact frame. */
  private resolveAction(): void {
    this.resolved = this.early ?? this.execute();
    this.early = null;
    const { result, diff } = this.resolved;
    const info = this.currentActionInfo;
    const targets = this.targetIds.flatMap((id) => this.findActorSprite(id)?.sprite ?? []);
    this.impactAt = info ? this.fx.play(info, result, { targetIds: this.targetIds, targets, actor: this.animActorSprite, diff }) : 0;
    this.animTimer = 0;
    if (this.impactAt > 0) this.animPhase = 'effect'; else this.presentAction();
  }
  private execute(): { result: ActionResult; diff: StatusDiff } {
    const before = statusSets(this.battle);
    const result = this.battle.executeNextAction();
    return { result, diff: diffStatuses(before, statusSets(this.battle)) };
  }
  /** Present the resolved action: numbers, slash, panels, statuses, the presented state and the first result line. */
  private presentAction(): void {
    if (!this.resolved) return;
    const { result, diff } = this.resolved;
    const info = this.currentActionInfo;
    this.spawnFloatingTextsFromEvents(result.damageEvents); this.formView.queue(result);
    if (result.missed && this.targetSprite) this.numbers.addFloat('Miss', 'miss', this.targetSprite);
    if (!this.animActorIsEnemy && info?.actionType === 'fight') this.numbers.slashTargets(result.damageEvents);
    if (info) emitActionSounds(info, result, this.emit);
    // B3: the announcement already said "X casts FIRE!"; the same line is not shown twice
    this.animMessages = result.messages.filter(m => m.text !== this.announcement);
    // re-test A, D: a wake or the end-of-turn poison is presented with its own line, not at the impact
    this.display.holds = pendingHolds(result.holds ?? [], this.animMessages, 0);
    // these capture the presented state (hp, statuses), then statusFx attaches the overlays for this action
    this.presentState();
    this.statusFx.sync(diff);
    this.animMessageIndex = 0; this.animTimer = 0;
    if (this.animMessages.length > 0) this.setMessageText(this.animMessages[0].text);
    if (info) this.turnList.complete(this.lostTurn ? { ...info, actionType: 'skip' } : info, result.messages);
    this.animPhase = 'result'; this.resolved = null;
  }
  /** Result line i on screen; a hold waiting for it is released (its HP and statuses are presented now). */
  private showLine(i: number): void {
    this.setMessageText(this.animMessages[i].text);
    const pending = pendingHolds(this.display.holds, this.animMessages, i);
    if (pending.length !== this.display.holds.length) { this.display.holds = pending; this.presentState(); }
  }
  private presentState(): void {
    this.display.updatePartyDisplay();
    this.display.updateEnemySprites(this.dyingEnemies);
    this.display.updatePartySprites();
  }
  /** Moves the acting party member to an offset from its place in line and shows the frame's pose. */
  private placeActor(f: AttackFrame, remember = true): void {
    if (!this.animActorSprite) return;
    this.animActorSprite.position.set(this.animActorOrigX + f.dx, this.animActorOrigY + f.dy);
    this.display.setActorPose(this.animActorSprite, f.pose);
    if (remember) this.lastAdvance = f;
  }
  /** Preview pose art: fight lunges in the attack pose, magic plays the cast stance. False when there is nothing to play. */
  private startEnemyLunge(): boolean {
    const view = this.display.enemyView;
    const type = this.currentActionInfo?.actionType;
    this.animEnemyIndex = this.animActorSprite ? this.display.enemySprites.indexOf(this.animActorSprite) : -1;
    if (!view || this.animEnemyIndex < 0 || (type !== 'fight' && type !== 'magic' && type !== 'slam')) return false;
    if (type === 'magic') view.poses.playCast(this.animEnemyIndex); else view.playAttack(this.animEnemyIndex, this.targetSprite);
    return true;
  }
  private anyEnemyAttacking(): boolean {
    const poses = this.display.enemyView?.poses;
    return !!poses && this.display.enemySprites.some((_, i) => poses.isAttacking(i));
  }
  private enemyStillAttacking(): boolean {
    return this.animEnemyIndex >= 0 && (this.display.enemyView?.poses.isAttacking(this.animEnemyIndex) ?? false);
  }
  /** K4: Gray out completed action and advance to next or end-of-round */
  private completeAction(): void {
    if (this.formView.start()) { this.animPhase = 'interlude'; return; }
    if (this.display.holds.length > 0) { this.display.holds = []; this.presentState(); }
    this.turnList.advance();
    if (this.animActorSprite) this.display.setActorPose(this.animActorSprite, null);
    this.animTimer = 0; this.animActorSprite = null; this.animEnemyIndex = -1;
    const battleOver = this.battle.isOver || this.battle.livingEnemies.length === 0 || this.battle.livingParty.length === 0;
    if (battleOver) { this.battle.skipRemainingActions(); this.animPhase = 'round_end'; }
    else { this.animPhase = this.battle.actionQueueLength > 0 ? (holdFrames(ACTION_BEAT_FRAMES) > 0 ? 'beat' : 'announce') : 'round_end'; }
  }
  spawnFloatingTextsFromEvents(damageEvents: DamageEvent[]): void { this.numbers.spawn(damageEvents); }
  updateFloatingTexts(dt: number): void { this.effects.updateFloatingTexts(dt); }
  updateDyingEnemies(dt: number): void { this.effects.updateDyingEnemies(dt); }
  updateSpellFlashes(dt: number): void { this.effects.updateSpellFlashes(dt); }
}
