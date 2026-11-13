import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { stagedBackgroundPath } from '../../src/rendering/BattleBackground.js';
import { useAiBattleArt } from '../../src/core/artPreview.js';

describe('staged battle backgrounds', () => {
  it('maps legacy background paths to the staged image of the same id', () => {
    expect(stagedBackgroundPath('assets/backgrounds/grassland.png')).toBe('assets/backgrounds-ai/grassland.webp');
    expect(stagedBackgroundPath('assets/backgrounds/grassland-hd.png')).toBe('assets/backgrounds-ai/grassland.webp');
    expect(stagedBackgroundPath('/assets/backgrounds/temple.png')).toBe('assets/backgrounds-ai/temple.webp');
    expect(stagedBackgroundPath('somewhere/else.png')).toBeNull();
  });

  it('has a staged image for every background the maps can pick', () => {
    const ids = ['grassland', 'forest', 'desert', 'swamp', 'ocean', 'temple'];
    for (const id of ids) {
      expect(existsSync(resolve(__dirname, '../../', stagedBackgroundPath(`assets/backgrounds/${id}.png`)!)), id).toBe(true);
    }
  });

  it('2x battle art is the default; ?art=legacy turns it off', () => {
    expect(useAiBattleArt('')).toBe(true);
    expect(useAiBattleArt('?art=ai')).toBe(true);
    expect(useAiBattleArt('?mute=1&art=legacy')).toBe(false);
  });
});
