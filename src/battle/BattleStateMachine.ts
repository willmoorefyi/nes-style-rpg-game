import type { Character } from '../entities/Character.js';
import type { EnemyData, SpellData } from '../types/index.js';
import type { Inventory } from '../entities/Inventory.js';
import type { AIBehavior } from './AIBehavior.js';
import type { BossPattern } from './BossAI.js';
import { calculateDamage } from './DamageFormula.js';
import { StatusTracker } from './StatusEffects.js';
import { sortByAgility, type Combatant } from './TurnOrder.js';
import { selectTarget } from './EnemyAI.js';
import { retargetIfDead, calculateRunChance, type BattleCommand } from './BattleCommands.js';
import { ItemEffects } from '../systems/ItemEffects.js';
import { SpellExecutor } from './SpellExecutor.js';

export type BattleState = 'intro' | 'command_select' | 'execution' | 'resolution' | 'victory' | 'defeat';

export interface EnemyInstance {
  id: string;
  data: EnemyData;
  currentHp: number;
  status: StatusTracker;
  /** Battle-only buff/debuff tracking (e.g., evade: -20 from LOCK) */
  buffs: Map<string, number>;
  /** Display name with suffix for duplicates (e.g., "Goblin A") — use for messages */
  displayName: string;
  /** Optional AI behavior — if set, used instead of default random targeting */
  aiBehavior?: AIBehavior;
  /** Tracks which boss phase thresholds have been crossed (one-way) */
  crossedPhases?: Set<number>;
}

export interface BattleConfig {
  party: Character[];
  enemies: EnemyData[];
  spells?: SpellData[];
  inventory?: Inventory;
  /** Whether the party can run from this battle (default true) */
  canRun?: boolean;
  /** Map of patternId → BossPattern for multi-phase bosses */
  bossPatterns?: Map<string, BossPattern>;
}

export interface BattleResult {
  victory: boolean;
  xpReward: number;
  goldReward: number;
}

export interface BattleMessage {
  text: string;
}

export interface DamageEvent {
  targetId: string;
  damage: number;
  isHeal: boolean;
  isCrit: boolean;
  spellElement?: string;
}

export interface QueuedAction {
  combatantId: string;
  command: BattleCommand;
  isEnemy: boolean;
}

export class BattleStateMachine {
  private _state: BattleState = 'intro';
  private party: Character[];
  private enemies: EnemyInstance[];
  private commands: BattleCommand[] = [];
  private _damageEvents: DamageEvent[] = [];
  private _actionQueue: QueuedAction[] = [];
  private currentActorIndex = 0;
  private messages: BattleMessage[] = [];
  private result: BattleResult | null = null;
  private rng: () => number;
  private inventory: Inventory | undefined;
  private canRun: boolean;
  private turnNumber = 0;
  private bossPatterns: Map<string, BossPattern>;
  private spellExecutor: SpellExecutor;
  /** Maps unique party IDs (party_0, party_1, ...) to their Character */
  private partyById: Map<string, Character>;

  constructor(config: BattleConfig, rng: () => number = Math.random) {
    this.party = config.party;
    this.partyById = new Map(config.party.map((c, i) => [`party_${i}`, c]));
    // Count occurrences of each enemy name for deduplication
    const nameCounts = new Map<string, number>();
    for (const e of config.enemies) {
      nameCounts.set(e.name, (nameCounts.get(e.name) ?? 0) + 1);
    }
    const nameIndex = new Map<string, number>();
    this.enemies = config.enemies.map((e, i) => {
      const idx = nameIndex.get(e.name) ?? 0;
      nameIndex.set(e.name, idx + 1);
      const suffix = (nameCounts.get(e.name) ?? 1) > 1
        ? ` ${String.fromCharCode(65 + idx)}`  // A, B, C...
        : '';
      return {
        id: `enemy_${i}`,
        data: e,
        currentHp: e.stats.hp,
        status: new StatusTracker(),
        buffs: new Map(),
        displayName: `${e.name}${suffix}`,
        crossedPhases: new Set<number>(),
      };
    });
    this.inventory = config.inventory;
    this.rng = rng;
    this.canRun = config.canRun ?? true;
    this.bossPatterns = config.bossPatterns ?? new Map();
    this.spellExecutor = new SpellExecutor(
      {
        party: this.party,
        enemies: this.enemies,
        rng: this.rng,
        addMessage: (text: string) => this.messages.push({ text }),
        livingParty: () => this.livingParty,
        livingEnemies: () => this.livingEnemies,
        partyById: this.partyById,
        addDamageEvent: (e: DamageEvent) => this._damageEvents.push(e),
      },
      config.spells ?? [],
    );
  }

  /** Get the unique battle ID for a party member by index */
  getPartyId(index: number): string {
    return `party_${index}`;
  }

