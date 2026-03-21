import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Texture, RenderTexture, Application } from 'pixi.js';
import { PlaceholderTextures } from '../../src/rendering/PlaceholderTextures.js';

function createMockApp(): Application {
  const mockRenderTexture = { width: 16, height: 16 } as RenderTexture;
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

    it('returns a texture for tile ID 2 (ground)', () => {
      const tex = placeholders.getTileTexture(2);
      expect(tex).toBeDefined();
    });

    it('returns a texture for tile ID 3 (door)', () => {
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
    it('returns a texture', () => {
      const tex = placeholders.getNPCTexture();
      expect(tex).toBeDefined();
    });

    it('caches the NPC texture', () => {
      const tex1 = placeholders.getNPCTexture();
      const tex2 = placeholders.getNPCTexture();
      expect(tex1).toBe(tex2);
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
