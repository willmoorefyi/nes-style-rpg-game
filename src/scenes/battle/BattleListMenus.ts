import type { Container } from 'pixi.js';
import type { Character } from '../../entities/Character.js';
import type { EventBus } from '../../core/EventBus.js';
import type { InputManager } from '../../core/InputManager.js';
import type { SpellData } from '../../types/index.js';
import type { BattleStateMachine } from '../../battle/BattleStateMachine.js';
import type { BattleCommand } from '../../battle/BattleCommands.js';
import { createItemCommand } from '../../battle/BattleCommands.js';
import type { BattleSceneConfig } from './BattleSceneTypes.js';
import type { Window } from '../../ui/Window.js';
import { SpellSelectionUI } from '../../ui/SpellSelectionUI.js';
import { ItemSelectionUI } from '../../ui/ItemSelectionUI.js';
import { ItemEffects } from '../../systems/ItemEffects.js';
import { ItemRegistry } from '../../data/ItemRegistry.js';
import { mostHurtMemberId } from './BattleFieldTargeting.js';
import type { Inventory } from '../../entities/Inventory.js';

/** U14: a spell level with charges left and a learned spell. */
function hasCastableSpell(actor: Character): boolean {
  for (let lvl = 1; lvl <= 8; lvl++) if (actor.hasCharges(lvl) && actor.getSpellsAtLevel(lvl).length > 0) return true;
  return false;
}

/**
 * U14: whether Magic is worth opening for `actor` (the command row is greyed otherwise). True while silenced, so the
 * pick still explains itself with the "Silenced." notice (U revision 7).
 */
export function canOpenSpells(actor: Character): boolean {
  return actor.statusTracker.has('silence') || hasCastableSpell(actor);
}

/** The battle item list's filter (`ItemSelectionUI`): a consumable that is not a camp item (BA-4). */
const battleUsable = (id: string): boolean => ItemRegistry.getItem(id)?.type === 'consumable' && !ItemEffects.isPartyItem(id);

/** U14: whether the bag holds a battle-usable consumable not already spoken for this round (`reserved`, B5). */
export function canOpenItems(inventory: Inventory | undefined, reserved: (id: string) => number): boolean {
  return !!inventory && inventory.getAll().some(e => e.quantity - reserved(e.itemId) > 0 && battleUsable(e.itemId));
}

/** What the list menus need from the battle scene. */
export interface ListMenuHost {
  readonly battle: BattleStateMachine;
  readonly config: BattleSceneConfig;
  readonly spells: SpellData[];
  readonly events: EventBus;
  /** The bottom-left window the lists draw in (over the hidden enemy list). */
  readonly listWindow: Window;
  showNotice(text: string): void;
  enterFieldTargeting(isParty: boolean, revive: boolean, onConfirm: (targetId: string) => void, onCancel: () => void,
    initialId?: string): void;
  /** Submit the command and go on to the next member's turn. */
  submit(command: BattleCommand): void;
  /** Back to this list after a cancelled target choice ('spell_ui' / 'item_ui'), or to the command menu. */
  setState(state: 'spell_ui' | 'item_ui' | 'command'): void;
  openList(list: Container): void;
  closeList(list: Container): void;
}

/**
 * The battle's Magic and Item lists (moved out of `BattleScene`, B5). Items already queued this round are reserved
 * (B5), heal targets start on the most hurt member (B10), and a silenced member gets a notice (B8). No sound is
 * raised when a spell is picked; the cast sound plays when it goes off (I3).
 */
export class BattleListMenus {
  private spellUI: SpellSelectionUI | null = null;
  private itemUI: ItemSelectionUI | null = null;

  constructor(private readonly host: ListMenuHost) {}

