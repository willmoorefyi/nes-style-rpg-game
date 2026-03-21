import type { Character } from '../entities/Character.js';
import type { EnemyData } from '../types/index.js';
import { calculateDamage } from './DamageFormula.js';
import { sortByAgility, type Combatant } from './TurnOrder.js';
import { selectTarget } from './EnemyAI.js';
import { retargetIfDead, calculateRunChance, type BattleCommand } from './BattleCommands.js';

export type BattleState = 'intro' | 'command_select' | 'execution' | 'resolution' | 'victory' | 'defeat';

export interface EnemyInstance {
  id: string;
  data: EnemyData;
  currentHp: number;
}

export interface BattleConfig {
  party: Character[];
  enemies: EnemyData[];
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

  constructor(config: BattleConfig, rng: () => number = Math.random) {
    this.party = config.party;
    this.enemies = config.enemies.map((e, i) => ({
      id: `enemy_${i}`,
      data: e,
      currentHp: e.stats.hp,
    }));
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
      this.executeCommand(cmd, combatant.isEnemy);
    }

    this._state = 'resolution';
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

    if (cmd.type === 'magic') {
      this.messages.push({ text: 'No spells available.' });
      return;
    }

    if (cmd.type === 'item') {
      this.messages.push({ text: 'No items available.' });
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
