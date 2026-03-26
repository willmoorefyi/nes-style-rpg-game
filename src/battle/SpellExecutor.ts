import type { Character } from '../entities/Character.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import type { SpellData } from '../types/index.js';
import type { BattleCommand } from './BattleCommands.js';
import type { StatusEffect } from './StatusEffects.js';
import { calculateMagicDamage } from './DamageFormula.js';

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

// FF1-faithful buff values: FOG +8 def, RUSE/INVS +40 evade, TMPR +14 atk, FAST +10 agi
// All buffs last the entire battle (no turn countdown), matching FF1 behavior
export const BUFF_VALUES: Record<string, { stat: string; amount: number; label: string }> = {
  buff_defense: { stat: 'defense', amount: 8, label: 'defense' },
  buff_evade:   { stat: 'evade', amount: 40, label: 'evasion' },
  buff_attack:  { stat: 'attack', amount: 14, label: 'attack' },
  buff_speed:   { stat: 'agility', amount: 10, label: 'speed' },
};

// FF1-faithful debuff values: LOCK -20 evade, SLOW -10 agility
const DEBUFF_VALUES: Record<string, { stat: string; amount: number; label: string }> = {
  debuff_evade: { stat: 'evade', amount: -20, label: 'evasion' },
  debuff_speed: { stat: 'agility', amount: -10, label: 'speed' },
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

  execute(cmd: BattleCommand, isEnemy: boolean): void {
    const spell = this.spells.find(s => s.id === cmd.spellId);
    if (!spell) {
      this.deps.addMessage('Unknown spell!');
      return;
    }

    // Get caster
    const caster = isEnemy
      ? this.deps.enemies.find(e => e.id === cmd.actorId)
      : this.deps.partyById.get(cmd.actorId);
    if (!caster) return;

    // For party members, check charges and silence
    if (!isEnemy) {
      const char = caster as Character;
      if (!char.hasCharges(spell.level)) {
        this.deps.addMessage(`${char.name} has no charges!`);
        return;
      }
      // Note: silence check would go here if we add StatusTracker to Character
      char.useCharge(spell.level);
    }

    const casterName = isEnemy ? (caster as EnemyInstance).data.name : (caster as Character).name;
    const casterInt = isEnemy
      ? (caster as EnemyInstance).data.stats.intelligence
      : (caster as Character).stats.intelligence;

    this.deps.addMessage(`${casterName} casts ${spell.name}!`);

    // Handle different spell effects
    if (spell.effect === 'heal') {
      this.executeHealSpell(cmd, spell, casterInt, isEnemy);
    } else if (spell.effect.startsWith('buff_')) {
      this.executeBuffSpell(cmd, spell, isEnemy);
    } else if (spell.effect === 'debuff_morale') {
      // TODO: debuff_morale (FEAR) — no morale system implemented yet.
      // Spell is defined in spells.yaml but has no gameplay effect.
      // When a morale system is added, wire it here.
      this.deps.addMessage(`${casterName} casts ${spell.name}... but nothing happens.`);
    } else if (spell.effect.startsWith('debuff_')) {
      this.executeDebuffSpell(cmd, spell, isEnemy);
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
    } else if (spell.effect.startsWith('damage') || spell.effect.startsWith('status_')) {
      this.executeDamageSpell(cmd, spell, casterInt, isEnemy);
    }
  }

  private executeHealSpell(cmd: BattleCommand, spell: SpellData, casterInt: number, isEnemy: boolean): void {
    const power = spell.power ?? 30;
    const targets = spell.targeting === 'all_allies'
      ? (isEnemy ? this.deps.livingEnemies() : this.deps.livingParty())
      : cmd.targetId
        ? (isEnemy ? this.deps.enemies.filter(e => e.id === cmd.targetId) : this.partyFilter(cmd.targetId!))
        : [];

    for (const target of targets) {
      const heal = calculateMagicDamage(
        { intelligence: casterInt },
        { intelligence: 1 },
        { power, isHealing: true },
        this.deps.rng
      );
      if ('currentHp' in target && 'data' in target) {
        // EnemyInstance
        const enemy = target as EnemyInstance;
        enemy.currentHp = Math.min(enemy.data.stats.hp, enemy.currentHp + heal);
        this.deps.addMessage(`${enemy.data.name} recovers ${heal} HP!`);
        this.deps.addDamageEvent({ targetId: enemy.id, damage: heal, isHeal: true, isCrit: false, spellElement: spell.element });
      } else {
        // Character
        const char = target as Character;
        const charId = this.getCharId(char);
        char.currentHp = char.currentHp + heal;
        this.deps.addMessage(`${char.name} recovers ${heal} HP!`);
        if (charId) this.deps.addDamageEvent({ targetId: charId, damage: heal, isHeal: true, isCrit: false, spellElement: spell.element });
      }
    }
  }

  private executeDamageSpell(cmd: BattleCommand, spell: SpellData, casterInt: number, isEnemy: boolean): void {
    const power = spell.power ?? 20;
    const allTargets = spell.targeting === 'all'
      ? (isEnemy ? this.deps.livingParty() : this.deps.livingEnemies())
      : cmd.targetId
        ? (isEnemy ? this.partyFilter(cmd.targetId!) : this.deps.enemies.filter(e => e.id === cmd.targetId))
        : [];

    // Filter by targetFamily if spell is restricted (e.g., HARM only hits undead)
    const targets = spell.targetFamily
      ? allTargets.filter(t => 'data' in t && (t as EnemyInstance).data.family === spell.targetFamily)
      : allTargets;
    if (spell.targetFamily && targets.length === 0) {
      this.deps.addMessage(`${spell.name} has no effect!`);
      return;
    }

    for (const target of targets) {
      if ('data' in target) {
        // EnemyInstance
        const enemy = target as EnemyInstance;
        const damage = calculateMagicDamage(
          { intelligence: casterInt },
          { intelligence: enemy.data.stats.intelligence, weakness: enemy.data.weakness, resist: enemy.data.resist },
          { power, element: spell.element },
          this.deps.rng
        );

        if (spell.effect.startsWith('status_')) {
          const status = spell.effect.replace('status_', '') as StatusEffect;
          enemy.status.apply(status);
          this.deps.addMessage(`${enemy.data.name} is affected by ${status}!`);
        } else {
          enemy.currentHp = Math.max(0, enemy.currentHp - damage);
          this.deps.addMessage(`${enemy.data.name} takes ${damage} damage!`);
          this.deps.addDamageEvent({ targetId: enemy.id, damage, isHeal: false, isCrit: false, spellElement: spell.element });
          if (enemy.currentHp <= 0) {
            this.deps.addMessage(`${enemy.data.name} defeated!`);
          }
        }
      } else {
        // Character
        const char = target as Character;
        const charId = this.getCharId(char);
        const damage = calculateMagicDamage(
          { intelligence: casterInt },
          { intelligence: char.stats.intelligence },
          { power, element: spell.element },
          this.deps.rng
        );
        char.currentHp = char.currentHp - damage;
        this.deps.addMessage(`${char.name} takes ${damage} damage!`);
        if (charId) this.deps.addDamageEvent({ targetId: charId, damage, isHeal: false, isCrit: false, spellElement: spell.element });
        if (char.currentHp <= 0) {
          this.deps.addMessage(`${char.name} fell!`);
        }
      }
    }
  }

  private executeBuffSpell(cmd: BattleCommand, spell: SpellData, isEnemy: boolean): void {
    const info = BUFF_VALUES[spell.effect];
    if (!info) return;

    // Buffs target allies — self or single ally
    const targets = spell.targeting === 'self'
      ? (isEnemy ? [] : this.partyFilter(cmd.actorId, c => c.currentHp > 0))
      : cmd.targetId
        ? (isEnemy
          ? this.deps.enemies.filter(e => e.id === cmd.targetId && e.currentHp > 0)
          : this.partyFilter(cmd.targetId!, c => c.currentHp > 0))
        : (isEnemy ? [] : this.deps.livingParty());

    for (const target of targets) {
      if ('data' in target) {
        const enemy = target as EnemyInstance;
        enemy.buffs.set(info.stat, (enemy.buffs.get(info.stat) ?? 0) + info.amount);
        this.deps.addMessage(`${enemy.data.name}'s ${info.label} increased!`);
      } else {
        const char = target as Character;
        char.applyBuff(info.stat, info.amount);
        this.deps.addMessage(`${char.name}'s ${info.label} increased!`);
      }
    }
  }

  private executeDebuffSpell(cmd: BattleCommand, spell: SpellData, isEnemy: boolean): void {
    const info = DEBUFF_VALUES[spell.effect];
    if (!info) return;

    // Debuffs target enemies
    const targets = spell.targeting === 'all'
      ? (isEnemy ? this.deps.livingParty() : this.deps.livingEnemies())
      : cmd.targetId
        ? (isEnemy ? this.partyFilter(cmd.targetId!) : this.deps.enemies.filter(e => e.id === cmd.targetId))
        : [];

    for (const target of targets) {
      if ('data' in target) {
        const enemy = target as EnemyInstance;
        enemy.buffs.set(info.stat, (enemy.buffs.get(info.stat) ?? 0) + info.amount);
        this.deps.addMessage(`${enemy.data.name}'s ${info.label} decreased!`);
      } else {
        const char = target as Character;
        char.applyBuff(info.stat, info.amount);
        this.deps.addMessage(`${char.name}'s ${info.label} decreased!`);
      }
    }
  }

  private executeCureStatusSpell(cmd: BattleCommand, isEnemy: boolean, status: StatusEffect, successMsg: string): void {
    const targets = cmd.targetId
      ? (isEnemy
        ? this.deps.enemies.filter(e => e.id === cmd.targetId)
        : this.partyFilter(cmd.targetId!))
      : [];

    for (const target of targets) {
      if ('data' in target) {
        const enemy = target as EnemyInstance;
        if (enemy.status.has(status)) {
          enemy.status.remove(status);
          this.deps.addMessage(`${enemy.data.name}'s ${successMsg}!`);
        } else {
          this.deps.addMessage('No effect.');
        }
      } else {
        const char = target as Character;
        if (char.statusTracker.has(status)) {
          char.statusTracker.remove(status);
          this.deps.addMessage(`${char.name}'s ${successMsg}!`);
        } else {
          this.deps.addMessage('No effect.');
        }
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
          enemy.currentHp = 1;
          this.deps.addMessage(`${enemy.data.name} is revived!`);
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
