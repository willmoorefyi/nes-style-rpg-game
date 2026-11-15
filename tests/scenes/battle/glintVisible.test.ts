/**
 * Browser re-test B: the heavy attack's glint played at the raised weapon's tip (Garland about (1332, 46), the lich
 * about (1030, 80)), under the top message window (y 0-120), so it was never seen. On the real layout and the committed
 * atlas: the glint's box never meets the message window, and its centre is on an opaque pixel of the raise frame on
 * the weapon (within a few px of the rig's weapon bone: Garland's blade hand_f-tip, the lich's glaive gh-gt). Since
 * the travel clamp (docs/ROSTER_FIX_PLAN.md defect 1) the raw tip itself no longer rises under the window.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Container, Graphics, Sprite, Texture, TextureSource } from 'pixi.js';
import { AiEnemyView, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { BattleActionFx } from '../../../src/scenes/battle/fx/ActionFx.js';
import { FxSource } from '../../../src/scenes/battle/fx/fxSource.js';
import { toFxData } from '../../../src/scenes/battle/fx/fxDefs.js';
import { validateSpellEffects } from '../../../src/core/schemaValidationFx.js';
import { BOSS_FRAMES, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import { BATTLE_MESSAGE_HEIGHT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { PARTY_FEET_Y, partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { GLINT_MIN_Y, walkToRow } from '../../../src/scenes/battle/glintPoint.js';
import type { Pixels } from '../../../src/scenes/battle/fx/texturePixels.js';
import type { FxCuePoint } from '../../../src/scenes/battle/fx/index.js';
import type { FxAtlasMeta } from '../../../src/scenes/battle/fx/fxAtlas.js';
import type { MonsterAtlasMeta, MonsterFrames } from '../../../src/rendering/BattleArt.js';
import type { EnemyData } from '../../../src/types/index.js';
import { monsterSheetPng } from '../../helpers/monsterAtlas.js';
import { monsterAnchors } from '../../../src/rendering/monsterAnchors.js';

const ATLAS = JSON.parse(readFileSync('assets/sprites/monsters-ai.json', 'utf-8')) as MonsterAtlasMeta;
const yaml = <T>(file: string): T => parse(readFileSync(`assets/data/${file}`, 'utf-8')) as T;
const ENEMIES = yaml<EnemyData[]>('enemies.yaml');

/** A cell of the atlas as Pixels (texScale 1: art px). */
function cellPixels(sprite: string, frame: MonsterFrame): Pixels {
  const s = ATLAS.sheets[sprite];
  const [x0, y0] = s.frames[frame]!;
  const [w, h] = s.cell;
  const PNG = monsterSheetPng(sprite);          // the sheet's atlas page (FW-8)
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) data[(y * w + x) * 4 + c] = PNG.data[((y0 + y) * PNG.width + x0 + x) * 4 + c];
  }
  return { data, w, h };
}

const art: MonsterArtSource = {
  getMonsterFrames(sprite: string): MonsterFrames | null {
    const s = ATLAS.sheets[sprite];
    if (!s) return null;
    const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n,
      new Texture({ source: new TextureSource({ width: s.cell[0], height: s.cell[1] }) })])) as Record<MonsterFrame, Texture>;
    return { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: ATLAS.scale,
      artScale: ATLAS.scale / (ATLAS.texScale ?? ATLAS.scale), cell: s.cell, footRow: s.footRow, floating: s.floating,
      hasCast: !!s.frames.cast, hasRaise: !!s.frames.attack_raise, lungePx: s.lungePx ?? 24, anim: true,
      ...(s.tip ? { tip: s.tip } : {}), ...monsterAnchors(s) };
  },
};

/** The rig's weapon bone in attack_raise (art px), from assets-src/gen/anim/monsters/<id>.yaml. */
const BONES: Record<string, [[number, number], [number, number]]> = {
  garland: [[92, 62], [171, 6]],  // blade: hand_f -> tip
  lich: [[118, 64], [20, 30]],    // glaive: gh -> gt
};
/** How far from the bone the weapon's pixels reach (Garland's blade is ~8 px wide; the lich's crescent blade ~20). */
const WEAPON_HALF: Record<string, number> = { garland: 6, lich: 12 };
const distToSegment = ([px, py]: [number, number], [[ax, ay], [bx, by]]: [[number, number], [number, number]]): number => {
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
};

/** The boss alone (f_heavy_garland, f_heavy_lich) attacking hero `j` (0: the top row, where the raised weapon is
 *  highest): its hold cue's point and the glint drawn there. */
