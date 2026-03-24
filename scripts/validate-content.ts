#!/usr/bin/env npx tsx
/**
 * Standalone content validation script.
 * Validates all cross-file references between YAML data files.
 *
 * Usage: npx tsx scripts/validate-content.ts
 * Or:    npm run validate
 *
 * Exits 0 if all references are valid, 1 if errors found.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const dataDir = join(root, 'assets/data');
const mapsDir = join(root, 'assets/maps');

// ── Load data ──────────────────────────────────────────────

interface ItemEntry { id: string; usableBy: string[] }
interface SpellEntry { id: string; element: string; effect: string }
interface EnemyEntry { id: string; weakness?: string; resist?: string }
interface ClassEntry { id: string; upgradeFrom?: string }
interface ShopEntry { id: string; type: string; inventory: string[] }
interface MapEntry {
  id: string;
  encounters?: Array<{ enemies: string[] }>;
  transitions?: Array<{ targetMap: string }>;
}

const items: ItemEntry[] = parse(readFileSync(join(dataDir, 'items.yaml'), 'utf-8'));
const spells: SpellEntry[] = parse(readFileSync(join(dataDir, 'spells.yaml'), 'utf-8'));
const enemies: EnemyEntry[] = parse(readFileSync(join(dataDir, 'enemies.yaml'), 'utf-8'));
const classes: ClassEntry[] = parse(readFileSync(join(dataDir, 'classes.yaml'), 'utf-8'));
const shops: ShopEntry[] = parse(readFileSync(join(dataDir, 'shops.yaml'), 'utf-8'));

const mapFiles = readdirSync(mapsDir).filter((f) => f.endsWith('.yaml'));
const maps: MapEntry[] = mapFiles.map((f) =>
  parse(readFileSync(join(mapsDir, f), 'utf-8'))
);

// ── Build lookup sets ──────────────────────────────────────

const itemIds = new Set(items.map((i) => i.id));
const spellIds = new Set(spells.map((s) => s.id));
const enemyIds = new Set(enemies.map((e) => e.id));
const classIds = new Set(classes.map((c) => c.id));
const mapIds = new Set(maps.map((m) => m.id));
const baseClassIds = new Set(classes.filter((c) => !c.upgradeFrom).map((c) => c.id));

const validElements = new Set([
  'fire', 'ice', 'lightning', 'earth', 'holy', 'dark', 'water', 'wind', 'none',
]);
const validStatuses = new Set([
  'poison', 'stun', 'sleep', 'blind', 'silence', 'death',
]);

// ── Validation ─────────────────────────────────────────────

const errors: string[] = [];

function check(condition: boolean, msg: string): void {
  if (!condition) errors.push(msg);
}

// Duplicate IDs
function checkDuplicates(arr: Array<{ id: string }>, label: string): void {
  const seen = new Set<string>();
  for (const entry of arr) {
    check(!seen.has(entry.id), `${label}: duplicate ID "${entry.id}"`);
    seen.add(entry.id);
  }
}

checkDuplicates(items, 'items.yaml');
checkDuplicates(spells, 'spells.yaml');
checkDuplicates(enemies, 'enemies.yaml');
checkDuplicates(classes, 'classes.yaml');
checkDuplicates(shops, 'shops.yaml');
checkDuplicates(maps, 'maps');

// Shop → items/spells
for (const shop of shops) {
  if (['weapon', 'armor', 'item'].includes(shop.type)) {
    for (const id of shop.inventory) {
      check(itemIds.has(id), `shop "${shop.id}": item "${id}" not found in items.yaml`);
    }
  }
  if (shop.type === 'magic') {
    for (const id of shop.inventory) {
      check(spellIds.has(id), `shop "${shop.id}": spell "${id}" not found in spells.yaml`);
    }
  }
}

// Encounter enemies
for (const map of maps) {
  for (const enc of map.encounters ?? []) {
    for (const id of enc.enemies) {
      check(enemyIds.has(id), `map "${map.id}": enemy "${id}" not found in enemies.yaml`);
    }
  }
}

// Map transitions
for (const map of maps) {
  for (const t of map.transitions ?? []) {
    check(mapIds.has(t.targetMap), `map "${map.id}": transition target "${t.targetMap}" not found in maps`);
  }
}

// Item usableBy → classes
for (const item of items) {
  for (const cid of item.usableBy) {
    check(classIds.has(cid), `item "${item.id}": usableBy class "${cid}" not found in classes.yaml`);
  }
}

// Spell elements
for (const spell of spells) {
  check(validElements.has(spell.element), `spell "${spell.id}": invalid element "${spell.element}"`);
}

// Spell status effects
for (const spell of spells) {
  if (spell.effect.startsWith('status_')) {
    const status = spell.effect.replace('status_', '');
    check(validStatuses.has(status), `spell "${spell.id}": invalid status effect "${status}"`);
  }
}

// Enemy weakness/resist elements
for (const enemy of enemies) {
  if (enemy.weakness) {
    check(validElements.has(enemy.weakness), `enemy "${enemy.id}": invalid weakness "${enemy.weakness}"`);
  }
  if (enemy.resist) {
    check(validElements.has(enemy.resist), `enemy "${enemy.id}": invalid resist "${enemy.resist}"`);
  }
}

// Class upgradeFrom → valid base class
for (const cls of classes) {
  if (cls.upgradeFrom) {
    check(classIds.has(cls.upgradeFrom), `class "${cls.id}": upgradeFrom "${cls.upgradeFrom}" not found in classes.yaml`);
    check(baseClassIds.has(cls.upgradeFrom), `class "${cls.id}": upgradeFrom "${cls.upgradeFrom}" is not a base class`);
  }
}

// ── Report ─────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`\n❌ Content validation failed with ${errors.length} error(s):\n`);
  for (const err of errors) {
    console.error(`  • ${err}`);
  }
  console.error('');
  process.exit(1);
} else {
  const counts = {
    items: items.length,
    spells: spells.length,
    enemies: enemies.length,
    classes: classes.length,
    shops: shops.length,
    maps: maps.length,
  };
  console.log('\n✅ Content validation passed!\n');
  console.log(`  ${counts.items} items, ${counts.spells} spells, ${counts.enemies} enemies`);
  console.log(`  ${counts.classes} classes, ${counts.shops} shops, ${counts.maps} maps\n`);
}
