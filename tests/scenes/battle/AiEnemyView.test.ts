import { describe, it, expect } from 'vitest';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { AiEnemyView, HOLD_PULSE_TINT, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { postureOf } from '../../../src/scenes/battle/fx/statusRules.js';
import { stoneTextures } from '../../../src/scenes/battle/fx/stoneTextures.js';
import { HURT_FRAMES } from '../../../src/scenes/battle/enemyChoreography.js';
import { loadStatusVisuals } from '../../helpers/statusVisuals.js';

const VISUALS = loadStatusVisuals();
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { tintOf } from '../../../src/scenes/battle/actorTint.js';
import { computeEnemyLayoutAi } from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { BOSS_FRAMES, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import { ATTACK_FRAMES } from '../../../src/scenes/battle/EnemyPoseController.js';
import type { MonsterFrames } from '../../../src/rendering/BattleArt.js';
import type { EnemyData } from '../../../src/types/index.js';

function fakeArt(artScale = 2): { art: MonsterArtSource; textures: Record<MonsterFrame, Texture> } {
  const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, new Texture()])) as Record<MonsterFrame, Texture>;
  const frames: MonsterFrames = { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt,
    scale: 2, artScale, cell: [80, 80], footRow: 76, floating: false, hasCast: false, lungePx: 24, anim: true };
  return { art: { getMonsterFrames: () => frames }, textures };
}

const goblins = (n: number): EnemyData[] => Array.from({ length: n }, (_, i) => ({ id: `goblin${i}`, name: 'Goblin', size: 'small' } as EnemyData));

/** A battle container: background, three enemies, a party sprite on top. */
function stage(n = 3) {
  const { art, textures } = fakeArt();
  const view = new AiEnemyView(goblins(n), art);
  const parent = new Container();
  const bg = new Sprite();
  parent.addChild(bg);
  const sprites = view.build();
  for (const s of sprites) parent.addChild(s);
  const party = new Sprite();
  parent.addChild(party);
  return { view, parent, sprites, party, textures };
}

const enemyOrder = (parent: Container, sprites: Container[]): number[] =>
  [...sprites.keys()].sort((a, b) => parent.getChildIndex(sprites[a]) - parent.getChildIndex(sprites[b]));

describe('AiEnemyView draw order while lunging (D5)', () => {
  it('the attacker takes the highest enemy slot only: below the party and a flash added later; order restored on idle', () => {
    const { view, parent, sprites, party } = stage();
    const slots = sprites.map((s) => parent.getChildIndex(s));
    view.poses.playAttack(0);
    view.update(1, sprites);
    expect(enemyOrder(parent, sprites)).toEqual([1, 2, 0]);
    expect(sprites.map((s) => parent.getChildIndex(s)).sort()).toEqual([...slots].sort());
    const flash = new Sprite();
    parent.addChild(flash);
    view.update(1, sprites);
    expect(parent.getChildIndex(sprites[0])).toBeLessThan(parent.getChildIndex(party));
    expect(parent.getChildIndex(sprites[0])).toBeLessThan(parent.getChildIndex(flash));
    for (let t = 0; t < ATTACK_FRAMES; t++) view.update(1, sprites);
    expect(enemyOrder(parent, sprites)).toEqual([0, 1, 2]);
    expect(sprites.map((s) => parent.getChildIndex(s))).toEqual(slots);
  });

  it('a sprite swapped in mid-lunge (late art, swapSprite) keeps the raised slot and is restored by enemy index', () => {
    const { view, parent, sprites } = stage();
    view.poses.playAttack(1);
    view.update(1, sprites);
    expect(enemyOrder(parent, sprites)).toEqual([0, 2, 1]);
    const next = new Sprite();                         // BattleDisplayManager.swapSprite: same child index
    parent.addChildAt(next, parent.getChildIndex(sprites[1]));
    parent.removeChild(sprites[1]);
    sprites[1] = next;
    for (let t = 0; t < ATTACK_FRAMES; t++) view.update(1, sprites);
    expect(enemyOrder(parent, sprites)).toEqual([0, 1, 2]);
  });
});

