import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { vi } from 'vitest';
import { Container, BitmapText } from 'pixi.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { ShopRegistry } from '../../src/data/ShopRegistry.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { CharacterClassData, ItemData, ShopData, SpellData } from '../../src/types/index.js';
import type { InputAction } from '../../src/core/InputManager.js';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/data');
const read = <T>(file: string): T => parse(readFileSync(join(dataDir, file), 'utf-8')) as T;

/** Load the game's real classes, items, spells and shops into the registries. */
export async function loadRealRegistries(): Promise<void> {
  ClassRegistry.reset();
  ItemRegistry.reset();
  SpellRegistry.reset();
  ShopRegistry.reset();
  const loader = {
    loadClasses: async () => read<CharacterClassData[]>('classes.yaml'),
    loadItems: async () => read<ItemData[]>('items.yaml'),
    loadSpells: async () => read<SpellData[]>('spells.yaml'),
    loadShops: async () => read<ShopData[]>('shops.yaml'),
  } as unknown as DataLoader;
  await ClassRegistry.init(loader);
  await ItemRegistry.init(loader);
  await SpellRegistry.init(loader);
  await ShopRegistry.init(loader);
}

/** Every BitmapText under `root`, depth first. */
export function allTexts(root: Container): BitmapText[] {
  const out: BitmapText[] = [];
  const walk = (c: Container): void => {
    for (const child of c.children) {
      if (child instanceof BitmapText) out.push(child);
      if (child instanceof Container) walk(child);
    }
  };
  walk(root);
  return out;
}

/** Visible text labels under `root` (skips hidden windows). */
export function visibleLabels(root: Container): string[] {
  const out: string[] = [];
  const walk = (c: Container): void => {
    if (!c.visible) return;
    for (const child of c.children) {
      if (!child.visible) continue;
      if (child instanceof BitmapText) out.push(child.text);
      if (child instanceof Container) walk(child);
    }
  };
  walk(root);
  return out;
}

/** An input whose `tap(action)` makes exactly that action "just pressed" for one update. */
export function tapInput() {
  let pressed: InputAction | null = null;
  return {
    isPressed: vi.fn(() => false),
    isJustPressed: vi.fn((a: InputAction) => a === pressed),
    tap(action: InputAction, update: () => void): void {
      pressed = action;
      update();
      pressed = null;
    },
  };
}