function heldGlint(id: string, j: number) {
  const main = new Container();
  const layers = BattleLayers.of(main);
  const view = new AiEnemyView([ENEMIES.find((e) => e.id === id)!], art);
  view.pixels = () => cellPixels(id, 'attack_raise');
  const sprites = view.build();
  layers.actors.addChild(...sprites);
  const hero = new Graphics().rect(0, 0, 160, 160).fill(0x4488ff);
  const p = partySpritePosition(j, { footRow: 76, scale: 2 });
  hero.position.set(p.x, p.y);
  layers.actors.addChild(hero);
  view.update(1, sprites);
  let at: FxCuePoint | undefined;
  let cueSprite: Container | null = null;
  view.onCue = (_i, cue, sprite, point) => { if (cue === 'hold') { at = point; cueSprite = sprite; } };
  view.playAttack(0, hero);
  let rawTop = 0;
  for (let f = 0; f < 200 && !at; f++) { view.update(1, sprites); rawTop = sprites[0].getBounds().y; }
  expect(at, `${id}: a hold cue with a point`).toBeDefined();
  const s = ATLAS.sheets[id];
  const artPt: [number, number] = [Math.round(at!.x * s.cell[0] - 0.5), Math.round(at!.y * s.cell[1] - 0.5)];
  // the glint as ActionFx draws it, 4 frames into the hold
  const src = new FxSource();
  src.setData(toFxData(validateSpellEffects(yaml('spell-effects.yaml'))), ENEMIES);
  src.atlas.set(JSON.parse(readFileSync('assets/sprites/battle-fx.json', 'utf-8')) as FxAtlasMeta,
    new Texture({ source: new TextureSource({ width: 1024, height: 1024 }) }));
  const fx = new BattleActionFx(layers, src);
  fx.playCue('glint', cueSprite!, at);
  const boxes: { top: number; bottom: number }[] = [];
  for (let t = 0; t < 20; t++) {
    view.update(1, sprites);
    layers.update(1);
    for (const g of layers.fx.spell.children.flatMap((c) => c.children.filter((k): k is Sprite => k instanceof Sprite && k.visible))) {
      const b = g.getBounds();
      boxes.push({ top: b.y, bottom: b.y + b.height });
    }
  }
  return { artPt, boxes, cueTop: rawTop };
}

describe('re-test B: the glint is visible below the message window', () => {
  it.each(['garland', 'lich'].flatMap((id) => PARTY_FEET_Y.map((_, j) => [id, j] as const)))(
    '%s attacking hero %i: the glint box never meets the message window and sits on the weapon', (id, j) => {
      const { artPt, boxes, cueTop } = heldGlint(id, j);
      if (j === 0) expect(cueTop + ATLAS.sheets[id].tip![1] * 2, `${id}: the raw tip is clear of the window`).toBeGreaterThanOrEqual(BATTLE_MESSAGE_HEIGHT);
      expect(boxes.length).toBeGreaterThan(0);
      for (const b of boxes) expect(b.top, `${id} glint top`).toBeGreaterThanOrEqual(BATTLE_MESSAGE_HEIGHT);
      const px = cellPixels(id, 'attack_raise');
      expect(px.data[(artPt[1] * px.w + artPt[0]) * 4 + 3], `${id} ${artPt} opaque`).toBeGreaterThan(0);
      expect(distToSegment(artPt, BONES[id]), `${id} ${artPt} on the weapon`).toBeLessThanOrEqual(WEAPON_HALF[id]);
    });

  it('the tip stays where it is when it is clear of the window', () => {
    const px = cellPixels('garland', 'attack_raise');
    expect(walkToRow(px, [169, 5], 0)).toEqual([169, 5]);
  });

  it('Garland: the walk follows the blade down from the tip (every row on the blade line)', () => {
    const px = cellPixels('garland', 'attack_raise');
    for (let row = 10; row <= 56; row += 4) {
      const p = walkToRow(px, [169, 5], row)!;
      expect(p[1]).toBe(row);
      expect(distToSegment(p, BONES.garland), `row ${row}: ${p}`).toBeLessThanOrEqual(WEAPON_HALF.garland);
    }
  });

  it('GLINT_MIN_Y keeps the 22 px glint clear of the 120 px window', () => {
    expect(GLINT_MIN_Y - 11).toBeGreaterThan(BATTLE_MESSAGE_HEIGHT);
  });
});
