# Craft usability: recovery, insertion cues and acquisition

## Scope and build identity

This pass responds to Charlie's phone observations and the supplied Grok Bot
playtest package, `living-line-playtest-2026-09-28.zip`. Its goal is to make the
existing twelve-material craft tools easier to reach and recover from. It adds
no material, curriculum, score, game loop, petal control or collision solver.

The external report tested hosted main
`a99f3e4aedd9619cc3886d6952aa568d2f2b805e`, containing #55's waterline rendering.
It did **not** test #56's narrow-stage lens. #56 had been merged into #55's head
branch after #55 landed, rather than into main. #57 carries the reviewed lens
back onto main (merged as `503d29f1dd87336d7ec0f97783806431272a62f1`
after the recorded playtest finished). This candidate is based on the reviewed lens head
`67e7d9fc4934057ee69841837f9cca41a83ffdaf`; do not attribute all differences from
the external report to the usability changes in this pass. Neither elapsed
drag time nor familiarity was established as the cause of the reported misses.

## Accepted changes

| Observation | Change | Boundary retained |
| --- | --- | --- |
| A mistaken release/cut has no direct recovery | One transient Undo step, plus Remove selected cutting | No redo, no persisted history, no reversal of Garden entries |
| Submerged pins and a larger visible bowl obscure the seat target | High-contrast outline of the actual 1.22-radius pin field for the full tray drag | Drops on surrounding water remain invalid; no basin snapping |
| Distant thin stems/handles are difficult to acquire | Bounded CSS-pixel fallback and minimum visible bend-bead size | Direct material surfaces keep priority over added near-miss candidates; no new petal/stalk halos |
| Empty-space miss suggests moving the camera rather than helping with the intended edit | Tool-specific miss guidance | Empty-space Arrange does not acquire or hand over to camera |
| Opening Garden changes working posture | Modal pause preserves posture; actual kept views remain Step Back only | Cancel before inspecting committed state; no kept-entry edits |
| Compare repeats the low-table brief for unrelated arrangements | Remove the generic comparison paragraph | The explicitly optional Garden study remains |

The pin outline uses the actual insertion plane and boundary and draws through
the water. Its centreline defines that boundary; its visual stroke is not added
placement tolerance. The ghost can still disappear above the ground-plane
horizon while the destination stays visible. Existing valid/invalid text and
colour are retained; the target is not communicated by colour alone.

The acquisition fallback is used only when there was no true visible material
surface hit. It adds selected visible base/bend handle candidates within 16 CSS
pixels and active trunk/lateral/twig candidates within 8 CSS pixels. Existing
world-space proxies and deterministic tier/distance/depth/ID arbitration remain.
The visible bead has a 12 CSS-pixel minimum diameter. Canonical plant geometry,
rest lengths and saved radii do not change.

## Intentional recovery contract revision

Changed Insert/Aim/Bend/base/Prune and Remove operations replace a single
botanical checkpoint. Unchanged releases, invalid insertion, cancellation,
selection, tool/view commands and camera gestures retain the prior checkpoint.
The existing no-op ordinary release may still save; it does not replace Undo.

Undo restores canonical plants and selection, preserves the current camera and
successful insertion ordinal, then consumes the checkpoint. Removing the selected
cutting is a separate Arrange command, not a special prune: it removes that
plant from the working map and can be undone. Ordinals never rewind or recycle.

The app persists proposed Undo/Remove state before replacing memory. A failed
write vetoes recovery and retains working state and checkpoint; a successful
recovery writes once. Opening Edit or requesting recovery cancels a live preview
first. Normal captured owner release still commits a gesture even outside the
canvas; this pass does not silently reinterpret that release as cancellation.

Keep and temporary Garden inspection retain the working coordinator/checkpoint.
Reload and fresh/copy replacement create a new coordinator and clear it. Kept
entries remain immutable under working Undo/Remove. No schema or generator is
changed. This intentionally revises recovery, acquisition and Garden posture
behavior; preview ownership, rollback and the original stock identity laws stay.

## Evidence assessment

