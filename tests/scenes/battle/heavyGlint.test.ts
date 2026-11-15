/**
 * Final play test, pass F items 4 and 8:
 * - the heavy attack's glint was a tiny cross on Garland's forearm for about a frame (the body box's `top` anchor). It
 *   now plays at the raised weapon's tip, which the atlas meta records (`tip`: the topmost opaque pixel of
 *   `attack_raise`), 4 frames into the 18-frame raised hold, and lasts the rest of the hold (14 frames);
 * - a ranged attack (the dragon's breath) raised impact dust at the attacker's feet: no dust for ranged attacks.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { AiEnemyView, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { BattleActionFx, CUE_DELAY } from '../../../src/scenes/battle/fx/ActionFx.js';
import { FxSource } from '../../../src/scenes/battle/fx/fxSource.js';
import { toFxData } from '../../../src/scenes/battle/fx/fxDefs.js';
import { validateSpellEffects } from '../../../src/core/schemaValidationFx.js';
import { BOSS_FRAMES, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import type { FxAtlasMeta } from '../../../src/scenes/battle/fx/fxAtlas.js';
import type { MonsterAtlasMeta, MonsterFrames } from '../../../src/rendering/BattleArt.js';
import type { EnemyData } from '../../../src/types/index.js';
import { readRgbaPng } from '../../helpers/pngAlpha.js';

const ATLAS = JSON.parse(readFileSync('assets/sprites/monsters-ai.json', 'utf-8')) as MonsterAtlasMeta;
const PNG = readRgbaPng('assets/sprites/monsters-ai.png');
const yaml = <T>(file: string): T => parse(readFileSync(`assets/data/${file}`, 'utf-8')) as T;

/** The topmost opaque row of a cell and the centre of its opaque run (art px; texScale 1). */
function topmost([x0, y0]: [number, number], [w, h]: [number, number]): [number, number] {
  for (let y = 0; y < h; y++) {
    const xs: number[] = [];
    for (let x = 0; x < w; x++) if (PNG.data[((y0 + y) * PNG.width + x0 + x) * 4 + 3] > 0) xs.push(x);
    if (xs.length) return [Math.round((xs[0] + xs[xs.length - 1]) / 2), y];
  }
  throw new Error('empty cell');
}

describe('item 4: the glint at the raised weapon tip', () => {
  it.each(['garland', 'lich'])('%s: the atlas tip is the topmost opaque pixel of attack_raise, well away from the old anchor', (id) => {
    const sheet = ATLAS.sheets[id];
    expect(ATLAS.texScale).toBe(1);
    const [mx, my] = topmost(sheet.frames.attack_raise!, sheet.cell);
    expect(sheet.tip![1]).toBe(my);
    expect(Math.abs(sheet.tip![0] - mx)).toBeLessThanOrEqual(1); // the build rounds half to even
    const [tx, ty] = sheet.tip!;
    const [w, h] = sheet.cell;
    // the old placement: the body box's `top` anchor (box = the cell's middle 70 % and lower 62 %; top = 55 %, 12 %)
    const old = [w * (0.15 + 0.7 * 0.55), h * (0.33 + 0.62 * 0.12)];
    expect(Math.hypot(tx - old[0], ty - old[1])).toBeGreaterThan(50);
    expect(ty).toBeLessThan(h * 0.15); // the raised blade, at the top of the cell
  });

  it('sheets without a raise keep no tip', () => {
    for (const [id, s] of Object.entries(ATLAS.sheets)) if (!s.frames.attack_raise) expect(s.tip, id).toBeUndefined();
  });

  const frames = (tip?: [number, number]): MonsterFrames => {
    const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, new Texture()])) as Record<MonsterFrame, Texture>;
    return { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: 2,
      artScale: 2, cell: [200, 200], footRow: 192, floating: false, hasCast: true, hasRaise: true, lungePx: 38, anim: true,
      ...(tip ? { tip } : {}) };
  };

  it('AiEnemyView hands the hold cue the tip as a fraction of the sprite (none without a tip)', () => {
    const boss = { id: 'garland', name: 'Garland', size: 'boss', attackAnim: 'heavy' } as EnemyData;
    for (const [tip, want] of [[[169, 5], { x: 169.5 / 200, y: 5.5 / 200 }], [undefined, undefined]] as const) {
      const art: MonsterArtSource = { getMonsterFrames: () => frames(tip as [number, number] | undefined) };
      const view = new AiEnemyView([boss], art);
      const sprites = view.build();
      const cues: unknown[][] = [];
      view.onCue = (...args) => cues.push(args);
      view.playAttack(0, null);
      for (let f = 0; f < 120; f++) view.update(1, sprites);
      expect(cues.map((c) => c[1])).toEqual(['hold', 'contact']);
      expect(cues[0][3]).toEqual(want);
      expect(cues[1][3]).toBeUndefined();
    }
  });

  it('ActionFx: the glint starts 4 frames after the cue, at the point, and lasts 14 frames (the rest of the hold)', () => {
    const s = new FxSource();
    s.setData(toFxData(validateSpellEffects(yaml('spell-effects.yaml'))), yaml<EnemyData[]>('enemies.yaml'));
    s.atlas.set(JSON.parse(readFileSync('assets/sprites/battle-fx.json', 'utf-8')) as FxAtlasMeta,
      new Texture({ source: new TextureSource({ width: 1024, height: 1024 }) }));
    const layers = BattleLayers.of(new Container());
    const fx = new BattleActionFx(layers, s);
    const sprite = new Sprite(new Texture({ source: new TextureSource({ width: 200, height: 200 }) }));
    sprite.position.set(300, 100);
    sprite.scale.set(2);
    layers.actors.addChild(sprite);
    expect(CUE_DELAY.glint).toBe(4);
    fx.playCue('glint', sprite, { x: 0.845, y: 0.0275 });
    const visible = (): Sprite[] => layers.fx.spell.children.flatMap((c) => c.children.filter((k): k is Sprite => k instanceof Sprite && k.visible));
    let shown = 0;
    for (let t = 0; t < 30; t++) {
      if (t < 4) expect(visible(), `frame ${t}`).toHaveLength(0);
      const v = visible();
      if (v.length) {
        shown++;
        const g = v[0];
        expect(Math.abs(g.x + g.width / 2 - (300 + 400 * 0.845))).toBeLessThanOrEqual(2);
        expect(Math.abs(g.y + g.height / 2 - (100 + 400 * 0.0275))).toBeLessThanOrEqual(2);
      }
      layers.update(1);
    }
    expect(shown).toBe(14);
    expect(fx.active).toBe(0);
  });
});

describe('item 8: no impact dust for a ranged attack', () => {
  const frames = (): MonsterFrames => {
    const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, new Texture()])) as Record<MonsterFrame, Texture>;
    return { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: 2,
      artScale: 2, cell: [80, 80], footRow: 76, floating: false, hasCast: false, lungePx: 24, anim: true };
  };
  it.each([['ranged', []], ['melee', ['contact']]] as const)('a %s attack hands on contact cues %j', (attack, want) => {
    const view = new AiEnemyView([{ id: 'x', name: 'X', size: 'large', attack } as EnemyData], { getMonsterFrames: frames });
    const sprites = view.build();
    const cues: string[] = [];
    view.onCue = (_i, cue) => cues.push(cue);
    view.playAttack(0, null);
    for (let f = 0; f < 120; f++) view.update(1, sprites);
    expect(cues).toEqual(want);
  });
});
