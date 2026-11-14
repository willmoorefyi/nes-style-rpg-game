import type { DialogManager } from '../../systems/DialogManager.js';
import type { GameFlags } from '../../core/GameFlags.js';
import type { Character } from '../../entities/Character.js';
import type { NPC } from '../../entities/NPC.js';
import type { MapNPC } from '../../types/index.js';
import { npcPresent } from '../../types/index.js';
import { CutsceneManager } from '../../systems/CutsceneManager.js';
import { CutsceneRegistry } from '../../systems/CutsceneRegistry.js';

/** What a field cutscene needs from the exploration scene. */
export interface CutsceneHost {
  dialog: DialogManager;
  fadeOut: (ms: number) => Promise<void>;
  fadeIn: (ms: number) => Promise<void>;
  flags: GameFlags;
  party: readonly Character[];
  onFlagSet?: (flag: string) => void;
}

/** Play cutscene `id` in the field. Resolves false (and logs) when the id is unknown. */
export async function playFieldCutscene(id: string, host: CutsceneHost): Promise<boolean> {
  const script = CutsceneRegistry.get(id);
  if (!script) {
    console.error(`Unknown cutscene: ${id}`);
    return false;
  }
  const manager = new CutsceneManager({
    showDialog: (text: string) => new Promise<void>((resolve) => host.dialog.enqueue([text], resolve)),
    fadeOut: host.fadeOut,
    fadeIn: host.fadeIn,
    flags: host.flags,
    party: [...host.party],
    onFlagSet: host.onFlagSet,
  });
  await manager.play(script);
  return true;
}

/** The cutscene an NPC plays after talking, if its flags allow it now. */
export function npcCutsceneDue(npc: Pick<NPC, 'cutscene'>, hasFlag: (flag: string) => boolean): string | null {
  const c = npc.cutscene;
  if (!c) return null;
  if (c.requiredFlag && !hasFlag(c.requiredFlag)) return null;
  if (hasFlag(c.onceFlag)) return null;
  return c.id;
}

/**
 * NPCs whose `showIf` / `hideIf` no longer pass after a flag change (e.g. Garland and the captive princess once
 * the battle and its cutscene are over). Callers remove these from the map.
 */
export function npcsToRemove(npcs: readonly NPC[], defs: readonly MapNPC[], hasFlag: (flag: string) => boolean): NPC[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  return npcs.filter((n) => {
    const def = byId.get(n.id);
    return def !== undefined && !npcPresent(def, hasFlag);
  });
}
