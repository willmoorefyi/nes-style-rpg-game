/**
 * The flight view's billboard sprites (docs/MODE7_PLAN.md 5, M7-5): one Pixi sprite per field sprite that stands up
 * in the view (the parked vehicles, the world-map NPCs), placed by the pure `placeProps` (propMath.ts) and sorted by
 * their `depth` with the airship in the billboards' container. A billboard culled this frame is hidden and kept for
 * when it comes back; one whose field sprite is gone (an NPC that left, a vehicle boarded) is destroyed. The field's
 * textures are shared, never destroyed here.
 */
import { Sprite, type Container } from 'pixi.js';
import { FOG_ALPHA, FOG_ROWS } from './FlightSky.js';
import { horizonY, type ViewParams } from './mode7Math.js';
import { placeProps, type PropSource, type PropSprite } from './propMath.js';

export class FlightProps {
  private readonly pool = new Map<PropSprite, Sprite>();
  /** The billboards drawn on the last frame (the report). */
  drawn = 0;

  constructor(private readonly into: Container) {}

  draw(view: ViewParams, sources: readonly PropSource[]): void {
    const placed = placeProps(view, sources, horizonY(view), { rows: FOG_ROWS, alpha: FOG_ALPHA });
    const shown = new Set<PropSprite>();
    for (const { src, at } of placed) {
      const f = src.sprite;
      let s = this.pool.get(f);
      if (!s) {
        s = new Sprite(f.texture);
        s.label = 'mode7:prop';
        this.pool.set(f, s);
        this.into.addChild(s);
      }
      shown.add(f);
      s.texture = f.texture;
      s.tint = f.tint;
      s.anchor.set(f.anchor.x, f.anchor.y);
      s.scale.set(f.scale.x * at.m, f.scale.y * at.m);
      s.position.set(at.x, at.y);
      s.alpha = at.alpha;
      s.zIndex = at.depth;
      s.visible = true;
    }
    const live = new Set(sources.map((x) => x.sprite));
    for (const [f, s] of this.pool) {
      if (shown.has(f)) continue;
      s.visible = false;
      if (!live.has(f)) {
        s.destroy();
        this.pool.delete(f);
      }
    }
    this.drawn = placed.length;
  }

  /** Hide every billboard (no frame drew them). */
  clear(): void {
    for (const s of this.pool.values()) s.visible = false;
    this.drawn = 0;
  }
}
