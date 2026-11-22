import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { resolveNPCDialog, type MapData } from '../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readMap = (id: string) => parse(readFileSync(join(root, 'assets/maps/ai', `${id}.yaml`), 'utf-8')) as MapData;
interface Step { type: string; flag?: string; text?: string; map?: string; entrance?: string; facing?: string;
  image?: string | null; dim?: number }
const cutscenes = parse(readFileSync(join(root, 'assets/data/cutscenes.yaml'), 'utf-8')) as
  Array<{ id: string; steps: Step[] }>;
const script = (id: string): Step[] => cutscenes.find((c) => c.id === id)!.steps;
const flagsSetBy = (id: string) => cutscenes.find((c) => c.id === id)!.steps.filter((s) => s.type === 'set_flag').map((s) => s.flag);

describe('act 1 flow (the compiled 2x maps the game plays)', () => {
  it('a new game at the south gate of Cornelia can walk to an exit (NG-1: no sealed pocket)', () => {
    const map = readMap('cornelia');
    const [sx, sy] = map.entrances!.south_gate;
    const col = new CollisionMap(map);
    const walk = new WalkingMode();
    const exits = new Set(map.transitions.map((t) => `${t.x},${t.y}`));
    const seen = new Set([`${sx},${sy}`]);
    const queue: Array<[number, number]> = [[sx, sy]];
    let reached = 0;
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (exits.has(`${x},${y}`)) reached++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(k) || !col.isWalkable(nx, ny, walk)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    expect(seen.size).toBeGreaterThan(500);
    expect(reached).toBeGreaterThan(5);
  });

  it('overworld: from the south gate the temple and both bridge gates can be reached, the north shore cannot', () => {
    const map = readMap('overworld');
    const col = new CollisionMap(map);
    const walk = new WalkingMode();
    const [sx, sy] = map.entrances!.cornelia;
    const seen = new Set([`${sx},${sy}`]);
    const queue: Array<[number, number]> = [[sx, sy]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(k) || !col.isWalkable(nx, ny, walk)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    const temple = map.transitions.find((t) => t.targetMap === 'temple-of-fiends')!;
    expect(seen.has(`${temple.x},${temple.y}`), 'the temple door').toBe(true);
    const [tx, ty] = map.entrances!.temple;
    expect(seen.has(`${tx},${ty}`), 'the arrival from the temple').toBe(true);
    const gates = map.keyItemGates ?? [];
    expect(gates.length).toBe(2);
    for (const g of gates) expect(seen.has(`${g.x},${g.y}`), `bridge gate (${g.x},${g.y})`).toBe(true);
    const [nx, ny] = map.entrances!.north_shore;
    expect(seen.has(`${nx},${ny}`), 'the north shore').toBe(false);
    // OW-15: what lies beyond the bridge is the larger land
    const north = new Set([`${nx},${ny}`]);
    const next: Array<[number, number]> = [[nx, ny]];
    while (next.length) {
      const [x, y] = next.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ax = x + dx, ay = y + dy, k = `${ax},${ay}`;
        if (ax < 0 || ay < 0 || ax >= map.width || ay >= map.height || north.has(k) || !col.isWalkable(ax, ay, walk)) continue;
        north.add(k);
        next.push([ax, ay]);
      }
    }
    expect(north.size, `the mainland (${north.size} cells) vs the peninsula (${seen.size})`).toBeGreaterThan(1.15 * seen.size);
  });

  it('beating Garland frees the princess but does not open the north bridge (ST-1)', () => {
    expect(flagsSetBy('garland_defeated')).toEqual(['PRINCESS_RESCUED']);
  });

  it('the rescue (T2): the princess speaks, the heal is told, and the party warps to the throne room below the King', () => {
    const steps = script('garland_defeated');
    const at = (pred: (s: Step) => boolean) => steps.findIndex(pred);
    const firstFadeOut = at((s) => s.type === 'fade_out');
    expect(firstFadeOut).toBeGreaterThan(0);
    expect(steps.slice(0, firstFadeOut).some((s) => s.type === 'dialog' && /Princess/.test(s.text ?? '')),
      'the princess speaks before the screen goes black').toBe(true);
    const heal = at((s) => s.type === 'heal_party');
    expect(heal).toBeGreaterThan(-1);
    expect(steps.slice(heal + 1).some((s) => s.type === 'dialog' && /restored|revived/.test(s.text ?? '')),
      'the heal is told').toBe(true);
    const warps = steps.filter((s) => s.type === 'warp');
    expect(warps.length).toBe(1);
    const warp = at((s) => s.type === 'warp');
    expect(warp).toBeGreaterThan(at((s) => s.type === 'set_flag'));
    expect(warp).toBeLessThan(at((s) => s.type === 'fade_in'));
    expect(warps[0].map).toBe('cornelia-castle-2f');
    const map = readMap('cornelia-castle-2f');
    const cell = map.entrances?.[warps[0].entrance!];
    expect(cell, `entrance ${warps[0].entrance}`).toBeDefined();
    expect(new CollisionMap(map).isWalkable(cell![0], cell![1], new WalkingMode()), 'the arrival is walkable').toBe(true);
    const king = map.npcs.find((n) => n.id === 'king')!;
    expect(cell).toEqual([king.x, king.y + 1]);
    expect(warps[0].facing).toBe('up');
  });

  it('the opening (N2) is at most 3 short pages over staged backgrounds, ending on black', () => {
    const steps = script('opening');
    const pages = steps.filter((s) => s.type === 'dialog');
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.length).toBeLessThanOrEqual(3);
    for (const p of pages) expect((p.text ?? '').length, p.text).toBeLessThanOrEqual(100);
    const images = steps.filter((s) => s.type === 'backdrop' && s.image).map((s) => s.image as string);
    expect(images.length).toBeGreaterThan(0);
    for (const id of images) expect(existsSync(join(root, 'assets/backgrounds', `${id}.webp`)), id).toBe(true);
    const fades = steps.filter((s) => s.type === 'fade_out' || s.type === 'fade_in');
    expect(fades[fades.length - 1].type).toBe('fade_out');
    expect(steps[steps.length - 1]).toEqual({ type: 'backdrop', image: null });
  });

  it('U16: the opening\'s first page is dark: its backdrop is dimmed to mean luma 60 or less; the arrival is not', () => {
    // mean luma (0-255) of the staged backgrounds, measured with PIL on the committed .webp files
    const LUMA: Record<string, number> = { dark_forest: 112, grassland: 154 };
    const backdrops = script('opening').filter((s) => s.type === 'backdrop' && s.image);
    const first = backdrops[0];
    expect(first.image).toBe('dark_forest');
    expect(first.dim).toBeDefined();
    expect(first.dim!).toBeLessThanOrEqual(0.5);
    expect(LUMA[first.image as string] * first.dim!).toBeLessThanOrEqual(60);
    const arrival = backdrops.find((s) => s.image === 'grassland')!;
    expect(arrival.dim ?? 1).toBe(1);
  });

  it('the King plays the act-1 ending once, after the rescue, and it never builds the bridge in act 1', () => {
    const king = readMap('cornelia-castle-2f').npcs.find((n) => n.id === 'king')!;
    expect(king.cutscene).toEqual({ id: 'act1_complete', requiredFlag: 'PRINCESS_RESCUED', onceFlag: 'INTRO_COMPLETE' });
    expect(flagsSetBy('act1_complete')).toEqual(['INTRO_COMPLETE']);
    // first match wins: the post-ending line must come before the post-rescue line
    const conditions = (king.dialog as Array<{ condition?: string }>).map((d) => d.condition);
    expect(conditions.indexOf('INTRO_COMPLETE')).toBeLessThan(conditions.indexOf('PRINCESS_RESCUED'));
  });

  it('no NPC promises a finished bridge before BRIDGE_BUILT (ST-4); only lines conditioned on it may (P1-1-02)', () => {
    for (const id of ['cornelia', 'cornelia-castle-2f']) {
      for (const npc of readMap(id).npcs) {
        for (const d of npc.dialog as Array<string | { condition?: string; text: string[] }>) {
          if (typeof d === 'string' || d.condition === 'BRIDGE_BUILT') continue;
          expect(d.text.join(' '), `${id} ${npc.id}`).not.toMatch(/bridge[^.]*(stands|finished|is built)|(finished|completed) the bridge/i);
        }
      }
    }
  });

  it('after BRIDGE_BUILT the King and the chancellor say the bridge is done, not that the builders are at work (P1-1-02)', () => {
    const npcs = readMap('cornelia-castle-2f').npcs;
    const act1 = ['GARLAND_DEFEATED', 'PRINCESS_RESCUED', 'INTRO_COMPLETE', 'GOT_LUTE'];
    for (const id of ['king', 'chancellor']) {
      const npc = npcs.find((n) => n.id === id);
      expect(npc, id).toBeDefined();
      const say = (flags: string[]) => resolveNPCDialog(npc?.dialog ?? [], (f) => flags.includes(f)).join(' ');
      expect(say(act1), `${id} before the bridge`).toMatch(/builders are (hard )?at work/i);
      const after = say([...act1, 'BRIDGE_BUILT']);
      expect(after, `${id} after the bridge`).not.toMatch(/at work|will (order|rebuild)/i);
      expect(after, `${id} after the bridge`).toMatch(/bridge[^.]*(stands|finished)/i);
    }
  });
});
