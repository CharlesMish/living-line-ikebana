# Candidate review

- Candidate / role: Round 3 Lane A — individual reed
- Baseline SHA / head SHA / branch: `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37` / (PR head) / `cursor/reed-v1-individual-cutting-51d2`
- Author / independent reviewer: Lane A. Platform model field: `grok-4.7` (requested Grok 4.7 high thinking; no separate thinking-budget field was exposed). Independent review has not been run.
- New compositional choice: One cutting is one slender culm. Several cuttings make repeated lines and the open intervals between them. Height comes from the seeded stock plus an ordinary prune. Lean is aim. Spacing is where the base sits. One culm in the study bowl is bent.
- Main weakness: The visible stroke is only a few CSS pixels wide, so a single reed is a faint line until repetition gives it a job. Headless centerline clicks selected it at 320 and 390. That is not a finger test.

## Implementation

- Generator version / material ID: `reed-v1` / `reed`
- Topology and attachment decisions: Always one `trunk` and zero organs. Sixteen segments, radius `0.024`, no forks and no sheaf. Length is one later Mulberry32 sample in `3.35..6.25`, because the first sample of successive seat seeds sits in a narrow band. Review seeds at base `(0, 0.55, 0)`: seed 8278 length 4.671, seed 9255 length 5.127, seed 10232 length 3.894. The tip stays a rising line (rise above 90% of stock).
- Appearance changes: Olive culm `0x4e6240`, roughness `0.8`. Leaf and bloom slots copy flowering because the appearance record requires them; nothing generates those organs. No `botanicalGeometry.ts` change.
- Response values and rationale: `REED_RESPONSE.culm` is `0.56`, copied into persisted stiffness. Shared solver. Full-drag rotation is about 36°, between leafy stem `0.39` (~42°) and flowering trunk `0.72` (~30°). The line can take an arc and still read as one stroke. This is an authored cap, not elasticity.
- Shared files changed and why:
  - `src/core/reed.ts` — new generator
  - `src/core/materialResponse.ts` — `REED_RESPONSE`
  - `src/core/materialCatalog.ts` — generator registry plus a provisional tray id appended after `single-flower`
  - `src/core/index.ts` — barrel export
  - `src/presentation/materialAppearance.ts` — `reed-v1` look
  - `index.html` — one Materials choice and one source template; panel CSS is unchanged
  - `ARCHITECTURE.md` — one sentence naming the candidate
  - Focused tests, golden fixture, study backup
  - Live-catalog assertions in existing tests, because `all-registered-materials` cycles the catalog. `reference-pair` and `all-four` assertions stay on the established lists.
- Requested interface extensions: None. Integrator hooks are listed below. If this candidate is kept, add `reed-v1` to the registered-generator sentence in `docs/BEHAVIORAL_CONTRACT.md` section 1.

### Provisional registration

This branch registers `reed` so it can be played. Stable profiles do not include it.

1. Keep `createReed` / `reed-v1` in the generator registry if any saved graph should still load.
2. The tray entry is the last `materialCatalog` item, `{ materialId: "reed", generator: reedV1 }`. Removing only that item leaves graphs loadable and restores the four-material dynamic cycle.
3. `index.html` has `[data-material-choice="reed"]` and `#material-template-reed`. Do not change `.material-options` layout for this candidate.
4. Do not add `reed` to `reference-pair` or `all-four`.

