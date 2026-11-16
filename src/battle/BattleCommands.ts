/** `slam` is an enemy-only multi-target physical attack (CHAOS_FORMS_PLAN 2.2 item 9). */
export type CommandType = 'fight' | 'magic' | 'item' | 'run' | 'slam';

export interface BattleCommand {
  type: CommandType;
  actorId: string;
  targetId?: string;
  spellId?: string;
  itemId?: string;
  /** No menu was shown: the member's turn is certain to be lost (play-test item 3); it never executes. */
  skip?: boolean;
}

export function createSpellCommand(actorId: string, targetId: string | undefined, spellId: string): BattleCommand {
  return { type: 'magic', actorId, targetId, spellId };
}

export function createItemCommand(actorId: string, targetId: string, itemId: string): BattleCommand {
  return { type: 'item', actorId, targetId, itemId };
}

/**
 * A fight, or a single-target spell (BA-3), whose target has died picks a living one uniformly. The caller decides
 * which spells qualify (a party caster's `single` spell aimed at an enemy); the RNG is drawn only when retargeting.
 */
export function retargetIfDead(
  command: BattleCommand,
  isTargetAlive: (id: string) => boolean,
  getLivingTargets: () => string[],
  rng: () => number = Math.random
): BattleCommand {
  if ((command.type !== 'fight' && command.type !== 'magic') || !command.targetId) return command;
  if (isTargetAlive(command.targetId)) return command;

  const living = getLivingTargets();
  if (living.length === 0) return command;
  const newTarget = living[Math.floor(rng() * living.length)];
  return { ...command, targetId: newTarget };
}

/** B9 (decision R-3): no runner escapes more than 3 times in 4 ... */
export const RUN_CAP = 0.75;
/** ... and every living enemy past the first takes 5 points off. */
export const PACK_PENALTY = 0.05;

/**
 * FF1 run: the runner escapes if rand(0 .. level + 15) < luck, so the base chance is luck / (level + 16). B9 caps it at
 * RUN_CAP and takes PACK_PENALTY per living enemy past the first: a Thief escapes 75 % from one enemy and 65 % from
 * three at any level (FF1's formula gave a Lv2 Thief 100 %).
 */
export function calculateRunChance(luck: number, level: number, livingEnemies = 1): number {
  const base = Math.min(RUN_CAP, luck / (level + 16));
  return Math.max(0, base - PACK_PENALTY * Math.max(0, livingEnemies - 1));
}
