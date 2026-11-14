import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { foundText } from '../../src/systems/pickupText.js';
import { loadRealRegistries } from '../helpers/realData.js';

const aiDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/maps/ai');

interface ChestNpc { id?: string; chestItem?: string; dialog?: unknown }

/** Every chest NPC of every compiled map, with its map id. */
function compiledChests(): Array<{ map: string; npc: ChestNpc }> {
  const out: Array<{ map: string; npc: ChestNpc }> = [];
  for (const file of readdirSync(aiDir).filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')) {
    const map = parse(readFileSync(join(aiDir, file), 'utf-8')) as { id?: string; npcs?: ChestNpc[] };
    for (const npc of map.npcs ?? []) if (npc.chestItem) out.push({ map: map.id ?? file, npc });
  }
  return out;
}

describe('U9: chest text in the compiled maps', () => {
  beforeAll(loadRealRegistries);

  it('there are chests to check', () => {
    expect(compiledChests().length).toBeGreaterThan(5);
  });

  it('every chest NPC says exactly foundText(item) (the field shows that line when it opens)', () => {
    const wrong = compiledChests()
      .filter(({ npc }) => JSON.stringify(npc.dialog) !== JSON.stringify([foundText(npc.chestItem!)]))
      .map(({ map, npc }) => `${map}/${npc.id ?? npc.chestItem}: ${JSON.stringify(npc.dialog)} != ${foundText(npc.chestItem!)}`);
    expect(wrong).toEqual([]);
  });
});
