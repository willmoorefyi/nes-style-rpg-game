import { Container, Graphics, Sprite } from 'pixi.js';
import type { EnemyData } from '../../types/index.js';
import { battleArt, monsterSpriteKey, type MonsterFrames } from '../../rendering/BattleArt.js';
import { computeEnemyLayoutAi, type EnemyBox, type EnemySizeClass } from './EnemyLayoutAi.js';
import { EnemyPoseController, type AttackPlan, type Posture, type PoseCue } from './EnemyPoseController.js';
import { ENEMY_COLORS, DEFAULT_ENEMY_COLOR } from './BattleLayoutEngine.js';
import { TRAVEL_HOP, enemyReach } from './enemyReach.js';
import { attackTable } from './enemyAttackTables.js';
import { BattleLayers } from './BattleLayers.js';
import { setTint, tintOf } from './actorTint.js';
import { stoneTextures } from './fx/stoneTextures.js';
import type { FxCuePoint } from './fx/index.js';

/** The heavy attack's red pulse during its held telegraph (actorTint `pulse`), on for 4 frames, off for 4; an enemy's
 *  `pulseTint` replaces it (the pale lich takes a lighter one, so it does not turn muddy). */
export const HOLD_PULSE_TINT = 0xffb0b0;
export const pulseTintOf = (e: Pick<EnemyData, 'pulseTint'> | undefined): number =>
  e?.pulseTint ? parseInt(e.pulseTint.slice(1), 16) : HOLD_PULSE_TINT;

/** Placeholder box sizes when no art is loaded yet (screen px, matches the 2x art bands). */
const PLACEHOLDER: Record<EnemySizeClass, number> = { small: 160, large: 256, boss: 400 };

/** Where monster frames come from (the shared atlas; tests inject their own). */
export interface MonsterArtSource {
  getMonsterFrames(sprite: string): MonsterFrames | null;
}

/**
 * Monster battle sprites: 2x art (or placeholder boxes) placed by computeEnemyLayoutAi with every foot on the battle
 * plain, posed and offset by EnemyPoseController (docs/ENEMY_ANIM_PLAN.md 6.2). The native atlas is scaled at runtime
 * (`artScale` x the layout factor, nearest). A melee enemy travels to the hero it attacks and back (pass F item 3)
 * and is drawn as the top actor meanwhile (D5'), below every effect and the message window; an in-place (ranged) attack
 * is drawn above the other enemy sprites only (D5). A heavy attack pulses red in its hold and shakes the screen on contact.
 */
export class AiEnemyView {
  readonly poses: EnemyPoseController;
  private frames: (MonsterFrames | null)[] = [];
  private base: { x: number; y: number }[] = [];
  private boxes: EnemyBox[] = [];
  private raised = -1;
  /** D5': the child slots the enemy sprites held before a travelling attacker was put on top (null: D5 or none). */
  private homeSlots: number[] | null = null;
  /** The sprites of the last update, so a pose cue can name the sprite it belongs to. */
  private sprites: Container[] = [];
  /** An attack cue with its enemy's sprite (the battle hands it to ActionFx.playCue), and for `hold` the raised
   *  weapon's tip (fractions of the sprite) when the atlas has it. */
  onCue: ((i: number, cue: PoseCue, sprite: Container, at?: FxCuePoint) => void) | null = null;

  constructor(private readonly enemies: EnemyData[], private readonly art: MonsterArtSource = battleArt) {
    this.poses = new EnemyPoseController(enemies.length);
    this.poses.onCue = (i, cue) => {
      const sprite = this.sprites[i];
      if (!sprite) return;
      if (cue === 'contact' && this.poses.attackKind(i) === 'heavy') BattleLayers.containing(sprite)?.shake.start();
      // a ranged attack (the dragon's breath) lands far from its feet: no impact dust
      if (cue === 'contact' && this.enemies[i]?.attack === 'ranged') return;
      const tip = cue === 'hold' ? this.frames[i]?.tip : undefined;
      const cell = this.frames[i]?.cell;
      this.onCue?.(i, cue, sprite, tip && cell ? { x: (tip[0] + 0.5) / cell[0], y: (tip[1] + 0.5) / cell[1] } : undefined);
    };
  }

  /** Enemy i attacks `target` (the hero's sprite, or null): melee enemies travel to it, ranged ones attack in place. */
  playAttack(i: number, target: Container | null): void {
    this.poses.playAttack(i, this.attackPlan(i, target));
  }

