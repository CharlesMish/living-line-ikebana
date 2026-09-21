# Candidate review

- Candidate / role: Candidate B — single flower face / Agent B
- Baseline SHA / head SHA / branch: `251a94a1b176fb5f32cdbabfaed009deb92c7f57` / (see PR head) / `cursor/experiment-material-single-flower-v1-bd04`
- Author / independent reviewer: Agent B implementation; independent review not yet run
- New compositional choice: One cream open-face bloom on a slender herbaceous stem, offset on a short pedicel so the face can be aimed toward or away from another line. Two modest elliptic leaves give scale and a keep-or-cut choice without becoming a leafy mass or a flowering-branch texture.
- Main weakness: Tray now holds three cards; the auto-fit grid is a small shared CSS accommodation and still needs a physical-phone check for crowding. The bloom is more legible than the cupped reference but still a generic dish, not a species. No physical-phone signoff.

## Implementation

- Generator version / material ID: `single-flower-v1` / `single-flower`
- Topology and attachment decisions: One 14-segment `trunk` (~5.3 units, radius 0.034), two 3-segment petioles with elliptic leaves, one 4-segment pedicel near 93% with a single terminal bloom. Pedicel is angled off the stem so the line remains readable past the flower. Pedicel and petioles are not bend-handle targets; aiming/bending the stem turns the face. Cut below the pedicel deactivates bloom and stalk via the normal distal plan; records remain as history.
- Appearance changes: Additive `open-face` bloom form — five broader, shallower petals whose local +Z follows the supporting material frame. Cream/apricot color `0xf0d2ae`, sage stem, elliptic leaves. Flowering `cupped` seven-petal path is unchanged. Bloom `hitRadius` moved onto appearance (flowering keeps 0.46).
- Response values and rationale: Stem stiffness `0.46` (between leafy `0.39` and flowering trunk `0.72`); stalks `0.18` matching both references. Shared solver only. The stem should feel more yielding than the woody flowering trunk; slightly more held than the leafy shoot.
- Shared files changed and why:
  - `materialCatalog.ts` / `materialResponse.ts` / new `src/core/singleFlower.ts` — additive registration
  - `materialAppearance.ts` / `botanicalGeometry.ts` — open-face surfaces
  - `ThreeStudio.ts` — appearance-driven petal count, calyx form, bloom hit radius (no generatorVersion conditionals, no new verbs)
  - `index.html` — one tray card
  - `src/styles.css` — tray `auto-fit` so the third card can share a row on wide screens
  - Focused tests, golden fixture, graph inventory report
- Requested interface extensions (or none): None required for craft law. Optional later: a dedicated bloom hit-center offset if phone acquisition of the face feels tight; a tray layout pass if three cards crowd a short landscape window. Do not add a rotate-flower tool.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass on baseline (112 tests); candidate verify recorded after implementation | `docs/development/reports/single-flower-v1/` |
| Existing golden fixtures unchanged | pass | `tests/core/generator.test.ts`, `tests/core/leafyShoot.test.ts`, additive single-flower checks |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/singleFlower.test.ts`; graph inventory report |
| Aim / bend preserve stock and attachments | pass | bend rest-length test in `singleFlower.test.ts` |
| Exact prune and retained history | pass | pedicel cut removes bloom; stem cut retains inactive records |
| Cancel / invalid insert preserve ordinal and save | pass | `tests/app/materialInsertion.test.ts` |
| Reload after a committed edit | not run in browser yet | automated load path exists for mixed materials; browser Keep/reload pending |
| Garden original survives edited copy | not run in browser yet | existing Garden tests still pass; mixed fixture now includes this catalog entry |
| Front / ¾ / Above | not run in browser yet | workbench path: `?workbench=1` |
| Mixed reference scene | not run in browser yet | catalog mixed fixture cycles flowering / leafy / single-flower |
| Narrow portrait / short landscape / large text | not run | needs device/browser |
| Physical phone | not run | |

## Rendering comparison

- Browser/device/OS/viewport/pixel ratio: not recorded (automated graph inventory only so far)
- Same seed, count, camera and render conditions for baseline/candidate: graph inventories use workbench seeds 8278/9255/10232 and counts 1/6/12
- Report files for count 1 / mixed 6 / stress 12: `docs/development/reports/single-flower-v1/workbench-graph-inventory.json`
- Resource-count differences (graphs): single-flower count 1 is 4 branches / 3 organs vs leafy 8/7 and flowering 15/10. Count 6 is 24/18; count 12 is 48/36. Mixed 6 at seed 8278 is two of each material.
- Observed response/stalls, if actually measured: not measured
- Missing measurements: draw calls, triangles, GPU timings, phone feel

## Independent findings

None yet from an independent reviewer. Known implementation notes, not correctness failures:

1. Severity: low. Three tray cards may wrap on mid-width windows. Expected: all three remain independently reachable. Observe on phone.
2. Severity: observation. Open-face bloom is an appearance extension because the cupped seven-petal vocabulary reads as blossom texture, not a single face. It is still a shallow dish, not a deformable petal simulation.

## Recommendation

Revise after visual/phone pass, then consider integrate if the face stays distinct beside both references. Smallest useful next pass: Front/¾/Above screenshots, one insert→aim→bend→prune-cancel→prune→reload clip, and Garden Keep→View→Copy→Change→Reload with a mixed bowl. Keep species-likeness work separate from this generic face.
