import type { Character } from '../entities/Character.js';
import type { EnemyData, SpellData } from '../types/index.js';
import type { Inventory } from '../entities/Inventory.js';
import { calculateDamage, calculateMagicDamage } from './DamageFormula.js';
import { StatusTracker } from './StatusEffects.js';
import { sortByAgility, type Combatant } from './TurnOrder.js';
import { selectTarget } from './EnemyAI.js';
import { retargetIfDead, calculateRunChance, type BattleCommand } from './BattleCommands.js';
import { ItemEffects } from '../systems/ItemEffects.js';

export type BattleState = 'intro' | 'command_select' | 'execution' | 'resolution' | 'victory' | 'defeat';

export interface EnemyInstance {
  id: string;
  data: EnemyData;
  currentHp: number;
  status: StatusTracker;
}

export interface BattleConfig {
  party: Character[];
  enemies: EnemyData[];
  spells?: SpellData[];
  inventory?: Inventory;
}

export interface BattleResult {
  victory: boolean;
  xpReward: number;
  goldReward: number;
}

export interface BattleMessage {
  text: string;
}

export class BattleStateMachine {
  private _state: BattleState = 'intro';
  private party: Character[];
  private enemies: EnemyInstance[];
  private commands: BattleCommand[] = [];
  private currentActorIndex = 0;
  private messages: BattleMessage[] = [];
  private result: BattleResult | null = null;
  private rng: () => number;
  private spells: SpellData[];
  private inventory: Inventory | undefined;

  constructor(config: BattleConfig, rng: () => number = Math.random) {
    this.party = config.party;
    this.enemies = config.enemies.map((e, i) => ({
      id: `enemy_${i}`,
      data: e,
      currentHp: e.stats.hp,
      status: new StatusTracker(),
    }));
    this.spells = config.spells ?? [];
    this.inventory = config.inventory;
    this.rng = rng;
  }

  get state(): BattleState { return this._state; }
  get currentMessages(): BattleMessage[] { return this.messages; }
  get battleResult(): BattleResult | null { return this.result; }
  get livingParty(): Character[] { return this.party.filter(c => c.currentHp > 0); }
  get livingEnemies(): EnemyInstance[] { return this.enemies.filter(e => e.currentHp > 0); }
  get allEnemies(): EnemyInstance[] { return this.enemies; }
  get currentCommandActor(): Character | null {
    const living = this.livingParty;
    return living[this.currentActorIndex] ?? null;
  }

  startBattle(): void {
    this._state = 'intro';
    this.messages = [{ text: `${this.enemies.map(e => e.data.name).join(', ')} appeared!` }];
  }

  advanceFromIntro(): void {
    if (this._state !== 'intro') return;
    this._state = 'command_select';
    this.currentActorIndex = 0;
    this.commands = [];
    this.messages = [];
  }

  submitCommand(command: BattleCommand): boolean {
    if (this._state !== 'command_select') return false;
    this.commands.push(command);
    this.currentActorIndex++;
    if (this.currentActorIndex >= this.livingParty.length) {
      this._state = 'execution';
    }
    return true;
  }

  executeRound(): void {
    if (this._state !== 'execution') return;
    this.messages = [];

    // Generate enemy commands
    for (const enemy of this.livingEnemies) {
      const target = selectTarget(
        this.party.map(c => ({ id: c.name, isAlive: c.currentHp > 0 })),
        this.rng
      );
      if (target) {
        this.commands.push({ type: 'fight', actorId: enemy.id, targetId: target.id });
      }
    }

    // Build combatant list for turn order
    const combatants: Combatant[] = [
      ...this.livingParty.map(c => ({ id: c.name, agility: c.stats.agility, isEnemy: false })),
      ...this.livingEnemies.map(e => ({ id: e.id, agility: e.data.stats.agility, isEnemy: true })),
    ];
    const turnOrder = sortByAgility(combatants, this.rng);

    // Execute in turn order
    for (const combatant of turnOrder) {
      const cmd = this.commands.find(c => c.actorId === combatant.id);
      if (!cmd) continue;
      
      // Tick status effects at start of turn
      const canAct = this.tickCombatantStatus(combatant.id, combatant.isEnemy);
      if (!canAct) continue;
      
      this.executeCommand(cmd, combatant.isEnemy);
    }

    this._state = 'resolution';
  }

