import { describe, it, beforeEach } from 'vitest';
import { AssetLoader } from '../../src/core/AssetLoader.js';

describe('AssetLoader', () => {
  let loader: AssetLoader;

  beforeEach(() => {
    loader = new AssetLoader();
  });

  it('initializes without manifest', async () => {
    await loader.init();
    // Should not throw
  });

  it('initializes only once', async () => {
    await loader.init();
    await loader.init(); // Second call should be no-op
  });

  it('can add bundles after init', async () => {
    await loader.init();
    // Should not throw
    loader.addBundle('test', [{ alias: 'sprite', src: 'test.png' }]);
  });
});