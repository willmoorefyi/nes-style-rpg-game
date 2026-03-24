import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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
const classes: Array<{ id: string; upgradeFrom?: string }> = parse(
  readFileSync(join(dataDir, 'classes.yaml'), 'utf-8')
);
const shops: Array<{ id: string; type: string; inventory: string[] }> = parse(
  readFileSync(join(dataDir, 'shops.yaml'), 'utf-8')
);

// Load all map files
interface MapFile {
  id: string;
  encounters?: Array<{ enemies: string[] }>;
  transitions?: Array<{ targetMap: string }>;
  npcs?: Array<{ id: string; dialog: string[] | Array<{ condition?: string; text: string[] }>; shopId?: string }>;
  scriptedEncounters?: Array<{ enemyIds: string[]; flag: string }>;
  keyItemGates?: Array<{ requiredItem: string; x: number; y: number }>;
}
const mapFileNames = readdirSync(mapsDir)
  .filter((f) => f.endsWith('.yaml'));
const maps: MapFile[] = mapFileNames.map((f) =>
  parse(readFileSync(join(mapsDir, f), 'utf-8'))
);
const mapIds = new Set(maps.map((m) => m.id));

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
  'poison', 'stun', 'sleep', 'blind', 'silence', 'death', 'stone',
]);

// Base classes are those without upgradeFrom
const baseClassIds = new Set(
  classes.filter((c) => !c.upgradeFrom).map((c) => c.id)
);

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

  // (c) Map encounter tables → enemies.yaml (all maps)
  describe('Encounter → Enemies', () => {
    maps.forEach((map) => {
      (map.encounters ?? []).forEach((enc, i) => {
        enc.enemies.forEach((enemyId) => {
          it(`map "${map.id}" encounter[${i}] references enemy "${enemyId}" that exists in enemies.yaml`, () => {
            expect(enemyIds.has(enemyId)).toBe(true);
          });
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

  // ═══ Phase 17a additions ═══

  // (g) No duplicate IDs within any data file
  describe('Duplicate ID detection', () => {
    function findDuplicates(arr: Array<{ id: string }>): string[] {
      const seen = new Set<string>();
      const dupes: string[] = [];
      for (const entry of arr) {
        if (seen.has(entry.id)) dupes.push(entry.id);
        seen.add(entry.id);
      }
      return dupes;
    }

    it('items.yaml has no duplicate IDs', () => {
      expect(findDuplicates(items)).toEqual([]);
    });

    it('spells.yaml has no duplicate IDs', () => {
      expect(findDuplicates(spells)).toEqual([]);
    });

    it('enemies.yaml has no duplicate IDs', () => {
      expect(findDuplicates(enemies)).toEqual([]);
    });

    it('classes.yaml has no duplicate IDs', () => {
      expect(findDuplicates(classes)).toEqual([]);
    });

    it('shops.yaml has no duplicate IDs', () => {
      expect(findDuplicates(shops)).toEqual([]);
    });

    it('map files have no duplicate IDs', () => {
      expect(findDuplicates(maps)).toEqual([]);
    });
  });

  // (h) upgradeFrom references valid base classes
  describe('Class upgradeFrom → base classes', () => {
    const upgradedClasses = classes.filter((c) => c.upgradeFrom);
    upgradedClasses.forEach((cls) => {
      it(`upgraded class "${cls.id}" upgradeFrom "${cls.upgradeFrom}" exists in classes.yaml`, () => {
        expect(classIds.has(cls.upgradeFrom!)).toBe(true);
      });

      it(`upgraded class "${cls.id}" upgradeFrom "${cls.upgradeFrom}" references a base class (not another upgraded class)`, () => {
        expect(baseClassIds.has(cls.upgradeFrom!)).toBe(true);
      });
    });
  });

  // (i) Map transition targets exist as map files
  describe('Map transitions → map files', () => {
    const allTransitions = maps.flatMap((map) =>
      (map.transitions ?? []).map((t, i) => ({ mapId: map.id, index: i, target: t.targetMap }))
    );

    if (allTransitions.length === 0) {
      it('no map transitions to validate (placeholder)', () => {
        expect(true).toBe(true);
      });
    } else {
      allTransitions.forEach(({ mapId, index, target }) => {
        it(`map "${mapId}" transition[${index}] target "${target}" exists as a map`, () => {
          expect(mapIds.has(target)).toBe(true);
        });
      });
    }
  });

  // ═══ Phase 17d additions ═══

  // (j) All NPC dialog arrays are non-empty
  describe('NPC dialog validation', () => {
    maps.forEach((map) => {
      (map.npcs ?? []).forEach((npc) => {
        it(`map "${map.id}" NPC "${npc.id}" has non-empty dialog`, () => {
          expect(npc.dialog.length).toBeGreaterThan(0);
        });

        // Validate conditional dialog entries have non-empty text arrays
        if (npc.dialog.length > 0 && typeof npc.dialog[0] !== 'string') {
          const entries = npc.dialog as Array<{ condition?: string; text: string[] }>;
          entries.forEach((entry, i) => {
            it(`map "${map.id}" NPC "${npc.id}" conditional dialog[${i}] has non-empty text`, () => {
              expect(entry.text.length).toBeGreaterThan(0);
            });
          });
        }
      });
    });
  });

  // ═══ Post-Phase 17 additions ═══

  // (k) Scripted encounter enemy IDs → enemies.yaml
  describe('Scripted encounters → Enemies', () => {
    maps.forEach((map) => {
      (map.scriptedEncounters ?? []).forEach((enc, i) => {
        enc.enemyIds.forEach((enemyId) => {
          it(`map "${map.id}" scriptedEncounter[${i}] references enemy "${enemyId}" that exists in enemies.yaml`, () => {
            expect(enemyIds.has(enemyId)).toBe(true);
          });
        });
      });
    });
  });

  // (l) Key item gates → items.yaml
  describe('Key item gates → Items', () => {
    maps.forEach((map) => {
      (map.keyItemGates ?? []).forEach((gate, i) => {
        it(`map "${map.id}" keyItemGate[${i}] requiredItem "${gate.requiredItem}" exists in items.yaml`, () => {
          expect(itemIds.has(gate.requiredItem)).toBe(true);
        });
      });
    });
  });

  // (m) NPC shopId → shops.yaml
  describe('NPC shopId → Shops', () => {
    const shopIds = new Set(shops.map((s) => s.id));
    maps.forEach((map) => {
      (map.npcs ?? []).forEach((npc) => {
        if (npc.shopId) {
          it(`map "${map.id}" NPC "${npc.id}" shopId "${npc.shopId}" exists in shops.yaml`, () => {
            expect(shopIds.has(npc.shopId!)).toBe(true);
          });
        }
      });
    });
  });
});
