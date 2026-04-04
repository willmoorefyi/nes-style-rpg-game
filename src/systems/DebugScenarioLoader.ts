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
}

export class DebugScenarioLoader {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  async loadScenarios(): Promise<DebugScenario[]> {
    return this.game.assets.loadYaml<DebugScenario[]>('assets/data/debug-scenarios.yaml');
  }

  async applyAndBattle(scenario: DebugScenario): Promise<void> {
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

    // Set gold and stock inventory
    this.game.party.addGold(scenario.gold);
    for (const [itemId, qty] of Object.entries(scenario.items)) {
      this.game.inventory.add(itemId, qty);
    }

    // Trigger battle
    const trigger = new BattleTrigger(this.game);
    await trigger.triggerBattle(scenario.enemies, undefined, scenario.background);
  }
}
