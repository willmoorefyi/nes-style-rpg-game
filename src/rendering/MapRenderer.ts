import type { Container } from 'pixi.js';
import type { Camera } from './Camera.js';

/** What ExplorationScene needs from a map renderer (legacy tiles or baked 2x chunks). */
export interface MapRenderer {
  /** Drawn under the characters. */
  readonly container: Container;
  /** Drawn over the characters (roof ridges, tree crowns); absent for legacy tile maps. */
  readonly aboveContainer?: Container;
  setCamera(camera: Camera): void;
  render(): void;
  markDirty(): void;
  readonly width: number;
  readonly height: number;
}
