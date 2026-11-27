import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { BATTLE_POSES, CharacterAtlas, isPreviewAi } from '../../src/rendering/CharacterAtlas.js';

const legacyField = { cell: [16, 32], cols: 6, rows: 5, fieldScale: 3, rowNames: ['down', 'up', 'left', 'right', 'battle'], sheets: { knight: { x: 0, y: 0 } } };
const aiBattle = { cell: [80, 80], scale: 2, footRow: 76, poses: ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'], sheets: { knight: { row: 0 } } };

function fakeTexture(): Texture {
  return { source: { scaleMode: 'linear', width: 2000, height: 2000 } } as unknown as Texture;
}

function respond(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body } as unknown as Response;
}

describe('CharacterAtlas battle atlas loading', () => {
  let aiResponse: () => Response;
  let aiFieldResponse: () => Response = () => respond('', false, 404);

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async () => fakeTexture() as never);
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      const file = path.split('/').pop();
      if (file === 'battle-characters-ai.json') return aiResponse();
      if (file === 'characters-ai.json') return aiFieldResponse();
      if (file === 'characters.json') return respond(JSON.stringify(legacyField));
      return respond('', false, 404);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('has no battle art (placeholders) when the battle atlas is missing (404)', async () => {
    aiResponse = () => respond('', false, 404);
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(atlas.isLoaded).toBe(true);
    expect(atlas.hasBattleArt).toBe(false);
    expect(atlas.getBattleFrames('knight')).toBeNull();
  });

  it('treats a dev-server HTML fallback as a missing battle atlas', async () => {
    aiResponse = () => respond('<!doctype html><html></html>');
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(atlas.isLoaded).toBe(true);
    expect(atlas.hasBattleArt).toBe(false);
  });

  it('slices battle frames with the atlas feet row for classes that have a sheet', async () => {
    aiResponse = () => respond(JSON.stringify(aiBattle));
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(atlas.hasBattleArt).toBe(true);
    const art = atlas.getBattleFrames('knight')!;
    expect(art.footRow).toBe(76);
    expect(art.frames).toHaveLength(BATTLE_POSES.length);
    expect(art.frames[1].frame.x).toBe(160);
    expect(art.frames[1].frame.width).toBe(160);
    // an older 6-pose atlas: in-betweens fall back to their keyframe (atk_mid -> attack)
    expect(art.frames[BATTLE_POSES.indexOf('atk_mid')].frame.x).toBe(160);
    expect(atlas.getBattleFrames('ninja')).toBeNull();
  });

  // pass CL (docs/CLASS_LANCE_PLAN.md 3): an oversize class on its own page, sliced at its own cell and 6 x 3 grid
  const poses18 = [...BATTLE_POSES];
  const paged = {
    cell: [80, 80], scale: 2, footRow: 76, poses: poses18,
    pages: [{ file: 'battle-characters-ai.png', w: 2880, h: 160 }, { file: 'battle-characters-ai-1.png', w: 1920, h: 1728 },
      { file: 'battle-characters-ai-2.png', w: 2880, h: 320 }],
    sheets: { knight: { row: 0 }, lancer: { row: 1, page: 1, cell: [160, 144], footRow: 140, body: [72, 64, 80, 80],
      grid: [6, 3], reach: 4, heads: poses18.map(() => [110, 70]) },
      // pass CB A5 (docs/CLASS_BARBARIAN_PLAN.md 15): an 80 x 80 class on an overflow page (the main layout)
      shaman: { row: 1, page: 2 } },
  };

  it('A5: an overflow-page class slices at the main layout on its page and has no body / reach / top', async () => {
    aiResponse = () => respond(JSON.stringify(paged));
    const loads: string[] = [];
    vi.spyOn(Assets, 'load').mockImplementation(async (p: unknown) => { loads.push(String(p)); return fakeTexture() as never; });
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(loads.some((p) => p.endsWith('battle-characters-ai-2.png'))).toBe(true);
    const art = atlas.getBattleFrames('shaman')!;
    expect(art.cell).toEqual([80, 80]);
    expect(art.footRow).toBe(76);
    expect(art.body).toBeUndefined();
    expect(art.reach).toBeUndefined();
    expect(art.top).toBeUndefined();
    const f = (pose: string) => art.frames[BATTLE_POSES.indexOf(pose as never)].frame;
    const col = (pose: string) => poses18.indexOf(pose as never);
    expect([f('ready').x, f('ready').y, f('ready').width, f('ready').height]).toEqual([col('ready') * 160, 160, 160, 160]);
    expect([f('kneel_b').x, f('kneel_b').y]).toEqual([col('kneel_b') * 160, 160]);
  });

  it('slices a page sheet at its own cell and grid, with its body, feet row and reach; main classes as before', async () => {
    aiResponse = () => respond(JSON.stringify(paged));
    const loads: string[] = [];
    vi.spyOn(Assets, 'load').mockImplementation(async (p: unknown) => { loads.push(String(p)); return fakeTexture() as never; });
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(loads.some((p) => p.endsWith('battle-characters-ai-1.png'))).toBe(true);
    const art = atlas.getBattleFrames('lancer')!;
    expect(art).toMatchObject({ cell: [160, 144], footRow: 140, scale: 2, reach: 4, body: { x: 72, y: 64, w: 80, h: 80 } });
    const f = (pose: string) => art.frames[BATTLE_POSES.indexOf(pose as never)].frame;
    expect([f('ready').x, f('ready').y, f('ready').width, f('ready').height]).toEqual([0, 3 * 288, 320, 288]);
    expect([f('idle_b').x, f('idle_b').y]).toEqual([0, 4 * 288]);           // pose 6: the block's second row
    expect([f('kneel_b').x, f('kneel_b').y]).toEqual([5 * 320, 5 * 288]);   // pose 17: the last cell
    const knight = atlas.getBattleFrames('knight')!;
    expect(knight.body).toBeUndefined();
    expect(knight.cell).toEqual([80, 80]);
  });

  it('a page that fails to load leaves only its classes as placeholders (one console.error)', async () => {
    aiResponse = () => respond(JSON.stringify(paged));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async (p: unknown) => {
      if (String(p).endsWith('-1.png')) throw new Error('404');
      return fakeTexture() as never;
    });
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(atlas.getBattleFrames('lancer')).toBeNull();
    expect(atlas.getBattleFrames('knight')).not.toBeNull();
    expect(err).toHaveBeenCalledTimes(1);
  });
});

