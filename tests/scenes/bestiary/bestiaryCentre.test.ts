/**
 * TS-1 (docs/REDESIGN_PLAN.md 1): the bestiary preview centres every atlas sheet's idle figure (its `idleBox`, FW-A2,
 * at the sprite's global position and scale) on the preview panel's inner rect, centre (512, 498), within 1 px, and
 * centres the backdrop horizontally on the panel (D-V8).
 *
 * RED before the fix (measured 2026-11-16 at ea45746 with the idle boxes read from the atlas PNG, the figure centre
 * minus the panel centre): x +181 .. +208 for every one of the 123 sheets (baretta +181, sea_scorpion +208; goblin,
 * ogre, chaos, ashen_queen +199; warmech the only reach-clamped sheet, actors.x -7), y -21 .. +48 (ochre_jelly, shadow
 * -21; dragon +48, white_shark +46). The plan's pre-measure (+180 .. +217, -22 .. +47) used the layout formulae. The
 * figure sat where a lone battle enemy stands (screen x 710), and the backdrop was centred on the screen (x 960).
 *
 * Clamps: a sheet whose reach clamp (12d, the in-place lunge) or plain clamp (feet line inside y 360-770) binds is named
 * in CLAMPED with its shift; no silent exceptions. Measured at the fix: none. V6 (REDESIGN_PLAN 4.2, rev 17): chaos (C2,
 * idle 187 art px at scale 3 = 561 screen px) is clamped by the plain, feet at 770, centre 8.5 px above the panel's
 * (the plan's C2 estimate for 183 art px was -2).
 */
