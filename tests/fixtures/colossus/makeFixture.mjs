// Writes the synthetic colossus fixture (docs/CHAOS_FORMS_PLAN.md 9.2, R22): colossus.json plus flat-colour PNG tiles.
// Not game art: plain boxes with a 2 px outline, so the runtime and the browser check have a 900x520 art px canvas
// before any master is approved. Run: node tests/fixtures/colossus/makeFixture.mjs (deterministic; no dependencies).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const DIR = dirname(fileURLToPath(import.meta.url));

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** A w x h RGBA PNG: `fill` inside, `edge` on a 2 px border. */
function png(w, h, fill, edge) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 ? edge : fill;
      raw.set([c >> 16 & 255, c >> 8 & 255, c & 255, 255], y * (w * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const files = new Map();
/** A frame at `at` of size `size`, cut into tiles of <= 2048 px. */
function frame(form, layer, name, at, size, fill, edge = 0xd8b048) {
  const tiles = [];
  for (let x = 0, n = 0; x < size[0]; x += 2048) {
    const w = Math.min(2048, size[0] - x);
    const file = `${form}/${layer}_${name}${size[0] > 2048 ? `_${n++}` : ''}.png`;
    files.set(file, png(w, size[1], fill, edge));
    tiles.push({ file, x, y: 0, w, h: size[1] });
  }
  return { at, size, tiles };
}
const layer = (form, name, kind, frames, extra = {}) => ({ name, kind, ...extra,
  frames: Object.fromEntries(frames.map(([f, at, size, fill]) => [f, frame(form, name, f, at, size, fill)])) });

const H = 'fixture_horizon';
const horizon = {
  canvas: [900, 520], scale: 3, place: [-390, -302], coverBox: [0, 0, 900, 386], rimRow: 224,
  anchors: { target: [450, 220], core: [450, 240], head: [450, 150], hands: [[40, 300], [466, 224]], melee: [530, 274], feet: [450, 230] },
  targetRect: [380, 180, 140, 120],
  layers: [
    layer(H, 'body', 'body', [['base', [0, 0], [900, 520], 0x1c1028]]),
    layer(H, 'arm_l', 'limb', [['base', [0, 260], [200, 260], 0x2a1838], ['raise', [0, 240], [200, 260], 0x342040],
      ['slam', [0, 270], [200, 250], 0x3c2448], ['recoil', [0, 262], [200, 258], 0x302040]]),
    layer(H, 'cloud', 'cloud', [['base', [0, 150], [900, 60], 0x6a4a78]]),
    layer(H, 'core', 'core', [['base', [400, 190], [100, 120], 0xf0d070], ['open', [390, 180], [120, 140], 0xffffff]]),
    layer(H, 'glow', 'glow', [['base', [330, 120], [240, 260], 0x806020]]),
    layer(H, 'corona', 'corona', [['base', [250, 0], [400, 160], 0xc06020]]),
    ...[['moon_frost', [300, 280], 0x60c8e8], ['moon_ember', [560, 280], 0xe07030], ['moon_abyss', [340, 340], 0x208878],
      ['moon_storm', [520, 340], 0xe8e8f0]].map(([n, at, c]) => layer(H, n, 'moon', [['base', at, [40, 40], c]], { orbit: 6 })),
    layer(H, 'hand', 'overhang', [['base', [430, 210], [133, 47], 0x3a2a18], ['lift', [430, 196], [133, 47], 0x4a3a20],
      ['slam', [430, 214], [133, 47], 0x5a4a28]], { over: true }),
  ],
};
const O = 'fixture_orrery';
const orrery = {
  canvas: [440, 300], scale: 3, place: [-60, 60], visibleBox: [20, 20, 420, 240],
  anchors: { target: [220, 120], core: [220, 140], head: [220, 60], hands: [[60, 150], [380, 150]], melee: [330, 170], feet: [220, 153] },
  targetRect: [150, 80, 140, 140],
  layers: [
    layer(O, 'body', 'body', [['base', [60, 20], [320, 280], 0x241430]]),
    layer(O, 'gauntlet_l', 'limb', [['base', [20, 120], [100, 80], 0x5a4020], ['raise', [20, 100], [100, 80], 0x6a5028],
      ['slam', [20, 130], [100, 80], 0x7a6030], ['recoil', [20, 124], [100, 80], 0x604828]]),
    layer(O, 'gauntlet_r', 'limb', [['base', [320, 120], [100, 80], 0x5a4020], ['raise', [320, 100], [100, 80], 0x6a5028],
      ['slam', [320, 130], [100, 80], 0x7a6030], ['recoil', [320, 124], [100, 80], 0x604828]]),
    layer(O, 'core', 'core', [['base', [190, 30], [60, 60], 0x101010]]),
    layer(O, 'glow', 'glow', [['base', [150, 0], [140, 120], 0x806020]]),
    ...[['moon_frost', [100, 60], 0x60c8e8], ['moon_ember', [310, 60], 0xe07030], ['moon_abyss', [130, 220], 0x208878],
      ['moon_storm', [280, 220], 0xe8e8f0]].map(([n, at, c]) => layer(O, n, 'moon', [['base', at, [30, 30], c]], { orbit: 4 })),
  ],
};
const W = 'fixture_wide';
const wide = {
  canvas: [2600, 300], scale: 1, place: [-340, 100],
  anchors: { target: [1300, 150], core: [1300, 150], head: [1300, 60], hands: [[100, 250], [2500, 250]], melee: [1500, 200], feet: [1300, 290] },
  targetRect: [1100, 50, 400, 200],
  layers: [layer(W, 'body', 'body', [['base', [0, 0], [2600, 300], 0x182030]])],
};

const index = { version: 1, forms: { [H]: horizon, [O]: orrery, [W]: wide } };
for (const [file, data] of files) {
  mkdirSync(dirname(join(DIR, file)), { recursive: true });
  writeFileSync(join(DIR, file), data);
}
writeFileSync(join(DIR, 'colossus.json'), `${JSON.stringify(index, null, 1)}\n`);
console.log(`wrote colossus.json and ${files.size} tiles`);
