import type { Game } from '../../core/Game.js';
import type { VehicleType } from '../../types/index.js';
import type { MovementMode } from '../../entities/MovementMode.js';
import { KeyItemGateSystem } from '../../systems/KeyItemGateSystem.js';
import { VehicleManager } from '../../systems/VehicleManager.js';
import { CanoeMode } from '../../entities/CanoeMode.js';
import { ShipMode } from '../../entities/ShipMode.js';
import { AirshipMode } from '../../entities/AirshipMode.js';
import { ShopRegistry } from '../../data/ShopRegistry.js';
import { InnScene } from '../InnScene.js';
import { MagicShopScene } from '../MagicShopScene.js';
import { ShopScene } from '../ShopScene.js';

/**
 * Field systems that read the game's current inventory and flags. Game.restoreState / resetState swap those objects
 * (load, retry, new game), so the exploration scene builds these again on every enter.
 */
export function createFieldStateSystems(game: Game): { gates: KeyItemGateSystem; vehicles: VehicleManager } {
  const modes = new Map<VehicleType, MovementMode>([
    ['canoe', new CanoeMode()],
    ['ship', new ShipMode()],
    ['airship', new AirshipMode()],
  ]);
  return { gates: new KeyItemGateSystem(game.inventory, game.gameFlags), vehicles: new VehicleManager(game.gameFlags, modes) };
}

/** Open the shop, magic shop or inn for `shopId` over the field (a temporary `_shop_<id>` scene). */
export function openShopScene(game: Game, shopId: string): void {
  const shopData = ShopRegistry.getShop(shopId);
  if (!shopData) {
    console.error(`Unknown shop: ${shopId}`);
    return;
  }
  const tempName = `_shop_${shopId}`;
  if (shopData.type === 'inn') {
    game.scenes.register(tempName, new InnScene(game, shopData));
  } else if (shopData.type === 'magic') {
    game.scenes.register(tempName, new MagicShopScene(game, shopId));
  } else {
    game.scenes.register(tempName, new ShopScene(game, shopId));
  }
  game.scenes.push(tempName);
}
