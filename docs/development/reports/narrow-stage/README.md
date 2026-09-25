# Narrow-screen stage lens

Stacked on the waterline branch (PR #55, head `392d65e`). This branch intentionally
revises the Step Back radius limit and the Pan projection wording; see
*Narrow-stage lens* in `docs/BEHAVIORAL_CONTRACT.md`. Generators, saved plant
coordinates, botanical scale, canonical camera poses and persistence are unchanged.

## Problem (reproduced in browser emulation)

| Viewport | Controls cover | What went wrong on `392d65e` |
| --- | --- | --- |
| 1280×800 | 16% | Nothing. This is the reference. |
| 390×844 | 22% | The bowl sat low with an empty lower quarter. Wide material was cropped on both sides. Pinch-out stopped at radius 15.5, about 3% beyond the Front preset. |
| 320×640 | 30% | Tall material (flower heads, the bud) ran under the rail. The wide arrangement was cropped. |
| 844×390 | 33% | The top of a tall arrangement ran under the rail. |

## Change: one viewport-derived lens

`presentation/stageLens.ts` reads only the canvas size and how far the top
controls reach into it (`.top-chrome` bottom), never plant geometry:

- **Centre shift.** Only the part of the rail beyond the desktop share (16%)
  is compensated. The optical centre moves down by half of that excess using
  `camera.setViewOffset`.
- **Zoom.** The field widens (zoom ≥ 1) until two things hold:
  - the unobstructed stage shows at least the reference vertical extent;
  - the width shows at least 0.6 of that extent.
- **Zoom-out limit.** The maximum Step Back radius rises until full zoom-out
  shows at least 0.9 of the reference extent across the width (about 23.2 on
  these phones). It never pulls an acquired radius inward, so a pose kept on a
  phone and opened on a desktop does not jump.
- **Fog.** Beyond radius 15.5, fog moves out with the camera, so zoomed-out
  views stay clear. At ≤ 15.5 it is unchanged.

`lens.json` lists the resulting shift, zoom, field of view and maximum radius
per viewport. Desktop (≤ 16% rail share) gets shift 0, zoom 1, 44° and 15.5,
which reproduces the old projection exactly. The desktop before/after images
are pixel-identical in the scene.

**When reframing happens.** Only after the viewport changes: window resize,
rotation, browser chrome, a canvas-size change, or the one-time web-font
settle at startup. Posture, tool, view, selection and edits never remeasure,
so the camera never chases the player's work. Every such change first cancels
any live gesture.

**Consistency.** Picking (raycaster), projection, camera-facing drag planes
and Pan all use the same camera matrices. Pan takes the lens frame's height and
field of view, frozen at acquisition along with the zoom limit. Tests check
three things on the real studio methods: pick rays pass through projected
points, target-depth material pans one pixel per pixel, and the target sits
at the stage centre.

**Garden comparison.** The comparison panes don't use the lens. Both keep the
shared field of view and world scale 1, as before. Garden *View* uses the main
studio, so it gets the lens like the working bowl.

### Resize safety (pre-existing gap, fixed here)

On `392d65e` (and `main`), a canvas-size change that the browser had not yet
announced with a `resize` event let an ordinary release commit an Aim made
under the old projection. This reproduced in headless Chromium: occasionally
with `setViewportSize`, and always with a CSS-only resize. It now cancels in
two ways:

- `ThreeStudio` reports actual canvas size changes from its ResizeObserver, and
  the app treats that as a viewport change.
- At release, the app compares the canvas size with the size at acquisition.
  If it changed, the gesture rolls back and nothing is saved.

## Evidence (headless Chromium, SwiftShader; not a phone)

Before is `392d65e` and after is this branch, with the same saved arrangements
and DPR 2. The arrangements are *simple* (one flowering branch), *tall* (five
unaimed stems) and *wide* (the waterline evidence arrangement). Each image
shows the initial Front preset, and what 30 wheel-out notches in Step Back
reach (the maximum zoom-out).

`p320-*.png`, `p390-*.png`, `land-*.png` (844×390), `desk-*.png` (1280×800).

### Interaction exercise under the lens

`exercise-<viewport>.json`: all four viewports, two passes each, all passing.

| Check | Result |
| --- | --- |
| Tray insertion of a nodding flower | Seats as plant-6 (ordinal 6) |
| Nodding-head Aim (press the bell) | `aim` on `flower-stalk`, and the stem stays byte-identical |
| Trailer Aim | `aim` on `plant-2:trail` |
| Bend (tap to select, drag the bead) | `bend` on the single-flower stem |
| Prune preview + Escape | Acquired, canonical hash unchanged, no save |
| Resize during a held Aim (with and without a delivered `resize` event) | Cancelled, hash unchanged, no save |
| CSS-only canvas resize during a held Aim | Cancelled, hash unchanged, no save |
| Stem panned to 5–17 px below the rail, then pressed in Arrange | Acquires that plant |
| Press in the rail's padding | No scene acquisition |
| Step Back Pan of (40, −30) px | Material moves (40.3, −30.2) px |
| Orbit, max zoom-out, zoom back in, Front preset | Works; the preset recentres |

### Cost: a smaller pin target

Zooming out makes the kenzan smaller on screen. The valid "Over the pins" band
in Front during a tray drag, CSS px, height × width:

| Viewport | Before | After |
| --- | --- | --- |
| 390×844 | 35 × 166 | 27 × 126 |
| 320×640 | 27 × 124 | 22 × 104 |
| 844×390 | 17 × 76 | 13 × 64 |
| 1280×800 | 33 × 156 | 33 × 156 |

The front-view pin band was already thin in short landscape. `LENS_MIN_HORIZONTAL_FRACTION`
(0.6) is the knob: lowering it to about 0.5 gives most of the band back at
390×844, but the preset crops wide work more (pinch-out still reaches it).
That choice needs a phone.

## Validation

- `npm run verify` passes. Test count and SHA are in the PR.
- Optional browser smoke test: 17/17 in Chromium.
- No physical-phone testing.

## Owner playtest (phone, about 5 minutes)

1. Open your usual bowl in portrait. Is the whole arrangement visible below the
   controls without touching anything? Does the bowl feel too small?
2. Drag a cutting from the tray to the pins five times. Any misses compared
   with before? This is the main cost.
3. In Step Back, pinch out fully on a wide arrangement. Can you see every tip?
   Pinch back in, then tap View → Front.
4. Start an Aim and rotate the phone, or pull the browser bar, mid-drag. It
   should cancel, and nothing should be saved.
5. Try a short landscape: does the tall work stay clear of the controls?