describe('CharacterAtlas AI field atlas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('serves AI field frames in preview and legacy frames otherwise; a broken AI field atlas keeps legacy', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async () => fakeTexture() as never);
    const aiField = { cell: [48, 96], cols: 3, rows: 4, fieldScale: 2, rowNames: ['down', 'up', 'left', 'right'], sheets: { knight: { x: 0, y: 0 } } };
    let fieldBody = JSON.stringify(aiField);
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      const file = path.split('/').pop();
      if (file === 'characters-ai.json') return respond(fieldBody);
      if (file === 'battle-characters-ai.json') return respond('', false, 404);
      if (file === 'characters.json') return respond(JSON.stringify(legacyField));
      return respond('', false, 404);
    }));
    const atlas = new CharacterAtlas();
    await atlas.load();
    const ai = atlas.getFieldArt('knight', true)!;
    expect(ai.ai).toBe(true);
    expect(ai.animation.frameWidth).toBe(96);
    expect(ai.animation.frameHeight).toBe(192);
    expect(atlas.getFieldArt('knight', false)!.ai).toBe(false);
    expect(atlas.getNpcFrames('knight', true)!.frames).toHaveLength(4);

    fieldBody = '<!doctype html>';
    const broken = new CharacterAtlas();
    await broken.load();
    expect(broken.isLoaded).toBe(true);
    expect(broken.hasAiFieldArt).toBe(false);
    expect(broken.getFieldArt('knight', true)!.ai).toBe(false);
  });
});

describe('isPreviewAi', () => {
  it('is on by default; ?art=legacy turns it off', () => {
    expect(isPreviewAi('?art=ai')).toBe(true);
    expect(isPreviewAi('?art=legacy')).toBe(false);
    expect(isPreviewAi('', true)).toBe(true);       // the game's default
    expect(isPreviewAi('?art=legacy', true)).toBe(false);
  });
});
