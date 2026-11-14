import type { CharacterClassData, CharacterSaveData, EquipmentSlot, ItemData, StatBlock } from '../types/index.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { StatusTracker, type StatusEffect } from '../battle/StatusEffects.js';
import { slotOf } from './EquipmentRules.js';
import { maxChargesFor, SPELL_LEVELS } from './SpellCharges.js';

export interface CharacterData {
  name: string;
  classData: CharacterClassData;
  level?: number;
  xp?: number;
  currentHp?: number;
}

// XP required to reach each level (index = level).
// Curve: exponential ~1.25x per level, tuned to match design doc §7 targets:
//   Lv1=0, Lv10≈10,000, Lv20≈50,000, Lv30≈150,000, Lv50≈500,000
const XP_THRESHOLDS: number[] = (() => {
  const table = [0]; // Lv1 = 0 XP
  for (let lvl = 2; lvl <= 50; lvl++) {
    // Base formula: 25 * lvl^2.6 produces a smooth exponential curve
    table.push(Math.floor(25 * Math.pow(lvl, 2.6)));
  }
  return table;
})();

export class Character {
  readonly name: string;
  private _classData: CharacterClassData;
  private _level: number;
  private _xp: number;
  private _currentHp: number;
  private equipment: Map<EquipmentSlot, ItemData | null> = new Map();
  private spellCharges: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private learnedSpells: Map<string, number> = new Map();
  readonly statusTracker: StatusTracker = new StatusTracker();

  // Battle-only buff tracking — not serialized, cleared on battle end
  private battleBuffs: Map<string, number> = new Map();
  private tempResist: Set<string> = new Set();

  constructor(data: CharacterData) {
    this.name = data.name;
    this._classData = data.classData;
    this._level = data.level ?? 1;
    this._xp = data.xp ?? 0;
    this.equipment.set('weapon', null);
    this.equipment.set('armor', null);
    this.equipment.set('shield', null);
    this.equipment.set('helmet', null);
    this._currentHp = data.currentHp ?? this.maxHp;
    // a new character starts rested: full charges for its level (a save overwrites these in fromJSON)
    this.restoreAllCharges();
  }

  get classData(): CharacterClassData { return this._classData; }

  /** Upgrade character to a new class. Heals to full HP per FF1 behavior. */
  upgrade(newClassData: CharacterClassData): void {
    this._classData = newClassData;
    this._currentHp = this.maxHp;
  }

  get level(): number { return this._level; }
  get xp(): number { return this._xp; }
  get currentHp(): number { return this._currentHp; }
  set currentHp(v: number) { this._currentHp = Math.max(0, Math.min(v, this.maxHp)); }

  get baseStats(): StatBlock {
    const base = this.classData.baseStats;
    const growth = this.classData.statGrowth;
    const lvl = this._level - 1;
    return {
      hp: base.hp + growth.hp * lvl,
      strength: base.strength + growth.strength * lvl,
      agility: base.agility + growth.agility * lvl,
      intelligence: base.intelligence + growth.intelligence * lvl,
      vitality: base.vitality + growth.vitality * lvl,
      luck: base.luck + growth.luck * lvl,
    };
  }

  get maxHp(): number { return this.baseStats.hp; }

  get stats(): StatBlock & { attack: number; defense: number } {
    const base = this.baseStats;
    let attack = base.strength;
    let defense = 0;
    for (const item of this.equipment.values()) {
      if (item?.stats) {
        attack += item.stats.attack ?? 0;
        defense += item.stats.defense ?? 0;
      }
    }
    // Apply battle-only buffs (cleared on battle end)
    attack += this.getBuffAmount('attack');
    defense += this.getBuffAmount('defense');
    return { ...base, attack, defense };
  }

  getEquipped(slot: EquipmentSlot): ItemData | null {
    return this.equipment.get(slot) ?? null;
  }

  /** True if this class may use the item; an upgraded class (Knight) keeps its base class's gear. */
  canEquip(item: ItemData): boolean {
    const { id, upgradeFrom } = this.classData;
    return item.usableBy.includes(id) || (!!upgradeFrom && item.usableBy.includes(upgradeFrom));
  }

  /** True if this class may use the item and the item fits `slot` (a cap is never body armour). */
  canEquipIn(slot: EquipmentSlot, item: ItemData): boolean {
    return this.canEquip(item) && slotOf(item) === slot;
  }

  /** Equip `item` in `slot`. Returns the item it replaced (or null), or false if refused. */
  equip(slot: EquipmentSlot, item: ItemData): ItemData | null | false {
    if (!this.canEquipIn(slot, item)) return false;
    const prev = this.equipment.get(slot) ?? null;
    this.equipment.set(slot, item);
    return prev;
  }

  unequip(slot: EquipmentSlot): ItemData | null {
    const prev = this.equipment.get(slot) ?? null;
    this.equipment.set(slot, null);
    return prev;
  }

