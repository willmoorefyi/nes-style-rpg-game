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
  const padR = cfg.targetW - oldW;
  const padB = cfg.targetH - oldH;
  if (padR <= 0 && padB <= 0) { console.log(`${cfg.file}: already ${oldW}x${oldH}, skip`); continue; }

  // Pad collision (flat array of oldW*oldH)
  if (map.collision) {
    const newColl = [];
    for (let y = 0; y < cfg.targetH; y++) {
      for (let x = 0; x < cfg.targetW; x++) {
        if (x < oldW && y < oldH) {
          newColl.push(map.collision[y * oldW + x]);
        } else {
          newColl.push(cfg.collFill);
        }
      }
    }
    map.collision = newColl;
  }

  // Pad tile layers (each layer is flat array)
  if (map.layers) {
    map.layers = map.layers.map(layer => {
      const newLayer = [];
      for (let y = 0; y < cfg.targetH; y++) {
        for (let x = 0; x < cfg.targetW; x++) {
          if (x < oldW && y < oldH) {
            newLayer.push(layer[y * oldW + x]);
          } else {
            newLayer.push(cfg.fill);
          }
        }
      }
      return newLayer;
    });
  }

  // Update transitions that were on the old border
  if (map.transitions) {
    // Move south-edge transitions to new south edge
    for (const t of map.transitions) {
      if (t.y === oldH - 1) t.y = cfg.targetH - 1;
    }
  }

  map.width = cfg.targetW;
  map.height = cfg.targetH;

  // Write back
  writeFileSync(cfg.file, YAML.stringify(map, { lineWidth: 0 }));
  console.log(`${cfg.file}: ${oldW}x${oldH} -> ${cfg.targetW}x${cfg.targetH}`);
}
