# Candidate review

- Candidate / role: Lane A — berry-bearing twig / Phase 2. Small round accents on a restrained woody structure. The arrangement choice is keeping a cluster or opening space by removing that lateral.
- Baseline SHA / head SHA / branch: product base `f666db8c1b9e46fc9daef05dba09a895844f8e86` (PR #39 materials combine). Implementation `ac1b096462b99411ff845dc46fd0c05e4251300e`. Evidence is the tip of `cursor/berry-twig-v1-1829`. Bend-stations #36 and organ-roll are not in this branch. Evidence-only #41 is not the product base.
- Author / independent reviewer: Lane A. Requested model was Grok 4.7 with high thinking (`reasoning_effort: high`). `cursor-cloud` run-info `originalModelName` is `grok-4.7`. The run-info payload has no `thinking-budget` field and no `reasoning_effort` field, so that budget cannot be confirmed from the session. No other model was substituted. Independent review has not been run.
- New compositional choice: A warm woody twig with two or three short laterals. Each lateral holds three or four berries. Each berry is one short pedicel and one berry organ at that tip. Clusters sit apart along the wood. The wood stays readable after a cluster is removed.
- Main weakness: At bowl scale the fruits are small. A press at the cluster midpoint, which is what the screen-target helper exposes, removes the distal berries and leaves the inner one. Clearing the whole cluster is a cut near the lateral base (distance 0.12), proven in the unit test and not as a separate browser still. Physical phone: not run.

This change preserves the behavioral contract aside from one additive organ kind. Aim, hit ranking, cameras, ownership, cancellation, insertion ordinals, Garden semantics, storage schema version, and the shared bend solver are unchanged. `schemaVersion` stays 1. `berry` is another allowed value of the existing organ `kind` field, not a new field. Graphs do not store a material id. `one-branch-v1` and the other goldens stay. `reference-pair`, `mixed`, `all-four`, `round3-three`, `round3-palette`, `round4-candidates`, and `round4-palette` do not list this cutting.

## Keeping a cluster versus removing a lateral

Seed 8278, plant-1, three clusters of three berries (`plant-1:cluster-1` through `cluster-3`, berries `plant-1:berry-G-F` on `plant-1:stem-G-F`):

- A cut on `plant-1:stem-2-1` at `plant-1:berry-2-1` removes only that berry. The pedicel stays active and shorter. The other two berries on cluster 2, and both other clusters, stay. No branch record is deleted. The cue title is `Cut berry stem` and the detail names `1 berry`. A flowering pedicel cut on the same seed still says `Cut flower stem` and does not say berry.
- A cut on `plant-1:cluster-2` at distance 0.12 removes that lateral’s three pedicels and three berries. The lateral record stays active with `activeLength` under 0.2. Clusters 1 and 3, the wood, and their points stay. Six berries remain active.
- The headless browser press used the screen target on `plant-1:cluster-2` at material distance about 0.42. That committed cut deactivated `plant-1:berry-2-2` and `plant-1:berry-2-3` and left `plant-1:berry-2-1`. That is the ordinary distal plan, not a special berry tool.

Preview does not mutate the source graph. Inactive records remain. The same one-berry versus whole-lateral split holds on seeds 9255 and 10232.

## Implementation

- Generator version / material ID: `berry-twig-v1` / `berry-twig`
- Topology and attachment decisions: One 16-segment woody twig, radius 0.052, length about 4.56–4.87 on the frozen seeds. Seed 8278 is three laterals and nine berries (13 branches, 9 organs). Seed 9255 is three laterals and ten berries (14 branches, 10 organs); cluster 2 has four berries. Seed 10232 matches 8278’s counts. Pedicels are about 0.18–0.23. Stations for three clusters sit near 0.26, 0.50, and 0.74 of the wood, with a small jitter, and the basal span stays above 1. No leaves and no blooms. A scan of seeds 0–399 stayed at 2–3 clusters and 6–10 berries.
- Appearance changes: One sphere per berry, `living-line/berry`, radius 0.07, 96 triangles, color `0x8a2e45`, roughness 0.4. The hit sphere radius is 0.145, centered at local Y 0.055 with the fruit, so a press on the ball acquires that berry’s pedicel. Wood `0x6a4532`, roughness 0.9. Lateral `0x7b5540`. Pedicel `0x8d684c`. Unused leaf and bloom slots copy flowering. Cupped, open-face, tufted, and bell paths are untouched. The flowering bud mesh is untouched.
- Response values and rationale: Wood 0.78, cluster 0.52, berry stem 0.18, in `BERRY_TWIG_RESPONSE`. The wood is stiffer than flowering wood (0.72) and softer than bare wood (0.86). Cluster laterals can aim and bend. Pedicels are not bend-handle targets (`legalBendStation` is null). Values are copied once. The shared solver is not edited.
- Shared files changed and why:
  - `src/core/berryTwig.ts`, `materialResponse.ts`, `materialCatalog.ts`, `index.ts` — additive generator, appended after nodding flower
  - `types.ts`, `validation.ts`, `serialization.ts` — allow organ kind `berry`. No new field. `schemaVersion` stays 1
  - `materialAppearance.ts`, `botanicalGeometry.ts`, `ThreeStudio.ts` — one sphere and a berry appearance slot. Other generators do not emit berries
  - `craftCues.ts`, `IkebanaApp.ts` — a pedicel that carries only berries is named “Berry stem” in aim and cut cues. Flowering pedicels stay “Flower stem”
  - `index.html`, `styles.css` — one Materials choice, one template, and a berry silhouette fill. The source card stays `[data-material-id="flowering-branch"]` until the player selects another cutting
  - `src/app/workbenchProfiles.ts` — new stable profile `references-plus-berry-twig` only
  - Focused tests, `fixtures/plant-1-berry-twig-v1.json`, this review, `docs/development/reports/berry-twig-v1/`
  - Contract, architecture, material-reference, and workbench-profile notes, because the registered generator list, the organ kind, and the comparison profile are now part of the documented surface
  - Tests that name the live catalog order or the dynamic profile option list, because those lists are the live catalog
- Not changed: aim and edit solver, hit ranking, cameras, `TransactionCoordinator` ownership and cancellation, ordinals, Garden semantics, `one-branch-v1`, the Round 4 generators and goldens, `reference-pair` / `mixed` / `all-four` / `round3-*` / `round4-*`
- Requested interface extensions: organ kind `berry`, so prune and aim cues can name a fruit instead of a flower or a bud, and one optional `berry` appearance slot. No new player verb.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass | On this branch after the candidate: typecheck, 217 tests, 0 failures, Vite build, distribution valid (5 files; standalone self-contained). |
| Existing golden fixtures unchanged | pass | Flowering and leafy fixtures are compared in `tests/core/berryTwig.test.ts`. `round4-candidates` and `round4-palette` do not contain `berry-twig-v1`. |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/berryTwig.test.ts` and `docs/development/reports/berry-twig-v1/identity.json`. Graph hashes: seed 8278 `cbc40796`, seed 9255 `89732d86`, seed 10232 `a33184af`. Fixture `fixtures/plant-1-berry-twig-v1.json` is ordinal 1. |
| Aim / bend preserve stock and attachments | pass | Unit test: bending `plant-1:cluster-1` and aiming `plant-1:stem-1-1` keep rest lengths and do not move the wood or the other cluster. Bending the wood keeps every rest length. Pedicels are not bend targets. Browser: Escape during a wood drag left the document hash unchanged; a released wood drag changed it from `cd6cd9c2` to `cf606432`. |
| Exact prune and retained history | pass | Unit test above. Browser midpoint cut of cluster 2 left `plant-1:berry-2-2` and `plant-1:berry-2-3` inactive and `plant-1:berry-2-1` active. Document hash `0d768a64` to `cd6cd9c2`. Still: `seed8278-cluster-cut-front.png`. |
| Cancel / invalid insert preserve ordinal and save | pass | Unit: cancelled insert leaves ordinal 0, no plants, no autosave. The same reservation commits as plant-1, ordinal 1. Cancelled prune restores the intact serialization and writes no second save. Browser: Escape during the cluster press left hash `0d768a64` and autosave write count 0. Still: `seed8278-prune-cancel-front.png`. |
| Reload after a committed edit | pass (unit) / not run (browser reload) | `IkebanaApp.loadInitialDocument` reloads `berry-twig-v1` with the opened cluster’s berries inactive, a kept berry active, and ordinal 1. The headless page was not reloaded after the cut. |
| Garden original survives edited copy | pass | Unit test keeps the intact berry twig beside flowering and leafy, then a structured clone with one cluster inactive does not replace the stored original. Browser, workbench Garden key: Keep “Berry twig seed 8278”, View (`dataset.gardenViewing` true, `garden-view.png`), Copy via Replace (`garden-copy.png`). After copy the document hash was the intact `0d768a64` and the ordinal stayed 1. |
| Front / ¾ / Above | pass | Count 1: `berry-twig-seed8278-count1-front.png` (camera `f3827392`), `berry-twig-seed8278-count1-three-quarter.png` (`3873951b`), `berry-twig-seed8278-count1-above.png` (`fb0ff9ba`). Profile `references-plus-berry-twig` count 6, same cameras: `references-plus-berry-twig-seed8278-count6-front.png`, `...-three-quarter.png`, `...-above.png`, document hash `8ac91406`. |
| Stable `reference-pair` scene | pass | Profile definitions for `reference-pair` are unchanged. Browser `reference-pair` count 6 front is `reference-pair-seed8278-count6-front.png`, document hash `1bdb37be`. It does not include berry twig. |
| Narrow portrait / short landscape / large text | pass / pass / not run | 390×844: `.top-chrome` 374×179.78, Materials clientHeight 286, scrollHeight 495, width 230. `narrow-390-materials.png`, `narrow-390-materials-scrolled.png` (Berry twig is the last row). 844×390: `.top-chrome` 828×119.23, canvas 844×390. `short-landscape-materials.png` is that bowl with the menu closed. Large text not run. |
| Physical phone | not run | Phone-scale acquisition is the headless proxy test below. |

Headless phone acquisition (`tests/presentation/berryTwigPicking.test.ts`): CSS 390×844, canonical Front camera `(0, 3.7, 15)` looking at `(0, 2.55, 0)`, `STUDIO_VERTICAL_FOV`. For seeds 8278, 9255, and 10232, the projected center of each berry mesh returns that organ, its pedicel as `branchId`, and `screenDistancePx` 0. After the cluster-2 prune, berry mesh records stay 9 and shown berries drop to 6.

## Rendering comparison

- Browser/device/OS: Google Chrome 148 headless on Linux, ANGLE SwiftShader (`--use-gl=angle --use-angle=swiftshader`). Not a physical phone.
- CSS viewport (canvas) at the desktop captures: 1280×713. Browser-window inner size: 1280×713. Drawing-buffer size: 1280×713. Device pixel ratio 1. The drawing buffer matched the CSS canvas. These are the measured sizes; the process was started with `--window-size=1280,800`.
- Same seed and Front camera for the count comparison: workbench seed 8278, canonical Front, camera hash `f3827392`.
- Report files under `docs/development/reports/berry-twig-v1/`: `browser-capture.json`, `identity.json`, and the stills named above.
- Resource counts:

Botanical census only (hit proxies and vessel excluded, not `renderer.info`, not FPS), seed 8278, base `{x:0,y:0.55,z:0}`:

| Specimen | Branches | Organs | Visible draws | Triangles | Shown berry meshes |
| --- | --- | --- | --- | --- | --- |
| Berry twig | 13 | 9 | 22 | 2200 | 9 |
| Twig, cluster 2 removed | 13 | 9 | 16 | 1620 | 6 |
| Twelve berry twigs, seeds `(8278 + 977 × index)` | — | — | 273 | 27060 | — |
| Blossom spray, same census | 10 | 6 | 34 | 11320 | 0 |
| Flowering branch, same census | 15 | 10 | 50 | 8524 | 0 |

Full-scene WebGL `drawElements` / `drawArrays` during one view click, including the vessel. `renderElapsedMs` is the click plus two animation frames, not a GPU timer. Idle animation frames after the count-1 front view made 0 GL calls (median 16.7 ms, max 16.8 ms) because the studio renders on demand. Do not read any of these as phone frame time.

| Scene | View | Calls | Triangles | renderElapsedMs |
| --- | --- | --- | --- | --- |
| berry-twig × 1 | Front | 95 | 14338 | 107.1 |
| berry-twig × 1 | ¾ | 95 | 14338 | 70.1 |
| berry-twig × 1 | Above | 95 | 14338 | 100.6 |
| berry-twig × 12 | Front | 1099 | 112218 | 121.2 |
| references-plus-berry-twig × 6 | Front | 631 | 80962 | 108.7 |
| reference-pair × 6 | Front | 667 | 91678 | 116.9 |

- Observed response/stalls, if actually measured: the on-demand renderer issued no GL calls across 19 idle frames. The count-12 view click completed in about 121 ms of wall time on this SwiftShader session.
- Missing measurements: physical phone, large-text zoom, GPU timestamp queries, a browser reload of the pruned document.

## Narrow layout

The tray layout was not redesigned. An eleventh choice uses the existing scrollable Materials list. Below 640px the existing rule hides silhouettes.

| Window | CSS canvas | Inner window | Drawing buffer | Device pixel ratio | `.top-chrome` size | Materials options |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop | 1280×713 | 1280×713 | 1280×713 | 1 | 832×119.23 | collapsed during the plant shots; opened menu clientHeight 286, scrollHeight 495, width 215 |
| 390×844 | 390×844 | 390×844 | 390×844 | 1 | 374×179.78 | clientHeight 286, scrollHeight 495, width 230 |
| 844×390 | 844×390 | 844×390 | 844×390 | 1 | 828×119.23 | menu closed in that still |

The scrolled portrait menu ends at Arching trailer, Foliage fan, Blossom spray, Nodding flower, Berry twig. The source card remains one card.

## Independent findings

None from an independent reviewer. Implementation notes:

1. Severity: observation. The fruits are small beside the bowl. Separation from blossom spray and flower volume is the woody line, the round silhouette, and the gap between clusters, not a new petal.
2. Severity: observation. A basal lateral cut leaves `activeLength` under 0.2. The descendant records are inactive and retained.
3. Severity: integration limit. The eleventh Materials row needs the existing menu scroll. The tray was not given a new layout.
4. Severity: evidence gap. No physical phone. Desktop and phone-sized headless captures used device pixel ratio 1.

## Recommendation

**accept-candidate.** The cutting is a woody line with separated round clusters, and removing one lateral clears that cluster’s berries while the other clusters stay, which is a different arrangement choice from recoloring blossoms or packing a flower head.

Keep it out of `reference-pair`, `mixed`, `all-four`, `round3-three`, `round3-palette`, `round4-candidates`, and `round4-palette`. Do not merge from this lane.

Smallest useful next pass: a physical-phone insert, aim of one cluster, and a basal prune of one lateral in `references-plus-berry-twig`. Do not add a berry-pluck verb or a change to the shared prune plan.
