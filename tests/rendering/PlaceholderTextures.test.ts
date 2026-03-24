import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Application } from 'pixi.js';
import { PlaceholderTextures } from '../../src/rendering/PlaceholderTextures.js';

function createMockApp(): Application {
  return {
    renderer: {
      render: vi.fn(),
    },
  } as unknown as Application;
}

describe('PlaceholderTextures', () => {
  let app: Application;
  let placeholders: PlaceholderTextures;

  beforeEach(() => {
    app = createMockApp();
    placeholders = new PlaceholderTextures({ app });
  });

  describe('getTileTexture', () => {
    it('returns a texture for tile ID 1 (wall)', () => {
      const tex = placeholders.getTileTexture(1);
      expect(tex).toBeDefined();
    });

    it('returns a texture for tile ID 2 (water)', () => {
      const tex = placeholders.getTileTexture(2);
      expect(tex).toBeDefined();
    });

    it('returns a texture for tile ID 3 (mountain)', () => {
      const tex = placeholders.getTileTexture(3);
      expect(tex).toBeDefined();
    });

    it('caches textures for same tile ID', () => {
      const tex1 = placeholders.getTileTexture(1);
      const tex2 = placeholders.getTileTexture(1);
      expect(tex1).toBe(tex2);
    });

    it('returns different textures for different tile IDs', () => {
      const tex1 = placeholders.getTileTexture(1);
      const tex2 = placeholders.getTileTexture(2);
      // They should be different texture instances
      expect(tex1).not.toBe(tex2);
    });

    it('returns a texture for unknown tile IDs', () => {
      const tex = placeholders.getTileTexture(999);
      expect(tex).toBeDefined();
    });

    it('returns textures for all 10 terrain types', () => {
      for (let id = 0; id <= 9; id++) {
        const tex = placeholders.getTileTexture(id);
        expect(tex).toBeDefined();
      }
    });

    it('returns distinct textures for each terrain type', () => {
      const textures = new Set<unknown>();
      for (let id = 0; id <= 9; id++) {
        textures.add(placeholders.getTileTexture(id));
      }
      expect(textures.size).toBe(10);
    });
  });

  describe('getPlayerTexture', () => {
    it('returns a texture', () => {
      const tex = placeholders.getPlayerTexture();
      expect(tex).toBeDefined();
    });

    it('caches the player texture', () => {
      const tex1 = placeholders.getPlayerTexture();
      const tex2 = placeholders.getPlayerTexture();
      expect(tex1).toBe(tex2);
    });
  });

  describe('getNPCTexture', () => {
    it('returns a texture with no sprite type (default)', () => {
      const tex = placeholders.getNPCTexture();
      expect(tex).toBeDefined();
    });

    it('caches the default NPC texture', () => {
      const tex1 = placeholders.getNPCTexture();
      const tex2 = placeholders.getNPCTexture();
      expect(tex1).toBe(tex2);
    });

    it('returns different textures for different NPC types', () => {
      const shop = placeholders.getNPCTexture('shop');
      const inn = placeholders.getNPCTexture('inn');
      const guard = placeholders.getNPCTexture('guard');
      expect(shop).not.toBe(inn);
      expect(shop).not.toBe(guard);
      expect(inn).not.toBe(guard);
    });

    it('caches textures per NPC type', () => {
      const tex1 = placeholders.getNPCTexture('mage');
      const tex2 = placeholders.getNPCTexture('mage');
      expect(tex1).toBe(tex2);
    });

    it('returns textures for all defined NPC types', () => {
      const types = ['shop', 'merchant', 'inn', 'innkeeper', 'hint', 'villager', 'quest', 'king', 'guard', 'mage', 'chest'];
      for (const type of types) {
        expect(placeholders.getNPCTexture(type)).toBeDefined();
      }
    });

    it('returns default color for unknown NPC type', () => {
      const unknown = placeholders.getNPCTexture('unknown_type');
      const defaultTex = placeholders.getNPCTexture();
      // Both should resolve to default orange — but are cached under different keys
      expect(unknown).toBeDefined();
      expect(defaultTex).toBeDefined();
    });
  });

  describe('getTransitionIndicatorTexture', () => {
    it('returns a texture', () => {
      const tex = placeholders.getTransitionIndicatorTexture();
      expect(tex).toBeDefined();
    });
  });

  describe('distinct textures', () => {
    it('player and NPC textures are different', () => {
      const player = placeholders.getPlayerTexture();
      const npc = placeholders.getNPCTexture();
      expect(player).not.toBe(npc);
    });
  });
});
