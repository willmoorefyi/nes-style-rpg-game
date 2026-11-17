import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container, Sprite } from 'pixi.js';
import { BattleAnimationController, ANNOUNCE_FRAMES, ROUND_END_FRAMES } from '../../../src/scenes/battle/BattleAnimationController.js';
import { EnemyPoseController, ATTACK_FRAMES, ATTACK_OUT, CAST_FRAMES, PLAIN_CAST_FRAMES } from '../../../src/scenes/battle/EnemyPoseController.js';
import { holdFrames } from '../../../src/scenes/battle/battleTiming.js';
import { travelFrames } from '../../../src/scenes/battle/enemyAttackTables.js';
import type { AttackPlan } from '../../../src/scenes/battle/EnemyPoseController.js';
import { setMessageSpeed } from '../../../src/core/Settings.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine, DamageEvent } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { Window } from '../../../src/ui/Window.js';

type Action = { actorId: string; actorName: string; actionType: string; targetName?: string };

// F0: every tick count is an expression of the timing constants, at today's message speed (5), so the holds can change
// without editing this file.
beforeEach(() => { setMessageSpeed(5); });
const ANNOUNCE = () => holdFrames(ANNOUNCE_FRAMES);
const ROUND_END = () => holdFrames(ROUND_END_FRAMES);

function setup(action: Action, events: DamageEvent[], enemyHpAfter = 5, preview = true, partySize = 1, plan?: AttackPlan) {
  const enemySprites: Container[] = [new Sprite(), new Sprite()];
  const partySprites: Container[] = Array.from({ length: partySize }, () => new Sprite());
  const poses = new EnemyPoseController(2);
  const display = {
    enemySprites, partySprites,
    enemyView: preview ? { poses, playAttack: (i: number) => poses.playAttack(i, plan) } : null,
    setActorPose: vi.fn(), isRising: () => false, flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(),
    updatePartySprites: vi.fn(),
  } as unknown as BattleDisplayManager;
  const enemies = [{ displayName: 'Goblin A', currentHp: 10 }, { displayName: 'Goblin B', currentHp: 10 }];
  let queued = 1;
  let executed = 0;
  const battle = {
    allEnemies: enemies,
    get livingEnemies() { return enemies.filter((e) => e.currentHp > 0); },
    livingParty: [{}],
    isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? action : null),
    isNextActorAlive: () => true,
    nextActorLosesTurn: vi.fn(() => false),
    executeNextAction: () => {
      executed++;
      queued = 0;
      for (const e of events) if (e.targetId.startsWith('enemy_')) enemies[Number(e.targetId.split('_')[1])].currentHp = enemyHpAfter;
      return { done: true, damageEvents: events, messages: [], missed: false };
    },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const input = { isJustPressed: () => false } as unknown as InputManager;
  const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
  const onResolveRound = vi.fn();
  const ctrl = new BattleAnimationController(new Container(), battle, display, input, win, new Container(),
    () => {}, onResolveRound);
  /** One scene frame: the scene ticks display (poses) and the animation controller. */
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { poses.update(1); ctrl.updateAnimating(1); } };
  return { ctrl, poses, tick, enemies, partySprites, enemySprites, onResolveRound, battle, executed: () => executed };
}

/** Idle breathes (idle / idle_b) once a sequence is over. */
const RESTING = ['idle', 'idle_b'];

const hit = (targetId: string, damage = 3, isHeal = false): DamageEvent =>
  ({ targetId, damage, isHeal, isCrit: false } as unknown as DamageEvent);

