import type { Character } from '../entities/Character.js';
import type { SpellData } from '../types/index.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import type { SpellExecutorDeps } from './SpellExecutor.js';
import type { StatusEffect } from './StatusEffects.js';
import { DEFAULT_SPELL_ACCURACY, statusHits } from './DamageFormula.js';
import { partyMagicDefense } from './CombatStats.js';

/**
 * Status, debuff and morale spells. Each target rolls `statusHits` on its own (FF1:
 * (148 + accuracy − magic defence) / 200) and says "X is unaffected." on a miss.
 */

type SpellTarget = Character | EnemyInstance;
type Deps = Pick<SpellExecutorDeps, 'rng' | 'addMessage'>;

// Fallback debuff amounts when a spell has no `power`: LOCK -20 evade, SLOW -10 agility
const DEBUFF_FALLBACK: Record<string, { stat: string; amount: number; label: string }> = {
  debuff_evade: { stat: 'evade', amount: -20, label: 'evasion' },
  debuff_speed: { stat: 'agility', amount: -10, label: 'speed' },
};

function nameOf(t: SpellTarget): string {
  return 'data' in t ? t.displayName : t.name;
}

function magicDefenseOf(t: SpellTarget): number {
  return 'data' in t ? t.data.stats.magicDefense : partyMagicDefense(t);
}

/** Roll the spell against one target; on a miss, say so. */
function lands(deps: Deps, spell: SpellData, t: SpellTarget): boolean {
  if (statusHits(spell.accuracy ?? DEFAULT_SPELL_ACCURACY, magicDefenseOf(t), deps.rng)) return true;
  deps.addMessage(`${nameOf(t)} is unaffected.`);
  return false;
}

/** `status_<effect>` (SLEP, HOLD, MUTE, DARK, ...). */
export function applyStatusSpell(deps: Deps, spell: SpellData, targets: SpellTarget[]): void {
  const status = spell.effect.replace('status_', '') as StatusEffect;
  for (const t of targets) {
    if (!lands(deps, spell, t)) continue;
    ('data' in t ? t.status : t.statusTracker).apply(status);
    deps.addMessage(`${nameOf(t)} is affected by ${status}!`);
  }
}

/** `debuff_*` (LOCK, SLOW): the amount is `power` when above 0, else the fallback. */
export function applyDebuffSpell(deps: Deps, spell: SpellData, targets: SpellTarget[]): void {
  const info = DEBUFF_FALLBACK[spell.effect];
  if (!info) return;
  const power = spell.power ?? 0;
  const amount = power > 0 ? -power : info.amount;
  for (const t of targets) {
    if (!lands(deps, spell, t)) continue;
    if ('data' in t) t.buffs.set(info.stat, (t.buffs.get(info.stat) ?? 0) + amount);
    else t.applyBuff(info.stat, amount);
    deps.addMessage(`${nameOf(t)}'s ${info.label} decreased!`);
  }
}

/** `debuff_morale` (FEAR): fear on every target it lands on. */
export function applyMoraleSpell(deps: Deps, spell: SpellData, targets: SpellTarget[]): void {
  for (const t of targets) {
    if (!lands(deps, spell, t)) continue;
    ('data' in t ? t.status : t.statusTracker).apply('fear');
    deps.addMessage(`${nameOf(t)} is frightened!`);
  }
}
