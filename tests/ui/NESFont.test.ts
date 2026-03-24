import { describe, it, expect } from 'vitest';
import { NES_FONT } from '../../src/ui/NESFont.js';

describe('NESFont', () => {
  it('exports a font name constant', () => {
    expect(NES_FONT).toBe('nes-font');
  });

  it('NES_FONT is a non-empty string', () => {
    expect(typeof NES_FONT).toBe('string');
    expect(NES_FONT.length).toBeGreaterThan(0);
  });
});
