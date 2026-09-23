# Candidate review

- Candidate / role: Round 4 Lane C — nodding flower / material candidate
- Baseline SHA / head SHA / branch: runtime baseline `59e42e6554b05ff2fc415514370430716e9e8515` (merged PR #33). The branch also contains docs-only `c002c8fe9c6b2372aa1ad59310379a47ec87b079` (PR #34) so the draft sits on current main. Head is the draft PR tip. Branch `cursor/nodding-flower-v1-0b86`.
- Author / independent reviewer: Lane C. Requested model was Grok 4.7 with high thinking. The run record exposes `originalModelName: grok-4.7`. This agent is Grok 4.7. No thinking-budget or `reasoning_effort` field was exposed on the run record or in the agent interface. Independent review has not been run.
- New compositional choice: One bell that already hangs down and outward on a curved neck, above a short graspable stem and a single leaf. The mouth opens along the neck, so Front and three-quarter can look into the cup beside upright material.
- Main weakness: The neck is a pedicel, so it is not a bend handle. Aim turns the whole curve rigidly. The player cannot reshape the neck locally. Physical phone: not run.

This change preserves aim, bend, prune, cancellation, Garden, storage, and insertion-ordinal law. It appends one generator. It does not change `one-branch-v1`, the flowering or leafy goldens, or the frozen workbench profiles.

## Substitution test

The required comparison is an aimed and bent `single-flower-v1` at seed 8278, not a new species hunt.

The open-face mouth is the supporting frame's normal, spun around the stalk. It stays perpendicular to the pedicel tangent. A search of pedicel aims, a trunk aim down to the root floor, and four saturated stem bends produced a hanging stem, and it did not create a neck:

| Pose | Mouth Y | Stalk tangent Y | Mouth·tangent | Pedicel turning | Stem turning |
| --- | --- | --- | --- | --- | --- |
| Single flower, rest | -0.158 | 0.432 | ~0 | 0.047 rad | upright |
| Single flower, aimed and bent | -0.826 | -0.508 | ~0 | 0.047 rad | 1.765 rad |
| Nodding flower, rest | along the tangent | -0.592 | the mouth is the tangent | 1.783 rad | supporting stem |

The substituted flower can hang, and its shallow dish can face downward. The stalk under that dish stays almost straight (about 2.7° of turning). The nodding neck turns about 102° and the bell continues that direction, so the opening, the back, and the side are one volume. That is the concrete reason to keep the candidate rather than file it as study-only.

Stills, same canonical cameras. Left is the substituted single flower. Right is the authored nodding flower. These are offline projections of the production meshes, not WebGL:

- `docs/development/reports/nodding-flower-v1/compare-front.png`
- `docs/development/reports/nodding-flower-v1/compare-three-quarter.png`
- `docs/development/reports/nodding-flower-v1/compare-above.png`
- Rest single flower: `single-flower-rest-front.png`
- Numbers: `substitution-metrics.json`

## Implementation

- Generator version / material ID: `nodding-flower-v1` / `nodding-flower`
- Topology and attachment decisions: One 12-segment trunk (seed 8278 length about 2.35, radius 0.031). One petiole and one elliptic leaf below the crown. One 9-segment pedicel labeled flower neck, sampled from an authored cubic because `makeChain` cannot hold a descending tip. The bloom sits at the neck tip. Records: 3 branches, 2 organs. Kinds stay `trunk`, `petiole`, `pedicel`, `leaf`, and `bloom`. Pruning the neck deactivates the bloom and keeps the leaf. A stem cut below the neck deactivates the neck and bloom and retains the records. Inactive history stays.
- Appearance changes: Additive `bell` bloom. One shell whose local +Y follows the supporting tangent. Slate blue `0x7d94b8`. Stem `0x516846`. The acquisition sphere is offset along that tangent (`hitCenterY` 0.32, radius 0.66) and contains the visible shell. Cupped, open-face, and tufted petals, their counts, and their hit spheres are unchanged. `hitCenterY` is omitted on those forms, so their proxies stay at the organ origin.
- Response values and rationale: Stem stiffness `0.48`, next to the single-flower stem `0.46`. Stalks `0.18`, matching the other stalk values. Copied once at generation. Shared solver only. The nod is rest geometry, not gravity, droop, or a softer neck solver.
- Shared files changed and why:
  - `src/core/noddingFlower.ts`, `materialResponse.ts`, `materialCatalog.ts`, `index.ts` — additive generator, appended after `arching-trailer`
  - `materialAppearance.ts`, `botanicalGeometry.ts`, `ThreeStudio.ts` — bell shell. The existing radial petal path is the non-bell branch
  - `index.html` — one Materials choice and one source template. The selected source card remains the only `data-material-id`
  - Focused tests, `fixtures/plant-1-nodding-flower-v1.json`, this review, `docs/development/reports/nodding-flower-v1/`
  - Catalog-order assertions that list the live catalog, because `all-registered-materials` is defined as that list
  - `docs/BEHAVIORAL_CONTRACT.md` — the registered-generator sentence now includes provisional `nodding-flower-v1`
  - `docs/MATERIAL_REFERENCES.md` and `ARCHITECTURE.md` — provisional note
- Not changed: `reference-pair`, `all-four`, `round3-three`, `round3-palette`, aim/bend laws, cameras, Garden schema, insertion ordinals, flowering/leafy/`one-branch-v1` goldens
- Added profile: `references-plus-nodding-flower` (flowering → leafy → nodding-flower). `round4-candidates` and `round4-palette` are left for the integrator, because this lane cannot know whether the other Round 4 candidates are accepted.
- Requested interface extension: the bell needs the narrow `createOrganVisual` branch above. It does not rewrite petal instancing, hit ranking, or the material frame. Integrator: keep it out of `reference-pair`, `all-four`, and the Round 3 profiles.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass | Baseline before the change: 182 tests, zero failures, at `59e42e6554b05ff2fc415514370430716e9e8515`. Candidate, re-run after merging docs-only main (`c002c8f`): typecheck, 191 tests, zero failures, production build, standalone validation |
| Existing golden fixtures unchanged | pass | `tests/core/noddingFlower.test.ts` compares flowering and leafy fixtures and `reference-pair` / `all-four` |
| Seeds 8278 / 9255 / 10232 | pass | Same test. Front stills `nodding-front.png`, `nodding-seed9255-front.png`, `nodding-seed10232-front.png` |
| Aim / bend preserve stock and attachments | pass | Stem bend and neck aim keep rest lengths, spin, and scale. Neck `legalBendStation` stays null |
| Exact prune and retained history | pass | Neck cut deactivates only the bloom. Lower stem cut deactivates neck and bloom, keeps the leaf, retains 3 branches and 2 organs |
| Cancel / invalid insert preserve ordinal and save | pass | `tests/app/materialInsertion.test.ts` and the focused cancel test |
| Reload after a committed edit | pass (unit) | Committed prune serializes and validates. A browser reload of a pruned bowl was not captured |
| Garden original survives edited copy | pass | `tests/core/noddingFlower.test.ts` keeps a bowl, keeps a pruned copy, and the original bloom stays active |
| Front / ¾ / Above | pass | Browser captures below, plus the offline comparison stills |
| Stable `reference-pair` scene | pass | Unit test: only `one-branch-v1` and `leafy-shoot-v1`. Browser `browser-reference-pair-count6-front.png` |
| Narrow portrait / short landscape / large text | pass / pass / not run | 390×844 and 800×420 below. Large text not run |
| Physical phone | not run | |

Browser rest views, Headless Chrome 148 on Linux, SwiftShader, seed 8278, count 1, workbench `nodding-flower`:

- Front: `browser-nodding-seed8278-count1-front.png`
- Three-quarter: `browser-nodding-seed8278-count1-three-quarter.png`
- Above: `browser-nodding-seed8278-count1-above.png`
- Materials menu, including Nodding flower: `browser-materials-menu.png`
- Count 12: `browser-nodding-seed8278-count12-front.png`
- 390×844: `browser-nodding-narrow-390.png`
- 800×420: `browser-nodding-short-800x420.png`

## Rendering comparison

- Browser/device/OS: Headless Chrome 148.0.7778.96 on Linux, SwiftShader (`--use-gl=angle --use-angle=swiftshader`). Not a physical phone.
- CSS viewport (canvas) at the desktop capture: 1280×713. Browser-window inner size: 1280×713. Drawing-buffer size: 1280×713. Device pixel ratio 1. Renderer pixel ratio was not read separately from the drawing buffer. These matched in this capture; they are still separate measurements.
- Same seed and canonical cameras for the substitution stills: seed 8278, production meshes, Front / three-quarter / Above poses from `canonicalCameraPose`. The offline painter is 880×680 and is not the browser capture.
- Report files:
  - count 1 nodding: `browser-capture.json` — 29 draw calls, 12302 triangles. Graph: 3 branches, 2 organs
  - count 1 single-flower, same window: 39 draw calls, 13126 triangles
  - stable `reference-pair` 6: 667 draw calls, 91678 triangles. Generators only flowering and leafy
  - stress 12 nodding: 271 draw calls, 84814 triangles. Twelve copies are 36 branches and 24 organs
- Resource-count differences: one nodding plant draws fewer calls than one single flower in the same bowl (29 vs 39; 12302 vs 13126 triangles). The bell is one mesh. The open face is five petals plus calyx, center, and anthers. Counts include the vessel, water, and shadow passes. They are not FPS.
- Observed response/stalls, if actually measured: none measured
- Missing measurements: GPU timings, physical-phone acquisition, large-text zoom, a browser reload after a committed prune

Draw counts come from wrapping `drawElements` / `drawArrays` and reading the render scheduled by a canonical view change. `requestRender` coalesces, so a pair of view clicks in one turn schedules one frame.

## Narrow layout

The selected source card is still the only insertion binding. Nodding flower is a Materials choice.

| Window | CSS canvas | Inner window | Drawing buffer | Device pixel ratio | `.top-chrome` size |
| --- | --- | --- | --- | --- | --- |
| Desktop | 1280×713 | 1280×713 | 1280×713 | 1 | 832×119 |
| 390×844 | 390×844 | 390×844 | 390×844 | 1 | 374×180 |
| 800×420 | 800×420 | 800×420 | 800×420 | 1 | 784×119 |

At 390 the existing top row wraps. The flower, neck, and stem stayed in frame (`browser-nodding-narrow-390.png`). At 800×420 the source card and Materials button stay on one rail (`browser-nodding-short-800x420.png`).

## Independent findings

None from an independent reviewer. Implementation notes:

1. Severity: limitation. The curved neck cannot be bent. Aim rotates it. Bending the stem carries the neck with the attachment tangent.
2. Severity: observation. The substituted single flower already makes a hanging line. The distinct choice is the bell opening along that line, not the fact of a droop.
3. Severity: evidence gap. No physical phone. Desktop device pixel ratio was 1. Headless Chrome is not touch feel.

## Recommendation

Accept as a provisional catalog entry. Aim and bend can hang the single flower's shallow dish, but its mouth stays perpendicular to a nearly straight stalk, so they cannot open a bell along a curved neck.

Smallest useful next pass: a physical-phone grab of the stem, the leaf, and the bell, then one committed prune of the neck beside an upright single flower. Do not add the cutting to `reference-pair`, `all-four`, or the Round 3 profiles. Do not add a neck-only bend tool.
