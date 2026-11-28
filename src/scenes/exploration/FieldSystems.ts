import type { Game } from '../../core/Game.js';
import { ShopRegistry } from '../../data/ShopRegistry.js';
import { InnScene } from '../InnScene.js';
import { MagicShopScene } from '../MagicShopScene.js';
import { ShopScene } from '../ShopScene.js';

/** Open the shop, magic shop or inn for `shopId` over the field (a temporary `_shop_<id>` scene). */
export function openShopScene(game: Game, shopId: string): void {
  const shopData = ShopRegistry.getShop(shopId);
  if (!shopData) {
    console.error(`Unknown shop: ${shopId}`);
    return;
  }
  if (shopData.closed) {
    // pass EQ D-EQ8: a shop FF1 lacks; its keeper's line has been said and nothing opens
    console.info(`Shop ${shopId} is closed`);
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
