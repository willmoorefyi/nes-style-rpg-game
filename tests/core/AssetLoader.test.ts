import { describe, it, expect, beforeEach } from 'vitest';
import { AssetLoader } from '../../src/core/AssetLoader.js';

describe('AssetLoader', () => {
  let loader: AssetLoader;

  beforeEach(() => {
    loader = new AssetLoader();
  });

  it('initializes without manifest', async () => {
    await expect(loader.init()).resolves.toBeUndefined();
  });

  it('initializes only once', async () => {
    await loader.init();
    // Second call should resolve without error (no-op)
    await expect(loader.init()).resolves.toBeUndefined();
  });

  it('can add bundles after init', async () => {
    await loader.init();
    expect(() => {
      loader.addBundle('test', [{ alias: 'sprite', src: 'test.png' }]);
    }).not.toThrow();
  });
});
