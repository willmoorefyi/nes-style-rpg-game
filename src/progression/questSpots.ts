/**
 * NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2, D-NW10): quest.yaml names its world-map places (a stage's `entry.at`, its
 * vehicles' `at`, a `nonLoadBearing` element's `ref`) instead of raw cells, so one quest.yaml serves today's world and
 * the 256x256 one. `resolveQuestPlaces` gives each its cell from the loaded maps (`MapData.spots`, the dock, gate, NPC
 * and patch ids) when the verifier builds its world, so the proofs read cells only.
 */
import type { MapData, QuestData, QuestStage } from '../types/index.js';

/** A spot's cell on `map` (NW-1 `MapData.spots`); throws on an unknown map or spot. */
export function spotCell(maps: ReadonlyMap<string, MapData>, map: string, at: string, where: string): [number, number] {
  const s = maps.get(map)?.spots?.[at];
  if (!s) throw new Error(`${where}: map ${map} has no spot ${at}`);
  return [s.at[0], s.at[1]];
}

/** The cell of a `nonLoadBearing` element named by `ref`: a dock, gate, NPC or patch id of its kind, else a spot. */
function refCell(map: MapData | undefined, kind: string, ref: string): [number, number] | null {
  const byId = <T extends { id?: string }>(xs: T[] | undefined): T | undefined => xs?.find((x) => x.id === ref);
  const hit = kind === 'dock' ? byId(map?.docks) : kind === 'gate' ? byId(map?.keyItemGates)
    : kind === 'npc' ? byId(map?.npcs) : undefined;
  if (hit) return [hit.x, hit.y];
  const patch = kind === 'patch' ? byId(map?.patches) : undefined;
  if (patch?.cells.length) return [patch.cells[0][0], patch.cells[0][1]];
  const s = map?.spots?.[ref];
  return s ? [s.at[0], s.at[1]] : null;
}

/**
 * NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2, D-NW10): every place quest.yaml names on a map (`entry.at`, a vehicle's
 * `at`, a `nonLoadBearing` `ref`) gets its cell from the loaded maps, so one quest.yaml serves today's world and the
 * new one and the proofs read cells only. Pure: returns new stages; an unknown spot or ref throws.
 */
export function resolveQuestPlaces(quest: QuestData, maps: ReadonlyMap<string, MapData>): QuestData {
  const stages = quest.stages.map((s) => {
    const out: QuestStage = { ...s };
    if (s.entry) {
      const e = { ...s.entry };
      if (e.at !== undefined) [e.x, e.y] = spotCell(maps, e.map, e.at, `quest ${s.id} entry`);
      e.vehicles = s.entry.vehicles?.map((v) => {
        // a resolved vehicle is a plain VehicleState (no `at`), as the searches compare and copy them
        const [x, y] = v.at === undefined ? [v.x, v.y]
          : spotCell(maps, v.map, v.at, `quest ${s.id} entry vehicle ${v.type}`);
        return { type: v.type, map: v.map, x, y };
      });
      if (!e.vehicles) delete e.vehicles;
      out.entry = e;
    }
    out.nonLoadBearing = s.nonLoadBearing.map((n) => {
      if (n.ref === undefined) return n;
      const at = refCell(maps.get(n.map), n.kind, n.ref);
      if (!at) throw new Error(`quest ${s.id} nonLoadBearing: map ${n.map} has no ${n.kind} ${n.ref}`);
      return { ...n, at };
    });
    return out;
  });
  return { ...quest, stages };
}
