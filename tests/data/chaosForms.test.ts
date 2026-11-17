/**
 * CHAOS_FORMS_PLAN 2.2 item 1, 3.6 (R10, R11, A5): the Chaos form records and the cross-file form rules. The chain
 * chaos -> chaos_orrery -> chaos_horizon -> chaos_horizon_core with one shared pool, strictly descending thresholds,
 * no cycle, every interlude present, no form record in an encounter on its own, and every field of 3.6 written in the
 * record (nothing inherited implicitly).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { readColossusIndex } from '../../src/scenes/battle/colossus/colossusIndex.js';
import { artIdOf, entryIdFor } from '../../src/scenes/battle/colossus/colossusEntries.js';
import { formChainErrors } from '../../src/core/formValidation.js';
import { validateEnemyData } from '../../src/core/schemaValidation.js';
import type { EnemyData, SpellData } from '../../src/types/index.js';

const ENEMIES = parse(readFileSync('assets/data/enemies.yaml', 'utf-8')) as EnemyData[];
const SPELLS = parse(readFileSync('assets/data/spells.yaml', 'utf-8')) as SpellData[];
const INTERLUDE_SCRIPTS = (parse(readFileSync('assets/data/battle-interludes.yaml', 'utf-8')) as { interludes: Array<{ id: string; steps: Array<{ type: string; text?: string }> }> }).interludes;
const INTERLUDES = new Set(INTERLUDE_SCRIPTS.map((s) => s.id));
const byId = (id: string): EnemyData => ENEMIES.find((e) => e.id === id)!;
const FORM_IDS = ['chaos_orrery', 'chaos_horizon', 'chaos_horizon_core'];
const formPhase = (e: EnemyData) => (e.bossPhases ?? []).find((p) => p.form);

describe('the Chaos form chain', () => {
  it('chaos -> chaos_orrery -> chaos_horizon -> chaos_horizon_core at 0.70 / 0.40 / 0.15, pool 20000 (CHAOS_FIX_PLAN U-3; was 6000 under D-U3)', () => {
    const chain: string[] = ['chaos'];
    const thresholds: number[] = [];
    for (let p = formPhase(byId('chaos')); p; p = formPhase(byId(chain[chain.length - 1]))) {
      chain.push(p.form!);
      thresholds.push(p.hpThreshold);
    }
    expect(chain).toEqual(['chaos', ...FORM_IDS]);
    expect(thresholds).toEqual([0.7, 0.4, 0.15]);
    expect(chain.map((id) => byId(id).stats.hp)).toEqual([20000, 20000, 20000, 20000]);
  });

  it('the cross-file form rules hold for the real data', () => {
    expect(formChainErrors(ENEMIES, INTERLUDES)).toEqual([]);
  });

  it('the form rules refuse an unknown form or interlude, a different pool, a cycle, non-descending thresholds, num on a form', () => {
    const root = (phases: EnemyData['bossPhases']): EnemyData => ({ ...byId('chaos'), bossPhases: phases });
    const f2 = { ...byId('chaos_orrery') };
    const rest = ENEMIES.filter((e) => e.id !== 'chaos' && e.id !== 'chaos_orrery');
    const errs = (es: EnemyData[], il = INTERLUDES) => formChainErrors(es, il).join('; ');
    expect(errs([root([{ hpThreshold: 0.7, patternId: 'p', form: 'nope' }]), f2, ...rest])).toMatch(/nope/);
    expect(errs([...ENEMIES], new Set(['chaos_i1']))).toMatch(/chaos_i2/);
    expect(errs([byId('chaos'), { ...f2, stats: { ...f2.stats, hp: 19999 } }, ...rest])).toMatch(/hp/);
    expect(errs([byId('chaos'), { ...f2, bossPhases: [{ hpThreshold: 0.3, patternId: 'p', form: 'chaos' }] }, ...rest])).toMatch(/cycle|formOf/);
    expect(errs([byId('chaos'), { ...f2, bossPhases: [{ hpThreshold: 0.8, patternId: 'p', form: 'chaos_horizon' }] }, ...rest])).toMatch(/descending/);
    expect(errs([byId('chaos'), { ...f2, num: 129 }, ...rest])).toMatch(/num/);
    expect(errs([byId('chaos'), { ...f2, formOf: undefined }, ...rest])).toMatch(/formOf/);
  });

  it('every form record validates against the schema', () => {
    for (const id of ['chaos', ...FORM_IDS]) expect(() => validateEnemyData(byId(id)), id).not.toThrow();
  });

  it('3.6: every field is explicit on each form record (formOf, no num, protect, attackStatus, specials, size, rewards)', () => {
    const f1 = byId('chaos');
    expect([f1.num, f1.formOf, f1.sprite, f1.size, f1.attack, f1.attackAnim]).toEqual([128, undefined, 'chaos', 'boss', 'melee', 'heavy']);
    expect(f1.attackStatus).toEqual(['stun']);
    for (const id of FORM_IDS) {
      const e = byId(id) as EnemyData & Record<string, unknown>;
      expect([e.num, e.formOf, e.size, e.xpReward, e.goldReward, e.attack, e.attackAnim], id)
        .toEqual([undefined, 'chaos', 'boss', 0, 0, 'melee', undefined]);
      expect(e.protect, id).toEqual(f1.protect);
      for (const key of ['attackStatus', 'specials', 'ai', 'description', 'stats', 'spells']) expect(key in e, `${id}.${key}`).toBe(true);
      // the elements: a full elementalProfile, or the one legacy resistance (F3 / F4: earth)
      expect('elementalProfile' in e || 'resist' in e, `${id} elements`).toBe(true);
      expect(e.specials, id).toEqual([]);
      expect(e.name, id).toBe('Chaos');
    }
    expect(byId('chaos_orrery').attackStatus).toEqual([]);
    expect(byId('chaos_horizon').attackStatus).toEqual(['stun']);
    expect(byId('chaos_horizon_core').attackStatus).toEqual(['stun']);
  });

  it('colossus art: F2 and F3 their own art id, F4 F3\'s art with the open core; the slam only on F3 / F4 (R9, R19)', () => {
    expect(byId('chaos').colossus).toBeUndefined();
    expect([byId('chaos_orrery').colossus, byId('chaos_horizon').colossus, byId('chaos_horizon_core').colossus])
      .toEqual(['chaos_orrery', 'chaos_horizon', 'chaos_horizon']);
    expect(byId('chaos_horizon_core').colossusVariant).toEqual({ core: 'open' });
    expect([byId('chaos_orrery').slam, byId('chaos_horizon').slam, byId('chaos_horizon_core').slam])
      .toEqual([undefined, { targets: 2 }, { targets: 2 }]);
    expect(byId('chaos_horizon_core').bossPhases ?? []).toEqual([]);
    // until an approved master exists the form records keep F1's sprite as the art fallback (C1 stubs)
    for (const id of FORM_IDS) expect(byId(id).sprite, id).toBe('chaos');
  });

  it('elements: F2 resists fire, ice and lightning; F3 / F4 none of the four, only earth (3.2, 3.3)', () => {
    expect(byId('chaos_orrery').elementalProfile?.resistances).toEqual(['fire', 'ice', 'lightning']);
    for (const id of ['chaos_horizon', 'chaos_horizon_core']) expect([byId(id).resist, byId(id).elementalProfile], id).toEqual(['earth', undefined]);
  });

  it('F3\'s phase at 0.25: the groan line and hits 4 (3.3), played by chaos_crack, which shows the line (18.8 row 2c, B5)', () => {
    const p = (byId('chaos_horizon').bossPhases ?? []).find((x) => !x.form);
    expect(p).toMatchObject({ hpThreshold: 0.25, hits: 4, interlude: 'chaos_crack' });
    expect(p?.message).toBe('The horizon groans; core revealed!');
    // the phase does not say its line itself, so the interlude must carry it as a message step
    const crack = INTERLUDE_SCRIPTS.find((s) => s.id === 'chaos_crack');
    expect(crack?.steps.filter((s) => s.type === 'message').map((s) => s.text)).toEqual([p?.message]);
  });

  it('every phase that names an interlude and has a message shows that message in its script (B5)', () => {
    for (const e of ENEMIES) for (const p of e.bossPhases ?? []) {
      if (!p.interlude || !p.message) continue;
      const steps = INTERLUDE_SCRIPTS.find((s) => s.id === p.interlude)?.steps ?? [];
      expect(steps.some((s) => s.type === 'message' && s.text === p.message), `${e.id}: ${p.interlude}`).toBe(true);
    }
  });

  it('rev 4 (18.0): F3 / F4 name no gripping hand, no rim grip and no moons (the picked render has none)', () => {
    for (const id of ['chaos_horizon', 'chaos_horizon_core']) expect(byId(id).description ?? '', id).not.toMatch(/grip|rim|moon/i);
  });

  it('the beam (2.4) is ice, the strongest single-target black damage spell, and F3 / F4 cast it', () => {
    const single = SPELLS.filter((s) => s.type === 'black' && s.effect === 'damage' && s.targeting === 'single');
    const strongest = single.reduce((a, b) => ((b.power ?? 0) > (a.power ?? 0) ? b : a));
    expect(strongest.id).toBe('ice');
    for (const id of ['chaos_horizon', 'chaos_horizon_core']) {
      expect((byId(id).ai?.actions ?? []).some((a) => a.type === 'magic' && a.spellId === 'ice'), id).toBe(true);
    }
  });

  it('every ai.actions spell id of every enemy exists in spells.yaml', () => {
    const ids = new Set(SPELLS.map((s) => s.id));
    for (const e of ENEMIES) for (const a of e.ai?.actions ?? []) if (a.type === 'magic') expect(ids.has(a.spellId), `${e.id}: ${a.spellId}`).toBe(true);
  });

  it('form records are in no encounter table, formation or scripted encounter of any map', () => {
    const forms = new Set(ENEMIES.filter((e) => e.formOf).map((e) => e.id));
    expect([...forms].sort()).toEqual([...FORM_IDS].sort());
    const used: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') { if (forms.has(v)) used.push(v); return; }
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (/encounter|enemies|groups|formation|id/i.test(k) || typeof x === 'object') walk(x);
    };
    for (const dir of ['assets/maps', 'assets/maps/ai']) {
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.yaml'))) {
        const map = parse(readFileSync(join(dir, f), 'utf-8')) as Record<string, unknown>;
        for (const key of ['encounters', 'encounterZones', 'scriptedEncounters']) walk(map[key]);
      }
    }
    expect(used).toEqual([]);
  });

  it('colossus forms with an approved master have their own colossus.json entry (A5: F2, F3 and F4; F4 draws F3\'s art at its own rest, D-U13)', () => {
    const json = existsSync('assets/sprites/colossus.json')
      ? JSON.parse(readFileSync('assets/sprites/colossus.json', 'utf-8')) as { forms?: Record<string, { art?: string; place?: number[] }> } : {};
    const forms = readColossusIndex(json).forms;
    const required = ENEMIES.filter((x) => x.colossus && existsSync(`assets-src/gen/approved/chaos_forms/${x.colossus}/master.png`));
    expect(required.map((e) => e.id).sort()).toEqual(['chaos_horizon', 'chaos_horizon_core', 'chaos_orrery']);
    for (const e of required) {
      expect(forms[e.id], e.id).toBeDefined();
      expect(entryIdFor({ forms }, e), e.id).toBe(e.id);
      expect(artIdOf(e.id, forms[e.id]), e.id).toBe(e.colossus);
    }
    expect(forms.chaos_horizon_core.place).toEqual([-527, -285]);
    expect(forms.chaos_horizon.place).toEqual([-527, -60]);
  });
});
