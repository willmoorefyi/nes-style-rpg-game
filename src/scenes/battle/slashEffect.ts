import { Container, Graphics } from 'pixi.js';

/** Three bright diagonal strokes across a target's art (a melee hit); the caller fades and removes it. */
export function slashEffect(target: Container): Graphics {
  const w = Math.max(48, target.width);
  const h = Math.max(48, target.height);
  const cx = target.x + w / 2;
  const cy = target.y + h / 2;
  const g = new Graphics();
  const len = Math.min(w, h) * 0.45;
  for (const off of [-0.18, 0, 0.18]) {
    const ox = off * w;
    g.moveTo(cx + ox + len, cy - len).lineTo(cx + ox - len, cy + len);
  }
  g.stroke({ width: 10, color: 0xffffff, alpha: 0.9 });
  for (const off of [-0.18, 0, 0.18]) {
    const ox = off * w;
    g.moveTo(cx + ox + len * 0.8, cy - len * 0.8).lineTo(cx + ox - len * 0.8, cy + len * 0.8);
  }
  g.stroke({ width: 4, color: 0xfff2a0, alpha: 1 });
  return g;
}
