import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { isKnownFlag } from '../../src/core/GameFlags.js';
import { formationFits, type EnemyBoxInput, type EnemySizeClass } from '../../src/scenes/battle/EnemyLayoutAi.js';
import { MAX_FORMATION } from '../../src/systems/EncounterTable.js';
import { validateEnemyData } from '../../src/core/schemaValidation.js';
import { validateBestiary } from '../../src/core/bestiaryValidation.js';
import type { EnemyData } from '../../src/types/index.js';
import { monsterSpriteKey } from '../../src/rendering/BattleArt.js';
import { layoutInput } from '../helpers/atlasFrames.js';

// Load all YAML data files using readFileSync (asset files, not modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = resolve(__dirname, '../../assets/data');
const mapsDir = resolve(__dirname, '../../assets/maps');

const items: Array<{ id: string; usableBy: string[] }> = parse(
  readFileSync(join(dataDir, 'items.yaml'), 'utf-8')
);
const spells: Array<{ id: string; name: string; element: string; effect: string }> = parse(
  readFileSync(join(dataDir, 'spells.yaml'), 'utf-8')
);
const enemies: Array<{ id: string; weakness?: string; resist?: string; sprite?: string; size?: EnemySizeClass }> = parse(
  readFileSync(join(dataDir, 'enemies.yaml'), 'utf-8')
);
const classes: Array<{ id: string; upgradeFrom?: string }> = parse(
  readFileSync(join(dataDir, 'classes.yaml'), 'utf-8')
);
const shops: Array<{ id: string; type: string; inventory: string[] }> = parse(
  readFileSync(join(dataDir, 'shops.yaml'), 'utf-8')
);

// Load all map files
/** A formation: a fixed `enemies` list (legacy) or rolled `groups` (T4c). */
interface EncounterFile { weight: number; enemies?: string[]; groups?: Array<{ id: string; min: number; max?: number }> }
interface MapFile {
  id: string;
  encounters?: EncounterFile[];
  encounterZones?: Array<{ id: string; encounters: EncounterFile[] }>;
  transitions?: Array<{ targetMap: string }>;
  npcs?: Array<{ id: string; dialog: string[] | Array<{ condition?: string; text: string[] }>; shopId?: string; chestItem?: string;
    chestFlag?: string; cutscene?: { id: string } }>;
  scriptedEncounters?: Array<{ enemyIds: string[]; flag: string; postVictoryCutscene?: string }>;
  keyItemGates?: Array<{ requiredItem?: string; requiredFlag?: string; requiredFlags?: string[]; x: number; y: number }>;
  battleBackgrounds?: { default?: string; terrain?: Record<string, string> };
}
const mapFileNames = readdirSync(mapsDir)
  .filter((f) => f.endsWith('.yaml'));
const maps: MapFile[] = mapFileNames.map((f) =>
  parse(readFileSync(join(mapsDir, f), 'utf-8'))
);
// the compiled 2x maps (assets/maps/ai/) the game plays by default; some (the house interiors) have no legacy file
const aiDir = join(mapsDir, 'ai');
const aiMaps: MapFile[] = readdirSync(aiDir).filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
  .map((f) => parse(readFileSync(join(aiDir, f), 'utf-8')) as MapFile);
/** Every map variant whose references must resolve: legacy and compiled. */
const refMaps: Array<MapFile & { variant: string }> = [
  ...maps.map((m) => ({ ...m, variant: 'legacy' })), ...aiMaps.map((m) => ({ ...m, variant: 'ai' })),
];
const mapIds = new Set([...maps, ...aiMaps].map((m) => m.id));

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

/** Every enemy id a formation can roll. */
function formationIds(enc: EncounterFile): string[] {
  return enc.groups ? enc.groups.map((g) => g.id) : enc.enemies ?? [];
}

/** The biggest formation an entry can roll (each group at its max), before the runtime cap. */
function maxRoll(enc: EncounterFile): string[] {
  if (!enc.groups) return enc.enemies ?? [];
  return enc.groups.flatMap((g) => Array<string>(g.max ?? g.min).fill(g.id));
}

