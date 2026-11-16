/**
 * The bestiary preview's battle background (moved out of BestiaryPreview, docs/CHAOS_FORMS_PLAN.md 4.5): one staged
 * backdrop at the bottom of the stage, centred on the panel (D-V8). A newer request, or one after destroy, drops an
 * older load that resolves later (BESTIARY_PLAN 3.2).
 */
import { Sprite, type Container, type Texture } from 'pixi.js';
import { battleBackgroundPath } from '../../rendering/BattleBackground.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../../core/LayoutConstants.js';
import { backdropPosition } from './bestiaryFit.js';

type Inner = { left: number; top: number; right: number; bottom: number };

export class BestiaryBackdrop {
  private bg: Sprite | null = null;
  private bgId: string | null = null;
  private token = 0;
  private dead = false;

  constructor(private readonly stage: Container, private readonly loadTexture: (path: string) => Promise<Texture>,
    private readonly inner: Inner) {}

  /** Show background `id` (no-op when it is already shown). */
  set(id: string): void {
    if (id === this.bgId) return;
    this.bgId = id;
    const token = ++this.token;
    const path = battleBackgroundPath(id);
    this.loadTexture(path).then((texture) => {
      if (token !== this.token || this.dead) return;
      const sprite = new Sprite(texture);
      const scale = Math.max(GAME_WIDTH / texture.width, GAME_HEIGHT / texture.height);
      sprite.scale.set(scale);
      sprite.position.set(...backdropPosition(texture.width, texture.height, scale, this.inner, GAME_HEIGHT));
      this.bg?.destroy({ texture: false });
      this.bg = sprite;
      this.stage.addChildAt(sprite, 0);
    }).catch((err: unknown) => console.warn('Bestiary: failed to load the background', path, err));
  }

  /** Destroy the sprite (not the cached texture); later loads are dropped. */
  destroy(): void {
    this.dead = true;
    this.token++;
    this.bg?.destroy({ texture: false });
    this.bg = null;
    this.bgId = null;
  }
}
