/**
 * M7-0's static render (docs/MODE7_PLAN.md 10; dev only, `?mode7=pilot&scenario=<id>&preset=a|b|c[&aniso=N]`): the
 * world seen tilted from the scenario's spot, with no movement and no ship. It composes the stand-in atlas, runs the
 * pilot's GPU checks (render-texture mips, NPOT mips, anisotropy, the dynamic UV buffer) and keeps redrawing the strips
 * every frame so the frame time includes the row table and the upload. Results: `window.__mode7`.
 */
import { Container, type WebGLRenderer } from 'pixi.js';
import type { Game } from '../../../core/Game.js';
import type { MapData, Scene } from '../../../types/index.js';
import { DebugScenarioLoader, pickScenario } from '../../../systems/DebugScenarioLoader.js';
import { FlightSky } from './FlightSky.js';
import { GroundStrips } from './GroundStrips.js';
import { releaseMeshTextures } from './meshRelease.js';
import { depthAt, type ViewParams } from './mode7Math.js';
import { pickPreset, presetView, type PilotPreset } from './pilotPresets.js';
import { atlasCellPx, atlasTexture, composeStandIn, fillTexture, glInfo, meanRgb, readMip, readScreenRow, rowDiff,
  samplerState, type StandInAtlas } from './pilotGl.js';

const SAMPLES = 600;
const RED = 0xff0000;

