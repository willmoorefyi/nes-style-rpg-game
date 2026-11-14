import { Container, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../../core/LayoutConstants.js';

/** C5: three white flashes over the field when a battle starts. */
export class BattleFlashEffect {
  private flash: Graphics | null = null;
  private state: { count: number; timer: number; on: boolean } | null = null;

  constructor(private readonly parent: Container) {}

  get active(): boolean {
    return this.state !== null;
  }

  start(): void {
    this.finish();
    this.flash = new Graphics();
    this.flash.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0xffffff);
    this.flash.visible = true;
    this.parent.addChild(this.flash);
    this.state = { count: 3, timer: 5, on: true };
  }

  /** Advance one frame; returns false once the flashes are over. */
  update(): boolean {
    const st = this.state;
    if (!st) return false;
    st.timer -= 1;
    if (st.timer > 0) return true;
    st.on = !st.on;
    if (this.flash) this.flash.visible = st.on;
    if (!st.on) st.count--;
    if (st.count <= 0) {
      this.finish();
      return false;
    }
    st.timer = 5;
    return true;
  }

  finish(): void {
    if (this.flash) {
      this.parent.removeChild(this.flash);
      this.flash = null;
    }
    this.state = null;
  }
}
