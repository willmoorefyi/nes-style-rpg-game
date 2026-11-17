/**
 * The pass W owner anchors in the shared YAML files (docs/WORLD_PLAN.md 5.1 W1-0a, 5.5): every region tranche has one
 * pair in shops, items, cutscenes and debug-scenarios; kits.yaml has W1-F's; each owned boss record in enemies.yaml
 * sits inside its owner's pair. Pairs never nest and every pair is closed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const REGION_TRANCHES = ['A1-O', 'A1-T', 'ELF-O', 'ELF-T', 'ELF-D', 'ERT-O', 'ERT-T', 'ERT-D', 'FIR-O', 'FIR-T',
  'FIR-D1', 'FIR-D2', 'ORD-O', 'WAT-O', 'WAT-T', 'WAT-D', 'WND-O', 'WND-T', 'WND-D1', 'WND-D2', 'PST'];

/** The anchor pairs of a file, as [owner, label] in order (the label adds a record id in enemies.yaml). */
function pairs(path: string): [string, string][] {
  const out: [string, string][] = [];
  let open: string | null = null;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const start = /^# === ((\S+)(?: (\S+))?) \(pass W: owned by (\S+?)[;)]/.exec(line);
    const end = /^# === end (.+) ===$/.exec(line);
    if (start) {
      expect(open, `${path}: ${start[1]} opens inside ${open}`).toBeNull();
      expect(start[4]).toBe(start[2]);
      open = start[1];
      out.push([start[2], start[1]]);
    } else if (end) {
      expect(end[1], path).toBe(open);
      open = null;
    }
  }
  expect(open, `${path}: unclosed`).toBeNull();
  return out;
}

describe('pass W anchors', () => {
  it.each([
    ['assets/data/shops.yaml', ['W1-F']],
    ['assets/data/items.yaml', ['W1-F']],
    ['assets/data/cutscenes.yaml', ['W1-B']],
    ['assets/data/debug-scenarios.yaml', ['W1-A', 'W1-B']],
  ])('%s has one pair per region tranche (and its W1 owners)', (path, w1) => {
    expect(pairs(path).map(([owner]) => owner)).toEqual([...w1, ...REGION_TRANCHES]);
  });

  it('kits.yaml has the single W1-F pair', () => {
    expect(pairs('assets/data/kits.yaml')).toEqual([['W1-F', 'W1-F']]);
  });

  it('enemies.yaml wraps each owned boss record in its owner\'s pair', () => {
    const text = readFileSync('assets/data/enemies.yaml', 'utf-8');
    const owned = pairs('assets/data/enemies.yaml');
    expect(owned.length).toBe(16);
    for (const [owner, label] of owned) {
      const id = label.slice(owner.length + 1);
      const block = new RegExp(`^# === ${label} \\(pass W[^\\n]*\\n- id: ${id}\\n[\\s\\S]*?^# === end ${label} ===$`, 'm');
      expect(block.test(text), label).toBe(true);
    }
  });
});
