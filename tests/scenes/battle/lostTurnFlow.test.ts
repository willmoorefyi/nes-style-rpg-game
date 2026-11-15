/**
 * Final play test, pass F item 3 (the view side): a party member whose turn is certain to be lost is not announced
 * ("WAR attacks ...!") and never steps forward; the tick line ("WAR is asleep!") is the turn's only line.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container, Sprite } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { setMessageSpeed } from '../../../src/core/Settings.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { Window } from '../../../src/ui/Window.js';

beforeEach(() => { setMessageSpeed(3); });

function setup(lost: boolean) {
  const hero = new Sprite();
  hero.position.set(100, 200);
  const display = {
    enemySprites: [new Sprite()], partySprites: [hero], enemyView: null,
    setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(), updatePartySprites: vi.fn(),
  } as unknown as BattleDisplayManager;
  let queued = 1;
  const battle = {
    allEnemies: [{ displayName: 'Goblin', currentHp: 10 }], livingEnemies: [{}], livingParty: [{}], isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? { actorId: 'party_0', actorName: 'WAR', actionType: lost ? 'skip' : 'fight', targetId: 'enemy_0', targetName: 'Goblin' } : null),
    isNextActorAlive: () => true,
    nextActorLosesTurn: () => lost,
    executeNextAction: () => { queued = 0; return { done: true, damageEvents: [], messages: [{ text: lost ? 'WAR is asleep!' : 'WAR hits Goblin for 5!' }], missed: false }; },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const input = { isJustPressed: () => false } as unknown as InputManager;
  const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
  const shown: string[] = [];
  const ctrl = new BattleAnimationController(new Container(), battle, display, input, win, new Container(), (t) => shown.push(t), vi.fn());
  return { ctrl, hero, shown, display };
}

describe('play-test item 3: a lost party turn in the battle view', () => {
  it('no announcement, no step forward: the tick line shows and the turn ends in place', () => {
    const { ctrl, hero, shown, display } = setup(true);
    let moved = false;
    for (let f = 0; f < 400 && ctrl.animPhase !== 'round_end'; f++) {
      ctrl.updateAnimating(1);
      if (hero.x !== 100 || hero.y !== 200) moved = true;
    }
    expect(ctrl.animPhase).toBe('round_end');
    expect([...new Set(shown)]).toEqual(['WAR is asleep!']);
    expect(moved).toBe(false);
    expect(vi.mocked(display.setActorPose).mock.calls.every(([, pose]) => pose === null)).toBe(true);
  });

  it('a normal Fight is still announced and steps forward', () => {
    const { ctrl, hero, shown } = setup(false);
    let moved = false;
    for (let f = 0; f < 600 && ctrl.animPhase !== 'round_end'; f++) {
      ctrl.updateAnimating(1);
      if (hero.x !== 100) moved = true;
    }
    expect(shown[0]).toBe('WAR attacks Goblin!');
    expect(moved).toBe(true);
  });
});
