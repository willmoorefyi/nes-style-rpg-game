/**
 * One smoke source drawn with a style of smokeStyles.ts. Every puff bitmap (radius x dither level) is a
 * GraphicsContext built once per style and art scale and shared; each frame only swaps a puff's context and moves it,
 * so a frame allocates nothing.
 */
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { cloudShape, shapeRuns } from './smokeShapes.js';
import type { SmokeStyle } from './smokeStyles.js';
import { createPuffs, DITHER_LEVELS, smokeState, type PuffState } from './smokeMotion.js';

/** contexts[r - r0][level] per style and art scale. */
const cache = new Map<SmokeStyle, Map<number, GraphicsContext[][]>>();

function bitmap(rows: string[], colours: readonly number[], px: number): GraphicsContext {
  const ctx = new GraphicsContext();
  const h = rows.length, w = rows[0]?.length ?? 0;
  for (const [x, y, len, k] of shapeRuns(rows)) {
    ctx.rect((x - w / 2) * px, (y - h / 2) * px, len * px, px).fill(colours[k]);
  }
  return ctx;
}

function styleArt(style: SmokeStyle, px: number): GraphicsContext[][] {
  let byPx = cache.get(style);
  if (!byPx) cache.set(style, (byPx = new Map()));
  const hit = byPx.get(px);
  if (hit) return hit;
  const sizes: GraphicsContext[][] = [];
  for (let r = style.r0; r <= style.r1; r++) {
    const levels: GraphicsContext[] = [];
    for (let l = 0; l < DITHER_LEVELS; l++) levels.push(bitmap(cloudShape(r, style.lobes, l), style.palette, px));
    sizes.push(levels);
  }
  byPx.set(px, sizes);
  return sizes;
}

export class SmokeColumn {
  readonly root = new Container();
  private readonly art: GraphicsContext[][];
  private readonly state: PuffState[];
  private readonly puffs: Graphics[];

  /** `px`: screen px per art px. */
  constructor(private readonly style: SmokeStyle, private readonly px: number) {
    this.art = styleArt(style, px);
    this.state = createPuffs(style);
    this.root.sortableChildren = true;
    this.puffs = this.state.map(() => this.root.addChild(new Graphics(this.art[0][0])));
  }

  /** Draw the smoke at time `ms`. */
  draw(ms: number): void {
    smokeState(this.style, ms, this.state).forEach((p, i) => {
      const g = this.puffs[i];
      g.visible = p.level < DITHER_LEVELS;
      if (!g.visible) return;
      g.context = this.art[p.r - this.style.r0][p.level];
      g.position.set(p.dx * this.px, p.dy * this.px);
      g.zIndex = Math.round((1 - p.u) * 100);           // the newest puff in front
    });
  }

  /** The puffs' state of the last draw (read-only; for tests and probes). */
  get puffStates(): readonly PuffState[] {
    return this.state;
  }

  destroy(): void {
    this.root.destroy({ children: true });   // the shared contexts stay cached
  }
}
