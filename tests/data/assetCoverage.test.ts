import { BATTLE_POSES } from '../../src/rendering/CharacterAtlas.js';
import { BOSS_FRAMES, FRAME_FALLBACK, FRAME_SOURCE, MONSTER_FRAMES, isOrbitFrame, resolveFrame, type MonsterFrame } from '../../src/scenes/battle/enemyChoreography.js';
import { KNEEL_FRAMES, isKneelFrame } from '../../src/scenes/battle/kneelChoreography.js';
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assets = resolve(__dirname, '../../assets');
const readYaml = <T>(rel: string): T => parse(readFileSync(join(assets, rel), 'utf-8')) as T;

interface AtlasMeta {
  cell: [number, number];
  cols: number;
  rows: number;
  sheets: Record<string, { x: number; y: number }>;
}
const atlas = JSON.parse(readFileSync(join(assets, 'sprites/characters.json'), 'utf-8')) as AtlasMeta;
const battleAtlas = JSON.parse(readFileSync(join(assets, 'sprites/battle-characters-ai.json'), 'utf-8')) as {
  cell: [number, number];
  scale: number;
  footRow: number;
  poses: string[];
  sheets: Record<string, { row: number }>;
};
const monsterAtlas = JSON.parse(readFileSync(join(assets, 'sprites/monsters-ai.json'), 'utf-8')) as {
  scale: number;
  texScale?: number;
  pages: { file: string; w: number; h: number }[];
  sheets: Record<string, { cell: [number, number]; footRow: number; frames: Record<string, [number, number]>; page: number;
    anim?: boolean; holds?: string[]; lungePx?: number; hasRaise?: boolean; opaqueRight?: number; head?: [number, number];
    texScale?: number; idleOrbit?: number }>;
};
/** The heavy attack's frames (pass F item 7): only a sheet with its own approved `attack_raise` lists them. */
// FW-Q (docs/ROSTER_FIX_PLAN_2.md 4): a partial rig's `alias: [hurt]` or `[attack]` leaves that sequence's in-betweens
// aliased to their source keys (monster_anim.ALIAS_FRAMES); since G6 black_widow hurt, crawler / astos attack (chimera hurt until EF-H batch 3).
const FWQ_FRAMES: Record<string, MonsterFrame[]> = {
  hurt: ['hurt_in1', 'hurt_in2'], attack: ['atk_wind1', 'atk_wind2', 'atk_mid', 'atk_follow', 'atk_recover'],
};
const fwqAliased = (sprite: string): Set<MonsterFrame> => {
  const rig = resolve(__dirname, '../../assets-src/gen/anim/monsters', `${sprite}.yaml`);
  // the top-level `alias:` line only (some rigs repeat keys, which PyYAML allows and the strict yaml parser refuses)
  const m = existsSync(rig) ? /^alias:\s*\[([^\]]*)\]/m.exec(readFileSync(rig, 'utf-8')) : null;
  const seqs = m ? m[1].split(',').map((q) => q.trim()).filter(Boolean) : [];
  return new Set(seqs.flatMap((q) => FWQ_FRAMES[q] ?? []));
};
const RAISE_FRAMES = new Set<MonsterFrame>(['attack_raise', 'atk_raise_in', 'atk_raise_b', 'atk_swing', 'atk_swing2']);
const classes = readYaml<Array<{ id: string }>>('data/classes.yaml');
const enemies = readYaml<Array<{ id: string; sprite?: string }>>('data/enemies.yaml');
/** Battle art is looked up by `sprite` (palette-swap variants), like BattleArt.monsterSpriteKey. */
const spriteOf = (e: { id: string; sprite?: string }) => (e.sprite || e.id).replace(/\.png$/i, '');
const manifest = JSON.parse(readFileSync(join(assets, 'data/audio-manifest.json'), 'utf-8')) as {
  music: Record<string, string>;
  sfx: Record<string, string>;
};
const mapNpcSprites = readdirSync(join(assets, 'maps'))
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => readYaml<{ npcs?: Array<{ sprite: string }> }>(`maps/${f}`).npcs ?? [])
  .map((n) => n.sprite);
