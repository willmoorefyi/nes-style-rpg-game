import type { Character } from '../entities/Character.js';

/**
 * AIBehavior interface for future enemy AI strategies.
 * Defines contract for AI decision-making beyond random targeting.
 */
export interface AIBehavior {
  /** Select an action for the enemy to perform against the party */
  selectAction(enemy: Character, party: Character[]): AIAction;
}

/** Represents an action selected by AI */
export interface AIAction {
  type: 'attack' | 'spell' | 'item' | 'defend';
  targetIndex?: number;
  spellId?: string;
  itemId?: string;
}