describe('AiEnemyView frames, freeze (D6) and scale', () => {
  it('shows the controller frame texture and the native atlas is scaled by artScale x the layout factor', () => {
    const { view, sprites, textures } = stage();
    const box = computeEnemyLayoutAi(goblins(3).map(() => ({ size: 'small' as const, w: 160, h: 160 })))[0];
    expect((sprites[0] as Sprite).scale.x).toBe(2 * box.scaleFactor);
    view.poses.playAttack(0);
    view.update(0, sprites);
    expect((sprites[0] as Sprite).texture).toBe(textures.atk_wind1);
  });

  it('pass F 5a: a sleeping or stunned enemy sways daze / daze_b (old: idle), recoils when hit and returns to daze', () => {
    const { view, sprites, textures } = stage(1);
    for (const status of ['sleep', 'stun']) {
      const dazed = [postureOf([status], VISUALS)];
      expect(dazed[0]).toBe('daze');
      const seen = new Set<Texture>();
      for (let t = 0; t < 100; t++) { view.update(1, sprites, dazed); seen.add((sprites[0] as Sprite).texture); }
      expect([...seen].sort()).toEqual([textures.daze, textures.daze_b].sort());
      expect(seen.has(textures.idle)).toBe(false);
      view.poses.playHurt(0);
      view.update(1, sprites, dazed);
      expect((sprites[0] as Sprite).texture).toBe(textures.hurt_in1);
      for (let t = 0; t < HURT_FRAMES; t++) view.update(1, sprites, dazed);
      expect([textures.daze, textures.daze_b]).toContain((sprites[0] as Sprite).texture);
    }
  });

  it('a stoned enemy keeps idle (its grey copy) and offset 0 when hit (only the flash shows)', () => {
    const { view, sprites, textures } = stage(1);
    const grey = new Texture();
    stoneTextures.setBuilder((t) => (t === textures.idle ? grey : null));
    const stone = [postureOf(['stone', 'poison'], VISUALS)];
    expect(stone[0]).toBe('stone');
    view.update(1, sprites, stone);
    const at = { x: sprites[0].x, y: sprites[0].y };
    view.poses.playHurt(0);
    for (let t = 0; t < 10; t++) {
      view.update(1, sprites, stone);
      expect((sprites[0] as Sprite).texture).toBe(grey);
      expect(stoneTextures.coloured(grey)).toBe(textures.idle);
      expect({ x: sprites[0].x, y: sprites[0].y }).toEqual(at);
    }
    view.update(1, sprites, ['none']);
    expect((sprites[0] as Sprite).texture).not.toBe(grey);
  });

  it('fear trembles ±1 px by the clock and never drifts: after 400 frames the base position is the start', () => {
    const { view, sprites } = stage(1);
    view.update(0, sprites);
    const home = sprites[0].x;
    const fear = [postureOf(['fear'], VISUALS)];
    expect(fear[0]).toBe('tremble');
    const seen = new Set<number>();
    for (let t = 0; t < 400; t++) { view.update(1, sprites, fear); seen.add(sprites[0].x - home); }
    expect([...seen].sort()).toEqual([-1, 0, 1]);
    view.update(1, sprites, ['none']);
    expect(sprites[0].x).toBe(home);
  });

  it('awake enemies breathe (idle_b appears)', () => {
    const { view, sprites, textures } = stage(1);
    const seen = new Set<Texture>();
    for (let t = 0; t < 80; t++) { view.update(1, sprites); seen.add((sprites[0] as Sprite).texture); }
    expect(seen.has(textures.idle_b)).toBe(true);
    expect(postureOf([], VISUALS)).toBe('none');
  });
});