  showSpells(actor: Character): void {
    const { battle, config, spells } = this.host;
    if (actor.statusTracker.has('silence')) {
      this.host.showNotice('Silenced.');
      return;
    }
    if (!hasCastableSpell(actor)) {
      this.host.showNotice('No spells available.');
      return;
    }
    const actorId = battle.currentCommandActorId!;
    const submit = (spellId: string, targetId?: string) => {
      this.closeSpells();
      this.host.submit({ type: 'magic', actorId, targetId, spellId });
    };
    this.spellUI = new SpellSelectionUI({
      character: actor,
      actorId,
      spells,
      enemies: battle.livingEnemies.map(e => ({ id: e.id, name: e.displayName })),
      partyMembers: config.party.map((c, i) => ({ name: c.name, id: `party_${i}`, hp: c.currentHp })),
      contentX: this.host.listWindow.contentX,
      contentY: this.host.listWindow.contentY,
      eventBus: this.host.events,
      onSelect: (result) => submit(result.spellId, result.targetId),
      onCancel: () => {
        this.closeSpells();
        this.host.setState('command');
      },
      onNeedTarget: (spellId, targetType) => {
        const spell = spells.find(s => s.id === spellId);
        const revive = spell?.effect === 'revive';
        const initial = spell?.effect === 'heal' ? mostHurtMemberId(config.party) : undefined;
        this.host.enterFieldTargeting(targetType === 'single_ally', revive, (targetId) => submit(spellId, targetId),
          () => this.host.setState('spell_ui'), initial);
      },
    });
    this.host.openList(this.spellUI);
    this.host.setState('spell_ui');
  }

  showItems(): void {
    const { battle, config } = this.host;
    const inventory = config.inventory;
    if (!inventory) {
      this.host.showNotice('No items available.');
      return;
    }
    const actorId = battle.currentCommandActorId!;
    const submit = (itemId: string, targetId: string) => {
      this.closeItems();
      this.host.submit(createItemCommand(actorId, targetId, itemId));
    };
    this.itemUI = new ItemSelectionUI({
      inventory,
      partyMembers: config.party.map((c, i) => ({ name: c.name, id: `party_${i}` })),
      contentX: this.host.listWindow.contentX,
      contentY: this.host.listWindow.contentY,
      eventBus: this.host.events,
      // BA-4: Tent and Cabin are camp items; they are not listed in battle
      isUsable: battleUsable,
      // B5: what the members before this one queued this round is already spoken for
      quantityOf: (id) => inventory.getQuantity(id) - battle.reservedItems(id),
      // the no-target fallback uses the item on the actor (never a name as a target id)
      onSelect: (result) => submit(result.itemId, actorId),
      onCancel: () => {
        this.closeItems();
        this.host.setState('command');
      },
      onNeedTarget: (itemId) => {
        const revive = ItemEffects.isReviveItem(itemId);
        // BA-5: a revive item (Phoenix Down) targets the fallen; with nobody fallen, say so instead of a silent cancel
        if (revive && !config.party.some((c) => c.currentHp <= 0)) {
          this.closeItems();
          this.host.showNotice('No one to revive.');
          return;
        }
        const heals = (ItemRegistry.getItem(itemId)?.stats.hp ?? 0) > 0;
        this.host.enterFieldTargeting(true, revive, (targetId) => submit(itemId, targetId),
          () => this.host.setState('item_ui'), heals && !revive ? mostHurtMemberId(config.party) : undefined);
      },
    });
    if (this.itemUI.hasNoItems()) {
      this.closeItems();
      this.host.showNotice('No items available.');
      return;
    }
    this.host.openList(this.itemUI);
    this.host.setState('item_ui');
  }

  updateSpells(input: InputManager): void { this.spellUI?.update(input); }
  updateItems(input: InputManager): void { this.itemUI?.update(input); }

  /** The item ids the open item list offers (empty when none is open). */
  get listedItemIds(): string[] { return this.itemUI?.listedItemIds ?? []; }

  closeAll(): void {
    this.closeSpells();
    this.closeItems();
  }

  private closeSpells(): void {
    if (this.spellUI) this.host.closeList(this.spellUI);
    this.spellUI = null;
  }

  private closeItems(): void {
    if (this.itemUI) this.host.closeList(this.itemUI);
    this.itemUI = null;
  }
}
