import type { Game } from '../core/Game.js';
import { Character } from '../entities/Character.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { slotOf } from '../entities/EquipmentRules.js';
import { BattleTrigger, type BattleEndData } from './BattleTrigger.js';
import type { EnemyAiPatterns } from '../scenes/battle/BattleSceneTypes.js';
import type { StatusEffect } from '../battle/StatusEffects.js';

const STATUSES: readonly StatusEffect[] = ['poison', 'stun', 'sleep', 'blind', 'silence', 'death', 'stone', 'fear'];

export interface DebugScenario {
  id: string;
  name: string;
  party: {
    class: string;
    name: string;
    level: number;
    equipment: string[];
    spells: { id: string; level: number }[];
    /** Start with this HP instead of full (0: fallen), for item and inn checks. */
    hp?: number;
    /** Start with these status effects, e.g. `[poison]`, for menu and battle checks. */
    status?: string[];
  }[];
  /** Story flags set on the fresh game before the party is built, e.g. `[GARLAND_DEFEATED]`. */
  flags?: string[];
  items: Record<string, number>;
  gold: number;
  enemies: string[];
  background?: string;
  /** Optional action patterns per enemy id, e.g. `{ lich: [{ type: magic, spellId: ice, weight: 1 }] }`. */
  enemyAi?: EnemyAiPatterns;
  /** Optional starting statuses per enemy index, e.g. `{ 0: [sleep], 1: [poison] }` (unknown ones are logged). */
  enemyStatus?: Record<number, string[]>;
  /** 'battle' (default) starts a battle; 'field' drops the party onto `map` at `entrance` (or the `spawn` cell). */
  mode?: 'battle' | 'field';
  map?: string;
  spawn?: [number, number];
  entrance?: string;
}

/** Choose a scenario by `?scenario=<id>` (dev URLs); falls back to the first scenario. */
export function pickScenario<T extends { id: string }>(scenarios: T[], search: string): T | undefined {
  const wanted = new URLSearchParams(search).get('scenario');
  return (wanted && scenarios.find((s) => s.id === wanted)) || scenarios[0];
}

const isStatus = (s: string): s is StatusEffect => (STATUSES as readonly string[]).includes(s);

/** The scenario's `enemyStatus` with only known statuses (an unknown one logs `console.error` and is dropped). */
export function enemyStatusOf(scenario: Pick<DebugScenario, 'id' | 'enemyStatus'>): Record<number, StatusEffect[]> | undefined {
  if (!scenario.enemyStatus) return undefined;
  const out: Record<number, StatusEffect[]> = {};
  for (const [index, statuses] of Object.entries(scenario.enemyStatus)) {
    const known: StatusEffect[] = [];
    for (const s of statuses ?? []) {
      if (isStatus(s)) known.push(s);
      else console.error(`Debug scenario ${scenario.id}: unknown status '${s}' for enemy ${index}`);
    }
    out[Number(index)] = known;
  }
  return out;
}

export class DebugScenarioLoader {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  async loadScenarios(): Promise<DebugScenario[]> {
    return this.game.assets.loadYaml<DebugScenario[]>('assets/data/debug-scenarios.yaml');
  }

  /** Start the scenario in its mode. */
  async run(scenario: DebugScenario): Promise<void> {
    if (scenario.mode === 'field') return this.applyAndExplore(scenario);
    return this.applyAndBattle(scenario);
  }

  async applyAndExplore(scenario: DebugScenario): Promise<void> {
    if (!scenario.map || (!scenario.spawn && !scenario.entrance)) {
      throw new Error(`field scenario ${scenario.id} needs map and spawn or entrance`);
    }
    this.applyParty(scenario);
    this.game.currentMapId = scenario.map;
    this.game.pendingEntrance = scenario.entrance ?? null;
    if (scenario.spawn) this.game.playerPosition = { x: scenario.spawn[0], y: scenario.spawn[1] };
    this.game.scenes.switchTo('exploration');
  }

  async applyAndBattle(scenario: DebugScenario): Promise<void> {
    this.applyParty(scenario);
    const trigger = new BattleTrigger(this.game);
    // no field scene listens over the title: end this battle here, once (victory / escape: pop back to the title;
    // defeat: Game Over, which offers Load and Title only as there is no map to retry on) (S6)
    const events = this.game.events;
    const onEnd = (data: BattleEndData): void => {
      events.off('battleEnd', onEnd);
      trigger.onBattleEnd(data);
    };
    events.on('battleEnd', onEnd);
    try {
      await trigger.triggerBattle(scenario.enemies, undefined, scenario.background, scenario.enemyAi,
        enemyStatusOf(scenario));
    } catch (e) {
      events.off('battleEnd', onEnd);
      throw e;
    }
  }

  private applyParty(scenario: DebugScenario): void {
    // every scenario starts from a fresh game (no party, items, flags or retry state from an earlier run)
    this.game.resetState();
    for (const flag of scenario.flags ?? []) this.game.gameFlags.set(flag);

    // Build party from scenario
    for (const member of scenario.party) {
      const classData = ClassRegistry.getClass(member.class);
      if (!classData) {
        console.error(`Debug scenario ${scenario.id}: unknown class '${member.class}' for ${member.name}`);
        continue;
      }
      const character = new Character({ name: member.name, classData, level: member.level });

      // Equip items
      for (const itemId of member.equipment) {
        const item = ItemRegistry.getItem(itemId);
        const slot = item ? slotOf(item) : null;
        if (!item || !slot || character.equip(slot, item) === false) {
          console.warn(`Debug scenario ${scenario.id}: ${member.name} cannot equip '${itemId}'`);
        }
      }

      // Learn spells and restore charges
      for (const spell of member.spells) {
        character.learnSpell(spell.id, spell.level);
      }
      character.restoreAllCharges();
      character.currentHp = member.hp ?? character.maxHp;
      for (const status of member.status ?? []) {
        if (isStatus(status)) character.statusTracker.apply(status);
        else console.error(`Debug scenario ${scenario.id}: unknown status '${status}' for ${member.name}`);
      }

      if (!this.game.party.add(character)) console.error(`Debug scenario ${scenario.id}: could not add ${member.name}`);
    }

    // Reset and set gold and inventory from scenario
    this.game.party.setGold(scenario.gold);
    this.game.inventory.clear();
    for (const [itemId, qty] of Object.entries(scenario.items)) {
      this.game.inventory.add(itemId, qty);
    }
  }
}
