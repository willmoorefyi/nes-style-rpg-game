/**
 * EF-A5 / A7 (docs/ENEMY_FEEDBACK_PLAN.md) on a fixture atlas: a hi-res sheet's own `texScale` (BattleArt slices its
 * rects at x * texScale and draws it at artScale = scale / texScale, 1 at full size), the per-page filter (a
 * `filter: linear` page gets linear sampling and mipmaps, every other page stays nearest), whole-px sprite positions
 * at scale 2.5, and the layout of the new tier: `medium` (capacity 2), a 2.5 `large` laid out as `huge`, pass 3 back
 * in the data class at screen scale 2, and pass 4 allowed for a 2.5 sheet but not for a scale-3 one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Texture, TextureSource } from 'pixi.js';
import { BattleArt } from '../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../src/rendering/CharacterAtlas.js';
import { applyPageFilter, type PageIo } from '../../src/rendering/MonsterPages.js';
import { enemyBoxInput, layoutSizeOfArt } from '../../src/rendering/monsterAnchors.js';
import { AiEnemyView } from '../../src/scenes/battle/AiEnemyView.js';
import { computeEnemyLayoutAi, formationFits, isTierScale, layoutPass, layoutSizeOf, type EnemyBoxInput } from '../../src/scenes/battle/EnemyLayoutAi.js';
import { TRAVEL_HOP } from '../../src/scenes/battle/enemyReach.js';
import { PLACEHOLDER } from '../../src/scenes/battle/formationCheck.js';
import type { EnemyData } from '../../src/types/index.js';

const sheet = (y: number, extra: Record<string, unknown> = {}) => ({ page: 0, cell: [80, 80], footRow: 76, floating: false,
  lungePx: 24, opaqueRight: 70, homeX: [10, 69], idleBox: [10, 12, 69, 76], travelTop: 12,
  frames: { idle: [0, y], attack: [80, y], hurt: [160, y] }, ...extra });
const ATLAS = { scale: 2, texScale: 1,
  pages: [{ file: 'monsters-ai-0.png', w: 240, h: 80 }, { file: 'monsters-ai-1.png', w: 610, h: 205, filter: 'linear' }],
  sheets: { goblin: sheet(0), imp: { ...sheet(0), page: 1, scale: 2.5, texScale: 2.5,
    frames: { idle: [2, 2], attack: [84, 2], hurt: [166, 2] } } } };

const loads: Texture[] = [];
const io: PageIo = { load: async () => { const t = new Texture({ source: new TextureSource({ width: 610, height: 205 }) }); loads.push(t); return t; },
  unload: () => {} };
const enemy = (id: string, size: EnemyData['size']): EnemyData => ({ id, name: id, size, attack: 'melee' }) as unknown as EnemyData;

describe('a hi-res sheet in BattleArt and MonsterPages (EF-A5)', () => {
  beforeEach(() => {
    loads.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(characterAtlas, 'load').mockResolvedValue();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(ATLAS) }) as unknown as Response));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('slices at the sheet texScale: rects x * 2.5, size ceil(cell * 2.5), artScale 1; the native sheet unchanged', async () => {
    const art = new BattleArt(io);
    await art.ensure(['goblin', 'imp']);
    const imp = art.getMonsterFrames('imp')!;
    const gob = art.getMonsterFrames('goblin')!;
    expect([imp.scale, imp.artScale, imp.lungePx]).toEqual([2.5, 1, 30]);
    expect([imp.attack.frame.x, imp.attack.frame.y, imp.attack.frame.width, imp.attack.frame.height]).toEqual([210, 5, 200, 200]);
    expect([gob.scale, gob.artScale, gob.attack.frame.x, gob.attack.frame.width]).toEqual([2, 2, 80, 80]);
    expect([imp.footRow, imp.cell, imp.idleBox]).toEqual([76, [80, 80], [10, 12, 69, 76]]);   // anchors stay native
  });

  it('a linear page gets linear sampling and mipmaps; a native page stays nearest', async () => {
    const art = new BattleArt(io);
    await art.ensure(['goblin', 'imp']);
    const linear = art.pages.texture(1)!.source;
    const native = art.pages.texture(0)!.source;
    expect([linear.scaleMode, linear.mipmapFilter, linear.autoGenerateMipmaps]).toEqual(['linear', 'linear', true]);
    expect([native.scaleMode, native.autoGenerateMipmaps]).toEqual(['nearest', false]);
    const t = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
    applyPageFilter(t, false);
    expect(t.source.scaleMode).toBe('nearest');
  });

  it('AiEnemyView draws the 2.5 sprite at 2.5 screen px per art px on whole px, as the medium tier', async () => {
    const art = new BattleArt(io);
    await art.ensure(['goblin', 'imp']);
    const view = new AiEnemyView([enemy('imp', 'small'), enemy('goblin', 'small')], art);
    const sprites = view.build();
    expect(sprites[0].scale.x).toBe(1);            // texScale 2.5 drawn 1:1
    expect(sprites[1].scale.x).toBe(2);
    for (const s of sprites) expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
    const f = art.getMonsterFrames('imp')!;
    expect(layoutSizeOfArt('small', f)).toBe('medium');
    expect(enemyBoxInput('medium', f, 'small')).toMatchObject({ size: 'medium', dataSize: 'small', w: 200, h: 200, scale: 2.5 });
  });
});

describe('the medium tier and the 2.5 passes (EF-A5)', () => {
  const med = (): EnemyBoxInput => ({ size: 'medium', dataSize: 'small', w: 200, h: 200, scale: 2.5 });
  const big = (): EnemyBoxInput => ({ size: 'huge', dataSize: 'large', w: 320, h: 320, scale: 2.5 });
  const small = (): EnemyBoxInput => ({ size: 'small', w: 160, h: 160, scale: 2 });

  it('layoutSizeOf: a 2.5 small is medium, a 2.5 large is huge; scale 2 and 3 keep their classes', () => {
    expect([layoutSizeOf('small', 2.5), layoutSizeOf('large', 2.5), layoutSizeOf(undefined, 2.5), layoutSizeOf('huge', 2.5)])
      .toEqual(['medium', 'huge', 'medium', 'huge']);
    expect([layoutSizeOf('small', 2), layoutSizeOf('large', 3), layoutSizeOf('boss', 3)]).toEqual(['small', 'large', 'titan']);
    expect([TRAVEL_HOP.medium, PLACEHOLDER.medium]).toEqual([TRAVEL_HOP.small, 200]);
  });

  it('two medium boxes share a column (capacity 2), a third starts a new one; full size at pass 1', () => {
    const out = computeEnemyLayoutAi([med(), med(), med()]);
    expect(out[0].x).toBe(out[1].x);
    expect(out[2].x).not.toBe(out[0].x);
    expect(out.every((b) => b.scaleFactor === 1)).toBe(true);
    expect(layoutPass([med(), med(), med()])).toBe(1);
  });

  it('a 2.5 large is laid out alone in its column (huge, capacity 1)', () => {
    const out = computeEnemyLayoutAi([big(), big()]);
    expect(out[0].x).not.toBe(out[1].x);
  });

  it('pass 3 shrinks every sheet over 2 to screen scale 2 in its data class: four 2.5 larges stack 2 to a column', () => {
    const boxes = Array.from({ length: 4 }, big);
    const out = computeEnemyLayoutAi(boxes);
    expect(layoutPass(boxes)).toBe(3);                                      // 4 x 320 px huge columns are too wide
    expect(out.every((b) => b.scaleFactor === 0.8 && b.w === 256)).toBe(true);   // 2.5 x 0.8 = screen scale 2
    expect(new Set(out.map((b) => b.x)).size).toBe(2);                      // as `large`: 2 columns of 2
    expect(formationFits(boxes)).toBe(true);
    const nine = Array.from({ length: 9 }, med);
    expect(layoutPass(nine)).toBe(1);                                       // nine 200 px mediums fit at full size
  });

  it('a mixed formation: a 2.5 large, two mediums and scale-2 smalls fit', () => {
    const boxes = [big(), med(), med(), small(), small()];
    expect(formationFits(boxes)).toBe(true);
    const out = computeEnemyLayoutAi(boxes);
    expect(out[1].x).toBe(out[2].x);
  });

  it('pass 4 is allowed for 2.5 sheets (as for scale 2), refused for a scale-3 sheet', () => {
    const bigs = Array.from({ length: 9 }, big);
    expect(layoutPass(bigs)).toBe(4);
    expect(formationFits(bigs)).toBe(true);
    const threes: EnemyBoxInput[] = Array.from({ length: 9 }, () => ({ size: 'huge', w: 384, h: 384, scale: 3 }));
    expect(layoutPass(threes)).toBe(4);
    expect(formationFits(threes)).toBe(false);
  });
});

describe('int-ef2: scales on the 0.05 grid (2.7, 2.8, 3.3) are tier scales', () => {
  it('isTierScale: over 2 and not the V4 integer 3; a 3.3 large is huge, a 3.3 small medium; 3 keeps its classes', () => {
    expect([2, 2.05, 2.5, 2.7, 2.8, 3, 3.3, 3.5].map(isTierScale)).toEqual([false, true, true, true, true, false, true, true]);
    expect([layoutSizeOf('large', 3.3), layoutSizeOf('small', 3.3), layoutSizeOf('large', 2.8), layoutSizeOf('large', 3)])
      .toEqual(['huge', 'medium', 'huge', 'large']);
    expect([layoutSizeOf('boss', 3.3), layoutSizeOf('boss', 3)]).toEqual(['boss', 'titan']);   // the boss rule stays at 3
  });

  it('pass 3 takes a 3.3 sheet to screen scale 2; pass 4 is allowed for it (mipmapped linear page)', () => {
    const iron = (): EnemyBoxInput => ({ size: 'huge', dataSize: 'large', w: 330, h: 321, scale: 3.3 });
    const four = Array.from({ length: 4 }, iron);
    expect(layoutPass(four)).toBe(3);
    expect(computeEnemyLayoutAi(four).every((b) => Math.abs(b.w - 200) < 1e-9)).toBe(true);   // 330 x 2 / 3.3
    const cell = (): EnemyBoxInput => ({ size: 'huge', dataSize: 'large', w: 422.4, h: 422.4, scale: 3.3 });   // uncut 128 px
    const nine = Array.from({ length: 9 }, cell);
    expect([layoutPass(nine), formationFits(nine)]).toEqual([4, true]);
    expect(formationFits(Array.from({ length: 9 }, () => ({ ...cell(), size: 'large' as const, dataSize: undefined, scale: 3 }))))
      .toBe(false);                                                         // the same at the V4 integer 3: refused
  });
});
