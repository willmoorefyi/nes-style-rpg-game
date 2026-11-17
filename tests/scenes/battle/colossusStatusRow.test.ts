/**
 * C6-6 (docs/CHAOS_FIX_PLAN.md 4.3, 5.7, D-C7-11): on a colossus the status icons draw at 3x native (36 px) on a
 * dark plate (0x101018, alpha 0.75, 4 px padding), so the row is 44 px tall; the head clamp keeps that row inside
 * y 140..760 and the target label (y >= 124) above it; the blind cloud sits beside the row, outside the core box (the
 * effect box centred on `core`). An atlas enemy keeps its 24 px row with no plate.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Container, Graphics, Sprite, Texture, TextureSource } from 'pixi.js';
import { BattleStatusFx } from '../../../src/scenes/battle/fx/statusFx.js';
import { FxAtlas, type FxAtlasMeta } from '../../../src/scenes/battle/fx/fxAtlas.js';
import {
  COLOSSUS_ICON_PX, COLOSSUS_PLATE, COLOSSUS_ROW_PX, ICON_LIFT, ICON_PX,
} from '../../../src/scenes/battle/fx/statusIcons.js';
import { colossusAt } from '../../../src/scenes/battle/colossus/colossusProxy.js';
import { screenAnchors, type ColossusFormSpec } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { BattleFieldTargeting } from '../../../src/scenes/battle/BattleFieldTargeting.js';
import { PANEL_FONT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { StatusEffect } from '../../../src/battle/StatusEffects.js';
import { colossusBattle, fixtureIndex, HORIZON, installFixtureArt } from '../../helpers/colossusFixture.js';
import { loadStatusVisuals } from '../../helpers/statusVisuals.js';
import { testEnemy } from '../../helpers/testUtils.js';

const VISUALS = loadStatusVisuals();
const META = JSON.parse(readFileSync(resolve(__dirname, '../../../assets/sprites/battle-fx.json'), 'utf8')) as FxAtlasMeta;

let uninstall: () => void = () => {};
beforeEach(async () => { uninstall = await installFixtureArt(); });
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

function withStatus(enemies?: Parameters<typeof colossusBattle>[0], statuses: StatusEffect[] = ['poison', 'blind']) {
  const s = colossusBattle(enemies);
  s.display.presented.enemies[0] = { ...s.display.presented.enemies[0], statuses };
  s.display.statusVisuals = () => VISUALS;
  const atlas = new FxAtlas();
  atlas.set(META, new Texture({ source: new TextureSource({ width: 2048, height: 2048 }) }));   // a blank page: real frame sizes
  const fx = new BattleStatusFx(s.layers, s.display, atlas, () => VISUALS);
  fx.sync();
  const c = fx.containerOf('enemy_0')!;
  const drawn = (k: Container): boolean => k.visible;
  const sprites = c.children.filter((k): k is Sprite => k instanceof Sprite && drawn(k));
  const inkTex = [atlas.texture('ink.blind', 0), atlas.texture('ink.blind', 1)];
  const icons = sprites.filter((k) => k.texture.frame.width === 24 && k.texture.frame.height === 24);   // the icon cells (12 native)
  const inks = () => sprites.filter((k) => k.visible && inkTex.includes(k.texture));
  const plates = c.children.filter((k): k is Graphics => k instanceof Graphics && k.label === 'fx.status.plate' && k.visible);
  return { s, fx, c, icons, inks, plates };
}

const bounds = (k: Container) => { const b = k.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
const meets = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.w && a.y < b.y + b.height && b.y < a.y + a.h;

describe('the colossus status row (C6-6)', () => {
  it('the sizes: 36 px icons, a 44 px row, the plate 0x101018 at 0.75 with 4 px padding', () => {
    expect(COLOSSUS_ICON_PX).toBe(36);
    expect(COLOSSUS_ROW_PX).toBe(44);
    expect(COLOSSUS_PLATE).toEqual({ color: 0x101018, alpha: 0.75, pad: 4 });
  });

  it('icons at 36 px on one dark plate that frames them with 4 px', () => {
    const { icons, plates } = withStatus();
    expect(icons).toHaveLength(2);
    for (const i of icons) expect(bounds(i).w).toBe(36);
    expect(plates).toHaveLength(1);
    const p = bounds(plates[0]);
    expect(p.h).toBe(44);
    const left = Math.min(...icons.map((i) => bounds(i).x));
    const right = Math.max(...icons.map((i) => bounds(i).x + bounds(i).w));
    expect(left - p.x).toBe(4);
    expect(p.x + p.w - right).toBe(4);
    for (const i of icons) expect(bounds(i).y - p.y).toBe(4);
    expect(plates[0].parent!.getChildIndex(plates[0])).toBeLessThan(Math.min(...icons.map((i) => i.parent!.getChildIndex(i))));
  });

  it('the plate row lies inside y 140..760 and its bottom is ICON_LIFT above the head', () => {
    const { s, plates } = withStatus();
    const p = bounds(plates[0]);
    expect(p.y).toBeGreaterThanOrEqual(140);
    expect(p.y + p.h).toBeLessThanOrEqual(760);
    expect(p.y + p.h).toBe(colossusAt(s.display.enemySprites[0])!.anchors().head.y - ICON_LIFT);
  });

  it('the head clamp keeps the 44 px row in 140..760 and room for the label above it (>= 124)', () => {
    const f: ColossusFormSpec = { ...fixtureIndex().forms[HORIZON] };
    f.anchors = { ...f.anchors, head: [1347, 10] };
    const head = screenAnchors(f).head.y;
    const top = head - ICON_LIFT - COLOSSUS_ROW_PX;
    expect(top).toBeGreaterThanOrEqual(140);
    expect(top - 4 - PANEL_FONT).toBeGreaterThanOrEqual(124);
    f.anchors = { ...f.anchors, head: [1347, 2000] };
    expect(screenAnchors(f).head.y).toBeLessThanOrEqual(760);
  });

  it('the target label sits above the plated row and at y >= 124', () => {
    const { s, plates } = withStatus();
    const t = new BattleFieldTargeting(s.layers.hud, s.battle, s.display, s.input as unknown as InputManager);
    expect(t.enterFieldTargeting(false, false, () => {}, () => {})).toBe(true);
    t.updateTargetVisuals();
    const y = t.targetLabel!.y;
    expect(y).toBeGreaterThanOrEqual(124);
    expect(y + PANEL_FONT).toBeLessThanOrEqual(bounds(plates[0]).y);
  });

  it('the blind cloud sits beside the row, outside the core box', () => {
    const { s, fx, inks, plates } = withStatus();
    const core = colossusAt(s.display.enemySprites[0])!.effectBox();
    const p = bounds(plates[0]);
    expect(inks()).toHaveLength(2);
    for (let t = 0; t < 240; t += 7) {
      fx.update(7);
      for (const k of inks()) {
        const b = bounds(k);
        expect(meets(b, core), JSON.stringify(b)).toBe(false);
        expect(meets(b, { x: p.x, y: p.y, width: p.w, height: p.h })).toBe(false);
        expect(b.y + b.h / 2).toBeGreaterThanOrEqual(p.y - 8);
        expect(b.y + b.h / 2).toBeLessThanOrEqual(p.y + p.h + 8);
      }
    }
  });

  it('an atlas enemy keeps 24 px icons and no plate', () => {
    const { icons, plates } = withStatus([testEnemy({ id: 'goblin', name: 'Goblin' })]);
    expect(icons.length).toBe(2);
    for (const i of icons) expect(bounds(i).w).toBe(ICON_PX);
    expect(plates).toHaveLength(0);
  });
});
