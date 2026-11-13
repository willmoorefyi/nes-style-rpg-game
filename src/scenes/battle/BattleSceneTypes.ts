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
  /** Battle stage background path (assets/backgrounds/<id>.webp) */
  background?: string;
  /** Optional per-enemy-id action patterns (debug scenarios): attached as BossAI after the battle is created. */
  enemyAi?: EnemyAiPatterns;
}

/** Weighted actions an enemy may take, keyed by enemy id (e.g. make a boss cast). */
export type EnemyAiPatterns = Record<string, { type: 'fight' | 'magic'; spellId?: string; weight: number }[]>;

export type UIState = 'intro' | 'command' | 'target' | 'executing' | 'message' | 'end' | 'spell_ui' | 'item_ui' | 'animating';
