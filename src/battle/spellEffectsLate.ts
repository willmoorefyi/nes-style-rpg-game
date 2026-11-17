import type { Character } from '../entities/Character.js';
import type { SpellData } from '../types/index.js';
import type { ProtectCategory } from '../types/enemyRoster.js';
import type { BattleCommand } from './BattleCommands.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import type { SpellExecutorDeps } from './SpellExecutor.js';
import type { StatusEffect } from './StatusEffects.js';
import { DEFAULT_SPELL_ACCURACY, statusHits } from './DamageFormula.js';
import { partyMagicDefense } from './CombatStats.js';
import { protectCategoryOf } from './SpellStatus.js';
import { formFloor } from './bossForms.js';
import { setEnemyHp } from './enemyHp.js';

/**
 * The level 5-8 spell effects (QUEST_PLAN 4.4, WORLD_PLAN 5.2 W1-G) that the older handlers in `SpellExecutor` do
 * not cover. `castLateSpell` runs after the cast line and returns true when it handled the spell:
 *
 * - `status_death` (RUB, BANE, QAKE, ZAP!, XXXX): a target the roll lands on falls (HP 0). `power` above 0 is an HP
 *   limit: a target with that much HP or more is unaffected (XXXX, 300).
 * - `status_stone` (BRAK): stone; a petrified enemy is out of the fight (HP 0), a hero keeps losing turns.
 * - `stop` (STOP): paralysis on every target (the "all-target stun"), blocked by the `time` protection.
 * - `revive` with `power` above 0 (LIF2): revive to `power` % of max HP (LIFE, power 0, stays in `SpellExecutor`).
 * - `heal_full` (CUR4): full HP and every status but death cured (the multi-status cure).
 * - `cure_stone` (SOFT), `dispel` (XFER: the target's buffs and resistances removed), `wall` (WALL: every element
 *   and protection resisted by the caster's side).
 * - `field_exit` / `field_warp` (EXIT, WARP): field spells; in battle they do nothing (as in FF1).
 *
 * Each inflicting target rolls `statusHits` once (FF1: (148 + accuracy - magic defence) / 200), even when it is
 * protected, so the RNG stream does not depend on protections. An enemy is protected by its `protect` list; a hero by a
 * temporary resistance of the spell's category (ARUB: `death`; WALL: all of them).
 */

type Target = Character | EnemyInstance;
type Deps = SpellExecutorDeps;

/** Spells whose protection is not the one of their effect (FF1 elements: BANE is poison, QAKE earth, ZAP! time). */
const CATEGORY_OF_SPELL: Readonly<Record<string, ProtectCategory>> = { bane: 'poison_stone', qake: 'earth', zap: 'time' };
const CATEGORY_OF_EFFECT: Readonly<Record<string, ProtectCategory>> = { stop: 'time' };

/** WALL's resistances: every element, plus every protection category. */
export const WALL_RESISTS: readonly string[] = [
  'fire', 'ice', 'lightning', 'earth', 'holy', 'dark', 'water', 'wind', 'status', 'poison_stone', 'death', 'time',
];

/** The statuses CUR4 cures (all but death). */
const CURABLE: readonly StatusEffect[] = ['poison', 'stun', 'sleep', 'blind', 'silence', 'stone', 'fear'];

/** The protection category a late inflicting spell is blocked by (null: none). */
export function lateCategoryOf(spell: SpellData): ProtectCategory | null {
  return CATEGORY_OF_SPELL[spell.id] ?? CATEGORY_OF_EFFECT[spell.effect] ?? protectCategoryOf(spell);
}

const isEnemyT = (t: Target): t is EnemyInstance => 'data' in t;
const nameOf = (t: Target): string => (isEnemyT(t) ? t.displayName : t.name);
const hpOf = (t: Target): number => t.currentHp;
const trackerOf = (t: Target) => (isEnemyT(t) ? t.status : t.statusTracker);
const maxHpOf = (t: Target): number => (isEnemyT(t) ? t.data.stats.hp : t.maxHp);

function guarded(t: Target, category: ProtectCategory | null): boolean {
  if (category === null) return false;
  return isEnemyT(t) ? (t.data.protect ?? []).includes(category) : t.hasTempResist(category);
}

/**
 * Whether the spell lands on `t`. The roll is always drawn first; then a protection, the HP limit (`power`) or, for a
 * kill, a boss's form floor (a form phase cannot be skipped) turns a hit into "X is unaffected.".
 */
function lands(deps: Deps, spell: SpellData, t: Target, kills: boolean): boolean {
  const mdef = isEnemyT(t) ? t.data.stats.magicDefense : partyMagicDefense(t);
  const hit = statusHits(spell.accuracy ?? DEFAULT_SPELL_ACCURACY, mdef, deps.rng);
  const limit = spell.effect === 'status_death' && (spell.power ?? 0) > 0 && hpOf(t) >= (spell.power ?? 0);
  const floored = kills && isEnemyT(t) && formFloor(t) !== null;
  if (hit && !guarded(t, lateCategoryOf(spell)) && !limit && !floored) return true;
  deps.addMessage(`${nameOf(t)} is unaffected.`);
  return false;
}

function fall(deps: Deps, t: Target): void {
  if (isEnemyT(t)) {
    setEnemyHp(t, 0);
    deps.addMessage(`${t.displayName} defeated!`);
  } else {
    const hero = t;
    hero.currentHp = 0;
    deps.addMessage(`${hero.name} fell!`);
  }
}

