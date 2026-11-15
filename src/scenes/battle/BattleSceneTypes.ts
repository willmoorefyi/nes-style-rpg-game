import type { InputManager } from '../../core/InputManager.js';
import type { EventBus } from '../../core/EventBus.js';
import type { AudioManager } from '../../core/AudioManager.js';
import type { Character } from '../../entities/Character.js';
import type { EnemyData, SpellData } from '../../types/index.js';
import type { Inventory } from '../../entities/Inventory.js';
import type { StatusEffect } from '../../battle/StatusEffects.js';

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
  /** Music track for the battle (default `battle`; boss battles use `boss`). */
  music?: string;
  /** Optional per-enemy-id action patterns (debug scenarios): attached as BossAI after the battle is created. */
  enemyAi?: EnemyAiPatterns;
  /** Optional statuses per enemy index (debug scenarios), applied when the battle starts. */
  enemyStatus?: Record<number, StatusEffect[]>;
  /** Injectable RNG for the battle logic (deterministic tests); defaults to Math.random. */
  rng?: () => number;
}

/** Weighted actions an enemy may take, keyed by enemy id (e.g. make a boss cast). */
export type EnemyAiPatterns = Record<string, { type: 'fight' | 'magic'; spellId?: string; weight: number }[]>;

/**
 * Battle-only text sizes (BA-8; the global FONT_SIZE is unchanged). The message window keeps its 120 px: two lines
 * of 36 px fit inside its 24 px padding.
 */
export const BATTLE_MESSAGE_FONT = 32;
export const BATTLE_MESSAGE_LINE = 36;
export const BATTLE_MESSAGE_HEIGHT = 120;
/** Floating damage numbers: big, with a dark outline. Heal green, miss grey, crit red. */
export const FLOAT_FONT = 48;
export const FLOAT_OUTLINE = 0x101018;
export const FLOAT_COLORS = { hit: 0xffffff, crit: 0xff4444, heal: 0x44ff44, miss: 0xa0a0a0 } as const;
/** The party HP panel rows. */
export const PANEL_FONT = 32;

/** The bottom strip (y 780-1080): the enemy list, the command window and the party panel, left to right. */
export const STRIP_Y = 780;
export const STRIP_HEIGHT = 300;
export const ENEMY_WINDOW = { x: 0, width: 560 } as const;
export const COMMAND_WINDOW = { x: 560, width: 340 } as const;
export const PARTY_PANEL = { x: 900, width: 1020 } as const;

export type UIState ='intro' | 'command' | 'target' | 'executing' | 'message' | 'end' | 'spell_ui' | 'item_ui' | 'animating' | 'notice';
