/**
 * Final play test, pass F items 4 and 8:
 * - the heavy attack's glint was a tiny cross on Garland's forearm for about a frame (the body box's `top` anchor). It
 *   now plays at the raised weapon's tip, which the atlas meta records (`tip`: the topmost opaque pixel of
 *   `attack_raise`), 4 frames into the 18-frame raised hold, and lasts the rest of the hold (14 frames);
 * - a ranged attack (the dragon's breath) raised impact dust at the attacker's feet: no dust for ranged attacks.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { AiEnemyView, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { BattleActionFx, CUE_DELAY } from '../../../src/scenes/battle/fx/ActionFx.js';
import { FxSource } from '../../../src/scenes/battle/fx/fxSource.js';
import { toFxData } from '../../../src/scenes/battle/fx/fxDefs.js';
import { validateSpellEffects } from '../../../src/core/schemaValidationFx.js';
import { BOSS_FRAMES, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import { attackTable, travelAttackAt } from '../../../src/scenes/battle/enemyAttackTables.js';
import { BATTLE_MESSAGE_HEIGHT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { Pixels } from '../../../src/scenes/battle/fx/texturePixels.js';
import type { FxCuePoint } from '../../../src/scenes/battle/fx/index.js';
import { monsterAnchors } from '../../../src/rendering/monsterAnchors.js';
import type { FxAtlasMeta } from '../../../src/scenes/battle/fx/fxAtlas.js';
import type { MonsterAtlasMeta, MonsterFrames } from '../../../src/rendering/BattleArt.js';
import type { EnemyData } from '../../../src/types/index.js';
import { monsterSheetPng } from '../../helpers/monsterAtlas.js';

const ATLAS = JSON.parse(readFileSync('assets/sprites/monsters-ai.json', 'utf-8')) as MonsterAtlasMeta;
const yaml = <T>(file: string): T => parse(readFileSync(`assets/data/${file}`, 'utf-8')) as T;

/** The topmost opaque row of a cell and the centre of its opaque run (art px; texScale 1). */
function topmost(sheet: string, [x0, y0]: [number, number], [w, h]: [number, number]): [number, number] {
  const PNG = monsterSheetPng(sheet);             // the sheet's atlas page (FW-8)
  for (let y = 0; y < h; y++) {
    const xs: number[] = [];
    for (let x = 0; x < w; x++) if (PNG.data[((y0 + y) * PNG.width + x0 + x) * 4 + 3] > 0) xs.push(x);
    if (xs.length) return [Math.round((xs[0] + xs[xs.length - 1]) / 2), y];
  }
  throw new Error('empty cell');
}

/** The rig of sheet `id` sets `raise: false` (FW-R: the approved attack_raise key is dropped). */
function rigDropsRaise(id: string): boolean {
  const file = `assets-src/gen/anim/monsters/${id}.yaml`;
  return existsSync(file) && /^raise:\s*false\b/m.test(readFileSync(file, 'utf-8')); // a top-level key (some rigs repeat keys, so no YAML parse)
}

/** A cell of the atlas as Pixels (texScale 1: art px). */
function cellPixels(sheet: string, frame: string): Pixels {
  const s = ATLAS.sheets[sheet];
  const [x0, y0] = s.frames[frame as MonsterFrame]!;
  const [w, h] = s.cell;
  const PNG = monsterSheetPng(sheet);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) data[(y * w + x) * 4 + c] = PNG.data[((y0 + y) * PNG.width + x0 + x) * 4 + c];
  }
  return { data, w, h };
}

