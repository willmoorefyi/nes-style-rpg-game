import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { CharacterAtlas, isPreviewAi } from '../../src/rendering/CharacterAtlas.js';

const legacyField = { cell: [16, 32], cols: 6, rows: 5, fieldScale: 3, rowNames: ['down', 'up', 'left', 'right', 'battle'], sheets: { knight: { x: 0, y: 0 } } };
const legacyBattle = { cell: [40, 46], scale: 3, poses: ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'], sheets: { knight: { row: 0 } } };
const aiBattle = { cell: [80, 80], scale: 2, footRow: 76, poses: ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'], sheets: { knight: { row: 0 } } };

function fakeTexture(): Texture {
  return { source: { scaleMode: 'linear', width: 2000, height: 2000 } } as unknown as Texture;
}

function respond(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body } as unknown as Response;
}

describe('CharacterAtlas AI battle atlas loading', () => {
  let aiResponse: () => Response;
  let aiFieldResponse: () => Response = () => respond('', false, 404);

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async () => fakeTexture() as never);
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      const file = path.split('/').pop();
      if (file === 'battle-characters-ai.json') return aiResponse();
      if (file === 'characters-ai.json') return aiFieldResponse();
      if (file === 'battle-characters.json') return respond(JSON.stringify(legacyBattle));
      if (file === 'characters.json') return respond(JSON.stringify(legacyField));
      return respond('', false, 404);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps legacy art when the AI atlas is missing (404)', async () => {
    aiResponse = () => respond('', false, 404);
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(atlas.isLoaded).toBe(true);
    expect(atlas.hasAiBattleArt).toBe(false);
    const art = atlas.getBattleFrames('knight', true);
    expect(art?.ai).toBe(false);
    expect(art?.frames).toHaveLength(6);
  });

  it('keeps legacy art when the dev server answers with an HTML fallback', async () => {
    aiResponse = () => respond('<!doctype html><html></html>');
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(atlas.isLoaded).toBe(true);
    expect(atlas.hasAiBattleArt).toBe(false);
  });

  it('uses AI frames only when preview is requested and the class has an AI sheet', async () => {
    aiResponse = () => respond(JSON.stringify(aiBattle));
    const atlas = new CharacterAtlas();
    await atlas.load();
    expect(atlas.hasAiBattleArt).toBe(true);
    const preview = atlas.getBattleFrames('knight', true)!;
    expect(preview.ai).toBe(true);
    expect(preview.footRow).toBe(76);
    expect(preview.frames[1].frame.x).toBe(160);
    expect(preview.frames[1].frame.width).toBe(160);
    expect(atlas.getBattleFrames('knight', false)!.ai).toBe(false);
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
      if (file === 'battle-characters.json') return respond(JSON.stringify(legacyBattle));
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
  it('is on only with ?art=ai', () => {
    expect(isPreviewAi('?art=ai')).toBe(true);
    expect(isPreviewAi('?art=legacy')).toBe(false);
    expect(isPreviewAi('')).toBe(false);
  });
});
