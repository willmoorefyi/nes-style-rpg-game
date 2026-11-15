/**
 * BA-9 (docs/FIX_PLAN_PENINSULA.md T6e): the party melee advance reaches the target (every style, classic too), and
 * the floating number and the result line appear on the contact frame, never during the swing.
 */
import { describe, it, expect, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { ATTACK_STYLES, advanceFrames, attackReach, type AttackStyle } from '../../../src/scenes/battle/attackChoreography.js';
import { FLOAT_FONT, FLOAT_COLORS } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { computeEnemyLayoutAi } from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { PARTY_X, PARTY_FEET_Y } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { OutlinedText } from '../../../src/ui/NESFont.js';
import { readFileSync } from 'node:fs';
import { readRgbaPng, opaqueBounds } from '../../helpers/pngAlpha.js';
import { floatsIn } from '../../helpers/battleLayers.js';
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

interface Peek { actorId: string; actorName: string; actionType: string; targetId?: string; targetName?: string }
const HERO_FIGHTS_A: Peek = { actorId: 'party_0', actorName: 'Hero', actionType: 'fight', targetId: 'enemy_0', targetName: 'Goblin A' };

function setup(style: AttackStyle, messages: string[], events: DamageEvent[], enemyX = ENEMY_X, missed = false, peek: Peek = HERO_FIGHTS_A) {
  const main = new Container();
  const hero = box(HOME_X, 300, 160, 160);
  const hero2 = box(HOME_X + 45, 420, 160, 160);
  const goblins = [box(enemyX, 300, ENEMY_W, ENEMY_W), box(enemyX - 200, 300, ENEMY_W, ENEMY_W)];
  main.addChild(hero, hero2, ...goblins);
  const display = {
    enemySprites: goblins, partySprites: [hero, hero2], enemyView: null,
    setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(),
    updatePartySprites: vi.fn(),
  } as unknown as BattleDisplayManager;
  const enemies = [{ displayName: 'Goblin A', currentHp: 10 }, { displayName: 'Goblin B', currentHp: 10 }];
  let queued = 1;
  const battle = {
    allEnemies: enemies,
    allParty: [{ name: 'Hero', currentHp: 30 }, { name: 'Hero', currentHp: 30 }],
    get livingEnemies() { return enemies.filter(e => e.currentHp > 0); },
    livingParty: [{}],
    isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? peek : null),
    isNextActorAlive: () => true, nextActorLosesTurn: vi.fn(() => false),
    executeNextAction: () => { queued = 0; return { done: true, damageEvents: events, messages: messages.map(text => ({ text })), missed }; },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const input = { isJustPressed: () => false } as unknown as InputManager;
  const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
  const lines: string[] = [];
  const sounds: string[] = [];
  const ctrl = new BattleAnimationController(main, battle, display, input, win, new Container(), t => lines.push(t), vi.fn(),
    e => sounds.push(e));
  ctrl.attackOverride = style;
  return { ctrl, hero, hero2, goblins, display, main, lines, sounds };
}

/** The frame index (0-based) on which the advance reaches contact: 30 announce frames, then the advance. */
const contactFrame = (style: AttackStyle) => 29 + advanceFrames(style);
const REACH = attackReach(HOME_X, ENEMY_X + ENEMY_W);

/** F0: the numbers are in the layers' `fx.numbers`, inside `main`. */
const floats = (main: Container): OutlinedText[] => floatsIn(main);

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

describe('B2 / B6: the target sprite comes from the target id, never the name', () => {
  it('a peek with targetId enemy_1 puts the reach and the Miss on enemySprites[1] (the stale name says Goblin A)', () => {
    const peek = { ...HERO_FIGHTS_A, targetId: 'enemy_1' };
    const s = setup('lunge', ['Hero missed!'], [], ENEMY_X, true, peek);
    runToContact(s, 'lunge');
    expect(s.ctrl.attackReachPx).toBe(attackReach(HOME_X, ENEMY_X - 200 + ENEMY_W));
    const miss = floats(s.main)[0];
    expect(miss.text).toBe('Miss');
    const b = s.goblins[1].getBounds();
    expect(miss.x).toBeGreaterThanOrEqual(b.x - 1);
    expect(miss.x).toBeLessThanOrEqual(b.x + b.width + 1);
  });

  it('two heroes named alike: a wolf missing party_1 shows the Miss over partySprites[1] (old: index 0)', () => {
    const peek = { actorId: 'enemy_0', actorName: 'Goblin A', actionType: 'fight', targetId: 'party_1', targetName: 'Hero' };
    const s = setup('lunge', ['Goblin A missed!'], [], ENEMY_X, true, peek);
    for (let i = 0; i < 40; i++) s.ctrl.updateAnimating(1);
    const miss = floats(s.main)[0];
    expect(miss.text).toBe('Miss');
    const b = s.hero2.getBounds();
    expect(miss.x).toBeGreaterThanOrEqual(b.x - 1);
    expect(miss.x).toBeLessThanOrEqual(b.x + b.width + 1);
  });

  it('a hit on party_1 flashes partySprites[1]', () => {
    const peek = { actorId: 'enemy_0', actorName: 'Goblin A', actionType: 'fight', targetId: 'party_1', targetName: 'Hero' };
    const s = setup('lunge', ['Goblin A hits Hero for 4!'], [{ targetId: 'party_1', damage: 4, isHeal: false, isCrit: false }], ENEMY_X, false, peek);
    for (let i = 0; i < 40; i++) s.ctrl.updateAnimating(1);
    expect(s.display.flashHurt).toHaveBeenCalledWith(1);
  });
});

describe('I3: hit and miss sounds on the contact frame', () => {
  it('a hit emits battleHit once, on contact', () => {
    const s = setup('lunge', ['Hero hits Goblin A for 7!'], [{ targetId: 'enemy_0', damage: 7, isHeal: false, isCrit: false }]);
    for (let i = 0; i < contactFrame('lunge'); i++) s.ctrl.updateAnimating(1);
    expect(s.sounds).toEqual([]);
    s.ctrl.updateAnimating(1);
    for (let i = 0; i < 60; i++) s.ctrl.updateAnimating(1);
    expect(s.sounds).toEqual(['battleHit']);
  });

  it('a miss emits battleMiss once', () => {
    const s = setup('lunge', ['Hero missed!'], [], ENEMY_X, true);
    for (let i = 0; i < 100; i++) s.ctrl.updateAnimating(1);
    expect(s.sounds).toEqual(['battleMiss']);
  });
});

interface MonsterAtlas { scale: number; sheets: Record<string, { cell: [number, number]; frames: Record<string, [number, number]> }> }
interface HeroAtlas { scale: number; cell: [number, number]; poses: string[]; sheets: Record<string, { row: number }> }

function monsterRightInset(ids: string[]): number {
  const meta = JSON.parse(readFileSync('assets/sprites/monsters-ai.json', 'utf8')) as MonsterAtlas;
  const img = readRgbaPng('assets/sprites/monsters-ai.png');
  return Math.max(...ids.map((id) => {
    const sheet = meta.sheets[id];
    const [fx, fy] = sheet.frames.idle;
    const [w, h] = sheet.cell.map(v => v * meta.scale);
    const bounds = opaqueBounds(img, fx * meta.scale, fy * meta.scale, w, h);
    if (!bounds) throw new Error(`monsters-ai: ${id} idle frame is empty`);
    return w - bounds[2];
  }));
}

function heroAttackLeftInset(): number {
  const meta = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as HeroAtlas;
  const img = readRgbaPng('assets/sprites/battle-characters-ai.png');
  const [w, h] = meta.cell.map(v => v * meta.scale);
  const col = meta.poses.indexOf('attack');
  return Math.max(...Object.entries(meta.sheets).map(([id, sheet]) => {
    const bounds = opaqueBounds(img, col * w, sheet.row * h, w, h);
    if (!bounds) throw new Error(`battle-characters-ai: ${id} attack frame is empty`);
    return bounds[0];
  }));
}

describe('B11: the lunge reaches a back-column target on the real layout', () => {
  // Opaque edges measured on the committed art at test time (assets/sprites/*-ai.{png,json}, screen px inside the 2x
  // cells): how far the goblin / Gr.Imp idle frames end inside their cell (worst of the two), and how far into its cell
  // the classic swing's 'attack' pose starts (worst over every class).
  const MONSTER_OPAQUE_RIGHT_INSET = monsterRightInset(['gr_imp', 'goblin']);
  const HERO_OPAQUE_LEFT_INSET = heroAttackLeftInset();

  it('the measured insets are real (inside the cell, not empty art)', () => {
    expect(MONSTER_OPAQUE_RIGHT_INSET).toBeGreaterThanOrEqual(0);
    expect(MONSTER_OPAQUE_RIGHT_INSET).toBeLessThan(80);
    expect(HERO_OPAQUE_LEFT_INSET).toBeGreaterThanOrEqual(0);
    expect(HERO_OPAQUE_LEFT_INSET).toBeLessThan(80);
  });

  it('THIEF (slot 1) attacking the back-column Gr.Imp B ends with its art within 40 px of the target\'s art', () => {
    const layout = computeEnemyLayoutAi([
      { size: 'small', w: 160, h: 160 }, { size: 'small', w: 160, h: 160 }, // Gr.Imp A, B
      { size: 'small', w: 160, h: 160 }, { size: 'small', w: 160, h: 160 }, // Goblin A, B
    ]);
    // the enemies' boxes in screen px; the leftmost column is the back row (furthest from the party). The target is
    // the back column's middle enemy; a stale name that matches a front-column enemy must not move the reach there.
    const minX = Math.min(...layout.map(b => b.x));
    const back = layout.findIndex((b, i) => i > 0 && b.x === minX);
    const front = layout.findIndex(b => b.x > minX);
    expect(back).toBeGreaterThan(0);
    expect(front).toBeGreaterThan(0);
    const main = new Container();
    const sprites = layout.map(b => box(b.x - b.w / 2, b.feetY - b.h, b.w, b.h));
    const thief = box(PARTY_X[1], 400, 160, 160);
    main.addChild(thief, ...sprites);
    let queued = 1;
    const display = {
      enemySprites: sprites, partySprites: [box(PARTY_X[0], 300, 160, 160), thief], enemyView: null,
      setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(), updatePartySprites: vi.fn(),
    } as unknown as BattleDisplayManager;
    const battle = {
      allEnemies: layout.map((_, i) => ({ displayName: i === front ? 'Gr.Imp B' : `E${i}`, currentHp: 10 })), allParty: [], livingParty: [{}], isOver: false,
      get livingEnemies() { return [{}]; },
      get actionQueueLength() { return queued; },
      peekNextAction: () => (queued > 0 ? { actorId: 'party_1', actorName: 'THIEF', actionType: 'fight', targetId: `enemy_${back}`, targetName: 'Gr.Imp B' } : null),
      isNextActorAlive: () => true, nextActorLosesTurn: vi.fn(() => false),
      executeNextAction: () => { queued = 0; return { done: true, damageEvents: [], messages: [{ text: 'THIEF missed!' }], missed: true }; },
      skipRemainingActions: vi.fn(),
    } as unknown as BattleStateMachine;
    const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
    const ctrl = new BattleAnimationController(main, battle, display, { isJustPressed: () => false } as unknown as InputManager,
      win, new Container(), () => {}, vi.fn());
    ctrl.attackOverride = 'classic';
    for (let i = 0; i < contactFrame('classic') + 1; i++) ctrl.updateAnimating(1);
    const target = layout[back];
    const targetArtRight = target.x + target.w / 2 - MONSTER_OPAQUE_RIGHT_INSET;
    const thiefArtLeft = thief.x + HERO_OPAQUE_LEFT_INSET;
    expect(Math.abs(thiefArtLeft - targetArtRight)).toBeLessThanOrEqual(40);
  });
});

describe('U3: the melee advance meets a top-row target on its own row', () => {
  const MONSTER_OPAQUE_RIGHT_INSET = monsterRightInset(['goblin']);
  const HERO_OPAQUE_LEFT_INSET = heroAttackLeftInset();
  const layout = computeEnemyLayoutAi(Array.from({ length: 6 }, () => ({ size: 'small' as const, w: 160, h: 160 })));
  const topFeet = Math.min(...layout.map(b => b.feetY));
  // the top-row goblin (the highest feet)
  const top = layout.findIndex(b => b.feetY === topFeet);

  function attack(slot: number, style: AttackStyle) {
    const main = new Container();
    const sprites = layout.map(b => box(b.x - b.w / 2, b.feetY - b.h, b.w, b.h));
    const party = PARTY_X.map((x, i) => box(x, PARTY_FEET_Y[i] - 160, 160, 160));
    main.addChild(...party, ...sprites);
    let queued = 1;
    const display = {
      enemySprites: sprites, partySprites: party, enemyView: null,
      setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(), updatePartySprites: vi.fn(),
    } as unknown as BattleDisplayManager;
    const battle = {
      allEnemies: layout.map((_, i) => ({ displayName: `Goblin ${i}`, currentHp: 10 })), allParty: [], livingParty: [{}], isOver: false,
      get livingEnemies() { return [{}]; },
      get actionQueueLength() { return queued; },
      peekNextAction: () => (queued > 0 ? { actorId: `party_${slot}`, actorName: 'HERO', actionType: 'fight', targetId: `enemy_${top}`, targetName: 'Goblin' } : null),
      isNextActorAlive: () => true, nextActorLosesTurn: vi.fn(() => false),
      executeNextAction: () => { queued = 0; return { done: true, damageEvents: [], messages: [{ text: 'HERO missed!' }], missed: true }; },
      skipRemainingActions: vi.fn(),
    } as unknown as BattleStateMachine;
    const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
    const ctrl = new BattleAnimationController(main, battle, display, { isJustPressed: () => false } as unknown as InputManager,
      win, new Container(), () => {}, vi.fn());
    ctrl.attackOverride = style;
    return { ctrl, actor: party[slot] };
  }

  it('the layout has a top row above every party row', () => {
    expect(layout).toHaveLength(6);
    expect(topFeet).toBeLessThan(Math.min(...PARTY_FEET_Y));
  });

  for (const style of ATTACK_STYLES) {
    it(`${style}: each of the four party rows ends within 30 px of the target's feet, its art touching it, then returns`, () => {
      for (let slot = 0; slot < 4; slot++) {
        const { ctrl, actor } = attack(slot, style);
        for (let i = 0; i < contactFrame(style) + 1; i++) ctrl.updateAnimating(1);
        expect(ctrl.animPhase, `${style} slot ${slot}`).toBe('result');
        // old: the feet stayed on the attacker's own row, 65-380 px below the top row
        expect(Math.abs(actor.y + 160 - layout[top].feetY), `${style} slot ${slot} feet`).toBeLessThanOrEqual(30);
        const targetArtRight = layout[top].x + layout[top].w / 2 - MONSTER_OPAQUE_RIGHT_INSET;
        expect(Math.abs(actor.x + HERO_OPAQUE_LEFT_INSET - targetArtRight), `${style} slot ${slot} edge`).toBeLessThanOrEqual(40);
        for (let i = 0; i < 200 && ctrl.animPhase !== 'round_end'; i++) ctrl.updateAnimating(1);
        expect([actor.x, actor.y]).toEqual([PARTY_X[slot], PARTY_FEET_Y[slot] - 160]);
      }
    });
  }
});
