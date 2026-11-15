/** FW-8 (docs/ROSTER_PLAN.md 8): BattleArt on a paged atlas: page 0 with the index, other pages on demand, the late-art
 *  path for a sprite whose page is not loaded, holds from the battle's enemy view and the bestiary cache, and
 *  triggerBattle opening the battle only after its pages loaded. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Texture } from 'pixi.js';
import { BattleArt } from '../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../src/rendering/CharacterAtlas.js';
import type { PageIo } from '../../src/rendering/MonsterPages.js';
import { AiEnemyView } from '../../src/scenes/battle/AiEnemyView.js';
import { CachedArt } from '../../src/scenes/bestiary/BestiaryPreview.js';
import { showWhenReady } from '../../src/scenes/bestiary/bestiaryPages.js';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import type { Game } from '../../src/core/Game.js';
import type { EnemyData } from '../../src/types/index.js';
import { createMockGame } from '../helpers/testUtils.js';

const sheet = (page: number, y: number) => ({ page, cell: [80, 80], footRow: 76, floating: false,
  frames: { idle: [0, y], attack: [80, y], hurt: [160, y] } });
const ATLAS = {
  scale: 2, texScale: 1,
  pages: [{ file: 'monsters-ai-0.png', w: 240, h: 160 }, { file: 'monsters-ai-1.png', w: 240, h: 80 }],
  sheets: { goblin: sheet(0, 0), wolf: sheet(0, 80), chaos: sheet(1, 0) },
};

function respond(body: string, ok = true): Response {
  return { ok, status: ok ? 200 : 404, text: async () => body } as unknown as Response;
}

function io(): PageIo & { loads: string[]; unloads: string[]; hold: Map<string, () => void> } {
  const o = {
    loads: [] as string[], unloads: [] as string[], hold: new Map<string, () => void>(),
    load(url: string): Promise<Texture> {
      o.loads.push(url);
      return new Promise<Texture>((resolve) => o.hold.set(url, () => resolve({ width: 240, height: 160,
        source: { scaleMode: 'linear', width: 240, height: 160 } } as unknown as Texture)));
    },
    unload(url: string): void { o.unloads.push(url); },
  };
  return o;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
/** Resolve every pending page load and let the promises settle. */
async function arrive(o: ReturnType<typeof io>): Promise<void> {
  await flush();
  for (const [url, go] of [...o.hold]) { o.hold.delete(url); go(); }
  await flush();
}
const enemy = (id: string): EnemyData => ({ id, name: id, size: 'small' }) as unknown as EnemyData;

