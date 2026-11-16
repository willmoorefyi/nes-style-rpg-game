/**
 * TS-2 (docs/REDESIGN_PLAN.md 2.4, 2.5 rev 9) on a fixture atlas until FW-S lands: a sheet's own `scale` (3) replaces
 * the atlas `scale` (2) in BattleArt.getMonsterFrames, and its lunge (atlas `lungePx`, screen px at the atlas scale)
 * is scaled there once: 26 -> 39. The three readers get 39 and none multiplies again: the attack plan's reach
 * (`enemyReach`, spied), the pose controller (`configure`, spied) and the bestiary's phantom and in-place check. A
 * scale-3 sprite is drawn at scale 3 on a whole-px position; a sheet without `scale` is unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Container, Graphics, Texture, TextureSource } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { BattleArt, type MonsterFrames } from '../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../src/rendering/CharacterAtlas.js';
import type { PageIo } from '../../src/rendering/MonsterPages.js';
import { AiEnemyView } from '../../src/scenes/battle/AiEnemyView.js';
import { EnemyPoseController } from '../../src/scenes/battle/EnemyPoseController.js';
import * as reach from '../../src/scenes/battle/enemyReach.js';
import { BestiaryPreview, CachedArt, PREVIEW_INNER } from '../../src/scenes/bestiary/BestiaryPreview.js';
import { validateBestiary } from '../../src/core/bestiaryValidation.js';
import type { EnemyData } from '../../src/types/index.js';

vi.mock('../../src/scenes/battle/enemyReach.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/scenes/battle/enemyReach.js')>();
  return { ...real, enemyReach: vi.fn(real.enemyReach) };
});

const sheet = (y: number, extra: Record<string, unknown> = {}) => ({ page: 0, cell: [128, 128], footRow: 120, floating: false,
  lungePx: 26, opaqueRight: 100, homeX: [20, 99], idleBox: [20, 30, 99, 120], travelTop: 30,
  frames: { idle: [0, y], attack: [128, y], hurt: [256, y] }, ...extra });
const ATLAS = { scale: 2, texScale: 1, pages: [{ file: 'monsters-ai-0.png', w: 384, h: 256 }],
  sheets: { ogre: sheet(0), shark: sheet(128, { scale: 3 }) } };

const io: PageIo = { load: async () => new Texture({ source: new TextureSource({ width: 384, height: 256 }) }), unload: () => {} };
const enemy = (id: string, size: EnemyData['size']): EnemyData => ({ id, name: id, size, attack: 'melee' }) as unknown as EnemyData;

async function loaded(): Promise<BattleArt> {
  const art = new BattleArt(io);
  await art.ensure(['ogre', 'shark']);
  return art;
}

describe('per-sheet screen scale and the lunge scaled once (TS-2)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(characterAtlas, 'load').mockResolvedValue();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(ATLAS) }) as unknown as Response));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('getMonsterFrames: entry.scale ?? meta.scale; lungePx 26 -> 39 at scale 3, 26 without', async () => {
    const art = await loaded();
    const shark = art.getMonsterFrames('shark')!;
    const ogre = art.getMonsterFrames('ogre')!;
    expect([shark.scale, shark.artScale, shark.lungePx]).toEqual([3, 3, 39]);
    expect([ogre.scale, ogre.artScale, ogre.lungePx]).toEqual([2, 2, 26]);
    expect(shark.idleBox).toEqual([20, 30, 99, 120]);
  });

  it('AiEnemyView: the scale-3 sprite at scale 3 on whole px; configure and enemyReach receive 39', async () => {
    const art = await loaded();
    const configure = vi.spyOn(EnemyPoseController.prototype, 'configure');
    const view = new AiEnemyView([enemy('shark', 'huge'), enemy('ogre', 'large')], art);
    const sprites = view.build();
    expect(sprites[0].scale.x).toBe(3);
    expect(sprites[1].scale.x).toBe(2);
    for (const s of sprites) expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
    expect(configure.mock.calls[0][1].lungePx).toBe(39);
    expect(configure.mock.calls[1][1].lungePx).toBe(26);
    const parent = new Container();
    parent.addChild(...sprites);
    const hero = new Graphics().rect(0, 0, 160, 160).fill(0xffffff);
    hero.position.set(1500, 400);
    parent.addChild(hero);
    vi.mocked(reach.enemyReach).mockClear();
    view.attackPlan(0, hero);
    expect(vi.mocked(reach.enemyReach).mock.calls[0][0].lunge).toBe(39);
  });

  it('BestiaryPreview: the phantom and the in-place check read the same 39 (no second factor)', async () => {
    const art = await loaded();
    const data = validateBestiary(parse(readFileSync('assets/data/bestiary.yaml', 'utf-8')));
    const frames = new Map<string, MonsterFrames>();
    const spy = { getMonsterFrames: (s: string) => { const f = art.getMonsterFrames(s); if (f) frames.set(s, f); return f; } };
    const preview = new BestiaryPreview(new Container(), new CachedArt(spy), () => new Promise<Texture>(() => {}), data);
    preview.show({ enemy: enemy('shark', 'huge'), seen: true, hasSpells: false }, null);
    const f = frames.get('shark')!;
    expect(f.lungePx).toBe(39);
    // REACH_MARGIN 48 binds here (ART_MARGIN 12 + the attack's 1 px past the edge at scale 3 is less)
    expect(preview.phantomTarget.x).toBe(PREVIEW_INNER.right - 48 - reach.ENEMY_REACH_OVERLAP - 0.25 * 39);
    expect(preview.enemySprite!.scale.x).toBe(3);
    preview.destroy();
  });
});