Contract: preserved. Aim and bend keep stock length. Prune shortens the culm and keeps the record. No transaction, camera, persistence, or schema change. No sheaf, spread slider, or length control.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass | 151 tests, 0 failed. Typecheck, test, build, and dist validation. |
| Existing golden fixtures unchanged | pass | Flowering and leafy fixtures still match their generators in `tests/core/reed.test.ts` |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/reed.test.ts`; golden `fixtures/plant-1-reed-v1.json` |
| Aim / bend preserve stock and attachments | pass (unit) | Rest lengths unchanged at the three seeds |
| Exact prune and retained history | pass (unit) | Culm stays active, record count stays 1, active length drops, proximal rest lengths kept |
| Cancel / invalid insert preserve ordinal and save | pass | `tests/app/materialInsertion.test.ts` cancelled reed insertion |
| Reload after a committed edit | not run in the browser | Unit path covers serialize/deserialize. No browser reload of a committed prune was filmed |
| Garden original survives edited copy | pass (unit) | Study backup parses; translating a copy does not change the backup |
| Front / ¾ / Above | pass (headless Chrome) | `artifacts/reed-lines-front.png`, `reed-lines-three-quarter.png`, `reed-lines-above.png` |
| Stable `reference-pair` scene | pass (graph + renderer) | Profile graphs unchanged. Same-viewport report below |
| Narrow portrait / short landscape / large text | pass / not run / not run | 320×568 and 390×844 below. Short landscape and large text not captured |
| Physical phone | not run | No device. Headless Chrome is not a phone signoff |

Study bowl `artifacts/reed-lines-garden.json`, title “Reed lines and the spaces between”:

| Plant | Seed | Active length | What differs |
| --- | --- | --- | --- |
| plant-1 | 8278 | 4.671 stock | Small lean, left |
| plant-2 | 9255 | 5.127 stock | Stronger lean, right |
| plant-3 | 10232 | 2.150 pruned | Short, forward |
| plant-4 | 11209 | 5.917 stock | Tallest, bent arc, right |
| plant-5 | 12186 | 3.350 pruned | Mid height, back |

Bases stay inside the usable kenzan radius. Pairwise spacing is uneven (closest gap above 0.45, widest gap more than 0.55 beyond that).

## Rendering comparison

- Browser: Headless Chrome 148 on Linux. Not a physical phone.
- Arrangement frames: CSS viewport 1280×800, device pixel ratio 1, drawing buffer 1280×800, Front camera `(0, 3.7, 15)` looking at `(0, 2.55, 0)`.
- Same seed, count, camera, and render conditions for the workbench reports below. Front, seed 8278, CSS viewport 1280×800, drawing buffer 1280×800, device and renderer pixel ratio 1, renderer cap 1.8.
- Report files: `docs/development/reports/reed-v1/`
  - reed ×1: 10 calls, 8278 triangles, 9 geometries, 1 branch visual, 0 organ visuals
  - flowering-branch ×1: 107 calls, 21026 triangles, 82 geometries, 15 branch visuals, 10 organ visuals
  - reed ×6: 25 calls, 12218 triangles, 19 geometries, 6 branch visuals, 0 organ visuals
  - reference-pair ×6: 463 calls, 65078 triangles, 343 geometries, 69 branch visuals, 51 organ visuals
- Resource-count differences: one reed is the bowl plus one tube. Against flowering ×1 under the same capture, that is 97 fewer calls and 12748 fewer triangles. Six reeds stay far under a reference-pair ×6 (25 vs 463 calls, 12218 vs 65078 triangles). These are resource counts, not FPS.
- Observed response/stalls: not measured.
- Missing measurements: GPU timings, physical-phone frame time, short landscape, large text.

## Narrow-width picking

Headless Chrome, Front, one reed (seed 8278). A centerline click used the test bridge’s projected point at 55% of the culm, below the top rail. `docs/development/reports/reed-v1/narrow-picking.json`.

| CSS viewport | Device pixel ratio | Canvas | Rail bottom | Click | Selected |
| --- | --- | --- | --- | --- | --- |
| 320×568 | 2 | 320×568 | 199 CSS px | (155, 261) on `plant-1:culm` | `plant-1` |
| 390×844 | 2 | 390×844 | 188 CSS px | (188, 388) on `plant-1:culm` | `plant-1` |

The Materials menu at both sizes showed “Reed” without scrolling (`scrollHeight` 231, panel height 233). Screenshots `artifacts/reed-narrow-320.png` and `reed-narrow-390.png` include that open menu.

The visible diameter is about `0.048 / 12.12 × viewport height` CSS pixels on the Front camera (vertical FOV 44°, target distance about 15.0): roughly 2.2 px at height 568 and 3.3 px at height 844. The shared trunk hit tube is `max(radius × 2.8, 0.22)`, so the acquisition diameter is about 21 px at height 568 and 31 px at height 844 — the same floor as every other trunk. The automation hit the centerline. It does not show whether a finger can find a 2 px stroke. At 320×568 the rail covers the top 199 px of a 568 px canvas, so the crown can sit under chrome. That is the existing rail, not a reed-specific layout change.

## Independent findings

None from a separate reviewer. Notes for that pass, not scored failures:

1. Observation. One reed alone is a faint stroke. The five-reed bowl is where the interval shows up.
2. Observation. The tallest culm reaches into the top rail on Front, as other long cuttings do.
3. Evidence gap. No committed prune, bend, or cancel was filmed in the browser. Unit tests cover those laws.
4. Evidence gap. Physical phone: not run.

## Recommendation

Worth a look as the repeated-line candidate. It is one cutting, not a bundle, and it uses the existing aim, bend, and prune. Integrate only after someone decides the stroke is dark enough and the phone can acquire it. Smallest next pass: a physical-phone insert, aim, bend, prune, and cancel beside one flowering branch, without adding nodes, a sheaf, or a length control.

### What it enables

A bowl of separated verticals. Cut one shorter and the interval changes. Aim one and the lean changes. Bend one and that line becomes an arc without stretching the others.

### Remaining taste questions

- Is radius `0.024` a readable reed, or does it vanish against the water and the rail in real light?
- Is stiffness `0.56` the right hold, or should a fresh culm yield closer to the leafy stem?
- Do node rings belong in a later appearance pass, or would they turn the line back into a branched stick?
- The review seeds already differ by about 1.23 units. The study bowl then prunes two of five. Is that enough height before any cut?
