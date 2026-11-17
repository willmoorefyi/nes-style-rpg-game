import type { Game } from '../../core/Game.js';
import type { MapData, MapNPC, ScriptedEncounter } from '../../types/index.js';
import type { NPC } from '../../entities/NPC.js';
import type { DialogManager } from '../../systems/DialogManager.js';
import { dueEncounterWhere, npcOutcome, type NpcOutcome } from '../../systems/fieldRules.js';
import { ClassRegistry } from '../../data/ClassRegistry.js';
import { upgradeParty } from '../../systems/ClassUpgradeSystem.js';
import { foundText, leftBehindText, receivedText, cantCarryText } from '../../systems/pickupText.js';
import { openShopScene } from './FieldSystems.js';
import { fieldStateOf } from './FieldVehicles.js';

/** What the NPC actions need from the exploration scene. */
export interface NpcActionHost {
  game: Game;
  dialog: DialogManager;
  map: () => MapData | null;
  playCutscene: (id: string) => Promise<void>;
  /** Show the encounter's message, then start its battle. */
  startEncounter: (encounter: ScriptedEncounter) => void;
}

/** The map-data view of an NPC on the map (it is present, or it would not be there). */
function npcDef(npc: NPC): MapNPC {
  return {
    id: npc.id, x: npc.tileX, y: npc.tileY, sprite: '', dialog: npc.dialog, shopId: npc.shopId, action: npc.action,
    chestItem: npc.chestItem, chestFlag: npc.chestFlag, giftItem: npc.giftItem, giftFlag: npc.giftFlag,
    cutscene: npc.cutscene, wander: npc.wander,
  };
}

/**
 * Talking to an NPC in the field (docs/WORLD_PLAN.md 5.1; owned by W1-B from W1-0a on): chests, gifts, the actions
 * that follow the dialog (a fight it starts, a cutscene, the class upgrade, a shop). What an NPC yields comes from
 * fieldRules.npcOutcome; this applies it to the game, with the bag limit.
 */
export class FieldNpcActions {
  /** The NPC whose post-dialog action runs once the dialog closes. */
  private pending: NPC | null = null;

  constructor(private readonly host: NpcActionHost) {}

  clear(): void {
    this.pending = null;
  }

  private outcome(npc: NPC): NpcOutcome {
    const state = fieldStateOf(this.host.game, 'walking');
    return npcOutcome(npcDef(npc), state, this.host.map()?.scriptedEncounters ?? []);
  }

  /** The due encounter that talking to `npc` starts (`ScriptedEncounter.npc`, B1). */
  private fight(npc: NPC): ScriptedEncounter | null {
    const state = fieldStateOf(this.host.game, 'walking');
    return dueEncounterWhere(this.host.map()?.scriptedEncounters ?? [], (e) => e.npc === npc.id, state);
  }

  /** Confirm reached `npc`. Returns false when it had nothing to say or do (the field goes on). */
  talk(npc: NPC): boolean {
    const { game, dialog } = this.host;
    const out = this.outcome(npc);
    if (npc.chestItem && npc.chestFlag) {
      if (!out.give) dialog.start(out.dialog);
      else if (!game.inventory.canAdd(out.give)) {
        // E1: a full bag leaves the chest closed for later
        dialog.start([foundText(out.give), leftBehindText(out.give)]);
      } else {
        game.inventory.add(out.give, 1);
        for (const f of out.setFlags) game.gameFlags.set(f);
        npc.setOpened();
        // the chest's own line ("You found a Potion!", U9), else the shared wording
        dialog.start(out.dialog.length > 0 ? out.dialog : [foundText(out.give)]);
      }
      return true;
    }
    if (npc.dialog.length > 0) {
      const lines = out.dialog;
      if (out.give) {
        if (game.inventory.canAdd(out.give)) {
          game.inventory.add(out.give, 1);
          for (const f of out.setFlags) game.gameFlags.set(f);
          lines.push(receivedText(out.give));
        } else lines.push(cantCarryText(out.give));
      }
      if (lines.length > 0) {
        // the post-dialog action: a shop, the class upgrade, a cutscene, a fight it starts (B1)
        const after = this.outcome(npc); // on the flags as they are now (a gift's flag may start a cutscene)
        if (npc.shopId || after.action || after.cutscene || after.battle !== undefined) this.pending = npc;
        dialog.start(lines);
        return true;
      }
    }
    // an NPC with nothing to say who starts a fight (B1)
    const fight = this.fight(npc);
    if (!fight) return false;
    this.host.startEncounter(fight);
    return true;
  }

  /** After the dialog closed: run the pending NPC's action. Returns whether there was one. */
  runPending(): boolean {
    const npc = this.pending;
    if (!npc) return false;
    this.pending = null;
    const fight = this.fight(npc);
    if (fight) {
      this.host.startEncounter(fight);
      return true;
    }
    const cutscene = this.outcome(npc).cutscene;
    if (cutscene) {
      this.host.playCutscene(cutscene).catch((e) => console.error(`Cutscene ${cutscene} failed:`, e));
      return true;
    }
    if (npc.action === 'classUpgrade') {
      const messages = upgradeParty([...this.host.game.party.all], this.host.game.gameFlags, ClassRegistry.getAllClasses());
      this.host.dialog.start(messages.length > 0 ? messages : ['You are not yet ready for this.']);
      return true;
    }
    if (npc.shopId) openShopScene(this.host.game, npc.shopId);
    return true;
  }
}
