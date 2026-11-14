import { Container, BitmapText, Graphics, Sprite } from 'pixi.js';
import type { InputManager } from '../../core/InputManager.js';
import type { BattleStateMachine, DamageEvent } from '../../battle/BattleStateMachine.js';
import type { BattleSceneConfig } from './BattleSceneTypes.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE, FONT_SIZE_SM } from '../../core/LayoutConstants.js';
import type { Window } from '../../ui/Window.js';
import { formatConciseResult, capitalize, createPromptIndicator, destroyPromptIndicator } from './battleMessageUtils.js';
import { advanceAt, advanceFrames, returnAt, RETURN_FRAMES, parseAttackOverride, pickAttackStyle, castAt, castReturnAt, CAST_FRAMES, type AttackFrame,
  type AttackStyle } from './attackChoreography.js';
import { slashEffect } from './slashEffect.js';
export const ELEMENT_COLORS: Record<string, number> = {
  fire: 0xff4400, ice: 0x4488ff, lightning: 0xffff00, holy: 0xffffff, dark: 0x660066,
  water: 0x0066ff, earth: 0x886622, wind: 0x88ff88, heal: 0x44ff44,
};
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
  animMessages: { text: string }[] = [];
  animMessageIndex = 0;
  // N2: Track if current animation actor is an enemy (skip step_forward/step_back)
  animActorIsEnemy = false;
  floatingTexts: { text: BitmapText; age: number; maxAge: number }[] = [];
  dyingEnemies: Map<number, number> = new Map();
  spellFlashes: { overlay: Container; age: number; maxAge: number; follow?: Container }[] = [];
  /** Index of the acting enemy (preview pose art), or -1. */
  private animEnemyIndex = -1;
  // K4: Turn list in commandWindow during execution
  turnListTexts: BitmapText[] = [];
  turnActionIndex = 0;
  private currentActionInfo: { actorName: string; actionType: string; targetName?: string; spellName?: string } | null = null;
  private promptIndicator: BitmapText | null = null;
  private promptBlinkTimer = 0;
  constructor(
    private readonly mainContainer: Container,
    private readonly battle: BattleStateMachine,
    private readonly config: BattleSceneConfig,
    private readonly display: BattleDisplayManager,
    private readonly input: InputManager,
    private readonly commandWindow: Window,
    private readonly messageWindow: Window,
    private readonly turnListContainer: Container,
    private readonly setMessageText: (text: string) => void,
    private readonly onResolveRound: () => void,
  ) {}
  findActorSprite(actorName: string): { sprite: Container; isEnemy: boolean } | null {
    for (let i = 0; i < this.config.party.length; i++) {
      if (this.config.party[i].name === actorName) return { sprite: this.display.partySprites[i], isEnemy: false };
    }
    const enemies = this.battle.allEnemies;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].displayName === actorName && enemies[i].currentHp > 0) return { sprite: this.display.enemySprites[i], isEnemy: true };
    }
    return null;
  }
  formatAnnouncement(info: { actorName: string; actionType: string; targetName?: string; spellName?: string }): string {
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
          const found = this.findActorSprite(info.actorName);
          this.animActorSprite = found?.sprite ?? null;
          this.animActorIsEnemy = found?.isEnemy ?? false;
          if (this.animActorSprite) {
            this.animActorOrigX = this.animActorSprite.x;
            this.animActorOrigY = this.animActorSprite.y;
            this.lastAdvance = { dx: 0, dy: 0, pose: 'ready' };
            if (info.actionType === 'fight') this.attackStyle = this.attackOverride ?? pickAttackStyle(this.attackRng);
            // spells and items gather in place first; every party action then poses frame by frame in step_forward
            if (!found!.isEnemy && info.actionType !== 'fight') this.display.setActorPose(this.animActorSprite, 'cast_gather');
          }
        }
        this.animTimer += dt;
        if (this.animTimer >= 30 || confirmSkip) {
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
        this.placeActor(melee ? advanceAt(this.attackStyle, this.animTimer) : castAt(this.animTimer));
        if (this.animTimer >= frames) { this.animTimer = 0; this.animPhase = 'execute'; }
        break;
      }
      case 'enemy_lunge': {
        // wait until the lunge reaches the party side, then resolve the action (the return plays on its own)
        if (this.display.enemyView?.poses.attackOutDone(this.animEnemyIndex) ?? true) this.animPhase = 'execute';
        break;
      }
      case 'execute': {
        const result = this.battle.executeNextAction();
        this.spawnFloatingTextsFromEvents(result.damageEvents);
        if (!this.animActorIsEnemy && this.currentActionInfo?.actionType === 'fight') this.slashTargets(result.damageEvents);
        this.display.updatePartyDisplay();
        this.display.updateEnemySprites(this.dyingEnemies);
        this.display.updatePartySprites();
        this.animMessages = result.messages;
        this.animMessageIndex = 0; this.animTimer = 0;
        // Update turn list entry in-place with concise result
        const entry = this.turnListTexts[this.turnActionIndex];
        if (entry && this.currentActionInfo) {
          const { actorName, actionType, spellName } = this.currentActionInfo;
          const label = actionType === 'magic' && spellName ? spellName.toUpperCase() : capitalize(actionType);
          const concise = formatConciseResult(result.messages, actorName);
          entry.text = concise.startsWith('→') ? `${actorName}: ${label} ${concise}` : `${actorName}: ${concise}`;
          this.scrollTurnList();
        }
        this.animPhase = 'result'; break;
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
        if (this.animTimer >= 25 || confirmSkip) {
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
        if (this.animTimer === 0) this.setMessageText('');
        this.promptBlinkTimer++;
        if (!this.promptIndicator) this.promptIndicator = createPromptIndicator(this.messageWindow);
        this.promptIndicator.visible = Math.floor(this.promptBlinkTimer / 20) % 2 === 0;
        if (confirmSkip) {
          destroyPromptIndicator(this.promptIndicator, this.messageWindow);
          this.promptIndicator = null; this.promptBlinkTimer = 0;
          this.onResolveRound();
        }
        this.animTimer = 1; break;
      }
    }
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
      const fx = slashEffect(sprite);
      this.mainContainer.addChild(fx);
      this.spellFlashes.push({ overlay: fx, age: 0, maxAge: 12 });
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
  private enemyStillAttacking(): boolean {
    return this.animEnemyIndex >= 0 && (this.display.enemyView?.poses.isAttacking(this.animEnemyIndex) ?? false);
  }
  /** K4: Gray out completed action and advance to next or end-of-round */
  private completeAction(): void {
    const entry = this.turnListTexts[this.turnActionIndex]; if (entry) entry.tint = 0x888888;
    if (this.animActorSprite) this.display.setActorPose(this.animActorSprite, null);
    this.turnActionIndex++; this.animTimer = 0; this.animActorSprite = null; this.animEnemyIndex = -1;
    const battleOver = this.battle.livingEnemies.length === 0 || this.battle.livingParty.length === 0;
    if (battleOver) { this.battle.skipRemainingActions(); this.animPhase = 'round_end'; }
    else { this.animPhase = this.battle.actionQueueLength > 0 ? 'announce' : 'round_end'; }
  }
  spawnFloatingTextsFromEvents(damageEvents: DamageEvent[]): void {
    for (const evt of damageEvents) {
      const idx = parseInt(evt.targetId.split('_')[1], 10);
      const sprite: Container | undefined = evt.targetId.startsWith('enemy_') ? this.display.enemySprites[idx] : this.display.partySprites[idx];
      if (!sprite) continue;
      // Spell flash overlay
      if (evt.spellElement) {
        const color = ELEMENT_COLORS[evt.spellElement] ?? 0xffffff;
        let overlay: Container;
        if (sprite instanceof Sprite) {
          // Silhouette flash so the glow follows the art instead of a solid box
          const glow = new Sprite(sprite.texture);
          glow.tint = color;
          glow.scale.copyFrom(sprite.scale);
          overlay = glow;
        } else {
          const box = new Graphics();
          box.rect(0, 0, sprite.width, sprite.height).fill(color);
          overlay = box;
        }
        overlay.position.set(sprite.x, sprite.y);
        overlay.alpha = 0.6;
        this.mainContainer.addChild(overlay);
        this.spellFlashes.push({ overlay, age: 0, maxAge: 18, follow: sprite });
      }
      if (!evt.isHeal && evt.damage > 0 && !evt.targetId.startsWith('enemy_')) this.display.flashHurt(idx);
      if (!evt.isHeal && evt.damage > 0 && evt.targetId.startsWith('enemy_')) this.reactEnemy(idx);
      const fill = evt.isHeal ? 0x44ff44 : evt.isCrit ? 0xff4444 : 0xffffff;
      const label = evt.isHeal ? `+${evt.damage}` : `${evt.damage}`;
      const bt = new BitmapText({
        text: label,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill },
      });
      bt.position.set(sprite.x, sprite.y);
      this.mainContainer.addChild(bt);
      this.floatingTexts.push({ text: bt, age: 0, maxAge: 48 });
    }
  }
  /** Preview pose art: a hit shows the hurt pose; a lethal hit holds it while the sprite fades out. */
  private reactEnemy(idx: number): void {
    const view = this.display.enemyView;
    if (!view) return;
    if ((this.battle.allEnemies[idx]?.currentHp ?? 0) <= 0) view.poses.freezeDying(idx); else view.poses.playHurt(idx);
  }
  updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      ft.text.y -= 1 * dt;
      ft.text.alpha = 1 - ft.age / ft.maxAge;
      if (ft.age >= ft.maxAge) {
        this.mainContainer.removeChild(ft.text);
        this.floatingTexts.splice(i, 1);
      }
    }
  }
  updateDyingEnemies(dt: number): void {
    for (const [idx, remaining] of this.dyingEnemies) {
      const next = remaining - dt;
      if (next <= 0) {
        this.display.enemySprites[idx].alpha = 0;
        this.display.enemySprites[idx].visible = false;
        this.dyingEnemies.delete(idx);
      } else {
        this.display.enemySprites[idx].alpha = next / 30;
        this.dyingEnemies.set(idx, next);
      }
    }
  }
  updateSpellFlashes(dt: number): void {
    for (let i = this.spellFlashes.length - 1; i >= 0; i--) {
      const sf = this.spellFlashes[i];
      sf.age += dt;
      sf.overlay.alpha = 0.6 * (1 - sf.age / sf.maxAge);
      // follow the sprite (lunge, shake) and its current pose frame
      if (sf.follow) {
        sf.overlay.position.set(sf.follow.x, sf.follow.y);
        if (sf.overlay instanceof Sprite && sf.follow instanceof Sprite) sf.overlay.texture = sf.follow.texture;
      }
      if (sf.age >= sf.maxAge) {
        this.mainContainer.removeChild(sf.overlay);
        this.spellFlashes.splice(i, 1);
      }
    }
  }
}
