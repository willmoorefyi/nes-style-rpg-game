import type { Character } from '../entities/Character.js';
import type { BossPhase, EnemyData, SpellData } from '../types/index.js';
import type { BattleCommand } from './BattleCommands.js';
import type { EnemyInstance, QueuedAction } from './BattleStateMachine.js';
import { dataDrivenAI } from './enemyAiPattern.js';
import { selectTarget } from './EnemyAI.js';

/**
 * Boss forms (docs/CHAOS_FORMS_PLAN.md 2.1-2.2; docs/CHAOS_FIX_PLAN.md 2.4 M1-M6): one HP pool shared by form records,
 * form-bearing `bossPhases` (`form: <enemy id>`), and the HP floor. A phase is **gated** when it has `form` or
 * `interlude`; while an enemy has an uncrossed gated phase its HP never goes below `ceil(threshold * pool)` of the
 * highest one (`setEnemyHp`), and a gated phase is reached at `hp <= ceil(threshold * pool)`. A reached form phase
 * changes the form right after the action (`BattleStateMachine.executeNextAction`) or at the round start
 * (`prepareRound`, no arrival); a reached non-form gated phase (F3's crack) is crossed by `checkBossPhases` at the next
 * round start, and only then does the next floor apply. A form phase with `arrivalTurn` gives the new form one action
 * right away. Pure logic on the battle's own objects; no rendering.
 */

/** The per-instance form state (EnemyInstance extends it). */
export interface FormState {
  /** The stat deltas the current form's non-form phases added to `buffs` (R6); subtracted at a form change. */
  phaseBuffs?: Map<string, number>;
}

/** What a form change did; rides on `ActionResult.formChange`, and the view plays `interlude`. */
export interface FormChangeResult {
  enemyIndex: number;
  from: string;
  to: string;
  interlude?: string;
  message?: string;
}

/** What a form change reads and writes in the battle. */
export interface FormContext {
  /** The form records this battle can reach, by id (`BattleConfig.forms`). */
  forms: ReadonlyMap<string, EnemyData>;
  spells: readonly SpellData[];
  party: readonly Character[];
  enemies: readonly EnemyInstance[];
  queue: () => QueuedAction[];
  turn: () => number;
  rng: () => number;
}

/** M1: the uncrossed gated phase (`form` or `interlude`) with the highest threshold, with its index; null when none. */
function nextGatedPhase(enemy: EnemyInstance): { index: number; phase: BossPhase } | null {
  let best: { index: number; phase: BossPhase } | null = null;
  (enemy.data.bossPhases ?? []).forEach((phase, index) => {
    if (!(phase.form || phase.interlude) || enemy.crossedPhases?.has(index)) return;
    if (!best || phase.hpThreshold > best.phase.hpThreshold) best = { index, phase };
  });
  return best;
}

/** M2: a gated phase's floor and reach, `ceil(threshold * pool)`. */
export function gatedFloor(enemy: EnemyInstance, phase: BossPhase): number {
  return Math.ceil(phase.hpThreshold * enemy.data.stats.hp);
}

/** The HP floor while a gated phase is uncrossed: `ceil(threshold * pool)`; null when none is left. */
export function formFloor(enemy: EnemyInstance): number | null {
  const next = nextGatedPhase(enemy);
  return next ? gatedFloor(enemy, next.phase) : null;
}

/**
 * Change the form of the first living enemy whose next gated phase is a form phase it has reached (M3: a non-form
 * gated phase in front, the crack, waits for `checkBossPhases`); one change per call (one per action). `say` gets the
 * phase's message when the phase has no interlude (an interlude carries its own lines). `arrival` false (the round
 * start) queues no arrival turn (M4).
 */
