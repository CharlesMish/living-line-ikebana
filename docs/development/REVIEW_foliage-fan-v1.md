# Candidate review

- Candidate / role: Round 4 Lane A — foliage fan
- Baseline SHA / head SHA / branch: `59e42e6554b05ff2fc415514370430716e9e8515` / code `c215ce17ad8e1f90e573e0309ed193d43806766e`; evidence and this review land on the following commit of `cursor/foliage-fan-v1-4f49` / `cursor/foliage-fan-v1-4f49`
- Author / independent reviewer: Lane A. Agent-service model: `grok-4.7` (`originalModelName`). No thinking-budget or `reasoning_effort` field was exposed. Independent review has not been run.
- New compositional choice: A shorter green spray than the leafy shoot. One stem, three lateral arms, and eight small elliptic leaves. The leaves together make a broad spread. The player can cut one arm and keep the other two, or bend and aim the stem so the whole spread sits beside a taller line.
- Main weakness: Aim has no axial roll, so the generator keeps the fan's facing inside a limited yaw. A headless pointer drag that started on the opening arm acquired a leaf stalk instead of cutting the whole arm. The full gap is in the unit test and the Garden study, not in that drag.

## Implementation

- Generator version / material ID: `foliage-fan-v1` / `foliage-fan`
- Topology and attachment decisions: Always one `trunk` (`fan stem`, 12 segments), three `lateral` arms (`arm-opening`, `arm-answering`, `arm-crown`, 6 segments each), and eight petioles with one leaf each (3 + 3 + 2). No blooms. Randomness is consumed only at construction. The first arm attaches past 1.05 units on every review seed (about 1.18–1.25), so the base stays a grip. Stem length is about 2.52–2.74, under the leafy shoot by more than 1.5. Side arms sit about 2.1 radians apart and the seeded yaw stays inside ±0.55 radians so the spread reads from Front. Review seeds at base `(0, 0.55, 0)`: width about 2.28–2.54 against a leafy width about 0.90–1.17, and the fan crown stays more than 1.3 below the leafy crown.
- Appearance changes: Existing elliptic leaf. Stock `0x7c9a34`, roughness `0.64`. Leaf `0x5a8a3c`, vein `0x9aaf62`. Bloom slot copies flowering because the appearance record requires it; nothing generates a bloom. No `botanicalGeometry.ts` change. Leaf scales are 0.62–0.78, under the leafy shoot's largest blades.
- Response values and rationale: `FOLIAGE_FAN_RESPONSE` is stem `0.47`, arm `0.36`, stalk `0.18`, copied into persisted stiffness. The stem yields more than a reed (`0.56`) and holds more than the leafy ribbon (`0.39`), so the spread can be lowered and still read as a fan. Arms yield a little more than the stem. Stalks use the shared `0.18`. A loaded graph keeps a mutated stiffness; the profile is not reapplied.
- Shared files changed and why:
  - `src/core/foliageFan.ts` — new generator
  - `src/core/materialResponse.ts` — `FOLIAGE_FAN_RESPONSE`
  - `src/core/materialCatalog.ts` — registry plus a tray id appended after `arching-trailer`
  - `src/core/index.ts` — barrel export
  - `src/presentation/materialAppearance.ts` — `foliage-fan-v1` look
  - `src/app/workbenchProfiles.ts` — provisional `references-plus-foliage-fan` only
  - `index.html` — one Materials choice and one source template; panel CSS is unchanged
  - `docs/BEHAVIORAL_CONTRACT.md` — generator list names `foliage-fan-v1`
  - `ARCHITECTURE.md`, `docs/MATERIAL_REFERENCES.md`, `docs/development/WORKBENCH_FIXTURE_PROFILES.md` — the additive candidate
  - Focused tests, golden fixture, Garden study backup
- Requested interface extensions: None. The provisional profile is for playability. The integrator decides whether `references-plus-foliage-fan` remains and how Round 4 profiles are frozen. Removing the catalog item leaves saved graphs loadable if the generator stays registered.

Contract: preserved. The seven existing generators and goldens are unchanged. `reference-pair`, `mixed`, `all-four`, `round3-three`, and `round3-palette` keep their order. Aim, bend, and prune are the shared laws. A cut of the opening arm at distance `0.18` deactivates that arm's three stalks and three leaves and leaves the answering and crown records identical. Records stay. No draw call was added for that pruning unit; leaves remain ordinary organ meshes.

