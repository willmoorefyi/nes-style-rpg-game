/**
 * Pass K atlas reading (docs/KNEEL_PLAN.md D-K7, D-K9, D-K13, section 3): MonsterPages.pin, BattleArt's `preload` and
 * `kneelSink` (both optional, read defensively), and the hero kneel columns with their `ready` fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Assets, type Texture } from 'pixi.js';
import { MonsterPages, PAGE_CACHE, type PageIo } from '../../src/rendering/MonsterPages.js';
import { BattleArt } from '../../src/rendering/BattleArt.js';
import { BATTLE_POSES, CharacterAtlas, POSE_FALLBACK, characterAtlas } from '../../src/rendering/CharacterAtlas.js';

const PAGES = [0, 1, 2, 3, 4, 5].map((i) => ({ file: `monsters-ai-${i}.png`, w: 2048, h: 2048 }));
const PAGE_OF: Record<string, number> = { goblin: 0, wolf: 1, zombie: 2, wraith: 3, ghost: 4, lich: 5 };
const tex = (): Texture => ({ source: { scaleMode: 'linear', width: 2048, height: 2048 } }) as unknown as Texture;

function fakeIo(): PageIo & { loads: string[]; unloads: string[] } {
  const io = { loads: [] as string[], unloads: [] as string[],
    async load(url: string): Promise<Texture> { io.loads.push(url); return tex(); },
    unload(url: string): void { io.unloads.push(url); } };
  return io;
}

function respond(body: string, ok = true): Response {
  return { ok, status: ok ? 200 : 404, text: async () => body } as unknown as Response;
}

describe('MonsterPages.pin (D-K13)', () => {
  it('pinned pages are never evicted and do not count against PAGE_CACHE', async () => {
    const io = fakeIo();
    const p = new MonsterPages('assets/sprites/', io);
    p.setIndex(PAGES, (s) => PAGE_OF[s]);
    p.pin([0, 1]);
    await p.ensurePages([0, 1]);
    for (const s of ['zombie', 'wraith', 'ghost', 'lich']) await p.ensure([s]);
    expect(p.loadedPages()).toEqual([0, 1, 4, 5]);             // the 2 pinned pages + PAGE_CACHE unpinned ones
    expect(io.unloads).toEqual(['assets/sprites/monsters-ai-2.png', 'assets/sprites/monsters-ai-3.png']);
    expect(PAGE_CACHE).toBe(2);
    expect([p.isPinned(0), p.isPinned(2)]).toEqual([true, false]);
  });

  it('without pins the LRU is unchanged (page 0 is evicted like any other); pin ignores unknown pages', async () => {
    const io = fakeIo();
    const p = new MonsterPages('assets/sprites/', io);
    p.setIndex(PAGES, (s) => PAGE_OF[s]);
    p.pin([-1, 9, 1.5]);
    for (const s of ['goblin', 'wolf', 'zombie', 'wraith']) await p.ensure([s]);
    expect(p.loadedPages()).toEqual([2, 3]);
    expect(io.unloads).toEqual(['assets/sprites/monsters-ai-0.png', 'assets/sprites/monsters-ai-1.png']);
  });
});

describe('BattleArt: preload and kneelSink', () => {
  const sheet = (page: number, extra: object = {}) => ({ page, cell: [80, 80], footRow: 76, floating: false,
    frames: { idle: [0, 0], attack: [80, 0], hurt: [160, 0] }, ...extra });
  let index: object;
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(characterAtlas, 'load').mockResolvedValue();
    vi.stubGlobal('fetch', vi.fn(async (path: string) =>
      (path.endsWith('monsters-ai.json') ? respond(JSON.stringify(index)) : respond('', false))));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('load() loads the index\'s preload pages (the act-1 pages) and pins them', async () => {
    index = { scale: 2, texScale: 1, pages: PAGES.slice(0, 4), preload: [0, 1],
      sheets: { goblin: sheet(0), wolf: sheet(1), zombie: sheet(2), wraith: sheet(3) } };
    const io = fakeIo();
    const art = new BattleArt(io);
    await art.load();
    expect(io.loads).toEqual(['assets/sprites/monsters-ai-0.png', 'assets/sprites/monsters-ai-1.png']);
    expect([art.pages.isPinned(0), art.pages.isPinned(1), art.pages.isPinned(2)]).toEqual([true, true, false]);
    expect(art.isReady('wolf')).toBe(true);                  // an act-1 sheet on page 1 never streams
  });

  it('an index without preload (today) loads page 0 only, unpinned; a bad preload is ignored', async () => {
    for (const preload of [undefined, 'x', [null, 'a']]) {
      index = { scale: 2, texScale: 1, pages: PAGES.slice(0, 2), ...(preload === undefined ? {} : { preload }),
        sheets: { goblin: sheet(0), wolf: sheet(1) } };
      const io = fakeIo();
      const art = new BattleArt(io);
      await art.load();
      expect(io.loads).toEqual(['assets/sprites/monsters-ai-0.png']);
      expect(art.pages.isPinned(0)).toBe(false);
    }
  });

  it('kneelSink is read when present and positive (floaters only); absent otherwise', async () => {
    index = { scale: 2, texScale: 1, pages: PAGES.slice(0, 1),
      sheets: { ghost: sheet(0, { floating: true, kneelSink: 6 }), goblin: sheet(0), bad: sheet(0, { kneelSink: 'x' }) } };
    const art = new BattleArt(fakeIo());
    await art.load();
    expect(art.getMonsterFrames('ghost')!.kneelSink).toBe(6);
    expect(art.getMonsterFrames('goblin')!.kneelSink).toBeUndefined();
    expect(art.getMonsterFrames('bad')!.kneelSink).toBeUndefined();
  });

  it('D-K7: a sheet without kneel frames slices them along the fallback chain (kneel -> daze, kneel_in1 -> idle)', async () => {
    index = { scale: 2, texScale: 1, pages: PAGES.slice(0, 1), sheets: { goblin: sheet(0, {
      frames: { idle: [0, 0], attack: [80, 0], hurt: [160, 0], daze: [240, 0], daze_b: [320, 0] } }) } };
    const art = new BattleArt(fakeIo());
    await art.load();
    const f = art.getMonsterFrames('goblin')!;
    expect([f.textures.kneel, f.textures.kneel_b, f.textures.kneel_in2, f.textures.kneel_in1].map((t) => t.frame.x)).toEqual([240, 320, 240, 0]);
  });
});

describe('CharacterAtlas: the hero kneel columns', () => {
  let poses: string[];
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async () => tex() as never);
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      const file = path.split('/').pop();
      if (file === 'battle-characters-ai.json') {
        return respond(JSON.stringify({ cell: [80, 80], scale: 2, footRow: 76, poses, sheets: { warrior: { row: 0 } } }));
      }
      return respond('', false);
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('BATTLE_POSES appends kneel_in1, kneel_in2, kneel, kneel_b; POSE_FALLBACK maps them to ready', () => {
    expect(BATTLE_POSES.slice(14)).toEqual(['kneel_in1', 'kneel_in2', 'kneel', 'kneel_b']);
    for (const p of ['kneel_in1', 'kneel_in2', 'kneel', 'kneel_b'] as const) expect(POSE_FALLBACK[p]).toBe('ready');
  });

  it('an atlas with the 4 kneel columns slices them; one without (today) shows ready there', async () => {
    poses = [...BATTLE_POSES];
    const a = new CharacterAtlas();
    await a.load();
    const own = a.getBattleFrames('warrior')!.frames;
    expect(own.slice(14).map((t) => t.frame.x / 160)).toEqual([14, 15, 16, 17]);
    poses = BATTLE_POSES.slice(0, 14);
    const b = new CharacterAtlas();
    await b.load();
    const old = b.getBattleFrames('warrior')!.frames;
    expect(old.slice(14).map((t) => t.frame.x)).toEqual([0, 0, 0, 0]);
    expect(old.slice(0, 14).map((t) => t.frame.x / 160)).toEqual([...Array(14).keys()]);
  });
});
