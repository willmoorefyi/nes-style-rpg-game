import type { EnemyData, MapData, ShopData, StatBlock } from '../types/index.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function formatError(path: string, expected: string, got: unknown): string {
  const gotType = got === null ? 'null' : Array.isArray(got) ? 'array' : typeof got;
  return `${path}: expected ${expected}, got ${gotType}`;
}

function assertType(path: string, value: unknown, expected: string): void {
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (actual !== expected) {
    throw new ValidationError(formatError(path, expected, value));
  }
}

function assertString(path: string, value: unknown): asserts value is string {
  assertType(path, value, 'string');
}

function assertNumber(path: string, value: unknown): asserts value is number {
  assertType(path, value, 'number');
}

function assertArray(path: string, value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(formatError(path, 'array', value));
  }
}

function assertObject(path: string, value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(formatError(path, 'object', value));
  }
}

function validateStatBlock(path: string, data: unknown): StatBlock {
  assertObject(path, data);
  assertNumber(`${path}.hp`, data.hp);
  assertNumber(`${path}.strength`, data.strength);
  assertNumber(`${path}.agility`, data.agility);
  assertNumber(`${path}.intelligence`, data.intelligence);
  assertNumber(`${path}.vitality`, data.vitality);
  assertNumber(`${path}.luck`, data.luck);
  return data as unknown as StatBlock;
}

export function validateEnemyData(data: unknown): EnemyData {
  assertObject('EnemyData', data);
  assertString('EnemyData.id', data.id);
  assertString('EnemyData.name', data.name);
  assertNumber('EnemyData.xpReward', data.xpReward);
  assertNumber('EnemyData.goldReward', data.goldReward);
  assertString('EnemyData.sprite', data.sprite);
  
  assertObject('EnemyData.stats', data.stats);
  validateStatBlock('EnemyData.stats', data.stats);
  assertNumber('EnemyData.stats.attack', (data.stats as Record<string, unknown>).attack);
  assertNumber('EnemyData.stats.defense', (data.stats as Record<string, unknown>).defense);
  assertNumber('EnemyData.stats.magicDefense', (data.stats as Record<string, unknown>).magicDefense);
  
  return data as unknown as EnemyData;
}

export function validateMapData(data: unknown): MapData {
  assertObject('MapData', data);
  assertString('MapData.id', data.id);
  assertNumber('MapData.width', data.width);
  assertNumber('MapData.height', data.height);
  assertArray('MapData.layers', data.layers);
  assertArray('MapData.tilesets', data.tilesets);
  assertArray('MapData.collision', data.collision);
  assertArray('MapData.npcs', data.npcs);
  assertArray('MapData.transitions', data.transitions);
  
  // Validate each NPC
  (data.npcs as unknown[]).forEach((npc, i) => {
    assertObject(`MapData.npcs[${i}]`, npc);
    const n = npc as Record<string, unknown>;
    assertString(`MapData.npcs[${i}].id`, n.id);
    assertNumber(`MapData.npcs[${i}].x`, n.x);
    assertNumber(`MapData.npcs[${i}].y`, n.y);
    assertString(`MapData.npcs[${i}].sprite`, n.sprite);
    assertArray(`MapData.npcs[${i}].dialog`, n.dialog);
  });
  
  // Validate each transition
  (data.transitions as unknown[]).forEach((trans, i) => {
    assertObject(`MapData.transitions[${i}]`, trans);
    const t = trans as Record<string, unknown>;
    assertNumber(`MapData.transitions[${i}].x`, t.x);
    assertNumber(`MapData.transitions[${i}].y`, t.y);
    assertString(`MapData.transitions[${i}].targetMap`, t.targetMap);
    assertNumber(`MapData.transitions[${i}].targetX`, t.targetX);
    assertNumber(`MapData.transitions[${i}].targetY`, t.targetY);
  });
  
  return data as unknown as MapData;
}


export function validateCharacterClassData(data: unknown): import('../types/index.js').CharacterClassData {
  assertObject('CharacterClassData', data);
  assertString('CharacterClassData.id', data.id);
  assertString('CharacterClassData.name', data.name);
  validateStatBlock('CharacterClassData.baseStats', data.baseStats);
  validateStatBlock('CharacterClassData.statGrowth', data.statGrowth);
  assertArray('CharacterClassData.usableEquipment', data.usableEquipment);
  (data.usableEquipment as unknown[]).forEach((e, i) => assertString(`CharacterClassData.usableEquipment[${i}]`, e));
  assertObject('CharacterClassData.spellLevels', data.spellLevels);
  assertNumber('CharacterClassData.spellLevels.white', (data.spellLevels as Record<string, unknown>).white);
  assertNumber('CharacterClassData.spellLevels.black', (data.spellLevels as Record<string, unknown>).black);
  return data as unknown as import('../types/index.js').CharacterClassData;
}

const VALID_ITEM_TYPES = ['weapon', 'armor', 'consumable', 'key'];

export function validateItemData(data: unknown): import('../types/index.js').ItemData {
  assertObject('ItemData', data);
  assertString('ItemData.id', data.id);
  assertString('ItemData.name', data.name);
  assertString('ItemData.type', data.type);
  if (!VALID_ITEM_TYPES.includes(data.type as string)) {
    throw new ValidationError(`ItemData.type: expected one of ${VALID_ITEM_TYPES.join(', ')}, got ${data.type}`);
  }
  assertObject('ItemData.stats', data.stats);
  assertNumber('ItemData.price', data.price);
  assertArray('ItemData.usableBy', data.usableBy);
  (data.usableBy as unknown[]).forEach((e, i) => assertString(`ItemData.usableBy[${i}]`, e));
  return data as unknown as import('../types/index.js').ItemData;
}

const VALID_SPELL_TYPES = ['white', 'black'];
const VALID_TARGETING = ['single', 'all', 'self'];

export function validateSpellData(data: unknown): import('../types/index.js').SpellData {
  assertObject('SpellData', data);
  assertString('SpellData.id', data.id);
  assertString('SpellData.name', data.name);
  assertNumber('SpellData.level', data.level);
  assertString('SpellData.type', data.type);
  if (!VALID_SPELL_TYPES.includes(data.type as string)) {
    throw new ValidationError(`SpellData.type: expected one of ${VALID_SPELL_TYPES.join(', ')}, got ${data.type}`);
  }
  assertString('SpellData.effect', data.effect);
  assertString('SpellData.targeting', data.targeting);
  if (!VALID_TARGETING.includes(data.targeting as string)) {
    throw new ValidationError(`SpellData.targeting: expected one of ${VALID_TARGETING.join(', ')}, got ${data.targeting}`);
  }
  assertString('SpellData.description', data.description);
  return data as unknown as import('../types/index.js').SpellData;
}

const VALID_SHOP_TYPES = ['weapon', 'armor', 'item', 'magic', 'inn'];

export function validateShopData(data: unknown): ShopData {
  assertObject('ShopData', data);
  assertString('ShopData.id', data.id);
  assertString('ShopData.type', data.type);
  if (!VALID_SHOP_TYPES.includes(data.type as string)) {
    throw new ValidationError(`ShopData.type: expected one of ${VALID_SHOP_TYPES.join(', ')}, got ${data.type}`);
  }
  assertString('ShopData.name', data.name);
  assertArray('ShopData.inventory', data.inventory);
  (data.inventory as unknown[]).forEach((e, i) => assertString(`ShopData.inventory[${i}]`, e));
  if (data.innPrice !== undefined) {
    assertNumber('ShopData.innPrice', data.innPrice);
  }
  return data as unknown as ShopData;
}
