import type { NPC } from '../../entities/NPC.js';
import { npcPresent, type MapNPC } from '../../types/index.js';

/**
 * The NPCs a flag change took away or brought (`showIf` / `hideIf`): the live NPCs whose def no longer passes, and the
 * defs that pass with no live NPC (the sleeping giant after TITAN_FED, `bahamut_after`; P3-03). `defs` is the map's
 * whole NPC list, not the list filtered when the map loaded.
 */
export function npcPresenceChanges(npcs: readonly NPC[], defs: readonly MapNPC[], hasFlag: (flag: string) => boolean):
  { gone: NPC[]; appear: MapNPC[] } {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const live = new Set(npcs.map((n) => n.id));
  const gone = npcs.filter((n) => {
    const def = byId.get(n.id);
    return def !== undefined && !npcPresent(def, hasFlag);
  });
  const appear = defs.filter((d) => !live.has(d.id) && npcPresent(d, hasFlag));
  return { gone, appear };
}
