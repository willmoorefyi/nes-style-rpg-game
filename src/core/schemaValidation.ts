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

/** Each listed key, when present, must be a number (the optional FF1 combat fields). */
function assertOptionalNumbers(path: string, obj: Record<string, unknown>, keys: string[]): void {
  for (const key of keys) {
    if (obj[key] !== undefined) assertNumber(`${path}.${key}`, obj[key]);
  }
}

/** `{base, growth}` per-level class numbers (hitPercent, magicDefense), when present. */
function assertOptionalGrowth(path: string, value: unknown): void {
  if (value === undefined) return;
  assertObject(path, value);
  assertNumber(`${path}.base`, value.base);
  assertNumber(`${path}.growth`, value.growth);
}

/** `spellCharges: [[level, [l1..l8]], ...]`, when present. */
function assertOptionalChargeTable(path: string, value: unknown): void {
  if (value === undefined) return;
  assertArray(path, value);
  value.forEach((step, i) => {
    assertArray(`${path}[${i}]`, step);
    if (step.length !== 2) throw new ValidationError(`${path}[${i}]: expected [level, [charges...]]`);
    assertNumber(`${path}[${i}][0]`, step[0]);
    assertArray(`${path}[${i}][1]`, step[1]);
    (step[1] as unknown[]).forEach((n, j) => assertNumber(`${path}[${i}][1][${j}]`, n));
  });
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
  assertOptionalNumbers('EnemyData.stats', data.stats as Record<string, unknown>, ['accuracy', 'evade', 'hits', 'crit']);
  
  return data as unknown as EnemyData;
}

/** `inspect: [{x, y, text}]`: in-bounds cells; `text` is non-empty, all strings or all `{condition?, text: string[]}`. */
function validateInspect(value: unknown, width: number, height: number): void {
  assertArray('MapData.inspect', value);
  value.forEach((cell, i) => {
    const path = `MapData.inspect[${i}]`;
    assertObject(path, cell);
    assertNumber(`${path}.x`, cell.x);
    assertNumber(`${path}.y`, cell.y);
    if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
      throw new ValidationError(`${path}: cell (${cell.x}, ${cell.y}) is outside the ${width}x${height} map`);
    }
    const extra = Object.keys(cell).filter((k) => !['x', 'y', 'text'].includes(k));
    if (extra.length) throw new ValidationError(`${path}: unknown keys ${extra.join(', ')}`);
    const text = cell.text;
    assertArray(`${path}.text`, text);
    if (text.length === 0) throw new ValidationError(`${path}.text: expected at least one line`);
    if (typeof text[0] === 'string') {
      text.forEach((line, j) => assertString(`${path}.text[${j}]`, line));
      return;
    }
    text.forEach((entry, j) => {
      assertObject(`${path}.text[${j}]`, entry);
      const bad = Object.keys(entry).filter((k) => k !== 'text' && k !== 'condition');
      if (bad.length) throw new ValidationError(`${path}.text[${j}]: unknown keys ${bad.join(', ')} (use condition)`);
      if (entry.condition !== undefined) assertString(`${path}.text[${j}].condition`, entry.condition);
      assertArray(`${path}.text[${j}].text`, entry.text);
      (entry.text as unknown[]).forEach((line, k) => assertString(`${path}.text[${j}].text[${k}]`, line));
    });
  });
}