The external package distinguishes its initially scripted player from a fresh
ordinary-mouse pass. Retain that separation. Reported desktop insertion misses,
missed stems and handles, the always-visible Compare brief and missing recovery
are useful observations. The report's recommended remedies are proposals, not
required fixes. In particular, accepting the entire bowl would hide rather than
explain the existing seat boundary, and automatic outside-release cancellation
would change an established gesture law.

Chrome narrow-viewport/touch emulation is not physical Safari evidence. Repeating
one exact insertion location ten times measures a narrower task than varied
placement. A drawn emulated finger does not prove a control's actual hit box.
Agent descriptions of enjoyment, restraint or wanting another session are
self-reports, not evidence of human engagement. A saved Garden checkpoint was
already a recovery route, although it was less immediate and less discoverable
than Undo. Absence of Undo did not make every Aim/Bend geometrically irreversible.

The report's source diagnosis correctly identified the lack of collision
constraints, but its outside-flower explanation was initially an inference. The
provided canonical exports let us confirm the specific case below without
claiming an observed causal gesture sequence.

## Confirmed retained limitation: nodding stem below the floor

`nodding-below-floor-plant-8.json` is the exact canonical plant extracted from
`exports/pass2_all_four_kept.json`, entry **Bare fork revised**. The same plant
appears in **Bare fork**. This is a diagnostic example of an undesirable existing
pose, not a generator golden, desired geometry or automatic repair target.

| Measurement | Saved value |
| --- | --- |
| Root position | (-0.7336833628, 0.55, 0.3071758454) |
| Root radial distance | 0.7953919014; inside the 1.22 pin field |
| First trunk tangent, vertical component | 0.0335902775; satisfies the current upward-exit rule |
| Lowest active trunk point | y = -0.2291538052 |
| Lowest active neck point | y = -0.3075424643 |
| Scene floor | y = -0.02 |
| Terminal flower-stalk tip | radius 3.3045478012, y = 0.5945264266 |

The plant is connected, valid under production graph invariants and saved in this
pose. It descends through the vessel/floor and rises outside the bowl. An opaque
floor can therefore hide its supporting sections and make the flower appear to
stand separately on the table. This is not an escaped insertion root, lost graph
record or transient ghost. No geometry was repaired or clamped in this pass.

`src/core/edit.ts::aimBranch` limits the first trunk tangent, not every downstream
point. `bendBranch` preserves rest length without vessel/floor collision. A later
containment study should distinguish legitimate overhang and water crossings from
ceramic/floor penetration; it must also accommodate existing low poses without
jumping at acquisition. The present evidence does not justify a broad rule that
forces all botanical material inside the bowl.

Fixture provenance: source-export SHA-256 `dcb2febf79d895fa74fb4f65d29cf318c8ee7c27ba176ea7818b37f7f90592d4`.
The fixture excludes other plants, Garden metadata and thumbnails and preserves
all canonical fields of the selected plant.

## Validation and remaining owner check

`npm ci` and `npm run verify` pass: typecheck, **315 tests / 0 failed / 0 skipped**,
production build and self-contained distribution validation. The standalone is
947,435 bytes, SHA-256
`2cb6030644ffb09968501a35fc7ca5e5a30b73963de1ea0c047c829291cd7f39`.
Focused tests exercise real Three geometry/projection/picking without GPU rendering,
coordinator recovery and app persistence/Garden/keyboard integration. Independent
code review found no blocker in acquisition or recovery integration.

The supplied insertion clip was inspected as a contact sheet. A fresh local-browser
pass was attempted, but the available browser refused localhost with
`net::ERR_BLOCKED_BY_CLIENT`. No new rendered browser pass or physical-phone
sign-off is claimed. Narrow/large-text rail layout, the added Edit menu, cue contrast
and crowded selection still need visual/device review. The export analysis above
used production graph validation and direct coordinates.

Use the September 28 section of
[the phone/web card](../../../../tests/browser/PHONE_WEB_TEST_CARD.md) to test
varied insertion positions, crowded/distant acquisition, recovery after a cut,
removal/undo, Garden return posture and narrow/large-text chrome. Compare the
actual candidate with its recorded lens baseline, not with an unidentified
cached hosted build. Preserve a Garden backup before replacing a valued bowl.

Gameplay invitations and the focused bell/flower-shaping studies remain later
work. Their design should not be judged from a session dominated by missed
acquisitions or irreversible accidental releases.
