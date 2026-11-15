/**
 * Pass F item 6 (docs/FEEDBACK_PLAN_2026-11-14.md §3.6): battle pacing at the message speeds. Frames from one action's
 * announcement to the next, on the animation controller with a mocked battle (dt = 1, fixed attack style).
 * Old timing: a party Fight took 95 frames and an enemy melee hit about 70, at every speed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { EnemyPoseController } from '../../../src/scenes/battle/EnemyPoseController.js';
import { ACTION_BEAT_FRAMES, RESULT_FRAMES, SKIP_GUARD_FRAMES, holdFrames } from '../../../src/scenes/battle/battleTiming.js';
import { resetSettingsCache, setMessageSpeed, type MessageSpeed } from '../../../src/core/Settings.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine, DamageEvent } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { Window } from '../../../src/ui/Window.js';

type Action = { actorId: string; actorName: string; actionType: string; targetId?: string; targetName?: string };

const HERO_FIGHTS: Action = { actorId: 'party_0', actorName: 'Hero', actionType: 'fight', targetId: 'enemy_0', targetName: 'Goblin' };
const GOBLIN_FIGHTS: Action = { actorId: 'enemy_0', actorName: 'Goblin', actionType: 'fight', targetId: 'party_0', targetName: 'Hero' };

function box(x: number, y: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, 160, 160).fill(0xff0000);
  g.position.set(x, y);
  return g;
}

/** Two queued actions (the measured one, then a second announcement); `lines` result lines per action. */
function setup(action: Action, lines = 1) {
  const main = new Container();
  const hero = box(1380, 300);
  const goblin = box(600, 300);
  main.addChild(hero, goblin);
  const poses = new EnemyPoseController(1);
  const display = {
    enemySprites: [goblin], partySprites: [hero],
    enemyView: { poses, playAttack: (i: number) => poses.playAttack(i) },
    setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(), updatePartySprites: vi.fn(),
  } as unknown as BattleDisplayManager;
  const enemies = [{ displayName: 'Goblin', currentHp: 30 }];
  let queued = 2;
  const battle = {
    allEnemies: enemies, allParty: [{ name: 'Hero', currentHp: 30 }],
    get livingEnemies() { return enemies; },
    livingParty: [{}], isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? action : null),
    isNextActorAlive: () => true, nextActorLosesTurn: () => false,
    executeNextAction: () => {
      queued--;
      const target = action.targetId!;
      const events: DamageEvent[] = [{ targetId: target, damage: 4, isHeal: false, isCrit: false } as DamageEvent];
      const messages = Array.from({ length: lines }, (_, k) => ({ text: `line ${k + 1}` }));
      return { done: true, damageEvents: events, messages, missed: false };
    },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  let pressed = false;
  const input = { isJustPressed: (a: string) => a === 'confirm' && pressed } as unknown as InputManager;
  const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
  const shown: { text: string; frame: number }[] = [];
  let frame = 0;
  const ctrl = new BattleAnimationController(main, battle, display, input, win, new Container(),
    (text) => shown.push({ text, frame }), vi.fn());
  ctrl.attackOverride = 'lunge';
  const tick = (press = false) => { pressed = press; frame++; poses.update(1); ctrl.updateAnimating(1); pressed = false; };
  return { ctrl, shown, tick, frame: () => frame };
}

/** Frames from the first announcement to the second (the turn length). */
function turnFrames(action: Action, lines = 1): number {
  const s = setup(action, lines);
  for (let i = 0; i < 1000; i++) {
    s.tick();
    const announces = s.shown.filter((l) => !l.text.startsWith('line '));
    if (announces.length >= 2) return announces[1].frame - announces[0].frame;
  }
  throw new Error('no second announcement');
}

const atSpeed = (speed: MessageSpeed) => { setMessageSpeed(speed); };

beforeEach(() => { resetSettingsCache(); vi.stubGlobal('localStorage', undefined); });
afterEach(() => { vi.unstubAllGlobals(); resetSettingsCache(); });

