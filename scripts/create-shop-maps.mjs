import { writeFileSync } from 'node:fs';
import YAML from 'yaml';

// Standard shop layout: 8x6
// Row 0: wall wall wall wall wall wall wall wall
// Row 1: wall floor floor floor floor floor floor wall  (shopkeeper at 4,1)
// Row 2: wall floor counter counter counter counter floor wall  (counter row)
// Row 3: wall floor floor floor floor floor floor wall
// Row 4: wall floor floor floor floor floor floor wall  (player spawns at 4,4)
// Row 5: wall wall wall door door wall wall wall  (door at 3,5 and 4,5)

const W = 8, H = 6;

// Collision: 0=walkable, 1=wall, 10=counter(impassable)
function makeCollision() {
  const c = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y === 0 || x === 0 || x === W-1) { c.push(1); continue; }
      if (y === 5 && (x < 3 || x > 4)) { c.push(1); continue; }
      if (y === 2 && x >= 2 && x <= 5) { c.push(10); continue; }
      c.push(0);
    }
  }
  return c;
}

// Tile layer: collision + 1 (to avoid tile 0 = skip)
function makeTiles(collision) {
  return collision.map(c => c + 1);
}

const shops = [
  { id: 'cornelia-weapon-shop', shopId: 'cornelia_weapon', name: 'Weapon Shop', sprite: 'merchant', returnX: 3, returnY: 1 },
  { id: 'cornelia-armor-shop', shopId: 'cornelia_armor', name: 'Armor Shop', sprite: 'merchant', returnX: 8, returnY: 1 },
  { id: 'cornelia-item-shop', shopId: 'cornelia_item', name: 'Item Shop', sprite: 'merchant', returnX: 13, returnY: 1 },
  { id: 'cornelia-white-magic', shopId: 'cornelia_white', name: 'White Magic', sprite: 'mage', returnX: 3, returnY: 5 },
  { id: 'cornelia-black-magic', shopId: 'cornelia_black', name: 'Black Magic', sprite: 'mage', returnX: 13, returnY: 5 },
  { id: 'cornelia-inn', shopId: 'cornelia_inn', name: 'Inn', sprite: 'innkeeper', returnX: 3, returnY: 9 },
];

for (const shop of shops) {
  const collision = makeCollision();
  const tiles = makeTiles(collision);

  const map = {
    id: shop.id,
    width: W,
    height: H,
    layers: [tiles],
    tilesets: ['interior'],
    collision,
    npcs: [
      {
        id: `${shop.id}-keeper`,
        x: 4,
        y: 2,
        sprite: shop.sprite,
        dialog: [`Welcome to the ${shop.name}!`],
        shopId: shop.shopId,
      },
    ],
    transitions: [
      { x: 3, y: 5, targetMap: 'cornelia', targetX: shop.returnX, targetY: shop.returnY + 1 },
      { x: 4, y: 5, targetMap: 'cornelia', targetX: shop.returnX, targetY: shop.returnY + 1 },
    ],
    encounterRate: { min: 999, max: 999 },
    encounters: [],
  };

  const path = `assets/maps/${shop.id}.yaml`;
  writeFileSync(path, YAML.stringify(map, { lineWidth: 0 }));
  console.log(`Created ${path}`);
}
