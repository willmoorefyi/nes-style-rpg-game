import type { Game } from '../core/Game.js';
import { BattleTrigger, type BattleEndData } from './BattleTrigger.js';
import type { EnemyAiPatterns } from '../scenes/battle/BattleSceneTypes.js';
import type { StatusEffect } from '../battle/StatusEffects.js';
import { applyDebugParty, isStatus, type DebugMember } from './debugParty.js';

export interface DebugScenario {
  id: string;
  name: string;
  party: DebugMember[];
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
    applyDebugParty(this.game, scenario);
  }
}
