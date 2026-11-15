/**
 * The bestiary preview's loop driver (docs/BESTIARY_PLAN.md 4), pure: first break, then attack, hurt, cast, daze with
 * an idle break after each. It never assumes animation lengths: a step ends when the pose controller is idle again.
 * Every count runs on the dt it is given (the bestiary's dev clock: a dt of 0 never advances a break).
 */
import { BESTIARY_STEPS, type BestiaryAnimLabel, type BestiaryStep } from '../../types/bestiaryData.js';

/** The parts of EnemyPoseController the driver reads (enemy 0). */
export interface LoopPoses {
  playHurt(i: number): void;
  playCast(i: number): void;
  isAttacking(i: number): boolean;
  debug(i: number): { mode: string };
}

export interface LoopHooks {
  /** Start enemy 0's real attack (the preview aims it at its phantom target). */
  attack(): void;
  /** The daze step's posture on (true) and off. */
  setDazed(on: boolean): void;
}

export interface LoopConfig { order: readonly BestiaryStep[]; firstBreak: number; idleBreak: number; dazeHold: number }
export interface LoopCaps { hasCast: boolean; hasDaze: boolean; hasSpells: boolean }

const warned = new Set<string>();

/** The steps for this enemy, in `order`: cast only with a cast frame or spells, daze only with real daze frames. */
export function steps(order: readonly string[], caps: LoopCaps): BestiaryStep[] {
  const out: BestiaryStep[] = [];
  for (const name of order) {
    if (!(BESTIARY_STEPS as readonly string[]).includes(name)) {
      if (!warned.has(name)) { warned.add(name); console.warn(`Bestiary: unknown animation step "${name}" skipped`); }
      continue;
    }
    const step = name as BestiaryStep;
    if (step === 'cast' && !caps.hasCast && !caps.hasSpells) continue;
    if (step === 'daze' && !caps.hasDaze) continue;
    out.push(step);
  }
  return out;
}

type Phase = { kind: 'break'; left: number } | { kind: 'daze'; left: number } | { kind: 'step'; step: 'attack' | 'hurt' | 'cast' };

export class BestiaryLoop {
  private list: BestiaryStep[] = [];
  private next = 0;
  private phase: Phase = { kind: 'break', left: 0 };
  private queued = false;
  private pausedNow = false;
  private attackLabel: BestiaryAnimLabel = 'attack';

  constructor(private readonly poses: LoopPoses, private readonly hooks: LoopHooks, private readonly cfg: LoopConfig) {}

  /** A new entry: its steps and attack caption, then the first break. */
  start(caps: LoopCaps, attackLabel: BestiaryAnimLabel = 'attack'): void {
    if (this.phase.kind === 'daze') this.hooks.setDazed(false);
    this.list = steps(this.cfg.order, caps);
    this.attackLabel = attackLabel;
    this.next = 0;
    this.queued = false;
    this.phase = { kind: 'break', left: this.cfg.firstBreak };
  }

  get paused(): boolean { return this.pausedNow; }

  /** Shift: no step starts while paused (idle breathing goes on). */
  togglePause(): void { this.pausedNow = !this.pausedNow; }

  /** Z: end a break or a daze now and start the next step; during an attack, hurt or cast it waits for idle. */
  skip(): void {
    if (this.phase.kind === 'step') { this.queued = true; return; }
    if (this.phase.kind === 'daze') this.hooks.setDazed(false);
    this.startNext();
  }

  /** The caption key of the step playing, or null in a break. */
  currentLabel(): BestiaryAnimLabel | null {
    if (this.phase.kind === 'daze') return 'daze';
    if (this.phase.kind !== 'step') return null;
    return this.phase.step === 'attack' ? this.attackLabel : this.phase.step;
  }

  /** The step playing ('break' between steps). */
  get current(): BestiaryStep | 'break' {
    return this.phase.kind === 'break' ? 'break' : this.phase.kind === 'daze' ? 'daze' : this.phase.step;
  }

  update(dt: number): void {
    const p = this.phase;
    if (p.kind === 'step') {
      const done = p.step === 'hurt' ? this.poses.debug(0).mode === 'idle' : !this.poses.isAttacking(0);
      if (!done) return;
      if (this.queued) { this.queued = false; this.startNext(); return; }
      this.phase = { kind: 'break', left: this.cfg.idleBreak };
    } else if (p.kind === 'daze') {
      p.left -= dt;
      if (p.left > 0) return;
      this.hooks.setDazed(false);
      this.phase = { kind: 'break', left: this.cfg.idleBreak };
    }
    // the frame a step or daze ends is the break's first frame
    const b = this.phase;
    if (b.kind !== 'break') return;
    if (b.left <= 0 && !this.pausedNow) { this.startNext(); return; }
    b.left -= dt;
  }

  private startNext(): void {
    const step = this.list[this.next % Math.max(1, this.list.length)];
    if (!step) return;
    this.next = (this.next + 1) % this.list.length;
    switch (step) {
      case 'attack': this.hooks.attack(); break;
      case 'hurt': this.poses.playHurt(0); break;
      case 'cast': this.poses.playCast(0); break;
      case 'daze': this.hooks.setDazed(true); this.phase = { kind: 'daze', left: this.cfg.dazeHold }; return;
    }
    this.phase = { kind: 'step', step };
  }
}
