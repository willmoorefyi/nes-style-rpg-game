import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { validateEnemyData, validateMapData } from '../../src/core/schemaValidation.js';
import { cutsceneWarp } from '../../src/systems/CutsceneManager.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** R0 shared contract (docs/FIX_PLAN_PENINSULA.md R0-1, -2, -3, -6): the new fields and their validators. */
describe('R0 shared contract: validators', () => {
  const map = {
    id: 'm', width: 4, height: 4, layers: [], tilesets: [], collision: [], transitions: [],
    npcs: [{ id: 'garland', x: 1, y: 1, sprite: 'garland', dialog: ['...'] }],
  };
  const gate = { x: 0, y: 0, requiredFlag: 'BRIDGE_BUILT', message: 'Collapsed.', permanent: false };
  const enc = { x: 2, y: 1, enemyIds: ['garland'], flag: 'GARLAND_DEFEATED', isBoss: true };

  describe('KeyItemGate.message (T1)', () => {
    it('accepts a string or conditional entries', () => {
      expect(() => validateMapData({ ...map, keyItemGates: [gate] })).not.toThrow();
      const conditional = [{ condition: 'INTRO_COMPLETE', text: ['Builders at work.'] }, { text: ['Collapsed.'] }];
      expect(validateMapData({ ...map, keyItemGates: [{ ...gate, message: conditional }] }).keyItemGates![0].message)
        .toEqual(conditional);
    });

    it('rejects other shapes', () => {
      expect(() => validateMapData({ ...map, keyItemGates: [{ ...gate, message: 3 }] }))
        .toThrow('MapData.keyItemGates[0].message: expected string or array, got number');
      expect(() => validateMapData({ ...map, keyItemGates: [{ ...gate, message: [] }] })).toThrow('at least one entry');
      expect(() => validateMapData({ ...map, keyItemGates: [{ ...gate, message: [{ when: 'X', text: ['a'] }] }] }))
        .toThrow('unknown keys when');
      expect(() => validateMapData({ ...map, keyItemGates: [{ ...gate, message: [{ text: 'a' }] }] }))
        .toThrow('MapData.keyItemGates[0].message[0].text: expected array, got string');
    });
  });

  describe('ScriptedEncounter.npc (B1)', () => {
    it('is optional and must name an NPC of the same map', () => {
      expect(() => validateMapData({ ...map, scriptedEncounters: [enc] })).not.toThrow();
      expect(validateMapData({ ...map, scriptedEncounters: [{ ...enc, npc: 'garland' }] }).scriptedEncounters![0].npc)
        .toBe('garland');
      expect(() => validateMapData({ ...map, scriptedEncounters: [{ ...enc, npc: 'nobody' }] }))
        .toThrow("MapData.scriptedEncounters[0].npc: no NPC with id 'nobody' on this map");
      expect(() => validateMapData({ ...map, scriptedEncounters: [{ ...enc, npc: 5 }] }))
        .toThrow('MapData.scriptedEncounters[0].npc: expected string, got number');
    });

    it('checks the encounter fields', () => {
      expect(() => validateMapData({ ...map, scriptedEncounters: [{ ...enc, flag: undefined }] }))
        .toThrow('MapData.scriptedEncounters[0].flag: expected string');
      expect(() => validateMapData({ ...map, scriptedEncounters: [{ ...enc, enemyIds: [1] }] }))
        .toThrow('MapData.scriptedEncounters[0].enemyIds[0]');
    });
  });

  describe('BossPhase.hits / attack (B1)', () => {
    const enemy = {
      id: 'garland', name: 'Garland', xpReward: 130, goldReward: 250, sprite: 'garland',
      stats: { hp: 240, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1, attack: 12, defense: 10, magicDefense: 0 },
    };
    const phase = { hpThreshold: 0.25, patternId: 'aggressive' };

    it('accepts phases with optional message, hits and attack', () => {
      const data = { ...enemy, bossPhases: [{ ...phase, message: 'Fiercer!', hits: 3, attack: 14 }] };
      expect(validateEnemyData(data).bossPhases![0]).toEqual({ ...phase, message: 'Fiercer!', hits: 3, attack: 14 });
    });

    it('rejects a threshold outside (0, 1] and wrongly typed fields', () => {
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, hpThreshold: 0 }] })).toThrow('(0, 1]');
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, hpThreshold: 1.5 }] })).toThrow('(0, 1]');
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ hpThreshold: 0.5 }] })).toThrow('bossPhases[0].patternId');
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, hits: '3' }] }))
        .toThrow('EnemyData.bossPhases[0].hits: expected number, got string');
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, attack: null }] })).toThrow('bossPhases[0].attack');
    });

    // CHAOS_FORMS_PLAN 2.2 item 1: a form phase names the next form's enemy id and its interlude
    it('accepts form and interlude; refuses them with the wrong type or empty', () => {
      const data = { ...enemy, bossPhases: [{ ...phase, form: 'chaos_orrery', interlude: 'chaos_i1' }] };
      expect(validateEnemyData(data).bossPhases![0]).toEqual({ ...phase, form: 'chaos_orrery', interlude: 'chaos_i1' });
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, form: 3 }] })).toThrow('bossPhases[0].form');
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, form: '' }] })).toThrow('bossPhases[0].form');
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, form: 'x', interlude: ['i1'] }] })).toThrow('bossPhases[0].interlude');
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, interlude: '' }] })).toThrow('bossPhases[0].interlude');
    });

    // 18.8 row 2c (B5): a non-form phase may name an interlude too (F3's 0.25 phase plays chaos_crack)
    it('accepts an interlude on a non-form phase', () => {
      const data = { ...enemy, bossPhases: [{ ...phase, interlude: 'chaos_crack' }] };
      expect(validateEnemyData(data).bossPhases![0]).toEqual({ ...phase, interlude: 'chaos_crack' });
    });

    // CHAOS_FIX_PLAN 2.4 M6: `arrivalTurn: true`, only together with `form`
    it('accepts arrivalTurn: true on a form phase; refuses it without form or with another value', () => {
      const data = { ...enemy, bossPhases: [{ ...phase, form: 'chaos_orrery', arrivalTurn: true }] };
      expect(validateEnemyData(data).bossPhases![0]).toEqual({ ...phase, form: 'chaos_orrery', arrivalTurn: true });
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, interlude: 'chaos_crack', arrivalTurn: true }] }))
        .toThrow('bossPhases[0].arrivalTurn');
      expect(() => validateEnemyData({ ...enemy, bossPhases: [{ ...phase, form: 'x', arrivalTurn: 'yes' }] })).toThrow('bossPhases[0].arrivalTurn');
    });
  });

  it('every shipped map and enemy passes the new checks', () => {
    for (const dir of ['assets/maps', 'assets/maps/ai']) {
      for (const f of readdirSync(join(root, dir)).filter((n) => n.endsWith('.yaml') && n !== 'index.yaml')) {
        expect(() => validateMapData(parse(readFileSync(join(root, dir, f), 'utf-8'))), `${dir}/${f}`).not.toThrow();
      }
    }
    const enemies = parse(readFileSync(join(root, 'assets/data/enemies.yaml'), 'utf-8')) as unknown[];
    for (const e of enemies) expect(() => validateEnemyData(e)).not.toThrow();
  });
});

describe('R0 shared contract: the warp step shape (T2)', () => {
  it('needs a map and an entrance or both x and y', () => {
    expect(cutsceneWarp({ type: 'warp', map: 'cornelia-castle-2f', entrance: 'throne_return', facing: 'up' }))
      .toEqual({ map: 'cornelia-castle-2f', entrance: 'throne_return', facing: 'up' });
    expect(cutsceneWarp({ type: 'warp', map: 'cornelia', x: 3, y: 4 })).toEqual({ map: 'cornelia', x: 3, y: 4 });
    expect(cutsceneWarp({ type: 'warp', map: 'cornelia', x: 3 })).toBeNull();
    expect(cutsceneWarp({ type: 'warp', entrance: 'gate' })).toBeNull();
    expect(cutsceneWarp({ type: 'backdrop', image: 'grassland' })).toBeNull();
  });
});
