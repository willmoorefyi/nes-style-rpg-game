import { Container, Graphics, Sprite } from 'pixi.js';
import type { EnemyData } from '../../types/index.js';
import { battleArt, monsterSpriteKey, type MonsterFrames } from '../../rendering/BattleArt.js';
import { computeEnemyLayoutAi, type EnemyBox, type EnemySizeClass } from './EnemyLayoutAi.js';
import { EnemyPoseController, type Freeze } from './EnemyPoseController.js';
import { ENEMY_COLORS, DEFAULT_ENEMY_COLOR } from './BattleLayoutEngine.js';

/** Placeholder box sizes when no art is loaded yet (screen px, matches the 2x art bands). */
const PLACEHOLDER: Record<EnemySizeClass, number> = { small: 160, large: 256, boss: 400 };

/** D6: sleep and stun hold the base idle (still recoil when hit); stone shows no pose change at all. */
export function freezeOf(status: { has(effect: 'sleep' | 'stun' | 'stone'): boolean } | undefined): Freeze {
  if (!status) return 'none';
  return status.has('stone') ? 'stone' : status.has('sleep') || status.has('stun') ? 'still' : 'none';
}

/** Where monster frames come from (the shared atlas; tests inject their own). */
export interface MonsterArtSource {
  getMonsterFrames(sprite: string): MonsterFrames | null;
}

/**
 * Monster battle sprites: 2x art (or placeholder boxes) placed by computeEnemyLayoutAi with every foot on the battle
 * plain, posed and offset by EnemyPoseController (docs/ENEMY_ANIM_PLAN.md 6.2). The native atlas is scaled at runtime
 * (`artScale` x the layout factor, nearest). While an enemy lunges it is drawn above the other enemy sprites only (D5).
 */
export class AiEnemyView {
  readonly poses: EnemyPoseController;
  private frames: (MonsterFrames | null)[] = [];
  private base: { x: number; y: number }[] = [];
  private raised = -1;

  constructor(private readonly enemies: EnemyData[], private readonly art: MonsterArtSource = battleArt) {
    this.poses = new EnemyPoseController(enemies.length);
  }

  /** Build one sprite (or placeholder box) per enemy, in enemy order. */
  build(): Container[] {
    this.frames = this.enemies.map((e) => this.art.getMonsterFrames(monsterSpriteKey(e)));
    const boxes = computeEnemyLayoutAi(this.enemies.map((e, i) => {
      const size = e.size ?? 'small';
      const f = this.frames[i];
      return f ? { size, w: f.cell[0] * f.scale, h: f.cell[1] * f.scale } : { size, w: PLACEHOLDER[size], h: PLACEHOLDER[size] };
    }));
    this.base = [];
    return this.enemies.map((e, i) => {
      const f = this.frames[i];
      this.poses.configure(i, { hasCast: f?.hasCast ?? false, scaleFactor: boxes[i].scaleFactor,
        ...(f ? { lungePx: f.lungePx } : {}) });
      return this.buildOne(e, f, boxes[i]);
    });
  }

  /** The sprite has a boss cast keyframe (else a spell plays its attack frames, D4). */
  hasCast(i: number): boolean {
    return this.frames[i]?.hasCast ?? false;
  }

  hasArt(i: number): boolean {
    return this.frames[i] !== null && this.frames[i] !== undefined;
  }

  private buildOne(e: EnemyData, f: MonsterFrames | null, box: EnemyBox): Container {
    if (f) {
      const sprite = new Sprite(f.idle);
      const scale = f.scale * box.scaleFactor;
      sprite.scale.set(f.artScale * box.scaleFactor);
      const x = Math.round(box.x - (f.cell[0] * scale) / 2);
      const y = Math.round(box.feetY - (f.footRow + 1) * scale);
      sprite.position.set(x, y);
      this.base.push({ x, y });
      return sprite;
    }
    const g = new Graphics();
    g.rect(0, 0, box.w, box.h).fill(ENEMY_COLORS[e.name.toLowerCase()] ?? DEFAULT_ENEMY_COLOR);
    const pos = { x: box.x - box.w / 2, y: box.feetY - box.h };
    g.position.set(pos.x, pos.y);
    this.base.push(pos);
    return g;
  }

  /** Advance pose timers and apply each sprite's frame texture, integer offset, freeze (D6) and draw order (D5). */
  update(dt: number, sprites: Container[], frozen: readonly Freeze[] = []): void {
    for (let i = 0; i < sprites.length; i++) this.poses.setFreeze(i, frozen[i] ?? 'none');
    this.poses.update(dt);
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      const f = this.frames[i];
      const b = this.base[i];
      if (!sprite || !b) continue;
      const st = this.poses.state(i);
      if (f && sprite instanceof Sprite) sprite.texture = f.textures[st.pose];
      sprite.position.set(b.x + st.dx, b.y + st.dy);
    }
    const lunging = sprites.findIndex((_, i) => this.poses.isLunging(i));
    if (lunging >= 0 && lunging !== this.raised) {
      this.raise(lunging, sprites);
    } else if (lunging < 0 && this.raised >= 0) {
      this.restoreOrder(sprites);
    }
  }

  /** D5: move enemy i into the highest child slot held by any enemy sprite (never above anything else). */
  raise(i: number, sprites: Container[]): void {
    this.raised = i;
    this.reorder(sprites, (a, b) => (a === i ? 1 : b === i ? -1 : a - b));
  }

  /** Put the enemy sprites back in enemy-index order inside the child slots they occupy. */
  restoreOrder(sprites: Container[]): void {
    this.raised = -1;
    this.reorder(sprites, (a, b) => a - b);
  }

  private reorder(sprites: Container[], cmp: (a: number, b: number) => number): void {
    const parent = sprites.find((s) => s?.parent)?.parent;
    if (!parent) return;
    const idx = sprites.map((_, i) => i).filter((i) => sprites[i]?.parent === parent);
    const slots = idx.map((i) => parent.getChildIndex(sprites[i])).sort((a, b) => a - b);
    const want = [...idx].sort(cmp);
    if (want.every((e, k) => parent.getChildIndex(sprites[e]) === slots[k])) return;
    for (const i of idx) parent.removeChild(sprites[i]);
    want.forEach((e, k) => parent.addChildAt(sprites[e], slots[k]));
  }
}
