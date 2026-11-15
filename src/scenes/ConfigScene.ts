import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';

/**
 * Config (message speed, pass F item 6; docs/FEEDBACK_PLAN_2026-11-14.md §3.6). F0 stub: it logs and pops itself on
 * its first update; pass F's Fb builds the screen.
 */
export class ConfigScene implements Scene {
  readonly container = new Container();
  private closing = false;

  constructor(private readonly game: Game) {}

  enter(): void {
    this.closing = false;
    console.warn('ConfigScene: not built yet (pass F, Fb); closing');
  }

  update(_dt: number): void {
    if (this.closing) return;
    this.closing = true;
    this.game.scenes.pop().catch((e) => console.error('ConfigScene: pop failed', e));
  }

  exit(): void {}
}
