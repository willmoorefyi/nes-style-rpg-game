import { Container, BitmapText } from 'pixi.js';
import type { InputManager } from '../../core/InputManager.js';
import type { BattleStateMachine, DamageEvent, NextActionInfo } from '../../battle/BattleStateMachine.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE_SM } from '../../core/LayoutConstants.js';
import type { Window } from '../../ui/Window.js';
import { formatConciseResult, capitalize } from './battleMessageUtils.js';
import { advanceAt, advanceFrames, returnAt, RETURN_FRAMES, parseAttackOverride, pickAttackStyle, castAt, castReturnAt, CAST_FRAMES, type AttackFrame,
  type AttackStyle, attackReach, MIN_ATTACK_REACH } from './attackChoreography.js';
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
  // K4: Turn list in commandWindow during execution
  turnListTexts: BitmapText[] = [];
  turnActionIndex = 0;
  private currentActionInfo: NextActionInfo | null = null;
  constructor(
    mainContainer: Container,
    private readonly battle: BattleStateMachine,
    private readonly display: BattleDisplayManager,
    private readonly input: InputManager,
    private readonly commandWindow: Window,
    private readonly turnListContainer: Container,
    private readonly setMessageText: (text: string) => void,
    private readonly onResolveRound: () => void,
  ) {
    this.effects = new BattleEffects(mainContainer, () => display.enemySprites);
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
      case 'magic': return `${info.actorName} casts ${info.spellName ?? 'spell'}!`;
      case 'item': return `${info.actorName} uses item!`;
      case 'run': return `${info.actorName} tries to run!`;
      default: return `${info.actorName} acts!`;
    }
  }
  /** Scroll turn list container so latest entry is visible within command window. */
  private scrollTurnList(): void {
    const overflow = this.turnListTexts.length - Math.floor(this.commandWindow.contentHeight / (FONT_SIZE_SM + 8));
    if (overflow > 0) this.turnListContainer.y = -overflow * (FONT_SIZE_SM + 8);
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
          this.setMessageText(this.formatAnnouncement(info));
          // K4: Add entry to turn list
          const entry = new BitmapText({
            text: `${info.actorName}: ${info.actionType}`,
            style: { fontFamily: NES_FONT, fontSize: FONT_SIZE_SM, fill: 0xffffff },
          });
          entry.position.set(this.commandWindow.contentX, this.commandWindow.contentY + this.turnListTexts.length * (FONT_SIZE_SM + 8));
          this.turnListContainer.addChild(entry);
          this.turnListTexts.push(entry);
          this.scrollTurnList();
          const found = this.findActorSprite(info.actorId);
          this.animActorSprite = found?.sprite ?? null;
          this.animActorIsEnemy = found?.isEnemy ?? false;
          this.targetSprite = this.findTargetSprite(info);
          if (this.animActorSprite) {
            this.animActorOrigX = this.animActorSprite.x;
            this.animActorOrigY = this.animActorSprite.y;
            this.lastAdvance = { dx: 0, dy: 0, pose: 'ready' };
            if (info.actionType === 'fight') {
              this.attackStyle = this.attackOverride ?? pickAttackStyle(this.attackRng);
              this.attackReachPx = this.measureReach(this.animActorOrigX, this.targetSprite);
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
        this.placeActor(melee ? advanceAt(this.attackStyle, this.animTimer, this.attackReachPx) : castAt(this.animTimer));
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
    const missed = info?.actionType === 'fight' && result.damageEvents.length === 0
      && result.messages.some(m => m.text === `${info.actorName} missed!`);
    if (missed && this.targetSprite) this.effects.addFloating('Miss', 'miss', this.targetSprite);
    if (!this.animActorIsEnemy && info?.actionType === 'fight') this.slashTargets(result.damageEvents);
    this.display.updatePartyDisplay();
    this.display.updateEnemySprites(this.dyingEnemies);
    this.display.updatePartySprites();
    this.animMessages = result.messages;
    this.animMessageIndex = 0; this.animTimer = 0;
    if (result.messages.length > 0) this.setMessageText(result.messages[0].text);
    // Update turn list entry in-place with concise result
    const entry = this.turnListTexts[this.turnActionIndex];
    if (entry && info) {
      const { actorName, actionType, spellName } = info;
      const label = actionType === 'magic' && spellName ? spellName.toUpperCase() : capitalize(actionType);
      const concise = formatConciseResult(result.messages, actorName);
      entry.text = concise.startsWith('→') ? `${actorName}: ${label} ${concise}` : `${actorName}: ${concise}`;
      this.scrollTurnList();
    }
    this.animPhase = 'result';
  }

  /** The sprite an action aims at, by the announced target name (a dead enemy target retargets to the first living one). */
  private findTargetSprite(info: NextActionInfo): Container | null {
    if (!info.targetName) return null;
    if (info.actorId.startsWith('party_')) {
      const enemies = this.battle.allEnemies;
      let i = enemies.findIndex(e => e.displayName === info.targetName && e.currentHp > 0);
      if (i < 0) i = enemies.findIndex(e => e.currentHp > 0);
      return this.display.enemySprites[i] ?? null;
    }
    const i = (this.battle.allParty ?? []).findIndex(c => c.name === info.targetName);
    return this.display.partySprites[i] ?? null;
  }

  /** BA-9: reach to the target sprite's right edge (its 2x bounds); the minimum when there is no target. */
  private measureReach(homeX: number, target: Container | null): number {
    if (!target) return MIN_ATTACK_REACH;
    const b = target.getBounds();
    return attackReach(homeX, b.x + b.width);
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
    const entry = this.turnListTexts[this.turnActionIndex]; if (entry) entry.tint = 0x888888;
    if (this.animActorSprite) this.display.setActorPose(this.animActorSprite, null);
    this.turnActionIndex++; this.animTimer = 0; this.animActorSprite = null; this.animEnemyIndex = -1;
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
