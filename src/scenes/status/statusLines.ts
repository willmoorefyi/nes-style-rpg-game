import type { Character } from '../../entities/Character.js';
import type { EquipmentSlot } from '../../types/index.js';
import { SLOT_LABELS } from '../../ui/labels.js';
import { partyRowData } from '../../ui/PartyPanel.js';
import { SpellRegistry } from '../../data/SpellRegistry.js';
import { SPELL_LEVELS } from '../../entities/SpellCharges.js';
import {
  partyAbsorb, partyAttack, partyEvade, partyHitPercent, partyHits, partyMagicDefense,
} from '../../battle/CombatStats.js';

const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['weapon', 'armor', 'shield', 'helmet'];

/** The footer: how to move between members and leave (E8). */
export const STATUS_FOOTER = '←/→ Member   X Back';

/** `label` padded so the values line up. */
const row = (label: string, value: string | number, width = 6): string => `${label.padEnd(width)}${value}`;

/** Name, class, level, ailments and `← 1/4 →`. */
export function headerLine(c: Character, index: number, size: number): string {
  const ailments = c.statusTracker.getAll().map((s) => s.effect.toUpperCase());
  if (c.currentHp <= 0 && ailments.length === 0) ailments.push('FALLEN');
  const parts = [c.name, c.classData.name, `Lv ${c.level}`, ...ailments];
  return `${parts.join('  ')}    ← ${index + 1}/${size} →`;
}

/** HP, XP, the XP to the next level and the five base stats. */
export function baseLines(c: Character): string[] {
  const s = c.stats;
  return [
    row('HP', `${c.currentHp}/${c.maxHp}`),
    row('XP', c.xp),
    partyRowData(c).next,
    '',
    row('STR', s.strength),
    row('AGI', s.agility),
    row('INT', s.intelligence),
    row('VIT', s.vitality),
    row('LCK', s.luck),
  ];
}

/** The numbers battles use (CombatStats): attack x hits, hit %, absorb, evade and magic defence (E8). */
export function battleLines(c: Character): string[] {
  return [
    row('ATK', `${partyAttack(c)} x${partyHits(c)}`, 7),
    row('Hit %', partyHitPercent(c), 7),
    row('DEF', partyAbsorb(c), 7),
    row('Evade', partyEvade(c), 7),
    row('M.Def', partyMagicDefense(c), 7),
  ];
}

/** One line per slot: `Weapon: Rapier`. */
export function equipmentLines(c: Character): string[] {
  return EQUIPMENT_SLOTS.map((slot) => `${`${SLOT_LABELS[slot]}:`.padEnd(8)}${c.getEquipped(slot)?.name ?? 'None'}`);
}

/** MS-7: one line per spell level the member has charges or spells in: "L1 2/2  CURE, FIRE". */
export function spellLines(c: Character): string[] {
  const out: string[] = [];
  for (let lv = 1; lv <= SPELL_LEVELS; lv++) {
    const max = c.getMaxCharges(lv);
    const names = c.getSpellsAtLevel(lv).map((id) => SpellRegistry.getSpell(id)?.name ?? id);
    if (max === 0 && names.length === 0) continue;
    out.push(` L${lv} ${c.getSpellCharges(lv)}/${max}  ${names.length > 0 ? names.join(', ') : '-'}`);
  }
  return out.length > 0 ? ['Spells:', ...out] : [];
}
