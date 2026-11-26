# Esc menu fix (ESC)

User report (2026-11-25): "at some point the 'esc' button didn't bring up the menu. Not sure how to reproduce. It was
off my save 1 after I went into the armor shop and bought a few things."

## Root cause

`SceneManager.push` never makes the pushed scene's container visible. A scene's container is hidden whenever another
scene is pushed over it (`this.currentScene.container.visible = next.transparent === true`) and shown again only by
`pop` (for the scene it returns to) or `switchTo` (for its target, the fix of 75ed0001). A scene that is still hidden
under a push when a `switchTo` clears the stack keeps `visible = false`, and the next `push` of it adds an invisible
scene.

The field menu is the one scene this hits: **Field menu > Load > slot > Yes** leaves the stack
`[exploration, fieldMenu]` with `loadMenu` on top (`fieldMenu` hidden by the `loadMenu` push), and `LoadScene.start`
calls `switchTo('exploration')`. The field menu instance is cached by `SceneManager` (lazy factory), so from then on
every Esc in the field pushes it hidden: the field is hidden too (not transparent), the screen shows only the page
background, the invisible menu takes the input, and the next Esc pops it back to the field. For the rest of the
session "Esc doesn't bring up the menu". Title > Continue does not trigger it (the title is not re-pushed later).

### Evidence

- Browser (Playwright, `?mute=1&trace=1`, dev server; scripts in `/tmp/esc-fix/`, shots in
  `~/temp/ff-game/playtest/esc/`): `r_shops` field start, armor shop map, field menu > Save slot 1, field menu > Load
  slot 1 > Yes, then Esc: `scenes.current === 'fieldMenu'`, `fieldMenu.container.visible === false`,
  `exploration.container.visible === false`; `s7_esc_after_load.png` is a blank navy screen. The trace shows
  `push fieldMenu` was made.
- Ruled out by the same harness (each Esc opened a visible menu): buying in the armor shop with the quantity selector
  (confirm and cancel), "Equip it now?" (pick and cancel), spending most of the gold, mashing Z / arrows / Esc, leaving by
  Esc and by Exit, then Esc in the shop room and in Cornelia; Title > Continue > slot 1 then the same shop run. Input
  state after leaving the shop: no hold-off left (`holdFrames` empty), no key held, `paused` / `loading` / dialog /
  transition / pending NPC action all clear.
- By code: walking needs every early return of `ExplorationScene.step` passed, and the only per-frame input block
  (`InputManager.holdOff`) is bounded (8 / 24 frames) and released on blur. Nothing in the shop flow leaves state
  behind (`ShopScene` is created per visit, `cleanupTempScenes` unregisters it).
- Not proven: that the user loaded slot 1 from the field menu (the report does not say how). This is the only defect
  found that matches "Esc doesn't bring up the menu"; the shop visit itself plays no part.
- Seen but by design (not changed): an Esc pressed during a door fade or the zoom (the field is `fieldBusy`, S1 / S2) is
  dropped; walking out of the shop and pressing Esc during the fade does nothing.

## Fix

`SceneManager.push`: set `next.container.visible = true` right after `this.stage.addChild(next.container)` and before
`await next.enter()` (as `switchTo` does, so an `enter()` may still hide its own scene), so a pushed scene is always
shown, whatever an earlier stack left on its container. One line in `src/core/SceneManager.ts` with a comment; no
other behaviour changes (`transparent` only concerns the scene below). The fix is general: every `switchTo` that
clears a stack holding a hidden cached scene (`LoadScene`, `GameOverScene`, `BattleTrigger`, `fieldTravel`,
`DebugScenarioLoader`) is covered, not only the field menu route traced above.

Momus review (2026-11-25): OKAY, no blocking findings; notes 1 (where the line goes) and 2 (the fix is general) are
folded in above.

## Tests (failing first)

- `tests/core/SceneManager.test.ts`: "a scene left hidden under a cleared stack is visible when pushed again (ESC: Field
  menu > Load)": register `exploration`, `fieldMenu`, `loadMenu` mocks; `switchTo('exploration')`,
  `push('fieldMenu')`, `push('loadMenu')`, `switchTo('exploration')`, `push('fieldMenu')`; expect
  `fieldMenu.container.visible` true (fails before the fix: false), `exploration.container.visible` false, current
  `fieldMenu`. Then `pop()`: exploration visible.
- Run before the fix to see it fail, then after.
- Browser re-check with `s7.mjs`: after the load, Esc shows the menu (screenshot).
- Gates: `npm run build`, `npm run test:fast`, `npx vitest run tests/core/SceneManager.test.ts`.