describe('battle pacing at message speed 3 (the default)', () => {
  it('the default speed is 3', async () => {
    const { getSettings } = await import('../../../src/core/Settings.js');
    expect(getSettings().messageSpeed).toBe(3);
  });

  it('a party Fight with one result line takes 150-175 frames, announce to announce (old: 95)', () => {
    atSpeed(3);
    const n = turnFrames(HERO_FIGHTS);
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(175);
  });

  it('an enemy melee hit (in place, before Fc\'s travel) takes 130-180 frames (old: about 70)', () => {
    atSpeed(3);
    const n = turnFrames(GOBLIN_FIGHTS);
    // 45 announce + 14 to contact + 60 result + 15 beat; Fc's travel (N = 10-24) moves it into the plan's 140-180
    expect(n).toBeGreaterThanOrEqual(130);
    expect(n).toBeLessThanOrEqual(180);
  });

  it('each extra result line adds 60 +- 2 frames', () => {
    atSpeed(3);
    for (const action of [HERO_FIGHTS, GOBLIN_FIGHTS]) {
      const extra = turnFrames(action, 2) - turnFrames(action, 1);
      expect(Math.abs(extra - 60), action.actorId).toBeLessThanOrEqual(2);
    }
  });

  it('after an action a still beat (15 frames at speed 3) comes before the next announcement', () => {
    atSpeed(3);
    expect(holdFrames(ACTION_BEAT_FRAMES)).toBe(15);
    const s = setup(HERO_FIGHTS);
    let beatFrames = 0;
    for (let i = 0; i < 400 && s.shown.filter((l) => !l.text.startsWith('line ')).length < 2; i++) {
      s.tick();
      if (s.ctrl.animPhase === 'beat') beatFrames++;
    }
    expect(beatFrames).toBeGreaterThanOrEqual(14);
    expect(beatFrames).toBeLessThanOrEqual(15);
  });
});

describe('the other speeds scale the text holds only', () => {
  it('speed 5: a party Fight takes <= 112 % of the old 95 frames (<= 106)', () => {
    atSpeed(5);
    expect(turnFrames(HERO_FIGHTS)).toBeLessThanOrEqual(106);
  });

  it('speed 1 is the slowest and 5 the fastest; every speed is monotone', () => {
    const lengths = ([1, 2, 3, 4, 5] as MessageSpeed[]).map((v) => { atSpeed(v); return turnFrames(HERO_FIGHTS); });
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeLessThan(lengths[i - 1]);
    // the animation part (24 advance + 16 return) is the same at every speed: only holds change
    atSpeed(1);
    expect(lengths[0]).toBeGreaterThan(220);
  });
});

describe('confirm skips one hold per press', () => {
  it('one press ends the current result line within 1 frame', () => {
    atSpeed(1);
    const s = setup(HERO_FIGHTS, 2);
    while (!s.shown.some((l) => l.text === 'line 1')) s.tick();
    s.tick(); s.tick();
    expect(s.shown.some((l) => l.text === 'line 2')).toBe(false);
    s.tick(true);
    s.tick();
    expect(s.shown.some((l) => l.text === 'line 2')).toBe(true);
  });

  it('two presses on consecutive frames skip one line, not two', () => {
    atSpeed(1);
    const s = setup(HERO_FIGHTS, 3);
    while (!s.shown.some((l) => l.text === 'line 1')) s.tick();
    for (let i = 0; i < SKIP_GUARD_FRAMES; i++) s.tick();
    s.tick(true);
    s.tick(true);
    for (let i = 0; i < 3; i++) s.tick();
    expect(s.shown.some((l) => l.text === 'line 2')).toBe(true);
    expect(s.shown.some((l) => l.text === 'line 3')).toBe(false);
    // a press after the guard skips the next line
    for (let i = 0; i < SKIP_GUARD_FRAMES; i++) s.tick();
    s.tick(true);
    s.tick();
    expect(s.shown.some((l) => l.text === 'line 3')).toBe(true);
    expect(holdFrames(RESULT_FRAMES)).toBe(96);
  });
});