/** The 95th percentile of a list of numbers (0 when empty). */
export function p95(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

export class Mode7PilotScene implements Scene {
  readonly container = new Container();
  private sky: FlightSky | null = null;
  private strips: GroundStrips | null = null;
  private atlas: StandInAtlas | null = null;
  private view: ViewParams | null = null;
  private readonly frames: number[] = [];
  private readonly updates: number[] = [];
  private tick = 0;
  private readonly report: Record<string, unknown> = { state: 'loading' };

  constructor(private readonly game: Game) {}

  async enter(): Promise<void> {
    (window as unknown as Record<string, unknown>).__mode7 = this.report;
    try {
      await this.build();
    } catch (e) {
      console.error('Mode 7 pilot failed:', e);
      this.report.state = 'failed';
      this.report.error = String(e);
    }
  }

  private async build(): Promise<void> {
    const renderer = this.game.app.renderer;
    if (!('gl' in renderer)) throw new Error('the Mode 7 pilot needs the WebGL renderer');
    const gl = renderer as WebGLRenderer;
    const search = location.search;
    const preset = pickPreset(search);
    const aniso = Number(new URLSearchParams(search).get('aniso') ?? 4);
    const scenario = pickScenario(await new DebugScenarioLoader(this.game).loadScenarios(), search);
    const mapId = scenario?.map ?? 'overworld';
    const map = await this.game.assets.loadYaml<MapData>(`assets/maps/ai/${mapId}.yaml`);
    const at = (scenario?.entrance && map.entrances?.[scenario.entrance]) || [Math.floor(map.width / 2), Math.floor(map.height / 2)];
    if (!map.art) throw new Error(`map ${mapId} has no compiled art`);
    const info = glInfo(gl);
    Object.assign(this.report, { gl: info.renderer, glVersion: info.version, maxTexture: info.maxTexture, preset: preset.id,
      presetName: preset.name, scenario: scenario?.id, map: mapId, cell: at });

    // the mip check: a known colour, regenerated, then the world over it, regenerated again
    const cellPx = await atlasCellPx(map);
    const rt = atlasTexture(map.width * cellPx, aniso);
    fillTexture(gl, rt, RED);
    rt.source.updateMipmaps();
    const levels = rt.source.mipLevelCount;
    const before = meanRgb(readMip(gl, rt.source, levels - 1).px);
    this.atlas = await composeStandIn(gl, rt, map.art, cellPx);
    const after = meanRgb(readMip(gl, rt.source, levels - 1).px);
    const level6 = meanRgb(readMip(gl, rt.source, 6).px);
    const near = after.every((v, i) => Math.abs(v - level6[i]) <= 12);
    this.report.mips = {
      levels, size: this.atlas.size, beforeTop: before, afterTop: after, level6Mean: level6,
      pass: levels === Math.floor(Math.log2(this.atlas.size)) + 1 && before[0] > 250 && before[1] < 5 && after[0] < 200 && near,
    };
    this.report.atlas = { size: this.atlas.size, chunks: this.atlas.chunks, composeMs: Math.round(this.atlas.composeMs),
      gpuMB: +((this.atlas.size ** 2 * 4 * 4) / 3 / 1e6).toFixed(1) };
    this.report.sampler = { ...samplerState(gl, rt.source), requested: aniso };

    this.sky = new FlightSky();
    this.strips = new GroundStrips(rt, map.width, map.height);
    this.container.addChild(this.sky.view, this.strips.far);
    this.view = presetView(preset, at[0] + 0.5, at[1] + 0.5);
    const table = this.strips.update(this.view);
    this.sky.draw(table.firstRow);
    this.describe(preset, this.view, table.firstRow);
    this.report.uvBuffer = this.checkUvBuffer(gl, this.view);
    this.report.state = 'ready';
  }

  /**
   * Render, move P one cell east by a UV upload only, render again, then restore: on the most textured of a few rows,
   * the second image must be the first shifted by that row's px per cell, and the third the first exactly.
   */
  private checkUvBuffer(gl: WebGLRenderer, p: ViewParams): Record<string, unknown> {
    const strips = this.strips;
    if (!strips) return { pass: false };
    const rows = [700, 800, 900, 1000];
    const shot = (): Uint8Array[] => { gl.render({ container: this.container }); return rows.map((y) => readScreenRow(gl, y)); };
    const a = shot();
    const uploads = strips.uploadCount;
    strips.update({ ...p, px: p.px + 1 });
    const b = shot();
    strips.update(p);
    const c = shot();
    const diffs = rows.map((_, i) => rowDiff(a[i], b[i], 0, 200, 1700));
    const i = diffs.indexOf(Math.max(...diffs));
    const ppc = p.f / depthAt(p, rows[i] + 0.5);
    const same = diffs[i];
    const shifted = rowDiff(a[i], b[i], Math.round(ppc), 200, 1600);
    const restored = rows.reduce((n, _, k) => n + rowDiff(a[k], c[k], 0, 0, 1900), 0);
    return { row: rows[i], pxPerCell: +ppc.toFixed(1), uploads: strips.uploadCount - uploads, diffUnshifted: +same.toFixed(2),
      diffShifted: +shifted.toFixed(2), diffRestored: restored, pass: same > 1 && shifted < same / 3 && restored === 0 };
  }

  private describe(preset: PilotPreset, p: ViewParams, horizon: number): void {
    const s = depthAt(p, 820.5);
    this.report.params = { thetaDeg: preset.thetaDeg, h: p.h, kappa: p.kappa, f: p.f, cx: p.cx, cy: +p.cy.toFixed(1),
      back: +p.back.toFixed(2), horizon, shipPxPerCell: +(p.f / s).toFixed(1) };
  }

  update(): void {
    if (!this.strips || !this.view) return;
    const t0 = performance.now();
    this.strips.update(this.view);   // as flight would every frame: the row table and the upload
    this.push(this.updates, performance.now() - t0);
    this.push(this.frames, this.game.app.ticker.deltaMS);
    if (++this.tick % 60 === 0) {
      Object.assign(this.report, { frames: this.tick, frameP95: +p95(this.frames).toFixed(2),
        updateP95: +p95(this.updates).toFixed(3) });
    }
  }

  private push(list: number[], v: number): void {
    list.push(v);
    if (list.length > SAMPLES) list.shift();
  }

  exit(): void {
    this.strips?.destroy();
    this.sky?.destroy();
    releaseMeshTextures(this.game.app.renderer);   // before the atlas the far mesh drew is freed (meshRelease.ts)
    this.atlas?.texture.destroy(true);
    this.strips = null;
    this.sky = null;
    this.atlas = null;
    this.container.removeChildren();
  }
}
