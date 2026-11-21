/**
 * The async half of the NW2 save fix (docs/NW2_EDITS_PLAN.md 12): `LoadScene` hands a v4 save here before it switches
 * to the field. The world map is loaded, and for a save inside a map the maps of its way out (`wayOutSearch`, each
 * once); then the pure `revalidateNw2` decides. A map that fails to load logs and counts as missing; when the world
 * map itself cannot be read the save loads as it was.
 */
import type { FieldMode, MapData, VehicleState } from '../../types/index.js';
import type { LoadedSave } from '../../systems/SaveManager.js';
import { revalidateNw2, wayOutSearch } from '../../systems/worldRevalidate.js';
import { RESET_MAP } from '../../systems/worldReset.js';

export type MapSource = (mapId: string) => Promise<MapData>;

/** The map, or null with a console error. */
async function tryLoad(load: MapSource, id: string): Promise<MapData | null> {
  try {
    return await load(id);
  } catch (e) {
    console.error(`Load: map ${id} could not be read for the save check`, e);
    return null;
  }
}

/** The world-map entrance the save's map leads out to, or null (`wayOutSearch` driven by async loads). */
export async function wayOutAsync(start: string, flags: ReadonlySet<string>, load: MapSource): Promise<string | null> {
  const it = wayOutSearch(start, flags);
  let r = it.next(null);
  while (!r.done) r = it.next(await tryLoad(load, r.value));
  return r.value;
}

/** The loaded save after the NW2 rules; a save not marked `revalidate` comes back unchanged. */
export async function revalidateLoaded(data: LoadedSave, load: MapSource): Promise<LoadedSave> {
  if (!data.revalidate) return data;
  const overworld = await tryLoad(load, RESET_MAP);
  if (!overworld) return data;
  const flags = new Set(Object.keys(data.flags.getAll()));
  const items = new Set(data.inventory.getAll().map((i) => i.itemId));
  const wayOut = data.currentMap === RESET_MAP ? null : await wayOutAsync(data.currentMap, flags, load);
  const spots = data.vehicles.filter((v) => !('x' in v));   // none in a v4 save (cells only); kept as they are
  const r = revalidateNw2({
    map: data.currentMap, x: data.playerPosition.x, y: data.playerPosition.y, mode: data.fieldMode, flags, items,
    vehicles: data.vehicles.filter((v): v is VehicleState => 'x' in v),
  }, { overworld, wayOut });
  if (r.changes.length) console.info(`Load: the NW2 world changed this save: ${r.changes.join('; ')}`);
  const mode: FieldMode = r.mode;
  return {
    ...data, currentMap: r.map, playerPosition: { x: r.x, y: r.y }, fieldMode: mode,
    vehicles: r.reset ? r.vehicles : [...r.vehicles, ...spots],
    reset: r.reset, revalidate: false,
  };
}
