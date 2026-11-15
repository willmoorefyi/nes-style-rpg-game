/**
 * The presented battle state (docs/FEEDBACK_PLAN_2026-11-14.md §2 items 4-5): what the screen shows, which lags the
 * live state machine until an action's effect reaches its impact. Pure (no PixiJS).
 */
import type { StatusEffect } from '../../battle/StatusEffects.js';
import type { NextActionInfo } from '../../battle/BattleStateMachine.js';
import type { SpellTargeting } from '../../types/index.js';

export interface PresentedActor { hp: number; statuses: StatusEffect[] }
export interface PresentedState { party: PresentedActor[]; enemies: PresentedActor[] }

interface StatusSource { getAll(): ReadonlyArray<{ effect: StatusEffect }> }
/** What the snapshot reads (a BattleStateMachine; test doubles may leave fields out). */
export interface BattleStateSource {
  readonly allParty?: readonly { currentHp: number; statusTracker?: StatusSource }[];
  readonly allEnemies?: readonly { currentHp: number; status?: StatusSource }[];
}

const statusesOf = (s: StatusSource | undefined): StatusEffect[] => s?.getAll().map((e) => e.effect) ?? [];

/** The live state as it would be presented now. */
export function captureState(battle: BattleStateSource): PresentedState {
  return {
    party: (battle.allParty ?? []).map((c) => ({ hp: c.currentHp, statuses: statusesOf(c.statusTracker) })),
    enemies: (battle.allEnemies ?? []).map((e) => ({ hp: e.currentHp, statuses: statusesOf(e.status) })),
  };
}

/** Status sets by battle id (`party_i`, `enemy_i`). */
export function statusSets(battle: BattleStateSource): Map<string, StatusEffect[]> {
  const sets = new Map<string, StatusEffect[]>();
  (battle.allParty ?? []).forEach((c, i) => sets.set(`party_${i}`, statusesOf(c.statusTracker)));
  (battle.allEnemies ?? []).forEach((e, i) => sets.set(`enemy_${i}`, statusesOf(e.status)));
  return sets;
}

/** One combatant's status change in an action: `added` statuses landed, `removed` ones were cleansed or wore off. */
export interface StatusChange { id: string; added: StatusEffect[]; removed: StatusEffect[] }
export type StatusDiff = StatusChange[];

/** The changes between two `statusSets` snapshots (only combatants that changed). No message text is parsed. */
export function diffStatuses(before: Map<string, StatusEffect[]>, after: Map<string, StatusEffect[]>): StatusDiff {
  const diff: StatusDiff = [];
  for (const [id, now] of after) {
    const was = before.get(id) ?? [];
    const added = now.filter((s) => !was.includes(s));
    const removed = was.filter((s) => !now.includes(s));
    if (added.length || removed.length) diff.push({ id, added, removed });
  }
  return diff;
}

/** What the target set reads: who is alive on each side, in battle order. */
export interface TargetSource {
  readonly allParty?: readonly { currentHp: number }[];
  readonly allEnemies?: readonly { currentHp: number }[];
}

const living = (list: readonly { currentHp: number }[] | undefined, side: 'party' | 'enemy'): string[] =>
  (list ?? []).flatMap((c, i) => (c.currentHp > 0 ? [`${side}_${i}`] : []));

/**
 * The battle ids an action's effect plays on, captured at announce time: `info.targetId` when it is set; for an
 * `all` spell the living other side, for `all_allies` the living own side (battle order); `self` the actor.
 */
export function actionTargetIds(info: NextActionInfo, battle: TargetSource, targeting?: SpellTargeting): string[] {
  const enemyActor = info.actorId.startsWith('enemy_');
  const own = (): string[] => (enemyActor ? living(battle.allEnemies, 'enemy') : living(battle.allParty, 'party'));
  const other = (): string[] => (enemyActor ? living(battle.allParty, 'party') : living(battle.allEnemies, 'enemy'));
  if (targeting === 'all' || info.allTargets) return other();
  if (targeting === 'all_allies') return own();
  if (info.targetId) return [info.targetId];
  return targeting === 'self' ? [info.actorId] : [];
}
