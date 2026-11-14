import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CutsceneRegistry } from '../../src/systems/CutsceneRegistry.js';
import type { CutsceneScript } from '../../src/systems/CutsceneManager.js';
import type { AssetLoader } from '../../src/core/AssetLoader.js';

describe('CutsceneRegistry', () => {
  beforeEach(() => {
    CutsceneRegistry.clear();
  });

  it('returns undefined for unknown cutscene ID', () => {
    expect(CutsceneRegistry.get('nonexistent')).toBeUndefined();
  });

  it('registers and retrieves a cutscene script', () => {
    const script: CutsceneScript = [
      { type: 'dialog', text: 'Hello!' },
      { type: 'set_flag', flag: 'TEST_FLAG' },
    ];
    CutsceneRegistry.register('test_cutscene', script);
    expect(CutsceneRegistry.get('test_cutscene')).toEqual(script);
  });

  it('clear removes all registered scripts', () => {
    CutsceneRegistry.register('a', [{ type: 'dialog', text: 'A' }]);
    CutsceneRegistry.register('b', [{ type: 'dialog', text: 'B' }]);
    CutsceneRegistry.clear();
    expect(CutsceneRegistry.get('a')).toBeUndefined();
    expect(CutsceneRegistry.get('b')).toBeUndefined();
  });
});

describe('T2: CutsceneRegistry.init validates scripts', () => {
  beforeEach(() => CutsceneRegistry.clear());
  afterEach(() => { vi.restoreAllMocks(); });

  function assetsWith(data: unknown): AssetLoader {
    return { loadYaml: vi.fn().mockResolvedValue(data) } as unknown as AssetLoader;
  }

  it('keeps good scripts and logs and drops ones with unknown steps or malformed warps', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await CutsceneRegistry.init(assetsWith([
      { id: 'good', steps: [{ type: 'fade_out' }, { type: 'warp', map: 'cornelia-castle-2f', entrance: 'throne_return' }] },
      { id: 'typo', steps: [{ type: 'dialgo', text: 'x' }] },
      { id: 'bad_warp', steps: [{ type: 'warp', map: 'cornelia-castle-2f' }] },
    ]));
    expect(CutsceneRegistry.get('good')).toHaveLength(2);
    expect(CutsceneRegistry.get('typo')).toBeUndefined();
    expect(CutsceneRegistry.get('bad_warp')).toBeUndefined();
    expect(err).toHaveBeenCalledTimes(2);
  });

  it('the real cutscenes.yaml loads without errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { readFileSync } = await import('node:fs');
    const { parse } = await import('yaml');
    await CutsceneRegistry.init(assetsWith(parse(readFileSync('assets/data/cutscenes.yaml', 'utf8'))));
    expect(err).not.toHaveBeenCalled();
    expect(CutsceneRegistry.get('garland_defeated')).toBeDefined();
  });
});
