/**
 * F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 items 4-5): an action resolves, its effect plays, and only at the effect's
 * impact frame is it presented. Every visual reads the presented snapshot, so a target never goes down, dazed or
 * fading before the hit lands.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { actionTargetIds, diffStatuses, statusSets } from '../../../src/scenes/battle/presentedState.js';
import type { ActionFx, StatusFx } from '../../../src/scenes/battle/fx/index.js';
import { StatusTracker, type StatusEffect } from '../../../src/battle/StatusEffects.js';
import { Character } from '../../../src/entities/Character.js';
import { Window } from '../../../src/ui/Window.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { ENEMY_WINDOW, STRIP_HEIGHT, STRIP_Y } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { createMockInput, testClass, testEnemy } from '../../helpers/testUtils.js';
import type { BattleStateMachine, DamageEvent, NextActionInfo } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';

afterEach(() => { vi.restoreAllMocks(); });

const IMPACT = 18;

type Outcome = 'kill_enemy' | 'ko_hero' | 'sleep_enemy';

/** A real display and controller over a scripted one-action battle (a FIRE that kills, or a SLEP that lands). */
function setup(outcome: Outcome, impact = IMPACT) {
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  const data = testEnemy();
  const enemies = [{ id: 'enemy_0', data, currentHp: 8, status: new StatusTracker(), displayName: 'Goblin' }];
  const party = [new Character({ name: 'BLM', classData: testClass('black_mage') })];
  const enemyActs = outcome === 'ko_hero';
  const info: NextActionInfo = enemyActs
    ? { actorId: 'enemy_0', actorName: 'Goblin', actionType: 'magic', targetId: 'party_0', targetName: 'BLM', spellId: 'fire', spellName: 'FIRE' }
    : { actorId: 'party_0', actorName: 'BLM', actionType: 'magic', targetId: 'enemy_0', targetName: 'Goblin',
      spellId: outcome === 'sleep_enemy' ? 'slep' : 'fire', spellName: outcome === 'sleep_enemy' ? 'SLEP' : 'FIRE' };
  let queued = 1;
  const battle = {
    allEnemies: enemies, allParty: party,
    get livingEnemies() { return enemies.filter((e) => e.currentHp > 0); },
    get livingParty() { return party.filter((c) => c.currentHp > 0); },
    isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? info : null),
    isNextActorAlive: () => true,
    nextActorLosesTurn: () => false,
    executeNextAction: () => {
      queued = 0;
      const events: DamageEvent[] = [];
      if (outcome === 'kill_enemy') {
        enemies[0].currentHp = 0;
        events.push({ targetId: 'enemy_0', damage: 8, isHeal: false, isCrit: false, spellElement: 'fire' });
      } else if (outcome === 'ko_hero') {
        party[0].currentHp = 0;
        events.push({ targetId: 'party_0', damage: 99, isHeal: false, isCrit: false, spellElement: 'fire' });
      } else {
        enemies[0].status.apply('sleep');
      }
      return { done: true, damageEvents: events, messages: [{ text: 'result' }], missed: false, spellId: info.spellId };
    },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const main = new Container();
  const win = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
  const display = new BattleDisplayManager(main, battle, { party, enemies: [data] }, win);
  display.createEnemySprites();
  display.createPartySprites();
  display.updatePartyDisplay();
  const ctrl = new BattleAnimationController(main, battle, display, createMockInput() as unknown as InputManager,
    win, new Container(), () => {}, vi.fn());
  const play = vi.fn((..._args: Parameters<ActionFx['play']>) => impact);
  const fx: ActionFx = { play, playCue: vi.fn() };
  const sync = vi.fn();
  const statusFx: StatusFx = { sync };
  ctrl.fx = fx;
  ctrl.statusFx = statusFx;
  /** One scene frame (the order BattleScene.update uses). */
  const frame = () => { display.update(1); ctrl.updateAnimating(1); ctrl.updateDyingEnemies(1); };
  /** Run until the action resolves; returns after the resolve frame (effect frame 0). */
  const toResolve = () => {
    for (let i = 0; i < 200; i++) {
      frame();
      if (play.mock.calls.length > 0) return;
    }
    throw new Error('the action never resolved');
  };
  return { ctrl, display, enemies, party, play, sync, frame, toResolve };
}

