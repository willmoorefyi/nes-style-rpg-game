/**
 * BA-9 (docs/FIX_PLAN_PENINSULA.md T6e): the party melee advance reaches the target (every style, classic too), and
 * the floating number and the result line appear on the contact frame, never during the swing.
 */
import { describe, it, expect, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { ATTACK_STYLES, advanceFrames, attackReach, type AttackStyle } from '../../../src/scenes/battle/attackChoreography.js';
import { FLOAT_FONT, FLOAT_COLORS } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { OutlinedText } from '../../../src/ui/NESFont.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine, DamageEvent } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { Window } from '../../../src/ui/Window.js';

const HOME_X = 1380;
const ENEMY_X = 600;
const ENEMY_W = 160;

function box(x: number, y: number, w: number, h: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, w, h).fill(0xff0000);
  g.position.set(x, y);
  return g;
}

function setup(style: AttackStyle, messages: string[], events: DamageEvent[], enemyX = ENEMY_X, missed = false) {
  const main = new Container();
  const hero = box(HOME_X, 300, 160, 160);
  const goblins = [box(enemyX, 300, ENEMY_W, ENEMY_W), box(enemyX - 200, 300, ENEMY_W, ENEMY_W)];
  main.addChild(hero, ...goblins);
  const display = {
    enemySprites: goblins, partySprites: [hero], enemyView: null,
    setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(),
    updatePartySprites: vi.fn(),
  } as unknown as BattleDisplayManager;
  const enemies = [{ displayName: 'Goblin A', currentHp: 10 }, { displayName: 'Goblin B', currentHp: 10 }];
  let queued = 1;
  const battle = {
    allEnemies: enemies,
    allParty: [{ name: 'Hero', currentHp: 30 }],
    get livingEnemies() { return enemies.filter(e => e.currentHp > 0); },
    livingParty: [{}],
    isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? { actorId: 'party_0', actorName: 'Hero', actionType: 'fight', targetName: 'Goblin A' } : null),
    isNextActorAlive: () => true,
    executeNextAction: () => { queued = 0; return { done: true, damageEvents: events, messages: messages.map(text => ({ text })), missed }; },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const input = { isJustPressed: () => false } as unknown as InputManager;
  const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
  const lines: string[] = [];
  const ctrl = new BattleAnimationController(main, battle, display, input, win, new Container(), t => lines.push(t), vi.fn());
  ctrl.attackOverride = style;
  return { ctrl, hero, main, lines };
}

/** The frame index (0-based) on which the advance reaches contact: 30 announce frames, then the advance. */
const contactFrame = (style: AttackStyle) => 29 + advanceFrames(style);
const REACH = attackReach(HOME_X, ENEMY_X + ENEMY_W);

const floats = (main: Container) => main.children.filter((c): c is OutlinedText => c instanceof OutlinedText);

/** Run frames until the advance reaches contact; returns per-frame snapshots. */
function runToContact(s: ReturnType<typeof setup>, style: AttackStyle) {
  const frames: { phase: string; x: number; lines: number; floats: number }[] = [];
  for (let i = 0; i < 31 + advanceFrames(style) + 3; i++) {
    s.ctrl.updateAnimating(1);
    frames.push({ phase: s.ctrl.animPhase, x: s.hero.x, lines: s.lines.length, floats: floats(s.main).length });
  }
  return frames;
}

describe('BA-9: the lunge reaches the target', () => {
  it('every style, classic included, advances to the target\'s right edge', () => {
    const reach = attackReach(HOME_X, ENEMY_X + ENEMY_W);
    expect(reach).toBeGreaterThan(400); // the old fixed reach (150) stopped about 400 px short
    for (const style of ATTACK_STYLES) {
      const s = setup(style, ['Hero hits Goblin A for 5!'], [{ targetId: 'enemy_0', damage: 5, isHeal: false, isCrit: false }]);
      const frames = runToContact(s, style);
      expect(s.ctrl.attackReachPx, style).toBe(reach);
      expect(frames[contactFrame(style)].x, style).toBeCloseTo(HOME_X - reach);
    }
  });

  it('a far target clamps the reach at 900 px', () => {
    const s = setup('dash', ['Hero missed!'], [], 100, true);
    runToContact(s, 'dash');
    expect(s.ctrl.attackReachPx).toBe(900);
  });
});

describe('BA-9: the result shows on contact, not during the swing', () => {
  for (const style of ATTACK_STYLES) {
    it(`${style}: "missed!" and the grey Miss appear on the contact frame`, () => {
      const s = setup(style, ['Hero missed!'], [], ENEMY_X, true);
      const frames = runToContact(s, style);
      const contact = contactFrame(style);
      expect(frames[contact].x).toBeCloseTo(HOME_X - REACH);
      const announce = frames[0].lines; // the announcement line
      for (let i = 0; i < contact; i++) {
        expect(frames[i].lines, `frame ${i}`).toBe(announce);
        expect(frames[i].floats, `frame ${i}`).toBe(0);
      }
      expect(frames[contact].lines).toBe(announce + 1);
      expect(s.lines[announce]).toBe('Hero missed!');
      expect(frames[contact].floats).toBe(1);
      const miss = floats(s.main)[0];
      expect(miss.text).toBe('Miss');
      expect(miss.main.style.fill).toBe(FLOAT_COLORS.miss);
    });
  }

  it('the grey Miss follows the action result\'s missed flag, not the wording of the line', () => {
    const flagged = setup('lunge', ['Hero swings at thin air.'], [], ENEMY_X, true);
    runToContact(flagged, 'lunge');
    expect(floats(flagged.main).map(f => f.text)).toEqual(['Miss']);
    const worded = setup('lunge', ['Hero missed!'], [], ENEMY_X, false);
    runToContact(worded, 'lunge');
    expect(floats(worded.main)).toHaveLength(0);
  });

  it('a hit shows a 48 px outlined number on the contact frame', () => {
    const s = setup('lunge', ['Hero hits Goblin A for 7!'], [{ targetId: 'enemy_0', damage: 7, isHeal: false, isCrit: false }]);
    const frames = runToContact(s, 'lunge');
    const contact = frames.findIndex(f => f.floats > 0);
    expect(contact).toBe(contactFrame('lunge'));
    expect(frames[contact].x).toBeCloseTo(HOME_X - REACH);
    const num = floats(s.main)[0];
    expect(num.text).toBe('7');
    expect(num.fontSize).toBeGreaterThanOrEqual(48);
    expect(FLOAT_FONT).toBeGreaterThanOrEqual(48);
    expect(num.shadows.length).toBeGreaterThan(0);
  });
});
