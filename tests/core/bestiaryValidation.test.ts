/**
 * Fh test 10 (docs/BESTIARY_PLAN.md 3.4): a bad bestiary.yaml value logs console.error and falls back to its default.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { DEFAULT_BESTIARY, validateBestiary } from '../../src/core/bestiaryValidation.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const real = (): Record<string, unknown> => parse(readFileSync(join(root, 'assets/data/bestiary.yaml'), 'utf-8')) as Record<string, unknown>;

afterEach(() => { vi.restoreAllMocks(); });

describe('validateBestiary', () => {
  it('the shipped file validates with no error', () => {
    const error = vi.spyOn(console, 'error');
    const data = validateBestiary(real());
    expect(error).not.toHaveBeenCalled();
    expect(data.mode).toBe('all');
    expect(data.labels.title).toBe('BESTIARY');
  });

  it.each([
    ['a bad mode', (r: Record<string, unknown>) => { r.mode = 'some'; }, (d: ReturnType<typeof validateBestiary>) => d.mode, 'all'],
    ['a negative idleBreak', (r: Record<string, unknown>) => { (r.anim as Record<string, unknown>).idleBreak = -5; },
      (d: ReturnType<typeof validateBestiary>) => d.anim.idleBreak, 60],
    ['an unknown step', (r: Record<string, unknown>) => { (r.anim as Record<string, unknown>).order = ['attack', 'dance']; },
      (d: ReturnType<typeof validateBestiary>) => d.anim.order.join(), 'attack,hurt,cast,daze'],
    ['a missing template', (r: Record<string, unknown>) => { delete (r.templates as Record<string, unknown>).titleCount; },
      (d: ReturnType<typeof validateBestiary>) => d.templates.titleCount, DEFAULT_BESTIARY.templates.titleCount],
  ])('%s logs console.error and takes the default', (_name, mutate, pick, expected) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = real();
    mutate(raw);
    expect(pick(validateBestiary(raw))).toBe(expected);
    expect(error).toHaveBeenCalled();
  });

  it('a template with an unknown placeholder and an unknown key are logged', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = real();
    (raw.templates as Record<string, unknown>).damage = '{low}-{high}';
    raw.colour = 'blue';
    const d = validateBestiary(raw);
    expect(d.templates.damage).toBe('{min}-{max}');
    expect(error).toHaveBeenCalledTimes(2);
  });
});