  addXp(amount: number): boolean {
    this._xp += amount;
    let leveledUp = false;
    const maxBefore = this.maxChargeList();
    while (this._level < 50 && this._xp >= this.xpForNextLevel()) {
      this._level++;
      leveledUp = true;
      this._currentHp = this.maxHp;
    }
    if (leveledUp) {
      // current charges rise by however much the max rose
      const maxAfter = this.maxChargeList();
      for (let i = 0; i < SPELL_LEVELS; i++) {
        this.spellCharges[i] = Math.min(maxAfter[i], this.spellCharges[i] + Math.max(0, maxAfter[i] - maxBefore[i]));
      }
    }
    return leveledUp;
  }

  xpForNextLevel(): number {
    if (this._level >= 50) return Infinity;
    return XP_THRESHOLDS[this._level] ?? Infinity;
  }

  getSpellCharges(level: number): number {
    return this.spellCharges[level - 1] ?? 0;
  }

  setSpellCharges(level: number, charges: number): void {
    if (level >= 1 && level <= 8) this.spellCharges[level - 1] = charges;
  }

  learnSpell(spellId: string, level: number): boolean {
    if (this.learnedSpells.has(spellId)) return true;
    const knownAtLevel = this.getSpellsAtLevel(level).length;
    if (knownAtLevel >= 3) return false;
    this.learnedSpells.set(spellId, level);
    // the first spell at a level comes with that level's charges, so it can be cast at once
    if (knownAtLevel === 0) {
      this.setSpellCharges(level, Math.max(this.getSpellCharges(level), this.getMaxCharges(level)));
    }
    return true;
  }

  getLearnedSpells(): Array<{ spellId: string; level: number }> {
    return Array.from(this.learnedSpells.entries()).map(([spellId, level]) => ({ spellId, level }));
  }

  getSpellsAtLevel(level: number): string[] {
    return Array.from(this.learnedSpells.entries())
      .filter(([, l]) => l === level)
      .map(([id]) => id);
  }

  hasCharges(level: number): boolean {
    return this.getSpellCharges(level) > 0;
  }

  useCharge(level: number): boolean {
    if (!this.hasCharges(level)) return false;
    this.spellCharges[level - 1]--;
    return true;
  }

  restoreAllCharges(): void {
    for (let i = 0; i < SPELL_LEVELS; i++) {
      this.spellCharges[i] = this.getMaxCharges(i + 1);
    }
  }

  getMaxCharges(level: number): number {
    return maxChargesFor(this._level, level);
  }

  private maxChargeList(): number[] {
    return Array.from({ length: SPELL_LEVELS }, (_, i) => this.getMaxCharges(i + 1));
  }

  /** Apply a battle-only buff to a stat (stacks additively) */
  applyBuff(stat: string, amount: number): void {
    const current = this.battleBuffs.get(stat) ?? 0;
    this.battleBuffs.set(stat, current + amount);
  }

  getBuffAmount(stat: string): number {
    return this.battleBuffs.get(stat) ?? 0;
  }

  addTempResist(element: string): void {
    this.tempResist.add(element);
  }

  hasTempResist(element: string): boolean {
    return this.tempResist.has(element);
  }

  /** Clear all battle-only state (buffs, temp resistances) — called on battle end */
  clearBattleState(): void {
    this.battleBuffs.clear();
    this.tempResist.clear();
  }

  toJSON(): CharacterSaveData {
    return {
      name: this.name,
      classId: this.classData.id,
      level: this._level,
      xp: this._xp,
      currentHp: this._currentHp,
      equipment: Object.fromEntries(
        [...this.equipment.entries()].map(([k, v]) => [k, v?.id ?? null])
      ) as Record<EquipmentSlot, string | null>,
      spellCharges: [...this.spellCharges],
      learnedSpells: this.getLearnedSpells(),
      statusEffects: this.statusTracker.toJSON(),
    };
  }

  static fromJSON(data: CharacterSaveData): Character | null {
    const classData = ClassRegistry.getClass(data.classId);
    if (!classData) return null;
    
    const char = new Character({
      name: data.name,
      classData,
      level: data.level,
      xp: data.xp,
      currentHp: data.currentHp,
    });
    
    // Restore equipment
    for (const [slot, itemId] of Object.entries(data.equipment)) {
      if (itemId) {
        const item = ItemRegistry.getItem(itemId);
        if (item) char.equipment.set(slot as EquipmentSlot, item);
      }
    }
    
    // Restore learned spells, then the saved charges (learning grants charges, the save wins)
    for (const { spellId, level } of data.learnedSpells) {
      char.learnSpell(spellId, level);
    }
    for (let i = 0; i < data.spellCharges.length; i++) {
      char.spellCharges[i] = data.spellCharges[i];
    }
    
    // Restore status effects
    if (data.statusEffects) {
      for (const { effect, duration } of data.statusEffects) {
        char.statusTracker.apply(effect as StatusEffect, duration);
      }
    }
    
    return char;
  }
}