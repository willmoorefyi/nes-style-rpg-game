export type CommandType = 'fight' | 'magic' | 'item' | 'run';

export interface BattleCommand {
  type: CommandType;
  actorId: string;
  targetId?: string;
}

export function retargetIfDead(
  command: BattleCommand,
  isTargetAlive: (id: string) => boolean,
  getLivingEnemies: () => string[],
  rng: () => number = Math.random
): BattleCommand {
  if (command.type !== 'fight' || !command.targetId) return command;
  if (isTargetAlive(command.targetId)) return command;

  const living = getLivingEnemies();
  if (living.length === 0) return command;
  const newTarget = living[Math.floor(rng() * living.length)];
  return { ...command, targetId: newTarget };
}

export function calculateRunChance(partyAvgAgility: number, enemyAvgAgility: number): number {
  const base = 50;
  const bonus = Math.floor((partyAvgAgility - enemyAvgAgility) / 2);
  return Math.max(10, Math.min(90, base + bonus));
}
