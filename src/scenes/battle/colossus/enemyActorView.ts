/**
 * EnemyActorView (docs/CHAOS_FORMS_PLAN.md 4.3): the one pose interface the battle drives for every enemy. An atlas
 * enemy is posed by EnemyPoseController; a colossus by its ColossusPoseController. EnemyActorPoses is the thin adapter:
 * it is the AiEnemyView's pose controller, and an index with an attached colossus routes every call to it, so the
 * animation controller, the numbers, the dying path and the dev preview need no colossus branch of their own.
 */
import { EnemyPoseController, type AttackPlan, type PoseState } from '../EnemyPoseController.js';
import type { ColossusCastKind, ColossusPoseController } from './ColossusPoseController.js';
import type { ColossusTimeline } from './colossusChoreography.js';

/** The calls the battle makes on an enemy's poses (both controllers answer them). */
export interface EnemyActorView {
  playAttack(i: number, plan?: AttackPlan): void;
  playCast(i: number): void;
  playHurt(i: number): void;
  freezeDying(i: number): void;
  attackOutDone(i: number): boolean;
  isAttacking(i: number): boolean;
  update(dt: number): void;
}

interface Route { ctl: ColossusPoseController; castKind: () => ColossusCastKind }

const STILL: PoseState = { pose: 'idle', dx: 0, dy: 0 };

export class EnemyActorPoses extends EnemyPoseController implements EnemyActorView {
  private readonly routes = new Map<number, Route>();

  /** Enemy i is a colossus from now on (the form change's swap, or a battle that starts in a colossus form). */
  attach(i: number, ctl: ColossusPoseController, castKind: () => ColossusCastKind = () => 'cast'): void {
    this.routes.set(i, { ctl, castKind });
  }

  detach(i: number): void { this.routes.delete(i); }

  /** The colossus controller of enemy i, or null for an atlas enemy. */
  colossus(i: number): ColossusPoseController | null { return this.routes.get(i)?.ctl ?? null; }

  /** The colossus timeline enemy i plays, or null for an atlas enemy. */
  colossusMode(i: number): ColossusTimeline | null { return this.routes.get(i)?.ctl.timeline ?? null; }

  /** The dev preview label of a colossus (`slam / 12`), or null. */
  label(i: number): string | null { return this.routes.get(i)?.ctl.label() ?? null; }

  override playAttack(i: number, plan?: AttackPlan): void {
    const r = this.routes.get(i);
    if (r) r.ctl.attack(); else super.playAttack(i, plan);
  }

  /** A colossus casts the beam for a single-target black damage spell (its route's castKind), else the cast. */
  override playCast(i: number): void {
    const r = this.routes.get(i);
    if (r) r.ctl.cast(r.castKind()); else super.playCast(i);
  }

  /** The beam (the dev preview's loop). */
  playBeam(i: number): void { this.routes.get(i)?.ctl.cast('beam'); }

  override playHurt(i: number): void {
    const r = this.routes.get(i);
    if (r) r.ctl.hurt(); else super.playHurt(i);
  }

  override freezeDying(i: number): void {
    const r = this.routes.get(i);
    if (r) r.ctl.die(); else super.freezeDying(i);
  }

  override attackOutDone(i: number): boolean {
    const r = this.routes.get(i);
    return r ? r.ctl.contactPassed : super.attackOutDone(i);
  }

  /** A colossus is "attacking" while an attack, a spell or its dying plays (the round end waits for it). */
  override isAttacking(i: number): boolean {
    const r = this.routes.get(i);
    return r ? r.ctl.busy : super.isAttacking(i);
  }

  override isLunging(i: number): boolean { return this.routes.has(i) ? false : super.isLunging(i); }
  override attackKind(i: number): ReturnType<EnemyPoseController['attackKind']> { return this.routes.has(i) ? null : super.attackKind(i); }
  override holdFrame(i: number): number | null { return this.routes.has(i) ? null : super.holdFrame(i); }
  override state(i: number): PoseState { return this.routes.has(i) ? STILL : super.state(i); }

  override debug(i: number): ReturnType<EnemyPoseController['debug']> {
    const r = this.routes.get(i);
    if (!r) return super.debug(i);
    const tl = r.ctl.timeline;
    const mode = tl === 'slam' || tl === 'beam' || tl === 'roar' ? 'attack' : tl;
    return { mode, t: r.ctl.frameIndex };
  }

  override reset(): void {
    super.reset();
    for (const r of this.routes.values()) r.ctl.reset();
  }

  override update(dt: number): void {
    super.update(dt);
    for (const r of this.routes.values()) r.ctl.update(dt);
  }
}
