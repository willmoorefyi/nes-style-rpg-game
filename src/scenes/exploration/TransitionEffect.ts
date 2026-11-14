import type { MapTransition } from '../../types/index.js';

/** How the field screen leaves the map for a transition. */
export type TransitionAnimation = 'zoom' | 'fade';

/**
 * CA-2: only a door (`effect: door`, stamped by build_map.py on town and interior house/shop doors) zooms in; the
 * castle gate, stairs, edge exits and every unmarked transition fade.
 */
export function transitionAnimation(transition: Pick<MapTransition, 'effect'>): TransitionAnimation {
  return transition.effect === 'door' ? 'zoom' : 'fade';
}
