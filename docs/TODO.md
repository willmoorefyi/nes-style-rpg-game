# TODO (feature backlog)

Items the user asked for that have no plan yet. Each needs a planner (plan doc, momus review) before agents build it.

## T-1: "Mode 7" airship flight view (user, 2026-11-19)

**Want:** when the airship takes off, the field switches to a perspective view like the later 16-bit Final Fantasy
airships. The world map is drawn as a ground plane tilted away from the camera, so the land curves back toward a
horizon as you fly, with a sky band above it. Landing returns to the normal top-down view.

**Planner brief** (write `docs/MODE7_PLAN.md`; this is a significant change):
- **Rendering.** How to draw the tilted, curved world in PixiJS 8:
  - candidates: a mesh or shader that maps the 192x192 world (its compiled chunk textures) onto a perspective plane with a curvature term, versus per-scanline affine strips like the SNES;
  - the cost of streaming the chunk textures;
  - the frame budget on this machine;
  - nearest filtering at distance, or mipmaps / fog.
- **Camera and controls.** Turning versus the classic 4-direction movement:
  - does the view rotate with the heading, or keep north up;
  - speed, the take-off and landing transitions (tilt in and out), and the zoom and altitude;
  - how the airship sprite sits in the view (it will need the front and back views, see T-2).
- **Gameplay rules that must not change:**
  - `fieldRules` (landing only on grass, `canLand`), encounters (none while flying), the save position, and `CANT_LAND`;
  - the verifier's model (`src/progression/`) is unaffected, because it is only a view.
- **What shows in the view:** the landmarks and towns (their art) drawn as upright billboards or flattened into the plane; the parked ship; clouds and shadows.
- **Fallback.** A setting or `?mode7=0` to fly in today's top-down view; a low-end and WebGL-context-loss path.
- **Tests:** the pure maths (projection, the inverse for picking the landing cell) without PixiJS, plus browser checks.
- **Tranches, risks, file-size limits** (`ExplorationScene.ts` is near its ceiling: put this in a new module under `src/scenes/exploration/` or `src/rendering/`).

## T-2: airship front and back views (user, 2026-11-19)

Flying away from (up) and toward (down) the camera need their own airship art to match the approved side view
(`assets-src/gen/approved/vehicles/airship.png`, LM2 b_7). They are generated in pass LM3 (free Bedrock) and compared
with the side view for matching design, colours and size; the user then chooses. Wiring: `FieldVehicleSprites` picks
the frame by facing (up / down / side mirrored). Mode 7 (T-1) needs the back view most of all.

## Deferred, needs the user

- The cheats menu (an XP and gold boost, like the remasters).
- A sitting pose for the canoe (today the standing frames are masked below the gunwale).
- A paid art pass for the placeholders Bedrock does not cover (the fairy and mermaid NPC sheets).
