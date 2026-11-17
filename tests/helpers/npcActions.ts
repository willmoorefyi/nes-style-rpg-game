/**
 * A small field host for FieldNpcActions tests (W1-B): a real inventory, flags and party (gold), a recording dialog
 * and scene stack, and the NPC entities of a synthetic map.
 */
import { vi } from 'vitest';
import { Texture } from 'pixi.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Character } from '../../src/entities/Character.js';
import { NPC, type NPCData } from '../../src/entities/NPC.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData, MapNPC } from '../../src/types/index.js';
import { FieldNpcActions } from '../../src/scenes/exploration/FieldNpcActions.js';
import { createMapData, testClass } from './testUtils.js';

export function npcHost(npcs: MapNPC[], opts: { gold?: number; party?: Character[] } = {}) {
  const party = new PartyManager();
  for (const c of opts.party ?? []) party.add(c);
  party.setGold(opts.gold ?? 0);
  const game = {
    gameFlags: new GameFlags(),
    inventory: new Inventory(),
    party,
    scenes: { register: vi.fn(), push: vi.fn().mockResolvedValue(undefined), pop: vi.fn().mockResolvedValue(undefined) },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    input: { isJustPressed: vi.fn().mockReturnValue(false), isPressed: vi.fn().mockReturnValue(false) },
  };
  const map: MapData = createMapData({ npcs });
  const lines: string[][] = [];
  const dialog = { start: vi.fn((l: string[]) => { lines.push([...l]); }) };
  const actions = new FieldNpcActions({
    game: game as unknown as Game, dialog: dialog as never, map: () => map,
    playCutscene: vi.fn().mockResolvedValue(undefined), startEncounter: vi.fn(),
  });
  const entity = (id: string): NPC => {
    const def = npcs.find((n) => n.id === id);
    if (!def) throw new Error(`no npc ${id}`);
    return new NPC(def as NPCData, Texture.WHITE);
  };
  return { game, map, dialog, lines, actions, entity };
}

/** A level-`level` member, fallen when `hp` is 0. */
export function member(name: string, level: number, hp?: number): Character {
  const c = new Character({ name, classData: testClass('warrior'), level });
  if (hp !== undefined) c.currentHp = hp;
  return c;
}
