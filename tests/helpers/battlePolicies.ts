/**
 * Battle policies for the balance tests (docs/FIX_PLAN_PENINSULA.md T4 §4, revision 11): an exact port of the
 * scratch simulation's `chooseCommands` (the scratch copy is gone; the simulation is `tests/balance/` now), driving
 * the real `BattleStateMachine`.
 *
 * - careless: Fight only, a random living target, no healing or items;
 * - sensible: CURE the most hurt member below 50 %, RUSE on self once against a big enemy (the §5 browser check),
 *   LIT/FIRE the biggest enemy while it has more than 12 HP, a potion below 35 % when no one has a CURE left,
 *   otherwise Fight the weakest enemy;
 * - sleep: like sensible, plus SLEP when nothing is asleep and Garland or a pack of 3+ is up.
 *
 * The only addition to the simulation is RUSE (revision 11: "the sensible policy casts RUSE where §5 expects it").
 */
import { BattleStateMachine, type EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import type { BattleCommand } from '../../src/battle/BattleCommands.js';
import type { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import type { EnemyData, SpellData } from '../../src/types/index.js';

export type Policy = 'careless' | 'sensible' | 'sleep';

/** Seeded RNG (the simulation's). */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RUSE is worth a turn only against an enemy this big (Garland; not a field pack). */
const RUSE_MIN_ENEMY_HP = 40;

const knows = (c: Character, id: string): boolean => c.getLearnedSpells().some((s) => s.spellId === id);

/** Fill in every command for the current round with `policy`. `potions.n` counts the potions the policy may use. */
export function chooseCommands(bsm: BattleStateMachine, policy: Policy, potions: { n: number }, rng: () => number): void {
  const party = bsm.allParty;
  const living = bsm.livingEnemies;
  // sensible: hit the weakest-HP enemy first (finish off), casters use spells
  const focus = [...living].sort((a, b) => a.currentHp - b.currentHp)[0];
  const biggest = [...living].sort((a, b) => b.currentHp - a.currentHp)[0];
  while (bsm.state === 'command_select') {
    const actor = bsm.currentCommandActor;
    const id = bsm.currentCommandActorId;
    if (!actor || !id) return;
    const enemyTarget: EnemyInstance = policy === 'careless' ? living[Math.floor(rng() * living.length)] : focus;
    let cmd: BattleCommand = { type: 'fight', actorId: id, targetId: enemyTarget.id };
    if (policy !== 'careless') {
      const hurt = party.filter((c) => c.currentHp > 0).sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
      const hurtId = bsm.getPartyId(party.indexOf(hurt));
      if (knows(actor, 'cure') && actor.hasCharges(1) && hurt.currentHp < hurt.maxHp * 0.5) {
        cmd = { type: 'magic', actorId: id, targetId: hurtId, spellId: 'cure' };
      } else if (knows(actor, 'ruse') && actor.hasCharges(1) && actor.getBuffAmount('evade') === 0
        && biggest.currentHp > RUSE_MIN_ENEMY_HP) {
        cmd = { type: 'magic', actorId: id, spellId: 'ruse' };
      } else if (policy === 'sleep' && knows(actor, 'slep') && actor.hasCharges(1) && living.length >= 1
        && !living.some((e) => e.status.has('sleep')) && (living.length >= 3 || living[0].data.id === 'garland')) {
        cmd = { type: 'magic', actorId: id, spellId: 'slep' };
      } else if ((knows(actor, 'lit') || knows(actor, 'fire')) && actor.hasCharges(1) && biggest.currentHp > 12) {
        const sp = knows(actor, 'lit') ? 'lit' : 'fire';
        cmd = { type: 'magic', actorId: id, targetId: biggest.id, spellId: sp };
      } else if (potions.n > 0 && hurt.currentHp < hurt.maxHp * 0.35
        && !party.some((c) => c.currentHp > 0 && knows(c, 'cure') && c.hasCharges(1))) {
        potions.n--;
        cmd = { type: 'item', actorId: id, targetId: hurtId, itemId: 'potion' };
      }
    }
    bsm.submitCommand(cmd);
  }
}

export interface BattleRun {
  outcome: string;
  rounds: number;
  bsm: BattleStateMachine;
  /** Turns each enemy (by its `data.id`) actually took: not lost to sleep or paralysis. */
  enemyTurns: Map<string, number>;
  /** Every action's messages, in order. */
  log: string[];
}

export interface RunOptions {
  potions?: { n: number };
  /** Called at the start of every command phase (e.g. to refill charges for a stress case). */
  beforeCommands?: (bsm: BattleStateMachine) => void;
  maxRounds?: number;
  /** A boss form chain (`formChain`), for a fight with forms. */
  forms?: EnemyData[];
}

/**
 * One battle on the real state machine: the real turn order, statuses, targeting (4/2/1/1 front slots), formulas and
 * end. Potions go through a real inventory holding `potions.n`.
 */
export function runBattle(party: Character[], enemies: EnemyData[], spells: SpellData[], policy: Policy,
  rng: () => number, opts: RunOptions = {}): BattleRun {
  const potions = opts.potions ?? { n: 0 };
  const inventory = new Inventory();
  if (potions.n > 0) inventory.add('potion', potions.n);
  const bsm = new BattleStateMachine({ party, enemies, spells, inventory, canRun: false, forms: opts.forms }, rng);
  bsm.startBattle();
  bsm.advanceFromIntro();
  const enemyTurns = new Map<string, number>();
  const log: string[] = [];
  let rounds = 0;
  const maxRounds = opts.maxRounds ?? 60;
  while (!bsm.isOver && rounds < maxRounds) {
    if (bsm.state === 'command_select') {
      opts.beforeCommands?.(bsm);
      chooseCommands(bsm, policy, potions, rng);
    }
    if (bsm.state === 'execution') {
      bsm.prepareRound();
      while (bsm.actionQueueLength > 0 && !bsm.isOver) {
        const next = bsm.peekNextAction();
        const enemy = next?.actorId.startsWith('enemy_') ? bsm.allEnemies.find((e) => e.id === next.actorId) : undefined;
        const alive = !!enemy && enemy.currentHp > 0;
        const result = bsm.executeNextAction();
        log.push(...result.messages.map((m) => m.text));
        if (enemy && alive) {
          const lost = result.messages.some((m) => m.text === `${enemy.displayName} is asleep!`
            || m.text === `${enemy.displayName} is stunned!`);
          if (!lost) enemyTurns.set(enemy.data.id, (enemyTurns.get(enemy.data.id) ?? 0) + 1);
        }
      }
      rounds++;
    }
    if (bsm.state === 'resolution') bsm.resolveRound();
  }
  return { outcome: bsm.outcome ?? 'timeout', rounds, bsm, enemyTurns, log };
}
