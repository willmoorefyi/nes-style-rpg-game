/**
 * Draws an emitter frame (fx/emitters.ts) into a container: pooled sprites from the fx atlas at integer scales,
 * top-left corners snapped to the 2-px grid, stepped alpha, mirrored by a negative integer scale only (no rotation,
 * no filters). Without art each glyph is a rectangle of its colour in one Graphics.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/LayoutConstants.js';
import { snap2, stepAlpha, type FxDraw } from './emitterCore.js';
import type { FxAtlas } from './fxAtlas.js';

export class FxBatch {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];
  private fallback: Graphics | null = null;

  constructor(private readonly atlas: FxAtlas) {
    this.container.label = 'fx.effect';
  }

  render(draws: readonly FxDraw[]): void {
    let used = 0;
    this.fallback?.clear();
    for (const d of draws) {
      if (d.alpha <= 0) continue;
      const [cw, ch] = this.atlas.cell(d.key);
      const px = this.atlas.artScale * d.scale; // screen px per glyph pixel
      const w = cw * px;
      const h = ch * px;
      const left = snap2(d.x - w / 2);
      const top = snap2(d.y - h / 2);
      const tex = this.atlas.texture(d.key, d.frame);
      if (!tex) {
        this.fallback ??= this.container.addChild(new Graphics());
        this.fallback.rect(left + w / 4, top + h / 4, snap2(w / 2), snap2(h / 2)).fill({ color: this.atlas.color(d.key), alpha: stepAlpha(d.alpha) });
        continue;
      }
      let s = this.pool[used];
      if (!s) {
        s = new Sprite(tex);
        this.pool.push(s);
        this.container.addChild(s);
      }
      used++;
      s.texture = tex;
      s.visible = true;
      s.alpha = stepAlpha(d.alpha);
      s.scale.set(d.flipX ? -d.scale : d.scale, d.scale);
      s.position.set(d.flipX ? left + w : left, top);
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  /** Sprites currently drawn (tests). */
  get drawn(): number {
    return this.pool.filter((s) => s.visible).length;
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}

/** A full-screen tint (lightning) in the flash layer: one rectangle, stepped alpha, 0 hides it. */
export class ScreenTint {
  readonly g = new Graphics();
  constructor(private readonly color: number) {
    this.g.label = 'fx.screenTint';
  }

  set(alpha: number): void {
    this.g.clear();
    if (alpha > 0) this.g.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: this.color, alpha: stepAlpha(alpha) });
  }

  destroy(): void {
    this.g.parent?.removeChild(this.g);
    this.g.destroy();
  }
}
