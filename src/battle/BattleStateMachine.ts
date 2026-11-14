import type { Character } from '../entities/Character.js';
import type { EnemyData, SpellData } from '../types/index.js';
import type { Inventory } from '../entities/Inventory.js';
import type { AIBehavior } from './AIBehavior.js';
import type { BossPattern } from './BossAI.js';
import { StatusTracker } from './StatusEffects.js';
import { sortByAgility, type Combatant } from './TurnOrder.js';
import { selectTarget } from './EnemyAI.js';
import { calculateRunChance, type BattleCommand } from './BattleCommands.js';
import { checkBossPhases, reservedItems, resolveActionTarget, type TargetContext } from './ActionResolution.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { attackLine, resolveEnemyAttack, resolvePartyAttack } from './PhysicalAttack.js';
import { tickStatus } from './StatusTick.js';
import { xpShare } from './Rewards.js';
import { ItemEffects } from '../systems/ItemEffects.js';
import { SpellExecutor } from './SpellExecutor.js';

export type BattleState = 'intro' | 'command_select' | 'execution' | 'resolution' | 'victory' | 'defeat' | 'escaped';

/** How a battle ended; decided only in `BattleStateMachine.finish`. */
export type BattleOutcome = 'victory' | 'defeat' | 'escaped';

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
  /** True when the party ran away (no rewards, no Game Over). */
  escaped?: boolean;
  /** Total XP of the battle (each living member gets `xpPerMember`). */
  xpReward: number;
  /** Each living member's share: `xpShare(xpReward, living)`; 0 unless victorious. */
  xpPerMember: number;
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

/** What one executed action did: its lines, its damage events, and whether a physical attack missed. */
export interface ActionResult {
  done: boolean;
  messages: BattleMessage[];
  damageEvents: DamageEvent[];
  /** True when the action was a fight that missed its target (the battle view shows a grey "Miss"). */
  missed: boolean;
}

