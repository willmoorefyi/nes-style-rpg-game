import { Container, Graphics } from 'pixi.js';
import type { InputManager } from '../../core/InputManager.js';
import type { BattleStateMachine } from '../../battle/BattleStateMachine.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';

export class BattleFieldTargeting {
  fieldTargetIndex: number = 0;
  fieldTargetIsParty: boolean = false;
  fieldTargetCallback: ((targetId: string) => void) | null = null;
  fieldTargetCancelCallback: (() => void) | null = null;
  fieldTargetRevive: boolean = false;
  targetArrow: Graphics | null = null;
  // L3: Outline around hovered target sprite
  targetOutline: Graphics | null = null;
  // L4: Shared flash timer for target selection effects
  targetFlashTimer: number = 0;

  constructor(
    private readonly mainContainer: Container,
    private readonly battle: BattleStateMachine,
    private readonly display: BattleDisplayManager,
    private readonly input: InputManager,
  ) {}

  enterFieldTargeting(isParty: boolean, revive: boolean, onConfirm: (targetId: string) => void, onCancel: () => void): boolean {
    this.fieldTargetIsParty = isParty;
    this.fieldTargetRevive = revive;
    this.fieldTargetCallback = onConfirm;
    this.fieldTargetCancelCallback = onCancel;
    this.fieldTargetIndex = 0;

    const targets = this.getFieldTargets();
    if (targets.length === 0) {
      onCancel();
      return false;
    }

    this.updateTargetArrow([], isParty, 0);
    return true;
  }

  getFieldTargets(): Array<{ id: string; spriteIndex: number }> {
    if (this.fieldTargetIsParty) {
      const party = this.battle.allParty;
      return party
        .map((c, i) => ({ id: `party_${i}`, hp: c.currentHp, spriteIndex: i }))
        .filter(t => this.fieldTargetRevive ? t.hp <= 0 : t.hp > 0);
    }
    const allEnemies = this.battle.allEnemies;
    return this.battle.livingEnemies.map(e => ({
      id: e.id,
      spriteIndex: allEnemies.indexOf(e),
    }));
  }

  updateFieldTargeting(): void {
    const targets = this.getFieldTargets();
    if (targets.length === 0) {
      this.fieldTargetCancelCallback?.();
      this.clearTargetArrow();
      return;
    }

    if (this.input.isJustPressed('up')) {
      this.fieldTargetIndex = (this.fieldTargetIndex - 1 + targets.length) % targets.length;
      this.updateTargetArrow([], this.fieldTargetIsParty, this.fieldTargetIndex);
    } else if (this.input.isJustPressed('down')) {
      this.fieldTargetIndex = (this.fieldTargetIndex + 1) % targets.length;
      this.updateTargetArrow([], this.fieldTargetIsParty, this.fieldTargetIndex);
    } else if (this.input.isJustPressed('confirm')) {
      const target = targets[this.fieldTargetIndex];
      if (target) {
        this.clearTargetArrow();
        this.fieldTargetCallback?.(target.id);
        this.fieldTargetCallback = null;
        this.fieldTargetCancelCallback = null;
      }
    } else if (this.input.isJustPressed('cancel')) {
      this.clearTargetArrow();
      this.fieldTargetCancelCallback?.();
      this.fieldTargetCallback = null;
      this.fieldTargetCancelCallback = null;
    }
  }

  /** Show/update an arrow above the currently highlighted target sprite */
  updateTargetArrow(_ids: string[], isParty: boolean, selectedIndex: number): void {
    this.clearTargetArrow();
    if (selectedIndex < 0) return;
    const targets = this.getFieldTargets();
    const target = targets[selectedIndex];
    if (!target) return;
    const sprites = isParty ? this.display.partySprites : this.display.enemySprites;
    const sprite = sprites[target.spriteIndex];
    if (!sprite) return;
    const arrow = new Graphics();
    arrow.poly([0, 0, 16, 0, 8, 12]).fill(0xffffff);
    const offsetX = isParty ? 24 : 40;
    arrow.position.set(sprite.x + offsetX, sprite.y - 20);
    this.mainContainer.addChild(arrow);
    this.targetArrow = arrow;
  }

  clearTargetArrow(): void {
    if (this.targetArrow) {
      this.mainContainer.removeChild(this.targetArrow);
      this.targetArrow = null;
    }
    // L3: Clear outline
    if (this.targetOutline) {
      this.mainContainer.removeChild(this.targetOutline);
      this.targetOutline = null;
    }
    // L4: Reset flash timer and tints
    this.targetFlashTimer = 0;
    for (const t of this.display.enemyListTexts) t.tint = 0xffffff;
    this.display.updateEnemyListDeadTints();
    for (const box of this.display.statusBoxes) box.alpha = 1;
  }

  /** Update target outline and flash effects during target selection */
  updateTargetVisuals(): void {
    this.targetFlashTimer++;
    const targets = this.getFieldTargets();
    const target = targets[this.fieldTargetIndex];
    if (target) {
      const sprites = this.fieldTargetIsParty ? this.display.partySprites : this.display.enemySprites;
      const sprite = sprites[target.spriteIndex];
      if (sprite) {
        if (!this.targetOutline) {
          this.targetOutline = new Graphics();
          this.mainContainer.addChild(this.targetOutline);
        }
        this.targetOutline.clear();
        this.targetOutline.rect(-3, -3, sprite.width + 6, sprite.height + 6).stroke({ width: 2, color: 0xffffff });
        this.targetOutline.position.set(sprite.x, sprite.y);
        this.targetOutline.alpha = 0.3 + 0.7 * Math.abs(Math.sin(this.targetFlashTimer * 0.12));
      }
    }
    // L4: Flash enemy list entry or party status box
    const sinVal = Math.sin(this.targetFlashTimer * 0.12);
    if (target && this.fieldTargetIsParty) {
      // Reset all status box alphas, then pulse the selected one
      for (const box of this.display.statusBoxes) box.alpha = 1;
      const box = this.display.statusBoxes[target.spriteIndex];
      if (box) box.alpha = 0.5 + 0.5 * Math.abs(sinVal);
    } else if (target && !this.fieldTargetIsParty) {
      const enemy = this.battle.allEnemies[target.spriteIndex];
      if (enemy) {
        const listIdx = this.display.enemyNameToListIndex.get(enemy.displayName);
        if (listIdx !== undefined) {
          // Reset all list tints first
          for (let i = 0; i < this.display.enemyListTexts.length; i++) {
            const e = this.display.enemyListTexts[i];
            // Preserve gray for all-dead groups
            e.tint = 0xffffff;
          }
          this.display.updateEnemyListDeadTints();
          // Pulse selected between white and yellow
          const t = this.display.enemyListTexts[listIdx];
          if (t) t.tint = sinVal > 0 ? 0xffff00 : 0xffffff;
        }
      }
    }
  }
}
