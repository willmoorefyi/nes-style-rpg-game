/**
 * BA-7 (docs/FIX_PLAN_PENINSULA.md T5a): the scene calls `updateFieldTargeting()` then `updateTargetVisuals()` in the
 * same frame. After a confirm (or cancel) the second call must not draw a new target outline, which nothing would
 * ever remove (the faint rectangle left where a dead enemy stood).
 */
import { describe, it, expect, vi } from 'vitest';
import { Container, Graphics, Sprite } from 'pixi.js';
import { BattleFieldTargeting, mostHurtMemberId } from '../../../src/scenes/battle/BattleFieldTargeting.js';
import type { Character } from '../../../src/entities/Character.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import { createMockInput } from '../../helpers/testUtils.js';

function setup(party: Array<{ currentHp: number; maxHp?: number }> = [{ currentHp: 10 }]) {
  const main = new Container();
  const enemySprites = [new Sprite(), new Sprite()];
  const partySprites = party.map(() => new Sprite());
  const display = {
    enemySprites, partySprites, enemyListTexts: [],
    partyPanel: { targetIndex: -1, setTarget: vi.fn(function (this: { targetIndex: number }, i: number) { this.targetIndex = i; }), blinkTarget: vi.fn() },
    listIndexFor: () => undefined,
    updateEnemyListDeadTints: vi.fn(),
  } as unknown as BattleDisplayManager;
  const enemies = [{ id: 'enemy_0', displayName: 'Goblin A', currentHp: 5 }, { id: 'enemy_1', displayName: 'Goblin B', currentHp: 5 }];
  const battle = {
    allEnemies: enemies,
    get livingEnemies() { return enemies.filter(e => e.currentHp > 0); },
    allParty: party,
  } as unknown as BattleStateMachine;
  const input = createMockInput();
  const sounds: string[] = [];
  const targeting = new BattleFieldTargeting(main, battle, display, input as unknown as InputManager, e => sounds.push(e));
  return { main, input, targeting, display, sounds };
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

  it('T6e: a party target lights its row in the party panel, and the row goes dark when targeting ends', () => {
    const { input, targeting, display } = setup();
    targeting.enterFieldTargeting(true, false, vi.fn(), vi.fn());
    targeting.updateTargetVisuals();
    expect(display.partyPanel.targetIndex).toBe(0);
    input.press('confirm');
    targeting.updateFieldTargeting();
    expect(display.partyPanel.targetIndex).toBe(-1);
  });

  it('B10: a Potion starts on the most hurt living member (35/35, 12/25, 25/25, 25/25 -> index 1; old: 0)', () => {
    const party = [{ currentHp: 35, maxHp: 35 }, { currentHp: 12, maxHp: 25 }, { currentHp: 25, maxHp: 25 }, { currentHp: 25, maxHp: 25 }];
    const { targeting } = setup(party);
    const initial = mostHurtMemberId(party as unknown as Character[]);
    expect(initial).toBe('party_1');
    const onConfirm = vi.fn();
    targeting.enterFieldTargeting(true, false, onConfirm, vi.fn(), initial);
    expect(targeting.fieldTargetIndex).toBe(1);
  });

  it('B10: the most hurt member skips the fallen, and an unknown initial id starts at 0', () => {
    expect(mostHurtMemberId([{ currentHp: 0, maxHp: 30 }, { currentHp: 20, maxHp: 30 }] as unknown as Character[])).toBe('party_1');
    const { targeting } = setup([{ currentHp: 10 }, { currentHp: 10 }]);
    targeting.enterFieldTargeting(true, false, vi.fn(), vi.fn(), 'party_9');
    expect(targeting.fieldTargetIndex).toBe(0);
  });

  it('B10: the target arrow is yellow', () => {
    const { main, targeting } = setup();
    targeting.enterFieldTargeting(false, false, vi.fn(), vi.fn());
    expect(targeting.targetArrow).not.toBeNull();
    expect(main.children).toContain(targeting.targetArrow);
    const fills = JSON.stringify(targeting.targetArrow!.context.instructions.map(i => (i.data as { style?: { color?: number } }).style?.color));
    expect(fills).toContain(String(0xffff00));
  });

  it('I3: moving the cursor sounds cursorMove; confirm sounds cursorSelect; cancel sounds cursorCancel', () => {
    const { input, targeting, sounds } = setup();
    targeting.enterFieldTargeting(false, false, vi.fn(), vi.fn());
    input.press('down');
    targeting.updateFieldTargeting();
    input.clear();
    expect(sounds).toEqual(['cursorMove']);
    input.press('confirm');
    targeting.updateFieldTargeting();
    input.clear();
    expect(sounds).toEqual(['cursorMove', 'cursorSelect']);
    targeting.enterFieldTargeting(false, false, vi.fn(), vi.fn());
    input.press('cancel');
    targeting.updateFieldTargeting();
    expect(sounds).toEqual(['cursorMove', 'cursorSelect', 'cursorCancel']);
  });
});
