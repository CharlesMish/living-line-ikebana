# Polish baseline

Evidence only. This branch does not change generators, materials, rendering, or UI behavior. Behavioral contract: preserved. Physical phone: not run.

## Tip

| | |
| --- | --- |
| Exact tip | `2aef05424d751cda2137f3749b2d71e7fdf0c6d1` |
| `origin/main` at capture | same SHA |
| Branch | `cursor/polish-baseline-evidence-8602` |
| Product diff | none (`src/`, `tests/`, `index.html`, lockfile untouched) |

## Model

This run is https://cursor.com/agents/bc-df3d79b4-6497-5963-835f-a659e2c48602.

`cursor-cloud` run-info `originalModelName` is `grok-4.7`. The payload has no `thinking-budget` field and no `reasoning_effort` field. The launch text requested Grok 4.7 with reasoning effort high. This agent is Grok 4.7. No other model was substituted. That budget cannot be confirmed from the session record.

## Capture

Headless Chrome 148 (`HeadlessChrome/148.0.0.0`) on Linux, ANGLE SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`). WebGL2. CSS canvas 1280×800, drawing buffer 1280×800, `devicePixelRatio` 1, window inner size 1280×800. Full-page PNG, so the rail is in the frame. Not a physical phone.

Script: `tools/capture-polish-baseline.mjs`. App URL `?workbench=1&test=1`, with `fresh=1` when a clean bowl was required. Bend variant is the default fixed bead (`bendVariant: "fixed"`). No `bend=touch`.

Draw counts: `drawElements` / `drawArrays` wrapped before page scripts. Mode 4 is counted as triangles. The vessel is included. Counters reset, then one view-button click, then three animation frames. These are resource counts, not FPS or phone frame time. Front, three-quarter, and Above returned the same call and triangle counts for every scene below; the comparison row is Front.

Machine record: `docs/development/reports/polish-baseline/browser-capture.json`.

## Verify

`npm ci && npm run verify` on this tip. Node v22.14.0. `npm ci` added 63 packages.

| Check | Result |
| --- | --- |
| Typecheck | passed |
| Tests | 229 passed, 0 failed, 0 skipped |
| `dist/index.html` | 41544 bytes |
| `dist/assets/index-BZXrXw7o.css` | 19942 bytes |
| `dist/assets/index-BqEN0oLZ.js` | 696764 bytes |
| `dist/assets/index-BqEN0oLZ.js.map` | 3436005 bytes |
| `dist/ikebana-web-alpha-standalone.html` | 900016 bytes |
| `validate-dist` | 5 files, standalone self-contained |

Test count stayed 229. Dist byte sizes match the build recorded for the Phase 2 independent review. `dist/` is not committed.

## Twelve specimens

Workbench single-material fixture, count 1, starting seed **8278**. Plant id `plant-1`. Workbench index 0 uses that starting seed (`workbenchCuttingSeed`). Ordinal 1. Canonical hash is the app's FNV-1a of the canonical document.

Catalog order is the Materials list and `round5-palette`.

| Order | Material | Generator | Hash | Front calls | Front triangles |
| --- | --- | --- | --- | --- | --- |
| 1 | flowering-branch | `one-branch-v1` | `b81a82aa` | 153 | 26042 |
| 2 | leafy-shoot | `leafy-shoot-v1` | `6645d73a` | 81 | 14034 |
| 3 | bare-branch | `bare-branch-v1` | `eae353f1` | 27 | 8766 |
| 4 | single-flower | `single-flower-v1` | `21619d02` | 51 | 12166 |
| 5 | reed | `reed-v1` | `7a30da1d` | 11 | 6838 |
| 6 | flower-volume | `flower-volume-v1` | `5c6ba5af` | 81 | 16734 |
| 7 | arching-trailer | `arching-trailer-v1` | `d0ebb2e1` | 41 | 10058 |
| 8 | foliage-fan | `foliage-fan-v1` | `0c41197f` | 103 | 16134 |
| 9 | blossom-spray | `blossom-spray-v1` | `e313704c` | 83 | 17998 |
| 10 | nodding-flower | `nodding-flower-v1` | `f4ed4497` | 29 | 12302 |
| 11 | berry-twig | `berry-twig-v1` | `0d768a64` | 95 | 14338 |
| 12 | fern-frond | `fern-frond-v1` | `32a97877` | 91 | 16726 |

Stills, same seed and count, Front / three-quarter / Above:

`docs/development/reports/polish-baseline/<material>-seed8278-count1-front.png`
`docs/development/reports/polish-baseline/<material>-seed8278-count1-three-quarter.png`
`docs/development/reports/polish-baseline/<material>-seed8278-count1-above.png`

## Cost scenes to re-measure

Same wrap and view-click protocol. Later lanes should reload these scenes, not a different count or seed.

| Scene | Hash | Calls | Triangles | Still |
| --- | --- | --- | --- | --- |
| `round5-palette` × 12, seed 8278, Front | `6fd84a83` | 777 | 110010 | `docs/development/reports/polish-baseline/round5-palette-seed8278-count12-front.png` |
| Arrangement A, Garden view, Front | `3b1e9ad9` | 255 | 34414 | `docs/development/reports/polish-baseline/arrangement-a-leafy-fern-fan-front.png` |
| Arrangement B, Garden view, Front | `1f7e3e94` | 253 | 42090 | `docs/development/reports/polish-baseline/arrangement-b-berry-flower-accents-front.png` |

`round5-palette` × 12 hash `6fd84a83`, 777 calls, and 110010 triangles match the counts already published for that fixture in the Phase 2 integration and independent reviews. Three-quarter and Above of the palette and of both arrangements repeated those same counts. The single-specimen table above is the count-1 companion under the same wrap.

## Arrangements

Garden backup: `artifacts/polish-baseline-arrangements.json` (`gardenVersion` 1, two entries). Built in the workbench Garden (`ikebana-web-alpha:workbench-garden-v1`) by keyboard activation of the selected source card (click `detail` 0, the production keyboard seat), then ordinary Aim, then one committed prune on A only. Kept with Garden → Keep this bowl. Imported back through the Garden file input. View after import matched the keep hash for both.

Keyboard seats use `successfulSeatIdentity`: seed `(7301 + ordinal × 977) >>> 0`. That is why ordinal 1 is seed 8278, then 9255, 10232, 11209.

Newest entry is first in the file.

### A — Leafy fern and fan

| | |
| --- | --- |
| Garden id | `b63160eb-bd11-4f91-bad9-654bd778160a` |
| Kept at | `2026-09-23T17:13:36.521Z` |
| Ordinal | 3 |
| Seated hash | `2c29f804` |
| After aims | `44d3e992` |
| Kept / viewed hash | `3b1e9ad9` |

| Plant | Material | Generator | Seed |
| --- | --- | --- | --- |
| `plant-1` | leafy-shoot | `leafy-shoot-v1` | 8278 |
| `plant-2` | fern-frond | `fern-frond-v1` | 9255 |
| `plant-3` | foliage-fan | `foliage-fan-v1` | 10232 |

Aims, Shape tool, Front: `plant-2:rachis` by (−72, +8) px, operation `aim`, hash `2c29f804` → `04671e28`. `plant-3:stem` by (+76, −6) px, operation `aim`, hash `04671e28` → `44d3e992`.

Prune, committed: `plant-2:pinna-4`. Cue: “Cut leaf stem / Tip + 1 leaf · release to cut”. Hash `44d3e992` → `3b1e9ad9`. Inactive organ: `plant-2:pinna-blade-4`. Branch records stayed active. Ordinal stayed 3.

Stills: `arrangement-a-leafy-fern-fan-front.png`, `arrangement-a-leafy-fern-fan-three-quarter.png`, `arrangement-a-leafy-fern-fan-above.png`.

### B — Berry and flower accents

| | |
| --- | --- |
| Garden id | `5a03717a-b69d-4be6-8c1a-d09a1474d8a5` |
| Kept at | `2026-09-23T17:13:43.964Z` |
| Ordinal | 4 |
| Seated hash | `58952009` |
| Kept / viewed hash | `1f7e3e94` |

| Plant | Material | Generator | Seed |
| --- | --- | --- | --- |
| `plant-1` | berry-twig | `berry-twig-v1` | 8278 |
| `plant-2` | blossom-spray | `blossom-spray-v1` | 9255 |
| `plant-3` | flower-volume | `flower-volume-v1` | 10232 |
| `plant-4` | nodding-flower | `nodding-flower-v1` | 11209 |

Aims, Shape tool, Front, each operation `aim`: `plant-2:stem` (−64, +10) px, `58952009` → `33f901ea`; `plant-3:stem` (+48, −18) px, `33f901ea` → `c76c1fe5`; `plant-4:stem` (+86, +12) px, `c76c1fe5` → `1f7e3e94`. No prune. All organs stayed active. Ordinal stayed 4.

`plant-2` at seed 9255 has 5 organs. The count-1 blossom specimen at seed 8278 has 6. The arrangement did not cut that spray.

Stills: `arrangement-b-berry-flower-accents-front.png`, `arrangement-b-berry-flower-accents-three-quarter.png`, `arrangement-b-berry-flower-accents-above.png`.

The smoke keeps below are not in this JSON.

## Interaction smoke

Workbench count 1, seed 8278, Front, fixed bead. One woody cutting (`bare-branch`) and one fern (`fern-frond`). Physical phone: not run.

Sequence on each: pointer select on the branch sample (zero move), Aim from an offset that acquired `aim` rather than the pale bead, bend on the bead, prune preview then Escape, committed prune, reload without `fresh=1`, Garden Keep, View, Copy via Replace.

| Step | Bare branch `plant-1:trunk` / prune `plant-1:distal` | Fern `plant-1:rachis` / prune `plant-1:pinna-2` |
| --- | --- | --- |
| Select | operation `aim`, hash stayed `eae353f1`, selected `plant-1:trunk` | operation `aim`, hash stayed `32a97877`, selected `plant-1:rachis` |
| Aim | offset (0, +80) px from the sample, drag (+64, −24), hash `eae353f1` → `49abbec8` | offset (0, +120) px, drag (+48, +20), hash `32a97877` → `1d40c4fa` |
| Bend | offset (0, −16) px, drag (+36, +28), operation `bend`, hash → `bf99b950` | offset (0, 0), same drag, operation `bend`, hash → `13f16a3a` |
| Preview | “Cut twig / Tip only · release to cut”, hash stayed `bf99b950` | “Cut leaf stem / Tip + 1 leaf · release to cut”, hash stayed `13f16a3a` |
| Escape | transaction cleared, hash stayed | transaction cleared, hash stayed |
| Commit | hash → `d85af919`, ordinal 1 | hash → `3a655f55`, ordinal 1 |
| Reload | `d85af919` | `3a655f55` |
| Garden view | `d85af919` | `3a655f55` |
| Garden copy | `d85af919` | `3a655f55` |

Bare `plant-1:distal` stayed active. `activeLength` 1.0226 → 0.5623. Fern `plant-1:pinna-2` stayed active. `activeLength` 0.1134 → 0.0624. Inactive organ: `plant-1:pinna-blade-2`.

Stills, Front:

- `smoke-bare-branch-aim-front.png`
- `smoke-bare-branch-bend-front.png`
- `smoke-bare-branch-prune-preview-front.png`
- `smoke-bare-branch-prune-commit-front.png`
- `smoke-bare-branch-reload-front.png`
- `smoke-bare-branch-garden-view-front.png`
- `smoke-bare-branch-garden-copy-front.png`
- `smoke-fern-frond-aim-front.png`
- `smoke-fern-frond-bend-front.png`
- `smoke-fern-frond-prune-preview-front.png`
- `smoke-fern-frond-prune-commit-front.png`
- `smoke-fern-frond-reload-front.png`
- `smoke-fern-frond-garden-view-front.png`
- `smoke-fern-frond-garden-copy-front.png`

## Opportunity notes

Observations from these stills. This pass does not assign a change to every material. Flowering branch, leafy shoot, bare branch, single flower, reed, and arching trailer are in the specimen index for comparison; this note does not add a separate opportunity for them.

**Fern, comb-like regularity.** Seed 8278, Front and Above: one straight rachis and paired pinnae of similar size and spacing, lying in one plane. Above makes that plane obvious. Three-quarter still reads as a feather, a little narrower. In arrangement A the fern (seed 9255) keeps that even comb beside the leafy shoot and the fan. The committed cut removes one blade (`pinna-blade-4`). The frond still reads as a full feather; the gap is a single missing leaflet.

**Foliage fan, spray and leaf readability.** Seed 8278, Front: three arms and small separate leaves that can be told apart. Above: a thin spread over the bowl, and the individual blades are harder to separate than the arms. In arrangement A the fan is the right-hand spray and stays readable next to the fern, with smaller leaves than the fern's pinnae.

**Berry visibility.** Seed 8278 has 9 berry organs. Front: dark spheres on short stalks, distinct from the wood, clustered so they do not each read as a separate countable fruit. Above: they shrink to a few dark dots on the line. In arrangement B the berries stay on the left woody cutting and remain easier to see from Front and three-quarter than from Above, next to the three flower accents.

**Blossom spray.** Seed 8278, Front and three-quarter: thin green laterals leave the main stem at sharp angles and carry small pale tufts in separated groups. The joint is angular. The tuft itself is a small repeated mass.

**Flower volume.** Seed 8278: one dense terminal head on one stem. The florets merge into a volume. Separate flowers are harder to count here than the spaced tufts on the blossom spray. Little neck bend. In arrangement B it sits between the spray and the nodding flower and reads as the dense accent.

**Nodding flower.** Seed 8278: the stem bends and the bell hangs. Three-quarter shows the side of the cup and the neck. Above shows the opening. The angle is in that neck. In arrangement B it is the right-hand accent and stays distinct from the blossom tufts and the flower-volume head.

**Materials list below the fold.** At this 1280×800 window the Materials panel `clientHeight` is 286 and `scrollHeight` is 539. At `scrollTop` 0, fully visible: flowering branch, leafy shoot, bare branch, single flower, reed, flower volume. Arching trailer is about 40% in view. Foliage fan, blossom spray, nodding flower, berry twig, and fern frond are entirely below the fold. Scrolled to `scrollTop` 253, those six are fully visible and the first six are not. Stills: `materials-list-1280x800.png`, `materials-list-1280x800-scrolled.png`.

## Phone

`tests/browser/PHONE_WEB_TEST_CARD.md` was read as the later checklist. Physical phone: not run. No narrow-viewport pass, no large-text pass, no Safari chrome, no touch ownership.