describe('the presented snapshot', () => {
  it('a lethal FIRE: the target stays idle and opaque (no dying entry) for effect frames 0-17, and fades from frame 18', () => {
    const s = setup('kill_enemy');
    s.toResolve();
    const sprite = s.display.enemySprites[0];
    for (let k = 0; k < IMPACT; k++) {
      if (k > 0) s.frame();
      expect(s.ctrl.dyingEnemies.has(0), `frame ${k}`).toBe(false);
      expect(sprite.alpha, `frame ${k}`).toBe(1);
      expect(['idle', 'idle_b'], `frame ${k}`).toContain(s.display.enemyView!.poses.state(0).pose);
      expect(s.display.presented.enemies[0].hp, `frame ${k}`).toBe(8);
    }
    s.frame();                                // effect frame 18: the impact
    expect(s.ctrl.dyingEnemies.has(0)).toBe(true);
    expect(sprite.alpha).toBeLessThan(1);
    expect(s.display.presented.enemies[0].hp).toBe(0);
  });

  it('a KO\'d party member goes down only at the impact frame', () => {
    const s = setup('ko_hero');
    s.toResolve();
    for (let k = 0; k < IMPACT; k++) {
      if (k > 0) s.frame();
      expect(s.display.partyPose(0), `frame ${k}`).not.toBe('down');
      expect(s.display.partySprites[0].alpha, `frame ${k}`).toBe(1);   // the placeholder's dimmed look waits too
    }
    s.frame();
    expect(s.display.partyPose(0)).toBe('down');
    expect(s.display.partySprites[0].alpha).toBeCloseTo(0.3);
  });

  it('a landed SLEP: the status diff reaches fx.play at resolve and statusFx.sync at the impact', () => {
    const s = setup('sleep_enemy');
    s.toResolve();
    const diff = [{ id: 'enemy_0', added: ['sleep'], removed: [] }];
    expect(s.play.mock.calls[0][2]).toMatchObject({ targetIds: ['enemy_0'], diff });
    expect(s.sync).not.toHaveBeenCalled();
    expect(s.display.presented.enemies[0].statuses).toEqual([]);
    for (let k = 1; k < IMPACT; k++) s.frame();
    expect(s.sync).not.toHaveBeenCalled();
    s.frame();
    expect(s.sync).toHaveBeenCalledWith(diff);
    expect(s.display.presented.enemies[0].statuses).toEqual(['sleep']);
  });

  it('with the F0 no-op fx (impact 0) the action presents on its resolve frame, as before', () => {
    const s = setup('kill_enemy', 0);
    s.toResolve();
    expect(s.ctrl.dyingEnemies.has(0)).toBe(true);
    expect(s.ctrl.animPhase).toBe('result');
  });
});

describe('target set and status diff (pure)', () => {
  const battle = { allParty: [{ currentHp: 5 }, { currentHp: 0 }, { currentHp: 3 }], allEnemies: [{ currentHp: 0 }, { currentHp: 4 }, { currentHp: 2 }] };
  const info = (o: Partial<NextActionInfo>): NextActionInfo => ({ actorId: 'party_0', actorName: 'A', actionType: 'magic', ...o });

  it('targetId when set; all spells take the living other side, all_allies the living own side, in battle order', () => {
    expect(actionTargetIds(info({ targetId: 'enemy_2' }), battle)).toEqual(['enemy_2']);
    expect(actionTargetIds(info({ allTargets: true }), battle)).toEqual(['enemy_1', 'enemy_2']);
    expect(actionTargetIds(info({}), battle, 'all')).toEqual(['enemy_1', 'enemy_2']);
    expect(actionTargetIds(info({}), battle, 'all_allies')).toEqual(['party_0', 'party_2']);
    expect(actionTargetIds(info({ actorId: 'enemy_1' }), battle, 'all')).toEqual(['party_0', 'party_2']);
    expect(actionTargetIds(info({ actorId: 'enemy_1' }), battle, 'all_allies')).toEqual(['enemy_1', 'enemy_2']);
    expect(actionTargetIds(info({}), battle, 'self')).toEqual(['party_0']);
  });

  it('the diff lists added (landed) and removed (cleansed) statuses per combatant, from the trackers only', () => {
    const tracker = (...s: StatusEffect[]) => { const t = new StatusTracker(); for (const e of s) t.apply(e); return t; };
    const party = [{ currentHp: 1, statusTracker: tracker('poison') }];
    const enemies = [{ currentHp: 1, status: tracker() }, { currentHp: 1, status: tracker('sleep') }];
    const before = statusSets({ allParty: party, allEnemies: enemies });
    party[0].statusTracker.remove('poison');
    enemies[0].status.apply('stun');
    expect(diffStatuses(before, statusSets({ allParty: party, allEnemies: enemies }))).toEqual([
      { id: 'party_0', added: [], removed: ['poison'] },
      { id: 'enemy_0', added: ['stun'], removed: [] },
    ]);
  });
});
