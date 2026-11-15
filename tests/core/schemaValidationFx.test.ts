/** F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 8): enemy attack fields and the effect / status-visual tables. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateEnemyAttack, validateSpellEffects, validateStatusVisuals } from '../../src/core/schemaValidationFx.js';
import { ValidationError, validateEnemyData } from '../../src/core/schemaValidation.js';
import { testEnemy } from '../helpers/testUtils.js';

afterEach(() => { vi.restoreAllMocks(); });

const yaml = (file: string): unknown => parse(readFileSync(`assets/data/${file}`, 'utf-8'));

/** Heavy from the start (ROSTER_PLAN 7.2: bosses with attack_raise); the Drowned Sovereign and the Ashen Queen only from phase 2. */
const HEAVY = ['garland', 'lich', 'lich_2', 'hollow_seraph', 'hollow_seraph_2', 'chaos'];

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

  it('pulseTint (final play test, item 7): a "#rrggbb" string, on a heavy attacker only', () => {
    expect(() => validateEnemyAttack({ id: 'a', attackAnim: 'heavy', pulseTint: '#ffdcdc' })).not.toThrow();
    expect(() => validateEnemyAttack({ id: 'a', attackAnim: 'heavy', pulseTint: 'ffdcdc' })).toThrow(/pulseTint/);
    expect(() => validateEnemyAttack({ id: 'a', attackAnim: 'heavy', pulseTint: '#fdc' })).toThrow(/pulseTint/);
    expect(() => validateEnemyAttack({ id: 'a', attackAnim: 'heavy', pulseTint: 0xffdcdc })).toThrow(/pulseTint/);
    expect(() => validateEnemyAttack({ id: 'a', pulseTint: '#ffdcdc' })).toThrow(/heavy attacker/);
    expect(() => validateEnemyData({ ...testEnemy(), pulseTint: '#ffdcdc' })).toThrow(/EnemyData\(goblin\)\.pulseTint/);
  });

  it('validateEnemyData checks them', () => {
    expect(() => validateEnemyData({ ...testEnemy(), attack: 'ranged', attackEffect: 'fire_breath' })).not.toThrow();
    expect(() => validateEnemyData({ ...testEnemy(), attack: 'thrown' })).toThrow(/EnemyData\(goblin\)\.attack/);
  });

  it('enemies.yaml: every enemy is melee except the ranged dragon (fire_breath, in spell-effects attacks); the bosses with a raise are heavy', () => {
    const enemies = yaml('enemies.yaml') as Array<Record<string, unknown>>;
    const fx = validateSpellEffects(yaml('spell-effects.yaml'));
    for (const e of enemies) {
      expect(() => validateEnemyData(e), String(e.id)).not.toThrow();
      expect(e.attack, String(e.id)).toBe(e.id === 'dragon' ? 'ranged' : 'melee');
      if (e.attack === 'ranged') expect(fx.attacks[e.attackEffect as string], String(e.id)).toBeDefined();
      expect(e.attackAnim, String(e.id)).toBe(HEAVY.includes(String(e.id)) ? 'heavy' : undefined);
    }
    // the pale lich pulses lighter than the default red (each channel at least the default's)
    const lich = enemies.find((e) => e.id === 'lich')!;
    expect(lich.pulseTint).toMatch(/^#[0-9a-f]{6}$/i);
    const ch = (hex: number) => [hex >> 16, (hex >> 8) & 255, hex & 255];
    const [r, g, b] = ch(parseInt(String(lich.pulseTint).slice(1), 16));
    const [r0, g0, b0] = ch(0xffb0b0);
    expect(r >= r0 && g > g0 && b > b0).toBe(true);
    expect(enemies.find((e) => e.id === 'garland')!.pulseTint).toBeUndefined();
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
  it('the shipped file validates with nothing dropped (Fe filled it in)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(Object.keys(validateStatusVisuals(yaml('status-visuals.yaml')).statuses)).toContain('sleep');
    expect(error).not.toHaveBeenCalled();
  });

  it('bad entries are logged and dropped', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const v = validateStatusVisuals({ statuses: {
      sleep: { posture: 'daze', overlay: 'zzz', icon: 'z' },
      fear: { posture: 'shiver' },
      poison: { tint: 'green' },
      frozen: { reserved: 'yes' },
      stun: { pulse: [60, 6] },
      blind: { tag: 3 },
      stone: { posture: 'still', pulse: [6, 60], tag: 'STON' },
    } });
    expect(Object.keys(v.statuses)).toEqual(['sleep', 'stone']);
    expect(error).toHaveBeenCalledTimes(5);
  });
});
