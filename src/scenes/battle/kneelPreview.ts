/**
 * Dev-only kneel preview and pose label (docs/KNEEL_PLAN.md 6, 8), no battle logic:
 *   ?kneel=on      every actor on both sides kneels (a forced `kneel` posture; stone, daze and still keep theirs)
 *   ?kneel=loop    each actor toggles every KNEEL_LOOP_PERIOD frames, staggered KNEEL_LOOP_STAGGER per actor
 *   &poseLabel=1   a corner label, `<name>: <frame> / <t>` per actor (enemies, then heroes; poseLabelLines); with
 *                  ?battleStep=1 it is the deterministic capture of section 8
 * BattleScene ticks it once per update with the dev clock's dt, next to enemyAnimPreview.tick().
 */
import { BitmapText, type Container } from 'pixi.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { LABEL_POS, poseLabelLines } from './enemyAnimPreview.js';
import type { EnemyPoseController } from './EnemyPoseController.js';
import type { BattlePose } from '../../rendering/CharacterAtlas.js';

export type KneelMode = 'on' | 'loop';
export const KNEEL_LOOP_PERIOD = 150;
export const KNEEL_LOOP_STAGGER = 20;

export interface KneelPreviewConfig { mode: KneelMode | null; poseLabel: boolean }

/** What the URL asks for, or null (no preview, no label). */
export function parseKneelPreview(search: string): KneelPreviewConfig | null {
  const q = new URLSearchParams(search);
  const k = q.get('kneel');
  const mode = k === 'on' || k === 'loop' ? k : null;
  const poseLabel = q.get('poseLabel') === '1';
  return mode || poseLabel ? { mode, poseLabel } : null;
}

/** Actor `k` (enemies first, then heroes) is forced to kneel at `clock`. */
export function kneelForced(mode: KneelMode | null, clock: number, k: number): boolean {
  if (mode === 'on') return true;
  if (mode !== 'loop') return false;
  const local = clock - k * KNEEL_LOOP_STAGGER;
  return local >= 0 && Math.floor(local / KNEEL_LOOP_PERIOD) % 2 === 0;
}

/** The parts of BattleDisplayManager the preview drives and reads. */
export interface KneelHost {
  kneelForce: ((side: 'party' | 'enemy', i: number) => boolean) | null;
  enemyView: { poses: EnemyPoseController } | null;
  enemySprites: readonly unknown[];
  partySprites: readonly unknown[];
  partyPose(i: number): BattlePose;
  partyPoseT(i: number): number;
}

export interface KneelNames { allEnemies: readonly { displayName: string }[]; allParty: readonly { name: string }[] }

export class KneelPreview {
  private clock = 0;
  private label: BitmapText | null = null;

  constructor(readonly cfg: KneelPreviewConfig, private readonly host: KneelHost, private readonly names: KneelNames) {
    const enemies = host.enemySprites.length;
    if (cfg.mode) host.kneelForce = (side, i) => kneelForced(cfg.mode, this.clock, side === 'enemy' ? i : enemies + i);
  }

  /** One frame of the (dev) battle clock. */
  advance(dt: number): void { this.clock += dt; }

  /** Enemy lines, then hero lines. */
  labelLines(): string[] {
    const h = this.host;
    const enemyName = (i: number) => this.names.allEnemies[i]?.displayName ?? `enemy ${i}`;
    const heroName = (i: number) => this.names.allParty[i]?.name ?? `hero ${i}`;
    const heroes = { state: (i: number) => ({ pose: h.partyPose(i) }), debug: (i: number) => ({ t: h.partyPoseT(i) }) };
    return [...(h.enemyView ? poseLabelLines(h.enemyView.poses, enemyName, h.enemySprites.length) : []),
      ...poseLabelLines(heroes, heroName, h.partySprites.length)];
  }

  /** The corner label (only with `&poseLabel=1`). */
  showLabel(parent: Container): void {
    if (!this.cfg.poseLabel) return;
    if (!this.label) {
      this.label = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: 24, fill: 0xffff00 } });
      this.label.position.set(LABEL_POS.x, LABEL_POS.y);
      parent.addChild(this.label);
    }
    this.label.text = this.labelLines().join('\n');
  }

  dispose(): void {
    if (this.host.kneelForce) this.host.kneelForce = null;
    this.label?.parent?.removeChild(this.label);
    this.label = null;
  }
}

const active = new WeakMap<object, KneelPreview>();

/** BattleScene's hook: one call per update with the dev clock's dt. No-op outside dev builds or without the URL keys. */
export const kneelPreview = {
  tick(host: KneelHost, names: KneelNames, container: Container, dt: number): void {
    if (!import.meta.env.DEV || typeof location === 'undefined') return;
    let p = active.get(host);
    if (!p) {
      const cfg = parseKneelPreview(location.search);
      if (!cfg) return;
      p = new KneelPreview(cfg, host, names);
      active.set(host, p);
    }
    p.advance(dt);
    p.showLabel(container);
  },
  dispose(host: object): void {
    active.get(host)?.dispose();
    active.delete(host);
  },
};
