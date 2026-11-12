import { Container, Graphics, Sprite } from 'pixi.js';
import type { EnemyData } from '../../types/index.js';
import { battleArt, monsterSpriteKey, type MonsterFrames } from '../../rendering/BattleArt.js';
import { computeEnemyLayoutAi, type EnemyBox, type EnemySizeClass } from './EnemyLayoutAi.js';
import { EnemyPoseController } from './EnemyPoseController.js';
import { ENEMY_COLORS, DEFAULT_ENEMY_COLOR } from './BattleLayoutEngine.js';

/** Placeholder box sizes when no art is loaded yet (screen px, matches the 2x art bands). */
const PLACEHOLDER: Record<EnemySizeClass, number> = { small: 160, large: 256, boss: 352 };

/**
 * Preview-mode (`?art=ai`) monster sprites: 2x art (or legacy stills) placed by computeEnemyLayoutAi with feet on a
 * shared line, posed and offset by EnemyPoseController. Normal play keeps BattleDisplayManager's legacy path.
 */
export class AiEnemyView {
  readonly poses: EnemyPoseController;
  private frames: (MonsterFrames | null)[] = [];
  private base: { x: number; y: number }[] = [];

  constructor(private readonly enemies: EnemyData[]) {
    this.poses = new EnemyPoseController(enemies.length);
  }

  /** Build one sprite (or placeholder box) per enemy, in enemy order. */
  build(): Container[] {
    this.frames = this.enemies.map((e) => battleArt.getMonsterFrames(monsterSpriteKey(e)));
    const boxes = computeEnemyLayoutAi(this.enemies.map((e, i) => {
      const size = e.size ?? 'small';
      const f = this.frames[i];
      return f ? { size, w: f.cell[0] * f.scale, h: f.cell[1] * f.scale } : { size, w: PLACEHOLDER[size], h: PLACEHOLDER[size] };
    }));
    this.base = [];
    return this.enemies.map((e, i) => this.buildOne(e, this.frames[i], boxes[i]));
  }

  hasArt(i: number): boolean {
    return this.frames[i] !== null && this.frames[i] !== undefined;
  }

  private buildOne(e: EnemyData, f: MonsterFrames | null, box: EnemyBox): Container {
    if (f) {
      const sprite = new Sprite(f.idle);
      const scale = f.scale * box.scaleFactor;
      sprite.scale.set(box.scaleFactor);
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

  /** Advance pose timers and apply pose texture + offset to each sprite. */
  update(dt: number, sprites: Container[]): void {
    this.poses.update(dt);
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      const f = this.frames[i];
      const b = this.base[i];
      if (!sprite || !b) continue;
      const st = this.poses.state(i);
      if (f && sprite instanceof Sprite) sprite.texture = f[st.pose];
      sprite.position.set(b.x + st.dx, b.y + st.dy);
    }
  }
}
