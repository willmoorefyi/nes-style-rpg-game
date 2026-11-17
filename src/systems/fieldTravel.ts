/**
 * The field travel spells (docs/QUEST_PLAN.md 4.2 "Field EXIT / WARP"; W1-B):
 * - EXIT (`field_exit`) goes to the map's `exit` (`MapData.exit`: map and entrance), e.g. out of a dungeon;
 * - WARP (`field_warp`) goes back one floor: the map behind this floor's stair back (the transition nearest its
 *   `arrival` entrance, layouts/world_canon.py), at that floor's own `arrival` cell; a first floor's stair back
 *   leads outside, to where that transition arrives.
 * Both return only to places already reached on foot. Where they don't apply they have no effect (no charge spent).
 * The field menu casts them and the exploration scene re-enters on the target (`travelTo`).
 */
import type { Game } from '../core/Game.js';
import type { DataLoader } from '../core/DataLoader.js';
import type { MapData, MapTransition } from '../types/index.js';
import { arrivalFor } from './MapTransition.js';
import { resolveMapPath } from './MapLoader.js';
import { isPreviewAi } from '../core/artPreview.js';
import type { FieldTravelEffect } from './FieldSpellEffects.js';

/** Load a map's data the way the field does (the compiled variant when the field plays compiled maps). */
export function fieldMapLoader(data: Pick<DataLoader, 'loadMap' | 'loadMapManifest'>): (id: string) => Promise<MapData> {
  return async (id) => data.loadMap(await resolveMapPath(data, id, isPreviewAi()));
}

/** Where a travel spell sends the party: a named entrance, or a cell. */
export type TravelTarget = { map: string; entrance: string } | { map: string; x: number; y: number };

/** How far from the `arrival` entrance the stair back may be (it is "beside" it in the canon). */
export const STAIR_BACK_REACH = 3;

/** This floor's stair back: the transition nearest its `arrival` entrance, within STAIR_BACK_REACH (first wins a tie). */
export function stairBack(map: MapData): MapTransition | null {
  const arrival = map.entrances?.arrival;
  if (!arrival) return null;
  let best: MapTransition | null = null;
  let bestD = STAIR_BACK_REACH + 1;
  for (const t of map.transitions) {
    const d = Math.abs(t.x - arrival[0]) + Math.abs(t.y - arrival[1]);
    if (d < bestD) { best = t; bestD = d; }
  }
  return best;
}

/** EXIT's target: the map's `exit`, or null. */
export function exitTarget(map: MapData): TravelTarget | null {
  return map.exit ? { map: map.exit.map, entrance: map.exit.entrance } : null;
}

/** WARP's target, given the map behind the stair back (`previous`): its `arrival`, else where the stair arrives. */
export function warpTarget(map: MapData, previous: MapData): TravelTarget | null {
  const back = stairBack(map);
  if (!back || back.targetMap !== previous.id) return null;
  if (previous.entrances?.arrival) return { map: previous.id, entrance: 'arrival' };
  const at = arrivalFor(back, previous);
  return { map: previous.id, x: at.x, y: at.y };
}

/** Where the travel spell `effect` cast on `mapId` leads, or null when it has no effect there. */
export async function travelTarget(effect: FieldTravelEffect, mapId: string,
  loadMap: (id: string) => Promise<MapData>): Promise<TravelTarget | null> {
  if (!mapId) return null;
  const map = await loadMap(mapId);
  if (effect === 'field_exit') return exitTarget(map);
  const back = stairBack(map);
  return back ? warpTarget(map, await loadMap(back.targetMap)) : null;
}

/** Send the party to `target`: the field scene is entered afresh there (on foot, like any map change). */
export function travelTo(game: Pick<Game, 'currentMapId' | 'pendingEntrance' | 'playerPosition' | 'scenes'>,
  target: TravelTarget): Promise<void> {
  game.currentMapId = target.map;
  if ('entrance' in target) game.pendingEntrance = target.entrance;
  else {
    game.pendingEntrance = null;
    game.playerPosition = { x: target.x, y: target.y };
  }
  return game.scenes.switchTo('exploration');
}
