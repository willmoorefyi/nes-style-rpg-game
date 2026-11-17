/**
 * W1-G (WORLD_PLAN 5.2, QUEST_PLAN 4.4): the L5-L8 spells. `castLateSpell` handles death, stone, STOP (the all-target
 * stun), LIF2 (full revive), CUR4 (full heal and the multi-status cure), SOFT, XFER, WALL and the field spells EXIT /
 * WARP; the rest of the new spells run through the older handlers. Rolls use an injected RNG.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { castLateSpell, lateCategoryOf, WALL_RESISTS } from '../../src/battle/spellEffectsLate.js';
import { SpellExecutor, type SpellExecutorDeps } from '../../src/battle/SpellExecutor.js';
import type { EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import { StatusTracker } from '../../src/battle/StatusEffects.js';
import type { Character } from '../../src/entities/Character.js';
import type { EnemyData } from '../../src/types/index.js';
import type { ProtectCategory } from '../../src/types/enemyRoster.js';
import { SPELLS, ENEMIES, SHOPS, spell, enemyCopy, makeMember } from '../helpers/balanceData.js';

function foe(i: number, opts: { protect?: ProtectCategory[]; hp?: number; family?: string } = {}): EnemyInstance {
  const base = enemyCopy('goblin');
  const data: EnemyData = { ...base, protect: opts.protect, family: opts.family ?? base.family,
    stats: { ...base.stats, hp: opts.hp ?? 200, magicDefense: 0 } };
  return { id: `enemy_${i}`, data, currentHp: data.stats.hp, status: new StatusTracker(), buffs: new Map(), displayName: `Foe${i}` };
}

function setup(rngValue = 0, enemies: EnemyInstance[] = [foe(0), foe(1)]) {
  const party: Character[] = ['white_mage', 'black_mage', 'warrior', 'thief'].map((c, i) => makeMember(c, 30, { gear: [], spells: [] }, i));
  const lines: string[] = [];
  let draws = 0;
  const deps: SpellExecutorDeps = {
    party, enemies,
    rng: () => { draws++; return rngValue; },
    addMessage: (t) => { lines.push(t); },
    livingParty: () => party.filter((c) => c.currentHp > 0),
    livingEnemies: () => enemies.filter((e) => e.currentHp > 0),
    partyById: new Map(party.map((c, i) => [`party_${i}`, c])),
    addDamageEvent: () => {},
  };
  return { deps, party, enemies, lines, get draws() { return draws; } };
}

const cast = (s: ReturnType<typeof setup>, id: string, targetId?: string, actorId = 'party_0', isEnemy = false) =>
  castLateSpell(s.deps, { type: 'magic', actorId, targetId, spellId: id }, spell(id), isEnemy);

describe('spells.yaml L5-L8', () => {
  it('levels 5-8 hold 32 spells (30 new + CUR3, LIFE), 4 white and 4 black per level', () => {
    const late = SPELLS.filter((s) => s.level >= 5);
    expect(late).toHaveLength(32);
    for (const lv of [5, 6, 7, 8]) for (const type of ['white', 'black']) {
      expect(late.filter((s) => s.level === lv && s.type === type), `L${lv} ${type}`).toHaveLength(4);
    }
  });

  it('keeps exactly the 20 enemy spell ids, and every enemy spell code resolves to spells.yaml', () => {
    const ids = new Set(SPELLS.map((s) => s.id));
    const twenty = ['bane', 'blnd', 'brak', 'cur4', 'fir3', 'fog2', 'hel2', 'hel3', 'ice3', 'inv2', 'lit3', 'nuke', 'rub',
      'slo2', 'stop', 'stun', 'wall', 'xfer', 'xxxx', 'zap'];
    for (const id of twenty) expect(ids.has(id), id).toBe(true);
    for (const e of ENEMIES) for (const s of e.spells ?? []) expect(ids.has(s), `${e.id}: ${s}`).toBe(true);
  });

  it('the field spells are `exit` (field_exit) and `warp` (field_warp)', () => {
    expect([spell('exit').effect, spell('warp').effect]).toEqual(['field_exit', 'field_warp']);
  });

  it('no enemy record changed: every enemy ai still casts only L1-L5 spells it had before', () => {
    const aiSpells = ENEMIES.flatMap((e) => (e.ai?.actions ?? []).flatMap((a) => (a.type === 'magic' ? [a.spellId] : [])));
    expect(aiSpells.filter((id) => spell(id).level >= 5 && id !== 'cure3')).toEqual([]);
  });

  it('every L5-L8 spell is sold in exactly one magic shop', () => {
    const magic = SHOPS.filter((s) => s.type === 'magic');
    for (const s of SPELLS.filter((x) => x.level >= 5)) {
      expect(magic.filter((m) => m.inventory.includes(s.id)).map((m) => m.id), s.id).toHaveLength(1);
    }
  });
});

describe('castLateSpell: death and stone', () => {
  it('RUB kills one enemy on a hit; the roll is drawn once', () => {
    const s = setup(0);
    expect(cast(s, 'rub', 'enemy_0')).toBe(true);
    expect(s.enemies[0].currentHp).toBe(0);
    expect(s.lines).toEqual(['Foe0 defeated!']);
    expect(s.draws).toBe(1);
  });

  it('a miss (rng 0.99) says "unaffected" and leaves HP', () => {
    const s = setup(0.99);
    cast(s, 'rub', 'enemy_0');
    expect(s.enemies[0].currentHp).toBe(200);
    expect(s.lines).toEqual(['Foe0 is unaffected.']);
  });

  it('protections: death blocks RUB, poison_stone blocks BANE and BRAK, earth QAKE, time ZAP! and STOP; the roll is still drawn', () => {
    expect(['rub', 'bane', 'qake', 'zap', 'xxxx', 'brak', 'stop'].map((id) => lateCategoryOf(spell(id))))
      .toEqual(['death', 'poison_stone', 'earth', 'time', 'death', 'poison_stone', 'time']);
    const cases: Array<[string, ProtectCategory]> = [['rub', 'death'], ['bane', 'poison_stone'], ['qake', 'earth'], ['zap', 'time'],
      ['brak', 'poison_stone'], ['stop', 'time']];
    for (const [id, p] of cases) {
      const s = setup(0, [foe(0, { protect: [p] })]);
      cast(s, id, 'enemy_0');
      expect(s.enemies[0].currentHp, id).toBe(200);
      expect(s.enemies[0].status.getAll(), id).toEqual([]);
      expect(s.draws, id).toBe(1);
    }
  });

  it('BANE, QAKE and ZAP! hit every living enemy', () => {
    for (const id of ['bane', 'qake', 'zap']) {
      const s = setup(0, [foe(0), foe(1), foe(2)]);
      cast(s, id);
      expect(s.enemies.map((e) => e.currentHp), id).toEqual([0, 0, 0]);
    }
  });

  it('XXXX kills only a target under 300 HP', () => {
    const weak = setup(0, [foe(0, { hp: 299 })]);
    cast(weak, 'xxxx', 'enemy_0');
    expect(weak.enemies[0].currentHp).toBe(0);
    const strong = setup(0, [foe(0, { hp: 300 })]);
    cast(strong, 'xxxx', 'enemy_0');
    expect(strong.enemies[0].currentHp).toBe(300);
    expect(strong.lines).toEqual(['Foe0 is unaffected.']);
  });

  it('BRAK petrifies: the enemy is out (HP 0); a hero keeps HP and the stone status', () => {
    const s = setup(0);
    cast(s, 'brak', 'enemy_0');
    expect(s.enemies[0].status.has('stone')).toBe(true);
    expect(s.enemies[0].currentHp).toBe(0);
    expect(s.lines).toEqual(['Foe0 is affected by stone!', 'Foe0 defeated!']);
    const h = setup(0);
    cast(h, 'brak', 'party_1', 'enemy_0', true);
    expect(h.party[1].statusTracker.has('stone')).toBe(true);
    expect(h.party[1].currentHp).toBe(h.party[1].maxHp);
  });

  it('a hero with ARUB\'s death resistance (or WALL) is unaffected by RUB; without it RUB fells the hero', () => {
    const s = setup(0);
    s.party[2].addTempResist('death');
    cast(s, 'rub', 'party_2', 'enemy_0', true);
    expect(s.party[2].currentHp).toBeGreaterThan(0);
    cast(s, 'rub', 'party_3', 'enemy_0', true);
    expect(s.party[3].currentHp).toBe(0);
    expect(s.lines).toEqual(['warrior2 is unaffected.', 'thief3 fell!']);
  });
});

describe('castLateSpell: STOP, the all-target stun', () => {
  it('paralyses every living enemy; the status-protected one too (time, not status, blocks it)', () => {
    const s = setup(0, [foe(0), foe(1, { protect: ['status'] }), foe(2, { protect: ['time'] })]);
    cast(s, 'stop');
    expect(s.enemies.map((e) => e.status.has('stun'))).toEqual([true, true, false]);
    expect(s.draws).toBe(3);
  });
});

describe('castLateSpell: revive, heal and cures', () => {
  it('LIF2 revives a fallen ally to full HP; LIFE (power 0) is left to SpellExecutor', () => {
    const s = setup(0);
    s.party[2].currentHp = 0;
    cast(s, 'lif2', 'party_2');
    expect(s.party[2].currentHp).toBe(s.party[2].maxHp);
    expect(s.lines).toEqual(['warrior2 is revived!']);
    expect(cast(s, 'life', 'party_2')).toBe(false);
  });

  it('LIF2 on a living ally: no effect', () => {
    const s = setup(0);
    cast(s, 'lif2', 'party_2');
    expect(s.lines).toEqual(['No effect.']);
  });

  it('CUR4 restores all HP and cures every status but death', () => {
    const s = setup(0);
    const hero = s.party[2];
    hero.currentHp = 5;
    for (const st of ['poison', 'blind', 'silence', 'stone'] as const) hero.statusTracker.apply(st);
    cast(s, 'cur4', 'party_2');
    expect(hero.currentHp).toBe(hero.maxHp);
    expect(hero.statusTracker.getAll()).toEqual([]);
    expect(s.lines).toEqual([`warrior2 recovers ${hero.maxHp - 5} HP!`, 'warrior2 is cured of poison, blind, silence, stone!']);
  });

  it('SOFT cures stone, else no effect', () => {
    const s = setup(0);
    s.party[1].statusTracker.apply('stone');
    cast(s, 'soft', 'party_1');
    cast(s, 'soft', 'party_1');
    expect(s.party[1].statusTracker.has('stone')).toBe(false);
    expect(s.lines).toEqual(['black_mage1 can move again!', 'No effect.']);
  });
});

describe('castLateSpell: XFER, WALL, EXIT / WARP', () => {
  it('XFER strips an enemy\'s buffs', () => {
    const s = setup(0);
    s.enemies[0].buffs.set('defense', 20);
    cast(s, 'xfer', 'enemy_0');
    expect(s.enemies[0].buffs.size).toBe(0);
  });

  it('WALL gives every living hero every element and protection resistance', () => {
    const s = setup(0);
    cast(s, 'wall');
    for (const c of s.party) for (const r of WALL_RESISTS) expect(c.hasTempResist(r), `${c.name} ${r}`).toBe(true);
  });

  it('EXIT and WARP do nothing in battle', () => {
    const s = setup(0);
    expect(cast(s, 'exit')).toBe(true);
    expect(cast(s, 'warp')).toBe(true);
    expect(s.lines).toEqual(['No effect.', 'No effect.']);
  });

  it('the older effects are not handled here (FIR3, HEL2, FOG2, SLO2, SABR, STUN, BLND, ARUB, NUKE, HRM3)', () => {
    const s = setup(0);
    for (const id of ['fir3', 'hel2', 'fog2', 'slo2', 'sabr', 'stun', 'blnd', 'arub', 'nuke', 'hrm3']) expect(cast(s, id), id).toBe(false);
  });
});

describe('SpellExecutor dispatch (+2 lines)', () => {
  it('a cast RUB goes through castLateSpell after the cast line and spends the charge', () => {
    const s = setup(0);
    const mage = s.party[1];
    mage.learnSpell('rub', 6);
    mage.restoreAllCharges();
    const before = mage.getSpellCharges(6);
    new SpellExecutor(s.deps, SPELLS).execute({ type: 'magic', actorId: 'party_1', targetId: 'enemy_0', spellId: 'rub' }, false);
    expect(s.lines).toEqual(['black_mage1 casts RUB!', 'Foe0 defeated!']);
    expect(mage.getSpellCharges(6)).toBe(before - 1);
  });

  it('SpellExecutor.ts stays within its 314-line ceiling', () => {
    expect(readFileSync('src/battle/SpellExecutor.ts', 'utf-8').trimEnd().split('\n').length).toBeLessThanOrEqual(314);
  });
});
