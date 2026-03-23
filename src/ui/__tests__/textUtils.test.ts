import { describe, it, expect } from 'vitest';
import { wrapText } from '../textUtils.js';

describe('wrapText', () => {
  it('returns text unchanged when within limit', () => {
    expect(wrapText('hello', 10)).toBe('hello');
  });

  it('wraps long lines at word boundaries', () => {
    expect(wrapText('hello world', 6)).toBe('hello\nworld');
  });

  it('preserves paragraph breaks', () => {
    expect(wrapText('line1\nline2', 20)).toBe('line1\nline2');
  });

  it('handles multiple words per line', () => {
    expect(wrapText('a b c d e', 5)).toBe('a b c\nd e');
  });

  it('handles words longer than max width', () => {
    expect(wrapText('superlongword short', 5)).toBe('superlongword\nshort');
  });

  it('handles empty string', () => {
    expect(wrapText('', 10)).toBe('');
  });
});
