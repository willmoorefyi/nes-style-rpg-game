import { Container } from 'pixi.js';
import type { Scene } from '../../types/index.js';
import type { Game } from '../../core/Game.js';

/**
 * The dev-only debug battle sandbox (pass F item 8; docs/FEEDBACK_PLAN_2026-11-14.md §3.8). F0 stub: it logs and pops
 * itself on its first update; pass F's Fg builds the sandbox.
 */
export class DebugSandboxScene implements Scene {
  readonly container = new Container();
  private closing = false;

  constructor(private readonly game: Game) {}

  enter(): void {
    this.closing = false;
    console.warn('DebugSandboxScene: not built yet (pass F, Fg); closing');
  }

  update(_dt: number): void {
    if (this.closing) return;
    this.closing = true;
    this.game.scenes.pop().catch((e) => console.error('DebugSandboxScene: pop failed', e));
  }

  exit(): void {}
}
