import type { Character } from '../entities/Character.js';
import { castLine, chargeStops, silenceStops } from './itemCast.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import type { SpellData } from '../types/index.js';
import type { BattleCommand } from './BattleCommands.js';
import type { StatusEffect } from './StatusEffects.js';
import { healAmount, magicDamage } from './DamageFormula.js';
import { partyMagicDefense } from './CombatStats.js';
import { applyDebuffSpell, applyMoraleSpell, applyStatusSpell } from './SpellStatus.js';
import { setEnemyHp } from './enemyHp.js';
import { castLateSpell } from './spellEffectsLate.js';

import type { DamageEvent } from './BattleStateMachine.js';

export interface SpellExecutorDeps {
  party: Character[];
  enemies: EnemyInstance[];
  rng: () => number;
  addMessage: (text: string) => void;
  livingParty: () => Character[];
  livingEnemies: () => EnemyInstance[];
  /** Maps unique party IDs (party_0, party_1, ...) to their Character */
  partyById: Map<string, Character>;
  addDamageEvent: (event: DamageEvent) => void;
}

// Fallback buff amounts when a spell has no `power`: FOG +8 absorb, INVS +40 evade, TMPR +14 attack,
// FAST +10 agility. A spell's `power` above 0 is the amount (RUSE is +80 evade, self).
// All buffs last the entire battle (no turn countdown), matching FF1 behavior
export const BUFF_VALUES: Record<string, { stat: string; amount: number; label: string }> = {
  buff_defense: { stat: 'defense', amount: 8, label: 'defense' },
  buff_evade:   { stat: 'evade', amount: 40, label: 'evasion' },
  buff_attack:  { stat: 'attack', amount: 14, label: 'attack' },
  buff_speed:   { stat: 'agility', amount: 10, label: 'speed' },
};

export class SpellExecutor {
  private deps: SpellExecutorDeps;
  private spells: SpellData[];

  constructor(deps: SpellExecutorDeps, spells: SpellData[]) {
    this.deps = deps;
    this.spells = spells;
  }

  /** Get the battle ID for a Character reference */
  private getCharId(char: Character): string | undefined {
    for (const [id, c] of this.deps.partyById) {
      if (c === char) return id;
    }
    return undefined;
  }

  /** Look up a party member by unique battle ID, returning as a single-element array for filter compatibility */
  private partyFilter(id: string, condition?: (c: Character) => boolean): Character[] {
    const char = this.deps.partyById.get(id);
    if (!char) return [];
    if (condition && !condition(char)) return [];
    return [char];
  }

  execute(command: BattleCommand, isEnemy: boolean): void {
    const spell = this.spells.find(s => s.id === command.spellId);
    if (!spell) {
      this.deps.addMessage('Unknown spell!');
      return;
    }

    // BA-3 / B2: the state machine has already moved a single-target spell at a dead enemy onto a living one; with
    // none left the spell isn't cast and no charge is spent.
    const cmd = command;
    if (!isEnemy && spell.targeting === 'single' && cmd.targetId?.startsWith('enemy_')
      && this.deps.livingEnemies().length === 0) return;

    const caster = isEnemy
      ? this.deps.enemies.find(e => e.id === cmd.actorId)
      : this.deps.partyById.get(cmd.actorId);
    if (!caster) return;
    const casterName = isEnemy ? (caster as EnemyInstance).displayName : (caster as Character).name;

    // B8: a silenced caster (either side) loses the turn and spends nothing; a worn item's cast is not silenced (EQ)
    if (silenceStops(caster, casterName, cmd, isEnemy, (t) => this.deps.addMessage(t))) return;
    // B4: a single-ally spell (not a revive) at an ally who fell before it went off is not cast
    const ally = spell.targeting === 'single_ally' && spell.effect !== 'revive' && cmd.targetId ? this.allyById(cmd.targetId, isEnemy) : null;
    if (ally && ally.hp <= 0) {
      this.deps.addMessage(`${ally.name} has fallen. No effect!`);
      return;
    }
    if (chargeStops(caster, spell, cmd, isEnemy, (t) => this.deps.addMessage(t))) return;

    this.deps.addMessage(castLine(casterName, spell, cmd));
    if (castLateSpell(this.deps, cmd, spell, isEnemy)) return; // L5-L8 effects (spellEffectsLate.ts)

    // Handle different spell effects
    if (spell.effect === 'heal') {
      this.executeHealSpell(cmd, spell, isEnemy);
    } else if (spell.effect.startsWith('buff_')) {
      this.executeBuffSpell(cmd, spell, isEnemy);
    } else if (spell.effect === 'debuff_morale') {
      applyMoraleSpell(this.deps, spell, isEnemy ? this.deps.livingParty() : this.deps.livingEnemies());
    } else if (spell.effect.startsWith('debuff_')) {
      applyDebuffSpell(this.deps, spell, this.opposingTargets(cmd, spell, isEnemy));
    } else if (spell.effect.startsWith('status_')) {
      const targets = this.familyFiltered(spell, this.opposingTargets(cmd, spell, isEnemy));
      if (targets) applyStatusSpell(this.deps, spell, targets);
    } else if (spell.effect === 'cure_blind') {
      this.executeCureStatusSpell(cmd, isEnemy, 'blind', 'sight is restored');
    } else if (spell.effect === 'cure_poison') {
      this.executeCureStatusSpell(cmd, isEnemy, 'poison', 'is cured of poison');
    } else if (spell.effect === 'cure_silence') {
      this.executeCureStatusSpell(cmd, isEnemy, 'silence', 'can speak again');
    } else if (spell.effect === 'revive') {
      this.executeReviveSpell(cmd, isEnemy);
    } else if (spell.effect.startsWith('resist_')) {
      const element = spell.effect.replace('resist_', '');
      this.executeResistSpell(isEnemy, element);
    } else if (spell.effect.startsWith('damage')) {
      this.executeDamageSpell(cmd, spell, isEnemy);
    }
  }

