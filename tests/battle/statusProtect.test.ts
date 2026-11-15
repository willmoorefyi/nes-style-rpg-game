/**
 * D5 (docs/ROSTER_PLAN.md 7.2): an enemy's `protect` is enforced by the status roll. `status` blocks sleep, paralysis,
 * blind, silence and fear, plus SLOW and CONF; `poison_stone` blocks poison and stone; `death` blocks death; `earth`
 * and `time` block nothing yet. A protected target misses with the normal "X is unaffected." line, and its roll is
 * still drawn (the RNG stream does not change).
 */
import { describe, it, expect } from 'vitest';
import { applyDebuffSpell, applyMoraleSpell, applyStatusSpell, isProtected, protectCategoryOf } from '../../src/battle/SpellStatus.js';
import type { EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import { StatusTracker } from '../../src/battle/StatusEffects.js';
import type { EnemyData, SpellData } from '../../src/types/index.js';
import type { ProtectCategory } from '../../src/types/enemyRoster.js';
import { SPELLS, spell, enemyCopy } from '../helpers/balanceData.js';

function target(protect?: ProtectCategory[]): EnemyInstance {
  const data: EnemyData = { ...enemyCopy('goblin'), protect, stats: { ...enemyCopy('goblin').stats, magicDefense: 0 } };
  return { id: 'enemy_0', data, currentHp: data.stats.hp, status: new StatusTracker(), buffs: new Map(), displayName: 'Goblin' };
}

/** A sure hit (rng 0), counting the draws and keeping the lines. */
function deps() {
  const lines: string[] = [];
  let draws = 0;
  return { lines, get draws() { return draws; }, rng: () => { draws++; return 0; }, addMessage: (t: string) => { lines.push(t); } };
}

/** Cast `s` at one target with `protect`; the lines, the draws and whether anything landed. */
function cast(s: SpellData, protect?: ProtectCategory[]) {
  const t = target(protect);
  const d = deps();
  if (s.effect === 'debuff_morale') applyMoraleSpell(d, s, [t]);
  else if (s.effect.startsWith('debuff_')) applyDebuffSpell(d, s, [t]);
  else applyStatusSpell(d, s, [t]);
  const landed = t.status.getAll().length > 0 || t.buffs.size > 0;
  return { lines: d.lines, draws: d.draws, landed };
}

const synthetic = (id: string, effect: string): SpellData =>
  ({ id, name: id.toUpperCase(), level: 1, type: 'black', effect, targeting: 'single', description: '' });

describe('protect: the D5 table', () => {
  it('status covers SLEP, SLP2, HOLD, DARK, MUTE, FEAR, SLOW and CONF; LOCK and LOK2 are not statuses', () => {
    for (const id of ['slep', 'slp2', 'hold', 'dark', 'mute', 'fear', 'slow', 'conf']) expect(protectCategoryOf(spell(id)), id).toBe('status');
    for (const id of ['lock', 'lok2', 'fire', 'cure', 'tmpr']) expect(protectCategoryOf(spell(id)), id).toBeNull();
    expect(protectCategoryOf(synthetic('brak', 'status_stone'))).toBe('poison_stone');
    expect(protectCategoryOf(synthetic('bane', 'status_poison'))).toBe('poison_stone');
    expect(protectCategoryOf(synthetic('rub', 'status_death'))).toBe('death');
  });

  it('every status/debuff/morale spell in spells.yaml has a category except the evade debuffs', () => {
    const inflicting = SPELLS.filter((s) => s.effect.startsWith('status_') || s.effect.startsWith('debuff_'));
    expect(inflicting.filter((s) => protectCategoryOf(s) === null).map((s) => s.id).sort()).toEqual(['lock', 'lok2']);
  });
});

describe('protect: enforced in the status roll', () => {
  it.each(['slep', 'hold', 'dark', 'mute', 'conf'])('status blocks %s with the miss line; an unprotected goblin is hit', (id) => {
    const blocked = cast(spell(id), ['status']);
    expect(blocked.landed).toBe(false);
    expect(blocked.lines).toEqual(['Goblin is unaffected.']);
    const hit = cast(spell(id));
    expect(hit.landed).toBe(true);
    expect(blocked.draws).toBe(hit.draws);
  });

  it('status blocks the SLOW debuff and FEAR (morale)', () => {
    for (const id of ['slow', 'fear']) {
      expect(cast(spell(id), ['status'])).toMatchObject({ landed: false, lines: ['Goblin is unaffected.'] });
      expect(cast(spell(id)).landed).toBe(true);
    }
  });

  it('poison_stone blocks poison and stone, death blocks death; each only its own', () => {
    const stone = synthetic('brak', 'status_stone');
    const poison = synthetic('bane', 'status_poison');
    const death = synthetic('rub', 'status_death');
    expect(cast(stone, ['poison_stone']).landed).toBe(false);
    expect(cast(poison, ['poison_stone']).landed).toBe(false);
    expect(cast(death, ['death']).landed).toBe(false);
    expect(cast(death, ['poison_stone', 'status']).landed).toBe(true);
    expect(cast(stone, ['death', 'status']).landed).toBe(true);
    expect(cast(spell('slep'), ['poison_stone', 'death']).landed).toBe(true);
  });

  it('earth and time are shown only: they block nothing yet', () => {
    for (const s of [spell('slep'), spell('slow'), synthetic('brak', 'status_stone'), synthetic('rub', 'status_death')]) {
      expect(cast(s, ['earth', 'time']).landed, s.id).toBe(true);
    }
  });

  it('heroes have no protections; isProtected reads the enemy data', () => {
    expect(isProtected(target(['status']), spell('slep'))).toBe(true);
    expect(isProtected(target([]), spell('slep'))).toBe(false);
    expect(isProtected(target(['status']), spell('lock'))).toBe(false);
  });

  it('the real act-1 skeleton (protect: status, poison_stone, death) is never put to sleep', () => {
    const skel = enemyCopy('skeleton');
    expect(skel.protect).toEqual(['status', 'poison_stone', 'death']);
    const t: EnemyInstance = { id: 'enemy_0', data: skel, currentHp: skel.stats.hp, status: new StatusTracker(), buffs: new Map(), displayName: 'Skeleton' };
    for (let r = 0; r < 100; r++) applyStatusSpell({ rng: () => r / 100, addMessage: () => {} }, spell('slep'), [t]);
    expect(t.status.has('sleep')).toBe(false);
  });
});
