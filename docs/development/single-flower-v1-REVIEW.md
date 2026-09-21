# Candidate review

- Candidate / role: Candidate B — single flower face / Agent B
- Baseline SHA / head SHA / branch: `251a94a1b176fb5f32cdbabfaed009deb92c7f57` / (PR head) / `cursor/experiment-material-single-flower-v1-bd04`
- Author / independent reviewer: Agent B implementation; independent review not yet run
- New compositional choice: One cream open-face bloom on a slender herbaceous stem, offset on a short pedicel so the face can be aimed toward or away from another line. Two modest elliptic leaves give scale and a keep-or-cut choice without becoming a leafy mass or flowering-branch texture.
- Main weakness: In a mixed bowl the cream face can sit behind the woody flowering mass. Leaves are very small from Front. Browser automation could not hold a prune preview to demonstrate Escape-cancel (unit tests cover that path). No physical-phone signoff.

## Implementation

- Generator version / material ID: `single-flower-v1` / `single-flower`
- Topology and attachment decisions: One 14-segment `trunk` (~5.3 units, radius 0.034), two 3-segment petioles with elliptic leaves, one 4-segment pedicel near 93% with a single terminal bloom. Pedicel is angled off the stem so the line remains readable past the flower. Pedicel and petioles are not bend-handle targets; aiming/bending the stem turns the face. Cut below the pedicel deactivates bloom and stalk via the normal distal plan; records remain as history.
- Appearance changes: Additive `open-face` bloom form — five broader, shallower petals whose local +Z follows the supporting material frame. Cream/apricot `0xf0d2ae`, sage stem, elliptic leaves. Flowering `cupped` seven-petal path is unchanged. Bloom `hitRadius` moved onto appearance (flowering keeps 0.46).
- Response values and rationale: Stem stiffness `0.46` (between leafy `0.39` and flowering trunk `0.72`); stalks `0.18` matching both references. Shared solver only.
- Shared files changed and why:
  - `materialCatalog.ts` / `materialResponse.ts` / new `src/core/singleFlower.ts` — additive registration
  - `materialAppearance.ts` / `botanicalGeometry.ts` — open-face surfaces
  - `ThreeStudio.ts` — appearance-driven petal count, calyx form, bloom hit radius (no generatorVersion conditionals, no new verbs)
  - `index.html` — one tray card
  - `src/styles.css` — tray `auto-fit` so the third card can share a row on wide screens
  - Focused tests, golden fixture, reports, screenshots
- Requested interface extensions (or none): None required for craft law. Optional later: tray density on 390px portrait (three stacked cards occupy much of the rail). Do not add a rotate-flower tool.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass | Baseline 112/112; candidate 119/119. `docs/development/reports/single-flower-v1/baseline-verify.txt` and `candidate-verify.txt` |
| Existing golden fixtures unchanged | pass | `tests/core/generator.test.ts`, `tests/core/leafyShoot.test.ts` |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/singleFlower.test.ts`; graph inventory JSON |
| Aim / bend preserve stock and attachments | pass | unit tests; browser aim/bend screenshots and clip |
| Exact prune and retained history | pass (automated); browser commit observed | pedicel/stem cut tests; browser prune-commit screenshot. Held preview + Escape was not captured in the cloud browser |
| Cancel / invalid insert preserve ordinal and save | pass | `tests/app/materialInsertion.test.ts` |
| Reload after a committed edit | pass (workbench autosave) | prune survived reload in workbench namespace |
| Garden original survives edited copy | pass (desktop browser) | Keep "single flower mixed" → View → Copy → edit copy → original still uncut |
| Front / ¾ / Above | pass | `screenshots/count1-front.webp`, `count1-three-quarter.webp`, `count1-above.webp`. Above shows a shallow dish in plan, not a camera billboard |
| Mixed reference scene | pass | `screenshots/mixed6-front.webp` — cream face distinct from pink cupped blooms |
| Narrow portrait / short landscape / large text | pass / pass / not run | 390×844 stacked tray; ~700×430 three cards remain labeled. Large-text not run |
| Physical phone | not run | |

## Rendering comparison

- Browser/device/OS/viewport/pixel ratio: Google Chrome on Linux 6.12.94+; desktop drawingBuffer 1785×996; DevTools 390×844 and 700×430. Not a physical phone.
- Same seed, count, camera and render conditions for baseline/candidate: workbench Front, seed 8278
- Report files:
  - count 1: `workbench-single-flower-count1-renderer.json` — 37 calls, 11906 triangles, 4 branch visuals, 3 organ visuals
  - mixed 6: `workbench-mixed-6-renderer.json` — 371 calls, 54714 triangles, 54 branch visuals, 40 organ visuals
  - count 12: screenshot `count12-front.webp`; graph inventory 48 branches / 36 organs. Browser JSON download for count 12 was mixed-6 (operator mix-up); renderer counts for that stress scene are missing
- Resource-count differences: single-flower count 1 is much cheaper than a flowering branch (4/3 vs 15/10 records). Mixed 6 includes two of each catalog material.
- Observed response/stalls, if actually measured: none measured; 12 cream heads remained interactive in the cloud browser
- Missing measurements: GPU timings, physical-phone acquisition, large-text zoom, count-12 draw calls

## Independent findings

None from an independent reviewer. Implementation notes, not correctness failures:

1. Severity: observation. Mixed with flowering-branch, the cream face can be partly occluded. Color and open dish still read as a different role.
2. Severity: observation. Front view almost hides the two leaves; they are clearer at ¾ and in the count-12 band of foliage.
3. Severity: evidence gap. Cloud pointer automation released prune instead of holding a doomed preview, so Escape-cancel was not filmed. Domain tests still pass.
4. Severity: low. 390px portrait stacks three material cards and consumes a large fraction of the rail.

## Recommendation

Integrate after independent review if the face remains the desired third role. Smallest useful next pass: physical-phone insert/aim/cut, and a count-12 renderer download. Keep species-likeness work separate from this generic face.
