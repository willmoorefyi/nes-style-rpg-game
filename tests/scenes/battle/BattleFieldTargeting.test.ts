/**
 * BA-7 (docs/FIX_PLAN_PENINSULA.md T5a): the scene calls `updateFieldTargeting()` then `updateTargetVisuals()` in the
 * same frame. After a confirm (or cancel) the second call must not draw a new target outline, which nothing would
 * ever remove (the faint rectangle left where a dead enemy stood).
 */
import { describe, it, expect, vi } from 'vitest';
import { Container, Graphics, Sprite } from 'pixi.js';
import { BattleFieldTargeting } from '../../../src/scenes/battle/BattleFieldTargeting.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import { createMockInput } from '../../helpers/testUtils.js';

function setup() {
  const main = new Container();
  const enemySprites = [new Sprite(), new Sprite()];
  const partySprites = [new Sprite()];
  const display = {
    enemySprites, partySprites, enemyListTexts: [], statusBoxes: [],
    enemyNameToListIndex: new Map<string, number>(),
    updateEnemyListDeadTints: vi.fn(),
  } as unknown as BattleDisplayManager;
  const enemies = [{ id: 'enemy_0', displayName: 'Goblin A', currentHp: 5 }, { id: 'enemy_1', displayName: 'Goblin B', currentHp: 5 }];
  const battle = {
    allEnemies: enemies,
    get livingEnemies() { return enemies.filter(e => e.currentHp > 0); },
    allParty: [{ currentHp: 10 }],
  } as unknown as BattleStateMachine;
  const input = createMockInput();
  const targeting = new BattleFieldTargeting(main, battle, display, input as unknown as InputManager);
  return { main, input, targeting };
}

const outlines = (c: Container) => c.children.filter(ch => ch instanceof Graphics).length;

describe('BattleFieldTargeting (BA-7)', () => {
  it('confirm then visuals in the same frame leaves no outline behind', () => {
    const { main, input, targeting } = setup();
    const before = main.children.length;
    const onConfirm = vi.fn();
    expect(targeting.enterFieldTargeting(false, false, onConfirm, vi.fn())).toBe(true);
    targeting.updateTargetVisuals(); // a frame of hovering draws the outline
    expect(outlines(main)).toBe(2); // the arrow and the outline

    input.press('confirm');
    targeting.updateFieldTargeting();
    targeting.updateTargetVisuals();
    input.clear();

    expect(onConfirm).toHaveBeenCalledWith('enemy_0');
    expect(outlines(main)).toBe(0);
    expect(main.children.length).toBe(before);
  });

  it('cancel then visuals in the same frame leaves no outline either', () => {
    const { main, input, targeting } = setup();
    const before = main.children.length;
    const onCancel = vi.fn();
    targeting.enterFieldTargeting(false, false, vi.fn(), onCancel);
    input.press('cancel');
    targeting.updateFieldTargeting();
    targeting.updateTargetVisuals();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(main.children.length).toBe(before);
  });

  it('targeting again after a confirm draws the outline again', () => {
    const { main, input, targeting } = setup();
    targeting.enterFieldTargeting(false, false, vi.fn(), vi.fn());
    input.press('confirm');
    targeting.updateFieldTargeting();
    targeting.updateTargetVisuals();
    input.clear();
    targeting.enterFieldTargeting(false, false, vi.fn(), vi.fn());
    targeting.updateTargetVisuals();
    expect(outlines(main)).toBe(2);
  });
});