  get state(): BattleState { return this._state; }
  get currentMessages(): BattleMessage[] { return this.messages; }
  get battleResult(): BattleResult | null { return this.result; }
  get livingParty(): Character[] { return this.party.filter(c => c.currentHp > 0); }
  get allParty(): Character[] { return this.party; }
  get livingEnemies(): EnemyInstance[] { return this.enemies.filter(e => e.currentHp > 0); }
  get allEnemies(): EnemyInstance[] { return this.enemies; }
  get currentCommandActor(): Character | null {
    const living = this.livingParty;
    return living[this.currentActorIndex] ?? null;
  }

  get damageEvents(): DamageEvent[] { return this._damageEvents; }

  clearDamageEvents(): void { this._damageEvents = []; }

  /** Get the unique battle ID for the current command actor */
  get currentCommandActorId(): string | null {
    const actor = this.currentCommandActor;
    if (!actor) return null;
    for (const [id, char] of this.partyById) {
      if (char === actor) return id;
    }
    return null;
  }

  /** Look up a party member by their unique battle ID */
  private getPartyMember(id: string): Character | undefined {
    return this.partyById.get(id);
  }

  /** Get the unique battle ID for a party member Character reference */
  private getIdForPartyMember(char: Character): string | undefined {
    for (const [id, c] of this.partyById) {
      if (c === char) return id;
    }
    return undefined;
  }

