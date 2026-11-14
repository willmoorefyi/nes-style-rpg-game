/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DialogManager, DIALOG_CLOSE_HOLDOFF_FRAMES } from '../../src/systems/DialogManager.js';
import { DialogBox as RealDialogBox } from '../../src/ui/DialogBox.js';
import { InputManager } from '../../src/core/InputManager.js';
import type { DialogBox } from '../../src/ui/DialogBox.js';

function createMockDialogBox() {
  return {
    show: vi.fn(),
    setMore: vi.fn(),
    update: vi.fn(),
    visible: false,
  } as unknown as DialogBox;
}

describe('DialogManager', () => {
  let dialogBox: DialogBox;
  let manager: DialogManager;

  beforeEach(() => {
    dialogBox = createMockDialogBox();
    manager = new DialogManager(dialogBox);
  });

  it('starts inactive', () => {
    expect(manager.isActive).toBe(false);
  });

  it('becomes active when dialog starts', () => {
    manager.start(['Hello', 'World']);
    expect(manager.isActive).toBe(true);
    expect(dialogBox.show).toHaveBeenCalledWith('Hello', true);
  });

  it('advances through dialog lines', () => {
    manager.start(['Line 1', 'Line 2']);
    manager.advance();
    expect(dialogBox.show).toHaveBeenCalledWith('Line 2', false);
    expect(manager.isActive).toBe(true);
  });

  it('becomes inactive after last line', () => {
    manager.start(['Only line']);
    manager.advance();
    expect(manager.isActive).toBe(false);
  });

  it('runs the completion callback once, after the last line', () => {
    const done = vi.fn();
    manager.start(['a', 'b'], done);
    manager.advance();
    expect(done).not.toHaveBeenCalled();
    manager.advance();
    expect(done).toHaveBeenCalledTimes(1);
    manager.advance();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('enqueue waits for the current dialog instead of replacing it (several level-ups)', () => {
    const first = vi.fn();
    const second = vi.fn();
    manager.enqueue(['WAR reached Level 2!'], first);
    manager.enqueue(['B.MAG reached Level 2!'], second);
    expect(dialogBox.show).toHaveBeenLastCalledWith('WAR reached Level 2!', false);
    manager.advance();
    expect(first).toHaveBeenCalled();
    expect(dialogBox.show).toHaveBeenLastCalledWith('B.MAG reached Level 2!', false);
    expect(manager.isActive).toBe(true);
    manager.advance();
    expect(second).toHaveBeenCalled();
    expect(manager.isActive).toBe(false);
  });

  it('clear closes the dialog and drops queued lines without running callbacks', () => {
    const done = vi.fn();
    manager.start(['a'], done);
    manager.enqueue(['b'], done);
    manager.clear();
    expect(manager.isActive).toBe(false);
    manager.advance();
    expect(done).not.toHaveBeenCalled();
  });

  it('I2: tells the box when another line follows (the ▼ marker)', () => {
    manager.start(['a', 'b']);
    expect(dialogBox.show).toHaveBeenLastCalledWith('a', true);
    manager.advance();
    expect(dialogBox.show).toHaveBeenLastCalledWith('b', false);
  });

  it('I2: a queued dialog counts as more text after the last line', () => {
    manager.start(['a']);
    manager.enqueue(['b']);
    manager.enqueue(['c']);
    expect(dialogBox.setMore).toHaveBeenCalledWith(true);     // 'a' now has text after it
    manager.advance();
    expect(dialogBox.show).toHaveBeenLastCalledWith('b', true);
    manager.advance();
    expect(dialogBox.show).toHaveBeenLastCalledWith('c', false);
  });
});

describe('DialogManager: confirm hold-off after the last line closes (U12)', () => {
  let input: InputManager;
  const key = (type: 'keydown' | 'keyup') => window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyZ' }));
  /** A field-style manager: a real box whose close advances the manager, with the field's hold-off. */
  function fieldManager(frames = DIALOG_CLOSE_HOLDOFF_FRAMES): DialogManager {
    const box: RealDialogBox = new RealDialogBox({ revealSpeed: 0, onComplete: () => mgr.advance() });
    const mgr = new DialogManager(box, { closeHoldOffFrames: frames });
    return mgr;
  }
  /** One game frame: the manager while it is active, then the input tick. */
  function frame(mgr: DialogManager): void {
    if (mgr.isActive) mgr.update(1, input);
    input.update();
  }
  function tap(mgr: DialogManager): void {
    key('keydown'); key('keyup');
    frame(mgr);
  }

  beforeEach(() => {
    input = new InputManager();
    input.attach();
  });
  afterEach(() => input.detach());

  it('is 24 frames', () => {
    expect(DIALOG_CLOSE_HOLDOFF_FRAMES).toBe(24);
  });

  it('a fresh confirm is not just-pressed for 24 updates after the close, and is after them', () => {
    const mgr = fieldManager();
    mgr.start(['Hello.']);
    frame(mgr);
    tap(mgr); // reveal is instant, so this closes the box
    expect(mgr.isActive).toBe(false);
    // the close ran inside that frame, before its input tick: 23 more updates are held
    for (let i = 0; i < DIALOG_CLOSE_HOLDOFF_FRAMES - 1; i++) {
      key('keydown'); key('keyup');
      expect(input.isJustPressed('confirm')).toBe(false);
      input.update();
    }
    key('keydown');
    expect(input.isJustPressed('confirm')).toBe(true);
  });

  it('cancel is not held after the close', () => {
    const mgr = fieldManager();
    mgr.start(['Hello.']);
    frame(mgr);
    tap(mgr);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
    expect(input.isJustPressed('cancel')).toBe(true);
  });

  it('no hold-off between the parts of a queued dialog', () => {
    const mgr = fieldManager();
    const holdOff = vi.spyOn(input, 'holdOff');
    mgr.start(['a']);
    mgr.enqueue(['b']);
    frame(mgr);
    tap(mgr); // closes 'a', 'b' starts
    expect(mgr.isActive).toBe(true);
    expect(holdOff).not.toHaveBeenCalled();
    key('keydown');
    expect(input.isJustPressed('confirm')).toBe(true);
    key('keyup');
    frame(mgr); // closes 'b'
    expect(mgr.isActive).toBe(false);
    expect(holdOff).toHaveBeenCalledTimes(1);
  });

  it('a manager built without the option never holds input off (cutscene hosts, the opening)', () => {
    const box: RealDialogBox = new RealDialogBox({ revealSpeed: 0, onComplete: () => mgr.advance() });
    const mgr = new DialogManager(box);
    const holdOff = vi.spyOn(input, 'holdOff');
    mgr.start(['Hello.']);
    frame(mgr);
    tap(mgr);
    expect(mgr.isActive).toBe(false);
    expect(holdOff).not.toHaveBeenCalled();
  });

  it('an input without holdOff (a test mock) is skipped', () => {
    const box = { show: vi.fn(), setMore: vi.fn(), update: vi.fn(), visible: false } as unknown as RealDialogBox;
    const mgr = new DialogManager(box, { closeHoldOffFrames: 24 });
    mgr.start(['a']);
    mgr.update(1, { isJustPressed: () => false } as unknown as InputManager);
    expect(() => mgr.advance()).not.toThrow();
  });
});