  /** The travel to `target` (0 for a ranged enemy, a placeholder box or no target), measured from home. */
  attackPlan(i: number, target: Container | null): AttackPlan {
    const f = this.frames[i];
    const box = this.boxes[i];
    const b = this.base[i];
    if (!target || !f || !box || !b || this.enemies[i]?.attack === 'ranged') return { travel: 0, rise: 0 };
    const t = target.getBounds();
    // the target's box in the actors layer's space (a running screen shake moves the layer, not the home positions)
    const origin = target.parent?.worldTransform ?? { tx: 0, ty: 0 };
    const scale = f.scale * box.scaleFactor;
    return enemyReach({ opaqueRight: b.x + (f.opaqueRight ?? f.cell[0]) * scale, feetY: box.feetY,
      lunge: f.lungePx * box.scaleFactor, targetLeft: t.x - origin.tx, targetFeetY: t.y + t.height - origin.ty });
  }

  /** Length in frames of enemy i's attack on `target` (the dev preview's loop). */
  attackLength(i: number, target: Container | null): number {
    const kind = this.enemies[i]?.attackAnim === 'heavy' ? 'heavy' : 'melee';
    const { travel } = this.attackPlan(i, target);
    return attackTable(kind === 'melee' && travel <= 0 ? 'inplace' : kind, travel).total;
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
    this.boxes = boxes;
    return this.enemies.map((e, i) => {
      const f = this.frames[i];
      this.poses.configure(i, { hasCast: f?.hasCast ?? false, hasRaise: f?.hasRaise ?? false, scaleFactor: boxes[i].scaleFactor,
        heavy: e.attackAnim === 'heavy', hopPx: TRAVEL_HOP[e.size ?? 'small'], ...(f ? { lungePx: f.lungePx } : {}) });
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

  /** Advance pose timers and apply each sprite's frame texture (a stoned enemy's grey copy, stoneTextures), integer
   *  offset, status posture (pass F item 5a: daze, stone, tremble) and draw order (D5). */
  update(dt: number, sprites: Container[], postures: readonly Posture[] = []): void {
    this.sprites = sprites;
    for (let i = 0; i < sprites.length; i++) this.poses.setPosture(i, postures[i] ?? 'none');
    this.poses.update(dt);
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      const f = this.frames[i];
      const b = this.base[i];
      if (!sprite || !b) continue;
      const st = this.poses.state(i);
      if (f && sprite instanceof Sprite) {
        const tex = f.textures[st.pose];
        sprite.texture = postures[i] === 'stone' ? stoneTextures.of(tex) : tex;
      }
      sprite.position.set(b.x + st.dx + (st.travelDx ?? 0), b.y + st.dy + (st.travelDy ?? 0));
      const hold = this.poses.holdFrame(i);
      const pulse = hold !== null && Math.floor(hold / 4) % 2 === 0 ? pulseTintOf(this.enemies[i]) : null;
      if (tintOf(sprite, 'pulse') !== pulse) setTint(sprite, 'pulse', pulse);
    }
    const lunging = sprites.findIndex((_, i) => this.poses.isLunging(i));
    if (lunging >= 0 && (lunging !== this.raised || this.isOnTopNow(lunging, sprites))) {
      if (this.raised >= 0 && lunging !== this.raised) this.restoreOrder(sprites);
      this.raise(lunging, sprites);
    } else if (lunging < 0 && this.raised >= 0) {
      this.restoreOrder(sprites);
    }
  }

  /** A travelling attacker that is not (any longer, e.g. after a sprite swap) the top child of its parent. */
  private isOnTopNow(i: number, sprites: Container[]): boolean {
    const s = sprites[i];
    return this.homeSlots !== null && !!s?.parent && s.parent.getChildIndex(s) !== s.parent.children.length - 1;
  }

  /** D5': a travelling (melee) attacker becomes the top child of its parent, above every actor (the effects and the
   *  message window are in later layers). D5: an in-place attacker takes the highest enemy slot only. */
  raise(i: number, sprites: Container[]): void {
    this.raised = i;
    const s = sprites[i];
    const parent = s?.parent;
    if (parent && this.poses.attackKind(i) !== 'inplace' && this.poses.attackKind(i) !== null) {
      this.homeSlots ??= sprites.filter((e) => e?.parent === parent).map((e) => parent.getChildIndex(e)).sort((a, b) => a - b);
      parent.setChildIndex(s, parent.children.length - 1);
      return;
    }
    this.reorder(sprites, (a, b) => (a === i ? 1 : b === i ? -1 : a - b));
  }

  /** Put the enemy sprites back in enemy-index order: into the slots they held before a D5' raise, else inside the
   *  child slots they occupy. */
  restoreOrder(sprites: Container[]): void {
    this.raised = -1;
    const slots = this.homeSlots;
    this.homeSlots = null;
    const parent = sprites.find((s) => s?.parent)?.parent;
    if (slots && parent) {
      const idx = sprites.map((_, i) => i).filter((i) => sprites[i]?.parent === parent);
      for (const i of idx) parent.removeChild(sprites[i]);
      idx.forEach((e, k) => parent.addChildAt(sprites[e], Math.min(slots[k] ?? parent.children.length, parent.children.length)));
      return;
    }
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
