import { describe, it, expect, beforeEach } from 'vitest';
import { CutsceneRegistry } from '../../src/systems/CutsceneRegistry.js';
import type { CutsceneScript } from '../../src/systems/CutsceneManager.js';

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
