// Writes the synthetic colossus fixtures (docs/CHAOS_FORMS_PLAN.md 9.2, R22; rev 4: 18.3-18.5): colossus.json plus its
// PNG tiles, and contract.json (the json shape the Python build must write, 18.5; no tiles). Not game art.
// - fixture_horizon: a painted F3 stand-in at the rev-4 geometry (canvas 2700x1080 at scale 1, place (-527, -60), D-U11):
//   soft-alpha body cropped to rows 360-1079 (two tiles, 2048 + 652), an additive halo glow stored at half res
//   (texScale 2), an additive corona patch, core patches `crack` / `open` (its `base` is empty: the body carries it).
// - fixture_orrery: the rev-3 layered puppet (limbs, moons; flat boxes at scale 3), still supported by the view.
// - fixture_wide: one 2600 px body (two tiles).
// - chaos_orrery / chaos_horizon / chaos_horizon_core: the real ids on those tiles for `?colossus=fixture` (F4 an `art`
//   entry at (-527, -285)).
// Run: node tests/fixtures/colossus/makeFixture.mjs (deterministic; no dependencies).
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
/** A w x h RGBA PNG; `px(x, y)` returns [r, g, b, a] (straight alpha). */
function paint(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(px(x, y).map((v) => Math.max(0, Math.min(255, Math.round(v)))), y * (w * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const rgb = (c) => [c >> 16 & 255, c >> 8 & 255, c & 255];
/** A flat box: `fill` inside, `edge` on a 2 px border. */
const box = (w, h, fill, edge) => paint(w, h, (x, y) => [...rgb(x < 2 || y < 2 || x >= w - 2 || y >= h - 2 ? edge : fill), 255]);

const files = new Map();
/** A frame at `at` of size `size` (canvas px), its texture `size / texScale`, cut into tiles of <= 2048 px. `px(x, y)`
 *  paints in canvas px (null: a flat box). */
function frame(form, layer, name, at, size, fill, { texScale = 1, px = null } = {}) {
  const tw = Math.ceil(size[0] / texScale);
  const th = Math.ceil(size[1] / texScale);
  const tiles = [];
  for (let x = 0, n = 0; x < tw; x += 2048) {
    const w = Math.min(2048, tw - x);
    const file = `${form}/${layer}_${name}${tw > 2048 ? `_${n++}` : ''}.png`;
    files.set(file, px ? paint(w, th, (u, v) => px(at[0] + (x + u) * texScale, at[1] + v * texScale)) : box(w, th, fill, 0xd8b048));
    tiles.push({ file, x, y: 0, w, h: th });
  }
  return { at, size, ...(texScale !== 1 ? { texScale } : {}), tiles };
}
const layer = (form, name, kind, frames, extra = {}) => ({ name, kind, ...extra,
  frames: Object.fromEntries(frames.map(([f, at, size, fill, opts]) => [f, frame(form, name, f, at, size, fill, opts)])) });

// ---- the painted F3 stand-in (canvas px) ----
const smooth = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const DISC = [1347, 510];
const RING = { c: [1350, 570], r: 562, half: 37 };
/** Body coverage: the torso (an ellipse to the bottom edge), the outstretched arms (a band to both side edges), the
 *  head; 2 px soft edge. */
function bodyAlpha(x, y) {
  const torso = 1 - Math.hypot((x - 1350) / 400, (y - 1000) / 560);
  const armY = 640 - 90 * Math.cos(((x - 1350) / 1350) * Math.PI * 0.5);
  const arms = (70 - Math.abs(y - armY)) / 70;
  const head = 1 - Math.hypot((x - DISC[0]) / 120, (y - 430) / 110);
  return smooth(-0.004, 0.004, Math.max(torso, arms * 0.12, head));
}
function bodyPx(x, y) {
  const a = bodyAlpha(x, y);
  if (a <= 0) return [0, 0, 0, 0];
  const d = Math.hypot(x - DISC[0], y - DISC[1]);
  if (d < 104) return [8, 6, 14, 255 * a];                                  // the eclipse disc
  if (d < 112) return [250, 214, 150, 255 * a];                             // its lit rim
  const shade = 0.55 + 0.45 * smooth(1080, 380, y) * smooth(2700, 0, x + y);  // light from the top-left
  return [58 * shade + 20, 34 * shade + 14, 82 * shade + 20, 255 * a];
}
function glowPx(x, y) {
  const d = Math.hypot(x - RING.c[0], y - RING.c[1]);
  const ring = Math.exp(-(((d - RING.r) / RING.half) ** 2));
  const ang = Math.atan2(y - RING.c[1], x - RING.c[0]);
  const rays = Math.max(0, Math.cos(ang * 12)) ** 24 * smooth(RING.r + 500, RING.r, d) * smooth(RING.r - 80, RING.r, d);
  const halo = Math.exp(-((Math.hypot(x - DISC[0], y - DISC[1]) / 260) ** 2)) * 0.6;
  const a = Math.min(1, ring + rays * 0.7 + halo) * smooth(0, 120, y);   // the 120 px top feather (18.2)
  return [255, 196 + 40 * ring, 120 + 60 * halo, 255 * a];
}
function coronaPx(x, y) {
  const d = Math.hypot(x - DISC[0], y - DISC[1]);
  return [255, 236, 190, 255 * Math.exp(-(((d - 150) / 22) ** 2))];
}
function crackPx(x, y) {
  const zig = DISC[0] + 18 * Math.sin((y - DISC[1]) / 14);
  const a = smooth(5, 1, Math.abs(x - zig)) * smooth(330, 250, Math.abs(y - (DISC[1] + 220)));
  return [255, 170, 60, 255 * a];
}
function openPx(x, y) {
  const e = 1 - Math.hypot((x - DISC[0]) / 150, (y - (DISC[1] + 200)) / 190);
  return e <= 0 ? [0, 0, 0, 0] : [255, 120 + 120 * e, 40 + 60 * e, 255 * smooth(0, 0.05, e)];
}

/** The rev-4 F3 form (18.3-18.5) under the id `id` (its tile files under `id/`). */
const horizonForm = (id) => ({
  canvas: [2700, 1080], scale: 1, place: [-527, -60], skyDim: 0.6,
  anchors: { target: [1347, 510], core: [1347, 510], head: [1347, 410], hands: [[647, 680], [1787, 630]], melee: [1747, 590], feet: [1347, 950] },
  targetRect: [1170, 345, 360, 495],
  layers: [
    layer(id, 'glow', 'glow', [['base', [0, 0], [2700, 1080], 0, { texScale: 2, px: glowPx }]], { blend: 'add', alpha: 1 }),
    layer(id, 'body', 'body', [['base', [0, 360], [2700, 720], 0, { px: bodyPx }]]),
    { name: 'core', kind: 'core', frames: { base: { at: [1047, 300], size: [600, 600], tiles: [] },
      ...layer(id, 'core', 'core', [['crack', [1047, 300], [600, 600], 0, { px: crackPx }], ['open', [1047, 300], [600, 600], 0, { px: openPx }]]).frames } },
    layer(id, 'corona', 'corona', [['base', [997, 160], [700, 700], 0, { px: coronaPx }]], { blend: 'add', alpha: 1 }),
  ],
});

const H = 'fixture_horizon';
const horizon = horizonForm(H);
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
    layer(O, 'glow', 'glow', [['base', [150, 0], [140, 120], 0x806020]], { blend: 'add', alpha: 0.8 }),
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

// The browser check (`?colossus=fixture`): the real form ids on the fixture tiles. F3 is the horizon stand-in, F4 an `art`
// entry at its own rest (D-U13), F2 the rev-3 puppet.
const browser = { chaos_orrery: orrery, chaos_horizon: horizon, chaos_horizon_core: { art: 'chaos_horizon', place: [-527, -285] } };
const index = { version: 1, forms: { [H]: horizon, [O]: orrery, [W]: wide, ...browser } };
const tiles = new Map(files);
files.clear();
const contract = { version: 1, forms: { contract_form: horizonForm('contract_form') } };   // its tiles are not written
for (const [file, data] of tiles) {
  mkdirSync(dirname(join(DIR, file)), { recursive: true });
  writeFileSync(join(DIR, file), data);
}
writeFileSync(join(DIR, 'colossus.json'), `${JSON.stringify(index, null, 1)}\n`);
writeFileSync(join(DIR, 'contract.json'), `${JSON.stringify(contract, null, 1)}\n`);
console.log(`wrote colossus.json, contract.json and ${tiles.size} tiles`);
