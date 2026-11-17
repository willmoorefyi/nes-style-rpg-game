import type { Game } from '../../core/Game.js';
import type { MapData, MapNPC, ScriptedEncounter } from '../../types/index.js';
import type { NPC } from '../../entities/NPC.js';
import type { DialogManager } from '../../systems/DialogManager.js';
import { dueEncounterWhere, npcOutcome, type FieldState, type NpcOutcome } from '../../systems/fieldRules.js';
import { ClassRegistry } from '../../data/ClassRegistry.js';
import { upgradeParty } from '../../systems/ClassUpgradeSystem.js';
import { clinicQuote, DEFAULT_CLINIC_PRICE } from '../../systems/clinic.js';
import { foundText, leftBehindText, receivedText, cantCarryText } from '../../systems/pickupText.js';
import { ClinicScene } from '../ClinicScene.js';
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

/** The map-data view of an NPC built from the entity, for an NPC the map data doesn't list (it is present). */
function npcDef(npc: NPC): MapNPC {
  return {
    id: npc.id, x: npc.tileX, y: npc.tileY, sprite: '', dialog: npc.dialog, shopId: npc.shopId, action: npc.action,
    chestItem: npc.chestItem, chestFlag: npc.chestFlag, giftItem: npc.giftItem, giftFlag: npc.giftFlag,
    cutscene: npc.cutscene, wander: npc.wander,
  };
}

/** The scene name the clinic's question is pushed under (re-registered on every visit). */
export const CLINIC_SCENE = '_clinic';

/**
 * Talking to an NPC in the field (docs/WORLD_PLAN.md 5.1-5.2; W1-B): chests, gifts, trades (`requiredItem`,
 * `takeItem`, `takeGold`), the actions that follow the dialog (a fight it starts, a cutscene, the class upgrade on
 * its `actionFlag`, the clinic, a shop). What an NPC yields comes from fieldRules.npcOutcome; this applies it to the
 * game, with the bag limit.
 */
export class FieldNpcActions {
  /** The NPC whose post-dialog action runs once the dialog closes. */
  private pending: NPC | null = null;

  constructor(private readonly host: NpcActionHost) {}

  clear(): void {
    this.pending = null;
  }

  /** The NPC's map record (all its fields: trades, actionFlag, clinicPrice), else one built from the entity. */
  private def(npc: NPC): MapNPC {
    return this.host.map()?.npcs.find((n) => n.id === npc.id) ?? npcDef(npc);
  }

  private state(): FieldState {
    return { ...fieldStateOf(this.host.game, 'walking'), gold: this.host.game.party.gold };
  }

  private outcome(npc: NPC): NpcOutcome {
    return npcOutcome(this.def(npc), this.state(), this.host.map()?.scriptedEncounters ?? []);
  }

  /** The due encounter that talking to `npc` starts (`ScriptedEncounter.npc`, B1). */
  private fight(npc: NPC): ScriptedEncounter | null {
    return dueEncounterWhere(this.host.map()?.scriptedEncounters ?? [], (e) => e.npc === npc.id, this.state());
  }

  /** Apply a gift or trade: the bag limit first, then the take (item, gold), the gift and the flags. */
  private applyGift(out: NpcOutcome, lines: string[]): void {
    const { game } = this.host;
    if (out.give && !game.inventory.canAdd(out.give)) {
      lines.push(cantCarryText(out.give));
      return;
    }
    if (out.take?.item && !game.inventory.remove(out.take.item, 1)) {
      console.error(`NPC trade: the party no longer holds ${out.take.item}`);
      return;
    }
    if (out.take?.gold && !game.party.spendGold(out.take.gold)) {
      console.error(`NPC trade: the party can't pay ${out.take.gold} G`);
      return;
    }
    if (out.give) {
      game.inventory.add(out.give, 1);
      lines.push(receivedText(out.give));
    }
    for (const f of out.setFlags) game.gameFlags.set(f);
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
      if (out.give || out.setFlags.length > 0) this.applyGift(out, lines);
      if (lines.length > 0) {
        // the post-dialog action: a shop, the class upgrade, the clinic, a cutscene, a fight it starts (B1)
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
    const def = this.def(npc);
    if (npc.action === 'classUpgrade') {
      const game = this.host.game;
      const messages = upgradeParty([...game.party.all], game.gameFlags, ClassRegistry.getAllClasses(), def.actionFlag);
      this.host.dialog.start(messages.length > 0 ? messages : ['You are not yet ready for this.']);
      return true;
    }
    if (npc.action === 'clinic') {
      this.openClinic(def.clinicPrice ?? DEFAULT_CLINIC_PRICE);
      return true;
    }
    if (npc.shopId) openShopScene(this.host.game, npc.shopId);
    return true;
  }

  /** GAP-16: nobody fallen, a line; else the clinic's Yes / No over the town, and its result in the dialog box. */
  private openClinic(price: number): void {
    const { game, dialog } = this.host;
    if (clinicQuote(game.party.all, price).fallen.length === 0) {
      dialog.start(['Nobody here needs reviving.']);
      return;
    }
    game.scenes.register(CLINIC_SCENE, new ClinicScene(game, price, (lines) => dialog.start(lines)));
    game.scenes.push(CLINIC_SCENE).catch((e) => console.error('Clinic failed to open:', e));
  }
}
