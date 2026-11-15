/**
 * Browser re-test 2026-11-15 through the real state machine, display and controller:
 * A: a poisoned actor's HP drops with the poison line (after the action), not at the action's impact;
 * C: a feared party member whose turn is lost to fear is not announced ("BLM uses Potion!"); only the fear line shows
 *    and the turn list reads `BLM Afraid`; an action that goes ahead is announced as usual;
 * D: a sleeper keeps its SLP tag on "WAR is asleep!" and loses it with "WAR wakes up!".
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { BattleCommand } from '../../../src/battle/BattleCommands.js';
import { Character } from '../../../src/entities/Character.js';
import { Inventory } from '../../../src/entities/Inventory.js';
import { ClassRegistry } from '../../../src/data/ClassRegistry.js';
import { Window } from '../../../src/ui/Window.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { ENEMY_WINDOW, STRIP_HEIGHT, STRIP_Y } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { setMessageSpeed } from '../../../src/core/Settings.js';
import { createMockInput } from '../../helpers/testUtils.js';
import { loadRealRegistries } from '../../helpers/realData.js';
import { enemyCopy, SPELLS } from '../../helpers/balanceData.js';
import type { StatusEffect } from '../../../src/battle/StatusEffects.js';
import type { InputManager } from '../../../src/core/InputManager.js';

beforeAll(async () => { await loadRealRegistries(); });
beforeEach(() => { setMessageSpeed(3); });
afterEach(() => { vi.restoreAllMocks(); });

const POSES = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory', 'idle_b'];

/** One hero (`status`, acting first with `cmd`) against a slow, sturdy goblin; `rng` drives every roll. */
function setup(name: string, cls: string, status: StatusEffect | null, cmd: (id: string) => BattleCommand, rng: () => number, hp?: number) {
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  vi.spyOn(characterAtlas, 'getBattleFrames').mockReturnValue({ frames: POSES.map(() => new Texture()), footRow: 76, scale: 2 } as unknown as ReturnType<typeof characterAtlas.getBattleFrames>);
  const hero = new Character({ name, classData: ClassRegistry.getClass(cls)!, level: 20 });
  hero.stats.agility = 99;
  if (hp !== undefined) hero.currentHp = hp;
  if (status) hero.statusTracker.apply(status);
  const goblin = enemyCopy('goblin');
  goblin.stats.hp = 999; goblin.stats.agility = 0; goblin.stats.attack = 0;
  const inventory = new Inventory();
  inventory.add('potion', 3);
  const battle = new BattleStateMachine({ party: [hero], enemies: [goblin], spells: SPELLS, inventory }, rng);
  battle.startBattle();
  battle.advanceFromIntro();
  if (battle.currentCommandActorId) battle.submitCommand(cmd('party_0'));
  battle.prepareRound();
  const main = new Container();
  const win = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
  const display = new BattleDisplayManager(main, battle, { party: [hero], enemies: [goblin] }, win);
  display.createEnemySprites();
  display.createPartySprites();
  display.updatePartyDisplay();
  const shown: string[] = [];
  const ctrl = new BattleAnimationController(main, battle, display, createMockInput() as unknown as InputManager,
    win, new Container(), (t) => { if (shown[shown.length - 1] !== t) shown.push(t); }, vi.fn());
  /** Each frame: the line on screen, the tag and HP the panel shows, and the turn-list entry. */
  const log: { line: string; tag: string; hp: string; entry: string }[] = [];
  const run = () => {
    for (let f = 0; f < 2000 && ctrl.animPhase !== 'round_end' && ctrl.turnList.index < 1; f++) {
      display.update(1); ctrl.updateAnimating(1); display.partyPanel.update(99);
      const row = display.partyPanel.rows[0];
      log.push({ line: shown[shown.length - 1] ?? '', tag: row.status.text, hp: row.hp.text, entry: ctrl.turnListTexts[0]?.text ?? '' });
    }
  };
  return { hero, shown, log, run, ctrl };
}

const potion = (id: string): BattleCommand => ({ type: 'item', actorId: id, itemId: 'potion', targetId: id });

describe('re-test D: status tags follow the presented line', () => {
  it('"WAR is asleep!" still shows SLP; the tag goes with "WAR wakes up!"', () => {
    // rng 0.1: the wake roll is rand(0..80) = 8 < HP, so WAR wakes
    const s = setup('WAR', 'warrior', 'sleep', (id) => ({ type: 'fight', actorId: id, targetId: 'enemy_0' }), () => 0.1);
    s.run();
    expect(s.shown).toEqual(['WAR is asleep!', 'WAR wakes up!']);
    const asleep = s.log.filter((l) => l.line === 'WAR is asleep!');
    const woke = s.log.filter((l) => l.line === 'WAR wakes up!');
    expect(asleep.length).toBeGreaterThan(0);
    expect(asleep.every((l) => l.tag === 'SLP')).toBe(true);
    expect(woke.every((l) => l.tag === '')).toBe(true);
  });
});

