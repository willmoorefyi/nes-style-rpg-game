import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Load all YAML data files using readFileSync (asset files, not modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = resolve(__dirname, '../../assets/data');
const mapsDir = resolve(__dirname, '../../assets/maps');

const items: Array<{ id: string; usableBy: string[] }> = parse(
  readFileSync(join(dataDir, 'items.yaml'), 'utf-8')
);
const spells: Array<{ id: string; element: string; effect: string }> = parse(
  readFileSync(join(dataDir, 'spells.yaml'), 'utf-8')
);
const enemies: Array<{ id: string; weakness?: string; resist?: string }> = parse(
  readFileSync(join(dataDir, 'enemies.yaml'), 'utf-8')
);
const classes: Array<{ id: string }> = parse(
  readFileSync(join(dataDir, 'classes.yaml'), 'utf-8')
);
const shops: Array<{ id: string; type: string; inventory: string[] }> = parse(
  readFileSync(join(dataDir, 'shops.yaml'), 'utf-8')
);
const testTown: { encounters: Array<{ enemies: string[] }> } = parse(
  readFileSync(join(mapsDir, 'test-town.yaml'), 'utf-8')
);

// Build lookup sets
const itemIds = new Set(items.map((i) => i.id));
const spellIds = new Set(spells.map((s) => s.id));
const enemyIds = new Set(enemies.map((e) => e.id));
const classIds = new Set(classes.map((c) => c.id));

// Valid enum values (hardcoded — changes rarely, test fails if data uses unknown value)
const validElements = new Set([
  'fire', 'ice', 'lightning', 'earth', 'holy', 'dark', 'water', 'wind', 'none',
]);
const validStatusEffects = new Set([
  'poison', 'stun', 'sleep', 'blind', 'silence', 'death',
]);

describe('Cross-file data validation', () => {
  // (a) Shop weapon/armor/item inventory → items.yaml
  describe('Shop → Items', () => {
    const itemShops = shops.filter((s) => ['weapon', 'armor', 'item'].includes(s.type));
    itemShops.forEach((shop) => {
      shop.inventory.forEach((itemId) => {
        it(`shop "${shop.id}" references item "${itemId}" that exists in items.yaml`, () => {
          expect(itemIds.has(itemId)).toBe(true);
        });
      });
    });
  });

  // (b) Magic shop inventory → spells.yaml
  describe('Magic Shop → Spells', () => {
    const magicShops = shops.filter((s) => s.type === 'magic');
    magicShops.forEach((shop) => {
      shop.inventory.forEach((spellId) => {
        it(`shop "${shop.id}" references spell "${spellId}" that exists in spells.yaml`, () => {
          expect(spellIds.has(spellId)).toBe(true);
        });
      });
    });
  });

  // (c) Map encounter tables → enemies.yaml
  describe('Encounter → Enemies', () => {
    testTown.encounters.forEach((enc, i) => {
      enc.enemies.forEach((enemyId) => {
        it(`encounter[${i}] references enemy "${enemyId}" that exists in enemies.yaml`, () => {
          expect(enemyIds.has(enemyId)).toBe(true);
        });
      });
    });
  });

  // (d) Item usableBy → classes.yaml
  describe('Item usableBy → Classes', () => {
    items
      .filter((item) => item.usableBy.length > 0)
      .forEach((item) => {
        item.usableBy.forEach((classId) => {
          it(`item "${item.id}" usableBy references class "${classId}" that exists in classes.yaml`, () => {
            expect(classIds.has(classId)).toBe(true);
          });
        });
      });
  });

  // (e) Spell elements → valid ElementType values
  describe('Spell elements → ElementType', () => {
    spells.forEach((spell) => {
      it(`spell "${spell.id}" has valid element "${spell.element}"`, () => {
        expect(validElements.has(spell.element)).toBe(true);
      });
    });
  });

  // (f) Enemy weakness/resist → valid ElementType values
  describe('Enemy elemental refs → ElementType', () => {
    enemies.forEach((enemy) => {
      if (enemy.weakness) {
        it(`enemy "${enemy.id}" weakness "${enemy.weakness}" is a valid element`, () => {
          expect(validElements.has(enemy.weakness!)).toBe(true);
        });
      }
      if (enemy.resist) {
        it(`enemy "${enemy.id}" resist "${enemy.resist}" is a valid element`, () => {
          expect(validElements.has(enemy.resist!)).toBe(true);
        });
      }
    });
  });

  // (f-alt) Spell status effects → valid StatusEffect values
  // Spells encode status effects in the `effect` field as "status_<name>"
  describe('Spell status effects → StatusEffect', () => {
    const statusSpells = spells.filter((s) => s.effect.startsWith('status_'));
    statusSpells.forEach((spell) => {
      const statusName = spell.effect.replace('status_', '');
      it(`spell "${spell.id}" effect "${spell.effect}" maps to valid status "${statusName}"`, () => {
        expect(validStatusEffects.has(statusName)).toBe(true);
      });
    });
  });
});
