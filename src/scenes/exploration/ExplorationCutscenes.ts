import type { DialogManager } from '../../systems/DialogManager.js';
import type { GameFlags } from '../../core/GameFlags.js';
import type { Character } from '../../entities/Character.js';
import type { NPC } from '../../entities/NPC.js';
import type { MapNPC } from '../../types/index.js';
import { npcPresent } from '../../types/index.js';
import { CutsceneManager, type CutsceneDeps } from '../../systems/CutsceneManager.js';
import { CutsceneRegistry } from '../../systems/CutsceneRegistry.js';

/** What a field cutscene needs from the exploration scene. */
export interface CutsceneHost {
  dialog: DialogManager;
  fadeOut: (ms: number) => Promise<void>;
  fadeIn: (ms: number) => Promise<void>;
  flags: GameFlags;
  party: readonly Character[];
  onFlagSet?: (flag: string) => void;
  /** A `warp` step: change maps behind the fade (T2). */
  warp?: CutsceneDeps['warp'];
  /** After a `heal_party` step (the partyHealed sound). */
  onHeal?: () => void;
  /** give_item / take_item (W1-B). */
  inventory?: CutsceneDeps['inventory'];
  /** set_vehicle (W1-A's vehicle state). */
  setVehicle?: CutsceneDeps['setVehicle'];
  /** end_game: to the title, no save (GAP-13). */
  endGame?: CutsceneDeps['endGame'];
  /** end_game's card on black (a host without it shows the text as a dialog line). */
  showCard?: CutsceneDeps['showCard'];
}

/** Play cutscene `id` in the field. Resolves false (and logs) when the id is unknown. */
export async function playFieldCutscene(id: string, host: CutsceneHost): Promise<boolean> {
  const script = CutsceneRegistry.get(id);
  if (!script) {
    console.error(`Unknown cutscene: ${id}`);
    return false;
  }
  const manager = new CutsceneManager({
    // the steps themselves don't hold confirm off (U12 review); the whole scene does once, below
    showDialog: (text: string) => new Promise<void>((resolve) => host.dialog.enqueue([text], resolve, { holdOff: false })),
    fadeOut: host.fadeOut,
    fadeIn: host.fadeIn,
    flags: host.flags,
    party: [...host.party],
    onFlagSet: host.onFlagSet,
    warp: host.warp,
    onHeal: host.onHeal,
    inventory: host.inventory,
    setVehicle: host.setVehicle,
    endGame: host.endGame,
    showCard: host.showCard,
  });
  await manager.play(script);
  // the press that closed the last line, or a mash after the scene, must not talk to the NPC again
  host.dialog.holdOffConfirm();
  return true;
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
