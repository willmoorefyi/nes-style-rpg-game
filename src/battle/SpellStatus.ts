import type { Character } from '../entities/Character.js';
import type { SpellData } from '../types/index.js';
import type { ProtectCategory } from '../types/enemyRoster.js';
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

/**
 * D5 (docs/ROSTER_PLAN.md 7.2): the protection that blocks each inflicted effect. `status` covers sleep, paralysis
 * (HOLD, and CONF, which inflicts it), blind, silence and fear, plus the Slow debuff and Confuse; `poison_stone`
 * covers poison and stone; `death` covers death. `earth` and `time` block nothing yet (no spell uses them).
 */
const PROTECT_OF_STATUS: Record<StatusEffect, ProtectCategory> = {
  sleep: 'status', stun: 'status', blind: 'status', silence: 'status', fear: 'status',
  poison: 'poison_stone', stone: 'poison_stone', death: 'death',
};
const PROTECT_OF_EFFECT: Record<string, ProtectCategory> = { debuff_speed: 'status', debuff_morale: 'status' };
const PROTECT_OF_SPELL: Record<string, ProtectCategory> = { conf: 'status' };

/** The protection category a status, debuff or morale spell is blocked by (null: nothing blocks it, e.g. LOCK). */
export function protectCategoryOf(spell: SpellData): ProtectCategory | null {
  const bySpell = PROTECT_OF_SPELL[spell.id] ?? PROTECT_OF_EFFECT[spell.effect];
  if (bySpell) return bySpell;
  if (!spell.effect.startsWith('status_')) return null;
  return PROTECT_OF_STATUS[spell.effect.replace('status_', '') as StatusEffect] ?? null;
}

/** An enemy whose `protect` covers the spell (heroes have no protections yet). */
export function isProtected(t: SpellTarget, spell: SpellData): boolean {
  if (!('data' in t) || !t.data.protect) return false;
  const category = protectCategoryOf(spell);
  return category !== null && t.data.protect.includes(category);
}

/**
 * Roll the spell against one target; on a miss, say so. A protected target misses the same way; its roll is still
 * drawn, so the battle's RNG stream does not depend on the protection.
 */
function lands(deps: Deps, spell: SpellData, t: SpellTarget): boolean {
  const hit = statusHits(spell.accuracy ?? DEFAULT_SPELL_ACCURACY, magicDefenseOf(t), deps.rng);
  if (hit && !isProtected(t, spell)) return true;
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
