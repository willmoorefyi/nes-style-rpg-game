import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { BattleArt, monsterSpriteKey } from '../../src/rendering/BattleArt.js';

const aiMonsters = {
  scale: 2,
  sheets: {
    goblin: { cell: [80, 80], footRow: 76, floating: false, frames: { idle: [0, 0], attack: [80, 0], hurt: [160, 0] } },
  },
};

function fakeTexture(w = 96, h = 96): Texture {
  return { width: w, height: h, source: { scaleMode: 'linear', width: 2000, height: 2000 } } as unknown as Texture;
}

function respond(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body, json: async () => JSON.parse(body) } as unknown as Response;
}

describe('monsterSpriteKey', () => {
  it('uses the sprite name (so palette-swap variants get their own art), without an extension', () => {
    expect(monsterSpriteKey({ id: 'hobgoblin', sprite: 'goblin_red' })).toBe('goblin_red');
    expect(monsterSpriteKey({ id: 'goblin', sprite: 'goblin.png' })).toBe('goblin');
    expect(monsterSpriteKey({ id: 'goblin' })).toBe('goblin');
  });
});

describe('BattleArt monster frames', () => {
  let atlasJson: () => Response;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async () => fakeTexture() as never);
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      const file = path.split('/').pop();
      if (file === 'monsters-ai.json') return atlasJson();
      return respond('', false, 404);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('slices idle, attack and hurt at 2x with the atlas feet row; cast falls back to attack', async () => {
    atlasJson = () => respond(JSON.stringify(aiMonsters));
    const art = new BattleArt();
    await art.load();
    const f = art.getMonsterFrames('goblin')!;
    expect(f.scale).toBe(2);
    expect(f.footRow).toBe(76);
    expect(f.idle).not.toBe(f.attack);
    expect(f.attack.frame.x).toBe(160);
    expect(f.hurt.frame.x).toBe(320);
    expect(f.idle.frame.width).toBe(160);
    expect(f.cast.frame.x).toBe(f.attack.frame.x);
    expect(art.getMonsterFrames('wolf')).toBeNull();      // no art: the battle shows a placeholder box
  });

  it('a missing or broken atlas does not block battle', async () => {
    atlasJson = () => respond('<!doctype html>');
    const art = new BattleArt();
    await art.load();
    expect(art.isLoaded).toBe(true);
    expect(art.getMonsterFrames('goblin')).toBeNull();
  });
});