// battle boxes as AiEnemyView sizes them (V8 F8: scale-aware): the monster atlas cell at the sheet's own scale with its
// home extent and the titan class for a scale-3 boss (layoutInput), else the placeholder box
const monsterAtlas = JSON.parse(readFileSync(resolve(__dirname, '../../assets/sprites/monsters-ai.json'), 'utf-8')) as {
  scale: number; sheets: Record<string, { cell: [number, number] }>;
};
const PLACEHOLDER_BOX: Record<EnemySizeClass, number> = { small: 160, large: 256, huge: 384, boss: 400, titan: 600 };
function enemyBox(id: string): EnemyBoxInput {
  const e = enemies.find((x) => x.id === id);
  const size = e?.size ?? 'small';
  const sheet = e ? monsterAtlas.sheets[monsterSpriteKey(e)] : undefined;
  return sheet ? layoutInput(id) : { size, w: PLACEHOLDER_BOX[size], h: PLACEHOLDER_BOX[size] };
}

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

  // (c) Map encounter tables (the map's own and every zone's) → enemies.yaml; group formations fit the battle screen
  describe('Encounter → Enemies', () => {
    const tables = refMaps.flatMap((map) => [
      ...(map.encounters ?? []).map((enc, i) => ({ where: `map "${map.id}" (${map.variant}) encounter[${i}]`, enc })),
      ...(map.encounterZones ?? []).flatMap((z) => z.encounters.map((enc, i) => ({
        where: `map "${map.id}" (${map.variant}) zone "${z.id}" encounter[${i}]`, enc }))),
    ]);
    tables.forEach(({ where, enc }) => {
      formationIds(enc).forEach((enemyId) => {
        it(`${where} references enemy "${enemyId}" that exists in enemies.yaml`, () => {
          expect(enemyIds.has(enemyId)).toBe(true);
        });
      });
      it(`${where} has its maximum roll within ${MAX_FORMATION} enemies, laid out without overlap`, () => {
        const ids = maxRoll(enc);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.length).toBeLessThanOrEqual(MAX_FORMATION);
        expect(formationFits(ids.map(enemyBox)), ids.join(',')).toBe(true);
      });
    });
  });

  // (c2) the helpers above, on synthetic formations
  describe('Encounter formation helpers', () => {
    it('read a group entry\'s ids and maximum roll, and a legacy list as it is', () => {
      expect(formationIds({ weight: 1, groups: [{ id: 'goblin', min: 3, max: 5 }, { id: 'wolf', min: 1 }] })).toEqual(['goblin', 'wolf']);
      expect(maxRoll({ weight: 1, groups: [{ id: 'goblin', min: 3, max: 5 }, { id: 'wolf', min: 1 }] }))
        .toEqual(['goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'wolf']);
      expect(maxRoll({ weight: 1, enemies: ['goblin', 'wolf'] })).toEqual(['goblin', 'wolf']);
    });

    it('reject a formation over the cap or too big for the screen', () => {
      expect(maxRoll({ weight: 1, groups: [{ id: 'goblin', min: 6, max: 10 }] }).length).toBeGreaterThan(MAX_FORMATION);
      expect(formationFits(maxRoll({ weight: 1, groups: [{ id: 'garland', min: 5 }, { id: 'goblin', min: 6 }] })
        .map(enemyBox))).toBe(false);
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
    const allTransitions = refMaps.flatMap((map) =>
      (map.transitions ?? []).map((t, i) => ({ mapId: `${map.id} (${map.variant})`, index: i, target: t.targetMap }))
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
    refMaps.forEach((map) => {
      (map.npcs ?? []).forEach((npc) => {
        it(`map "${map.id}" (${map.variant}) NPC "${npc.id}" has non-empty dialog`, () => {
          expect(npc.dialog.length).toBeGreaterThan(0);
        });

        // Validate conditional dialog entries have non-empty text arrays
        if (npc.dialog.length > 0 && typeof npc.dialog[0] !== 'string') {
          const entries = npc.dialog as Array<{ condition?: string; text: string[] }>;
          entries.forEach((entry, i) => {
            it(`map "${map.id}" (${map.variant}) NPC "${npc.id}" conditional dialog[${i}] has non-empty text`, () => {
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
    refMaps.forEach((map) => {
      (map.scriptedEncounters ?? []).forEach((enc, i) => {
        enc.enemyIds.forEach((enemyId) => {
          it(`map "${map.id}" (${map.variant}) scriptedEncounter[${i}] references enemy "${enemyId}" that exists in enemies.yaml`, () => {
            expect(enemyIds.has(enemyId)).toBe(true);
          });
        });
      });
    });
  });

  // (l) Key item gates → items.yaml
  describe('Key item gates → Items', () => {
    refMaps.forEach((map) => {
      (map.keyItemGates ?? []).forEach((gate, i) => {
        // a gate opens on an item, or on story flags (requiredFlag / requiredFlags, e.g. the north bridge) that
        // GameFlags names or that carry a region prefix (WORLD_PLAN 3.1)
        it(`map "${map.id}" (${map.variant}) keyItemGate[${i}] needs an existing item or known flags`, () => {
          if (gate.requiredItem !== undefined) expect(itemIds.has(gate.requiredItem)).toBe(true);
          const flags = [...(gate.requiredFlag !== undefined ? [gate.requiredFlag] : []), ...(gate.requiredFlags ?? [])];
          if (gate.requiredItem === undefined) expect(flags.length, 'a gate needs an item or a flag').toBeGreaterThan(0);
          for (const f of flags) expect(isKnownFlag(f), `required flag ${f}`).toBe(true);
        });
      });
    });
  });

  // (m) NPC shopId → shops.yaml
  describe('NPC shopId → Shops', () => {
    const shopIds = new Set(shops.map((s) => s.id));
    refMaps.forEach((map) => {
      (map.npcs ?? []).forEach((npc) => {
        if (npc.shopId) {
          it(`map "${map.id}" (${map.variant}) NPC "${npc.id}" shopId "${npc.shopId}" exists in shops.yaml`, () => {
            expect(shopIds.has(npc.shopId!)).toBe(true);
          });
        }
      });
    });
  });

  // (n) NPC chestItem → items.yaml
  describe('NPC chestItem → Items', () => {
    refMaps.forEach((map) => {
      (map.npcs ?? []).forEach((npc) => {
        if (npc.chestItem) {
          it(`map "${map.id}" (${map.variant}) NPC "${npc.id}" chestItem "${npc.chestItem}" exists in items.yaml`, () => {
            expect(itemIds.has(npc.chestItem!)).toBe(true);
          });
        }
      });
    });
  });

  // (n2) chest flags: every chest has one, it reads as a flag, and no two chests (in different maps or the same map)
  // share it; a map's legacy and compiled variants may repeat their own chests
  describe('NPC chestFlag', () => {
    const chests = refMaps.flatMap((map) => (map.npcs ?? []).filter((n) => n.chestItem)
      .map((n) => ({ map: map.id, variant: map.variant, npc: n.id, flag: n.chestFlag })));

    it('every chest has a CHEST_* flag', () => {
      for (const c of chests) expect(c.flag ?? '', `${c.map} (${c.variant}) ${c.npc}`).toMatch(/^CHEST_[A-Z0-9_]+$/);
    });

    it('chest flags are unique across maps and within each map variant', () => {
      const owner = new Map<string, string>();
      const perVariant = new Set<string>();
      for (const c of chests) {
        const key = `${c.variant}:${c.map}:${c.flag}`;
        expect(perVariant.has(key), `${c.flag} twice in ${c.map} (${c.variant})`).toBe(false);
        perVariant.add(key);
        expect(owner.get(c.flag!) ?? c.map, `${c.flag} in ${c.map} and ${owner.get(c.flag!)}`).toBe(c.map);
        owner.set(c.flag!, c.map);
      }
    });

    it('the ten Cornelia houses hold their CHEST_HOUSE_* chests, each of an existing item', () => {
      const house = chests.filter((c) => c.flag?.startsWith('CHEST_HOUSE_'));
      expect(house.length).toBeGreaterThanOrEqual(5);
      for (const c of house) expect(c.map, c.flag).toMatch(/^cornelia-house-/);
    });
  });

  // (o) battleBackgrounds → assets/backgrounds/<id>.png (run `npm run assets` if missing)
  describe('battleBackgrounds → background art', () => {
    const bgDir = resolve(__dirname, '../../assets/backgrounds');
    refMaps.forEach((map) => {
      const cfg = map.battleBackgrounds;
      if (!cfg) return;
      const ids = [cfg.default, ...Object.values(cfg.terrain ?? {})].filter((v): v is string => !!v);
      new Set(ids).forEach((bg) => {
        it(`map "${map.id}" (${map.variant}) battle background "${bg}" has art`, () => {
          expect(existsSync(join(bgDir, `${bg}.webp`))).toBe(true);
        });
      });
    });
  });
});

// Cutscene ids used by maps (legacy and the compiled 2x maps the game plays) → assets/data/cutscenes.yaml
describe('Cutscene references → cutscenes.yaml', () => {
  const cutsceneIds = new Set(
    (parse(readFileSync(join(dataDir, 'cutscenes.yaml'), 'utf-8')) as Array<{ id: string }>).map((c) => c.id),
  );
  const refs = refMaps.flatMap((m) => [
    ...(m.npcs ?? []).filter((n) => n.cutscene).map((n) => [`${m.id} NPC ${n.id}`, n.cutscene!.id] as const),
    ...(m.scriptedEncounters ?? []).filter((e) => e.postVictoryCutscene)
      .map((e) => [`${m.id} scripted encounter`, e.postVictoryCutscene!] as const),
  ]);

  it('the King starts the act-1 ending cutscene', () => {
    expect(refs.some(([, id]) => id === 'act1_complete')).toBe(true);
  });

  it.each(refs)('%s uses cutscene "%s", which exists', (_where, id) => {
    expect(cutsceneIds.has(id)).toBe(true);
  });
});

describe('debug scenarios', () => {
  const scenarios: Array<{ id: string; enemies?: string[]; party: Array<{ class: string }>;
    enemyAi?: Record<string, Array<{ type: string; spellId?: string }>> }> = parse(
    readFileSync(join(dataDir, 'debug-scenarios.yaml'), 'utf-8'),
  );
  const enemyIds = new Set(enemies.map((e) => e.id));
  const spellIds = new Set(spells.map((s) => s.id));
  const classIds = new Set(classes.map((c) => c.id));

  it.each(scenarios.map((s) => [s.id, s] as const))('%s references existing enemies, classes and spells', (_id, s) => {
    for (const e of s.enemies ?? []) expect(enemyIds.has(e), `enemy ${e}`).toBe(true);
    for (const m of s.party) expect(classIds.has(m.class), `class ${m.class}`).toBe(true);
    for (const [enemy, actions] of Object.entries(s.enemyAi ?? {})) {
      expect((s.enemies ?? []).includes(enemy), `enemyAi for ${enemy} not in the battle`).toBe(true);
      for (const a of actions) {
        // A4: `slam` (an enemy-only multi-target Fight, CHAOS_FORMS_PLAN 2.2 item 9) is allowed alongside fight and magic
        expect(['fight', 'magic', 'slam']).toContain(a.type);
        if (a.type === 'magic') expect(spellIds.has(a.spellId ?? ''), `spell ${a.spellId}`).toBe(true);
      }
    }
  });

  // T4: up to 9 enemies (t4_nine), laid out on the battle screen without overlap
  it.each(scenarios.filter((s) => (s.enemies ?? []).length > 0).map((s) => [s.id, s] as const))(
    '%s enemies fit the battle screen', (_id, s) => {
      expect((s.enemies ?? []).length).toBeLessThanOrEqual(MAX_FORMATION);
      expect(formationFits((s.enemies ?? []).map(enemyBox))).toBe(true);
    });

  // MS-1: the loader now equips weapons and body armour too, so every listed item must fit its member
  it.each(scenarios.map((s) => [s.id, s] as const))('%s equipment is usable by its member, one item per slot', (_id, s) => {
    const byId = new Map(items.map((i) => [i.id, i as { id: string; type: string; slot?: string; usableBy: string[] }]));
    for (const m of s.party as Array<{ class: string; name: string; equipment?: string[] }>) {
      const slots = new Set<string>();
      for (const id of m.equipment ?? []) {
        const item = byId.get(id);
        expect(item, `item ${id}`).toBeDefined();
        if (!item) continue;
        // an upgraded class keeps its base class's gear (Character.canEquip)
        const base = classes.find((c) => c.id === m.class)?.upgradeFrom;
        const usable = item.usableBy.includes(m.class) || (!!base && item.usableBy.includes(base));
        expect(usable, `${m.name} (${m.class}) can't use ${id}`).toBe(true);
        const slot = item.slot ?? (item.type === 'weapon' ? 'weapon' : 'armor');
        expect(slots.has(slot), `${m.name} has two items for ${slot}`).toBe(false);
        slots.add(slot);
      }
    }
  });
});

// ROSTER_PLAN 7.2 (FW-D): the roster fields' cross-file references
describe('Cross-file validation: roster fields (num, protect, spells, ai, rematches)', () => {
  const roster: EnemyData[] = parse(readFileSync(join(dataDir, 'enemies.yaml'), 'utf-8'));
  const bestiary = validateBestiary(parse(readFileSync(join(dataDir, 'bestiary.yaml'), 'utf-8')));
  const spellIds = new Set(spells.map((s) => s.id));

  it('every enemy validates against the schema (roster fields included)', () => {
    for (const e of roster) expect(() => validateEnemyData(e), e.id).not.toThrow();
  });

  it('num is unique and from 1 to 128', () => {
    const nums = roster.filter((e) => e.num !== undefined).map((e) => e.num!);
    expect(new Set(nums).size).toBe(nums.length);
    for (const n of nums) expect(n >= 1 && n <= 128, String(n)).toBe(true);
  });

  // CHAOS_FORMS_PLAN 2.2 item 9: a `slam` action (F3 / F4) has no spell; every magic action names one
  const magicActions = (e: EnemyData) => (e.ai?.actions ?? []).flatMap((a) => (a.type === 'magic' ? [a] : []));

  it('every ai spellId is in spells.yaml', () => {
    for (const e of roster) for (const a of magicActions(e)) expect(spellIds.has(a.spellId), `${e.id}: ${a.spellId}`).toBe(true);
  });

  it('every ai spell is one of the enemy\'s own spells', () => {
    for (const e of roster) for (const a of magicActions(e)) expect(e.spells ?? [], e.id).toContain(a.spellId);
  });

  it('a slam ai action only on a record with slam: {targets: 2} and colossus: (R9)', () => {
    for (const e of roster) {
      if (!(e.ai?.actions ?? []).some((a) => a.type === 'slam')) continue;
      expect([e.slam, typeof e.colossus], e.id).toEqual([{ targets: 2 }, 'string']);
    }
    expect(roster.filter((e) => e.slam).map((e) => e.id)).toEqual(['chaos_horizon', 'chaos_horizon_core']);
  });

  it('every spell code is in spells.yaml or named by bestiary.yaml spellNames', () => {
    for (const e of roster) {
      for (const s of e.spells ?? []) expect(spellIds.has(s) || s in bestiary.spellNames, `${e.id}: ${s}`).toBe(true);
    }
  });

  it('no spellNames display name is the name of a spells.yaml spell (use the spell id instead)', () => {
    const names = new Map(spells.map((s) => [s.name, s.id]));
    for (const [code, name] of Object.entries(bestiary.spellNames)) {
      expect(names.get(name), `spellNames ${code}: ${name} is spells.yaml ${names.get(name)}`).toBeUndefined();
    }
  });

  it('protect and statusWeak categories have bestiary labels; attackStatus ids have status labels', () => {
    for (const e of roster) {
      for (const c of [...(e.protect ?? []), ...(e.statusWeak ?? [])]) expect(bestiary.protections[c], `${e.id}: ${c}`).toBeDefined();
      for (const s of e.attackStatus ?? []) expect(bestiary.statuses[s], `${e.id}: ${s}`).toBeDefined();
    }
  });

  it('a rematch names an existing first battle and uses its sprite; lore keys are enemies', () => {
    const byId = new Map(roster.map((e) => [e.id, e]));
    for (const e of roster.filter((x) => x.rematchOf)) {
      const first = byId.get(e.rematchOf!);
      expect(first, `${e.id}: ${e.rematchOf}`).toBeDefined();
      expect(e.sprite).toBe(first?.sprite);
    }
    for (const id of Object.keys(bestiary.lore)) expect(byId.has(id), id).toBe(true);
  });
});
