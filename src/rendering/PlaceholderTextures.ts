import { Assets, Graphics, Texture, Rectangle, RenderTexture, Application } from 'pixi.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
import { characterAtlas, type FieldArt } from './CharacterAtlas.js';
import type { NPCFrames } from '../entities/NPC.js';

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
  10: 0xdeb887, // Counter - burlywood
  11: 0x2f6fb8, // Lake - deep blue (no row in the legacy terrain sheet)
};
const DEFAULT_TILE_COLOR = 0x555555;

/** Terrain sheet layout produced by assets-src/build_assets.py: rows = terrain type, columns = variants. */
/** Terrain sheet at the on-screen tile size: legacy 16 px tiles at 3x, or at 6x for the 96 px AI-preview tiles. */
const TERRAIN_SHEET_PATH = TILE_SIZE === 96 ? 'assets/sprites/terrain-6x.png' : 'assets/sprites/terrain.png';
const TERRAIN_VARIANTS = 4;
const TERRAIN_ROWS = 11;

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
  readonly characters = characterAtlas;
  private app: Application;
  private tileCache = new Map<number, Texture>();
  private terrainSheet: Texture | null = null;
  private playerTexture: Texture | null = null;
  private npcTextureCache = new Map<string, Texture>();

  constructor(config: PlaceholderConfig) {
    this.app = config.app;
  }

  /** Load generated art; on failure the colored-rectangle fallbacks stay in use. */
  async loadArt(): Promise<void> {
    await this.characters.load();
    try {
      const sheet = await Assets.load<Texture>(TERRAIN_SHEET_PATH);
      sheet.source.scaleMode = 'nearest';
      this.terrainSheet = sheet;
      this.tileCache.clear();
    } catch (err) {
      console.warn(`Terrain art unavailable (${TERRAIN_SHEET_PATH}); using placeholder tiles`, err);
    }
  }

  /** Tile IDs are terrain type + 1. Passing map coordinates picks a stable per-cell art variant. */
  getTileTexture(tileId: number, x = 0, y = 0): Texture {
    // Tile IDs are terrain type + 1 (offset so 0 = empty/skip in renderer)
    const terrainType = tileId - 1;
    const sheet = this.terrainSheet;
    if (sheet && terrainType >= 0 && terrainType < TERRAIN_ROWS) {
      const variant = (((x * 73856093) ^ (y * 19349663)) >>> 0) % TERRAIN_VARIANTS;
      const key = tileId * TERRAIN_VARIANTS + variant;
      const cached = this.tileCache.get(key);
      if (cached) return cached;
      const tex = new Texture({
        source: sheet.source,
        frame: new Rectangle(variant * TILE_SIZE, terrainType * TILE_SIZE, TILE_SIZE, TILE_SIZE),
      });
      this.tileCache.set(key, tex);
      return tex;
    }
    if (this.tileCache.has(tileId)) {
      return this.tileCache.get(tileId)!;
    }
    const color = TILE_COLORS[terrainType] ?? DEFAULT_TILE_COLOR;
    const tex = this.createColoredRect(TILE_SIZE, TILE_SIZE, color);
    this.tileCache.set(tileId, tex);
    return tex;
  }

  /** Art for the party leader's class, or null when the atlas is unavailable. */
  getPlayerArt(classId: string): FieldArt | null {
    return this.characters.getFieldArt(classId);
  }

  getNPCFrames(spriteType?: string): NPCFrames | null {
    return spriteType ? this.characters.getNpcFrames(spriteType) : null;
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
    const tex = this.createColoredRect(TILE_SIZE, TILE_SIZE, color);
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
    const fw = TILE_SIZE;
    const fh = TILE_SIZE;
    const sheetW = fw * 2;
    const sheetH = fh * 4;
    const g = new Graphics();
    // 4 directions (down=0, up=1, left=2, right=3), 2 frames each
    const dirColors = [0x2266ff, 0x44aaff, 0x22aa44, 0xaa4422];
    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < 2; frame++) {
        const ox = frame * fw;
        const oy = dir * fh;
        // White outline for contrast
        g.rect(ox + 1, oy + 1, fw - 2, fh - 1).fill(0xffffff);
        // Body
        g.rect(ox + 2, oy + Math.floor(fh * 0.375), fw - 4, Math.floor(fh * 0.625) - 1).fill(dirColors[dir]);
        // Head (slightly lighter for frame 1)
        const headColor = frame === 0 ? dirColors[dir] : (dirColors[dir] + 0x222222);
        g.rect(ox + Math.floor(fw * 0.25), oy + 2, Math.floor(fw * 0.5), Math.floor(fh * 0.375)).fill(headColor);
      }
    }
    // Directional arrows (white triangles, ~12px, centered on body area)
    const arrowSize = 12;
    const half = arrowSize / 2;
    for (let frame = 0; frame < 2; frame++) {
      const ox = frame * fw;
      const cx = ox + fw / 2; // horizontal center
      const bodyTop = Math.floor(fh * 0.375);
      const bodyBot = fh - 2;
      const cy = bodyTop + (bodyBot - bodyTop) * 0.65; // lower body area

      // Row 0: down
      g.poly([cx - half, 0 + cy - half, cx + half, 0 + cy - half, cx, 0 + cy + half]).fill(0xffffff);
      // Row 1: up
      g.poly([cx - half, fh + cy + half, cx + half, fh + cy + half, cx, fh + cy - half]).fill(0xffffff);
      // Row 2: left
      g.poly([cx + half, 2 * fh + cy - half, cx + half, 2 * fh + cy + half, cx - half, 2 * fh + cy]).fill(0xffffff);
      // Row 3: right
      g.poly([cx - half, 3 * fh + cy - half, cx - half, 3 * fh + cy + half, cx + half, 3 * fh + cy]).fill(0xffffff);
    }

    const rt = RenderTexture.create({ width: sheetW, height: sheetH });
    this.app.renderer.render({ container: g, target: rt });
    return rt;
  }

  private createTransitionIndicator(): Texture {
    if (!this.app.renderer) return Texture.WHITE;
    const g = new Graphics();
    // Semi-transparent bright green marker
    g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill({ color: 0x00ff88, alpha: 0.5 });
    // Inner arrow-like highlight
    g.rect(Math.floor(TILE_SIZE * 0.25), Math.floor(TILE_SIZE * 0.25), Math.floor(TILE_SIZE * 0.5), Math.floor(TILE_SIZE * 0.5)).fill({ color: 0xffffff, alpha: 0.4 });
    const rt = RenderTexture.create({ width: TILE_SIZE, height: TILE_SIZE });
    this.app.renderer.render({ container: g, target: rt });
    return rt;
  }
}
