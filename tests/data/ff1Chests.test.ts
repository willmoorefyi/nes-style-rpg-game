/**
 * Pass EQ (docs/EQUIP_FF1_PLAN.md 4.2, D-EQ10): the chest swaps that give every item leaving the shops a source and put
 * FF1's chest gauntlets and rings in their FF1 places. Each swapped chest has a new id, so a new flag: a save that
 * opened the old chest finds it closed again, with the new item.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../src/types/index.js';
import { foundText } from '../../src/systems/pickupText.js';
import { loadRealRegistries } from '../helpers/realData.js';

/** [row, map, x, y, item, chest NPC id, chest flag, the item it held before]. */
const SWAPS: ReadonlyArray<[string, string, number, number, string, string, string, string]> = [
  ['C1', 'marsh-cave-b1', 4, 8, 'iron_sword', 'chest_elf_d_b1_west_sword', 'CHEST_ELF_D_B1_WEST_SWORD', 'hi_potion'],
  ['C2', 'giant-tunnel', 4, 18, 'great_axe', 'chest_ert_o_tunnel_axe', 'CHEST_ERT_O_TUNNEL_AXE', 'hi_potion'],
  ['C3', 'ice-cavern-b1', 2, 4, 'flame_sword', 'chest_fir_d2_b1_grotto_sword', 'CHEST_FIR_D2_B1_GROTTO_SWORD', 'hi_potion'],
  ['C4', 'mirage-2f', 36, 28, 'thor_hammer', 'chest_south_nook_hammer', 'CHEST_WND_D1_SOUTH_NOOK_HAMMER', 'hi_potion'],
  ['C5', 'waterfall-cave', 27, 6, 'rune_knife', 'chest_wat_o_falls_east_knife', 'CHEST_WAT_O_FALLS_EAST_KNIFE', 'hi_potion'],
  ['C6', 'sky-castle-4f', 20, 1, 'dragon_claw', 'chest_bay_north_claw', 'CHEST_WND_D2_BAY_NORTH_CLAW', 'hi_potion'],
  ['C7', 'sea-shrine-b3', 39, 5, 'diamond_armor', 'chest_wat_d_b3_vestry_armor', 'CHEST_WAT_D_B3_VESTRY_ARMOR', 'hi_potion'],
  ['C8', 'citadel-2f', 34, 5, 'zeus_gauntlet', 'chest_hall_east_zeus', 'CHEST_ORD_O_HALL_EAST_ZEUS', 'hi_potion'],
  ['C9', 'sea-shrine-b2', 24, 27, 'power_gauntlet', 'chest_wat_d_b2_chapter_power', 'CHEST_WAT_D_B2_CHAPTER_POWER', 'hi_potion'],
  ['C10', 'sea-shrine-b5', 28, 27, 'opal_gauntlet', 'chest_wat_d_b5_niche_e_opal', 'CHEST_WAT_D_B5_NICHE_E_OPAL', 'hi_potion'],
  ['C11', 'elfheim-vault', 2, 6, 'copper_gauntlet', 'chest_elf_t_ether_gauntlet', 'CHEST_ELF_T_ETHER_GAUNTLET', 'ether'],
  ['C12', 'citadel-3f', 12, 19, 'iron_gauntlet', 'chest_niche_west_gauntlet', 'CHEST_ORD_O_NICHE_WEST_GAUNTLET', 'hi_potion'],
  ['C13', 'gurgu-b1', 10, 4, 'silver_gauntlet', 'chest_rim_northwest_gauntlet', 'CHEST_FIR_D1_RIM_NORTHWEST_GAUNTLET', 'hi_potion'],
  ['C14', 'ice-cavern-b3', 38, 8, 'silver_gauntlet', 'chest_fir_d2_b3_niche_gauntlet', 'CHEST_FIR_D2_B3_NICHE_GAUNTLET', 'hi_potion'],
  ['C15', 'sky-castle-2f', 41, 14, 'opal_gauntlet', 'chest_bridge_east_opal', 'CHEST_WND_D2_BRIDGE_EAST_OPAL', 'hi_potion'],
  ['C16', 'sky-castle-1f', 20, 1, 'pro_ring', 'chest_berth_north_ring', 'CHEST_WND_D2_BERTH_NORTH_RING', 'hi_potion'],
  ['C17', 'past-temple-2', 33, 28, 'pro_ring', 'chest_cross_east_ring', 'CHEST_PST_CROSS_EAST_RING', 'hi_potion'],
];
const load = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;

describe('EQ: the chest swaps C1-C17', () => {
  beforeAll(loadRealRegistries);

  it.each(SWAPS)('%s %s (%i, %i) holds %s', (_row, map, x, y, itemId, id, flag) => {
    const chest = load(map).npcs.find((n) => n.x === x && n.y === y && n.chestItem);
    expect(chest).toMatchObject({ id, chestItem: itemId, chestFlag: flag });
    expect(chest!.dialog).toEqual([foundText(itemId)]);
  });

  it('every swapped chest has a new id: no chest NPC keeps its old id or flag', () => {
    for (const [, map, , , , id, flag] of SWAPS) {
      const chests = load(map).npcs.filter((n) => n.chestItem);
      const old = id.replace(/_(sword|axe|hammer|knife|claw|armor|zeus|power|opal|gauntlet|ring)$/, '');
      expect(chests.some((n) => n.id === old), `${map}: ${old}`).toBe(false);
      expect(chests.filter((n) => n.chestFlag === flag)).toHaveLength(1);
    }
  });
});
