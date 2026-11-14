export type CommandType = 'fight' | 'magic' | 'item' | 'run';

export interface BattleCommand {
  type: CommandType;
  actorId: string;
  targetId?: string;
  spellId?: string;
  itemId?: string;
}

export function createSpellCommand(actorId: string, targetId: string | undefined, spellId: string): BattleCommand {
  return { type: 'magic', actorId, targetId, spellId };
}

export function createItemCommand(actorId: string, targetId: string, itemId: string): BattleCommand {
  return { type: 'item', actorId, targetId, itemId };
}

export function retargetIfDead(
  command: BattleCommand,
  isTargetAlive: (id: string) => boolean,
  getLivingTargets: () => string[],
  rng: () => number = Math.random
): BattleCommand {
  if (command.type !== 'fight' || !command.targetId) return command;
  if (isTargetAlive(command.targetId)) return command;

  const living = getLivingTargets();
  if (living.length === 0) return command;
  const newTarget = living[Math.floor(rng() * living.length)];
  return { ...command, targetId: newTarget };
}

/**
 * FF1 run: the runner escapes if rand(0 .. level + 15) < luck, so the chance is luck / (level + 16), at most 1.
 * A Lv1 Thief (luck 15) escapes 15/17 of the time.
 */
export function calculateRunChance(luck: number, level: number): number {
  return Math.max(0, Math.min(1, luck / (level + 16)));
}
