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

export function calculateRunChance(partyAvgAgility: number, enemyAvgAgility: number): number {
  const base = 50;
  const bonus = Math.floor((partyAvgAgility - enemyAvgAgility) / 2);
  return Math.max(10, Math.min(90, base + bonus));
}
