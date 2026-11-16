import type { Character } from '../entities/Character.js';
import type { EnemyData, SpellData } from '../types/index.js';
import type { Inventory } from '../entities/Inventory.js';
import type { AIBehavior } from './AIBehavior.js';
import type { BossPattern } from './BossAI.js';
import type { StatusTracker } from './StatusEffects.js';
import { makeEnemyInstances } from './enemyInstances.js';
import { sortByAgility, type Combatant } from './TurnOrder.js';
import { selectTarget } from './EnemyAI.js';
import { calculateRunChance, type BattleCommand } from './BattleCommands.js';
import { checkBossPhases, reservedItems, resolveActionTarget, type TargetContext } from './ActionResolution.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { executeFight, type PhysicalHitDeps } from './physicalHit.js';
import { resolvePendingForms, type FormChangeResult, type FormContext, type FormState } from './bossForms.js';
import { setEnemyHp } from './enemyHp.js';
import { losesTurn, type PresentHold, type TickSubject } from './StatusTick.js';
import { runTurn } from './turnTick.js';
import { xpShare } from './Rewards.js';
import { ItemEffects } from '../systems/ItemEffects.js';
import { SpellExecutor } from './SpellExecutor.js';

export type BattleState = 'intro' | 'command_select' | 'execution' | 'resolution' | 'victory' | 'defeat' | 'escaped';

/** How a battle ended; decided only in `BattleStateMachine.finish`. */
export type BattleOutcome = 'victory' | 'defeat' | 'escaped';

export interface EnemyInstance extends FormState {
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
  /** The form records the enemies can change into (CHAOS_FORMS_PLAN 2.2; `formChain`). */
  forms?: EnemyData[];
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
  /** The spell or item the action used (ids; the battle view picks its effect by these, never by message text). */
  spellId?: string; itemId?: string;
  /** Re-test A, D: changes the view shows only once their line is up (a wake, end-of-turn poison). */
  holds?: PresentHold[];
  /** A boss form change right after this action (CHAOS_FORMS_PLAN 2.2 item 3): the view plays its interlude. */
  formChange?: FormChangeResult;
}

export interface NextActionInfo {
  actorId: string;
  actorName: string;
  actionType: string;
  /** The (resolved, living) target's battle id: the view finds its sprite by this, never by name (B2/B6). */
  targetId?: string;
  targetName?: string;
  /** The spell's display name (FIRE), not its id (B3); `spellId` / `itemId` are the ids. */
  spellName?: string; spellId?: string; itemId?: string;
  /** The item's display name (Potion) (B3). */
  itemName?: string;
  /** U15: a spell that hits every enemy (the turn list reads `>All`). */
  allTargets?: boolean;
  /** A magic action whose caster is silenced: the view announces an attempt, not a cast (the spell fizzles, B8). */
  silenced?: boolean;
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
  private hitDeps: PhysicalHitDeps;
  private formCtx: FormContext;
  /** Maps unique party IDs (party_0, party_1, ...) to their Character */
  private partyById: Map<string, Character>;

  constructor(config: BattleConfig, rng: () => number = Math.random) {
    this.party = config.party;
    this.partyById = new Map(config.party.map((c, i) => [`party_${i}`, c]));
    this.enemies = makeEnemyInstances(config.enemies);
    this.inventory = config.inventory;
    this.rng = rng;
    this.canRun = config.canRun ?? true;
    this.bossPatterns = config.bossPatterns ?? new Map();
    this.spells = config.spells ?? [];
    this.targets = {
      partyIds: this.party.map((_, i) => this.getPartyId(i)), livingEnemyIds: () => this.livingEnemies.map(e => e.id),
      isAlive: id => this.isTargetAlive(id), spells: this.spells, rng: this.rng,
    };
    this.hitDeps = {
      rng: this.rng, enemies: this.enemies, partyMember: id => this.getPartyMember(id), say: text => this.messages.push({ text }),
      damage: e => this._damageEvents.push(e), missed: () => { this._missed = true; }, partyIds: this.targets.partyIds,
    };
    this.formCtx = { forms: new Map((config.forms ?? []).map(f => [f.id, f])), spells: this.spells, party: this.party,
      enemies: this.enemies, queue: () => this._actionQueue, turn: () => this.turnNumber, rng: this.rng };
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
    this.skipHelplessMembers();
  }

  submitCommand(command: BattleCommand): boolean {
    if (this._state !== 'command_select') return false;
    this.commands.push(command);
    this.currentActorIndex++;
    if (this.currentActorIndex >= this.livingParty.length) this._state = 'execution';
    else if (!command.skip) this.skipHelplessMembers();
    return true;
  }

  /**
   * Play-test item 3: a member whose turn is certain to be lost (sleep, stun, stone: `losesTurn`; poison hurts after the action, so it never costs the turn) gets
   * no command menu. A `skip` command keeps their place in the turn order, where the tick shows "X is asleep!".
   */
  private skipHelplessMembers(): void {
    for (let id = this.currentCommandActorId; id && this._state === 'command_select'; id = this.currentCommandActorId) {
      const subject = this.tickSubject(id, false);
      if (!subject || !losesTurn(subject)) return;
      this.submitCommand({ type: 'fight', actorId: id, skip: true });
    }
  }

