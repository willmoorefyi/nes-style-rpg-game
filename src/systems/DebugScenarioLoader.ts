import type { Game } from '../core/Game.js';
import { Character } from '../entities/Character.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { BattleTrigger } from './BattleTrigger.js';

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
  /** 'battle' (default) starts a battle; 'field' drops the party onto `map` at `spawn`. */
  mode?: 'battle' | 'field';
  map?: string;
  spawn?: [number, number];
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
    if (!scenario.map || !scenario.spawn) throw new Error(`field scenario ${scenario.id} needs map and spawn`);
    this.applyParty(scenario);
    this.game.currentMapId = scenario.map;
    this.game.playerPosition = { x: scenario.spawn[0], y: scenario.spawn[1] };
    this.game.scenes.switchTo('exploration');
  }

  async applyAndBattle(scenario: DebugScenario): Promise<void> {
    this.applyParty(scenario);
    const trigger = new BattleTrigger(this.game);
    await trigger.triggerBattle(scenario.enemies, undefined, scenario.background);
  }

  private applyParty(scenario: DebugScenario): void {
    // Clear existing party
    while (this.game.party.all.length > 0) {
      this.game.party.remove(0);
    }

    // Build party from scenario
    for (const member of scenario.party) {
      const classData = ClassRegistry.getClass(member.class);
      if (!classData) continue;
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

      this.game.party.add(character);
    }

    // Reset and set gold and inventory from scenario
    this.game.party.setGold(scenario.gold);
    this.game.inventory.clear();
    for (const [itemId, qty] of Object.entries(scenario.items)) {
      this.game.inventory.add(itemId, qty);
    }
  }
}
