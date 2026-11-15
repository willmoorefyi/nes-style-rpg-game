/**
 * An action's numbers on screen (moved out of BattleAnimationController): floating damage / heal numbers, the melee
 * slash, the hurt flash and the enemy hurt / dying pose.
 */
import type { Container } from 'pixi.js';
import type { BattleStateMachine, DamageEvent } from '../../battle/BattleStateMachine.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';
import type { BattleEffects } from './BattleEffects.js';
import { floatFrames, floatKind, floatLabel, type FloatKind } from './floatingNumbers.js';
import { slashEffect } from './slashEffect.js';

export class ActionNumbers {
  constructor(
    private readonly battle: BattleStateMachine,
    private readonly display: BattleDisplayManager,
    private readonly effects: BattleEffects,
  ) {}

  /** A floating number that lives as long as the message speed asks (72 frames at speed 3, 48 at 5). */
  addFloat(label: string, kind: FloatKind, sprite: Container): void {
    this.effects.addFloating(label, kind, sprite);
    const last = this.effects.floatingTexts[this.effects.floatingTexts.length - 1];
    if (last) last.maxAge = floatFrames();
  }

  /** A quick white slash across each enemy the melee attack hit. */
  slashTargets(events: DamageEvent[]): void {
    for (const evt of events) {
      if (!evt.targetId.startsWith('enemy_') || evt.isHeal) continue;
      const sprite = this.display.enemySprites[parseInt(evt.targetId.split('_')[1], 10)];
      if (!sprite) continue;
      this.effects.addFlash(slashEffect(sprite), 12);
    }
  }

  spawn(damageEvents: DamageEvent[]): void {
    for (const evt of damageEvents) {
      const idx = parseInt(evt.targetId.split('_')[1], 10);
      const sprite: Container | undefined = evt.targetId.startsWith('enemy_') ? this.display.enemySprites[idx] : this.display.partySprites[idx];
      if (!sprite) continue;
      if (evt.spellElement) this.effects.elementFlash(sprite, evt.spellElement);
      if (!evt.isHeal && evt.damage > 0 && !evt.targetId.startsWith('enemy_')) this.display.flashHurt(idx);
      if (!evt.isHeal && evt.damage > 0 && evt.targetId.startsWith('enemy_')) this.reactEnemy(idx);
      this.addFloat(floatLabel(evt), floatKind(evt), sprite);
    }
  }

  /** Preview pose art: a hit shows the hurt pose; a lethal hit holds it while the sprite fades out. */
  private reactEnemy(idx: number): void {
    const view = this.display.enemyView;
    if (!view) return;
    if ((this.battle.allEnemies[idx]?.currentHp ?? 0) <= 0) view.poses.freezeDying(idx); else view.poses.playHurt(idx);
  }
}
