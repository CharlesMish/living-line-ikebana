# Vessel and planting-footprint study

Exploratory branch from main `09db578e2430754e992b4acb6228a201d66e1555` (October 2, 2026).
No merge or deployment. Open `/vessel-study.html` in the local preview, or use the packaged standalone launcher.

## Recommendation

Try **Compact** first as an optional everyday vessel. It reduces visual bowl mass without tightly bunching the full-size stock. **Two islands** is the strongest distinct experiment: separating the roots makes the water between them an active compositional choice. **Offset oval** is worth a short owner trial for lateral arrangements. Keep **Petite** as a specialist option; at unchanged stock size and camera scale it emphasizes height and concentrates the insertion target. None replaces the original by default.

The screenshots are observations of one deterministic trio, not a user preference study: reed, single flower, fern frond; ordinals 1–3 and seeds 8278/9255/10232. Each layout seats the trio in its own bed; only placement changes. No plant is scaled, refit, regenerated on load, or altered to flatter a vessel. All matched images use the same viewport, canonical camera and world scale. Front, three-quarter, Above, insertion outlines, Garden Compare and 320×640 browser layouts are in `browser/`.

## What changes

| Profile | Vessel width × depth | Allowed planting area | Plan area vs original field | Intent |
| --- | --- | --- | --- | --- |
| Original | 5.28 × 5.28 | Circle r=1.22 at (0,0) | 100% | Exact control silhouette |
| Compact | 4.224 × 4.224 | Circle r=0.92 at (0,0) | 57% | Less bowl, still generous |
| Petite | 3.379 × 3.379 | Circle r=0.67 at (0,0) | 30% | Few lines, strong vertical tension |
| Offset oval | 5.174 × 3.590 | Ellipse rx=0.68, rz=0.43 at (-0.45,0) | 20% | Open water to one side |
| Two islands | 5.28 × 5.28 | Two circles r=0.42 at (±0.75,0) | 24% total | Separate roots; 0.66 unpinned gap |

Dimensions are domain units, not centimeters. Vessel geometry scales horizontally only; height and water level stay fixed. The ceramic profile itself remains the original hollow lathe. Oval is an affine version of that profile, not a new hand-authored pot. Kenzan supports scale separately to each footprint. Pins retain their 0.11 spacing and physical size. The support body extends slightly past the valid field, as before. The visible insertion outline, pin filtering, pointer validity and keyboard seating consume the same area definitions. Camera presets, stage lens, botanical geometry and world scale are unchanged. Waterline marks are filtered to the selected water surface.

## Intentional experimental contract

The ordinary app retains its current bowl and storage. Only a recognized `?vesselStudy=original|compact|petite|offset|islands` opts in; unknown values do not. Each profile has independent working, Garden and diagnostic keys, also separate from the normal workbench. The explicit Original control has isolated study storage too.

The study intentionally revises the single-circle insertion/base law to a union of explicit ellipses. An invalid pointer seat follows the pointer but cannot commit. Keyboard seats are generated inside a component, alternating components for Two islands. A base is clamped to the component nearest its acquisition root, so it cannot jump across the water. Contact prevention still checks its ordinary continuous motion path after footprint clamping; no protection solver or marker module was modified. New profile areas are wholly inside the core's existing r=1.22 outer clamp. This prototype does not support larger external beds.

Old canonical graphs load byte-for-byte after serialization, including inactive cut history. Legacy roots outside a selected footprint are never relocated on load. For a deliberate base edit, an out-of-field acquisition keeps its normalized elliptical extent for that grab; releasing inward reduces the allowance on the next grab. This is an explicit legacy escape policy, not strict in-field certification for imports. Aim, Bend, Prune and Undo keep the existing laws.

Garden View and Compare use the current study's vessel, including thumbnails. The current Garden backup schema has no vessel field. Restore a study backup into the same study. Importing into another profile preserves all botanical data but displays that destination's vessel. Do not promote this storage approach to a player-facing multi-vessel collection without adding a versioned arrangement-level vessel identity.

## Evidence and limits

- `npm ci` completed with the repository lockfile unchanged.
- 21 focused tests cover profile routing, storage isolation, pointer/keyboard domain seating, gap rejection, component-preserving base travel with protection on/off, exact cancellation/release/Undo, stock-preserving bend, prune history and old graph persistence; projected boundaries are checked in Front/¾/Above and all visible pins must lie inside the permitted field.
- `tests/browser/vessel-study.mjs` exercises real DOM/pointer input for every profile: invalid release, cancelled insertion with no save, valid planting, protected bead bending, pruning, Undo, keyboard planting, exact reload, Garden Keep/View/Return/Compare and untouched ordinary-bowl storage. `browser/checks.json` is the result record.
- The approved overlap/protection control presentation is unchanged; narrow Chromium layouts are inspected separately. This is browser automation, not a physical-phone acceptance pass.
- Main's frozen phase-2 Garden equality test has a floating-point mismatch on Node 24.21.0 and 22.22.3 here; reproduced on untouched `09db578`. Do not regenerate fixtures to hide it. See `verification.txt` for the final runtime outcomes.
- No ceramic collision, leaf/flower collision, automatic fitting, preferred-stem count or composition scoring was added. Existing protection exclusions and legacy overlapping-pair policy remain in force.

## Minimal integration interface with the background/perch/export work

`src/study/vesselProfiles.ts` owns immutable definitions and pure footprint rules. `ThreeStudioOptions.vesselProfile?: VesselProfile` is the presentation entry point. `createDomainAdapters(prevention?, vesselProfile?)` is the insertion/base constraint seam. `vesselStudyStorageKey` and `keyboardPlantingPoint` are app composition helpers. All are additive; absence retains ordinary behavior.

The only shared-file seams are options/imports and vessel rendering in `ThreeStudio.ts`, app wiring in `IkebanaApp.ts`, config parsing, and the comparison studio constructor. The background/perch/export task should own a separate presentation group/options object; it must not modify these footprint ellipses or botanical transforms. This branch leaves floor, lights, background, camera, material detail, Garden cover UI, capture/export behavior, protection solver, overlap overlay, core and input coordinator files unchanged. Both tasks can pass their options into the same `ThreeStudio` call. This is an integration note, not an attempt to merge the other work.

For a later production pass, persist a stable versioned `vesselProfileId` in the arrangement envelope, never on each plant. Missing IDs resolve to Original. Carry it through working save, Keep, copy, import/export and both comparison panes; unknown IDs should be reported without changing stored plants. Keep framing/perch choices separate and avoid automatically changing either the graph or camera when a vessel changes.

## Parked ideas and next decision

- Crescent, annulus, L-shaped or polygon beds: wait until there is an explicit rule for sliding around nonconvex boundaries. A naive nearest-point clamp could jump across holes.
- Transfer between islands: requires an explicit lift/reseat verb and preservation of protection and Undo semantics; dragging across empty water is not that verb.
- More than two islands, unequal island sizes and per-island heights: not needed to answer this first separation question.
- Tall vases and neck openings: require insertion-depth, occlusion and ceramic-contact decisions. Horizontal basin scaling alone is insufficient.
- Automatic fitting or rescaling stored stems: excluded. A later deliberate camera framing command could be evaluated separately.
- Global vessel switching inside an existing saved bowl: wait for the arrangement envelope and an owner-approved policy for out-of-field roots.

Suggested owner pass: spend a few minutes in Compact and Two islands on a physical phone. Plant near each edge and the split gap; move bases, bend, prune, Cancel and Undo; toggle the existing protection; Keep and reopen a bowl. Judge the precision of small targets and the clarity of the island lock before adopting any candidate. No deployment is proposed by this study.
