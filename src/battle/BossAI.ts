import type { AIBehavior } from './AIBehavior.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import type { Character } from '../entities/Character.js';
import type { BattleCommand, CommandType } from './BattleCommands.js';
import type { SpellData, SpellTargeting } from '../types/index.js';
import { selectTarget } from './EnemyAI.js';

/** A single action in a boss pattern with optional condition gating */
export interface BossAction {
  type: CommandType;
  spellId?: string;
  weight: number;
  condition?: (self: EnemyInstance, turnNumber: number) => boolean;
}

/** A set of weighted actions the boss can choose from */
export interface BossPattern {
  actions: BossAction[];
}

/**
 * Boss AI: weighted random selection from pattern actions whose conditions pass.
 * Falls back to basic fight if no actions are available.
 *
 * Targets follow the chosen spell's `targeting` on the caster's own side (ROSTER_PLAN 7.2): `single` / `all` and a
 * Fight aim at a living hero (front-weighted, as before); `single_ally` at the living ally (itself included) with the
 * lowest HP fraction; `all_allies` at its side; `self` at itself. A spell it was not given the data of aims at the
 * party, as before.
 */
export class BossAI implements AIBehavior {
  private pattern: BossPattern;
  private readonly targeting: Map<string, SpellTargeting>;

  constructor(pattern: BossPattern, spells: readonly Pick<SpellData, 'id' | 'targeting'>[] = []) {
    this.pattern = pattern;
    this.targeting = new Map(spells.map((s) => [s.id, s.targeting]));
  }

  /** Replace the current pattern (used for multi-phase transitions) */
  setPattern(pattern: BossPattern): void {
    this.pattern = pattern;
  }

  selectAction(
    self: EnemyInstance,
    party: Character[],
    allies: EnemyInstance[],
    turnNumber: number,
    rng: () => number
  ): BattleCommand {
    // Filter to actions whose conditions pass
    const available = this.pattern.actions.filter(
      a => !a.condition || a.condition(self, turnNumber)
    );

    const chosen = available.length > 0
      ? weightedRandom(available, rng)
      : null;

    const own = chosen?.type === 'magic' && chosen.spellId ? this.targeting.get(chosen.spellId) : undefined;
    if (chosen && (own === 'self' || own === 'single_ally' || own === 'all_allies')) {
      const targetId = own === 'self' ? self.id : own === 'single_ally' ? mostHurt(self, allies).id : undefined;
      return { type: chosen.type, actorId: self.id, targetId, spellId: chosen.spellId };
    }

    // Pick a living party member as target
    const targets = party.map((c, i) => ({ id: `party_${i}`, isAlive: c.currentHp > 0 }));
    const target = selectTarget(targets, rng);

    if (!chosen || chosen.type === 'fight') {
      return { type: 'fight', actorId: self.id, targetId: target?.id };
    }

    return {
      type: chosen.type,
      actorId: self.id,
      targetId: target?.id,
      spellId: chosen.spellId,
    };
  }
}

/** The living ally (the caster included) with the lowest HP fraction; the first such in battle order on a tie. */
function mostHurt(self: EnemyInstance, allies: readonly EnemyInstance[]): EnemyInstance {
  const living = allies.filter((a) => a.currentHp > 0);
  const pool = living.includes(self) || self.currentHp <= 0 ? living : [self, ...living];
  const frac = (e: EnemyInstance): number => e.currentHp / e.data.stats.hp;
  return pool.reduce((best, e) => (frac(e) < frac(best) ? e : best), pool[0] ?? self);
}

/** Weighted random selection from an array of items with .weight */
function weightedRandom<T extends { weight: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  // Fallback (shouldn't happen with valid weights)
  return items[items.length - 1];
}