describe('BattleArt on a paged atlas', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(characterAtlas, 'load').mockResolvedValue();
    vi.stubGlobal('fetch', vi.fn(async (path: string) =>
      (path.endsWith('monsters-ai.json') ? respond(JSON.stringify(ATLAS)) : respond('', false))));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('load() brings the index and page 0 only; another page loads on ensure', async () => {
    const o = io();
    const art = new BattleArt(o);
    const done = art.load();
    await arrive(o);
    await done;
    expect(o.loads).toEqual(['assets/sprites/monsters-ai-0.png']);
    expect(art.isReady('goblin')).toBe(true);
    expect(art.isReady('chaos')).toBe(false);
    const ensured = art.ensure(['chaos', 'goblin']);
    await arrive(o);
    await ensured;
    expect(o.loads).toEqual(['assets/sprites/monsters-ai-0.png', 'assets/sprites/monsters-ai-1.png']);
    expect(art.getMonsterFrames('chaos')?.idle.frame.y).toBe(0);
    expect(art.isLoaded).toBe(true);
  });

  it('a sprite whose page is not loaded: null (placeholder), one warning, its page starts loading and isLoaded waits for it', async () => {
    const o = io();
    const art = new BattleArt(o);
    const first = art.load();
    await arrive(o);
    await first;
    expect(art.getMonsterFrames('chaos')).toBeNull();
    expect(art.getMonsterFrames('chaos')).toBeNull();
    expect(vi.mocked(console.warn).mock.calls.filter((c) => String(c[0]).includes('"chaos"'))).toHaveLength(1);
    expect(o.loads).toContain('assets/sprites/monsters-ai-1.png');
    expect(art.isLoaded).toBe(false);                    // the battle's late-art path: load().then(upgradeToArt)
    let upgraded = false;
    void art.load().then(() => { upgraded = true; });
    await flush();
    expect(upgraded).toBe(false);
    await arrive(o);
    expect(upgraded).toBe(true);
    expect(art.getMonsterFrames('chaos')).not.toBeNull();
  });

  it('sprites asked for before the index arrived load with it (a debug battle opened from the title)', async () => {
    const o = io();
    const art = new BattleArt(o);
    expect(art.getMonsterFrames('chaos')).toBeNull();
    expect(art.isLoaded).toBe(false);
    const done = art.load();
    await arrive(o);
    await arrive(o);
    await done;
    expect(o.loads.sort()).toEqual(['assets/sprites/monsters-ai-0.png', 'assets/sprites/monsters-ai-1.png']);
    expect(art.getMonsterFrames('chaos')).not.toBeNull();
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
  });

  it("the enemy view holds its sprites' pages until release (rebuilds keep them held)", async () => {
    const o = io();
    const art = new BattleArt(o);
    const done = art.ensure(['goblin', 'chaos']);
    await arrive(o);
    await arrive(o);
    await done;
    const view = new AiEnemyView([enemy('goblin'), enemy('chaos')], art);
    view.build();
    view.build();
    expect([art.pages.refCount(0), art.pages.refCount(1)]).toEqual([1, 1]);
    view.release();
    expect([art.pages.refCount(0), art.pages.refCount(1)]).toEqual([0, 0]);
  });

  it('the bestiary cache holds the shown entry only and releases it on entry change; a not-ready sprite is not cached', async () => {
    const o = io();
    const art = new BattleArt(o);
    const first = art.load();
    await arrive(o);
    await first;
    const cache = new CachedArt(art);
    expect(cache.getMonsterFrames('chaos')).toBeNull();  // page 1 not loaded: asked again later
    expect(cache.size).toBe(0);
    await arrive(o);
    expect(cache.getMonsterFrames('chaos')).not.toBeNull();
    expect(art.pages.refCount(1)).toBe(1);
    cache.keepOnly(['goblin']);
    expect(art.pages.refCount(1)).toBe(0);
    cache.getMonsterFrames('goblin');
    cache.dispose();
    expect(art.pages.refCount(0)).toBe(0);
  });

  it('showWhenReady shows at once when ready, else after the page arrives (if still current), and prefetches neighbours', async () => {
    const o = io();
    const art = new BattleArt(o);
    const first = art.load();
    await arrive(o);
    await first;
    const shown: string[] = [];
    showWhenReady(art, 'goblin', ['chaos'], () => shown.push('goblin'), () => true);
    expect(shown).toEqual(['goblin']);
    await flush();
    expect(o.loads).toContain('assets/sprites/monsters-ai-1.png');   // the neighbour's page
    await arrive(o);
    expect(art.isReady('chaos')).toBe(true);
    art.pages.hold('goblin');
    const wait = new BattleArt(o);                                    // a fresh atlas: chaos's page not loaded yet
    const loaded = wait.load();
    await arrive(o);
    await loaded;
    showWhenReady(wait, 'chaos', [], () => shown.push('stale'), () => false);
    showWhenReady(wait, 'chaos', [], () => shown.push('chaos'), () => true);
    expect(shown).toEqual(['goblin']);                                // waits for the page
    await arrive(o);
    expect(shown).toEqual(['goblin', 'chaos']);
  });
});

describe('triggerBattle and the formation pages', () => {
  it('pushes the battle only after ensure(formation sprites) resolves', async () => {
    const game = createMockGame();
    const g = { ...game, party: { ...game.party, all: [{ name: 'Hero', currentHp: 1, maxHp: 1 }] } };
    g.data.loadEnemies.mockResolvedValue([{ id: 'gr_imp', sprite: 'gr_imp', name: 'Imp', stats: {} }]);
    let open!: () => void;
    const ensure = vi.fn(() => new Promise<void>((r) => { open = r; }));
    const trigger = new BattleTrigger(g as unknown as Game, { ensure });
    const run = trigger.triggerBattle(['gr_imp']);
    await flush();
    expect(ensure).toHaveBeenCalledWith(['gr_imp']);
    expect(g.scenes.push).not.toHaveBeenCalled();
    open();
    await run;
    expect(g.scenes.push).toHaveBeenCalledWith('battle');
  });
});
