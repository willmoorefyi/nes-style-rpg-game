import { Graphics, Texture, RenderTexture, Application } from 'pixi.js';

export interface PlaceholderConfig {
  app: Application;
}

// Tile colors by ID
const TILE_COLORS: Record<number, number> = {
  1: 0x404040, // wall - dark gray
  2: 0x228b22, // ground/grass - green
  3: 0x8b4513, // door/special - brown
};
const DEFAULT_TILE_COLOR = 0x555555;

export class PlaceholderTextures {
  private app: Application;
  private tileCache = new Map<number, Texture>();
  private playerTexture: Texture | null = null;
  private npcTexture: Texture | null = null;

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

  getNPCTexture(): Texture {
    if (!this.npcTexture) {
      this.npcTexture = this.createColoredRect(16, 16, 0xff6600);
    }
    return this.npcTexture;
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
    // Body (blue)
    g.rect(2, 6, 12, 10).fill(0x4444ff);
    // Head (lighter blue)
    g.rect(4, 2, 8, 6).fill(0x6666ff);
    const rt = RenderTexture.create({ width: 16, height: 16 });
    this.app.renderer.render({ container: g, target: rt });
    return rt;
  }
}
