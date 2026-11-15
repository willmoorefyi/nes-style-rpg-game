/**
 * Battle effect hooks (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 5). BattleScene calls the two factories once in
 * `enter()` and hands the results to BattleAnimationController; pass F's Fd (spell and item effects) and Fe (status
 * overlays) replace the factory bodies only. With no effect data an action presents on its resolve frame.
 */
import type { Container } from 'pixi.js';
import type { ActionResult, BattleStateMachine, NextActionInfo } from '../../../battle/BattleStateMachine.js';
import type { BattleDisplayManager } from '../BattleDisplayManager.js';
import type { BattleLayers } from '../BattleLayers.js';
import type { StatusDiff } from '../presentedState.js';
import { BattleActionFx } from './ActionFx.js';
import { BattleStatusFx } from './statusFx.js';
import { fxSource, type FxSource } from './fxSource.js';

/** Effects started by an animation cue: the glint on a raised weapon (`hold`), the dust of a slam (`contact`). */
export type FxCueId = 'glint' | 'impact_dust';
/** Where a cue effect plays, as a fraction of its sprite's local bounds (the raised weapon's tip for the glint). */
export interface FxCuePoint { x: number; y: number }

/** What an effect needs besides the action: where it plays and what the action did to statuses. */
export interface ActionFxContext {
  /** Battle ids of the target set, captured at announce time (`targetId`, or the living side for all-target spells). */
  targetIds: readonly string[];
  /** Their sprites (same order; missing sprites left out). */
  targets: readonly Container[];
  /** The acting sprite, or null. */
  actor: Container | null;
  /** Statuses each combatant gained (landed) or lost (cleansed) in this action. */
  diff: StatusDiff;
}

export interface ActionFx {
  /** Start the action's effect; returns its impact frame (0: present at once). The number, the hurt pose and the
   *  result line wait for it. */
  play(info: NextActionInfo, result: ActionResult, ctx: ActionFxContext): number;
  /** An effect started by an attack cue on `sprite`; at `at` when given, else at the effect's anchor on the body. */
  playCue(id: FxCueId, sprite: Container, at?: FxCuePoint): void;
}

export interface StatusFx {
  /** Attach and detach status overlays for a presented action's status changes. */
  sync(diff: StatusDiff): void;
}

export const noopActionFx: ActionFx = {
  play: () => 0,
  playCue: () => {},
};

export const noopStatusFx: StatusFx = {
  sync: () => {},
};

/** The spell, item and ranged-attack effects (Fd, fx/ActionFx.ts). The shared data and atlas start loading on the
 *  first battle in a browser (the intro covers it); until they arrive an action presents at once, as before. */
export function createActionFx(layers: BattleLayers, _display: BattleDisplayManager, source: FxSource = fxSource): ActionFx {
  if (source === fxSource && typeof document !== 'undefined' && !source.isLoaded) void source.load();
  return new BattleActionFx(layers, source);
}

/** The status overlays, icons and tints (fx/statusFx.ts), and the postures the display reads: both from
 *  status-visuals.yaml in the shared source (empty until it loads, during the intro). */
export function createStatusFx(layers: BattleLayers, display: BattleDisplayManager, _battle: BattleStateMachine,
  source: FxSource = fxSource): StatusFx {
  if (source === fxSource && typeof document !== 'undefined' && !source.isLoaded) void source.load();
  display.statusVisuals = display.partyPanel.statusVisuals = () => source.statusVisuals;
  return new BattleStatusFx(layers, display, source.atlas, () => source.statusVisuals);
}
