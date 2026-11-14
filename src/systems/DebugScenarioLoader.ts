import type { Game } from '../core/Game.js';
import { Character } from '../entities/Character.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { BattleTrigger } from './BattleTrigger.js';
import type { EnemyAiPatterns } from '../scenes/battle/BattleSceneTypes.js';

export interface DebugScenario {
  id: string;
  name: string;
  party: {
    class: string;
    name: string;
    level: number;
    equipment: string[];
    spells: { id: string; level: number }[];
  }[];
  items: Record<string, number>;
  gold: number;
  enemies: string[];
  background?: string;
  /** Optional action patterns per enemy id, e.g. `{ lich: [{ type: magic, spellId: ice, weight: 1 }] }`. */
  enemyAi?: EnemyAiPatterns;
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
    await trigger.triggerBattle(scenario.enemies, undefined, scenario.background, scenario.enemyAi);
  }

  private applyParty(scenario: DebugScenario): void {
    // every scenario starts from a fresh game (no party, items, flags or retry state from an earlier run)
    this.game.resetState();

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
        if (item?.slot) character.equip(item.slot, item);
      }

      // Learn spells and restore charges
      for (const spell of member.spells) {
        character.learnSpell(spell.id, spell.level);
      }
      character.restoreAllCharges();
      character.currentHp = character.maxHp;

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