describe('monster poses in the battle flow (preview art)', () => {
  it('an attacking enemy winds up and lunges; the action resolves on the contact frame (t = 14), not before', () => {
    const { ctrl, poses, tick } = setup({ actorId: 'enemy_0', actorName: 'Goblin A', actionType: 'fight', targetName: 'Hero' }, [hit('party_0')]);
    tick(ANNOUNCE());                 // announce; the lunge starts on its last frame
    expect(ctrl.animPhase).toBe('enemy_lunge');
    expect(poses.state(0)).toMatchObject({ pose: 'atk_wind1', dx: 0 });
    tick(ATTACK_OUT - 1);
    expect(ctrl.animPhase).toBe('enemy_lunge');      // still winding up / passing
    expect(poses.state(0).pose).toBe('atk_mid');
    tick(1);                          // contact: execute + result on this frame
    expect(poses.state(0).pose).toBe('attack');
    expect(['result', 'round_end']).toContain(ctrl.animPhase);
    tick(ATTACK_FRAMES - ATTACK_OUT + ROUND_END());
    expect(RESTING).toContain(poses.state(0).pose);
    expect(ctrl.animPhase).toBe('round_end');
  });

  it('a hit on an enemy shows the hurt pose, then idles', () => {
    const s = setup({ actorId: 'party_0', actorName: 'Hero', actionType: 'fight', targetName: 'Goblin B' }, []);
    s.ctrl.spawnFloatingTextsFromEvents([hit('enemy_1')]);
    expect(s.poses.state(1).pose).toBe('hurt_in1');
    s.poses.update(4);
    expect(s.poses.state(1).pose).toBe('hurt');
    s.poses.update(16);
    expect(RESTING).toContain(s.poses.state(1).pose);
  });

  it('a lethal hit plays the in-phase, then holds the hurt pose with no shake while the sprite fades', () => {
    const s = setup({ actorId: 'party_0', actorName: 'Hero', actionType: 'fight' }, []);
    s.enemies[0].currentHp = 0;   // HP is already 0 when the damage event is processed
    s.ctrl.spawnFloatingTextsFromEvents([hit('enemy_0')]);
    expect(s.poses.state(0).pose).toBe('hurt_in1');
    s.poses.update(40);
    expect(s.poses.state(0)).toEqual({ pose: 'hurt', dx: -6, dy: 0 });
  });

  it('heals and zero-damage misses do not show the hurt pose', () => {
    const s = setup({ actorId: 'party_0', actorName: 'Hero', actionType: 'magic' }, []);
    s.ctrl.spawnFloatingTextsFromEvents([hit('enemy_0', 5, true), hit('enemy_1', 0)]);
    expect(s.poses.state(0).pose).toBe('idle');
    expect(s.poses.state(1).pose).toBe('idle');
  });

  it('E1: a sleeping enemy does not wind up or lunge on its lost turn (play-test item 3: nor is it announced)', () => {
    for (const actionType of ['fight', 'magic']) {
      const s = setup({ actorId: 'enemy_0', actorName: 'Goblin A', actionType }, []);
      vi.mocked(s.battle.nextActorLosesTurn).mockReturnValue(true);
      s.tick(1);                        // no announcement hold: straight to the tick line
      expect(s.ctrl.animPhase).toBe('execute');
      expect(s.poses.isAttacking(0)).toBe(false);
      expect(s.poses.state(0)).toMatchObject({ pose: 'idle', dx: 0, dy: 0 });
      expect(s.executed()).toBe(0);
      s.tick(1);                        // executeNextAction runs on the next tick
      expect(s.executed()).toBe(1);
      s.tick(ROUND_END());
      expect(s.poses.state(0)).toMatchObject({ dx: 0, dy: 0 });
      expect(s.ctrl.animPhase).toBe('round_end');
    }
  });

  it('normal play (no preview view): enemies resolve straight away, as before', () => {
    const { ctrl, tick } = setup({ actorId: 'enemy_0', actorName: 'Goblin A', actionType: 'fight' }, [hit('party_0')], 5, false);
    tick(ANNOUNCE() + 1);
    expect(ctrl.animPhase).not.toBe('enemy_lunge');
  });

  it('a non-boss magic action plays the attack frames without the lunge (D4) and the action waits for it', () => {
    const { ctrl, poses, tick } = setup({ actorId: 'enemy_0', actorName: 'Goblin A', actionType: 'magic' }, [hit('party_0')]);
    tick(ANNOUNCE() + 1);
    expect(ctrl.animPhase).toBe('enemy_lunge');
    expect(poses.state(0).pose).toBe('atk_wind1');
    for (let k = 0; k < PLAIN_CAST_FRAMES; k++) { expect(poses.state(0).dx).toBe(0); tick(1); }
    expect(RESTING).toContain(poses.state(0).pose);
    tick(ROUND_END());
    expect(ctrl.animPhase).toBe('round_end');
  });

  it('a boss magic action plays gather / rise / cast; round_end waits for the 30-frame cast (or its hold)', () => {
    const s = setup({ actorId: 'party_0', actorName: 'Hero', actionType: 'fight' }, []);
    s.poses.configure(0, { hasCast: true });
    s.ctrl.animPhase = 'round_end';
    s.ctrl.animTimer = 0;
    s.poses.playCast(0);
    expect(s.poses.state(0).pose).toBe('cast_gather');
    s.tick(Math.max(CAST_FRAMES, ROUND_END()) - 1);
    expect(s.onResolveRound).not.toHaveBeenCalled();
    s.tick(1);
    expect(s.onResolveRound).toHaveBeenCalledTimes(1);
  });
});

describe('actor sprites are found by battle id, not by name (NG-3)', () => {
  it('two party members with the same name: the second one animates the second sprite', () => {
    const s = setup({ actorId: 'party_1', actorName: 'FGHTR', actionType: 'fight', targetName: 'Goblin A' }, [], 5, true, 2);
    s.tick(1);
    expect(s.ctrl.animActorSprite).toBe(s.partySprites[1]);
    expect(s.ctrl.animActorIsEnemy).toBe(false);
  });

  it('two enemies: the acting one is matched by its instance id', () => {
    const s = setup({ actorId: 'enemy_1', actorName: 'Goblin', actionType: 'fight', targetName: 'Hero' }, []);
    s.tick(1);
    expect(s.ctrl.animActorSprite).toBe(s.enemySprites[1]);
    expect(s.ctrl.animActorIsEnemy).toBe(true);
  });

  it('findActorSprite maps party_i and enemy_i and rejects unknown ids', () => {
    const s = setup({ actorId: 'party_0', actorName: 'Hero', actionType: 'fight' }, [], 5, true, 3);
    expect(s.ctrl.findActorSprite('party_2')?.sprite).toBe(s.partySprites[2]);
    expect(s.ctrl.findActorSprite('enemy_0')).toEqual({ sprite: s.enemySprites[0], isEnemy: true });
    expect(s.ctrl.findActorSprite('enemy_9')).toBeNull();
    expect(s.ctrl.findActorSprite('Hero')).toBeNull();
  });
});

