import { describe, it, expect } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { AiEnemyView, freezeOf, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
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

  it('a sleeping or stunned enemy holds idle (no idle_b) and still recoils when hit', () => {
    const { view, sprites, textures } = stage(1);
    const still = [freezeOf({ has: (e) => e === 'sleep' })];
    for (let t = 0; t < 80; t++) {
      view.update(1, sprites, still);
      expect((sprites[0] as Sprite).texture).toBe(textures.idle);
    }
    view.poses.playHurt(0);
    view.update(1, sprites, still);
    expect((sprites[0] as Sprite).texture).toBe(textures.hurt_in1);
    expect(freezeOf({ has: (e) => e === 'stun' })).toBe('still');
  });

  it('a stoned enemy keeps idle and offset 0 when hit (only the flash shows)', () => {
    const { view, sprites, textures } = stage(1);
    const stone = [freezeOf({ has: (e) => e === 'stone' })];
    view.update(1, sprites, stone);
    const at = { x: sprites[0].x, y: sprites[0].y };
    view.poses.playHurt(0);
    for (let t = 0; t < 10; t++) {
      view.update(1, sprites, stone);
      expect((sprites[0] as Sprite).texture).toBe(textures.idle);
      expect({ x: sprites[0].x, y: sprites[0].y }).toEqual(at);
    }
  });

  it('awake enemies breathe (idle_b appears)', () => {
    const { view, sprites, textures } = stage(1);
    const seen = new Set<Texture>();
    for (let t = 0; t < 80; t++) { view.update(1, sprites); seen.add((sprites[0] as Sprite).texture); }
    expect(seen.has(textures.idle_b)).toBe(true);
    expect(freezeOf(undefined)).toBe('none');
  });
});