  private tickCombatantStatus(id: string, isEnemy: boolean): boolean {
    if (isEnemy) {
      const enemy = this.enemies.find(e => e.id === id);
      if (!enemy || enemy.currentHp <= 0) return false;
      const result = enemy.status.tick(enemy.data.stats.hp);
      if (result.damage > 0) {
        enemy.currentHp = Math.max(0, enemy.currentHp - result.damage);
        this.messages.push({ text: `${enemy.data.name} takes ${result.damage} poison damage!` });
        if (enemy.currentHp <= 0) {
          this.messages.push({ text: `${enemy.data.name} defeated!` });
          return false;
        }
      }
      if (result.skipTurn) {
        const status = enemy.status.has('sleep') ? 'asleep' : 'stunned';
        this.messages.push({ text: `${enemy.data.name} is ${status}!` });
        return false;
      }
      return true;
    } else {
      const char = this.party.find(c => c.name === id);
      if (!char || char.currentHp <= 0) return false;
      const result = char.statusTracker.tick(char.maxHp);
      if (result.damage > 0) {
        char.currentHp = char.currentHp - result.damage;
        this.messages.push({ text: `${char.name} takes ${result.damage} poison damage!` });
        if (char.currentHp <= 0) {
          this.messages.push({ text: `${char.name} fell!` });
          return false;
        }
      }
      if (result.skipTurn) {
        const status = char.statusTracker.has('sleep') ? 'asleep' : 'stunned';
        this.messages.push({ text: `${char.name} is ${status}!` });
        return false;
      }
      return true;
    }
  }

  private executeCommand(cmd: BattleCommand, isEnemy: boolean): void {
    if (cmd.type === 'run') {
      const partyAgi = this.avgAgility(this.livingParty.map(c => c.stats.agility));
      const enemyAgi = this.avgAgility(this.livingEnemies.map(e => e.data.stats.agility));
      const chance = calculateRunChance(partyAgi, enemyAgi);
      if (this.rng() * 100 < chance) {
        this.messages.push({ text: 'Escaped!' });
        this.result = { victory: false, xpReward: 0, goldReward: 0 };
        this._state = 'defeat';
      } else {
        this.messages.push({ text: 'Cannot escape!' });
      }
      return;
    }

    if (cmd.type === 'magic' && cmd.spellId) {
      this.executeMagicCommand(cmd, isEnemy);
      return;
    }

    if (cmd.type === 'magic') {
      this.messages.push({ text: 'No spell selected.' });
      return;
    }

    if (cmd.type === 'item') {
      this.executeItemCommand(cmd);
      return;
    }

    if (cmd.type === 'fight' && cmd.targetId) {
      const retargeted = retargetIfDead(
        cmd,
        id => this.isTargetAlive(id),
        () => this.livingEnemies.map(e => e.id),
        this.rng
      );

      if (isEnemy) {
        this.executeEnemyAttack(cmd.actorId, retargeted.targetId!);
      } else {
        this.executePartyAttack(cmd.actorId, retargeted.targetId!);
      }
    }
  }

  private executePartyAttack(actorName: string, targetId: string): void {
    const actor = this.party.find(c => c.name === actorName);
    const target = this.enemies.find(e => e.id === targetId);
    if (!actor || !target || actor.currentHp <= 0 || target.currentHp <= 0) return;

    const result = calculateDamage(
      { attack: actor.stats.attack, level: actor.level },
      { defense: target.data.stats.defense },
      this.rng
    );

    if (!result.hit) {
      this.messages.push({ text: `${actor.name} missed!` });
    } else {
      target.currentHp = Math.max(0, target.currentHp - result.damage);
      const crit = result.critical ? ' Critical!' : '';
      this.messages.push({ text: `${actor.name} hits ${target.data.name} for ${result.damage}!${crit}` });
      if (target.currentHp <= 0) {
        this.messages.push({ text: `${target.data.name} defeated!` });
      }
    }
  }

  private executeEnemyAttack(enemyId: string, targetName: string): void {
    const enemy = this.enemies.find(e => e.id === enemyId);
    const target = this.party.find(c => c.name === targetName);
    if (!enemy || !target || enemy.currentHp <= 0 || target.currentHp <= 0) return;

    const result = calculateDamage(
      { attack: enemy.data.stats.attack, level: 1 },
      { defense: target.stats.defense },
      this.rng
    );

    if (!result.hit) {
      this.messages.push({ text: `${enemy.data.name} missed!` });
    } else {
      target.currentHp = target.currentHp - result.damage;
      const crit = result.critical ? ' Critical!' : '';
      this.messages.push({ text: `${enemy.data.name} hits ${target.name} for ${result.damage}!${crit}` });
      if (target.currentHp <= 0) {
        this.messages.push({ text: `${target.name} fell!` });
      }
    }
  }

  private isTargetAlive(id: string): boolean {
    const enemy = this.enemies.find(e => e.id === id);
    if (enemy) return enemy.currentHp > 0;
    const char = this.party.find(c => c.name === id);
    return char ? char.currentHp > 0 : false;
  }