export function resolvePendingForms(ctx: FormContext, say: (text: string) => void, arrival = true): FormChangeResult | null {
  for (const [index, enemy] of ctx.enemies.entries()) {
    const next = enemy.currentHp > 0 ? nextGatedPhase(enemy) : null;
    if (!next?.phase.form || enemy.currentHp > gatedFloor(enemy, next.phase)) continue;
    const result = applyFormChange(enemy, index, next.index, ctx, arrival);
    if (!result) continue;
    if (result.message && !result.interlude) say(result.message);
    return result;
  }
  return null;
}

/**
 * Re-point the instance to the form record (2.2 item 3): HP kept, `crossedPhases` reset (R4), the old form's phase
 * deltas subtracted while spell buffs persist (R6), statuses cleared (D-O5: none kept), the AI rebuilt from the new
 * record's `ai` (a scenario `enemyAi` override is dropped, R7) and a still-queued command re-chosen in place (R7).
 * M6: with `arrival` and the phase's `arrivalTurn`, and a hero alive, the new form's arrival action goes to the front
 * of the queue (its choice drawn after the re-choices). An unknown form record logs an error and releases the floor
 * (the phase counts as crossed).
 */
export function applyFormChange(enemy: EnemyInstance, enemyIndex: number, phaseIndex: number, ctx: FormContext,
  arrival = true): FormChangeResult | null {
  const phase = enemy.data.bossPhases![phaseIndex];
  const to = ctx.forms.get(phase.form!);
  if (!to) {
    console.error(`${enemy.data.id}: form "${phase.form}" is not a form record of this battle; the phase is skipped`);
    (enemy.crossedPhases ??= new Set()).add(phaseIndex);
    return null;
  }
  const from = enemy.data.id;
  for (const [stat, delta] of enemy.phaseBuffs ?? []) {
    const left = (enemy.buffs.get(stat) ?? 0) - delta;
    if (left === 0) enemy.buffs.delete(stat); else enemy.buffs.set(stat, left);
  }
  enemy.phaseBuffs = new Map();
  enemy.data = to;
  enemy.crossedPhases = new Set();
  enemy.status.clear();
  const ai = to.ai ? dataDrivenAI(to.ai, ctx.spells as SpellData[]) : null;
  enemy.aiBehavior = ai ?? undefined;
  for (const queued of ctx.queue()) {
    if (queued.combatantId === enemy.id) queued.command = rechoose(enemy, ctx);
  }
  if (arrival && phase.arrivalTurn && ctx.party.some((c) => c.currentHp > 0)) {
    ctx.queue().unshift({ combatantId: enemy.id, command: rechoose(enemy, ctx), isEnemy: true });
  }
  return { enemyIndex, from, to: to.id, ...(phase.interlude ? { interlude: phase.interlude } : {}),
    ...(phase.message ? { message: phase.message } : {}) };
}

/** The new form's choice for a queued turn; with no AI, the default Fight at a living hero. */
function rechoose(enemy: EnemyInstance, ctx: FormContext): BattleCommand {
  const living = ctx.enemies.filter((e) => e.currentHp > 0);
  if (enemy.aiBehavior) return enemy.aiBehavior.selectAction(enemy, [...ctx.party], living, ctx.turn(), ctx.rng);
  const target = selectTarget(ctx.party.map((c, i) => ({ id: `party_${i}`, isAlive: c.currentHp > 0 })), ctx.rng);
  return { type: 'fight', actorId: enemy.id, targetId: target?.id };
}

/** The form records reachable from a battle's enemies through their form phases (each once, chain order). */
export function formChain(roots: readonly EnemyData[], all: readonly EnemyData[]): EnemyData[] {
  const byId = new Map(all.map((e) => [e.id, e]));
  const out: EnemyData[] = [];
  const seen = new Set(roots.map((e) => e.id));
  const walk = (e: EnemyData): void => {
    for (const p of e.bossPhases ?? []) {
      const next = p.form ? byId.get(p.form) : undefined;
      if (!next || seen.has(next.id)) continue;
      seen.add(next.id);
      out.push(next);
      walk(next);
    }
  };
  roots.forEach(walk);
  return out;
}
