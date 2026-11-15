import type { MessageSpeed } from '../../core/Settings.js';
import type { Kits } from '../../systems/debugParty.js';
import {
  AUTO, CUSTOM, MAX_CUSTOM, PARTY_SIZE, backgroundOf, cycleBackground, cycleClass, cycleFormation, cycleKit, cycleLevel,
  enemiesOf, kitOf, levelOf, togglePromoted, type SandboxConfig, type SandboxData,
} from './sandboxModel.js';

/** The sandbox's menu rows, in order; the cursor opens on `fight`. */
export type SandboxRow = 'level' | 'slot0' | 'slot1' | 'slot2' | 'slot3' | 'promoted' | 'kit' | 'enemies' | 'background'
  | 'speed' | 'fight' | 'title';

export const ROWS: readonly SandboxRow[] = ['level', 'slot0', 'slot1', 'slot2', 'slot3', 'promoted', 'kit', 'enemies',
  'background', 'speed', 'fight', 'title'];

export interface RowContext {
  data: SandboxData;
  kits: Kits;
  /** Class id -> display name. */
  className: (id: string) => string;
  /** Enemy id -> display name. */
  enemyName: (id: string) => string;
  speed: MessageSpeed;
}

const pad = (s: string): string => s.padEnd(14, ' ');
const SPEEDS: readonly MessageSpeed[] = [1, 2, 3, 4, 5];

/** "Goblin x3, Wolf" (in first-seen order). */
export function describeEnemies(ids: readonly string[], name: (id: string) => string): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (counts.size === 0) return '(none)';
  return [...counts].map(([id, n]) => (n > 1 ? `${name(id)} x${n}` : name(id))).join(', ');
}

export function rowLabel(row: SandboxRow, config: SandboxConfig, ctx: RowContext): string {
  const { data } = ctx;
  const level = levelOf(data, config);
  switch (row) {
    case 'level': return `${pad('Level')}< ${level.name} (Lv ${level.level}) >`;
    case 'promoted': return `${pad('Promoted')}< ${config.promoted ? 'on' : 'off'} >`;
    case 'kit': {
      const kit = kitOf(data, config);
      const missing = ctx.kits[kit] ? '' : ' MISSING';
      return `${pad('Kit')}< ${config.kit === AUTO ? `auto: ${kit}` : kit}${missing} >`;
    }
    case 'enemies': {
      const n = level.formations.length;
      const which = config.formation === CUSTOM ? `Custom ${config.custom.length}/${MAX_CUSTOM}` : `${config.formation + 1}/${n}`;
      return `${pad('Enemies')}< ${which}: ${describeEnemies(enemiesOf(data, config), ctx.enemyName)} >`;
    }
    case 'background': {
      const bg = backgroundOf(data, config) ?? 'none';
      return `${pad('Background')}< ${config.background === AUTO ? `auto: ${bg}` : bg} >`;
    }
    case 'speed': return `${pad('Msg speed')}${SPEEDS.map((s) => (s === ctx.speed ? `[${s}]` : ` ${s} `)).join('')}`;
    case 'fight': return 'Fight!';
    case 'title': return 'Title';
    default: {
      const slot = Number(row.slice(4));
      return `${pad(`Slot ${slot + 1}`)}< ${ctx.className(config.party[slot])} >`;
    }
  }
}

/** ←/→ on a row: the new configuration, or null when the row has no value to change (speed is handled apart). */
export function changeRow(row: SandboxRow, config: SandboxConfig, data: SandboxData, dir: number): SandboxConfig | null {
  switch (row) {
    case 'level': return cycleLevel(data, config, dir);
    case 'promoted': return togglePromoted(data, config);
    case 'kit': return cycleKit(data, config, dir);
    case 'enemies': return cycleFormation(data, config, dir);
    case 'background': return cycleBackground(data, config, dir);
    case 'slot0': case 'slot1': case 'slot2': case 'slot3': {
      const slot = Number(row.slice(4));
      return slot < PARTY_SIZE ? cycleClass(data, config, slot, dir) : null;
    }
    default: return null;
  }
}

/** One step slower (-1) or faster (+1), stopping at 1 and 5. */
export function nextSpeed(speed: MessageSpeed, dir: number): MessageSpeed {
  return SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + dir))];
}
