> Frozen PR65 study at3324076. Its isolated-save limitations below are resolved in the combined release; see [COMBINED_SCENE.md](../../COMBINED_SCENE.md).

# Vessel and planting-footprint study

Exploratory branch from main `09db578e2430754e992b4acb6228a201d66e1555` (October 2, 2026). Draft PR #65; no merge or deployment. Open `/vessel-study.html` locally, or `START-HERE.html` in the standalone ZIP. The five first-pass layouts retain their IDs and storage; this follow-up adds two layouts and six appearance combinations.

## Recommendation

**Compact** remains the conservative everyday candidate. **Long offset bed** is the most useful new composition study: its roughly 9:1 field makes a lateral fan possible without making the entire bowl tiny. **Separate small bowls** creates a different decision from Two islands: there is a real ceramic and water gap, and each vessel is smaller than Petite. Try both additions before adding more shapes. Sand/Glaze stays the default; Celadon/Stoneware is a quiet alternative, and Charcoal gives stronger edge contrast. None of these observations establishes a user preference or changes ordinary play.

Matched comparisons use reed, single flower and fern frond at their original stock lengths, seeds 8278/9255/10232 and ordinals 1–3. Only seat positions vary by layout. The separate fan example uses five full-stock reeds, deliberately seated along the long bed and shaped using ordinary Aim. It is an authored example, not the standard comparison or an automatic fitting algorithm. No stored plant is rescaled or regenerated.

## Geometry and framing

| Profile | Ceramic width × depth | Permitted bed in X/Z | Field area vs original | Intent |
| --- | --- | --- | --- | --- |
| Original | 5.28 × 5.28 | Circle r=1.22 at (0,0) | 100% | Original control |
| Compact | 4.224 × 4.224 | Circle r=0.92 at (0,0) | 57% | Less ceramic mass |
| Petite | 3.379 × 3.379 | Circle r=0.67 at (0,0) | 30% | Few lines, vertical tension |
| Offset oval | 5.174 × 3.590 | Ellipse radii 0.68 / 0.43 at (-0.45,0) | 20% | Open water to one side |
| Two islands | 5.28 × 5.28 | Two circles r=0.42 at (±0.75,0) | 24% total | 0.66 unpinned water gap |
| Long offset bed | 5.174 × 3.590 | Ellipse radii 1.45 / 0.16 at (-0.30,-0.22) | 16% | 2.90 × 0.32, near-linear field |
| Separate small bowls | Each 2.851 × 2.851; total width 6.151 | Two circles r=0.46 at (±1.65,0) | 28% total | 0.449 clear ceramic gap |

These are domain units, not centimeters. The original hollow lathe is scaled only in X/Z; height, water level, stock size, camera presets, stage lens and lights stay fixed. The long bed reuses the first offset oval's vessel silhouette. Each separate bowl has its own ceramic, rim, water surface, front mark and kenzan; no common hidden bowl or water spans the gap.

Kenzan support geometry follows each field with the original slight margin outside the valid insertion boundary. Pins retain 0.11 spacing and physical size. Pin filtering, outlines, pointer validity and keyboard seating share the same area definitions. Waterline marks use the union of actual water surfaces, including the portions beyond the old centered basin. All seven comparison images use the same viewport/camera; the palette sheet uses one documented closer camera for all six finishes, with unchanged production lighting and exposure. There is no automatic zoom-to-fit.

## Appearance, separate from geometry

More → Vessel offers Sand, Celadon or Charcoal, each with Glaze or Stoneware. Glaze preserves the original material properties. Stoneware uses greater roughness, lower clearcoat and deterministic fine neutral bump grain (0.008 amplitude); it changes shading normals only. Colors are explicit sRGB. No finish changes the mesh, silhouette, insertion boundary, water, collision envelope, stem data or camera. Each renderer owns/disposes its materials and optional grain texture.

Appearance is remembered in the URL (`vesselColor`, `vesselFinish`), not written into the botanical autosave or Garden schema. Opening the dialog cancels an active edit before applying a choice; no live preview is saved. Both bowls currently share one choice. Per-part selections are supported by the handoff descriptor, but a separate UI for them is parked.

## Experimental contract and saves

Only a recognized `?vesselStudy=original|compact|petite|offset|islands|long-bed|vessel-pair` opts in. Each profile has separate working, Garden and telemetry keys, also separate from the normal workbench. Normal play retains its original default bowl and storage. The explicit Original control has isolated study storage too.

The study intentionally revises the centered circular insertion/base law to a union of explicit ellipses. Invalid seats cannot commit. Keyboard seats stay inside a field and alternate fields for split layouts. Base edits remain in the connected field nearest the acquisition root. The enclosing radius passed through the existing translation adapter is enlarged only where the new layouts require it; the acquired ellipse remains the actual constraint. The optional radius parameter is the only change in `StemPrevention.base`; continuous contact checks, exclusions, approved protection controls and overlap markers retain their existing behavior.

