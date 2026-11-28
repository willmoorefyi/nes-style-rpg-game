/**
 * FF1 item use (pass EQ, docs/EQUIP_FF1_PLAN.md 7.3): a worn item with a `battleSpell` (the Zeus Gauntlet's LIT2, the
 * Defender's RUSE, the White Shirt's INV2 ...) casts its spell from the battle Item command, for free and as often as
 * wanted. The command is a `magic` command carrying `viaItem`; `SpellExecutor` asks this module whether the cast may go
 * ahead (silence and charges; an item cast ignores both but needs the item still worn) and how to announce it.
 */
import type { Character } from '../entities/Character.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import type { BattleCommand } from './BattleCommands.js';
import type { EquipmentSlot, ItemData, SpellData } from '../types/index.js';
import { ItemRegistry } from '../data/ItemRegistry.js';

const SLOTS: readonly EquipmentSlot[] = ['weapon', 'armor', 'shield', 'helmet', 'hands'];

/** The actor's worn items that cast a spell in battle, in slot order. */
export function wornSpellItems(c: Pick<Character, 'getEquipped'>): ItemData[] {
  return SLOTS.flatMap((s) => {
    const it = c.getEquipped(s);
    return it?.battleSpell ? [it] : [];
  });
}

/** The command a worn item's use submits: its spell, cast by the actor, at the actor (self) or the spell's group. */
export function wornCastCommand(actorId: string, item: ItemData, spell: SpellData | undefined): BattleCommand {
  const self = spell?.targeting === 'self';
  return { type: 'magic', actorId, spellId: item.battleSpell, targetId: self ? actorId : undefined, viaItem: item.id };
}

type Say = (text: string) => void;

/**
 * Whether silence stops this cast (B8: a silenced caster loses the turn and spends nothing). An item cast is never
 * stopped by silence (FF1), but stops when the actor no longer wears the item.
 */
export function silenceStops(caster: Character | EnemyInstance, name: string, cmd: BattleCommand, isEnemy: boolean, say: Say): boolean {
  if (!isEnemy && cmd.viaItem) {
    const worn = wornSpellItems(caster as Character).some((i) => i.id === cmd.viaItem);
    if (!worn) say(`${name} no longer wears the ${ItemRegistry.getItem(cmd.viaItem)?.name ?? cmd.viaItem}!`);
    return !worn;
  }
  const status = isEnemy ? (caster as EnemyInstance).status : (caster as Character).statusTracker;
  if (!status.has('silence')) return false;
  say(`${name} is silenced!`);
  return true;
}

/** Whether a missing charge stops this cast; otherwise the charge is spent. Item casts and enemies need none. */
export function chargeStops(caster: Character | EnemyInstance, spell: SpellData, cmd: BattleCommand, isEnemy: boolean, say: Say): boolean {
  if (isEnemy || cmd.viaItem) return false;
  const char = caster as Character;
  if (!char.hasCharges(spell.level)) {
    say(`${char.name} has no charges!`);
    return true;
  }
  char.useCharge(spell.level);
  return false;
}

/** "B.MAG casts FIRE!", or for an item cast "KNGHT uses the Zeus Gauntlet: LIT2!". */
export function castLine(name: string, spell: SpellData, cmd: BattleCommand): string {
  if (!cmd.viaItem) return `${name} casts ${spell.name}!`;
  return `${name} uses the ${ItemRegistry.getItem(cmd.viaItem)?.name ?? cmd.viaItem}: ${spell.name}!`;
}