  /** An ally of the caster by battle id: its name and HP (null when the id is not on the caster's side). */
  private allyById(id: string, isEnemy: boolean): { name: string; hp: number } | null {
    const e = isEnemy ? this.deps.enemies.find(x => x.id === id) : undefined;
    const c = isEnemy ? undefined : this.deps.partyById.get(id);
    return e ? { name: e.displayName, hp: e.currentHp } : c ? { name: c.name, hp: c.currentHp } : null;
  }

  /** B4: the line and the float report the HP actually restored; a full-HP target says so (no float). */
  private reportHeal(name: string, id: string | undefined, restored: number, element?: string): void {
    this.deps.addMessage(restored > 0 ? `${name} recovers ${restored} HP!` : `${name}'s HP is full!`);
    if (id && restored > 0) this.deps.addDamageEvent({ targetId: id, damage: restored, isHeal: true, isCrit: false, spellElement: element });
  }

  private executeHealSpell(cmd: BattleCommand, spell: SpellData, isEnemy: boolean): void {
    const targets = spell.targeting === 'all_allies'
      ? (isEnemy ? this.deps.livingEnemies() : this.deps.livingParty())
      : cmd.targetId
        ? (isEnemy ? this.deps.enemies.filter(e => e.id === cmd.targetId) : this.partyFilter(cmd.targetId!))
        : [];

    for (const target of targets) {
      const heal = healAmount(spell, this.deps.rng);
      if ('currentHp' in target && 'data' in target) {
        // EnemyInstance
        const enemy = target as EnemyInstance;
        const before = enemy.currentHp;
        setEnemyHp(enemy, Math.min(enemy.data.stats.hp, enemy.currentHp + heal));
        this.reportHeal(enemy.displayName, enemy.id, enemy.currentHp - before, spell.element);
      } else {
        // Character — skip fallen allies
        const char = target as Character;
        if (char.currentHp <= 0) {
          this.deps.addMessage(`${char.name} has fallen. No effect!`);
          continue;
        }
        const before = char.currentHp;
        char.currentHp = char.currentHp + heal; // the setter clamps at max HP
        this.reportHeal(char.name, this.getCharId(char), char.currentHp - before, spell.element);
      }
    }
  }

  /** Targets on the other side: everyone for an `all` spell, else the chosen one (enemies: if alive). */
  private opposingTargets(cmd: BattleCommand, spell: SpellData, isEnemy: boolean): Array<Character | EnemyInstance> {
    if (spell.targeting === 'all') return isEnemy ? this.deps.livingParty() : this.deps.livingEnemies();
    if (!cmd.targetId) return [];
    return isEnemy
      ? this.partyFilter(cmd.targetId)
      : this.deps.enemies.filter(e => e.id === cmd.targetId && e.currentHp > 0);
  }

  /** Keep only the spell's family (HARM: undead); null, after a "no effect" line, when none is left. */
  private familyFiltered(spell: SpellData, all: Array<Character | EnemyInstance>): Array<Character | EnemyInstance> | null {
    if (!spell.targetFamily) return all;
    const targets = all.filter(t => 'data' in t && t.data.family === spell.targetFamily);
    if (targets.length > 0) return targets;
    this.deps.addMessage(`${spell.name} has no effect!`);
    return null;
  }