describe('re-test C: a fear skip is not announced', () => {
  it('rng 0.1 (< 0.5, the skip): only "BLM is trembling with fear!" shows; the entry reads `BLM Afraid`', () => {
    const s = setup('BLM', 'black_mage', 'fear', potion, () => 0.1);
    s.run();
    expect(s.shown).toEqual(['BLM is trembling with fear!']);
    expect(s.log[s.log.length - 1].entry).toBe('BLM Afraid');
  });

  it('rng 0.9 (no skip): the Potion is announced and used as usual', () => {
    const s = setup('BLM', 'black_mage', 'fear', potion, () => 0.9, 20);
    s.run();
    expect(s.shown[0]).toBe('BLM uses Potion!');
    expect(s.shown.some((t) => /^BLM recovers \d+ HP!$/.test(t))).toBe(true);
    expect(s.shown).not.toContain('BLM is trembling with fear!');
  });
});

describe('re-test A: the poison damage is presented with its line', () => {
  it('a poisoned hero at full HP drinks a Potion: "HP is full", then the HP drops only with the poison line', () => {
    const s = setup('WHM2', 'white_mage', 'poison', potion, () => 0.5);
    const max = s.hero.maxHp;
    const dmg = Math.floor(max * 0.05);
    s.run();
    expect(s.shown[s.shown.length - 1]).toBe(`WHM2 takes ${dmg} poison damage!`);
    expect(s.hero.currentHp).toBe(max - dmg);
    const before = s.log.filter((l) => l.line !== `WHM2 takes ${dmg} poison damage!`);
    expect(before.every((l) => l.hp === `${max}/${max}`)).toBe(true);
    expect(s.log[s.log.length - 1].hp).toBe(`${max - dmg}/${max}`);
  });
});

/**
 * Re-test E: in step mode (`?battleStep=1`) the dev clock hands the scene dt = 0 on every frame between steps. The
 * announce phase took `animTimer === 0` as its first frame, so each frozen frame announced the action again: a
 * repeated turn-list row, and the entries after it were completed one row off (KNT2's row went missing).
 */
describe('re-test E: frozen frames (dt 0) change nothing', () => {
  /** A full round of three heroes and Garland, every `step`-th frame advancing one frame (step mode), else dt 1. */
  function round(frozenBetweenSteps: number) {
    vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
    vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
    vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
    vi.spyOn(characterAtlas, 'getBattleFrames').mockReturnValue({ frames: POSES.map(() => new Texture()), footRow: 76, scale: 2 } as unknown as ReturnType<typeof characterAtlas.getBattleFrames>);
    const party = ['KNT1', 'KNT2', 'KNT3'].map((name, i) => {
      const c = new Character({ name, classData: ClassRegistry.getClass('warrior')!, level: 10 });
      c.stats.agility = 90 - i * 30;
      return c;
    });
    const garland = enemyCopy('garland');
    garland.stats.agility = 0;
    const battle = new BattleStateMachine({ party, enemies: [garland], spells: SPELLS }, mulberryLike(7));
    battle.startBattle();
    battle.advanceFromIntro();
    party.forEach((_, i) => battle.submitCommand({ type: 'fight', actorId: `party_${i}`, targetId: 'enemy_0' }));
    battle.prepareRound();
    const main = new Container();
    const win = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
    const display = new BattleDisplayManager(main, battle, { party, enemies: [garland] }, win);
    display.createEnemySprites();
    display.createPartySprites();
    const ctrl = new BattleAnimationController(main, battle, display, createMockInput() as unknown as InputManager,
      win, new Container(), () => {}, vi.fn());
    for (let f = 0; f < 20000 && ctrl.animPhase !== 'round_end'; f++) {
      const dt = f % (frozenBetweenSteps + 1) === 0 ? 1 : 0;
      display.update(dt); ctrl.updateAnimating(dt);
    }
    return ctrl.turnListTexts.map((t) => t.text);
  }

  it('step mode lists each actor once, in order, exactly as at normal speed', () => {
    const normal = round(0);
    expect(normal).toHaveLength(4);
    expect(normal.map((t) => t.split(/[ >]/)[0]).sort()).toEqual(['Garland', 'KNT1', 'KNT2', 'KNT3']);
    expect(round(3)).toEqual(normal);
  });
});

/** A small seeded RNG (the same rolls for both runs). */
function mulberryLike(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