describe('round end pacing (BA-2)', () => {
  it('a round resolves on its own after ROUND_END_FRAMES, with no input', () => {
    const s = setup({ actorId: 'party_0', actorName: 'Hero', actionType: 'fight', targetName: 'Goblin A' }, [hit('enemy_0')], 5, false);
    let frames = 0;
    while (s.ctrl.animPhase !== 'round_end' && frames < 500) { s.tick(); frames++; }
    expect(s.ctrl.animPhase).toBe('round_end');
    s.tick(ROUND_END() - 1);
    expect(s.onResolveRound).not.toHaveBeenCalled();
    s.tick(1);
    expect(s.onResolveRound).toHaveBeenCalledTimes(1);
  });

  it('round_end waits for an attacking enemy pose to finish (31 frames)', () => {
    const s = setup({ actorId: 'party_0', actorName: 'Hero', actionType: 'fight' }, []);
    s.ctrl.animPhase = 'round_end';
    s.ctrl.animTimer = 0;
    s.tick(ROUND_END() - 1);
    s.poses.playAttack(1);           // a lunge starts just before the timer runs out
    s.tick(5);
    expect(s.onResolveRound).not.toHaveBeenCalled();
    s.tick(ATTACK_FRAMES);
    expect(s.onResolveRound).toHaveBeenCalledTimes(1);
  });

  it('round_end waits while an enemy is still fading out', () => {
    const s = setup({ actorId: 'party_0', actorName: 'Hero', actionType: 'fight' }, []);
    s.ctrl.animPhase = 'round_end';
    s.ctrl.animTimer = 0;
    s.ctrl.dyingEnemies.set(0, 30);
    s.tick(ROUND_END() + 5);
    expect(s.onResolveRound).not.toHaveBeenCalled();
    s.ctrl.dyingEnemies.clear();
    s.tick(1);
    expect(s.onResolveRound).toHaveBeenCalledTimes(1);
  });
});

describe('travelling enemy attacks in the battle flow (pass F items 3 and 7)', () => {
  const FIGHT: Action = { actorId: 'enemy_0', actorName: 'Goblin A', actionType: 'fight', targetName: 'Hero' };
  const N = travelFrames(600);

  it('a melee enemy travelling 600 px resolves on frame 14 + N, and round_end waits for its 47 + N frames', () => {
    const s = setup(FIGHT, [hit('party_0')], 5, true, 1, { travel: 600, rise: 100 });
    s.tick(ANNOUNCE());
    expect(s.ctrl.animPhase).toBe('enemy_lunge');
    s.tick(14 + N - 1);
    expect(s.executed()).toBe(0);
    expect(s.poses.state(0).travelDx).toBeGreaterThan(0);
    s.tick(1);
    expect(s.executed()).toBe(1);
    expect(s.poses.state(0)).toMatchObject({ pose: 'attack', travelDx: 600, travelDy: 100 });
    let frames = 14 + N;
    while (s.poses.isAttacking(0) && frames < 400) { s.tick(1); frames++; }
    expect(frames).toBe(47 + N);
    s.tick(ROUND_END());
    expect(s.onResolveRound).toHaveBeenCalledTimes(1);
  });

  it('a heavy (Garland) attack resolves at N + 29 and the round waits for N + 69', () => {
    const s = setup({ ...FIGHT, actorName: 'Garland' }, [hit('party_0')], 5, true, 1, { travel: 600, rise: -50 });
    s.poses.configure(0, { heavy: true });
    s.tick(ANNOUNCE());
    s.tick(N + 28);
    expect(s.executed()).toBe(0);
    expect(s.poses.state(0).pose).toBe('atk_mid');
    s.tick(1);
    expect(s.executed()).toBe(1);
    let frames = N + 29;
    while (s.poses.isAttacking(0) && frames < 400) { s.tick(1); frames++; }
    expect(frames).toBe(N + 69);
  });

  it('E1: a helpless enemy (sleep, stun, stone) never starts its travel', () => {
    const s = setup(FIGHT, [], 5, true, 1, { travel: 600, rise: 0 });
    vi.mocked(s.battle.nextActorLosesTurn).mockReturnValue(true);
    s.tick(1);
    expect(s.ctrl.animPhase).toBe('execute');
    expect(s.poses.isAttacking(0)).toBe(false);
    for (let k = 0; k < 60; k++) { expect(s.poses.state(0).travelDx).toBeUndefined(); s.tick(1); }
  });
});
