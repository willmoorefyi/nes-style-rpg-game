/** F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 8): enemy attack fields and the effect / status-visual tables. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateEnemyAttack, validateSpellEffects, validateStatusVisuals } from '../../src/core/schemaValidationFx.js';
import { ValidationError, validateEnemyData } from '../../src/core/schemaValidation.js';
import { testEnemy } from '../helpers/testUtils.js';

afterEach(() => { vi.restoreAllMocks(); });

const yaml = (file: string): unknown => parse(readFileSync(`assets/data/${file}`, 'utf-8'));

describe('enemy attack fields', () => {
  it('attack must be melee or ranged; attackEffect a string; attackAnim heavy; all optional', () => {
    expect(() => validateEnemyAttack({ id: 'a' })).not.toThrow();
    expect(() => validateEnemyAttack({ id: 'a', attack: 'melee', attackAnim: 'heavy' })).not.toThrow();
    expect(() => validateEnemyAttack({ id: 'a', attack: 'ranged', attackEffect: 'fire_breath' })).not.toThrow();
    expect(() => validateEnemyAttack({ id: 'a', attack: 'magic' })).toThrow(ValidationError);
    expect(() => validateEnemyAttack({ id: 'a', attack: 'Melee' })).toThrow(/melee or ranged/);
    expect(() => validateEnemyAttack({ id: 'a', attackEffect: 3 })).toThrow(ValidationError);
    expect(() => validateEnemyAttack({ id: 'a', attackAnim: 'light' })).toThrow(ValidationError);
  });

  it('validateEnemyData checks them', () => {
    expect(() => validateEnemyData({ ...testEnemy(), attack: 'ranged', attackEffect: 'fire_breath' })).not.toThrow();
    expect(() => validateEnemyData({ ...testEnemy(), attack: 'thrown' })).toThrow(/EnemyData\(goblin\)\.attack/);
  });

  it('enemies.yaml: every enemy is melee except the ranged dragon (fire_breath, in spell-effects attacks); Garland and the lich are heavy', () => {
    const enemies = yaml('enemies.yaml') as Array<Record<string, unknown>>;
    const fx = validateSpellEffects(yaml('spell-effects.yaml'));
    for (const e of enemies) {
      expect(() => validateEnemyData(e), String(e.id)).not.toThrow();
      expect(e.attack, String(e.id)).toBe(e.id === 'dragon' ? 'ranged' : 'melee');
      if (e.attack === 'ranged') expect(fx.attacks[e.attackEffect as string], String(e.id)).toBeDefined();
      expect(e.attackAnim, String(e.id)).toBe(e.id === 'garland' || e.id === 'lich' ? 'heavy' : undefined);
    }
  });
});

describe('spell-effects.yaml', () => {
  it('the file: fire_breath (cone, 28 frames, impact 16) and attacks.fire_breath; Fd filled spells and items', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fx = validateSpellEffects(yaml('spell-effects.yaml'));
    expect(fx.effects.fire_breath).toMatchObject({ kind: 'cone', frames: 28, impact: 16 });
    expect(fx.attacks).toEqual({ fire_breath: 'fire_breath' });
    expect(fx.spells.fire).toBe('fire');
    expect(fx.items.potion).toBe('heal');
    expect(error).not.toHaveBeenCalled();
  });

  it('bad entries are logged and dropped; the good ones stay', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fx = validateSpellEffects({
      effects: {
        ok: { kind: 'rise', frames: 30, impact: 18 },
        badKind: { kind: 'swirl', frames: 30, impact: 18 },
        late: { kind: 'ring', frames: 20, impact: 20 },
        notInt: { kind: 'ring', frames: 20.5, impact: 2 },
      },
      spells: { fire: 'ok', ice: 'missing' },
      items: { potion: 'ok' },
      attacks: { breath: 'badKind' },
    });
    expect(Object.keys(fx.effects)).toEqual(['ok']);
    expect(fx.spells).toEqual({ fire: 'ok' });
    expect(fx.items).toEqual({ potion: 'ok' });
    expect(fx.attacks).toEqual({});
    expect(error).toHaveBeenCalledTimes(5);
  });

  it('a file that is not a mapping loads as empty, with an error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(validateSpellEffects([1, 2])).toEqual({ effects: {}, spells: {}, items: {}, attacks: {} });
    expect(error).toHaveBeenCalled();
  });
});

describe('status-visuals.yaml', () => {
  it('the seeded file is an empty table', () => {
    expect(validateStatusVisuals(yaml('status-visuals.yaml'))).toEqual({ statuses: {} });
  });

  it('bad entries are logged and dropped', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const v = validateStatusVisuals({ statuses: {
      sleep: { posture: 'daze', overlay: 'zzz', icon: 'z' },
      fear: { posture: 'shiver' },
      poison: { tint: 'green' },
      frozen: { reserved: 'yes' },
    } });
    expect(Object.keys(v.statuses)).toEqual(['sleep']);
    expect(error).toHaveBeenCalledTimes(3);
  });
});
