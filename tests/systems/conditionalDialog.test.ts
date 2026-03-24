import { describe, it, expect } from 'vitest';
import { resolveNPCDialog, type ConditionalDialog } from '../../src/types/index.js';

describe('resolveNPCDialog', () => {
  it('returns simple string[] dialog unchanged', () => {
    const dialog = ['Hello!', 'Welcome to town.'];
    const result = resolveNPCDialog(dialog, () => false);
    expect(result).toEqual(['Hello!', 'Welcome to town.']);
  });

  it('returns empty array for empty dialog', () => {
    expect(resolveNPCDialog([], () => false)).toEqual([]);
  });

  it('returns default (no condition) when no flags are set', () => {
    const dialog: ConditionalDialog[] = [
      { condition: 'PRINCESS_RESCUED', text: ['She is safe!'] },
      { text: ['The princess is missing!'] },
    ];
    const result = resolveNPCDialog(dialog, () => false);
    expect(result).toEqual(['The princess is missing!']);
  });

  it('returns conditional dialog when flag is set', () => {
    const dialog: ConditionalDialog[] = [
      { condition: 'PRINCESS_RESCUED', text: ['She is safe!'] },
      { text: ['The princess is missing!'] },
    ];
    const result = resolveNPCDialog(dialog, (flag) => flag === 'PRINCESS_RESCUED');
    expect(result).toEqual(['She is safe!']);
  });

  it('returns first matching condition when multiple flags set', () => {
    const dialog: ConditionalDialog[] = [
      { condition: 'BRIDGE_BUILT', text: ['The bridge is open.'] },
      { condition: 'PRINCESS_RESCUED', text: ['She is safe!'] },
      { text: ['Default dialog.'] },
    ];
    const hasFlag = (flag: string) => flag === 'PRINCESS_RESCUED' || flag === 'BRIDGE_BUILT';
    const result = resolveNPCDialog(dialog, hasFlag);
    expect(result).toEqual(['The bridge is open.']);
  });

  it('returns default when no conditions match', () => {
    const dialog: ConditionalDialog[] = [
      { condition: 'GARLAND_DEFEATED', text: ['Garland is gone.'] },
      { text: ['Danger lurks.'] },
    ];
    const result = resolveNPCDialog(dialog, () => false);
    expect(result).toEqual(['Danger lurks.']);
  });

  it('returns empty array when no conditions match and no default', () => {
    const dialog: ConditionalDialog[] = [
      { condition: 'GARLAND_DEFEATED', text: ['Garland is gone.'] },
    ];
    const result = resolveNPCDialog(dialog, () => false);
    expect(result).toEqual([]);
  });
});