  startBattle(): void {
    this._state = 'intro';
    this.messages = [{ text: `${this.enemies.map(e => e.displayName).join(', ')} appeared!` }];
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

  /** Undo the last submitted command, returning to the previous actor. */
  undoCommand(): boolean {
    if (this._state !== 'command_select' || this.commands.length === 0) return false;
    this.commands.pop();
    this.currentActorIndex = Math.max(0, this.currentActorIndex - 1);
    return true;
  }

  get actionQueueLength(): number { return this._actionQueue.length; }

  prepareRound(): void {
    if (this._state !== 'execution') return;
    this.messages = [];
    this.turnNumber++;

    // Check boss phase transitions before generating enemy commands
    for (const enemy of this.livingEnemies) {
      this.checkBossPhaseTransition(enemy);
    }

    // Generate enemy commands using AI behavior or default random targeting
    for (const enemy of this.livingEnemies) {
      if (enemy.aiBehavior) {
        const cmd = enemy.aiBehavior.selectAction(
          enemy, this.party, this.livingEnemies, this.turnNumber, this.rng
        );
        this.commands.push(cmd);
      } else {
        const target = selectTarget(
          this.party.map((c, i) => ({ id: `party_${i}`, isAlive: c.currentHp > 0 })),
          this.rng
        );
        if (target) {
          this.commands.push({ type: 'fight', actorId: enemy.id, targetId: target.id });
        }
      }
    }

    // Build combatant list for turn order
    const combatants: Combatant[] = [
      ...this.livingParty.map(c => ({ id: this.getIdForPartyMember(c)!, agility: c.stats.agility, isEnemy: false })),
      ...this.livingEnemies.map(e => ({ id: e.id, agility: e.data.stats.agility, isEnemy: true })),
    ];
    const turnOrder = sortByAgility(combatants, this.rng);

    // Build action queue from sorted combatants
    this._actionQueue = [];
    for (const combatant of turnOrder) {
      const cmd = this.commands.find(c => c.actorId === combatant.id);
      if (!cmd) continue;
      this._actionQueue.push({ combatantId: combatant.id, command: cmd, isEnemy: combatant.isEnemy });
    }

    this._state = 'execution';
  }

  /** Check if the next actor in the action queue is still alive */
  isNextActorAlive(): boolean {
    if (this._actionQueue.length === 0) return false;
    const action = this._actionQueue[0];
    if (action.isEnemy) {
      const enemy = this.enemies.find(e => e.id === action.combatantId);
      return !!enemy && enemy.currentHp > 0;
    }
    const member = this.getPartyMember(action.combatantId);
    return !!member && member.currentHp > 0;
  }

  executeNextAction(): { done: boolean; messages: BattleMessage[]; damageEvents: DamageEvent[] } {
    if (this._actionQueue.length === 0) {
      return { done: true, messages: [], damageEvents: [] };
    }

    // Skip dead actors — defense-in-depth for animation layer
    if (!this.isNextActorAlive()) {
      this._actionQueue.shift();
      const done = this._actionQueue.length === 0;
      if (done) this._state = 'resolution';
      return { done, messages: [], damageEvents: [] };
    }

    const action = this._actionQueue.shift()!;
    this.messages = [];
    this._damageEvents = [];

    // Tick status effects at start of turn
    const canAct = this.tickCombatantStatus(action.combatantId, action.isEnemy);
    if (canAct) {
      this.executeCommand(action.command, action.isEnemy);
    }

    const done = this._actionQueue.length === 0;
    if (done) {
      this._state = 'resolution';
    }

    return { done, messages: [...this.messages], damageEvents: [...this._damageEvents] };
  }

  peekNextAction(): { actorName: string; actionType: string; targetName?: string; spellName?: string } | null {
    if (this._actionQueue.length === 0) return null;
    const action = this._actionQueue[0];
    const cmd = action.command;

    let actorName: string;
    if (action.isEnemy) {
      const enemy = this.enemies.find(e => e.id === action.combatantId);
      actorName = enemy?.displayName ?? 'Unknown';
    } else {
      const char = this.getPartyMember(action.combatantId);
      actorName = char?.name ?? 'Unknown';
    }

    const result: { actorName: string; actionType: string; targetName?: string; spellName?: string } = {
      actorName,
      actionType: cmd.type,
    };

    if (cmd.targetId) {
      const targetEnemy = this.enemies.find(e => e.id === cmd.targetId);
      if (targetEnemy) {
        result.targetName = targetEnemy.displayName;
      } else {
        const targetChar = this.getPartyMember(cmd.targetId);
        if (targetChar) result.targetName = targetChar.name;
      }
    }

    if (cmd.spellId) {
      result.spellName = cmd.spellId;
    }

    return result;
  }

  executeRound(): void {
    if (this._state !== 'execution') return;
    this.prepareRound();
    // Capture any phase transition messages from prepareRound
    const allMessages: BattleMessage[] = [...this.messages];
    const allDamageEvents: DamageEvent[] = [];
    while (this._actionQueue.length > 0) {
      const result = this.executeNextAction();
      allMessages.push(...result.messages);
      allDamageEvents.push(...result.damageEvents);
    }
    this.messages = allMessages;
    this._damageEvents = allDamageEvents;
  }

  private tickCombatantStatus(id: string, isEnemy: boolean): boolean {
    if (isEnemy) {
      const enemy = this.enemies.find(e => e.id === id);
      if (!enemy || enemy.currentHp <= 0) return false;
      const result = enemy.status.tick(enemy.data.stats.hp);
      if (result.damage > 0) {
        enemy.currentHp = Math.max(0, enemy.currentHp - result.damage);
        this.messages.push({ text: `${enemy.displayName} takes ${result.damage} poison damage!` });
        if (enemy.currentHp <= 0) {
          this.messages.push({ text: `${enemy.displayName} defeated!` });
          return false;
        }
      }
      if (result.skipTurn) {
        const status = enemy.status.has('sleep') ? 'asleep' : 'stunned';
        this.messages.push({ text: `${enemy.displayName} is ${status}!` });
        return false;
      }
      if (enemy.status.has('fear') && this.rng() < 0.5) {
        this.messages.push({ text: `${enemy.displayName} is trembling with fear!` });
        return false;
      }
      return true;
    } else {
      const char = this.getPartyMember(id);
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
      if (char.statusTracker.has('fear') && this.rng() < 0.5) {
        this.messages.push({ text: `${char.name} is trembling with fear!` });
        return false;
      }
      return true;
    }
  }

  private executeCommand(cmd: BattleCommand, isEnemy: boolean): void {
    if (cmd.type === 'run') {
      if (!this.canRun) {
        this.messages.push({ text: 'Cannot escape!' });
        return;
      }
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
      this.spellExecutor.execute(cmd, isEnemy);
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
      const getLivingTargets = isEnemy
        ? () => this.livingParty.map(c => this.getIdForPartyMember(c)!).filter(Boolean)
        : () => this.livingEnemies.map(e => e.id);
      const retargeted = retargetIfDead(
        cmd,
        id => this.isTargetAlive(id),
        getLivingTargets,
        this.rng
      );

      if (isEnemy) {
        this.executeEnemyAttack(cmd.actorId, retargeted.targetId!);
      } else {
        this.executePartyAttack(cmd.actorId, retargeted.targetId!);
      }
    }
  }

  private executePartyAttack(actorId: string, targetId: string): void {
    const actor = this.getPartyMember(actorId);
    const target = this.enemies.find(e => e.id === targetId);
    if (!actor || !target || actor.currentHp <= 0 || target.currentHp <= 0) return;

    const result = calculateDamage(
      { attack: actor.stats.attack, level: actor.level },
      { defense: target.data.stats.defense },
      this.rng
    );

    // Bonus damage vs enemy family (e.g., Silver Sword vs undead)
    const weapon = actor.getEquipped('weapon');
    if (result.hit && weapon?.bonusVsFamily && weapon.bonusVsFamily === target.data.family) {
      result.damage = Math.floor(result.damage * 1.5);
    }

    if (!result.hit) {
      this.messages.push({ text: `${actor.name} missed!` });
    } else {
      target.currentHp = Math.max(0, target.currentHp - result.damage);
      const crit = result.critical ? ' Critical!' : '';
      this.messages.push({ text: `${actor.name} hits ${target.displayName} for ${result.damage}!${crit}` });
      this._damageEvents.push({ targetId, damage: result.damage, isHeal: false, isCrit: result.critical });
      if (target.currentHp <= 0) {
        this.messages.push({ text: `${target.displayName} defeated!` });
      }
    }
  }

  private executeEnemyAttack(enemyId: string, targetId: string): void {
    const enemy = this.enemies.find(e => e.id === enemyId);
    const target = this.getPartyMember(targetId);
    if (!enemy || !target || enemy.currentHp <= 0 || target.currentHp <= 0) return;

    const result = calculateDamage(
      { attack: enemy.data.stats.attack, level: 1 },
      { defense: target.stats.defense },
      this.rng
    );

    if (!result.hit) {
      this.messages.push({ text: `${enemy.displayName} missed!` });
    } else {
      target.currentHp = target.currentHp - result.damage;
      const crit = result.critical ? ' Critical!' : '';
      this.messages.push({ text: `${enemy.displayName} hits ${target.name} for ${result.damage}!${crit}` });
      this._damageEvents.push({ targetId, damage: result.damage, isHeal: false, isCrit: result.critical });
      if (target.currentHp <= 0) {
        this.messages.push({ text: `${target.name} fell!` });
      }
    }
  }

  private isTargetAlive(id: string): boolean {
    const enemy = this.enemies.find(e => e.id === id);
    if (enemy) return enemy.currentHp > 0;
    const char = this.getPartyMember(id);
    return char ? char.currentHp > 0 : false;
  }

  private avgAgility(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private executeItemCommand(cmd: BattleCommand): void {
    if (!cmd.itemId || !cmd.targetId || !this.inventory) {
      this.messages.push({ text: 'Cannot use item.' });
      return;
    }
    const target = this.getPartyMember(cmd.targetId);
    if (!target) {
      this.messages.push({ text: 'Invalid target.' });
      return;
    }
    const result = ItemEffects.applyItemEffect(cmd.itemId, target, this.inventory);
    this.messages.push({ text: result.message });
  }

  /** Check if an enemy has crossed a boss phase HP threshold and switch pattern */
  private checkBossPhaseTransition(enemy: EnemyInstance): void {
    const phases = enemy.data.bossPhases;
    if (!phases || !enemy.aiBehavior) return;

    const hpPercent = enemy.currentHp / enemy.data.stats.hp;
    for (let i = 0; i < phases.length; i++) {
      if (enemy.crossedPhases?.has(i)) continue;
      if (hpPercent <= phases[i].hpThreshold) {
        enemy.crossedPhases?.add(i);
        // Switch AI pattern if available
        const newPattern = this.bossPatterns.get(phases[i].patternId);
        if (newPattern && 'setPattern' in enemy.aiBehavior) {
          (enemy.aiBehavior as { setPattern(p: BossPattern): void }).setPattern(newPattern);
        }
        if (phases[i].message) {
          this.messages.push({ text: phases[i].message! });
        }
      }
    }
  }

  /** Set AI behavior for a specific enemy (used to attach BossAI after construction) */
  setEnemyAI(enemyIndex: number, ai: AIBehavior): void {
    if (this.enemies[enemyIndex]) {
      this.enemies[enemyIndex].aiBehavior = ai;
    }
  }

  /** Whether the party can run from this battle */
  getCanRun(): boolean {
    return this.canRun;
  }

  skipRemainingActions(): void {
    this._actionQueue.length = 0;
    this._state = 'resolution';
  }

  resolveRound(): void {
    if (this._state !== 'resolution') return;

    if (this.livingEnemies.length === 0) {
      const xp = this.enemies.reduce((sum, e) => sum + e.data.xpReward, 0);
      const gold = this.enemies.reduce((sum, e) => sum + e.data.goldReward, 0);
      this.result = { victory: true, xpReward: xp, goldReward: gold };
      this._state = 'victory';
      this.messages.push({ text: `Victory! Gained ${xp} XP and ${gold} Gold.` });
      // Clear battle-only buffs/resists from party members
      for (const char of this.party) char.clearBattleState();
    } else if (this.livingParty.length === 0) {
      this.result = { victory: false, xpReward: 0, goldReward: 0 };
      this._state = 'defeat';
      this.messages.push({ text: 'Game Over...' });
      for (const char of this.party) char.clearBattleState();
    } else {
      this._state = 'command_select';
      this.currentActorIndex = 0;
      this.commands = [];
    }
  }
}