import { describe, it, expect } from 'vitest';
import { Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { BestiaryPreview, CachedArt, PREVIEW_INNER } from '../../../src/scenes/bestiary/BestiaryPreview.js';
import { BESTIARY_PLAIN, fitShift, panelCentre } from '../../../src/scenes/bestiary/bestiaryFit.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import { monsterSpriteKey } from '../../../src/rendering/BattleArt.js';
import { atlas, atlasArt, atlasFrames, enemyById, enemyData, frameBox, idleBoxOf, texScaleOf } from '../../helpers/atlasFrames.js';
import type { MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import type { MonsterFrames } from '../../../src/rendering/BattleArt.js';
import type { EnemyData } from '../../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const data = validateBestiary(parse(readFileSync(join(root, 'assets/data/bestiary.yaml'), 'utf-8')));
const [CX, CY] = panelCentre(PREVIEW_INNER);
/** Sheets whose clamp binds, with the measured shift of the figure centre from the panel centre. */
const CLAMPED: Record<string, { dx: number; dy: number }> = { chaos: { dx: 0, dy: -8.5 } };

/** One enemy per sheet and attack variant (the bestiaryReach loop). */
const variants = (() => {
  const seen = new Map<string, EnemyData>();
  for (const e of enemyData) {
    const k = [monsterSpriteKey(e), e.attackAnim ?? '', e.attack ?? ''].join('/');
    if (!seen.has(k) && atlas.sheets[monsterSpriteKey(e)]) seen.set(k, e);
  }
  return [...seen.entries()];
})();

const never = (): Promise<Texture> => new Promise<Texture>(() => {});

function figureCentre(preview: BestiaryPreview, sheet: string): [number, number] {
  const f = atlasFrames(sheet)!;
  const s = preview.enemySprite!;
  const g = s.getGlobalPosition();
  const scale = (s.scale.x / f.artScale) * f.scale;
  const [l, t, r, b] = idleBoxOf(sheet);
  return [g.x + ((l + r + 1) / 2) * scale, g.y + ((t + b + 1) / 2) * scale];
}

describe('the bestiary centres the idle figure in the preview panel (TS-1)', () => {
  it('the panel centre is (512, 498)', () => {
    expect([CX, CY]).toEqual([512, 498]);
  });

  it.each(variants)('%s: the idle figure centre is within 1 px of the panel centre', (key, e) => {
    const sheet = monsterSpriteKey(e);
    const preview = new BestiaryPreview(new Container(), new CachedArt(atlasArt), never, data);
    preview.show({ enemy: e, seen: true, hasSpells: false }, null);
    preview.update(0);
    const [x, y] = figureCentre(preview, sheet);
    const bound = preview.lastFit?.bound ?? [];
    if (bound.length) console.log(`bestiaryCentre clamp: ${key} ${bound.join('+')} dx ${x - CX} dy ${y - CY}`);
    const want = CLAMPED[sheet] ?? { dx: 0, dy: 0 };
    expect(Math.abs(x - CX - want.dx), `${sheet} x ${x - CX}`).toBeLessThanOrEqual(1);
    expect(Math.abs(y - CY - want.dy), `${sheet} y ${y - CY}`).toBeLessThanOrEqual(1);
    expect(bound.length > 0, `${sheet} clamped: ${bound.join()}`).toBe(sheet in CLAMPED);
    // the feet line stays on the battle plain
    const f = atlasFrames(sheet)!;
    const feet = preview.enemySprite!.getGlobalPosition().y + (f.footRow + 1) * f.scale;
    expect(feet).toBeGreaterThanOrEqual(BESTIARY_PLAIN.min);
    expect(feet).toBeLessThanOrEqual(BESTIARY_PLAIN.max);
    preview.destroy();
  });

  it('the backdrop is centred on the panel horizontally (D-V8), its vertical placement unchanged', async () => {
    const texture = new Texture({ source: new TextureSource({ width: 1920, height: 1080 }) });
    const preview = new BestiaryPreview(new Container(), new CachedArt(atlasArt), async () => texture, data);
    preview.show({ enemy: enemyById('goblin'), seen: true, hasSpells: false }, 'grassland');
    await new Promise((res) => setTimeout(res, 0));
    const bg = preview.stage.children.find((c): c is Sprite => c instanceof Sprite && c.texture === texture)!;
    expect(bg).toBeDefined();
    expect(bg.x + bg.width / 2).toBe(512);
    expect(bg.y).toBe(0);
    expect(bg.height).toBe(1080);
    preview.destroy();
  });
});

describe('fitShift clamps', () => {
  const f = { idleBox: [10, 10, 69, 76] as [number, number, number, number], footRow: 76 };
  it('the reach clamp bounds the shift right (the in-place lunge stays inside)', () => {
    const fit = fitShift(f, PREVIEW_INNER, { x: 0, y: 300, scale: 2, inPlaceRight: 1000, limitRight: 970 });
    expect(fit.dx).toBe(-30);
    expect(fit.bound).toEqual(['reach']);
  });
  it('the plain clamp keeps the feet line at or above y 770', () => {
    const tall = { idleBox: [0, 0, 10, 299] as [number, number, number, number], footRow: 299 };
    const fit = fitShift(tall, PREVIEW_INNER, { x: 400, y: 0, scale: 2, inPlaceRight: 0, limitRight: 970 });
    expect(fit.dy + 300 * 2).toBe(BESTIARY_PLAIN.max);
    expect(fit.bound).toEqual(['plain']);
  });
  it('without an idle box: the old placement (no centring, only the reach clamp)', () => {
    expect(fitShift({ footRow: 76 }, PREVIEW_INNER, { x: 0, y: 0, scale: 2, inPlaceRight: 980, limitRight: 970 }))
      .toEqual({ dx: -10, dy: 0, bound: ['reach'] });
  });
});

/**
 * Tier H and the titan (REDESIGN_PLAN 2.5, 4.2). Since V4 on the real data: the 22 tier-H enemies are `size: huge` and
 * their sheets (plus bigeyes) carry the FW-S `scale: 3`; each is centred and keeps the 12d reach rule over a full loop.
 * A titan of the C1 maximum (300 cell, feet row 292, idle 278 art px tall at scale 2; a fixture until the chaos titan
 * sheet is integrated) is clamped by the plain: feet at 770, 6 px above centre.
 */
describe('tier H and the titan in the bestiary', () => {
  const TIER_H = ['shark', 'minotaur', 'ochu', 'neochu', 'hydra', 'earth_elemental', 'fire_elemental', 'water_elemental',
    'air_elemental', 'hill_gigas', 'fire_gigas', 'ice_gigas', 'dragon', 'white_dragon', 'blue_dragon', 'green_dragon',
    'dragon_zombie', 'white_shark', 'minotaur_zombie', 'deepeyes', 'evil_eye', 'bigeyes'];
  const art: MonsterArtSource = atlasArt;

  it.each(TIER_H)('%s at scale 3: centred within 1 px, every frame of a full loop <= the inner right - 8', (id) => {
    const e = enemyById(id);
    const sheet = monsterSpriteKey(e);
    expect([e.size, atlas.sheets[sheet].scale]).toEqual([id === 'bigeyes' ? 'large' : 'huge', 3]);
    const preview = new BestiaryPreview(new Container(), new CachedArt(art), never, data);
    preview.show({ enemy: e, seen: true, hasSpells: false }, null);
    preview.update(0);
    const s = preview.enemySprite!;
    expect(s.scale.x * texScaleOf(sheet)).toBe(3);                 // int-ef2: blue / green_dragon drawn 1:1 from tex 3
    const [l, t, r, b] = idleBoxOf(sheet);
    const g = s.getGlobalPosition();
    expect(Math.abs(g.x + ((l + r + 1) / 2) * 3 - CX)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.y + ((t + b + 1) / 2) * 3 - CY)).toBeLessThanOrEqual(1);
    expect(preview.lastFit!.bound).toEqual([]);
    let attacks = 0;
    let last = '';
    let maxRight = -Infinity;
    for (let k = 0; k < 3000 && attacks < 2; k++) {
      preview.update(1);
      const step = preview.loopStep;
      if (step === 'attack' && last !== 'attack') attacks++;
      last = step;
      maxRight = Math.max(maxRight, s.getGlobalPosition().x + frameBox(sheet, preview.poses!.state(0).pose)[2] * 3);
    }
    expect(attacks).toBe(2);
    expect(maxRight).toBeLessThanOrEqual(PREVIEW_INNER.right - 8);
    preview.destroy();
  });

  it('EF-H amendment A: fire_hydra (tall frame) at scale 2: centred within 1 px, no bound, a full loop <= the inner right - 8', () => {
    const e = enemyById('fire_hydra');
    expect([e.size, atlas.sheets.fire_hydra.scale]).toEqual(['huge', 2]);
    const preview = new BestiaryPreview(new Container(), new CachedArt(art), never, data);
    preview.show({ enemy: e, seen: true, hasSpells: false }, null);
    preview.update(0);
    const s = preview.enemySprite!;
    expect(s.scale.x * texScaleOf('fire_hydra')).toBe(2);
    const [l, t, r, b] = idleBoxOf('fire_hydra');
    const g = s.getGlobalPosition();
    expect(Math.abs(g.x + ((l + r + 1) / 2) * 2 - CX)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.y + ((t + b + 1) / 2) * 2 - CY)).toBeLessThanOrEqual(1);
    expect(preview.lastFit!.bound).toEqual([]);
    let attacks = 0;
    let last = '';
    let maxRight = -Infinity;
    for (let k = 0; k < 3000 && attacks < 2; k++) {
      preview.update(1);
      const step = preview.loopStep;
      if (step === 'attack' && last !== 'attack') attacks++;
      last = step;
      maxRight = Math.max(maxRight, s.getGlobalPosition().x + frameBox('fire_hydra', preview.poses!.state(0).pose)[2] * 2);
    }
    expect(attacks).toBe(2);
    expect(maxRight).toBeLessThanOrEqual(PREVIEW_INNER.right - 8);
    preview.destroy();
  });

  it('a titan of the C1 maximum (278 art px) is clamped by the plain: feet at 770, shift -6', () => {
    const base = atlasFrames('chaos')!;
    // the C1 fixture is at scale 2 (the live chaos sheet is C2, scale 3, since V6)
    const titan: MonsterFrames = { ...base, scale: 2, artScale: (base.artScale * 2) / base.scale, cell: [300, 300], footRow: 292, idleBox: [21, 15, 278, 292], opaqueRight: 279,
      homeX: [21, 278], travelTop: 15, lungeRight: 280 };
    const e = { ...enemyById('chaos'), size: 'titan' as const };
    const preview = new BestiaryPreview(new Container(), new CachedArt({ getMonsterFrames: () => titan }), never, data);
    preview.show({ enemy: e, seen: true, hasSpells: false }, null);
    const g = preview.enemySprite!.getGlobalPosition();
    expect(g.y + 293 * 2).toBe(BESTIARY_PLAIN.max);
    expect(g.y + 15 * 2).toBeGreaterThanOrEqual(PREVIEW_INNER.top);
    expect(g.y + ((15 + 293) / 2) * 2 - CY).toBe(-6);
    expect(preview.lastFit!.bound).toEqual(['plain']);
    preview.destroy();
  });
});
