import { describe, it, expect } from 'vitest';
import { battleBackgroundPath } from '../../src/rendering/BattleBackground.js';

describe('battle stage backgrounds', () => {
  it('builds the staged image path for a background id', () => {
    expect(battleBackgroundPath('grassland')).toBe('assets/backgrounds/grassland.webp');
    expect(battleBackgroundPath('river')).toBe('assets/backgrounds/river.webp');
  });
});
