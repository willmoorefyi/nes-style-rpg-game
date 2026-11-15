import type { EnemyData } from '../types/index.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import { StatusTracker } from './StatusEffects.js';

/** The battle's enemy instances (enemy_0, enemy_1, ...); a name that appears more than once gets A, B, C... */
export function makeEnemyInstances(enemies: EnemyData[]): EnemyInstance[] {
  const nameCounts = new Map<string, number>();
  for (const e of enemies) nameCounts.set(e.name, (nameCounts.get(e.name) ?? 0) + 1);
  const nameIndex = new Map<string, number>();
  return enemies.map((e, i) => {
    const idx = nameIndex.get(e.name) ?? 0;
    nameIndex.set(e.name, idx + 1);
    const suffix = (nameCounts.get(e.name) ?? 1) > 1 ? ` ${String.fromCharCode(65 + idx)}` : '';
    return {
      id: `enemy_${i}`, data: e, currentHp: e.stats.hp, status: new StatusTracker(), buffs: new Map(),
      displayName: `${e.name}${suffix}`, crossedPhases: new Set<number>(),
    };
  });
}
