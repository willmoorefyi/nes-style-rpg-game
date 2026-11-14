import { Container, type BitmapText } from 'pixi.js';
import type { InputManager } from '../../core/InputManager.js';
import type { GameEvents } from '../../core/EventBus.js';
import type { ActionResult, BattleStateMachine, DamageEvent, NextActionInfo } from '../../battle/BattleStateMachine.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';
import type { Window } from '../../ui/Window.js';
import { TurnList } from './TurnList.js';
import { advanceAt, advanceFrames, returnAt, RETURN_FRAMES, parseAttackOverride, pickAttackStyle, castAt, castReturnAt, CAST_FRAMES, type AttackFrame,
  type AttackStyle, type AttackReach, attackReach, attackRise, MIN_ATTACK_REACH } from './attackChoreography.js';
import { slashEffect } from './slashEffect.js';
import { floatKind, floatLabel } from './floatingNumbers.js';
import { BattleEffects } from './BattleEffects.js';
export { ELEMENT_COLORS } from './BattleEffects.js';
/** Frames the last result line stays up after a round before the next command menu (or the end screen). */
export const ROUND_END_FRAMES = 20;
/** Frames each action's announcement and each result line stay up; confirm skips either. */
export const ANNOUNCE_FRAMES = 30;
export const RESULT_FRAMES = 25;
export class BattleAnimationController {
  animPhase: 'announce' | 'step_forward' | 'enemy_lunge' | 'execute' | 'result' | 'step_back' | 'round_end' = 'announce';
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
  private announcement = '';
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
    this.effects = new BattleEffects(mainContainer, () => display.enemySprites);
    this.turnList = new TurnList(turnListContainer, commandWindow);
  }
  /** The actor's sprite by battle id (party_i / enemy_i), so equal names never share a sprite. */
  findActorSprite(actorId: string): { sprite: Container; isEnemy: boolean } | null {
    const [side, index] = actorId.split('_');
    const i = Number(index);
    if (!Number.isInteger(i)) return null;
    const sprite = side === 'party' ? this.display.partySprites[i] : side === 'enemy' ? this.display.enemySprites[i] : undefined;
    return sprite ? { sprite, isEnemy: side === 'enemy' } : null;
  }
  formatAnnouncement(info: Omit<NextActionInfo, 'actorId'>): string {
    switch (info.actionType) {
      case 'fight': return `${info.actorName} attacks ${info.targetName ?? 'enemy'}!`;
      case 'magic': return `${info.actorName} ${info.silenced ? 'tries to cast' : 'casts'} ${info.spellName ?? 'spell'}!`;
      case 'item': return `${info.actorName} uses ${info.itemName ?? 'an item'}!`;
      case 'run': return `${info.actorName} tries to run!`;
      default: return `${info.actorName} acts!`;
    }
  }
  updateAnimating(dt: number): void {
    const confirmSkip = this.input.isJustPressed('confirm');
    switch (this.animPhase) {
      case 'announce': {
        if (this.animTimer === 0) {
          const info = this.battle.peekNextAction();
          if (!info) { this.onResolveRound(); return; }
          if (!this.battle.isNextActorAlive()) { this.battle.executeNextAction(); return; }
          this.currentActionInfo = info;
          this.announcement = this.formatAnnouncement(info);
          this.setMessageText(this.announcement);
          this.turnList.add(info);
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
              ({ dx: this.attackReachPx, dy: this.attackRisePx } = this.measureReach(this.animActorSprite, this.targetSprite));
            }
            // spells and items gather in place first; every party action then poses frame by frame in step_forward
            if (!found!.isEnemy && info.actionType !== 'fight') this.display.setActorPose(this.animActorSprite, 'cast_gather');
          }
        }
        this.animTimer += dt;
        if (this.animTimer >= ANNOUNCE_FRAMES || confirmSkip) {
          this.animTimer = 0;
          // N2: Enemies skip step_forward; with preview pose art they lunge in their attack pose instead
          this.animPhase = this.animActorIsEnemy ? (this.startEnemyLunge() ? 'enemy_lunge' : 'execute') : 'step_forward';
        }
        break;
      }
      case 'step_forward': {
        const melee = this.currentActionInfo?.actionType === 'fight';
        const frames = melee ? advanceFrames(this.attackStyle) : CAST_FRAMES;
        this.animTimer += dt;
        if (confirmSkip) this.animTimer = frames;
        this.placeActor(melee ? advanceAt(this.attackStyle, this.animTimer, { dx: this.attackReachPx, dy: this.attackRisePx }) : castAt(this.animTimer));
        // BA-9: the action resolves on the contact frame itself, so the number and the result line meet the blow
        if (this.animTimer >= frames) this.executeAction();
        break;
      }
      case 'enemy_lunge': {
        // wait until the lunge reaches the party side, then resolve the action (the return plays on its own)
        if (this.display.enemyView?.poses.attackOutDone(this.animEnemyIndex) ?? true) this.executeAction();
        break;
      }
      case 'execute': {
        this.executeAction();
        break;
      }
      case 'result': {
        // Auto-advance through result messages on timer (no confirm-wait)
        const hasMsg = this.animMessageIndex < this.animMessages.length;
        if (!hasMsg) {
          if (this.animActorIsEnemy) { if (!this.enemyStillAttacking()) this.completeAction(); } else { this.animPhase = 'step_back'; this.animTimer = 0; }
          break;
        }
        if (this.animTimer === 0) this.setMessageText(this.animMessages[this.animMessageIndex].text);
        this.animTimer += dt;
        if (this.animTimer >= RESULT_FRAMES || confirmSkip) {
          this.animMessageIndex++; this.animTimer = 0;
          if (this.animMessageIndex >= this.animMessages.length) {
            if (this.animActorIsEnemy) { if (!this.enemyStillAttacking()) this.completeAction(); } else { this.animPhase = 'step_back'; }
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
      case 'round_end': {
        // The last result line stays up for a moment, then the round resolves by itself (confirm skips the wait).
        // Fades and lunges always finish first, so the next menu never opens over a dying or attacking enemy.
        this.animTimer += dt;
        if (confirmSkip) this.animTimer = Math.max(this.animTimer, ROUND_END_FRAMES);
        if (this.animTimer >= ROUND_END_FRAMES && this.dyingEnemies.size === 0 && !this.anyEnemyAttacking()) {
          this.animTimer = 0;
          this.onResolveRound();
        }
        break;
      }
    }
  }
  /** Resolve the action: numbers, slash, panels, and the first result line, all on this frame. */
  private executeAction(): void {
    const result = this.battle.executeNextAction();
    const info = this.currentActionInfo;
    this.spawnFloatingTextsFromEvents(result.damageEvents);
    if (result.missed && this.targetSprite) this.effects.addFloating('Miss', 'miss', this.targetSprite);
    if (!this.animActorIsEnemy && info?.actionType === 'fight') this.slashTargets(result.damageEvents);
    if (info) this.emitSounds(info, result);
    this.display.updatePartyDisplay();
    this.display.updateEnemySprites(this.dyingEnemies);
    this.display.updatePartySprites();
    // B3: the announcement already said "X casts FIRE!"; the same line is not shown twice
    this.animMessages = result.messages.filter(m => m.text !== this.announcement);
    this.animMessageIndex = 0; this.animTimer = 0;
    if (this.animMessages.length > 0) this.setMessageText(this.animMessages[0].text);
    if (info) this.turnList.complete(info, result.messages);
    this.animPhase = 'result';
  }

  /** I3: a damaging Fight sounds a hit, a miss a miss, and a spell that really went off its cast (not when picked). */
  private emitSounds(info: NextActionInfo, result: ActionResult): void {
    if (result.missed) this.emit('battleMiss', {});
    else if (info.actionType === 'fight' && result.damageEvents.some(e => !e.isHeal && e.damage > 0)) this.emit('battleHit', {});
    if (info.actionType === 'magic' && result.messages.some(m => m.text.startsWith(`${info.actorName} casts `))) this.emit('spellCast', {});
  }

  /** BA-9 / B11: reach to the target sprite's right edge (its 2x cell, whose art sits 16-34 px inside); the minimum when
   *  there is no target. U3: and from the attacker's feet row (its box's bottom) to the target's. */
  private measureReach(actor: Container, target: Container | null): AttackReach {
    if (!target) return { dx: MIN_ATTACK_REACH, dy: 0 };
    const b = target.getBounds();
    const a = actor.getBounds();
    return { dx: attackReach(actor.x, b.x + b.width), dy: attackRise(a.y + a.height, b.y + b.height) };
  }

  /** Moves the acting party member to an offset from its place in line and shows the frame's pose. */
  private placeActor(f: AttackFrame, remember = true): void {
    if (!this.animActorSprite) return;
    this.animActorSprite.position.set(this.animActorOrigX + f.dx, this.animActorOrigY + f.dy);
    this.display.setActorPose(this.animActorSprite, f.pose);
    if (remember) this.lastAdvance = f;
  }
  /** A quick white slash across each enemy the melee attack hit. */
  private slashTargets(events: DamageEvent[]): void {
    for (const evt of events) {
      if (!evt.targetId.startsWith('enemy_') || evt.isHeal) continue;
      const sprite = this.display.enemySprites[parseInt(evt.targetId.split('_')[1], 10)];
      if (!sprite) continue;
      this.effects.addFlash(slashEffect(sprite), 12);
    }
  }
  /** Preview pose art: fight lunges in the attack pose, magic plays the cast stance. False when there is nothing to play. */
  private startEnemyLunge(): boolean {
    const view = this.display.enemyView;
    const type = this.currentActionInfo?.actionType;
    this.animEnemyIndex = this.animActorSprite ? this.display.enemySprites.indexOf(this.animActorSprite) : -1;
    if (!view || this.animEnemyIndex < 0 || (type !== 'fight' && type !== 'magic')) return false;
    if (type === 'magic') view.poses.playCast(this.animEnemyIndex); else view.poses.playAttack(this.animEnemyIndex);
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
    this.turnList.advance();
    if (this.animActorSprite) this.display.setActorPose(this.animActorSprite, null);
    this.animTimer = 0; this.animActorSprite = null; this.animEnemyIndex = -1;
    const battleOver = this.battle.isOver || this.battle.livingEnemies.length === 0 || this.battle.livingParty.length === 0;
    if (battleOver) { this.battle.skipRemainingActions(); this.animPhase = 'round_end'; }
    else { this.animPhase = this.battle.actionQueueLength > 0 ? 'announce' : 'round_end'; }
  }
  spawnFloatingTextsFromEvents(damageEvents: DamageEvent[]): void {
    for (const evt of damageEvents) {
      const idx = parseInt(evt.targetId.split('_')[1], 10);
      const sprite: Container | undefined = evt.targetId.startsWith('enemy_') ? this.display.enemySprites[idx] : this.display.partySprites[idx];
      if (!sprite) continue;
      if (evt.spellElement) this.effects.elementFlash(sprite, evt.spellElement);
      if (!evt.isHeal && evt.damage > 0 && !evt.targetId.startsWith('enemy_')) this.display.flashHurt(idx);
      if (!evt.isHeal && evt.damage > 0 && evt.targetId.startsWith('enemy_')) this.reactEnemy(idx);
      this.effects.addFloating(floatLabel(evt), floatKind(evt), sprite);
    }
  }

  /** Preview pose art: a hit shows the hurt pose; a lethal hit holds it while the sprite fades out. */
  private reactEnemy(idx: number): void {
    const view = this.display.enemyView;
    if (!view) return;
    if ((this.battle.allEnemies[idx]?.currentHp ?? 0) <= 0) view.poses.freezeDying(idx); else view.poses.playHurt(idx);
  }
  updateFloatingTexts(dt: number): void { this.effects.updateFloatingTexts(dt); }
  updateDyingEnemies(dt: number): void { this.effects.updateDyingEnemies(dt); }
  updateSpellFlashes(dt: number): void { this.effects.updateSpellFlashes(dt); }
}
