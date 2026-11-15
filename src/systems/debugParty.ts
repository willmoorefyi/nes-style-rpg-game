import type { Game } from '../core/Game.js';
import { Character } from '../entities/Character.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { slotOf } from '../entities/EquipmentRules.js';
import type { StatusEffect } from '../battle/StatusEffects.js';

/**
 * The debug party builder shared by the debug scenarios (`DebugScenarioLoader`) and the battle sandbox
 * (docs/FEEDBACK_PLAN_2026-11-14.md §3.8): a fresh game, then each member at its level through the class growth
 * (`new Character({ classData, level })`), its gear (`slotOf` + `equip`) and spells (`learnSpell`).
 */

export const STATUSES: readonly StatusEffect[] = ['poison', 'stun', 'sleep', 'blind', 'silence', 'death', 'stone', 'fear'];
export const isStatus = (s: string): s is StatusEffect => (STATUSES as readonly string[]).includes(s);

/** One kit entry (`assets/data/kits.yaml`): gear and spell ids. */
export interface Kit { gear: string[]; spells: string[] }
/** kits.yaml: kit name -> class id -> kit. */
export type Kits = Record<string, Record<string, Kit>>;

export interface DebugMember {
  class: string;
  name: string;
  level: number;
  equipment: string[];
  spells: { id: string; level: number }[];
  /** Start with this HP instead of full (0: fallen), for item and inn checks. */
  hp?: number;
  /** Start with these status effects, e.g. `[poison]`, for menu and battle checks. */
  status?: string[];
}

export interface DebugPartySetup {
  id: string;
  party: DebugMember[];
  /** Story flags set on the fresh game before the party is built, e.g. `[GARLAND_DEFEATED]`. */
  flags?: string[];
  items: Record<string, number>;
  gold: number;
}

export const NAKED: Kit = { gear: [], spells: [] };

/**
 * The kit `kitName` for `classId`. A promoted class without its own entry uses its base class's (`upgradeFrom`).
 * A missing kit or class entry gives `naked` and a `console.warn`.
 */
export function kitFor(kits: Kits, kitName: string, classId: string): Kit {
  const kit = kits[kitName];
  if (!kit) {
    console.warn(`Debug party: no kit '${kitName}' in kits.yaml; ${classId} goes naked`);
    return NAKED;
  }
  const base = ClassRegistry.getClass(classId)?.upgradeFrom;
  const entry = kit[classId] ?? (base ? kit[base] : undefined);
  if (!entry) {
    console.warn(`Debug party: kit '${kitName}' has no entry for ${classId}; it goes naked`);
    return NAKED;
  }
  return entry;
}

/** A member spec from a kit: gear as listed, spells at their spell level. */
export function kitMember(kit: Kit, classId: string, level: number, name: string): DebugMember {
  const spells = kit.spells.map((id) => {
    const spell = SpellRegistry.getSpell(id);
    if (!spell) console.warn(`Debug party: unknown spell '${id}' in a kit`);
    return { id, level: spell?.level ?? 1 };
  });
  return { class: classId, name, level, equipment: [...kit.gear], spells };
}

/** Build one member; null (and `console.error`) for an unknown class. Refused gear and spells warn. */
export function buildMember(member: DebugMember, context: string): Character | null {
  const classData = ClassRegistry.getClass(member.class);
  if (!classData) {
    console.error(`${context}: unknown class '${member.class}' for ${member.name}`);
    return null;
  }
  const character = new Character({ name: member.name, classData, level: member.level });
  for (const itemId of member.equipment) {
    const item = ItemRegistry.getItem(itemId);
    const slot = item ? slotOf(item) : null;
    if (!item || !slot || character.equip(slot, item) === false) {
      console.warn(`${context}: ${member.name} cannot equip '${itemId}'`);
    }
  }
  for (const spell of member.spells) {
    if (!character.learnSpell(spell.id, spell.level)) console.warn(`${context}: ${member.name} cannot learn '${spell.id}'`);
  }
  character.restoreAllCharges();
  character.currentHp = member.hp ?? character.maxHp;
  for (const status of member.status ?? []) {
    if (isStatus(status)) character.statusTracker.apply(status);
    else console.error(`${context}: unknown status '${status}' for ${member.name}`);
  }
  return character;
}

/** Reset the game and put the setup's party, flags, gold and items in it. */
export function applyDebugParty(game: Game, setup: DebugPartySetup, context = `Debug scenario ${setup.id}`): void {
  // every run starts from a fresh game (no party, items, flags or retry state from an earlier run)
  game.resetState();
  for (const flag of setup.flags ?? []) game.gameFlags.set(flag);
  for (const member of setup.party) {
    const character = buildMember(member, context);
    if (character && !game.party.add(character)) console.error(`${context}: could not add ${member.name}`);
  }
  game.party.setGold(setup.gold);
  game.inventory.clear();
  for (const [itemId, qty] of Object.entries(setup.items)) game.inventory.add(itemId, qty);
}
