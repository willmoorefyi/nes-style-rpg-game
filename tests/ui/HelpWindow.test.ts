import { describe, it, expect } from 'vitest';
import { HelpWindow, HELP_RECT } from '../../src/ui/HelpWindow.js';
import { GAME_HEIGHT, GAME_WIDTH, SCREEN_MARGIN } from '../../src/core/LayoutConstants.js';
import { visibleLabels } from '../helpers/realData.js';

describe('MS-7: HelpWindow (the one-line description bar)', () => {
  it('sits at the bottom of the screen: y 900, height 156, full width inside the margins', () => {
    expect(HELP_RECT).toEqual({ x: SCREEN_MARGIN, y: 900, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 156 });
    expect(HELP_RECT.y + HELP_RECT.height).toBeLessThanOrEqual(GAME_HEIGHT - SCREEN_MARGIN);
    const w = new HelpWindow();
    expect(w.position.y).toBe(900);
  });

  it('shows the text at once and clears with ""', () => {
    const w = new HelpWindow();
    w.setText('Restores 30 HP to one ally.');
    expect(w.text).toBe('Restores 30 HP to one ally.');
    expect(visibleLabels(w)).toContain('Restores 30 HP to one ally.');
    w.setText('');
    expect(w.text).toBe('');
  });
});