  private executeDamageSpell(cmd: BattleCommand, spell: SpellData, isEnemy: boolean): void {
    const targets = this.familyFiltered(spell, this.opposingTargets(cmd, spell, isEnemy));
    if (!targets) return;
    const info = { power: spell.power ?? 20, accuracy: spell.accuracy, element: spell.element };

    for (const target of targets) {
      if ('data' in target) {
        const enemy = target;
        const { damage } = magicDamage(info, {
          magicDefense: enemy.data.stats.magicDefense,
          weakness: enemy.data.weakness,
          resist: enemy.data.resist,
          elementalProfile: enemy.data.elementalProfile,
        }, this.deps.rng);
        setEnemyHp(enemy, Math.max(0, enemy.currentHp - damage));
        this.deps.addMessage(`${enemy.displayName} takes ${damage} damage!`);
        this.deps.addDamageEvent({ targetId: enemy.id, damage, isHeal: false, isCrit: false, spellElement: spell.element });
        if (enemy.currentHp <= 0) this.deps.addMessage(`${enemy.displayName} defeated!`);
      } else {
        const char = target;
        const charId = this.getCharId(char);
        const resisted = !!spell.element && char.hasTempResist(spell.element);
        const { damage } = magicDamage(info, {
          magicDefense: partyMagicDefense(char),
          resist: resisted ? spell.element : undefined,
        }, this.deps.rng);
        char.currentHp = char.currentHp - damage;
        this.deps.addMessage(`${char.name} takes ${damage} damage!`);
        if (charId) this.deps.addDamageEvent({ targetId: charId, damage, isHeal: false, isCrit: false, spellElement: spell.element });
        if (char.currentHp <= 0) this.deps.addMessage(`${char.name} fell!`);
      }
    }
  }

  private executeBuffSpell(cmd: BattleCommand, spell: SpellData, isEnemy: boolean): void {
    const info = BUFF_VALUES[spell.effect];
    if (!info) return;
    const power = spell.power ?? 0;
    const amount = power > 0 ? power : info.amount;

    // Buffs target the caster's side: itself (self), one ally, or all of them (an enemy's too: RUSE, FAST)
    const targets = spell.targeting === 'self'
      ? (isEnemy ? this.deps.enemies.filter(e => e.id === cmd.actorId && e.currentHp > 0) : this.partyFilter(cmd.actorId, c => c.currentHp > 0))
      : cmd.targetId
        ? (isEnemy
          ? this.deps.enemies.filter(e => e.id === cmd.targetId && e.currentHp > 0)
          : this.partyFilter(cmd.targetId!, c => c.currentHp > 0))
        : (isEnemy ? this.deps.livingEnemies() : this.deps.livingParty());

    for (const target of targets) {
      if ('data' in target) {
        const enemy = target as EnemyInstance;
        enemy.buffs.set(info.stat, (enemy.buffs.get(info.stat) ?? 0) + amount);
        this.deps.addMessage(`${enemy.displayName}'s ${info.label} increased!`);
      } else {
        const char = target as Character;
        char.applyBuff(info.stat, amount);
        this.deps.addMessage(`${char.name}'s ${info.label} increased!`);
      }
    }
  }

  private executeCureStatusSpell(cmd: BattleCommand, isEnemy: boolean, status: StatusEffect, successMsg: string): void {
    const targets = cmd.targetId
      ? (isEnemy ? this.deps.enemies.filter(e => e.id === cmd.targetId) : this.partyFilter(cmd.targetId!))
      : [];
    for (const target of targets) {
      const tracker = 'data' in target ? target.status : target.statusTracker;
      const name = 'data' in target ? target.displayName : target.name;
      if (tracker.has(status)) {
        tracker.remove(status);
        this.deps.addMessage(`${name}'s ${successMsg}!`);
      } else {
        this.deps.addMessage('No effect.');
      }
    }
  }

  private executeReviveSpell(cmd: BattleCommand, isEnemy: boolean): void {
    // Revive targets fallen allies — find by name even if dead
    const targets = cmd.targetId
      ? (isEnemy
        ? this.deps.enemies.filter(e => e.id === cmd.targetId)
        : this.partyFilter(cmd.targetId!))
      : [];

    for (const target of targets) {
      if ('data' in target) {
        const enemy = target as EnemyInstance;
        if (enemy.currentHp <= 0) {
          enemy.status.remove('death');
          setEnemyHp(enemy, 1);
          this.deps.addMessage(`${enemy.displayName} is revived!`);
        } else {
          this.deps.addMessage('No effect.');
        }
      } else {
        const char = target as Character;
        if (char.currentHp <= 0) {
          char.statusTracker.remove('death');
          // WP6 fix: set HP to exactly 1 (direct assignment, not additive)
          char.currentHp = 1;
          this.deps.addMessage(`${char.name} is revived!`);
        } else {
          this.deps.addMessage('No effect.');
        }
      }
    }
  }

  private executeResistSpell(isEnemy: boolean, element: string): void {
    // Resistance spells target all allies
    const targets = isEnemy ? this.deps.livingEnemies() : this.deps.livingParty();
    for (const target of targets) {
      if (!('data' in target)) {
        (target as Character).addTempResist(element);
      }
    }
    this.deps.addMessage(`Party gains ${element} resistance!`);
  }
}
