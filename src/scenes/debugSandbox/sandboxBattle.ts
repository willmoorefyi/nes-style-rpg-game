import type { Game } from '../../core/Game.js';
import { BattleTrigger, type BattleOutcomeData } from '../../systems/BattleTrigger.js';
import { applyDebugParty, kitFor, kitMember, type Kits } from '../../systems/debugParty.js';
import { ClassRegistry } from '../../data/ClassRegistry.js';
import { classLabel } from '../../data/classLabel.js';
import {
  backgroundOf, backgroundPath, configKey, enemiesOf, kitOf, levelOf, type SandboxConfig, type SandboxData,
} from './sandboxModel.js';
import { sandboxSession, type SandboxOutcome, type SandboxSession } from './sandboxSession.js';

export const SANDBOX_SCENE = 'debugSandbox';

/** The class's short label (WAR, WHM), with the slot number when two members share a class. */
function memberName(party: readonly string[], slot: number): string {
  const cls = ClassRegistry.getClass(party[slot]);
  const label = cls ? classLabel(cls).toUpperCase() : party[slot];
  return party.filter((c) => c === party[slot]).length > 1 ? `${label}${slot + 1}` : label;
}

/** Build the configured party (a fresh game: level, kit, the level's items and gold). */
export function applySandboxParty(game: Game, data: SandboxData, config: SandboxConfig, kits: Kits): void {
  const level = levelOf(data, config);
  const kitName = kitOf(data, config);
  const party = config.party.map((cls, i) => kitMember(kitFor(kits, kitName, cls), cls, level.level, memberName(config.party, i)));
  applyDebugParty(game, { id: level.id, party, items: { ...level.items }, gold: level.gold }, `Debug sandbox ${level.id}`);
}

export function outcomeOf(data: Pick<BattleOutcomeData, 'victory' | 'escaped'>): SandboxOutcome {
  if (data.escaped) return 'escape';
  return data.victory ? 'win' : 'loss';
}

/** The party's HP left, as a whole percentage of its max HP. */
export function partyHpPercent(game: Game): number {
  const members = game.party.all;
  const max = members.reduce((n, m) => n + m.maxHp, 0);
  return max === 0 ? 0 : Math.round((100 * members.reduce((n, m) => n + m.currentHp, 0)) / max);
}

/**
 * Fight the configured battle. Victory, escape and defeat all record the result and switch back to the sandbox
 * (never Game Over or the title). Resolves once the battle is on screen; false if it could not start.
 */
export async function startSandboxBattle(game: Game, data: SandboxData, config: SandboxConfig, kits: Kits,
  session: SandboxSession = sandboxSession, trigger: BattleTrigger = new BattleTrigger(game)): Promise<boolean> {
  const enemies = enemiesOf(data, config);
  if (enemies.length === 0) {
    console.error('Debug sandbox: no enemies to fight');
    return false;
  }
  applySandboxParty(game, data, config, kits);
  const key = configKey(data, config);
  const onEnd = (end: BattleOutcomeData): void => {
    const result = { outcome: outcomeOf(end), rounds: end.rounds, hpPercent: partyHpPercent(game) };
    session.record(key, result);
    console.info(`Debug sandbox: ${result.outcome} in ${result.rounds} rounds, party HP ${result.hpPercent}% (${key})`);
    Promise.resolve(game.scenes.switchTo(SANDBOX_SCENE))
      .catch((e: unknown) => console.error('Debug sandbox: cannot return to the sandbox', e));
  };
  await trigger.triggerBattle(enemies, undefined, backgroundPath(backgroundOf(data, config)), levelOf(data, config).enemyAi,
    undefined, { onEnd });
  return true;
}
