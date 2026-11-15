/**
 * The battle sandbox's session state (docs/FEEDBACK_PLAN_2026-11-14.md §3.8): the W / L / escape tally per setup for
 * this page load, and the last configuration in `localStorage` `ff.debug.sandbox` (failures are logged).
 */

export type SandboxOutcome = 'win' | 'loss' | 'escape';

export interface SandboxResult {
  outcome: SandboxOutcome;
  rounds: number;
  /** The party's HP at the end as a percentage of its max HP (0-100, rounded). */
  hpPercent: number;
}

export interface SandboxTally { win: number; loss: number; escape: number }

export const SANDBOX_KEY = 'ff.debug.sandbox';

export class SandboxSession {
  private readonly tallies = new Map<string, SandboxTally>();
  last: (SandboxResult & { key: string }) | null = null;
  /** The `?sandbox=` deep link already ran on this page load. */
  deepLinkUsed = false;

  record(key: string, result: SandboxResult): void {
    const t = this.tally(key);
    t[result.outcome]++;
    this.tallies.set(key, t);
    this.last = { ...result, key };
  }

  tally(key: string): SandboxTally {
    return { ...(this.tallies.get(key) ?? { win: 0, loss: 0, escape: 0 }) };
  }

  /** The results line for a setup: its tally, and the last battle (of any setup). */
  summary(key: string): string {
    const t = this.tally(key);
    const head = `W ${t.win}  L ${t.loss}  Run ${t.escape}`;
    if (!this.last) return head;
    const what = { win: 'won', loss: 'lost', escape: 'ran' }[this.last.outcome];
    const where = this.last.key === key ? '' : ' (other setup)';
    return `${head}   Last: ${what}, ${this.last.rounds} rounds, party HP ${this.last.hpPercent}%${where}`;
  }
}

/** One session per page load (the scene instance is cached too, but this survives a re-registration). */
export const sandboxSession = new SandboxSession();

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' || localStorage === null ? null : localStorage;
  } catch (err) {
    console.warn('Debug sandbox: localStorage is not accessible', err);
    return null;
  }
}

/** The stored configuration (unchecked; see `sanitizeConfig`), or null. */
export function loadSandboxConfig(): unknown {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(SANDBOX_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch (err) {
    console.warn(`Debug sandbox: cannot read ${SANDBOX_KEY}`, err);
    return null;
  }
}

export function saveSandboxConfig(config: unknown): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(SANDBOX_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn(`Debug sandbox: cannot write ${SANDBOX_KEY}`, err);
  }
}