/**
 * GAP-10 (W1-B): the NPCs of the compiled 2x maps (assets/maps/ai, what the game plays) and of their sources
 * (assets-src/maps, which the region tranches write). New NPC kinds reuse an existing field sheet plus a `tint`.
 */
type MapNpc = { id: string; sprite: string; tint?: unknown };
const npcsIn = (dir: string): Array<MapNpc & { map: string }> => (existsSync(dir) ? readdirSync(dir) : [])
  .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
  .flatMap((f) => ((parse(readFileSync(join(dir, f), 'utf-8')) as { npcs?: MapNpc[] } | null)?.npcs ?? [])
    .map((n) => ({ ...n, map: f })));
const compiledNpcs = [...npcsIn(join(assets, 'maps/ai')), ...npcsIn(resolve(__dirname, '../../assets-src/maps'))];
const fieldAiAtlas = JSON.parse(readFileSync(join(assets, 'sprites/characters-ai.json'), 'utf-8')) as {
  sheets: Record<string, unknown>; fallbacks?: Record<string, string>;
};

describe('asset coverage (run `npm run assets` after adding content)', () => {
  describe('character sheets', () => {
    it.each(classes.map((c) => c.id))('class "%s" has a character sheet', (id) => {
      expect(atlas.sheets[id]).toBeDefined();
    });

    it.each([...new Set(mapNpcSprites)])('NPC sprite "%s" has a character sheet', (sprite) => {
      expect(atlas.sheets[sprite]).toBeDefined();
    });

    it.each([...new Set(compiledNpcs.map((n) => n.sprite))])('compiled-map NPC sprite "%s" has a 2x field sheet', (sprite) => {
      expect(fieldAiAtlas.sheets[sprite] ?? fieldAiAtlas.sheets[fieldAiAtlas.fallbacks?.[sprite] ?? '']).toBeDefined();
    });

    it('every compiled-map NPC tint is "#rrggbb"', () => {
      expect(compiledNpcs.length).toBeGreaterThan(0);
      for (const n of compiledNpcs.filter((x) => x.tint !== undefined)) {
        expect(n.tint, `${n.map} ${n.id}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('is a two-tile (16x32) layout with 6 columns and 5 rows per sheet', () => {
      expect(atlas.cell).toEqual([16, 32]);
      expect(atlas.cols).toBe(6);
      expect(atlas.rows).toBe(5);
    });

    it('has every sheet inside the atlas image bounds', () => {
      const png = readFileSync(join(assets, 'sprites/characters.png'));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      const blockW = atlas.cell[0] * atlas.cols * 3;
      const blockH = atlas.cell[1] * atlas.rows * 3;
      for (const [id, o] of Object.entries(atlas.sheets)) {
        expect(o.x * 3 + blockW, id).toBeLessThanOrEqual(width);
        expect(o.y * 3 + blockH, id).toBeLessThanOrEqual(height);
      }
    });
  });

  describe('battle sprites (2x art)', () => {
    it.each(classes.map((c) => c.id))('class "%s" has battle poses', (id) => {
      expect(battleAtlas.sheets[id]).toBeDefined();
    });

    it('uses the 2x art scale with 160 px on-screen cells and every pose the battle scene uses', () => {
      expect(battleAtlas.scale).toBe(2);
      expect(battleAtlas.cell[1] * battleAtlas.scale).toBe(160);
      expect(battleAtlas.footRow).toBeLessThan(battleAtlas.cell[1]);
      // pass K (docs/KNEEL_PLAN.md 3): the 14 old columns in order, then the 4 kneel columns once the atlas has them
      // (an older atlas without them: CharacterAtlas.POSE_FALLBACK maps them to `ready`)
      const old = BATTLE_POSES.filter((p) => !isKneelFrame(p));
      expect(battleAtlas.poses.slice(0, old.length)).toEqual(old);
      expect([[], [...KNEEL_FRAMES]]).toContainEqual(battleAtlas.poses.slice(old.length).filter((p) => isKneelFrame(p)));
    });

    it('only lists known classes, and the image matches cell x scale x poses by rows', () => {
      const classIds = new Set(classes.map((c) => c.id));
      for (const id of Object.keys(battleAtlas.sheets)) expect(classIds.has(id), id).toBe(true);
      const png = readFileSync(join(assets, 'sprites/battle-characters-ai.png'));
      // pass CL (docs/CLASS_LANCE_PLAN.md 3.1): the main file holds the main-page (80 x 80) sheets; an oversize page
      // is listed in `pages` with its size, and every listed page file exists at that size
      const sheets = battleAtlas.sheets as Record<string, { page?: number }>;
      const mainRows = Object.values(sheets).filter((s) => !s.page).length;
      expect(png.readUInt32BE(16)).toBe(battleAtlas.cell[0] * battleAtlas.scale * battleAtlas.poses.length);
      expect(png.readUInt32BE(20)).toBe(battleAtlas.cell[1] * battleAtlas.scale * mainRows);
      const pages = (battleAtlas as { pages?: { file: string; w: number; h: number }[] }).pages ?? [];
      for (const p of pages) {
        const f = readFileSync(join(assets, 'sprites', p.file));
        expect([f.readUInt32BE(16), f.readUInt32BE(20)], p.file).toEqual([p.w, p.h]);
      }
      for (const s of Object.values(sheets)) if (s.page) expect(pages[s.page], `page ${s.page}`).toBeDefined();
    });
  });

  describe('AI field atlas (preview art, optional)', () => {
    const metaPath = join(assets, 'sprites/characters-ai.json');
    const present = existsSync(metaPath);
    const meta = present
      ? (JSON.parse(readFileSync(metaPath, 'utf-8')) as { cell: [number, number]; cols: number; rows: number; fieldScale: number; rowNames: string[]; sheets: Record<string, { x: number; y: number }>;
        walkSequence?: number[]; walkPhases?: number })
      : null;

    it.runIf(present)('frames are one 96 px preview tile wide and two tiles tall at 2x', () => {
      expect(meta!.fieldScale).toBe(2);
      expect(meta!.cell[0] * meta!.fieldScale).toBe(96);
      expect(meta!.cell[1] * meta!.fieldScale).toBe(192);
      expect(meta!.rowNames).toEqual(['down', 'up', 'left', 'right']);
      expect([meta!.cols, meta!.rows]).toEqual([7, 4]);
      // stand + contact/down/pass for each foot, three frames per tile
      expect(meta!.walkSequence).toEqual([1, 2, 3, 4, 5, 6]);
      expect(meta!.walkPhases).toBe(3);
    });

    it.runIf(present)('every NPC sprite on a compiled map has 2x field art (or legacy art)', () => {
      const sprites = readdirSync(join(assets, 'maps/ai'))
        .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
        .flatMap((f) => readYaml<{ npcs?: Array<{ sprite: string }> }>(`maps/ai/${f}`).npcs ?? [])
        .map((n) => n.sprite);
      for (const sp of new Set(sprites)) {
        expect(sp in meta!.sheets || sp in atlas.sheets, sp).toBe(true);
      }
    });

    it.runIf(present)('the T6 townsfolk (vendor_f, farmer, burgher) are on the cornelia map and drawn from the 2x atlas', () => {
      const cornelia = (readYaml<{ npcs?: Array<{ sprite: string }> }>('maps/ai/cornelia.yaml').npcs ?? []).map((n) => n.sprite);
      for (const sp of ['vendor_f', 'farmer', 'burgher']) {
        expect(cornelia, sp).toContain(sp);
        expect(meta!.sheets[sp], `${sp} in characters-ai.json`).toBeDefined();
      }
    });

    it.runIf(present)('only lists known classes or NPC sprites, every block inside the image', () => {
      // NPC sprite names are the keys of the legacy character atlas that are not classes
      const compiledNpcSprites = readdirSync(join(assets, 'maps/ai'))
        .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
        .flatMap((f) => readYaml<{ npcs?: Array<{ sprite: string }> }>(`maps/ai/${f}`).npcs ?? [])
        .map((n) => n.sprite);
      const classIds = new Set([...classes.map((c) => c.id), ...Object.keys(atlas.sheets), ...compiledNpcSprites]);
      const png = readFileSync(join(assets, 'sprites/characters-ai.png'));
      const w = png.readUInt32BE(16);
      const h = png.readUInt32BE(20);
      const s = meta!.fieldScale;
      for (const [id, o] of Object.entries(meta!.sheets)) {
        expect(classIds.has(id), id).toBe(true);
        expect((o.x + meta!.cell[0] * 3) * s).toBeLessThanOrEqual(w);
        expect((o.y + meta!.cell[1] * 4) * s).toBeLessThanOrEqual(h);
      }
    });
  });

  describe('monster art (2x, with poses)', () => {
    it.each(enemies.map((e) => [e.id, spriteOf(e)]))('enemy "%s" has monster art (%s)', (_id, sprite) => {
      expect(monsterAtlas.sheets[sprite]).toBeDefined();
    });

    it('every atlas page is a PNG of its listed size, at most 2048x2048 native (FW-8)', () => {
      const ts = monsterAtlas.texScale ?? monsterAtlas.scale;     // PNG px per art px (1 = native atlas)
      expect(monsterAtlas.pages.length).toBeGreaterThan(0);
      monsterAtlas.pages.forEach((p, i) => {
        expect(p.file, `page ${i}`).toBe(`monsters-ai-${i}.png`);
        const png = readFileSync(join(assets, 'sprites', p.file));
        expect([png.readUInt32BE(16), png.readUInt32BE(20)], p.file).toEqual([p.w * ts, p.h * ts]);
        expect(Math.max(p.w, p.h), `${p.file} (native px)`).toBeLessThanOrEqual(2048);
      });
      expect(existsSync(join(assets, 'sprites/monsters-ai.png')), 'the R0 single-page atlas is gone').toBe(false);
    });

    it('every entry has every MONSTER_FRAMES key (bosses with cast: every BOSS_FRAMES key) inside its page, feet inside the cell', () => {
      const ts = monsterAtlas.texScale ?? monsterAtlas.scale;     // PNG px per art px (1 = native atlas)
      for (const [id, e] of Object.entries(monsterAtlas.sheets)) {
        const page = monsterAtlas.pages[e.page];
        expect(page, `${id} page ${e.page}`).toBeDefined();
        const [w, h] = [page.w * ts, page.h * ts];
        // every sheet has daze / daze_b (pass F 5a); the heavy raise frames only with hasRaise (pass F 7)
        // pass K: the 4 kneel names come all together (own rects or aliased per D-K7) or not at all (an atlas before K1)
        const kneel = 'kneel' in e.frames;
        // EF-D: an orbit sheet (idleOrbit N) has idle_o<k> / idle_b_o<k> for k < N; every other sheet none
        const orbit = e.idleOrbit ?? 0;
        const want = ('cast' in e.frames ? BOSS_FRAMES : MONSTER_FRAMES).filter((n) => !!e.hasRaise || !RAISE_FRAMES.has(n))
          .filter((n) => kneel || !isKneelFrame(n))
          .filter((n) => !isOrbitFrame(n) || Number(n.slice(n.lastIndexOf('o') + 1)) < orbit);
        expect(Object.keys(e.frames).sort(), id).toEqual([...want].sort());
        const t = e.texScale ?? ts;                                // EF-A4: a hi-res sheet's own texScale
        for (const [x, y] of Object.values(e.frames)) {
          expect(x * t + Math.ceil(e.cell[0] * t), id).toBeLessThanOrEqual(w);
          expect(y * t + Math.ceil(e.cell[1] * t), id).toBeLessThanOrEqual(h);
        }
        expect(e.footRow, id).toBeLessThan(e.cell[1]);
      }
    });

    it('generated frames: their own rects when animated (except held and FW-Q aliased frames), else aliased to the source keyframe', () => {
      for (const [id, e] of Object.entries(monsterAtlas.sheets)) {
        const holds = e.holds ?? [];
        const aliased = fwqAliased(id);
        for (const n of Object.keys(e.frames) as MonsterFrame[]) {
          if (FRAME_SOURCE[n] === n) continue;
          if (isKneelFrame(n)) {                   // D-K7: an own rect (opted in) or the fallback chain's (kneel -> daze ...)
            const alias = e.frames[resolveFrame(FRAME_FALLBACK[n], (f) => f in e.frames && !isKneelFrame(f)) ?? 'idle'];
            const own = !Object.entries(e.frames).some(([k, r]) => !isKneelFrame(k) && r.join() === e.frames[n].join());
            expect(own || e.frames[n].join() === alias.join(), `${id} ${n}`).toBe(true);
            continue;
          }
          if (aliased.has(n)) {                    // FW-Q partial rig: that sequence resolves to its keys
            expect(e.frames[n].join(), `${id} ${n} (FW-Q aliased)`).toBe(e.frames[FRAME_SOURCE[n]].join());
            continue;
          }
          if (holds.includes(n)) {                 // a held frame shows its fallback (e.g. atk_raise_in -> atk_wind1)
            expect(e.frames[n].join(), `${id} ${n}`).toBe(e.frames[FRAME_FALLBACK[n]].join());
            continue;
          }
          const own = e.frames[n].join() !== e.frames[FRAME_SOURCE[n]].join();
          expect(own, `${id} ${n}`).toBe(!!e.anim);
        }
        for (const prefix of ['atk_', 'hurt_in', 'cast_', 'daze']) {
          expect(holds.filter((f) => f.startsWith(prefix)).length, `${id} holds ${prefix}*`).toBeLessThanOrEqual(1);
        }
        expect(e.lungePx, id).toBeGreaterThanOrEqual(24);
        expect(e.lungePx, id).toBeLessThanOrEqual(40);
      }
    });

    it('the bosses carry the heavy raise (hasRaise) and every sheet has its runtime anchors (opaqueRight, head)', () => {
      for (const id of ['garland', 'lich']) expect(monsterAtlas.sheets[id].hasRaise, id).toBe(true);
      for (const [id, e] of Object.entries(monsterAtlas.sheets)) {
        expect(e.hasRaise ?? false, id).toBe('attack_raise' in e.frames);
        expect(e.opaqueRight, id).toBeGreaterThan(0);
        expect(e.opaqueRight!, id).toBeLessThan(e.cell[0]);
        const [hx, hy] = e.head!;
        expect(hx >= 0 && hx < e.cell[0] && hy >= 0 && hy < e.footRow, id).toBe(true);
      }
    });

    it('no palette-swap variants remain: every enemy is its own drawn sprite (roster pass R)', () => {
      const specs = parse(readFileSync(join(assets, '../assets-src/gen/monsters.yaml'), 'utf-8')) as
        Array<{ id: string; variants?: Array<{ id: string }> }>;
      expect(specs.flatMap((m) => (m.variants ?? []).map((v) => v.id))).toEqual([]);
      for (const id of ['gr_imp', 'gr_wolf']) expect(specs.some((m) => m.id === id), id).toBe(true);
    });

    it('only lists sprites some enemy uses', () => {
      const used = new Set(enemies.map(spriteOf));
      for (const id of Object.keys(monsterAtlas.sheets)) expect(used.has(id), id).toBe(true);
    });
  });

  describe('battle stage backgrounds', () => {
    const scenarioBackgrounds = readYaml<Array<{ background?: string }>>('data/debug-scenarios.yaml')
      .map((s) => s.background).filter((x): x is string => !!x);

    it.each([...new Set(scenarioBackgrounds)])('debug scenario background %s exists', (path) => {
      expect(existsSync(resolve(assets, '..', path))).toBe(true);
    });

    // Only the referenced (act-1) ids are committed; the other STAGES ids stay staged locally (FIX_PLAN T6 revision 1).
    type Table = { default?: string; terrain?: Record<string, string> };
    const tableIds = (t: Table | undefined): string[] => (t ? [t.default, ...Object.values(t.terrain ?? {})] : [])
      .filter((x): x is string => !!x);
    const mapIds = ['maps', 'maps/ai', '../assets-src/maps'].flatMap((dir) => readdirSync(join(assets, dir))
      .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
      .flatMap((f) => {
        const cfg = readYaml<{ battleBackgrounds?: Table & { zones?: Record<string, Table> } }>(`${dir}/${f}`).battleBackgrounds;
        return [...tableIds(cfg), ...Object.values(cfg?.zones ?? {}).flatMap(tableIds)];
      }));
    // The overworld's encounter-zone backdrops (T6a contract: temple_approach forest, east_pocket) and the beach.
    const act1ZoneIds = ['dark_forest', 'ruined_forest', 'shoreline'];
    const scenarioIds = scenarioBackgrounds.map((p) => p.match(/^assets\/backgrounds\/(\w+)\.webp$/)?.[1] ?? p);
    const referenced = [...new Set([...mapIds, ...act1ZoneIds, ...scenarioIds])].sort();
    const stageScript = readFileSync(join(assets, '../assets-src/tools/stage_backgrounds.py'), 'utf-8');
    const stagesBody = stageScript.slice(stageScript.indexOf('STAGES = {'), stageScript.indexOf('\n}\n'));
    const stageIds = new Set([...stagesBody.matchAll(/^\s+"(\w+)": \(/gm)].map((m) => m[1]));
    // `rim` (the Chaos arena, CHAOS_FORMS_PLAN 7.2) is staged by tools/stage_rim.py, which stage_backgrounds.py dispatches to
    if (/if "rim" in argv\[1:\]: return .*stage_rim\.py/.test(stageScript)) stageIds.add('rim');

    /** Width and height of a WebP file (lossy VP8, lossless VP8L or extended VP8X). */
    const webpSize = (buf: Buffer): [number, number] => {
      expect(buf.toString('ascii', 0, 4) + buf.toString('ascii', 8, 12)).toBe('RIFFWEBP');
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
      if (chunk === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
      }
      expect(chunk).toBe('VP8X');
      return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
    };

    it('the act-1 temple and zone ids are referenced', () => {
      expect(referenced).toEqual(expect.arrayContaining(['temple', 'dark_forest', 'ruined_forest', 'shoreline']));
    });

    it('the overworld zone backdrops (T6h) are referenced by a map table, not only listed here', () => {
      expect(mapIds).toEqual(expect.arrayContaining(['dark_forest', 'ruined_forest', 'shoreline']));
    });

    it.each(referenced)('background "%s" is a staged id with a 1920x1080 webp', (id) => {
      expect(stageIds.has(id), `${id} in STAGES`).toBe(true);
      const path = join(assets, 'backgrounds', `${id}.webp`);
      expect(existsSync(path), path).toBe(true);
      expect(webpSize(readFileSync(path))).toEqual([1920, 1080]);
    });

    it('STAGES lists the 21 TF-3 sources under their snake_case stems, temple = evil-temple, fiend_hall kept', () => {
      const tf3 = ['abandoned_castle', 'chaos', 'cracked_earth', 'dark_forest', 'evil_temple', 'fire_temple', 'ice_cave',
        'magic_forest', 'magma_temple', 'palace', 'red_forest', 'ruined_forest', 'sky_palace', 'swamp_cave', 'throne_kary',
        'throne_kraken', 'throne_lich', 'throne_tiamat', 'tower_of_babel', 'town', 'water_temple'];
      for (const id of tf3) expect(stagesBody, id).toContain(`"${id}": ("${id.replace(/_/g, '-')}-hd.png"`);
      expect(stagesBody).toContain('"temple": ("evil-temple-hd.png"');
      expect(stagesBody).toContain('"fiend_hall": ("temple-of-fiends-hd.png"');
    });
  });

  describe('audio', () => {
    const files = [...Object.entries(manifest.music), ...Object.entries(manifest.sfx)];
    it.each(files)('"%s" → %s exists', (_id, path) => {
      expect(existsSync(resolve(assets, '..', path))).toBe(true);
    });
  });
});
