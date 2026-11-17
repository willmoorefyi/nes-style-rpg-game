import { Container, Graphics } from 'pixi.js';
import type { Character } from '../../entities/Character.js';
import { applyHazard } from '../../systems/hazards.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../../core/LayoutConstants.js';

/** Frames the red flash of a hazard step takes to fade out. */
export const HAZARD_FLASH_FRAMES = 12;
const HAZARD_RED = 0xd82800;

/**
 * A walking step onto a hazard cell (W1-B): the HP loss (systems/hazards.ts) and a short red flash over the field,
 * faded on animation frames (none in tests: the flash is removed at once). The field keeps moving meanwhile.
 */
export function hazardStep(parent: Container, party: readonly Character[], damage: number): void {
  if (applyHazard(party, damage) === 0) return;
  const flash = new Graphics();
  flash.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(HAZARD_RED);
  flash.alpha = 0.45;
  parent.addChild(flash);
  if (typeof requestAnimationFrame === 'undefined') {
    parent.removeChild(flash);
    return;
  }
  let frame = 0;
  const tick = (): void => {
    frame++;
    flash.alpha = 0.45 * (1 - frame / HAZARD_FLASH_FRAMES);
    if (frame < HAZARD_FLASH_FRAMES) requestAnimationFrame(tick);
    else {
      parent.removeChild(flash);
      flash.destroy();
    }
  };
  requestAnimationFrame(tick);
}
