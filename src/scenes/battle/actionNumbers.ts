/**
 * An action's numbers on screen (moved out of BattleAnimationController): floating damage / heal numbers, the melee
 * slash, the hurt flash and the enemy hurt / dying pose.
 */
import { Sprite, type Container } from 'pixi.js';
import type { BattleStateMachine, DamageEvent } from '../../battle/BattleStateMachine.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';
import type { BattleEffects } from './BattleEffects.js';
import { floatFrames, floatKind, floatLabel, type FloatKind } from './floatingNumbers.js';
import { slashEffect } from './slashEffect.js';
import { ICON_LIFT } from './fx/statusIcons.js';
import { iconsFor } from './fx/statusRules.js';
import { stoneTextures } from './fx/stoneTextures.js';
import { headOf } from './fx/texturePixels.js';
import { colossusAt } from './colossus/colossusProxy.js';
import { FLOAT_FONT } from './BattleSceneTypes.js';
import { GAME_WIDTH } from '../../core/LayoutConstants.js';
import { heroRect } from './heroBody.js';

/** C6-11 (D-C7-16): px between two numbers of one action that would meet, beyond the moved number's width. */
export const NUMBER_SPREAD_GAP = 8;
interface NumberBox { x: number; y: number; w: number }

export class ActionNumbers {
  constructor(
    private readonly battle: BattleStateMachine,
    private readonly display: BattleDisplayManager,
    private readonly effects: BattleEffects,
  ) {}

  /** A floating number that lives as long as the message speed asks (72 frames at speed 3, 48 at 5). */
  addFloat(label: string, kind: FloatKind, sprite: Container, iconRowBottom: number | null = null): void {
    this.effects.addFloating(label, kind, sprite, iconRowBottom);
    const last = this.effects.floatingTexts[this.effects.floatingTexts.length - 1];
    if (last) last.maxAge = floatFrames();
  }

  /** A quick white slash across each enemy the melee attack hit. */
  slashTargets(events: DamageEvent[]): void {
    for (const evt of events) {
      if (!evt.targetId.startsWith('enemy_') || evt.isHeal) continue;
      const sprite = this.display.enemySprites[parseInt(evt.targetId.split('_')[1], 10)];
      if (!sprite) continue;
      this.effects.addFlash(slashEffect(colossusAt(sprite)?.slashBox() ?? heroRect(sprite)), 12);   // a colossus: at its melee point; a hero: its body (pass CL)
    }
  }

  /** One action's numbers; a number whose box meets an earlier one of the same call moves aside (C6-11). */
  spawn(damageEvents: DamageEvent[]): void {
    const placed: NumberBox[] = [];
    for (const evt of damageEvents) {
      const idx = parseInt(evt.targetId.split('_')[1], 10);
      const sprite: Container | undefined = evt.targetId.startsWith('enemy_') ? this.display.enemySprites[idx] : this.display.partySprites[idx];
      if (!sprite) continue;
      if (evt.spellElement) this.effects.elementFlash(sprite, evt.spellElement);
      if (!evt.isHeal && evt.damage > 0 && !evt.targetId.startsWith('enemy_')) this.display.flashHurt(idx);
      if (!evt.isHeal && evt.damage > 0 && evt.targetId.startsWith('enemy_')) this.reactEnemy(idx);
      const enemy = evt.targetId.startsWith('enemy_');
      const label = floatLabel(evt);
      this.addFloat(label, floatKind(evt), sprite, enemy ? this.iconRowBottom(idx, sprite) : null);
      const text = this.effects.floatingTexts[this.effects.floatingTexts.length - 1]?.text;
      if (text) placed.push(this.spread(text, label.length * FLOAT_FONT * 0.6, placed));
    }
  }

  /** Move `text` (width `w`) sideways by w + 8 px steps, right first, left once the right edge is passed, until it meets
   *  no earlier box of the call; a lone number keeps its place. Returns its box. */
  private spread(text: Container, w: number, placed: readonly NumberBox[]): NumberBox {
    const meets = (x: number): boolean => placed.some((b) => x < b.x + b.w && b.x < x + w && text.y < b.y + FLOAT_FONT && b.y < text.y + FLOAT_FONT);
    const x0 = text.x;
    if (!meets(x0)) return { x: x0, y: text.y, w };
    const step = Math.round(w + NUMBER_SPREAD_GAP);
    for (const dir of [1, -1]) {
      for (let k = 1; k <= placed.length; k++) {
        const x = x0 + dir * k * step;
        if (x < 0 || x + w > GAME_WIDTH) break;
        if (!meets(x)) { text.x = x; return { x, y: text.y, w }; }
      }
    }
    return { x: x0, y: text.y, w };
  }

  /** F6: the bottom of enemy idx's status icon row in its sprite's space (the head statusFx anchors the icons on, the
   *  target label's test), or null when it shows no icon. */
  private iconRowBottom(idx: number, sprite: Container): number | null {
    const statuses = this.display.presented?.enemies[idx]?.statuses ?? [];
    if (iconsFor(statuses, this.display.statusVisuals?.() ?? {}).length === 0) return null;
    const h = sprite instanceof Sprite ? headOf(stoneTextures.coloured(sprite.texture)) : null;
    const c = colossusAt(sprite);
    if (c) return c.anchors().head.y - ICON_LIFT;
    const headY = h ? sprite.y + h.y * sprite.scale.y : sprite.y + sprite.height * 0.33;
    return headY - ICON_LIFT;
  }

  /** Preview pose art: a hit shows the hurt pose; a lethal hit holds it while the sprite fades out. */
  private reactEnemy(idx: number): void {
    const view = this.display.enemyView;
    if (!view) return;
    if ((this.battle.allEnemies[idx]?.currentHp ?? 0) <= 0) view.poses.freezeDying(idx); else view.poses.playHurt(idx);
  }
}