export function validateMapData(data: unknown): MapData {
  assertObject('MapData', data);
  assertString('MapData.id', data.id);
  assertNumber('MapData.width', data.width);
  assertNumber('MapData.height', data.height);
  assertArray('MapData.layers', data.layers);
  assertArray('MapData.tilesets', data.tilesets);
  assertArray('MapData.collision', data.collision);
  // Validate collision array matches map dimensions
  const collisionArr = data.collision as unknown[];
  const expectedSize = (data.width as number) * (data.height as number);
  if (collisionArr.length > 0 && collisionArr.length !== expectedSize) {
    throw new ValidationError(
      `MapData.collision: expected length ${expectedSize} (width*height), got ${collisionArr.length}`
    );
  }
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
    if (n.cutscene !== undefined) {
      assertObject(`MapData.npcs[${i}].cutscene`, n.cutscene);
      const c = n.cutscene as Record<string, unknown>;
      assertString(`MapData.npcs[${i}].cutscene.id`, c.id);
      assertString(`MapData.npcs[${i}].cutscene.onceFlag`, c.onceFlag);
      if (c.requiredFlag !== undefined) assertString(`MapData.npcs[${i}].cutscene.requiredFlag`, c.requiredFlag);
    }
  });
  
  // Validate each transition
  (data.transitions as unknown[]).forEach((trans, i) => {
    assertObject(`MapData.transitions[${i}]`, trans);
    const t = trans as Record<string, unknown>;
    assertNumber(`MapData.transitions[${i}].x`, t.x);
    assertNumber(`MapData.transitions[${i}].y`, t.y);
    assertString(`MapData.transitions[${i}].targetMap`, t.targetMap);
    if (t.targetEntrance !== undefined) {
      assertString(`MapData.transitions[${i}].targetEntrance`, t.targetEntrance);
      if (t.targetX !== undefined || t.targetY !== undefined) {
        throw new ValidationError(`MapData.transitions[${i}]: give targetEntrance or targetX/targetY, not both`);
      }
    } else {
      assertNumber(`MapData.transitions[${i}].targetX`, t.targetX);
      assertNumber(`MapData.transitions[${i}].targetY`, t.targetY);
    }
  });

  if (data.entrances !== undefined) {
    assertObject('MapData.entrances', data.entrances);
    for (const [name, pos] of Object.entries(data.entrances as Record<string, unknown>)) {
      assertArray(`MapData.entrances.${name}`, pos);
      const p = pos as unknown[];
      if (p.length !== 2) throw new ValidationError(`MapData.entrances.${name}: expected [x, y]`);
      assertNumber(`MapData.entrances.${name}[0]`, p[0]);
      assertNumber(`MapData.entrances.${name}[1]`, p[1]);
    }
  }
  if (data.noWander !== undefined) {
    assertArray('MapData.noWander', data.noWander);
    (data.noWander as unknown[]).forEach((pos, i) => {
      assertArray(`MapData.noWander[${i}]`, pos);
      const p = pos as unknown[];
      if (p.length !== 2) throw new ValidationError(`MapData.noWander[${i}]: expected [x, y]`);
      assertNumber(`MapData.noWander[${i}][0]`, p[0]);
      assertNumber(`MapData.noWander[${i}][1]`, p[1]);
    });
  }
  if (data.inspect !== undefined) validateInspect(data.inspect, data.width as number, data.height as number);
  if (data.art !== undefined) validateBakedArt(data.art, data.width as number, data.height as number);
  
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
  assertOptionalGrowth('CharacterClassData.hitPercent', data.hitPercent);
  assertOptionalGrowth('CharacterClassData.magicDefense', data.magicDefense);
  assertOptionalChargeTable('CharacterClassData.spellCharges', data.spellCharges);
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
  assertOptionalNumbers('ItemData', data, ['hit', 'crit', 'weight']);
  return data as unknown as import('../types/index.js').ItemData;
}

const VALID_SPELL_TYPES = ['white', 'black'];
const VALID_TARGETING = ['single', 'all', 'self', 'single_ally', 'all_allies'];

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
  assertOptionalNumbers('SpellData', data, ['accuracy', 'price']);
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

/** `art` of a compiled map: both chunk lists cover ceil(w/chunk) * ceil(h/chunk) chunks; `above` may hold nulls. */
function validateBakedArt(art: unknown, width: number, height: number): void {
  assertObject('MapData.art', art);
  const a = art as Record<string, unknown>;
  assertNumber('MapData.art.tile', a.tile);
  assertNumber('MapData.art.chunk', a.chunk);
  assertArray('MapData.art.below', a.below);
  assertArray('MapData.art.above', a.above);
  const chunk = a.chunk as number;
  const expected = Math.ceil(width / chunk) * Math.ceil(height / chunk);
  for (const key of ['below', 'above'] as const) {
    const list = a[key] as unknown[];
    if (list.length !== expected) {
      throw new ValidationError(`MapData.art.${key}: expected ${expected} chunks, got ${list.length}`);
    }
    list.forEach((v, i) => {
      if (key === 'above' && v === null) return;
      assertString(`MapData.art.${key}[${i}]`, v);
    });
  }
}