  private avgAgility(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private executeMagicCommand(cmd: BattleCommand, isEnemy: boolean): void {
    const spell = this.spells.find(s => s.id === cmd.spellId);
    if (!spell) {
      this.messages.push({ text: 'Unknown spell!' });
      return;
    }

    // Get caster
    const caster = isEnemy
      ? this.enemies.find(e => e.id === cmd.actorId)
      : this.party.find(c => c.name === cmd.actorId);
    if (!caster) return;

    // For party members, check charges and silence
    if (!isEnemy) {
      const char = caster as Character;
      if (!char.hasCharges(spell.level)) {
        this.messages.push({ text: `${char.name} has no charges!` });
        return;
      }
      // Note: silence check would go here if we add StatusTracker to Character
      char.useCharge(spell.level);
    }

    const casterName = isEnemy ? (caster as EnemyInstance).data.name : (caster as Character).name;
    const casterInt = isEnemy
      ? (caster as EnemyInstance).data.stats.intelligence
      : (caster as Character).stats.intelligence;

    this.messages.push({ text: `${casterName} casts ${spell.name}!` });

    // Handle different spell effects
    if (spell.effect === 'heal') {
      this.executeHealSpell(cmd, spell, casterInt, isEnemy);
    } else if (spell.effect.startsWith('damage') || spell.effect.startsWith('status_')) {
      this.executeDamageSpell(cmd, spell, casterInt, isEnemy);
    }
  }

  private executeHealSpell(cmd: BattleCommand, spell: SpellData, casterInt: number, isEnemy: boolean): void {
    const power = spell.power ?? 30;
    const targets = spell.targeting === 'all'
      ? (isEnemy ? this.livingEnemies : this.livingParty)
      : cmd.targetId
        ? (isEnemy ? this.enemies.filter(e => e.id === cmd.targetId) : this.party.filter(c => c.name === cmd.targetId))
        : [];

    for (const target of targets) {
      const heal = calculateMagicDamage(
        { intelligence: casterInt },
        { intelligence: 1 },
        { power, isHealing: true },
        this.rng
      );
      if ('currentHp' in target && 'data' in target) {
        // EnemyInstance
        const enemy = target as EnemyInstance;
        enemy.currentHp = Math.min(enemy.data.stats.hp, enemy.currentHp + heal);
        this.messages.push({ text: `${enemy.data.name} recovers ${heal} HP!` });
      } else {
        // Character
        const char = target as Character;
        char.currentHp = char.currentHp + heal;
        this.messages.push({ text: `${char.name} recovers ${heal} HP!` });
      }
    }
  }

  private executeDamageSpell(cmd: BattleCommand, spell: SpellData, casterInt: number, isEnemy: boolean): void {
    const power = spell.power ?? 20;
    const targets = spell.targeting === 'all'
      ? (isEnemy ? this.livingParty : this.livingEnemies)
      : cmd.targetId
        ? (isEnemy ? this.party.filter(c => c.name === cmd.targetId) : this.enemies.filter(e => e.id === cmd.targetId))
        : [];

    for (const target of targets) {
      if ('data' in target) {
        // EnemyInstance
        const enemy = target as EnemyInstance;
        const damage = calculateMagicDamage(
          { intelligence: casterInt },
          { intelligence: enemy.data.stats.intelligence, weakness: enemy.data.weakness, resist: enemy.data.resist },
          { power, element: spell.element },
          this.rng
        );

        if (spell.effect.startsWith('status_')) {
          const status = spell.effect.replace('status_', '') as 'sleep' | 'poison' | 'stun';
          enemy.status.apply(status);
          this.messages.push({ text: `${enemy.data.name} is affected by ${status}!` });
        } else {
          enemy.currentHp = Math.max(0, enemy.currentHp - damage);
          this.messages.push({ text: `${enemy.data.name} takes ${damage} damage!` });
          if (enemy.currentHp <= 0) {
            this.messages.push({ text: `${enemy.data.name} defeated!` });
          }
        }
      } else {
        // Character
        const char = target as Character;
        const damage = calculateMagicDamage(
          { intelligence: casterInt },
          { intelligence: char.stats.intelligence },
          { power, element: spell.element },
          this.rng
        );
        char.currentHp = char.currentHp - damage;
        this.messages.push({ text: `${char.name} takes ${damage} damage!` });
        if (char.currentHp <= 0) {
          this.messages.push({ text: `${char.name} fell!` });
        }
      }
    }
  }

  private executeItemCommand(cmd: BattleCommand): void {
    if (!cmd.itemId || !cmd.targetId || !this.inventory) {
      this.messages.push({ text: 'Cannot use item.' });
      return;
    }
    const target = this.party.find(c => c.name === cmd.targetId);
    if (!target) {
      this.messages.push({ text: 'Invalid target.' });
      return;
    }
    const result = ItemEffects.applyItemEffect(cmd.itemId, target, this.inventory);
    this.messages.push({ text: result.message });
  }

  resolveRound(): void {
    if (this._state !== 'resolution') return;

    if (this.livingEnemies.length === 0) {
      const xp = this.enemies.reduce((sum, e) => sum + e.data.xpReward, 0);
      const gold = this.enemies.reduce((sum, e) => sum + e.data.goldReward, 0);
      this.result = { victory: true, xpReward: xp, goldReward: gold };
      this._state = 'victory';
      this.messages.push({ text: `Victory! Gained ${xp} XP and ${gold} Gold.` });
    } else if (this.livingParty.length === 0) {
      this.result = { victory: false, xpReward: 0, goldReward: 0 };
      this._state = 'defeat';
      this.messages.push({ text: 'Game Over...' });
    } else {
      this._state = 'command_select';
      this.currentActorIndex = 0;
      this.commands = [];
    }
  }
}
