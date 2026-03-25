import { readFileSync, writeFileSync } from 'node:fs';
import YAML from 'yaml';

const configs = [
  { file: 'assets/maps/cornelia.yaml', targetW: 48, targetH: 36, fill: 0, collFill: 1 },
  { file: 'assets/maps/overworld.yaml', targetW: 64, targetH: 64, fill: 0, collFill: 0 },
  { file: 'assets/maps/temple-of-fiends.yaml', targetW: 40, targetH: 30, fill: 1, collFill: 1 },
];

for (const cfg of configs) {
  const raw = readFileSync(cfg.file, 'utf8');
  const map = YAML.parse(raw);
  const oldW = map.width;
  const oldH = map.height;
  if (cfg.targetW <= oldW && cfg.targetH <= oldH) {
    console.log(`${cfg.file}: already ${oldW}x${oldH}, skip`);
    continue;
  }

  const totalOld = oldW * oldH;

  // Helper: get value from array, handling compact arrays (e.g. [0] = fill)
  function getValue(arr, x, y, w, h, fallback) {
    if (x >= w || y >= h) return fallback;
    if (arr.length < w * h) return arr[0] ?? fallback; // compact
    return arr[y * w + x] ?? fallback;
  }

  // Build the tile layer from collision data so terrain colors render correctly.
  // The PlaceholderTextures color map uses collision/terrain type IDs (0=grass, 1=wall, 8=road, etc.)
  // The original maps had layers: [[0]] which rendered as default gray via undefined lookups.
  // Now we use collision values directly so each tile gets the correct terrain color.
  if (map.collision && map.collision.length >= totalOld) {
    const newLayer = [];
    for (let y = 0; y < cfg.targetH; y++) {
      for (let x = 0; x < cfg.targetW; x++) {
        const collVal = getValue(map.collision, x, y, oldW, oldH, cfg.collFill);
        // Use collision value as tile ID — but tile 0 is skipped by renderer,
        // so map grass (collision 0) to a high tile ID that renders as grass.
        // Actually: just offset all values by 1 so nothing is 0.
        newLayer.push(collVal + 1);
      }
    }
    map.layers = [newLayer];
  } else {
    // Fallback: expand compact layer
    const newLayer = [];
    const layerArr = map.layers?.[0] ?? [0];
    for (let y = 0; y < cfg.targetH; y++) {
      for (let x = 0; x < cfg.targetW; x++) {
        newLayer.push(getValue(layerArr, x, y, oldW, oldH, cfg.fill));
      }
    }
    map.layers = [newLayer];
  }

  // Pad collision
  if (map.collision) {
    const newColl = [];
    for (let y = 0; y < cfg.targetH; y++) {
      for (let x = 0; x < cfg.targetW; x++) {
        newColl.push(getValue(map.collision, x, y, oldW, oldH, cfg.collFill));
      }
    }
    map.collision = newColl;
  }

  // Move south-edge transitions to new south edge
  if (map.transitions) {
    for (const t of map.transitions) {
      if (t.y === oldH - 1) t.y = cfg.targetH - 1;
    }
  }

  map.width = cfg.targetW;
  map.height = cfg.targetH;

  writeFileSync(cfg.file, YAML.stringify(map, { lineWidth: 0 }));
  console.log(`${cfg.file}: ${oldW}x${oldH} -> ${cfg.targetW}x${cfg.targetH}`);
}