export interface NextActionInfo {
  actorId: string;
  actorName: string;
  actionType: string;
  /** The (resolved, living) target's battle id: the view finds its sprite by this, never by name (B2/B6). */
  targetId?: string;
  targetName?: string;
  /** The spell's display name (FIRE), not its id (B3). */
  spellName?: string;
  /** The item's display name (Potion) (B3). */
  itemName?: string;
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
  /** Set by a physical attack that misses during the current action. */
  private _missed = false;
  private _actionQueue: QueuedAction[] = [];
  private currentActorIndex = 0;
  private messages: BattleMessage[] = [];
  private result: BattleResult | null = null;
  private _outcome: BattleOutcome | null = null;
  private rng: () => number;
  private inventory: Inventory | undefined;
  private canRun: boolean;
  private turnNumber = 0;
  private bossPatterns: Map<string, BossPattern>;
  private spellExecutor: SpellExecutor;
  private spells: SpellData[];
  private targets: TargetContext;
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
    this.spells = config.spells ?? [];
    this.targets = {
      partyIds: this.party.map((_, i) => this.getPartyId(i)), livingEnemyIds: () => this.livingEnemies.map(e => e.id),
      isAlive: id => this.isTargetAlive(id), spells: this.spells, rng: this.rng,
    };
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
      this.spells,
    );
  }

  /** Get the unique battle ID for a party member by index */
  getPartyId(index: number): string {
    return `party_${index}`;
  }

  get state(): BattleState { return this._state; }
  get currentMessages(): BattleMessage[] { return this.messages; }
  get battleResult(): BattleResult | null { return this.result; }
  /** Victory, defeat or escape once the battle has ended; null while it is running. */
  get outcome(): BattleOutcome | null { return this._outcome; }
  get isOver(): boolean { return this._outcome !== null; }
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

  /** B5: how many of `itemId` the party's commands this round already use (undo releases them). */
  reservedItems(itemId: string): number { return reservedItems(this.commands, itemId); }

  prepareRound(): void {
    if (this._state !== 'execution') return;
    this.messages = [];
    this.turnNumber++;

    // Check boss phase transitions before generating enemy commands
    for (const enemy of this.livingEnemies) {
      checkBossPhases(enemy, this.bossPatterns, text => this.messages.push({ text }));
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

  executeNextAction(): ActionResult {
    if (this._actionQueue.length === 0 || this.isOver) {
      return { done: true, messages: [], damageEvents: [], missed: false };
    }

    // Skip dead actors — defense-in-depth for animation layer
    if (!this.isNextActorAlive()) {
      this._actionQueue.shift();
      const done = this._actionQueue.length === 0;
      if (done) this._state = 'resolution';
      return { done, messages: [], damageEvents: [], missed: false };
    }

    const action = this._actionQueue[0];
    resolveActionTarget(action, this.targets); // a no-op after the peek
    this._actionQueue.shift();
    this.messages = [];
    this._damageEvents = [];
    this._missed = false;

    // Tick status effects at start of turn
    const canAct = this.tickCombatantStatus(action.combatantId, action.isEnemy);
    if (canAct) {
      this.executeCommand(action.command, action.isEnemy);
    }

    // An escape ends the battle mid-round: never overwrite the end state
    const done = this.isOver || this._actionQueue.length === 0;
    if (done && !this.isOver) {
      this._state = 'resolution';
    }

    return { done, messages: [...this.messages], damageEvents: [...this._damageEvents], missed: this._missed };
  }

  /** The next queued action; `actorId` (party_i / enemy_i) identifies the actor's sprite, never its name. */
  peekNextAction(): NextActionInfo | null {
    if (this._actionQueue.length === 0) return null;
    const action = this._actionQueue[0];
    if (this.isNextActorAlive()) resolveActionTarget(action, this.targets);
    const cmd = action.command;

    let actorName: string;
    if (action.isEnemy) {
      const enemy = this.enemies.find(e => e.id === action.combatantId);
      actorName = enemy?.displayName ?? 'Unknown';
    } else {
      const char = this.getPartyMember(action.combatantId);
      actorName = char?.name ?? 'Unknown';
    }

    const result: NextActionInfo = {
      actorId: action.combatantId,
      actorName,
      actionType: cmd.type,
    };

    if (cmd.targetId) {
      result.targetId = cmd.targetId;
      const targetEnemy = this.enemies.find(e => e.id === cmd.targetId);
      if (targetEnemy) {
        result.targetName = targetEnemy.displayName;
      } else {
        const targetChar = this.getPartyMember(cmd.targetId);
        if (targetChar) result.targetName = targetChar.name;
      }
    }

    if (cmd.spellId) result.spellName = this.spells.find(s => s.id === cmd.spellId)?.name ?? cmd.spellId;
    if (cmd.itemId) result.itemName = ItemRegistry.getItem(cmd.itemId)?.name ?? cmd.itemId;

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
    const say = (text: string) => this.messages.push({ text });
    if (isEnemy) {
      const enemy = this.enemies.find(e => e.id === id);
      if (!enemy) return false;
      return tickStatus({
        name: enemy.displayName, maxHp: enemy.data.stats.hp, tracker: enemy.status, fallText: 'defeated!',
        getHp: () => enemy.currentHp, setHp: (hp) => { enemy.currentHp = hp; },
      }, this.rng, say);
    }
    const char = this.getPartyMember(id);
    if (!char) return false;
    return tickStatus({
      name: char.name, maxHp: char.maxHp, tracker: char.statusTracker, fallText: 'fell!',
      getHp: () => char.currentHp, setHp: (hp) => { char.currentHp = hp; },
    }, this.rng, say);
  }

  private executeCommand(cmd: BattleCommand, isEnemy: boolean): void {
    if (cmd.type === 'run') {
      if (!this.canRun) {
        this.messages.push({ text: 'Cannot escape!' });
        return;
      }
      // FF1: the acting member's luck and level decide (enemies never run)
      const runner = this.getPartyMember(cmd.actorId);
      const chance = runner ? calculateRunChance(runner.stats.luck, runner.level, this.livingEnemies.length) : 0;
      if (this.rng() < chance) {
        this.messages.push({ text: 'Escaped!' });
        this.finish('escaped');
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

    // the target was resolved before the action (resolveActionTarget)
    if (cmd.type === 'fight' && cmd.targetId) {
      if (isEnemy) this.executeEnemyAttack(cmd.actorId, cmd.targetId);
      else this.executePartyAttack(cmd.actorId, cmd.targetId);
    }
  }

  private executePartyAttack(actorId: string, targetId: string): void {
    const actor = this.getPartyMember(actorId);
    const target = this.enemies.find(e => e.id === targetId);
    if (!actor || !target || actor.currentHp <= 0 || target.currentHp <= 0) return;

    const result = resolvePartyAttack(actor, target, this.rng);
    if (!result.hit) {
      this._missed = true;
      this.messages.push({ text: `${actor.name} missed!` });
      return;
    }
    target.currentHp = Math.max(0, target.currentHp - result.damage);
    this.messages.push({ text: attackLine(actor.name, target.displayName, result) });
    this._damageEvents.push({ targetId, damage: result.damage, isHeal: false, isCrit: result.critical });
    if (target.currentHp <= 0) this.messages.push({ text: `${target.displayName} defeated!` });
  }

  private executeEnemyAttack(enemyId: string, targetId: string): void {
    const enemy = this.enemies.find(e => e.id === enemyId);
    const target = this.getPartyMember(targetId);
    if (!enemy || !target || enemy.currentHp <= 0 || target.currentHp <= 0) return;

    const result = resolveEnemyAttack(enemy, target, this.rng);
    if (!result.hit) {
      this._missed = true;
      this.messages.push({ text: `${enemy.displayName} missed!` });
      return;
    }
    target.currentHp = target.currentHp - result.damage;
    this.messages.push({ text: attackLine(enemy.displayName, target.name, result) });
    this._damageEvents.push({ targetId, damage: result.damage, isHeal: false, isCrit: result.critical });
    if (target.currentHp <= 0) this.messages.push({ text: `${target.name} fell!` });
  }

  private isTargetAlive(id: string): boolean {
    const enemy = this.enemies.find(e => e.id === id);
    if (enemy) return enemy.currentHp > 0;
    const char = this.getPartyMember(id);
    return char ? char.currentHp > 0 : false;
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
    // battle lines end in "!" (B4): "W.MAG recovers 30 HP!", "FGHTR is revived!"
    this.messages.push({ text: /[.!?]$/.test(result.message) ? result.message : `${result.message}!` });
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
    if (!this.isOver) this._state = 'resolution';
  }

  resolveRound(): void {
    if (this._state !== 'resolution' || this.isOver) return;

    if (this.livingEnemies.length === 0) {
      this.finish('victory');
    } else if (this.livingParty.length === 0) {
      this.finish('defeat');
    } else {
      this._state = 'command_select';
      this.currentActorIndex = 0;
      this.commands = [];
    }
  }

  /**
   * The one place a battle ends. Sets the outcome, result and end state, empties the action queue and
   * clears battle-only buffs. Victory and defeat replace the message list with their single end line,
   * so the scene never replays the last action's messages.
   */
  private finish(outcome: BattleOutcome): void {
    if (this.isOver) return;
    this._outcome = outcome;
    this._state = outcome;
    this._actionQueue.length = 0;
    if (outcome === 'victory') {
      const xp = this.enemies.reduce((sum, e) => sum + e.data.xpReward, 0);
      const gold = this.enemies.reduce((sum, e) => sum + e.data.goldReward, 0);
      const share = xpShare(xp, this.livingParty.length);
      this.result = { victory: true, xpReward: xp, xpPerMember: share, goldReward: gold };
      this.messages = [{ text: `Victory! ${share} XP each, ${gold} Gold.` }];
    } else {
      this.result = { victory: false, escaped: outcome === 'escaped', xpReward: 0, xpPerMember: 0, goldReward: 0 };
      if (outcome === 'defeat') this.messages = [{ text: 'Game Over...' }];
    }
    for (const char of this.party) char.clearBattleState();
  }
}