/** Pass F item 3 (D5'): a travelling melee attacker is the top actor, below every effect; order restored on idle. */
describe("AiEnemyView draw order while travelling (D5')", () => {
  function layered(ranged = false) {
    const { art, textures } = fakeArt();
    const enemies = goblins(3).map((e, i) => ({ ...e, attack: ranged && i === 0 ? 'ranged' as const : 'melee' as const }));
    const view = new AiEnemyView(enemies, art);
    const layers = BattleLayers.of(new Container());
    const sprites = view.build();
    layers.actors.addChild(...sprites);
    const hero = new Graphics().rect(0, 0, 160, 160).fill(0x4488ff);
    hero.position.set(1380, 271);
    const hero2 = new Sprite();
    layers.actors.addChild(hero, hero2);
    const number = new Sprite();
    layers.fx.numbers.addChild(number);
    return { view, layers, sprites, hero, hero2, number, textures };
  }
  const drawOrder = (layers: BattleLayers, c: Container): number => {
    const all: Container[] = [];
    const walk = (n: Container) => { all.push(n); n.children.forEach(walk); };
    walk(layers.root);
    return all.indexOf(c);
  };

  it('the attacker is the last child of actors (above the party), below a child of fx; restored on idle', () => {
    const { view, layers, sprites, hero, hero2, number } = layered();
    const before = layers.actors.children.slice();
    view.playAttack(0, hero);
    expect(view.poses.attackKind(0)).toBe('melee');
    const total = view.poses.attackTiming(0).totalFrames;
    for (let t = 0; t < total - 1; t++) {
      view.update(1, sprites);
      expect(layers.actors.children[layers.actors.children.length - 1]).toBe(sprites[0]);
      expect(drawOrder(layers, sprites[0])).toBeGreaterThan(drawOrder(layers, hero2));
      expect(drawOrder(layers, sprites[0])).toBeLessThan(drawOrder(layers, number));
    }
    view.update(1, sprites);
    expect(view.poses.isAttacking(0)).toBe(false);
    expect(layers.actors.children).toEqual(before);
  });

  it('a sprite swapped in mid-travel stays on top and the order is restored by enemy index', () => {
    const { view, layers, sprites, hero } = layered();
    const before = layers.actors.children.slice();
    view.playAttack(1, hero);
    for (let t = 0; t < 12; t++) view.update(1, sprites);
    const next = new Sprite();                         // BattleDisplayManager.swapSprite: same child index
    layers.actors.addChildAt(next, layers.actors.getChildIndex(sprites[1]));
    layers.actors.removeChild(sprites[1]);
    sprites[1] = next;
    view.update(1, sprites);
    expect(layers.actors.children[layers.actors.children.length - 1]).toBe(next);
    for (let t = 0; t < 120; t++) view.update(1, sprites);
    expect(layers.actors.children).toEqual(before.map((c) => (c === before[1] ? next : c)));
  });

  it('a ranged attacker stays below the party sprites (D5: the highest enemy slot only)', () => {
    const { view, layers, sprites, hero } = layered(true);
    view.playAttack(0, hero);
    expect(view.poses.attackKind(0)).toBe('inplace');
    view.update(1, sprites);
    expect(layers.actors.getChildIndex(sprites[0])).toBe(2);
    expect(layers.actors.getChildIndex(sprites[0])).toBeLessThan(layers.actors.getChildIndex(hero));
  });

  it('item 7: a heavy attacker pulses red only in its hold and shakes the layers on contact', () => {
    const { art } = fakeArt();
    const view = new AiEnemyView([{ id: 'garland', name: 'Garland', size: 'large', attack: 'melee', attackAnim: 'heavy' } as EnemyData], art);
    const layers = BattleLayers.of(new Container());
    const sprites = view.build();
    layers.actors.addChild(...sprites);
    const hero = new Graphics().rect(0, 0, 160, 160).fill(0x4488ff);
    hero.position.set(1380, 271);
    layers.actors.addChild(hero);
    view.playAttack(0, hero);
    const { contactAt, totalFrames } = view.poses.attackTiming(0);
    const holdAt = contactAt - 23;
    const tints: (number | null)[] = [];
    let shookAt = -1;
    for (let t = 1; t <= totalFrames; t++) {
      view.update(1, sprites);
      tints.push(tintOf(sprites[0], 'pulse'));
      layers.update(1);
      if (shookAt < 0 && layers.actors.x !== 0) shookAt = t;
    }
    const pulsed = tints.flatMap((v, k) => (v === null ? [] : [k + 1]));
    expect(pulsed[0]).toBe(holdAt);
    expect(Math.max(...pulsed)).toBeLessThan(holdAt + 18);
    expect(new Set(tints.filter((v) => v !== null))).toEqual(new Set([HOLD_PULSE_TINT]));
    expect(tints[tints.length - 1]).toBeNull();
    expect(shookAt).toBe(contactAt);
    expect(layers.actors.position).toMatchObject({ x: 0, y: 0 });
  });
});
