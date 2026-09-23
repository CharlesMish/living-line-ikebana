# Candidate review

- Candidate / role: Lane B — blossom spray / Round 4
- Baseline SHA / head SHA / branch: `59e42e6554b05ff2fc415514370430716e9e8515` (merged PR #33) / this branch tip / `cursor/blossom-spray-v1-2d36`
- Author / independent reviewer: Lane B. Requested model was Grok 4.7 with high thinking (`reasoning_effort: high`). The runtime identified itself as Grok 4.7, a language model trained by SpaceXAI. No thinking-budget or `reasoning_effort` field was exposed in this runtime, so that budget cannot be confirmed from the session. No other model was substituted. Independent review has not been run.
- New compositional choice: A thin green stem with two or three laterals, and four to six small flowers spaced along those laterals. Each flower is one pedicel and one existing tufted bloom. The rhythm is a line of separated accents, beside the woody flowering branch and apart from the packed flower-volume head.
- Main weakness: The blooms reuse the flower-volume tuft, so a single flower still reads as that floret. The distinction is spacing, pale color, and the green laterals, not a new petal. Six tufts also cost more triangles than one flowering branch. A basal group cut leaves a very short lateral stub. Physical phone: not run.

This change preserves the behavioral contract. Aim, hit ranking, cameras, ownership, cancellation, insertion ordinals, Garden semantics, storage schemas, and the shared bend solver are unchanged. `blossom-spray-v1` is registered additively in contract section 1. Stiffness is copied once at generation. `schemaVersion` stays 1. Graphs do not store a material id. `one-branch-v1` and the other six existing goldens stay. `reference-pair`, `mixed`, `all-four`, `round3-three`, and `round3-palette` do not list this cutting.

## Cutting one flower versus removing its group

Seed 8278, plant-1, ordinary prune plan:

- A cut on `plant-1:stalk-2-1` at `plant-1:bloom-2-1` removes only that bloom. The pedicel stays active and shorter. `plant-1:bloom-2-2` and both other groups stay. No branch record is deleted.
- A cut partway along `plant-1:group-2` (distance 1.2) removes only the distal stalk `plant-1:stalk-2-2` and its bloom. The nearer flower on that same lateral stays.
- A cut near the base of `plant-1:group-2` (distance 0.12) removes both of that lateral’s stalks and both of its blooms. The lateral record stays active with `activeLength` under 0.2. Groups 1 and 3, the stem, and their points stay. Four blooms remain, and their height span stays above 1.5, so the line is still readable with the middle accent gone.

Preview does not mutate the source graph. Inactive records remain. The same stalk-versus-lateral split holds on seeds 9255 and 10232.

## Implementation

- Generator version / material ID: `blossom-spray-v1` / `blossom-spray`
- Topology and attachment decisions: One 16-segment stem, length about 5.15–5.35, radius 0.026. Seed 8278 is three laterals (`plant-1:group-1` through `group-3`) and six pedicels (`plant-1:stalk-G-F`), each carrying `plant-1:bloom-G-F` at the pedicel tip. Pedicel length is about 0.50–0.56. Two groups use stations near 0.34 and 0.68; three groups use 0.28, 0.52, and 0.76, with a small jitter. Flowers sit on alternating flanks. No leaves. Seed 8278 is 10 branches and 6 organs. Seed 9255 is 2 groups, 5 flowers, 8 branches, 5 organs. Seed 10232 matches 8278’s counts (3 groups, 6 flowers).
- Appearance changes: Existing `tufted` bloom only. Pale `0xf6d0d8`, roughness 0.66, hit radius 0.56 (the flower-volume envelope). Organ scale about 0.96–1.02. Stem `0x7d9a55`; lateral and petiole slot `0x8aab62`; pedicel `0x96b56e`. One instanced petal mesh per bloom, with per-instance transforms. No new bloom form and no extra petal draw for the prune. Cupped and open-face paths are untouched.
- Response values and rationale: Stem 0.48, lateral 0.41, stalk 0.18, in `BLOSSOM_SPRAY_RESPONSE`. The stem is more yielding than the flowering trunk (0.72) and a little stiffer than the leafy shoot (0.39). Laterals can bend. Pedicels are not bend-handle targets; aiming a flower moves that stalk. Values are copied once. The shared solver is not edited.
- Shared files changed and why:
  - `src/core/blossomSpray.ts`, `materialResponse.ts`, `materialCatalog.ts`, `index.ts` — additive generator, appended after the arching trailer
  - `materialAppearance.ts` — version appearance only
  - `index.html` — one Materials choice and one template, `data-material-choice` / `data-testid="material-choice-blossom-spray"`. The source card stays `[data-material-id="flowering-branch"]` until the player selects another cutting. Tray CSS is unchanged.
  - `src/app/workbenchProfiles.ts` — new stable profile `blossom-compare` (flowering branch → flower volume → blossom spray). Count 6 is two of each; count 12 is four of each.
  - Focused tests, `fixtures/plant-1-blossom-spray-v1.json`, this review, `docs/development/reports/blossom-spray-v1/`
  - Contract, architecture, material-reference, and workbench-profile notes, because the registered generator list and the comparison profile are now part of the documented surface
  - Tests that name the live catalog order, the dynamic `all-registered-materials` sequence, or the stem-color census, because those lists are defined as the live catalog
- Not changed: aim and edit solver, hit ranking, cameras, `TransactionCoordinator` ownership and cancellation, ordinals, Garden semantics, storage schemas, `botanicalGeometry.ts`, `ThreeStudio.ts`, shared bend laws, the seven existing generators and goldens, `reference-pair` / `mixed` / `all-four` / `round3-three` / `round3-palette`
- Requested interface extensions (or none): None for craft law. `all-registered-materials` count 6 still takes the first six catalog entries, so it still omits the arching trailer and this spray. Do not add the spray to the frozen profiles.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | baseline pass; tip recorded after this handoff run | Baseline SHA `59e42e6554b05ff2fc415514370430716e9e8515`: `npm ci` then `npm run verify`, 182 tests, 0 failures, typecheck, Vite build, standalone validation. Tip verify is run on this branch after the review lands and is reported in the PR. |
| Existing golden fixtures unchanged | pass | Seven prior generators and their fixtures are not regenerated. Catalog order keeps them and appends `blossom-spray`. `tests/core/blossomSpray.test.ts` checks the frozen profile ids. |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/blossomSpray.test.ts` and `docs/development/reports/blossom-spray-v1/identity.json`. Nearest bloom gaps 1.5076 / 1.2943 / 1.5259. Flower-volume head spans on the same seeds are 0.5559 / 0.5705 / 0.5435. Spray height spans 3.1454 / 2.4262 / 3.1524. A scan of seeds 0–399 stayed at 2–3 groups and 4–6 flowers; the smallest nearest gap was about 1.28. Canonical hashes: seed 8278 `3483806f`, seed 9255 `5250a9a7`, seed 10232 `38deec1e`. Fixture `fixtures/plant-1-blossom-spray-v1.json` is ordinal 1. |
| Aim / bend preserve stock and attachments | pass | Unit test: aiming `plant-1:stalk-1-1` and bending `plant-1:group-1` keep rest lengths and do not move the stem or the other laterals. Pedicels are not bend targets. |
| Exact prune and retained history | pass | Unit test above, plus committed browser specimen `seed8278-group-removed-front.png`, canonical hash `603a4906`, Front camera hash `f3827392`. Render inventory lists the stem, three group ids, and the four stalks and four blooms that remain active. Graph record counts stay 10 branches and 6 organs (`resources.json`). |
| Cancel / invalid insert preserve ordinal and save | pass | `TransactionCoordinator`: cancelled insert leaves ordinal 0, no plants, no autosave. The same reservation then commits as plant-1, ordinal 1, one save. Cancelled prune of `plant-1:group-2` at 0.12 restores the intact serialization and writes no second save. |
| Reload after a committed edit | pass | After the committed group cut, `IkebanaApp.loadInitialDocument` reloads `blossom-spray-v1` with bloom-2-1 inactive, bloom-1-1 active, and group-1 still active. Ordinal stays 1. |
| Garden original survives edited copy | pass | `docs/development/reports/blossom-spray-v1/garden-backup.json`. Entry “Spray beside flowering branch and flower volume” is plant-1 spray seed 8278, plant-2 flowering seed 9255, plant-3 flower volume seed 10232, Front camera, ordinal 3, thumbnail null. Entry “Copy with one spray group removed” is the same references with plant-1 group-2 descendants inactive. `GardenStore.keep` of the intact entry, then a structured clone edited to the pruned plant-1, leaves the loaded original unchanged. |
| Front / ¾ / Above | pass | `seed8278-front.png` (`f3827392`), `seed8278-three-quarter.png` (`3873951b`), `seed8278-above.png` (`fb0ff9ba`). Compare trio, same cameras: `compare-front.png`, `compare-three-quarter.png`, `compare-above.png`, canonical hash `bb24c9e2`. Also `seed9255-front.png` and `seed10232-front.png`. |
| Stable `reference-pair` scene | pass | Profile definitions are unchanged. `blossom-compare` is a separate stable profile. Browser compare shots are that profile, not `reference-pair`. |
| Narrow portrait / short landscape / large text | pass / pass / not run | 390×844 Materials: `.top-chrome` 374×179.78, options clientHeight 286, scrollHeight 363, text ends at Blossom spray. 844×390: `.top-chrome` 828×119.23, options clientHeight 190, scrollHeight 363. `narrow-390-materials.png`, `narrow-390-materials-scrolled.png`, `short-landscape-materials.png`. Silhouettes stay hidden under 640px by the existing rule. One source card. Large text not run. |
| Physical phone | not run | Phone-scale acquisition is the headless proxy test below. |

Headless phone acquisition (`tests/presentation/blossomSprayPicking.test.ts`): CSS 390×844, canonical Front camera `(0, 3.7, 15)` looking at `(0, 2.55, 0)`, `STUDIO_VERTICAL_FOV`. For seeds 8278, 9255, and 10232, sampled petal vertices include `InstancedMesh` instance matrices. `collectHitCandidates` returns that organ, the pedicel as `branchId`, and `screenDistancePx` 0. Each bloom is one eight-petal tuft. After the group-2 prune, petal mesh records stay 6, shown tufts drop to 4, and visible draws drop. Flower volume has 5 tuft meshes. The flowering branch has 0 tuft meshes. Draws stay below organs × 8.

Browser limits, stated so they are not read as gesture sign-off: Chrome did not click Garden Keep, View, or Copy, and did not drive a live pointer insert, aim, bend, or prune cancel. Those paths are the unit tests. The held prune ghost was not screenshotted; the committed intact and committed group-removed fronts were. `renderer.info` for the full scene, including the vessel, was not exposed.

## Rendering comparison

- Browser/device/OS: Google Chrome 148 headless on Linux, SwiftShader (`--use-gl=angle --use-angle=swiftshader`). Not a physical phone.
- CSS viewport (canvas): 1280×800. Browser-window inner size: 1280×800. Drawing-buffer size: 1280×800. Device pixel ratio 1. The drawing buffer matched the CSS canvas, so the capture ratio was 1. These are separate measurements that happened to match.
- Same seed, count, camera and render conditions for intact/group-removed: workbench storage of one `blossom-spray` plant, seed 8278, count 1, canonical Front, camera hash `f3827392`. Compare shots use `blossom-compare` ordinals 1–3 (seeds 8278 / 9255 / 10232), canonical hash `bb24c9e2`.
- Report files under `docs/development/reports/blossom-spray-v1/`:
  - count 1: `capture.json` inventory for `seed8278-front.png` — 10 branch ids, 6 organ ids, canonical `3483806f`
  - stable comparison, not `reference-pair`: `compare-front.png` and the same capture entry — three plants, spray then flowering branch then flower volume
  - group removed: `seed8278-group-removed-front.png`, canonical `603a4906`
  - identity and resources: `identity.json`, `resources.json`, `garden-backup.json`
- Resource-count differences (headless botanical census, proxies and vessel excluded, not `renderer.info`, not FPS), seed 8278, base `{x:0,y:0.55,z:0}`:

| Specimen | Branches | Organs | Visible draws | Triangles | Shown tuft meshes |
| --- | --- | --- | --- | --- | --- |
| Blossom spray | 10 | 6 | 34 | 11320 | 6 |
| Spray, group 2 removed | 10 | 6 | 24 | 7700 | 4 |
| Flower volume | 8 | 7 | 32 | 9704 | 5 |
| Flowering branch | 15 | 10 | 50 | 8524 | 0 |

  The spray uses fewer draws than the flowering branch and more triangles, because six tufts replace two cupped blooms. Removing the middle group drops draws and triangles without allocating a new petal mesh. Record counts stay 10 and 6.
- Observed response/stalls, if actually measured: none measured
- Missing measurements: physical phone, large-text zoom, GPU timings, full-scene `renderer.info`, live pointer preview frames, a browser click-through of Garden Keep / View / Copy

## Narrow layout

The tray layout was not redesigned. An eighth choice uses the existing scrollable Materials list. Below 640px the existing rule hides silhouettes.

| Window | CSS canvas | Inner window | Drawing buffer | Device pixel ratio | `.top-chrome` size | Materials options |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop | 1280×800 | 1280×800 | 1280×800 | 1 | 832×119.23 | collapsed during the plant shots |
| 390×844 | 390×844 | 390×844 | 390×844 | 1 | 374×179.78 | clientHeight 286, scrollHeight 363, width 232 |
| 844×390 | 844×390 | 844×390 | 844×390 | 1 | 828×119.23 | clientHeight 190, scrollHeight 363, width 232 |

The option text at both narrow sizes is Flowering branch, Leafy shoot, Bare branch, Single flower, Reed, Flower volume, Arching trailer, Blossom spray. `narrow-390-materials-scrolled.png` shows the last row after scrolling that menu. The source card remains one card.

## Independent findings

None from an independent reviewer. Implementation notes:

1. Severity: observation. Tufts resemble flower-volume florets. Separation is the gap (nearest spray bloom above 1.27 across the scanned seeds, against a flower-volume head under 0.58) plus the pale green line. A new petal mesh is not required for that difference.
2. Severity: observation. A basal lateral cut leaves `activeLength` under 0.2. The stub is easy to miss. The descendant records are inactive and retained, which is the ordinary plan.
3. Severity: integration limit. The eighth Materials row needs the existing menu scroll. The tray was not given a new layout.
4. Severity: evidence gap. No physical phone. Desktop and phone-sized headless captures used device pixel ratio 1.

## Recommendation

Keep this as a review candidate if the missing role is a distributed floral rhythm beside the woody flowering branch and the packed flower-volume head. Keep it out of `reference-pair`, `mixed`, `all-four`, `round3-three`, and `round3-palette`. Do not merge from this lane.

Smallest useful next pass: a physical-phone insert, aim of one stalk, and prune of one lateral in `blossom-compare`, then confirm the short group stub is readable. Do not add a fourth petal form, floret-level tools, or a change to the shared prune plan.
