import type { CharacterClassData, EquipmentSlot, ItemData, StatBlock } from '../types/index.js';

export interface CharacterData {
  name: string;
  classData: CharacterClassData;
  level?: number;
  xp?: number;
  currentHp?: number;
}

const XP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

export class Character {
  readonly name: string;
  readonly classData: CharacterClassData;
  private _level: number;
  private _xp: number;
  private _currentHp: number;
  private equipment: Map<EquipmentSlot, ItemData | null> = new Map();
  private spellCharges: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private learnedSpells: Map<string, number> = new Map();

  constructor(data: CharacterData) {
    this.name = data.name;
    this.classData = data.classData;
    this._level = data.level ?? 1;
    this._xp = data.xp ?? 0;
    this.equipment.set('weapon', null);
    this.equipment.set('armor', null);
    this.equipment.set('shield', null);
    this.equipment.set('helmet', null);
    this._currentHp = data.currentHp ?? this.maxHp;
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
    return { ...base, attack, defense };
  }

  getEquipped(slot: EquipmentSlot): ItemData | null {
    return this.equipment.get(slot) ?? null;
  }

  canEquip(item: ItemData): boolean {
    return item.usableBy.includes(this.classData.id);
  }

  equip(slot: EquipmentSlot, item: ItemData): ItemData | null {
    if (!this.canEquip(item)) return null;
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
    while (this._level < 50 && this._xp >= this.xpForNextLevel()) {
      this._level++;
      leveledUp = true;
      this._currentHp = this.maxHp;
    }
    return leveledUp;
  }

  xpForNextLevel(): number {
    if (this._level >= 50) return Infinity;
    if (this._level < XP_THRESHOLDS.length) return XP_THRESHOLDS[this._level];
    return Math.floor(XP_THRESHOLDS[9] * Math.pow(1.5, this._level - 9));
  }

  getSpellCharges(level: number): number {
    return this.spellCharges[level - 1] ?? 0;
  }

  setSpellCharges(level: number, charges: number): void {
    if (level >= 1 && level <= 8) this.spellCharges[level - 1] = charges;
  }

  learnSpell(spellId: string, level: number): void {
    this.learnedSpells.set(spellId, level);
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
    for (let i = 0; i < 8; i++) {
      const lvl = i + 1;
      this.spellCharges[i] = this.getMaxCharges(lvl);
    }
  }

  getMaxCharges(level: number): number {
    // Simple formula: higher character level = more charges, lower spell level = more charges
    return Math.max(0, 4 - level + Math.floor(this._level / 5));
  }

  toJSON(): object {
    return {
      name: this.name,
      classId: this.classData.id,
      level: this._level,
      xp: this._xp,
      currentHp: this._currentHp,
      equipment: Object.fromEntries(
        [...this.equipment.entries()].map(([k, v]) => [k, v?.id ?? null])
      ),
      spellCharges: [...this.spellCharges],
    };
  }
}