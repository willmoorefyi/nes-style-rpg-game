import type { CharacterClassData, CharacterSaveData, EquipmentSlot, ItemData, StatBlock } from '../types/index.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { StatusTracker, type StatusEffect } from '../battle/StatusEffects.js';
import { equipClassOf, slotOf } from './EquipmentRules.js';
import { maxChargesFor, SPELL_LEVELS } from './SpellCharges.js';
import { levelForXp, MAX_LEVEL, xpToReach } from './ExperienceTable.js';
import { partyAttack } from '../battle/CombatStats.js';

export interface CharacterData {
  name: string;
  classData: CharacterClassData;
  level?: number;
  xp?: number;
  currentHp?: number;
}

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
    this.equipment.set('hands', null);
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

  /** `attack` is the battle number (FF1 `partyAttack`); `defense` is the armour sum plus buffs. */
  get stats(): StatBlock & { attack: number; defense: number } {
    let defense = this.getBuffAmount('defense');
    for (const item of this.equipment.values()) defense += item?.stats?.defense ?? 0;
    return { ...this.baseStats, attack: partyAttack(this), defense };
  }

  getEquipped(slot: EquipmentSlot): ItemData | null {
    return this.equipment.get(slot) ?? null;
  }

  /**
   * True if this class may use the item: `usableBy` names FF1's 12 classic classes (pass EQ D-EQ3), a copy class
   * equips as its `copyOf` source (D-EQ4), and an upgraded class also keeps its base class's gear.
   */
  canEquip(item: ItemData): boolean {
    const { upgradeFrom } = this.classData;
    const base = upgradeFrom ? ClassRegistry.getClass(upgradeFrom) : undefined;
    const inherited = base ? equipClassOf(base) : upgradeFrom;
    return item.usableBy.includes(equipClassOf(this.classData)) || (!!inherited && item.usableBy.includes(inherited));
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
    const hpBefore = this.maxHp;
    while (this._level < MAX_LEVEL && this._xp >= this.xpForNextLevel()) {
      this._level++;
      leveledUp = true;
    }
    if (leveledUp) {
      // FF1: a level-up adds the max-HP gain, it doesn't heal fully (a KO'd member stays down)
      if (this._currentHp > 0) this.currentHp = this._currentHp + this.maxHp - hpBefore;
      // current charges rise by however much the max rose
      const maxAfter = this.maxChargeList();
      for (let i = 0; i < SPELL_LEVELS; i++) {
        this.spellCharges[i] = Math.min(maxAfter[i], this.spellCharges[i] + Math.max(0, maxAfter[i] - maxBefore[i]));
      }
    }
    return leveledUp;
  }

  /** Total XP to reach the next level (FF1 table). */
  xpForNextLevel(): number {
    return xpToReach(this._level + 1);
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
    return maxChargesFor(this._classData, this._level, level);
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

  /** A battle resistance (AFIR, ARUB, WALL) or one of the worn armour's FF1 resistances (pass EQ 7.2). */
  hasTempResist(element: string): boolean {
    if (this.tempResist.has(element)) return true;
    for (const item of this.equipment.values()) if (item?.resist?.includes(element)) return true;
    return false;
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
    
    // a save from the old, steeper XP curve may hold enough XP for a higher level: never lower it
    const char = new Character({
      name: data.name,
      classData,
      level: Math.max(data.level, levelForXp(data.xp)),
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
    // the save wins, clamped to this class's table (pre-T4 saves used one table for every class)
    for (let i = 0; i < Math.min(data.spellCharges.length, SPELL_LEVELS); i++) {
      char.spellCharges[i] = Math.max(0, Math.min(data.spellCharges[i], char.getMaxCharges(i + 1)));
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