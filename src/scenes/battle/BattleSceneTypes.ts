import type { InputManager } from '../../core/InputManager.js';
import type { EventBus } from '../../core/EventBus.js';
import type { AudioManager } from '../../core/AudioManager.js';
import type { Character } from '../../entities/Character.js';
import type { EnemyData, SpellData } from '../../types/index.js';
import type { Inventory } from '../../entities/Inventory.js';

export interface BattleSceneDeps {
  input: InputManager;
  events: EventBus;
  audio?: AudioManager;
}

export interface BattleSceneConfig {
  party: Character[];
  enemies: EnemyData[];
  spells?: SpellData[];
  inventory?: Inventory;
  /** Whether the party can run from this battle (default true) */
  canRun?: boolean;
  /** Optional background image path for the battle scene */
  background?: string;
}

export type UIState = 'intro' | 'command' | 'target' | 'executing' | 'message' | 'end' | 'spell_ui' | 'item_ui' | 'animating';