describe('item 4: the glint at the raised weapon tip', () => {
  it.each(['garland', 'lich'])('%s: the atlas tip is the topmost opaque pixel of attack_raise, well away from the old anchor', (id) => {
    const sheet = ATLAS.sheets[id];
    expect(ATLAS.texScale).toBe(1);
    const [mx, my] = topmost(id, sheet.frames.attack_raise!, sheet.cell);
    expect(sheet.tip![1]).toBe(my);
    expect(Math.abs(sheet.tip![0] - mx)).toBeLessThanOrEqual(1); // the build rounds half to even
    const [tx, ty] = sheet.tip!;
    const [w, h] = sheet.cell;
    // the old placement: the body box's `top` anchor (box = the cell's middle 70 % and lower 62 %; top = 55 %, 12 %)
    const old = [w * (0.15 + 0.7 * 0.55), h * (0.33 + 0.62 * 0.12)];
    expect(Math.hypot(tx - old[0], ty - old[1])).toBeGreaterThan(50);
    expect(ty).toBeLessThan(h * 0.15); // the raised blade, at the top of the cell
  });

  it('sheets without a raise keep no tip, unless their rig has `raise: false` (the tip is then on atk_wind2\'s art)', () => {
    const noRaise: string[] = [];
    for (const [id, s] of Object.entries(ATLAS.sheets)) {
      if (s.frames.attack_raise) continue;
      if (!rigDropsRaise(id)) { expect(s.tip, id).toBeUndefined(); continue; }
      noRaise.push(id);
      const px = cellPixels(id, 'atk_wind2');
      expect(s.tip, id).toBeDefined();
      expect(px.data[(s.tip![1] * px.w + s.tip![0]) * 4 + 3], `${id} tip ${s.tip} on atk_wind2's art`).toBeGreaterThan(0);
    }
    expect(noRaise).toContain('hollow_seraph'); // docs/ROSTER_FIX_PLAN.md defect 5 (D-F1, FW-R)
  });

  it('chaos: raise off (V8 F5), tip from atk_wind2', () => {
    // docs/REDESIGN_FIX_PLAN.md F5 / D-O4: the heavy raise set is gone, the glint tip sits on atk_wind2's art
    const s = ATLAS.sheets.chaos;
    expect(rigDropsRaise('chaos')).toBe(true);
    expect(s.frames.attack_raise).toBeUndefined();
    for (const f of ['atk_raise_in', 'atk_raise_b', 'atk_swing', 'atk_swing2']) expect(s.frames[f as MonsterFrame], f).toBeUndefined();
    const px = cellPixels('chaos', 'atk_wind2');
    expect(s.tip).toBeDefined();
    expect(px.data[(s.tip![1] * px.w + s.tip![0]) * 4 + 3], `tip ${s.tip} on atk_wind2's art`).toBeGreaterThan(0);
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

describe('defect 5 (D-F1): the hollow seraph heavy attack without a raise', () => {
  const s = ATLAS.sheets.hollow_seraph;
  /** Real atlas frames, one texture per displayed frame name (a frame the sheet lacks shows its fallback). */
  let memo: MonsterFrames | null = null;
  const art: MonsterArtSource = {
    getMonsterFrames(): MonsterFrames {
      if (memo) return memo;
      const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n,
        new Texture({ source: new TextureSource({ width: s.cell[0], height: s.cell[1] }) })])) as Record<MonsterFrame, Texture>;
      memo = { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: ATLAS.scale,
        artScale: ATLAS.scale / (ATLAS.texScale ?? ATLAS.scale), cell: s.cell, footRow: s.footRow, floating: s.floating,
        hasCast: !!s.frames.cast, hasRaise: !!s.frames.attack_raise, lungePx: s.lungePx ?? 24, anim: true,
        ...(s.tip ? { tip: s.tip } : {}), ...monsterAnchors(s) };
      return memo;
    },
  };

  it('the sheet has no raise frames and plays only the wind-up coil, the strike and the recover', () => {
    expect(s.frames.attack_raise).toBeUndefined();
    for (const f of ['atk_raise_in', 'atk_raise_b', 'atk_swing', 'atk_swing2']) expect(s.frames[f as MonsterFrame], f).toBeUndefined();
    const o = { lunge: s.lungePx ?? 24, travel: 600, hop: 10, hasRaise: false };
    const played = new Set(Array.from({ length: attackTable('heavy', 600).total }, (_, t) => travelAttackAt('heavy', t, o).frame));
    expect([...played].sort()).toEqual(['atk_follow', 'atk_mid', 'atk_recover', 'atk_wind1', 'atk_wind2', 'attack', 'idle']);
  });

  it.each([0, 1, 2, 3])('attacking hero %i: the hold cue puts the glint on an opaque pixel of the frame shown, below the window', (j) => {
    const main = new Container();
    const layers = BattleLayers.of(main);
    const boss = yaml<EnemyData[]>('enemies.yaml').find((e) => e.id === 'hollow_seraph')!;
    const view = new AiEnemyView([boss], art);
    const sprites = view.build();
    layers.actors.addChild(...sprites);
    const hero = new Container();
    const p = partySpritePosition(j, { footRow: 76, scale: 2 });
    hero.addChild(new Sprite(new Texture({ source: new TextureSource({ width: 160, height: 160 }) })));
    hero.position.set(p.x, p.y);
    layers.actors.addChild(hero);
    const frames = art.getMonsterFrames('hollow_seraph')!;
    const name = (t: Texture): string => Object.entries(frames.textures).find(([, v]) => v === t)![0];
    let shown = '';
    view.pixels = (t) => cellPixels('hollow_seraph', name(t) === 'attack_raise' ? 'atk_wind2' : name(t)); // BattleArt's fallback
    view.update(1, sprites);
    let at: FxCuePoint | undefined;
    view.onCue = (_i, cue, _sprite, point) => { if (cue === 'hold') at = point; };
    view.playAttack(0, hero);
    for (let f = 0; f < 200 && !at; f++) {
      view.update(1, sprites);
      shown = name((sprites[0] as Sprite).texture);
    }
    expect(at, 'a hold cue with a point').toBeDefined();
    expect(shown).toBe('atk_wind2');
    const art0: [number, number] = [Math.round(at!.x * s.cell[0] - 0.5), Math.round(at!.y * s.cell[1] - 0.5)];
    const px = cellPixels('hollow_seraph', shown);
    expect(px.data[(art0[1] * px.w + art0[0]) * 4 + 3], `${art0} opaque in ${shown}`).toBeGreaterThan(0);
    const b = sprites[0].getBounds();
    expect(b.y + at!.y * b.height, 'the glint centre on screen').toBeGreaterThanOrEqual(BATTLE_MESSAGE_HEIGHT + 4);
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
