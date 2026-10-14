# Phone placement presentation

Base: PR #85 at `f8bec35`. This is a presentation refinement of the existing
tap-placement study, not a change to placement acceptance or gesture law.

## Observed issue

The supplied C03 r2 portrait screenshots show a very narrow source card: the
material name and idle instruction wrap into five lines. In the blocked-tap
screenshot, the bottom-positioned Cancel button covers the middle of the
prevention explanation. These are supplied emulator images, not new phone play.

## Change

- Tap-enabled chrome at widths up to 480 CSS pixels gives Shape/Prune and Materials one row, with a wider
  source card and Cancel on the following row. Other chrome and flag-off play
  keep their existing layout.
- Idle source copy is now “Drag or tap to place”; its accessible name still says
  to drag to the pins or tap to ready the cutting. Ready copy remains “Tap inside
  the pins”.
- Cancel is a sibling in the top material dock, not a bottom overlay. Its slot
  stays allocated while the button is hidden, so readiness cannot move controls.
- Both instruction variants occupy one grid cell, with only the active one
  visible and exposed. Their shared footprint avoids a wrapped-label height
  change cancelling readiness through the stage inset measurement.

The card node, source pointer bindings, hit geometry, save rules, undo behavior,
and flag-off copy remain unchanged. The bottom status region can display long
invalid-placement and prevention feedback without the Cancel button covering it.

## Evidence and limits

Focused UI/insertion tests cover copy/state exposure, Cancel placement inside the
material dock, cancellation/focus behavior, ordinary pointer and keyboard paths,
flag-off behavior, invalid insertion, and save/undo behavior. Static reasoning
does not establish actual CSS dimensions or phone comfort.

`npm run verify` passed: typecheck, 453 tests (zero failures/skips), build, and
self-contained distribution validation. The focused placement selection passed
16 tests. Node dependencies were shared from the parent task's clean install.

Fresh browser rendering and physical-phone play were not available in this
execution environment. No browser screenshot or touch-feel claim is made.

Owner checks on the candidate:

1. At ordinary and large text, the source name/instruction and Cancel fit without
   clipping. Shape/Prune, Materials, and Cancel remain easy to reach.
2. Tap the source: the rail and bowl do not jump and readiness stays active. Tap
   outside the bed and against Prevent overlaps: the full explanation is visible.
3. Cancel from the rail, then drag normally. Use Step Back and confirm source and
   Cancel disappear. Return to Arrange and check readiness is cleared.
4. Recheck the short landscape viewport; the extra source row must not obstruct
   ordinary bowl use. Camera rules are unchanged and follow measured chrome.
