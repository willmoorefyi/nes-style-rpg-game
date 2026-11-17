/**
 * G9's bound check (docs/QUEST_PLAN.md 7 G9, 6.2; docs/WORLD_PLAN.md 7): every balance test name carries its measured
 * value as `(measured 82.5)` next to its bound(s), and every bound sits at least 3 points from its measured value
 * (at least 2 rounds for a round count, D-C7-19). A test whose name says `invariant` is asserted exactly and is exempt.
 *
 *   npx vite-node scripts/check-bounds.ts tests/balance/w_*.test.ts
 *
 * Prints `check-bounds: OK (<n> tests)`, or one line per problem and exits 1. An unmatched glob (no file yet) is not
 * an error: it reads no file.
 *
 * Bounds read from a name: `>= 85`, `<= 60`, `at least 85`, `at most 45`, a range `75-95 %` (or `60 to 80 %`), and
 * `in [10, 15]`. Each bound pairs with the next `measured` tag after it (else the last one before it). A bound is a
 * round count when its number is followed by "round(s)", or when its part of the name mentions rounds.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export interface Problem { name: string; message: string }

const NUM = '(\\d+(?:\\.\\d+)?)';
const POINTS = 3;
const ROUNDS = 2;

interface Bound { lo?: number; hi?: number; at: number; end: number; rounds: boolean }

/** The bounds and measured tags of one test name (exported for the unit test). */
export function parseName(name: string): { bounds: Bound[]; measured: { value: number; at: number }[] } {
  const measured = [...name.matchAll(new RegExp(`measured ${NUM}`, 'g'))].map((m) => ({ value: Number(m[1]), at: m.index ?? 0 }));
  const taken: [number, number][] = measured.map((m) => [m.at, m.at + 9]);
  const free = (a: number, b: number): boolean => !taken.some(([x, y]) => a < y && b > x);
  const bounds: Bound[] = [];
  const unitAfter = (end: number): boolean => /^\s*rounds?\b/i.test(name.slice(end));
  const add = (b: Omit<Bound, 'rounds'>): void => {
    if (!free(b.at, b.end)) return;
    taken.push([b.at, b.end]);
    bounds.push({ ...b, rounds: unitAfter(b.end) });
  };
  for (const m of name.matchAll(new RegExp(`\\[\\s*${NUM}\\s*,\\s*${NUM}\\s*\\]`, 'g'))) {
    add({ lo: Number(m[1]), hi: Number(m[2]), at: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  for (const m of name.matchAll(new RegExp(`${NUM}\\s*(?:-|to)\\s*${NUM}(?=\\s*(?:%|rounds?\\b))`, 'g'))) {
    add({ lo: Number(m[1]), hi: Number(m[2]), at: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  for (const m of name.matchAll(new RegExp(`(>=|<=|≥|≤|at least|at most)\\s*${NUM}`, 'g'))) {
    const v = Number(m[2]);
    const lower = m[1] === '>=' || m[1] === '≥' || m[1] === 'at least';
    add({ ...(lower ? { lo: v } : { hi: v }), at: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  bounds.sort((a, b) => a.at - b.at);
  return { bounds, measured };
}

/** The problems of one test name: [] when it is fine. */
export function checkName(name: string): string[] {
  if (/\binvariant\b/i.test(name)) return [];
  const { bounds, measured } = parseName(name);
  if (measured.length === 0) return ['no (measured N) tag'];
  if (bounds.length === 0) return ['no bound next to its measured value'];
  const used = new Set<number>();
  const out: string[] = [];
  for (const b of bounds) {
    const i = measured.findIndex((m) => m.at > b.at);
    const k = i >= 0 ? i : measured.length - 1;
    used.add(k);
    const v = measured[k].value;
    const prev = k > 0 ? measured[k - 1].at : 0;
    const part = name.slice(prev, measured[k].at);
    const rounds = b.rounds || /\brounds?\b/i.test(part);
    const margin = rounds ? ROUNDS : POINTS;
    const unit = rounds ? 'rounds' : 'points';
    const eps = 1e-9;
    if (b.lo !== undefined && v - b.lo < margin - eps) out.push(`bound >= ${b.lo} is ${+(v - b.lo).toFixed(3)} ${unit} from measured ${v} (needs ${margin})`);
    if (b.hi !== undefined && b.hi - v < margin - eps) out.push(`bound <= ${b.hi} is ${+(b.hi - v).toFixed(3)} ${unit} from measured ${v} (needs ${margin})`);
  }
  measured.forEach((m, k) => { if (!used.has(k)) out.push(`measured ${m.value} has no bound`); });
  return out;
}

/** The literal names of the `it` / `test` cases in a test file (an `it.each(...)` name template included). */
export function testNames(source: string): string[] {
  const names: string[] = [];
  const head = /\b(?:it|test)(?:\.(?:skip|only|concurrent|each))?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = head.exec(source))) {
    let i = m.index + m[0].length;
    if (m[0].includes('.each')) {
      let depth = 1;
      while (i < source.length && depth > 0) {
        const c = source[i++];
        if (c === '(') depth++;
        else if (c === ')') depth--;
      }
      const rest = /^\s*\(/.exec(source.slice(i));
      if (!rest) continue;
      i += rest[0].length;
    }
    const lit = /^\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/.exec(source.slice(i));
    if (lit) names.push(lit[2].replace(/\\(['"`\\])/g, '$1'));
  }
  return names;
}

/** Expand a path with `*` in its file name (the shell leaves an unmatched glob as it is). */
export function expand(arg: string): string[] {
  if (!arg.includes('*')) return existsSync(arg) ? [arg] : [];
  const dir = dirname(arg);
  if (!existsSync(dir)) return [];
  const re = new RegExp(`^${basename(arg).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => join(dir, f));
}

/** Check every file; returns the problems and the number of test names read. */
export function checkFiles(args: string[]): { problems: Problem[]; tests: number } {
  const problems: Problem[] = [];
  let tests = 0;
  for (const file of [...new Set(args.flatMap(expand))]) {
    for (const name of testNames(readFileSync(file, 'utf-8'))) {
      tests++;
      for (const message of checkName(name)) problems.push({ name: `${file}: "${name}"`, message });
    }
  }
  return { problems, tests };
}

function main(): void {
  const { problems, tests } = checkFiles(process.argv.slice(2).filter((a) => !a.startsWith('-')));
  if (problems.length > 0) {
    for (const p of problems) console.log(`check-bounds: ${p.name}: ${p.message}`);
    console.log(`check-bounds: FAIL (${problems.length} problems in ${tests} tests)`);
    process.exit(1);
  }
  console.log(`check-bounds: OK (${tests} tests)`);
}

if (!process.env.VITEST) main();
