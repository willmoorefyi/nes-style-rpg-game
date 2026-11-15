/**
 * Test helpers for the battle layers (src/scenes/battle/BattleLayers.ts): floating numbers live in `fx.numbers`, not
 * directly in the main container, so lookups search the whole tree.
 */
import type { Container } from 'pixi.js';
import { OutlinedText } from '../../src/ui/NESFont.js';

/** Every descendant of `root` that passes `pick`, depth first in draw order. */
export function descendants<T extends Container>(root: Container, pick: (c: Container) => c is T): T[] {
  const out: T[] = [];
  for (const child of root.children) {
    if (pick(child)) out.push(child);
    out.push(...descendants(child, pick));
  }
  return out;
}

/** The floating numbers anywhere under `main` (the numbers layer, wherever the layers were built). */
export function floatsIn(main: Container): OutlinedText[] {
  return descendants(main, (c): c is OutlinedText => c instanceof OutlinedText);
}