/** The other side: all living for `all`, else the chosen living target. */
function opposing(deps: Deps, cmd: BattleCommand, spell: SpellData, isEnemy: boolean): Target[] {
  if (spell.targeting === 'all') return isEnemy ? deps.livingParty() : deps.livingEnemies();
  if (!cmd.targetId) return [];
  if (isEnemy) {
    const c = deps.partyById.get(cmd.targetId);
    return c && c.currentHp > 0 ? [c] : [];
  }
  return deps.enemies.filter((e) => e.id === cmd.targetId && e.currentHp > 0);
}

/** The caster's side: everyone (living) for `all_allies`, the caster for `self`, else the chosen ally (any HP). */
function own(deps: Deps, cmd: BattleCommand, spell: SpellData, isEnemy: boolean): Target[] {
  if (spell.targeting === 'all_allies') return isEnemy ? deps.livingEnemies() : deps.livingParty();
  const id = spell.targeting === 'self' ? cmd.actorId : cmd.targetId;
  if (!id) return [];
  if (isEnemy) return deps.enemies.filter((e) => e.id === id);
  const c = deps.partyById.get(id);
  return c ? [c] : [];
}

function idOf(deps: Deps, t: Target): string | undefined {
  if (isEnemyT(t)) return t.id;
  for (const [id, c] of deps.partyById) if (c === t) return id;
  return undefined;
}

function setHp(t: Target, hp: number): void {
  if (isEnemyT(t)) return setEnemyHp(t, hp);
  const hero = t;
  hero.currentHp = hp; // the Character setter clamps
}

function inflict(deps: Deps, spell: SpellData, targets: Target[]): void {
  for (const t of targets) {
    if (spell.effect === 'status_death') {
      if (lands(deps, spell, t, true)) fall(deps, t);
      continue;
    }
    const stone = spell.effect === 'status_stone';
    if (!lands(deps, spell, t, stone && isEnemyT(t))) continue;
    trackerOf(t).apply(stone ? 'stone' : 'stun');
    deps.addMessage(`${nameOf(t)} is affected by ${stone ? 'stone' : 'stun'}!`);
    if (stone && isEnemyT(t)) fall(deps, t);
  }
}

function reviveFull(deps: Deps, spell: SpellData, targets: Target[]): void {
  for (const t of targets) {
    if (hpOf(t) > 0) {
      deps.addMessage('No effect.');
      continue;
    }
    trackerOf(t).remove('death');
    setHp(t, Math.max(1, Math.floor((maxHpOf(t) * (spell.power ?? 100)) / 100)));
    deps.addMessage(`${nameOf(t)} is revived!`);
  }
}

function healFull(deps: Deps, spell: SpellData, targets: Target[]): void {
  for (const t of targets) {
    if (hpOf(t) <= 0) {
      deps.addMessage(`${nameOf(t)} has fallen. No effect!`);
      continue;
    }
    const before = hpOf(t);
    setHp(t, maxHpOf(t));
    const tracker = trackerOf(t);
    const cured = CURABLE.filter((s) => tracker.has(s));
    for (const s of cured) tracker.remove(s);
    const restored = hpOf(t) - before;
    if (restored > 0) deps.addMessage(`${nameOf(t)} recovers ${restored} HP!`);
    if (cured.length > 0) deps.addMessage(`${nameOf(t)} is cured of ${cured.join(', ')}!`);
    if (restored === 0 && cured.length === 0) deps.addMessage(`${nameOf(t)}'s HP is full!`);
    const id = idOf(deps, t);
    if (id && restored > 0) deps.addDamageEvent({ targetId: id, damage: restored, isHeal: true, isCrit: false, spellElement: spell.element });
  }
}

function cureStone(deps: Deps, targets: Target[]): void {
  for (const t of targets) {
    const tracker = trackerOf(t);
    if (!tracker.has('stone')) {
      deps.addMessage('No effect.');
      continue;
    }
    tracker.remove('stone');
    deps.addMessage(`${nameOf(t)} can move again!`);
  }
}

function dispel(deps: Deps, spell: SpellData, targets: Target[]): void {
  for (const t of targets) {
    if (!lands(deps, spell, t, false)) continue;
    if (isEnemyT(t)) t.buffs.clear();
    else t.clearBattleState();
    deps.addMessage(`${nameOf(t)}'s defenses are stripped!`);
  }
}

function wall(deps: Deps, targets: Target[]): void {
  for (const t of targets) {
    if (isEnemyT(t)) continue; // an enemy's resistances are its record's (no temporary ones)
    for (const r of WALL_RESISTS) t.addTempResist(r);
  }
  deps.addMessage('A magic wall surrounds the party!');
}

/** Run a late spell effect; false when the spell is not one (the caller's own handlers run). */
export function castLateSpell(deps: Deps, cmd: BattleCommand, spell: SpellData, isEnemy: boolean): boolean {
  switch (spell.effect) {
    case 'status_death':
    case 'status_stone':
    case 'stop':
      inflict(deps, spell, opposing(deps, cmd, spell, isEnemy));
      return true;
    case 'revive':
      if ((spell.power ?? 0) <= 0) return false;
      reviveFull(deps, spell, own(deps, cmd, spell, isEnemy));
      return true;
    case 'heal_full':
      healFull(deps, spell, own(deps, cmd, spell, isEnemy));
      return true;
    case 'cure_stone':
      cureStone(deps, own(deps, cmd, spell, isEnemy));
      return true;
    case 'dispel':
      dispel(deps, spell, opposing(deps, cmd, spell, isEnemy));
      return true;
    case 'wall':
      wall(deps, own(deps, { ...cmd, targetId: undefined }, { ...spell, targeting: 'all_allies' }, isEnemy));
      return true;
    case 'field_exit':
    case 'field_warp':
      deps.addMessage('No effect.');
      return true;
    default:
      return false;
  }
}
