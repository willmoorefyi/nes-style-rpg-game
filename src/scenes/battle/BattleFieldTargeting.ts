import { BitmapText, Container, Graphics } from 'pixi.js';
import type { InputManager } from '../../core/InputManager.js';
import type { BattleStateMachine } from '../../battle/BattleStateMachine.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';
import type { Character } from '../../entities/Character.js';
import { mostHurtIndex } from '../../entities/partyTargets.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { PANEL_FONT } from './BattleSceneTypes.js';
import { tagsFor, type StatusVisuals } from './fx/statusRules.js';

/** B10: the target arrow is yellow, so it never reads as the active hero's white arrow. */
const TARGET_ARROW = 0xffff00;
/** Frames per blink of the target row's cursor in the party panel. */
const BLINK_FRAMES = 15;

/** The enemy target line beside the arrow: the enemy's name and its presented status tags ("Goblin B SLP PSN"). */
export function targetLine(name: string, statuses: readonly string[], visuals: StatusVisuals): string {
  return [name, ...tagsFor(statuses, visuals)].join(' ');
}

export type TargetingSound = 'cursorMove' | 'cursorSelect' | 'cursorCancel';

/** B10: where a party-target cursor starts: the most hurt living member (lowest HP / max), by battle id. */
export function mostHurtMemberId(party: readonly Character[]): string | undefined {
  const i = mostHurtIndex(party);
  return i >= 0 ? `party_${i}` : undefined;
}

export class BattleFieldTargeting {
  fieldTargetIndex: number = 0;
  fieldTargetIsParty: boolean = false;
  fieldTargetCallback: ((targetId: string) => void) | null = null;
  fieldTargetCancelCallback: (() => void) | null = null;
  fieldTargetRevive: boolean = false;
  targetArrow: Graphics | null = null;
  /** The enemy target line (name and status tags) beside the arrow. */
  targetLabel: BitmapText | null = null;
  // L3: Outline around hovered target sprite
  targetOutline: Graphics | null = null;
  // L4: Shared flash timer for target selection effects
  targetFlashTimer: number = 0;
  /** BA-7: true from `enterFieldTargeting` until confirm, cancel or no targets; the visuals draw only while set. */
  private active = false;

  constructor(
    private readonly mainContainer: Container,
    private readonly battle: BattleStateMachine,
    private readonly display: BattleDisplayManager,
    private readonly input: InputManager,
    /** I3: cursor sounds while choosing a target. */
    private readonly emit: (event: TargetingSound) => void = () => {},
  ) {}

  /** Start choosing a target; the cursor starts on `initialId` when it is a valid target (B10), else on the first. */
  enterFieldTargeting(isParty: boolean, revive: boolean, onConfirm: (targetId: string) => void, onCancel: () => void,
    initialId?: string): boolean {
    this.fieldTargetIsParty = isParty;
    this.fieldTargetRevive = revive;
    this.fieldTargetCallback = onConfirm;
    this.fieldTargetCancelCallback = onCancel;

    const targets = this.getFieldTargets();
    if (targets.length === 0) {
      this.active = false;
      onCancel();
      return false;
    }
    this.fieldTargetIndex = Math.max(0, targets.findIndex(t => t.id === initialId));

    this.active = true;
    this.updateTargetArrow([], isParty, this.fieldTargetIndex);
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
      this.active = false;
      this.fieldTargetCancelCallback?.();
      this.clearTargetArrow();
      return;
    }

    if (this.input.isJustPressed('up')) {
      this.fieldTargetIndex = (this.fieldTargetIndex - 1 + targets.length) % targets.length;
      this.updateTargetArrow([], this.fieldTargetIsParty, this.fieldTargetIndex);
      this.emit('cursorMove');
    } else if (this.input.isJustPressed('down')) {
      this.fieldTargetIndex = (this.fieldTargetIndex + 1) % targets.length;
      this.updateTargetArrow([], this.fieldTargetIsParty, this.fieldTargetIndex);
      this.emit('cursorMove');
    } else if (this.input.isJustPressed('confirm')) {
      const target = targets[this.fieldTargetIndex];
      if (target) {
        this.emit('cursorSelect');
        this.active = false;
        this.clearTargetArrow();
        this.fieldTargetCallback?.(target.id);
        this.fieldTargetCallback = null;
        this.fieldTargetCancelCallback = null;
      }
    } else if (this.input.isJustPressed('cancel')) {
      this.emit('cursorCancel');
      this.active = false;
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
    arrow.poly([0, 0, 16, 0, 8, 12]).fill(TARGET_ARROW);
    const offsetX = isParty ? 24 : 40;
    arrow.position.set(sprite.x + offsetX, sprite.y - 20);
    this.mainContainer.addChild(arrow);
    this.targetArrow = arrow;
    const enemy = isParty ? undefined : this.battle.allEnemies[target.spriteIndex];
    if (!enemy) return;
    const statuses = this.display.presented?.enemies[target.spriteIndex]?.statuses ?? [];
    const label = new BitmapText({ text: targetLine(enemy.displayName ?? enemy.data.name, statuses, this.display.statusVisuals?.() ?? {}),
      style: { fontFamily: NES_FONT, fontSize: PANEL_FONT, fill: TARGET_ARROW } });
    label.position.set(Math.round(arrow.x + 24), Math.round(arrow.y - 10));
    this.mainContainer.addChild(label);
    this.targetLabel = label;
  }

  clearTargetArrow(): void {
    if (this.targetArrow) {
      this.mainContainer.removeChild(this.targetArrow);
      this.targetArrow = null;
    }
    if (this.targetLabel) {
      this.mainContainer.removeChild(this.targetLabel);
      this.targetLabel.destroy();
      this.targetLabel = null;
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
    this.display.partyPanel.setTarget(-1);
  }

  /** Update target outline and flash effects during target selection */
  updateTargetVisuals(): void {
    // BA-7: after confirm or cancel in the same frame, drawing would leave an outline that nothing removes
    if (!this.active) return;
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
    // L4: Flash the enemy list line; a party target lights its row in the party panel (cursor + highlight)
    const sinVal = Math.sin(this.targetFlashTimer * 0.12);
    if (target && this.fieldTargetIsParty) {
      if (this.display.partyPanel.targetIndex !== target.spriteIndex) this.display.partyPanel.setTarget(target.spriteIndex);
      this.display.partyPanel.blinkTarget(Math.floor(this.targetFlashTimer / BLINK_FRAMES) % 2 === 0);
    } else if (target && !this.fieldTargetIsParty) {
      const enemy = this.battle.allEnemies[target.spriteIndex];
      if (enemy) {
        const listIdx = this.display.listIndexFor(enemy);
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
