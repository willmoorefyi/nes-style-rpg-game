import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import type { SandboxData } from '../../src/scenes/debugSandbox/sandboxModel.js';

const read = <T>(file: string): T => parse(readFileSync(`assets/data/${file}`, 'utf-8')) as T;
const DATA = read<SandboxData>('debug-sandbox.yaml');
const ids = (file: string): Set<string> => new Set(read<{ id: string }[]>(file).map((x) => x.id));
const ENEMIES = ids('enemies.yaml');
const ITEMS = ids('items.yaml');
const SPELLS = ids('spells.yaml');
const CLASSES = read<{ id: string; upgradeFrom?: string }[]>('classes.yaml');
const KITS = read<Record<string, unknown>>('kits.yaml');
const TRACKED = new Set(execFileSync('git', ['ls-files', 'assets/backgrounds'], { encoding: 'utf-8' }).split('\n'));

describe('debug-sandbox.yaml (docs/FEEDBACK_PLAN_2026-11-14.md §3.8)', () => {
  it('has the planned levels with unique ids', () => {
    const levelIds = DATA.levels.map((l) => l.id);
    expect(new Set(levelIds).size).toBe(levelIds.length);
    expect(levelIds).toEqual(['l1_fields', 'l2_approach', 'l2_temple', 'l2_garland', 'l3_garland', 'l5_east', 'l10_mid',
      'l20_late', 'l30_lich']);
  });

  it("every level's enemy, item, kit and background id exists", () => {
    for (const level of DATA.levels) {
      expect(KITS[level.kit], `${level.id} kit ${level.kit}`).toBeDefined();
      expect(level.formations.length, level.id).toBeGreaterThan(0);
      for (const f of level.formations) {
        expect(f.length, level.id).toBeGreaterThan(0);
        for (const e of f) expect(ENEMIES.has(e), `${level.id} enemy ${e}`).toBe(true);
      }
      for (const item of Object.keys(level.items)) expect(ITEMS.has(item), `${level.id} item ${item}`).toBe(true);
      if (level.background) expect(DATA.backgrounds, `${level.id} background`).toContain(level.background);
      for (const [enemyId, patterns] of Object.entries(level.enemyAi ?? {})) {
        expect(ENEMIES.has(enemyId)).toBe(true);
        for (const p of patterns) if (p.spellId) expect(SPELLS.has(p.spellId)).toBe(true);
      }
      expect(Number.isInteger(level.level) && level.level >= 1 && level.level <= 50, level.id).toBe(true);
    }
  });

  it('every Kit-row kit is in kits.yaml and every background is a committed webp', () => {
    for (const kit of DATA.kits) expect(KITS[kit], kit).toBeDefined();
    for (const bg of DATA.backgrounds) {
      const path = `assets/backgrounds/${bg}.webp`;
      expect(existsSync(path) && TRACKED.has(path), path).toBe(true);
    }
  });

  it('the classes are the 13 base classes and, index for index, their 13 upgrades (the class batch: + barbarian, landsknecht, dark fighter, legionnaire, hunter, cleric, ronin)', () => {
    const byId = new Map(CLASSES.map((c) => [c.id, c]));
    expect(DATA.classes.base).toHaveLength(13);
    expect(DATA.classes.promoted).toHaveLength(13);
    DATA.classes.base.forEach((b, i) => {
      expect(byId.get(b)?.upgradeFrom, b).toBeUndefined();
      expect(byId.get(DATA.classes.promoted[i])?.upgradeFrom, DATA.classes.promoted[i]).toBe(b);
    });
    expect(DATA.party).toHaveLength(4);
    for (const c of DATA.party) expect(DATA.classes.base).toContain(c);
  });
});