Baseline verification at `59e42e6`: `npm ci && npm run verify`, 182 tests, 0 failures. `origin/main` also has documentation-only PR #34 (`c002c8f`). This branch does not include that commit. `docs/MATERIAL_REFERENCES.md` will need a doc merge with #34.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass on the code tip | 191 tests, 0 failed, at `c215ce17ad8e1f90e573e0309ed193d43806766e`. Typecheck, test, build, and dist validation. The evidence commit adds this review, reports, and screenshots only. |
| Existing golden fixtures unchanged | pass | Flowering and leafy fixtures still match in `tests/core/foliageFan.test.ts` |
| Seeds 8278 / 9255 / 10232 | pass | Same test. Golden `fixtures/plant-1-foliage-fan-v1.json` is ordinal 1 / seed 8278 |
| Aim / bend preserve stock and attachments | pass | Unit test at the three seeds. Headless Chrome also aimed the stem and bent the default bead; stem rest lengths stayed put |
| Exact prune and retained history | pass (unit and Garden) | Opening-arm cut at `0.18` drops that side and keeps answering and crown points, scales, and spins. Branch and organ counts stay 12 and 8 |
| Cancel / invalid insert preserve ordinal and save | pass | `tests/app/materialInsertion.test.ts` cancelled foliage-fan insertion. Headless prune preview cancelled with Escape and the canonical hash stayed |
| Reload after a committed edit | pass (headless) | One committed leaf-stalk cut survived reload without `fresh=1`. See the browser summary |
| Garden original survives edited copy | pass | Unit test on `artifacts/foliage-fan-garden.json`. Headless Keep / View / Copy: viewed hash matched, the copy changed, the kept card still matched |
| Front / ¾ / Above | pass (headless Chrome) | `artifacts/foliage-fan/study-front.png`, `study-three-quarter.png`, `study-above.png`, plus `comparison-*.png` |
| Stable `reference-pair` scene | pass | Profile graphs unchanged. Same-viewport report below |
| Narrow portrait / short landscape / large text | pass / pass with scroll / not run | 390×844 and 844×360 below. Large text not captured |
| Physical phone | not run | No device. Headless Chrome is not a phone signoff |

Study bowl `artifacts/foliage-fan-garden.json`, title “A leafy line beside an opened fan”. Viewed in headless Chrome after import:

| Plant | Seed | Material | What it shows |
| --- | --- | --- | --- |
| plant-1 | 8278 | leafy-shoot-v1 | Taller line, left |
| plant-2 | 9255 | foliage-fan-v1 | Full spread, opening length about 1.68, three opening leaves active |
| plant-3 | 10232 | foliage-fan-v1 | Opening arm cut to 0.18, zero opening leaves active, answering and crown leaves still active |

`references-plus-foliage-fan` at seed 8278 and count 6 is flowering, leafy, fan, flowering, leafy, fan. It is not `mixed`. `mixed` remains `reference-pair`.

## Rendering comparison

- Browser: Headless Chrome 148 on Linux, SwiftShader. Not a physical phone.
- CSS viewport 1280×800 (canvas client rect). Browser window inner size 1280×800. Drawing buffer 1280×800. Device pixel ratio 1. Renderer pixel ratio 1. Renderer cap 1.8.
- Same seed 8278, Front, and those capture fields for every report in `docs/development/reports/foliage-fan-v1/`.
- Report files:
  - foliage-fan ×1: 75 calls, 14578 triangles, 55 geometries, 12 branch visuals, 8 organ visuals
  - leafy-shoot ×1: 59 calls, 13150 triangles, 44 geometries, 8 branch visuals, 7 organ visuals
  - references-plus-foliage-fan ×6: 447 calls, 60058 triangles, 327 geometries, 70 branch visuals, 50 organ visuals
  - reference-pair ×6: 463 calls, 65078 triangles, 343 geometries, 69 branch visuals, 51 organ visuals
  - foliage-fan ×12: 823 calls, 92546 triangles, 583 geometries, 144 branch visuals, 96 organ visuals
- Resource-count differences: one fan is 16 calls and 1428 triangles above one leafy shoot under the same capture. Twelve fans are 823 calls and 92546 triangles, above a reference-pair ×6 (463 calls, 65078 triangles). These are resource counts, not FPS.
- Observed response/stalls: not measured.
- Missing measurements: GPU timings, physical-phone frame time, large text.

Leaf and bloom proxies for every registered material, including this fan's elliptic leaves, still contain the visible surfaces in `tests/presentation/botanical.test.ts`, using the faceted hit mesh and per-instance transforms where a mesh is instanced. These leaves are ordinary meshes, not a new instanced blade. The existing elliptic hit sphere is the one already centered on the blade.

## Narrow picker

Headless Chrome. Materials menu opened. Tray CSS was not changed.

| CSS viewport | Device pixel ratio | Canvas | Panel scrollHeight | Panel clientHeight | Foliage fan in the DOM list |
| --- | --- | --- | --- | --- | --- |
| 390×844 | 1 | 390×844 | 363 | 286 | yes; the list overflows slightly |
| 844×360 | 1 | 844×360 | 363 | 190 | yes in the DOM; the open panel shows about half the rows, so the last row needs a scroll |

Screenshots: `artifacts/foliage-fan/picker-portrait-390x844.png`, `picker-landscape-844x360.png`.

## Independent findings

None from a separate reviewer. Notes for that pass:

1. Correctness is covered for the graph cut. The headless drag did not perform that cut: moving from the opening arm toward the stem acquired `petiole-opening-1` and removed one leaf. Grabbing the arm near its base is still the shared prune. The Garden plant-3 graph is the reproducible gap.
2. Observation. A strong aim of the whole stem can carry tips below the pin plane. No collision response was added.
3. Observation. Twelve fans cost more draw calls than the reference-pair stress comparison. Each leaf is still its own organ mesh.
4. Evidence gap. Physical phone: not run. Large text: not run.

## Recommendation

Revise only the phone check, and otherwise this is ready for the integrator to look at as the spread candidate. It is a group of existing elliptic leaves on three editable arms, not a broad deformable blade and not a named species. Smallest next pass: on a phone, insert one fan beside one leafy shoot, grab a small leaf tip, aim one arm, cancel a prune, then cut the opening arm near its base and reload. Do not add roll, a merged blade mesh, or a tray redesign for that pass.
