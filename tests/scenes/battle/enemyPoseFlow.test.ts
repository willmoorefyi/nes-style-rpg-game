import { describe, it, expect, vi } from 'vitest';
import { Container, Sprite } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { EnemyPoseController } from '../../../src/scenes/battle/EnemyPoseController.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine, DamageEvent } from '../../../src/battle/BattleStateMachine.js';
import type { BattleSceneConfig } from '../../../src/scenes/battle/BattleSceneTypes.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { Window } from '../../../src/ui/Window.js';

type Action = { actorName: string; actionType: string; targetName?: string };

function setup(action: Action, events: DamageEvent[], enemyHpAfter = 5, preview = true) {
  const enemySprites: Container[] = [new Sprite(), new Sprite()];
  const partySprites: Container[] = [new Sprite()];
  const poses = new EnemyPoseController(2);
  const display = {
    enemySprites, partySprites,
    enemyView: preview ? { poses } : null,
    setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(),
    updatePartySprites: vi.fn(),
  } as unknown as BattleDisplayManager;
  const enemies = [{ displayName: 'Goblin A', currentHp: 10 }, { displayName: 'Goblin B', currentHp: 10 }];
  let queued = 1;
  const battle = {
    allEnemies: enemies,
    get livingEnemies() { return enemies.filter((e) => e.currentHp > 0); },
    livingParty: [{}],
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? action : null),
    isNextActorAlive: () => true,
    executeNextAction: () => {
      queued = 0;
      for (const e of events) if (e.targetId.startsWith('enemy_')) enemies[Number(e.targetId.split('_')[1])].currentHp = enemyHpAfter;
      return { damageEvents: events, messages: [] };
    },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const config = { party: [{ name: 'Hero' }], enemies: [] } as unknown as BattleSceneConfig;
  const input = { isJustPressed: () => false } as unknown as InputManager;
  const win = { contentX: 0, contentY: 0, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
  const ctrl = new BattleAnimationController(new Container(), battle, config, display, input, win, win, new Container(),
    () => {}, () => {});
  /** One scene frame: the scene ticks display (poses) and the animation controller. */
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { poses.update(1); ctrl.updateAnimating(1); } };
  return { ctrl, poses, tick, enemies };
}

const hit = (targetId: string, damage = 3, isHeal = false): DamageEvent =>
  ({ targetId, damage, isHeal, isCrit: false } as unknown as DamageEvent);

describe('monster poses in the battle flow (preview art)', () => {
  it('an attacking enemy lunges in its attack pose before the action resolves, then returns to idle', () => {
    const { ctrl, poses, tick } = setup({ actorName: 'Goblin A', actionType: 'fight', targetName: 'Hero' }, [hit('party_0')]);
    tick(31);                         // announce (30 frames)
    expect(ctrl.animPhase).toBe('enemy_lunge');
    expect(poses.state(0).pose).toBe('attack');
    tick(8);                          // lunge out, then execute + result
    expect(['result', 'round_end']).toContain(ctrl.animPhase);
    tick(30);
    expect(poses.state(0).pose).toBe('idle');
    expect(ctrl.animPhase).toBe('round_end');
  });

  it('a hit on an enemy shows the hurt pose, then idles', () => {
    const s = setup({ actorName: 'Hero', actionType: 'fight', targetName: 'Goblin B' }, []);
    s.ctrl.spawnFloatingTextsFromEvents([hit('enemy_1')]);
    expect(s.poses.state(1).pose).toBe('hurt');
    s.poses.update(18);
    expect(s.poses.state(1).pose).toBe('idle');
  });

  it('a lethal hit holds the hurt pose with no shake while the sprite fades', () => {
    const s = setup({ actorName: 'Hero', actionType: 'fight' }, []);
    s.enemies[0].currentHp = 0;   // HP is already 0 when the damage event is processed
    s.ctrl.spawnFloatingTextsFromEvents([hit('enemy_0')]);
    s.poses.update(40);
    expect(s.poses.state(0)).toEqual({ pose: 'hurt', dx: 0, dy: 0 });
  });

  it('heals and zero-damage misses do not show the hurt pose', () => {
    const s = setup({ actorName: 'Hero', actionType: 'magic' }, []);
    s.ctrl.spawnFloatingTextsFromEvents([hit('enemy_0', 5, true), hit('enemy_1', 0)]);
    expect(s.poses.state(0).pose).toBe('idle');
    expect(s.poses.state(1).pose).toBe('idle');
  });

  it('normal play (no preview view): enemies resolve straight away, as before', () => {
    const { ctrl, tick } = setup({ actorName: 'Goblin A', actionType: 'fight' }, [hit('party_0')], 5, false);
    tick(31);
    expect(ctrl.animPhase).not.toBe('enemy_lunge');
  });

  it('a casting enemy plays the cast stance (no lunge) and the action waits for it to finish', () => {
    const { ctrl, poses, tick } = setup({ actorName: 'Goblin A', actionType: 'magic' }, [hit('party_0')]);
    tick(31);
    expect(ctrl.animPhase).toBe('enemy_lunge');
    expect(poses.state(0).pose).toBe('cast');
    expect(poses.state(0).dx).toBe(0);
    tick(60);
    expect(poses.state(0).pose).toBe('idle');
    expect(ctrl.animPhase).toBe('round_end');
  });
});
