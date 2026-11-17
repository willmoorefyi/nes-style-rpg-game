/**
 * The Chaos four-form fight on the real state machine (docs/CHAOS_FIX_PLAN.md 2.1, 2.6): the `chaos_forms` party
 * from debug-scenarios.yaml, built by `debugParty.buildMember` at a level set here (the yaml level is not used), the
 * typical and aggressive policies, and one seeded run with its counters. Public API only.
 * Call `loadRealRegistries()` (tests/helpers/realData.ts) first: `buildMember` reads the class, item and spell registries.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import type { BattleCommand } from '../../src/battle/BattleCommands.js';
import { formChain } from '../../src/battle/bossForms.js';
import type { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { buildMember, type DebugMember } from '../../src/systems/debugParty.js';
import { ENEMIES, SPELLS, enemyCopy } from './balanceData.js';
import { mulberry32 } from './battlePolicies.js';

export type ChaosPolicy = 'typical' | 'aggressive';
/** The chain order (2.5): F1 Sovereign, F2 Orrery, F3 Last Horizon, F4 Core Laid Bare. */
export const CHAOS_FORMS = ['chaos', 'chaos_orrery', 'chaos_horizon', 'chaos_horizon_core'] as const;
/** The F3 0.25 phase line (enemies.yaml); it must be said before the change to F4. */
const CRACK_LINE = 'The horizon groans';
const LOST = /is (asleep|stunned)!/; // lost enemy turns, as `runBattle` counts them

const scenarioFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/data/debug-scenarios.yaml');
interface Scenario { id: string; party?: DebugMember[] }
const CHAOS_MEMBERS: DebugMember[] = (() => {
  const all = parse(readFileSync(scenarioFile, 'utf-8')) as Scenario[];
  const party = all.find((s) => s.id === 'chaos_forms')?.party;
  if (!party) throw new Error('debug-scenarios.yaml has no chaos_forms party');
  return party;
})();

/** The chaos_forms party at `level` (KNGT / NINJ / MSTR / WWIZ), full HP and charges. */
export function chaosParty(level: number): Character[] {
  return CHAOS_MEMBERS.map((m) => {
    const c = buildMember({ ...m, level, hp: undefined, status: undefined }, 'chaosBattle');
    if (!c) throw new Error(`chaosBattle: could not build ${m.name}`);
    return c;
  });
}

/** The 2.1 seed for run `s` (1..400). */
export const chaosSeed = (s: number): number => s * 7919 + 13;

/**
 * Fill every command of the round. Everyone fights Chaos; WWIZ casts LIFE on a fallen member, HEAL (typical only) when
 * 2 or more are under 55 %, or CUR3 on the most hurt member under 55 % (typical) / 30 % (aggressive).
 */
function chooseChaos(bsm: BattleStateMachine, policy: ChaosPolicy): void {
  const party = bsm.allParty;
  const target = bsm.livingEnemies[0];
  while (bsm.state === 'command_select') {
    const actor = bsm.currentCommandActor;
    const id = bsm.currentCommandActorId;
    if (!actor || !id) return;
    let cmd: BattleCommand = { type: 'fight', actorId: id, targetId: target.id };
    if (actor.name === 'WWIZ') {
      const dead = party.find((c) => c.currentHp <= 0);
      const living = party.filter((c) => c.currentHp > 0);
      const hurt = [...living].sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
      const cut = policy === 'typical' ? 0.55 : 0.3;
      const pid = (c: Character): string => bsm.getPartyId(party.indexOf(c));
      if (dead && actor.hasCharges(5)) cmd = { type: 'magic', actorId: id, targetId: pid(dead), spellId: 'life' };
      else if (policy === 'typical' && living.filter((c) => c.currentHp < c.maxHp * 0.55).length >= 2
        && actor.hasCharges(3)) cmd = { type: 'magic', actorId: id, spellId: 'heal' };
      else if (hurt && hurt.currentHp < hurt.maxHp * cut && actor.hasCharges(5)) {
        cmd = { type: 'magic', actorId: id, targetId: pid(hurt), spellId: 'cure3' };
      }
    }
    bsm.submitCommand(cmd);
  }
}

export interface ChaosRun {
  win: boolean;
  rounds: number;
  /** Enemy actions per form (`data.id` before the action), lost turns excluded. */
  acts: Map<string, number>;
  /** Command phases begun per form. */
  cmdPhases: Map<string, number>;
  /** Reached F4; and the crack line was said before it. */
  reachedF4: boolean;
  crackBeforeF4: boolean;
  /** The forms in the order they were shown, F1 first. */
  formOrder: string[];
  /** Hero falls (a revived hero can fall again). */
  kos: number;
  /** Total damage to Chaos of each hero action that damaged it. */
  heroHits: number[];
}

/** One seeded Chaos fight (pool, stats and chain from enemies.yaml as they are). */
export function runChaos(seed: number, policy: ChaosPolicy, level = 40, maxRounds = 60): ChaosRun {
  const rng = mulberry32(seed);
  const party = chaosParty(level);
  const root = enemyCopy('chaos');
  const forms = formChain([root], ENEMIES).map((e) => structuredClone(e));
  const bsm = new BattleStateMachine({ party, enemies: [root], spells: SPELLS, inventory: new Inventory(), canRun: false, forms }, rng);
  bsm.startBattle();
  bsm.advanceFromIntro();
  const run: ChaosRun = { win: false, rounds: 0, acts: new Map(), cmdPhases: new Map(), reachedF4: false,
    crackBeforeF4: false, formOrder: [root.id], kos: 0, heroHits: [] };
  const bump = (m: Map<string, number>, k: string): void => { m.set(k, (m.get(k) ?? 0) + 1); };
  const chaos = () => bsm.allEnemies[0];
  let crack = false;
  const hear = (texts: { text: string }[]): void => { if (texts.some((m) => m.text.startsWith(CRACK_LINE))) crack = true; };
  const track = (): void => {
    const id = chaos().data.id;
    if (run.formOrder[run.formOrder.length - 1] === id) return;
    run.formOrder.push(id);
    if (id === 'chaos_horizon_core' && !run.reachedF4) { run.reachedF4 = true; run.crackBeforeF4 = crack; }
  };
  const fallen = new Set<Character>();
  while (!bsm.isOver && run.rounds < maxRounds) {
    if (bsm.state === 'command_select') {
      bump(run.cmdPhases, chaos().data.id);
      chooseChaos(bsm, policy);
    }
    if (bsm.state === 'execution') {
      bsm.prepareRound();
      hear(bsm.currentMessages);
      track();
      while (bsm.actionQueueLength > 0 && !bsm.isOver) {
        const isEnemy = !!bsm.peekNextAction()?.actorId.startsWith('enemy_');
        const form = chaos().data.id;
        const alive = chaos().currentHp > 0;
        const res = bsm.executeNextAction();
        hear(res.messages);
        if (isEnemy && alive && !res.messages.some((m) => LOST.test(m.text))) bump(run.acts, form);
        if (!isEnemy) {
          const dmg = res.damageEvents.filter((d) => !d.isHeal && d.targetId.startsWith('enemy'))
            .reduce((a, d) => a + d.damage, 0);
          if (dmg > 0) run.heroHits.push(dmg);
        }
        track();
        for (const c of party) {
          if (c.currentHp <= 0 && !fallen.has(c)) { fallen.add(c); run.kos++; }
          if (c.currentHp > 0) fallen.delete(c);
        }
      }
      run.rounds++;
    }
    if (bsm.state === 'resolution') bsm.resolveRound();
  }
  run.win = bsm.outcome === 'victory';
  return run;
}
