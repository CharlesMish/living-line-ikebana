# Stem-overlap inspection — September 28, 2026

## First-stage implementation

Base: main `a4ffbe0ddc5bd8620ec7a06d21fc8d120cc14c68` (merged #58).
This implements Charlie's request to detect/show intersections before auditing a
separate prevention experiment. No movement is blocked, snapped or repaired.

Open **View → Stem overlaps: off** to turn inspection on. Broken amber rings mark
possible inter-cutting stem overlap areas in the current displayed pose. They
stay readable while orbiting/zooming and can be switched off from the same menu.
The menu reports the number of possible areas and the limited scope. The setting
is session-only and off on reload; it does not enlarge the top rail.

- Checks active **trunk, lateral and twig** records between **separate cuttings**.
- Excludes organs (leaves, flowers, fruit), petioles/pedicels, same-plant contact,
  floor and vessel. This covers reed-versus-woody-branch penetration without
  marking authored branch junctions as defects.
- Uses persisted radius and finite 3D centreline segments, with capsule envelopes.
  A depth-separated projected crossing is not contact. Exact touching and grazing
  within `max(1e-5, 0.1 * thinnerRadius)` are excluded.
- The renderer has faceted tubes and flat end caps. Capsule envelopes approximate
  them, especially near end caps and bends: **possible overlap**, not certified
  triangle intersection. Absence of a mark does not certify physical validity.
- Branch/segment bounding boxes reject distant pairs. Contiguous intersecting
  segment-pair cells form one area, represented by its deepest sampled contact.
  Disconnected crossings remain separate. Results are stable under map ordering.
- Computation is cached by structural geometry, radius and identity; looking
  around does not repeat the pair test. Off means no detector work.
- At most 32 in-view marks are drawn in two instanced layers. The menu count is
  uncapped and says when marks are limited. Mark radius is 9 CSS pixels with
  a pale contrasting outline. Marks deliberately show through occluding surfaces
  as an inspection overlay; they are not physical rings, grips or depth cues.

## Preview and persistence boundaries

The app adapts immutable presentation state into the detector. Aim/Bend/base use
the live graph. Visible insertion ghosts participate even at an invalid seat;
source-rail/horizon-hidden ghosts do not. Held and mouse-hover prune previews
use exactly the graph that `applyPrune` would leave, so faded distal material
stops contributing. Cancelling restores committed contacts. Undo, removal,
replacement and return from Garden are recomputed from the current graph.

The toggle cancels a held edit before changing inspection state, like other
View commands. Neither detection nor toggle writes storage, consumes Undo,
changes selection/camera/ordinal, or changes picking. The overlay has no hit
proxies, shadows, or raycast response. Single-entry Garden View can be inspected
read-only. Garden thumbnails hide marks during capture and restore them afterwards;
Compare's separate studios stay clean. Nothing enters canonical serialization.

## Validation

`npm ci` and `npm run verify` passed: **328 tests, 0 failed, 0 skipped**,
clean typecheck, production build and self-contained distribution validation.
Standalone: 955,869 bytes; SHA-256
`1f7a467eef2967846a36b2783596f84487c116ebd94c29b7b2a04a05a5c8f0a9`.
Focused tests cover finite-segment geometry, 3D separation,
touching/parallel/degenerate cases, contact clustering, ordering, inactive stock,
prune/cancel/Undo, insertion visibility, app toggle/hover refresh, menu state,
pixel-size bounds, draw-instance cap, unpickability and thumbnail failure cleanup.
A local CPU probe of the uncached detector on the frozen `round5-palette` ×12
fixture found 10 areas; 60 measured runs after warmup had median 1.77 ms and
p95 2.82 ms. This is not GPU time, real-device frame time or a performance gate.

Browser attempt: local Vite served successfully; the available CUA browser refused
`http://127.0.0.1:5173/?workbench=1` with `net::ERR_BLOCKED_BY_CLIENT`. No new GPU
render, real-pointer playthrough, physical-phone feel or phone frame-time claim.
These remain draft acceptance items rather than inferred passes.

## Short owner/browser check

1. Turn inspection on for a bowl with a reed crossing a woody branch. Orbit:
   a visible 2D crossing with real depth clearance must remain unmarked; actual
   penetration should stay bracketed as the view changes.
2. Aim/bend/base away from contact and back. Marks should track the material,
   without resisting movement or acting as handles. Cancel once, then commit
   and Undo once. The correct earlier contacts should return.
3. Prune past a contact: the mark disappears during preview, returns on Cancel,
   disappears on commit and returns on Undo. Test mouse hover separately.
4. Insert a cutting: no phantom contact from the hidden source-rail ghost.
   Returning an invalid cutting to the tray removes its marks.
5. Toggle off/on, then remove and Undo a cutting. Keep an arrangement with
   inspection on: its thumbnail and Compare must contain no diagnostic marks.
6. At 320/390px portrait and short landscape, check View's scrolling menu,
   contrast, marker readability among flowers, and off-state visual equivalence.

## Next turn

Read [PREVENTION_AUDIT.md](PREVENTION_AUDIT.md) before implementing any constraint.
The detector's capsule result is not itself a safe acceptance predicate.
