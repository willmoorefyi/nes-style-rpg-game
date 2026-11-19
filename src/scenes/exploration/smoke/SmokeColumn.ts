/**
 * SMOKE experiment: one smoke source drawn with an option of smokeStyles.ts. Every bitmap (puff radius x palette x
 * dither level, the glow sizes, the embers) is a GraphicsContext built once per option and art scale and shared; each
 * frame only swaps a puff's context and moves it, so a frame allocates nothing.
 */
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { cloudShape, glowShape, shapeRuns } from './smokeShapes.js';
import { GLOW_PALETTE, type SmokeStyle } from './smokeStyles.js';
import { createSmokeFrame, DITHER_LEVELS, smokeState, type SmokeFrame } from './smokeMotion.js';

interface StyleArt {
  /** puffs[palette][r - r0][level]; the last palette is the warm one when the style has it. */
  puffs: GraphicsContext[][][];
  glow: GraphicsContext[];
  embers: GraphicsContext[];
}

const cache = new Map<string, StyleArt>();

function bitmap(rows: string[], colours: readonly number[], px: number): GraphicsContext {
  const ctx = new GraphicsContext();
  const h = rows.length, w = rows[0]?.length ?? 0;
  for (const [x, y, len, k] of shapeRuns(rows)) {
    ctx.rect((x - w / 2) * px, (y - h / 2) * px, len * px, px).fill(colours[k]);
  }
  return ctx;
}

function styleArt(style: SmokeStyle, px: number): StyleArt {
  const key = `${style.id}@${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const palettes = style.warm ? [...style.palettes, style.warm] : [...style.palettes];
  const puffs = palettes.map((pal) => {
    const sizes: GraphicsContext[][] = [];
    for (let r = style.r0; r <= style.r1; r++) {
      const levels: GraphicsContext[] = [];
      for (let l = 0; l < DITHER_LEVELS; l++) {
        levels.push(bitmap(cloudShape(r, style.lobes, { outline: style.outline, level: l }), pal, px));
      }
      sizes.push(levels);
    }
    return sizes;
  });
  const glow = style.glow ? [[4, 2], [5, 3], [7, 4]].map(([rx, ry]) => bitmap(glowShape(rx, ry), GLOW_PALETTE, px)) : [];
  const embers = style.embers ? [['3'], ['2']].map((rows) => bitmap(rows, GLOW_PALETTE, px)) : [];
  const art = { puffs, glow, embers };
  cache.set(key, art);
  return art;
}

export class SmokeColumn {
  readonly root = new Container();
  private readonly art: StyleArt;
  private readonly frame: SmokeFrame;
  private readonly puffs: Graphics[];
  private readonly glow: Graphics | null;
  private readonly embers: Graphics[];

  /** `px`: screen px per art px. */
  constructor(private readonly style: SmokeStyle, private readonly px: number) {
    this.art = styleArt(style, px);
    this.frame = createSmokeFrame(style);
    this.root.sortableChildren = true;
    const first = this.art.puffs[0][0][0];
    this.glow = this.art.glow.length ? new Graphics(this.art.glow[0]) : null;
    if (this.glow) {
      this.glow.zIndex = 0;
      this.glow.position.set(0, px);
      this.root.addChild(this.glow);
    }
    this.puffs = Array.from({ length: style.puffs }, () => this.root.addChild(new Graphics(first)));
    this.embers = this.art.embers.length
      ? Array.from({ length: style.embers }, () => {
        const g = this.root.addChild(new Graphics(this.art.embers[0]));
        g.zIndex = 500;
        return g;
      })
      : [];
  }

  /** Draw the option at time `ms`. */
  draw(ms: number): void {
    const f = smokeState(this.style, ms, this.frame);
    const { px } = this;
    f.puffs.forEach((p, i) => {
      const g = this.puffs[i];
      g.visible = p.level < DITHER_LEVELS;
      if (!g.visible) return;
      const pal = p.palette < 0 ? this.art.puffs.length - 1 : p.palette;
      g.context = this.art.puffs[pal][p.r - this.style.r0][p.level];
      g.position.set(p.dx * px, p.dy * px);
      g.zIndex = 10 + Math.round((1 - p.u) * 100);
    });
    if (this.glow) {
      this.glow.visible = f.glow.size > 0;
      if (f.glow.size > 0) this.glow.context = this.art.glow[f.glow.size - 1];
    }
    f.embers.forEach((e, i) => {
      const g = this.embers[i];
      g.visible = e.visible;
      g.context = this.art.embers[e.hot];
      g.position.set(e.dx * px, e.dy * px);
    });
  }

  destroy(): void {
    this.root.destroy({ children: true });   // the shared contexts stay cached
  }
}
