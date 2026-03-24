import { Graphics, Texture, RenderTexture, Application } from 'pixi.js';

export interface PlaceholderConfig {
  app: Application;
}

// Tile colors by terrain type ID (see TerrainType enum)
const TILE_COLORS: Record<number, number> = {
  0: 0x228b22, // Grass - green
  1: 0x404040, // Wall - dark gray
  2: 0x1e90ff, // Water - blue
  3: 0x8b6914, // Mountain - dark brown
  4: 0x006400, // Forest - dark green
  5: 0xdaa520, // Desert - sandy yellow
  6: 0x556b2f, // Swamp - purple-green
  7: 0x4169e1, // River - light blue
  8: 0xc2b280, // Road - tan
  9: 0x8b4513, // Bridge - wood brown
};
const DEFAULT_TILE_COLOR = 0x555555;

// NPC colors by sprite type
const NPC_COLORS: Record<string, number> = {
  shop: 0x00cc00,
  merchant: 0x00cc00,
  inn: 0xffcc00,
  innkeeper: 0xffcc00,
  hint: 0x4488ff,
  villager: 0x4488ff,
  quest: 0xff4444,
  king: 0xff4444,
  guard: 0x888888,
  mage: 0x9944ff,
  chest: 0xcc8833,
};
const DEFAULT_NPC_COLOR = 0xff6600;

export class PlaceholderTextures {
  private app: Application;
  private tileCache = new Map<number, Texture>();
  private playerTexture: Texture | null = null;
  private npcTextureCache = new Map<string, Texture>();

  constructor(config: PlaceholderConfig) {
    this.app = config.app;
  }

  getTileTexture(tileId: number): Texture {
    if (this.tileCache.has(tileId)) {
      return this.tileCache.get(tileId)!;
    }
    const color = TILE_COLORS[tileId] ?? DEFAULT_TILE_COLOR;
    const tex = this.createColoredRect(16, 16, color);
    this.tileCache.set(tileId, tex);
    return tex;
  }

  getPlayerTexture(): Texture {
    if (!this.playerTexture) {
      this.playerTexture = this.createPlayerSprite();
    }
    return this.playerTexture;
  }

  getNPCTexture(spriteType?: string): Texture {
    const key = spriteType ?? '';
    if (this.npcTextureCache.has(key)) {
      return this.npcTextureCache.get(key)!;
    }
    const color = (spriteType ? NPC_COLORS[spriteType] : undefined) ?? DEFAULT_NPC_COLOR;
    const tex = this.createColoredRect(16, 16, color);
    this.npcTextureCache.set(key, tex);
    return tex;
  }

  /** Create a transition indicator texture (bright marker) */
  getTransitionIndicatorTexture(): Texture {
    return this.createTransitionIndicator();
  }

  private createColoredRect(w: number, h: number, color: number): Texture {
    if (!this.app.renderer) return Texture.WHITE;
    const g = new Graphics();
    g.rect(0, 0, w, h).fill(color);
    const rt = RenderTexture.create({ width: w, height: h });
    this.app.renderer.render({ container: g, target: rt });
    return rt;
  }

  private createPlayerSprite(): Texture {
    if (!this.app.renderer) return Texture.WHITE;
    const g = new Graphics();
    // White outline for contrast
    g.rect(1, 1, 14, 15).fill(0xffffff);
    // Body (bright blue)
    g.rect(2, 6, 12, 10).fill(0x2266ff);
    // Head (lighter bright blue)
    g.rect(4, 2, 8, 6).fill(0x44aaff);
    const rt = RenderTexture.create({ width: 16, height: 16 });
    this.app.renderer.render({ container: g, target: rt });
    return rt;
  }

  private createTransitionIndicator(): Texture {
    if (!this.app.renderer) return Texture.WHITE;
    const g = new Graphics();
    // Semi-transparent bright green marker
    g.rect(0, 0, 16, 16).fill({ color: 0x00ff88, alpha: 0.5 });
    // Inner arrow-like highlight
    g.rect(4, 4, 8, 8).fill({ color: 0xffffff, alpha: 0.4 });
    const rt = RenderTexture.create({ width: 16, height: 16 });
    this.app.renderer.render({ container: g, target: rt });
    return rt;
  }
}