Canonical old and pruned graphs load without relocation or rescaling, including inactive history. An imported out-of-field root keeps its acquired normalized elliptical extent for that grab, avoiding a snap; a deliberate inward release reduces the allowance for the next grab. Imports are preserved data, not certification that every root lies in the destination bed. Aim, Bend, Prune, Cancel and Undo keep their existing laws.

**Garden backup portability is incomplete.** The current backup has no vessel identity or appearance settings. Restore into the same named study and manually select the original Color/Surface or reopen its saved URL. A matching thumbnail does not prove the reconstructed 3D scene matches: importing a Celadon/Stoneware pair into Compact/Sand/Glaze retains the same thumbnail and exact plants but renders the Compact vessel. This limitation was reproduced with actual export/import in separate browser contexts, including Make a working copy and reload. See [OWNER-TEST-GUIDE.md](OWNER-TEST-GUIDE.md). Do not ship a multi-vessel collection until an arrangement envelope persists a versioned layout and appearance; missing settings must resolve to Original/Sand/Glaze without rewriting plants.

## Evidence and limits

- Repository lockfile unchanged; `npm ci`, typecheck, full tests, build and standalone validation are recorded in `verification.txt`.
- 32 focused tests cover storage/routing, all seven domain footprints and projected boundaries, pins, separate geometry/water, distant protected base travel/contact, stock/history/cancellation/Undo, exact canonical persistence and six presentation-only appearance combinations.
- `tests/browser/vessel-study.mjs`: all seven profiles passed pointer/keyboard insertion, invalid/cancelled seats without save, protected Base/Aim/Bend/Prune and Undo, appearance changes without graph/save/camera changes, URL reload, Garden View/Return/Compare and preservation of the ordinary bowl. Results: `browser/checks.json`.
- `tests/browser/vessel-followup.mjs`: appearance interruption without save, actual Garden export/import, matching and mismatched restore behavior, exact working-copy reload, authored five-reed fan and six constant-light material captures. Results: `browser/followup-checks.json`.
- 320×640 Chromium layouts show the approved controls and the new appearance dialog. Physical-phone precision and feel are still untested.
- One inherited local test fails: phase-2 frozen Garden equality differs at floating-point precision on this Mac in Node 22 and 24, also reproduced on untouched main. Fixtures were not regenerated. Linux draft-PR CI is reported separately.
- No ceramic contact, leaf/flower collision, automatic fitting, scoring or inter-vessel lift/reseat gesture was added. Existing stem protection limitations remain.

## Minimal interface with the photo/background/perch lane

This branch leaves the parallel Sol task and PR #64 unchanged. The shared app/renderer wiring will need a deliberate merge later. Vessel lane owns layout definitions and material resolution; photo lane owns backdrop, perch, framing and export/cover behavior.

```ts
type VesselAppearanceChoice = { colorId: string; finishId: string };
type ResolvedVesselPart = {
  partId: string;
  appearance: VesselAppearanceChoice;
  contactY: number;
  footprintXZ: { minX: number; maxX: number; minZ: number; maxZ: number };
};
type PhotoSceneSettings = {
  layoutId: string;
  vessels: readonly ResolvedVesselPart[];
  backdropId: string;
  perchId: string;
};
```

`resolveVesselPresentation(profile, appearance)` supplies `layoutId` and `vessels`; `ThreeStudio.getVesselPresentation()` exposes the current resolved descriptor. `resolveVesselAppearance` and `applyVesselAppearance` are the pure-settings/material seam. Main, comparison and photo renderers must receive the same resolved choices and create their own disposable materials. No GPU objects cross the interface. `footprintXZ` is outer ceramic support extent, never a planting boundary. `contactY` is 0.04. The pair's combined X extent is ±3.0756: a future perch must support all pots, accounting for its actual shape, rather than assuming the old bowl radius or moving/scaling the arrangement to fit. Keep color independent of backdrop; evaluate with fixed lighting/exposure first. The existing photo branch was inspected for this interface only; combined visual harmony and export are not claimed tested here.

## Parked ideas

- Complementary puzzle vessels: interesting silhouette, but require deliberately authored wall/water shapes, a specified gap and tests for near-contact. Two genuinely separate round vessels answer the current spatial question with less ambiguity.
- Per-vessel colors: descriptor is ready; defer the extra choice until the paired layout proves useful.
- Crescents, annuli and L-shaped beds: need explicit nonconvex travel laws.
- Lift/reseat across islands or pots: requires an intentional gesture distinct from sliding a base.
- Tall vases, ceramic collision and automatic fitting: different physical/interaction problems. Stored-stem rescaling remains excluded.