  /** Undo the last command chosen in the menu (and the skipped members after it), returning to its actor. */
  undoCommand(): boolean {
    if (this._state !== 'command_select') return false;
    let n = this.commands.length;
    while (n > 0 && this.commands[n - 1].skip) n--;
    if (n === 0) return false;
    this.commands.length = n - 1;
    this.currentActorIndex = n - 1;
    return true;
  }

  get actionQueueLength(): number { return this._actionQueue.length; }

  /** B5: how many of `itemId` the party's commands this round already use (undo releases them). */
  reservedItems(itemId: string): number { return reservedItems(this.commands, itemId); }

  prepareRound(): void {
    if (this._state !== 'execution') return;
    this.messages = [];
    this.turnNumber++;

    // Check boss phase transitions before generating enemy commands (a reached form floor first: R5)
    resolvePendingForms(this.formCtx, text => this.messages.push({ text }));
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

  /** E1: the next actor's start-of-turn tick is certain to end its turn (sleep, stun, stone). Pure. */
  nextActorLosesTurn(): boolean {
    const action = this._actionQueue[0];
    const subject = action && this.isNextActorAlive() ? this.tickSubject(action.combatantId, action.isEnemy) : null;
    return !!subject && (losesTurn(subject) || !!action.command.skip);
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

    // Re-test A: the start-of-turn tick may cost the turn; the action runs; poison hurts at the end of the turn
    const subject = this.tickSubject(action.combatantId, action.isEnemy);
    const holds = !subject ? [] : runTurn(subject, action.combatantId, this.rng, {
      say: (text) => { const line = { text }; this.messages.push(line); return line; },
      act: () => { if (!action.command.skip) this.executeCommand(action.command, action.isEnemy); },
      decided: () => this.isOver || this.livingEnemies.length === 0 || this.livingParty.length === 0,
    });
    // CHAOS_FORMS_PLAN 2.2 item 3 (R8): a form floor reached by this action (hero, boss or poison) changes the form now
    const formChange = resolvePendingForms(this.formCtx, text => this.messages.push({ text }));

    // An escape ends the battle mid-round: never overwrite the end state
    const done = this.isOver || this._actionQueue.length === 0;
    if (done && !this.isOver) {
      this._state = 'resolution';
    }

    const { spellId, itemId } = action.command;
    return { done, messages: [...this.messages], damageEvents: [...this._damageEvents], missed: this._missed, holds, ...(spellId ? { spellId } : {}), ...(itemId ? { itemId } : {}), ...(formChange ? { formChange } : {}) };
  }

  /** The next queued action; `actorId` (party_i / enemy_i) identifies the actor's sprite, never its name. */
  peekNextAction(): NextActionInfo | null {
    if (this._actionQueue.length === 0) return null;
    const action = this._actionQueue[0];
    if (this.isNextActorAlive()) resolveActionTarget(action, this.targets);
    const cmd = action.command;

    let actorName: string;
    let silenced = false;
    if (action.isEnemy) {
      const enemy = this.enemies.find(e => e.id === action.combatantId);
      actorName = enemy?.displayName ?? 'Unknown';
      silenced = enemy?.status.has('silence') ?? false;
    } else {
      const char = this.getPartyMember(action.combatantId);
      actorName = char?.name ?? 'Unknown';
      silenced = char?.statusTracker.has('silence') ?? false;
    }

    const result: NextActionInfo = {
      actorId: action.combatantId,
      actorName,
      actionType: cmd.skip ? 'skip' : cmd.type,
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

    const spell = cmd.spellId ? this.spells.find(s => s.id === cmd.spellId) : undefined;
    if (cmd.spellId) Object.assign(result, { spellId: cmd.spellId, spellName: spell?.name ?? cmd.spellId });
    if (spell?.targeting === 'all') result.allTargets = true;
    if (cmd.type === 'magic' && silenced) result.silenced = true;
    if (cmd.itemId) Object.assign(result, { itemId: cmd.itemId, itemName: ItemRegistry.getItem(cmd.itemId)?.name ?? cmd.itemId });

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

  /** The combatant as the status tick sees it (an enemy's max HP is its data's, a member's its character's). */
  private tickSubject(id: string, isEnemy: boolean): TickSubject | null {
    if (isEnemy) {
      const enemy = this.enemies.find(e => e.id === id);
      return enemy ? { name: enemy.displayName, maxHp: enemy.data.stats.hp, tracker: enemy.status, fallText: 'defeated!',
        getHp: () => enemy.currentHp, setHp: (hp) => setEnemyHp(enemy, hp) } : null;
    }
    const char = this.getPartyMember(id);
    return char ? { name: char.name, maxHp: char.maxHp, tracker: char.statusTracker, fallText: 'fell!',
      getHp: () => char.currentHp, setHp: (hp) => { char.currentHp = hp; } } : null;
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

    executeFight(this.hitDeps, cmd, isEnemy);
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
      this.skipHelplessMembers();
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
