import type { Container } from 'pixi.js';
import type { MapData, MapTransition } from '../../types/index.js';
import type { FadeOverlay } from '../../rendering/FadeOverlay.js';
import type { PlayerController } from '../../entities/PlayerController.js';
import type { MovementMode } from '../../entities/MovementMode.js';
import type { CutsceneWarp } from '../../systems/CutsceneManager.js';
import { arrivalFor, entrancePosition } from '../../systems/MapTransition.js';
import { transitionAnimation } from './TransitionEffect.js';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../../core/LayoutConstants.js';

/** What a map change needs from the exploration scene. */
export interface FieldTransitionHost {
  readonly world: Container;
  readonly fade: FadeOverlay;
  readonly walkingMode: MovementMode;
  /** Random battles, off for the whole fade-load-fade (S2). */
  readonly encounters: { stop(): void; start(): void };
  player(): PlayerController | null;
  mapData(): MapData | null;
  loadMap(mapId: string): Promise<void>;
  setPaused(paused: boolean): void;
  /** After the player was placed: the game's saved tile, the camera and the tilemap. */
  redraw(): void;
}

/** A warp or door: fade (or zoom into a door), load the target map, place the player, fade in. */
export class FieldTransition {
  private running = false;

  constructor(private readonly host: FieldTransitionHost) {}

  /** A map change is under way: the field takes no input and meets no monsters until it is over (S2). */
  get active(): boolean {
    return this.running;
  }

  async run(transition: MapTransition): Promise<void> {
    this.running = true;
    this.host.encounters.stop();
    try {
      await this.change(transition);
    } finally {
      this.running = false;
      this.host.encounters.start();
    }
  }

  /**
   * A cutscene's `warp` step (T2): load `w.map` (its music, encounters and NPCs on the current flags) and stand on
   * the named entrance or cell, facing `w.facing`. The cutscene's own fades hide it.
   */
  async warp(w: CutsceneWarp): Promise<void> {
    const host = this.host;
    await host.loadMap(w.map);
    const map = host.mapData();
    const player = host.player();
    if (!map || !player) throw new Error(`warp to ${w.map}: the map did not load`);
    const at = w.entrance !== undefined ? entrancePosition(map, w.entrance) : { x: w.x ?? 0, y: w.y ?? 0 };
    player.setPosition(at.x, at.y);
    if (w.facing) player.face(w.facing);
    host.redraw();
  }

  private async change(transition: MapTransition): Promise<void> {
    const host = this.host;
    // Disembark vehicle on map transition — return to walking
    const before = host.player();
    if (before && before.currentMode.id !== 'walking') before.currentMode = host.walkingMode;
    // CA-2: only a house or shop door zooms in; gates, stairs and edge exits fade (D3: fade out, load, fade in)
    if (transitionAnimation(transition) === 'zoom') await this.zoom(transition.x, transition.y);
    else await host.fade.fadeOut(300);
    await host.loadMap(transition.targetMap);
    const player = host.player();
    const map = host.mapData();
    if (player && map) {
      const at = arrivalFor(transition, map);
      player.setPosition(at.x, at.y);
      host.redraw();
    }
    await host.fade.fadeIn(300);
  }

  /** Zoom-into-door animation: scale up the world toward the door tile while fading out */
  private async zoom(doorTileX: number, doorTileY: number): Promise<void> {
    this.host.setPaused(true);
    const wc = this.host.world;
    // the screen-centre point and the door; zoom toward their midpoint
    const centerX = -wc.x + GAME_WIDTH / 2;
    const centerY = -wc.y + GAME_HEIGHT / 2;
    const focusX = (centerX + doorTileX * TILE_SIZE + TILE_SIZE / 2) / 2;
    const focusY = (centerY + doorTileY * TILE_SIZE + TILE_SIZE / 2) / 2;
    const origX = wc.x;
    const origY = wc.y;
    // Set pivot to focus point; adjust position to compensate
    wc.pivot.set(focusX, focusY);
    wc.position.set(origX + focusX, origY + focusY);
    const frames = 24;
    for (let i = 1; i <= frames; i++) {
      const t = i / frames;
      wc.scale.set(1 + t);
      wc.alpha = 1 - t;
      await new Promise<void>(r => requestAnimationFrame(() => r()));
    }
    // Reset the world's transforms; the overlay is black, as if fadeOut completed
    wc.scale.set(1);
    wc.alpha = 1;
    wc.pivot.set(0, 0);
    wc.position.set(origX, origY);
    this.host.fade.overlay.alpha = 1;
    this.host.setPaused(false);
  }
}
