/**
 * CHAOS_FORMS_PLAN 2.2 (M1, R4-R8): one HP pool shared by form records, form-bearing `bossPhases`, the HP floor
 * `ceil(t * pool)`, the immediate change after the action that reached it, `crossedPhases` reset, `phaseBuffs`
 * subtracted while spell buffs persist, a queued command re-chosen, and a scenario `enemyAi` override dropped.
 * Synthetic forms (pool 6000, thresholds 0.70 / 0.40 / 0.15 as D-U3), so the tuned data can change freely.
 */
import { describe, it, expect, vi } from 'vitest';
import { BattleStateMachine, type ActionResult, type EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import { BossAI } from '../../src/battle/BossAI.js';
import { enemyHits } from '../../src/battle/CombatStats.js';
import { formChain, formFloor } from '../../src/battle/bossForms.js';
import { setEnemyHp } from '../../src/battle/enemyHp.js';
import { Character } from '../../src/entities/Character.js';
import type { EnemyData, SpellData } from '../../src/types/index.js';
import { mulberry32, testClass, testEnemy } from '../helpers/testUtils.js';

const POOL = 6000;
const SPELLS: SpellData[] = [
  { id: 'fire', name: 'FIRE', level: 1, type: 'black', effect: 'damage', targeting: 'single', power: 10, element: 'fire' },
  { id: 'fir2', name: 'FIR2', level: 3, type: 'black', effect: 'damage', targeting: 'all', power: 30, element: 'fire' },
  { id: 'fast', name: 'FAST', level: 4, type: 'black', effect: 'buff_speed', targeting: 'single_ally', power: 0, element: 'none' },
  { id: 'cure', name: 'CURE', level: 1, type: 'white', effect: 'heal', targeting: 'single_ally', power: 16, element: 'none' },
] as SpellData[];

const form = (id: string, extra: Partial<EnemyData>, stats: Partial<EnemyData['stats']> = {}): EnemyData =>
  testEnemy({ id, name: 'Chaos', sprite: 'chaos', size: 'boss', ...(id === 'f1' ? {} : { formOf: 'f1' }), ...extra,
    stats: { hp: POOL, agility: 1, attack: 10, defense: 0, magicDefense: 0, evade: 0, accuracy: 0, hits: 1, ...stats } });

const F1 = form('f1', {
  ai: { rate: 1, actions: [{ type: 'magic', spellId: 'fast', weight: 1 }] },
  elementalProfile: { weaknesses: [], resistances: ['fire'], immunities: [], absorbs: [] },
  bossPhases: [
    { hpThreshold: 0.9, patternId: 'p', hits: 3 },
    { hpThreshold: 0.7, patternId: 'p', form: 'f2', interlude: 'i1' },
  ],
});
const F2 = form('f2', {
  ai: { rate: 1, actions: [{ type: 'magic', spellId: 'fir2', weight: 1 }] },
  elementalProfile: { weaknesses: ['fire'], resistances: [], immunities: [], absorbs: [] },
  bossPhases: [{ hpThreshold: 0.4, patternId: 'p', form: 'f3', interlude: 'i2' }],
});
const F3 = form('f3', {
  colossus: 'f3', slam: { targets: 2 },
  bossPhases: [
    { hpThreshold: 0.25, patternId: 'p', message: 'The horizon groans!', hits: 4 },
    { hpThreshold: 0.15, patternId: 'p', form: 'f4', interlude: 'i3' },
  ],
}, { hits: 3 });
const F4 = form('f4', { colossus: 'f3' }, { hits: 2 });
const FORMS = [F2, F3, F4];

/** A hero who always acts first; `strength` sets the hit (9999 overkills any form). */
const hero = (strength = 20, agility = 99): Character =>
  new Character({ name: 'Hero', classData: testClass('warrior', { baseStats: { hp: 999, strength, agility, intelligence: 1, vitality: 99, luck: 5 } }) });

function battle(party: Character[] = [hero()], rng: () => number = () => 0.5, enemies: EnemyData[] = [F1]): BattleStateMachine {
  const bsm = new BattleStateMachine({ party, enemies, spells: SPELLS, canRun: false, forms: FORMS }, rng);
  for (const [i, e] of enemies.entries()) if (e.ai) bsm.setEnemyAI(i, new BossAI({ actions: e.ai.actions.map((a) => ({ ...a })) }, SPELLS));
  bsm.startBattle();
  bsm.advanceFromIntro();
  return bsm;
}

/** One round: the commands, then every action; returns the round-start lines (as a first result) and every action's. */
function round(bsm: BattleStateMachine, cmd: (id: string) => Parameters<BattleStateMachine['submitCommand']>[0]): ActionResult[] {
  while (bsm.state === 'command_select') bsm.submitCommand(cmd(bsm.currentCommandActorId!));
  bsm.prepareRound();
  const out: ActionResult[] = [{ done: false, messages: [...bsm.currentMessages], damageEvents: [], missed: false }];
  for (let r = bsm.executeNextAction(); ; r = bsm.executeNextAction()) { out.push(r); if (r.done) break; }
  bsm.resolveRound();
  return out;
}
const fight = (id: string) => ({ type: 'fight' as const, actorId: id, targetId: 'enemy_0' });
const idle = (id: string) => ({ type: 'item' as const, actorId: id });
const boss = (bsm: BattleStateMachine): EnemyInstance => bsm.allEnemies[0];
const changes = (rs: ActionResult[]) => rs.flatMap((r) => (r.formChange ? [r.formChange] : []));

describe('form floor and reach rule (2.2 item 2, R5)', () => {
  it('the floor is ceil(t * pool) of the first uncrossed form phase: 4200, then 2400, then 900, then none', () => {
    const e = boss(battle());
    expect(formFloor(e)).toBe(4200);
    expect(formFloor({ ...e, data: F2 })).toBe(2400);
    expect(formFloor({ ...e, data: F3 })).toBe(900);
    expect(formFloor({ ...e, data: F4 })).toBeNull();
    expect(formFloor({ ...e, data: { ...F1, stats: { ...F1.stats, hp: 6001 } } })).toBe(Math.ceil(0.7 * 6001));
  });

  it('setEnemyHp clamps at the floor; HP exactly 4200 triggers the change, 4201 does not', () => {
    const bsm = battle();
    setEnemyHp(boss(bsm), 4201);
    round(bsm, idle);
    expect(boss(bsm).data.id).toBe('f1');
    setEnemyHp(boss(bsm), -50);
    expect(boss(bsm).currentHp).toBe(4200);
    const bsm2 = battle();
    setEnemyHp(boss(bsm2), 4200);
    round(bsm2, idle);
    expect(boss(bsm2).data.id).toBe('f2');
  });
});

describe('form change (2.2 item 3)', () => {
  it('F1 -> F2 at 0.70: data re-pointed, currentHp and max HP unchanged, formChange on the action result', () => {
    const bsm = battle([hero(9999)]);
    const rs = round(bsm, fight);
    expect(boss(bsm).data.id).toBe('f2');
    expect([boss(bsm).currentHp, boss(bsm).data.stats.hp]).toEqual([4200, POOL]);
    expect(changes(rs)).toEqual([{ enemyIndex: 0, from: 'f1', to: 'f2', interlude: 'i1' }]);
    expect(rs.find((r) => r.formChange)?.damageEvents.length).toBe(1);
  });

  it('overkill: a 9999 hit on F1 at full HP stops at 4200 and changes the form (no skip, no "defeated!")', () => {
    const bsm = battle([hero(9999)]);
    const rs = round(bsm, fight);
    expect(boss(bsm).currentHp).toBe(4200);
    expect(rs.flatMap((r) => r.messages.map((m) => m.text)).some((t) => t.includes('defeated'))).toBe(false);
    expect(bsm.livingEnemies.length).toBe(1);
  });

  it('two thresholds reached by one hit (F1 at 4300, a 9999 hit): stops at 4200, one change per action', () => {
    const bsm = battle([hero(9999)]);
    setEnemyHp(boss(bsm), 4300);
    const rs = round(bsm, fight);
    expect(changes(rs).map((c) => c.to)).toEqual(['f2']);
    expect([boss(bsm).data.id, boss(bsm).currentHp]).toEqual(['f2', 4200]);
  });

  it('F1 -> F2 -> F3 in one battle, F3 by a normal hit; crossedPhases reset so F3\'s 0.25 line fires (R4)', () => {
    const bsm = battle([hero(9999)]);
    round(bsm, fight);
    expect(boss(bsm).data.id).toBe('f2');
    expect(boss(bsm).crossedPhases?.size).toBe(0);
    round(bsm, fight);
    expect([boss(bsm).data.id, boss(bsm).currentHp]).toEqual(['f3', 2400]);
    setEnemyHp(boss(bsm), 1400);   // under 0.25 (1500), above F4's floor (900)
    const rs = round(bsm, idle);
    expect(rs.flatMap((r) => r.messages.map((m) => m.text))).toContain('The horizon groans!');
    expect(enemyHits(boss(bsm))).toBe(4);
  });

  it('checkBossPhases never applies a form phase as a plain phase (R5)', () => {
    const plain = form('plain', { bossPhases: [{ hpThreshold: 0.7, patternId: 'p', form: 'nowhere', hits: 9, message: 'X' }] });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bsm = battle([hero()], () => 0.5, [plain]);
    setEnemyHp(boss(bsm), 100);
    const rs = round(bsm, idle);
    expect(boss(bsm).buffs.get('hits')).toBeUndefined();
    expect(rs.flatMap((r) => r.messages.map((m) => m.text))).not.toContain('X');
    expect(err).toHaveBeenCalledWith(expect.stringContaining('nowhere'));
    err.mockRestore();
  });

  it('phaseBuffs of F1 are subtracted on the change while a spell buff (FAST) survives F1 -> F2 (R6)', () => {
    const bsm = battle([hero(20, 1)], () => 0.99);   // Chaos acts first and casts FAST on itself
    setEnemyHp(boss(bsm), 5000);                       // under F1's 0.9 phase (hits 3)
    round(bsm, idle);
    const e = boss(bsm);
    expect(enemyHits(e)).toBe(3);
    const fast = e.buffs.get('agility');
    expect(fast).toBeGreaterThan(0);
    expect(e.phaseBuffs?.get('hits')).toBe(2);
    setEnemyHp(e, 4200);
    round(bsm, idle);
    expect(e.data.id).toBe('f2');
    expect(enemyHits(e)).toBe(1);
    expect(e.buffs.get('agility')).toBeGreaterThanOrEqual(fast!);
    expect(e.phaseBuffs?.size ?? 0).toBe(0);
  });

  it('F3\'s hits: 4 does not leak to F4 (R6)', () => {
    const bsm = battle([hero()], () => 0.5, [F3]);
    setEnemyHp(boss(bsm), 1400);
    round(bsm, idle);
    expect(enemyHits(boss(bsm))).toBe(4);
    setEnemyHp(boss(bsm), 900);
    round(bsm, idle);
    expect(boss(bsm).data.id).toBe('f4');
    expect(enemyHits(boss(bsm))).toBe(2);
  });

  it('the next enemy action is drawn from F2\'s ai; a still-queued Chaos command is re-chosen in place (R7)', () => {
    const bsm = battle([hero(9999)]);
    while (bsm.state === 'command_select') bsm.submitCommand(fight(bsm.currentCommandActorId!));
    bsm.prepareRound();
    expect(bsm.peekNextAction()?.actorId).toBe('party_0');
    const r1 = bsm.executeNextAction();
    expect(r1.formChange?.to).toBe('f2');
    const next = bsm.peekNextAction();
    expect([next?.actorId, next?.actionType, next?.spellId]).toEqual(['enemy_0', 'magic', 'fir2']);
  });

  it('a null new AI gives the default Fight for the queued command', () => {
    const quiet = { ...F2, ai: undefined };
    const bsm = new BattleStateMachine({ party: [hero(9999)], enemies: [F1], spells: SPELLS, forms: [quiet, F3, F4] }, () => 0.5);
    bsm.setEnemyAI(0, new BossAI({ actions: [{ type: 'magic', spellId: 'fast', weight: 1 }] }, SPELLS));
    bsm.startBattle(); bsm.advanceFromIntro();
    bsm.submitCommand(fight('party_0'));
    bsm.prepareRound();
    expect(bsm.executeNextAction().formChange?.to).toBe('f2');
    expect(bsm.peekNextAction()?.actionType).toBe('fight');
    expect(boss(bsm).aiBehavior).toBeUndefined();
  });

  it('a scenario enemyAi override is dropped at the first change (R7)', () => {
    const bsm = battle([hero(9999)]);
    bsm.setEnemyAI(0, new BossAI({ actions: [{ type: 'magic', spellId: 'cure', weight: 1 }] }, SPELLS));   // the override
    round(bsm, fight);
    expect(boss(bsm).data.id).toBe('f2');
    expect(round(bsm, idle).flatMap((r) => r.messages.map((m) => m.text))).toContain('Chaos casts FIR2!');
  });

  it('F2\'s elemental profile is used by the next spell (fire: resisted by F1, a weakness of F2)', () => {
    const mage = (): Character => new Character({ name: 'Mage', classData: testClass('black_mage', {
      baseStats: { hp: 999, strength: 1, agility: 99, intelligence: 50, vitality: 99, luck: 5 }, spellLevels: { white: 0, black: 8 },
      spellCharges: [[1, [9]]] }) });
    const cast = (id: string) => ({ type: 'magic' as const, actorId: id, targetId: 'enemy_0', spellId: 'fire' });
    const hitFor = (bsm: BattleStateMachine): number => round(bsm, cast).flatMap((r) => r.damageEvents)
      .find((d) => d.targetId === 'enemy_0')!.damage;
    const a = battle([mage()]);
    const onF1 = hitFor(a);
    const b = battle([mage()]);
    setEnemyHp(boss(b), 4200);
    round(b, idle);
    expect(boss(b).data.id).toBe('f2');
    expect(hitFor(b)).toBeGreaterThan(onF1 * 3);
  });

  it('heal after the change does not revert it; formChange exactly once per form', () => {
    const bsm = battle([hero(9999)]);
    const all: ActionResult[] = [...round(bsm, fight)];
    setEnemyHp(boss(bsm), POOL);
    all.push(...round(bsm, idle), ...round(bsm, idle));
    expect(boss(bsm).data.id).toBe('f2');
    expect(changes(all).map((c) => c.to)).toEqual(['f2']);
  });

  it('the last form at 0 HP: victory', () => {
    const bsm = battle([hero(9999)], () => 0.5, [F4]);
    round(bsm, fight);
    expect(bsm.outcome).toBe('victory');
  });

  it('the poison tick across a floor changes the form through the executeNextAction hook (R8)', () => {
    const bsm = battle([hero(20, 1)], () => 0.99);
    const e = boss(bsm);
    e.status.apply('poison', 99);
    setEnemyHp(e, 4201);
    const rs = round(bsm, idle);
    expect(changes(rs).map((c) => c.to)).toEqual(['f2']);
    expect(e.currentHp).toBe(4200);
  });
});

describe('formChain: the records reachable from a battle\'s roots (loaded with the battle, retry from F1)', () => {
  it('follows the form phases from the root, once each', () => {
    expect(formChain([F1], [F1, ...FORMS]).map((e) => e.id)).toEqual(['f2', 'f3', 'f4']);
    expect(formChain([F3], [F1, ...FORMS]).map((e) => e.id)).toEqual(['f4']);
    expect(formChain([testEnemy()], [F1, ...FORMS])).toEqual([]);
  });
});

describe('an interlude on a non-form phase (CHAOS_FORMS_PLAN 18.8 row 2c, B5)', () => {
  const CRACK = form('f3c', { colossus: 'f3', slam: { targets: 2 }, bossPhases: [
    { hpThreshold: 0.25, patternId: 'p', message: 'The horizon groans!', hits: 4, interlude: 'crack' },
    { hpThreshold: 0.15, patternId: 'p', form: 'f4', interlude: 'i3' },
  ] }, { hits: 3 });
  const lines = (rs: ActionResult[]) => rs.flatMap((r) => r.messages);

  it('pushes one BattleMessage {text, interlude} in place of the plain line; the phase still applies (hits 4)', () => {
    const bsm = battle([hero()], () => 0.5, [CRACK]);
    setEnemyHp(boss(bsm), 1400);   // under 0.25 (1500), above the form floor (900)
    const rs = round(bsm, idle);
    expect(rs[0].messages).toEqual([{ text: 'The horizon groans!', interlude: 'crack' }]);
    expect(lines(rs).filter((m) => m.text === 'The horizon groans!')).toHaveLength(1);
    expect(enemyHits(boss(bsm))).toBe(4);
    expect([boss(bsm).data.id, changes(rs)]).toEqual(['f3c', []]);
    // once per phase: the next round says nothing
    expect(round(bsm, idle)[0].messages).toEqual([]);
  });

  it('a phase without an interlude keeps its plain line (no interlude key)', () => {
    const bsm = battle([hero(9999)]);
    round(bsm, fight);
    round(bsm, fight);
    setEnemyHp(boss(bsm), 1400);
    const rs = round(bsm, idle);
    expect(rs[0].messages).toEqual([{ text: 'The horizon groans!' }]);
  });
});

/*
 * CHAOS_FIX_PLAN rev 3, 2.4 (M1-M6) and 5.1a-e: the gated phases (a phase with `form` or `interlude` holds the HP floor
 * while uncrossed), the one rounding rule `hp <= ceil(t * pool)`, the reach that respects the gated floor (the crack
 * crosses at the next round start), the round-start change (`roundFormChange`, no arrival), the arrival turn
 * (`arrivalTurn`) and M5 (a write never raises HP to a floor). Synthetic chain g1 -> g4, POOL = 6000; every
 * expectation is written as `Math.ceil(t * POOL)`.
 */
const CRACK_LINE = 'The horizon groans!';
const gform = (id: string, extra: Partial<EnemyData>, stats: Partial<EnemyData['stats']> = {}, pool = POOL): EnemyData =>
  testEnemy({ id, name: 'Chaos', sprite: 'chaos', size: 'boss', ...(id === 'g1' ? {} : { formOf: 'g1' }), ...extra,
    stats: { hp: pool, agility: 1, attack: 10, defense: 0, magicDefense: 0, evade: 0, accuracy: 0, hits: 1, ...stats } });
const G1 = gform('g1', {
  ai: { rate: 1, actions: [{ type: 'magic', spellId: 'fast', weight: 1 }] },
  bossPhases: [{ hpThreshold: 0.7, patternId: 'p', form: 'g2', interlude: 'i1', arrivalTurn: true }],
});
const G1_FIRST = { ...G1, stats: { ...G1.stats, agility: 250 } };
const G2 = gform('g2', {
  ai: { rate: 1, actions: [{ type: 'magic', spellId: 'fir2', weight: 1 }, { type: 'magic', spellId: 'fast', weight: 1 }] },
  bossPhases: [{ hpThreshold: 0.4, patternId: 'p', form: 'g3', interlude: 'i2', arrivalTurn: true }],
});
const G3 = gform('g3', { bossPhases: [
  { hpThreshold: 0.25, patternId: 'p', message: CRACK_LINE, hits: 4, interlude: 'chaos_crack' },
  { hpThreshold: 0.15, patternId: 'p', form: 'g4', interlude: 'i3', arrivalTurn: true },
] }, { hits: 3 });
const G4 = gform('g4', {}, { hits: 2 });
const GFORMS = [G2, G3, G4];
/** The spells the re-chosen slot and the arrival pick with mulberry32(1) (measured; the order is what is pinned). */
const SEED1_ORDER = ['fir2', 'fast'];

function gbattle(party: Character[], rng: () => number, enemies: EnemyData[], forms: EnemyData[] = GFORMS): BattleStateMachine {
  const bsm = new BattleStateMachine({ party, enemies, spells: SPELLS, canRun: false, forms }, rng);
  for (const [i, e] of enemies.entries()) if (e.ai) bsm.setEnemyAI(i, new BossAI({ actions: e.ai.actions.map((a) => ({ ...a })) }, SPELLS));
  bsm.startBattle();
  bsm.advanceFromIntro();
  return bsm;
}

interface Played {
  start: ActionResult['messages'];
  startChange: ActionResult['formChange'] | null;
  acts: { actor: string | undefined; form: string; r: ActionResult }[];
}
/** One round with the actor (peeked) and the boss's form before each action. */
function play(bsm: BattleStateMachine, cmd: (id: string) => Parameters<BattleStateMachine['submitCommand']>[0]): Played {
  while (bsm.state === 'command_select') bsm.submitCommand(cmd(bsm.currentCommandActorId!));
  bsm.prepareRound();
  const out: Played = { start: [...bsm.currentMessages], startChange: bsm.roundFormChange ?? null, acts: [] };
  for (;;) {
    const actor = bsm.peekNextAction()?.actorId;
    const formId = boss(bsm).data.id;
    const r = bsm.executeNextAction();
    out.acts.push({ actor, form: formId, r });
    if (r.done) break;
  }
  bsm.resolveRound();
  return out;
}
const chaosActs = (p: Played): number => p.acts.filter((a) => a.actor === 'enemy_0').length;
/** The chain's events in order: round-start changes, round-start interlude lines, and action changes. */
function events(p: Played): string[] {
  const out: string[] = [];
  if (p.startChange) out.push(`start:${p.startChange.from}>${p.startChange.to}:${p.startChange.interlude}`);
  for (const m of p.start) if (m.interlude) out.push(`line:${m.interlude}`);
  for (const a of p.acts) if (a.r.formChange) out.push(`act:${a.r.formChange.from}>${a.r.formChange.to}:${a.r.formChange.interlude}`);
  return out;
}

describe('5.1a: the gated crack floor (M1-M3)', () => {
  it('F3 at ceil(0.30 * POOL): one 9999 hit leaves ceil(0.25 * POOL); the crack plays at the next round start; F4 only after a later hit', () => {
    const bsm = gbattle([hero(9999)], () => 0.5, [G3]);
    boss(bsm).currentHp = Math.ceil(0.30 * POOL);
    const r1 = play(bsm, fight);
    expect(boss(bsm).currentHp).toBe(Math.ceil(0.25 * POOL));
    expect([boss(bsm).data.id, events(r1)]).toEqual(['g3', []]);
    const r2 = play(bsm, fight);
    expect(r2.start).toEqual([{ text: CRACK_LINE, interlude: 'chaos_crack' }]);
    expect(events(r2)).toEqual(['line:chaos_crack', 'act:g3>g4:i3']);
    expect(boss(bsm).currentHp).toBe(Math.ceil(0.15 * POOL));
  });
});

describe('5.1b: the arrival turn (M6), the six cases of 2.4', () => {
  it('a hero reaches the floor while Chaos still has a queued slot: the arrival runs next, then the re-chosen slot (2 Chaos actions)', () => {
    const p = play(gbattle([hero(9999)], () => 0.5, [G1]), fight);
    expect(p.acts.map((a) => [a.actor, a.form])).toEqual([['party_0', 'g1'], ['enemy_0', 'g2'], ['enemy_0', 'g2']]);
    expect(chaosActs(p)).toBe(2);
  });

  it('Chaos already acted this round: the arrival is its only further action (2 in total)', () => {
    const p = play(gbattle([hero(9999, 1)], () => 0.5, [G1_FIRST]), fight);
    expect(p.acts.map((a) => [a.actor, a.form])).toEqual([['enemy_0', 'g1'], ['party_0', 'g1'], ['enemy_0', 'g2']]);
    expect(chaosActs(p)).toBe(2);
  });

  it('Chaos\'s own end-of-turn poison tick reaches the floor: the arrival runs right after (twice in a row, old form then new)', () => {
    const bsm = gbattle([hero(20, 1)], () => 0.5, [G1_FIRST]);
    boss(bsm).status.apply('poison', 99);
    boss(bsm).currentHp = Math.ceil(0.7 * POOL) + 1;
    const p = play(bsm, idle);
    expect(p.acts.map((a) => [a.actor, a.form])).toEqual([['enemy_0', 'g1'], ['enemy_0', 'g2'], ['party_0', 'g2']]);
    expect(p.acts[0].r.formChange?.to).toBe('g2');
  });

  it('the change happens at prepareRound: no arrival; the round has exactly one Chaos command', () => {
    const bsm = gbattle([hero()], () => 0.5, [G1]);
    boss(bsm).currentHp = Math.ceil(0.7 * POOL);
    const p = play(bsm, idle);
    expect(p.startChange).toEqual({ enemyIndex: 0, from: 'g1', to: 'g2', interlude: 'i1' });
    expect(chaosActs(p)).toBe(1);
    expect(p.acts).toHaveLength(2);
  });

  it('no hero alive after the action: no arrival is queued (done stays true)', () => {
    const last = hero(9999, 1);
    last.currentHp = 1;
    last.statusTracker.apply('poison', 99);
    const bsm = gbattle([last], () => 0.5, [G1_FIRST]);
    const p = play(bsm, fight);
    const end = p.acts[p.acts.length - 1];
    expect([end.actor, end.r.done, end.r.formChange?.to]).toEqual(['party_0', true, 'g2']);
    expect(last.currentHp).toBe(0);
    expect(bsm.actionQueueLength).toBe(0);
  });

  it('seeded order (mulberry32(1)): the re-chosen slot draws first, the arrival second', () => {
    const mage = new Character({ name: 'Mage', classData: testClass('black_mage', {
      baseStats: { hp: 999, strength: 1, agility: 99, intelligence: 50, vitality: 99, luck: 5 }, spellLevels: { white: 0, black: 8 },
      spellCharges: [[1, [9]]] }) });
    const bsm = gbattle([mage], mulberry32(1), [G1]);
    boss(bsm).currentHp = Math.ceil(0.7 * POOL) + 1;   // FIRE (a sure hit) reaches the floor
    while (bsm.state === 'command_select') bsm.submitCommand({ type: 'magic', actorId: bsm.currentCommandActorId!, targetId: 'enemy_0', spellId: 'fire' });
    bsm.prepareRound();
    const spy = vi.spyOn(BossAI.prototype, 'selectAction');
    expect(bsm.executeNextAction().formChange?.to).toBe('g2');
    const [slot, arrival] = spy.mock.results.map((r) => r.value as { type: string; spellId?: string });
    expect(spy).toHaveBeenCalledTimes(2);   // the change's only choices: the re-chosen slot, then the arrival
    spy.mockRestore();
    const seen: Array<[string | undefined, string | undefined]> = [];
    for (let i = 0; i < 2; i++) { const n = bsm.peekNextAction(); seen.push([n?.actorId, n?.spellId]); bsm.executeNextAction(); }
    expect(seen).toEqual([['enemy_0', arrival.spellId], ['enemy_0', slot.spellId]]);
    expect([slot.spellId, arrival.spellId]).toEqual(SEED1_ORDER);
  });
});

describe('5.1c: HP writes walk the chain in order, each form once', () => {
  it('(a) a direct write currentHp = 1 at the command phase: i1 at the round start, i2 after the first action, the crack at the next round start, then i3', () => {
    const bsm = gbattle([hero()], () => 0.5, [G1]);
    boss(bsm).currentHp = 1;
    const all = [play(bsm, idle), play(bsm, idle), play(bsm, idle)].flatMap(events);
    expect(all).toEqual(['start:g1>g2:i1', 'act:g2>g3:i2', 'line:chaos_crack', 'act:g3>g4:i3']);
  });

  it('(b) setEnemyHp(e, 1) moves one form per nudge (it clamps at the current gated floor)', () => {
    const bsm = gbattle([hero()], () => 0.5, [G1]);
    const per: string[][] = [];
    for (let n = 0; n < 4; n++) { setEnemyHp(boss(bsm), 1); per.push(events(play(bsm, idle))); }
    expect(per).toEqual([['start:g1>g2:i1'], ['start:g2>g3:i2'], ['line:chaos_crack'], ['start:g3>g4:i3']]);
  });
});

describe('5.1d: one rounding rule (M2), POOL = 6001', () => {
  const P = 6001;
  const H3 = gform('h3', { bossPhases: [
    { hpThreshold: 0.25, patternId: 'p', message: CRACK_LINE, interlude: 'chaos_crack' },
    { hpThreshold: 0.15, patternId: 'p', form: 'h4', interlude: 'i3' },
  ] }, {}, P);
  const H4 = gform('h4', {}, {}, P);

  it('the crack floor is 1501; HP held at 1501 crosses at the next round start, and the boss can then fall (no softlock)', () => {
    const bsm = gbattle([hero(9999)], () => 0.5, [H3], [H4]);
    boss(bsm).currentHp = 1800;
    play(bsm, fight);
    expect(boss(bsm).currentHp).toBe(Math.ceil(0.25 * P));
    expect(Math.ceil(0.25 * P)).toBe(1501);
    expect(play(bsm, fight).start).toEqual([{ text: CRACK_LINE, interlude: 'chaos_crack' }]);
    for (let n = 0; n < 4 && !bsm.isOver; n++) play(bsm, fight);
    expect(bsm.outcome).toBe('victory');
  });
});

describe('5.1e: M5, a write never raises HP to a floor (C7-N1)', () => {
  it('currentHp = 1 under the floor: a hit leaves HP <= 1', () => {
    const bsm = gbattle([hero(9999)], () => 0.5, [G2]);
    boss(bsm).currentHp = 1;
    const p = play(bsm, fight);
    expect(p.acts[0].actor).toBe('party_0');
    expect(boss(bsm).currentHp).toBeLessThanOrEqual(1);
  });

  it('at F2, damage from ceil(0.45 * POOL) still stops at ceil(0.40 * POOL)', () => {
    const bsm = gbattle([hero(9999)], () => 0.5, [G2]);
    boss(bsm).currentHp = Math.ceil(0.45 * POOL);
    const p = play(bsm, fight);
    expect(p.acts[0].r.formChange?.to).toBe('g3');
    expect(boss(bsm).currentHp).toBe(Math.ceil(0.40 * POOL));
  });

  it('a heal and a revive from 0 are unchanged', () => {
    const e = boss(gbattle([hero()], () => 0.5, [G1]));
    e.currentHp = 5000;
    setEnemyHp(e, POOL);
    expect(e.currentHp).toBe(POOL);
    e.currentHp = 0;
    setEnemyHp(e, 4500);
    expect(e.currentHp).toBe(4500);
  });
});
