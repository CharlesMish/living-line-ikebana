# Candidate review

- Candidate / role: Lane B — concentrated flower volume / Round 3
- Baseline SHA / head SHA / branch: `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37` / PR #25 head / `cursor/flower-volume-v1-f9f1`
- Author / independent reviewer: Lane B. Requested model was Grok 4.7 high thinking. The runtime identified itself as Grok 4.7. Independent review has not been run.
- New compositional choice: One supporting stem carrying five flower-bearing side groups packed into a single head. Each group is a real pedicel and one tufted bloom. Cutting a group with the existing prune opens that part of the mass and leaves the other groups, leaves, and stem detail unchanged.
- Main weakness: The five tufts stay readable as lobes, so the head is a tight cluster rather than a seamless solid. Centers are about 0.30 units apart at the review seeds, which is pickable in this desktop capture and may be tight on a phone. The player Materials menu does not list the candidate yet. Physical phone: not run.

This change preserves the behavioral contract. It adds a versioned generator. It does not change transactions, cameras, persistence, insertion ordinals, `one-branch-v1`, or the flowering and leafy goldens.

## Implementation

- Generator version / material ID: `flower-volume-v1` / `flower-volume`
- Topology and attachment decisions: One 14-segment stem (seed 8278 length about 4.48, radius 0.041). Two elliptic leaves on petioles below the crown. Five pedicels labeled flower group, all attached above 90% of the stem. Group 1 is the short upright crown; groups 2–5 ring it. Each pedicel carries one bloom at its tip. Records: 8 branches, 7 organs. Pruning a pedicel at the bloom distance truncates that pedicel and deactivates that bloom. The other branch points stay identical. A stem cut at 70% of length removes all five groups and keeps both leaves. Inactive records remain.
- Appearance changes: Additive `tufted` bloom form — eight shorter, more cupped petals than the flowering cup or the single-flower open face. Dusty rose `0xc45d7a`, darker green stem `0x3f5a40`. Petals of one bloom are one instanced mesh. The organ group, hit proxy, organ id, and supporting branch id stay per bloom. Cupped and open-face paths keep their previous petal counts and center/anther measurements.
- Response values and rationale: Stem stiffness `0.55` (between the single-flower stem `0.46` and the flowering trunk `0.72`) because the stem carries a head. Groups `0.2`. Leaf stalks `0.18`, matching the other stalk values. Copied once at generation. Shared solver only. Pedicels are not bend-handle targets; aiming or bending the stem moves the head.
- Shared files changed and why:
  - `src/core/flowerVolume.ts`, `materialResponse.ts`, `materialCatalog.ts`, `index.ts` — additive generator and provisional catalog entry at the end of the existing order
  - `materialAppearance.ts`, `botanicalGeometry.ts`, `ThreeStudio.ts` — tufted surfaces; non-tufted blooms still use separate petal meshes
  - Focused tests, `fixtures/plant-1-flower-volume-v1.json`, this review, `docs/development/reports/flower-volume-v1/`
  - `docs/MATERIAL_REFERENCES.md` — provisional candidate note
  - Tests that named the live catalog order or the dynamic `all-registered-materials` cycle, because that profile is defined as the live catalog
- Not changed: `reference-pair`, `all-four`, tray HTML, transaction/camera/persistence schemas, flowering/leafy/`one-branch-v1` goldens
- Requested interface extensions (or none): None for craft law. Integrator wiring: add the Materials choice if this candidate is kept, and list `flower-volume-v1` in behavioral-contract section 1. Do not add it to `reference-pair` or `all-four`. No new prune verb.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass | Typecheck, 149 tests, production build, distribution check. Baseline SHA `cf1cf73`. |
| Existing golden fixtures unchanged | pass | `fixtures/plant-1-one-branch-v1.json` and `fixtures/plant-2-leafy-shoot-v1.json` have empty diffs. `tests/core/flowerVolume.test.ts` also checks both generators. |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/flowerVolume.test.ts`. Neighbor gaps stay about 0.30–0.31; head span about 0.54–0.57. Fixture `fixtures/plant-1-flower-volume-v1.json`. |
| Aim / bend preserve stock and attachments | pass | Stem bend test keeps rest lengths, spins, and scales. Pedicels are not bend targets. |
| Exact prune and retained history | pass | Unit test plus browser. Front canonical view, seed 8278, plant-1. Held prune on `plant-1:group-2` ghosts `plant-1:bloom-2`. Commit changes only that pedicel’s active length (0.324 → 0.299) and sets bloom-2 inactive. Branch count stays 8 and organ count stays 7. |
| Cancel / invalid insert preserve ordinal and save | pass | Unit test: cancelled insertion leaves ordinal 0 and writes no save. Browser: Escape during the held preview restores canonical hash `5c6ba5af` and all five blooms. |
| Reload after a committed edit | pass | Workbench reload without `fresh=1` restored canonical hash `03620378` with bloom-2 inactive and the other blooms active. |
| Garden original survives edited copy | pass (backup kept) | Workbench Garden entry “flower volume group-2 pruned” in `docs/development/reports/flower-volume-v1/garden-backup.json`. Copy-and-edit isolation is covered by existing Garden tests; this capture did not open a second working copy. |
| Front / ¾ / Above | pass | `count1-front-intact.png`, `count1-three-quarter-intact.png`, `count1-above-intact.png`. Above is a plan of the head, not a camera-facing card. |
| Stable `reference-pair` scene | pass | Browser load of `reference-pair` count 6, seed 8278: only `one-branch-v1` and `leafy-shoot-v1`. Screenshot `reference-pair-6-front.png`. `all-four` sequence is unchanged in `tests/app/workbenchProfiles.test.ts`. |
| Narrow portrait / short landscape / large text | pass / not the short-landscape pair / not run | 390×844 and 320×640 portraits below. Large text not run. Short landscape not run. |
| Physical phone | not run | |

Browser prune sequence, same specimen and canonical Front camera (camera hash `f3827392` before and after the commit):

- Intact: `count1-front-intact.png`
- Held preview: `count1-front-prune-preview.png`
- Escape cancel: `count1-front-prune-cancelled.png`
- Committed prune: `count1-front-pruned.png`

## Rendering comparison

- Browser/device/OS: Google Chrome headless on Linux, SwiftShader. Not a physical phone.
- CSS viewport (canvas): 1280×800. Browser-window inner size: 1280×800. Drawing-buffer size: 1280×800. Device pixel ratio 1. Renderer pixel ratio 1. These matched in this capture; they are still separate measurements.
- Same seed, count, camera and render conditions for intact/pruned: workbench `flower-volume`, seed 8278, count 1, canonical Front, camera hash `f3827392`.
- Report files:
  - count 1: `docs/development/reports/flower-volume-v1/capture-report.json` — 8 branch ids, 7 organ ids
  - stable `reference-pair` 6: same report — 69 branch ids, 51 organ ids, generators only `one-branch-v1` and `leafy-shoot-v1`. Screenshot `reference-pair-6-front.png`
  - stress 12: 12 plants, 96 branch ids, 84 organ ids, every plant `flower-volume-v1`. Screenshot `count12-front.png`
- Resource-count differences: one flower-volume plant is 8 branches and 7 organs. Twelve copies are 96 and 84. Draw calls and triangles were not exposed by the test bridge and were not measured.
- Observed response/stalls, if actually measured: none measured
- Missing measurements: GPU timings, draw calls, triangles, physical-phone acquisition, large-text zoom, short landscape

## Narrow layout

Player tray HTML was not changed. The Materials list remains flowering branch, leafy shoot, bare branch, and single flower. `flower-volume` is available as a workbench fixture because the provisional catalog registration is live; it is not a picker row.

| Window | CSS canvas | Inner window | Drawing buffer | Device / renderer pixel ratio | `.top-chrome` size |
| --- | --- | --- | --- | --- | --- |
| Desktop | 1280×800 | 1280×800 | 1280×800 | 1 / 1 | 832×119 |
| 390×844 | 390×844 | 390×844 | 390×844 | 1 / 1 | 374×180 |
| 320×640 | 320×640 | 320×640 | 320×640 | 1 / 1 | 304×191 |

At 390 and 320 the existing top row wraps. Opening Materials did not add a fifth card and did not change the measured rail height. The head stayed in frame in both portraits (`narrow-390-front.png`, `narrow-320-front.png`, `narrow-320-materials.png`). This is the current four-choice rail, not a new row from this candidate.

## Independent findings

None from an independent reviewer. Implementation notes:

1. Severity: observation. Five lobes remain distinguishable. That is the picking grain. A smoother mop would need larger overlap and would make the groups harder to choose.
2. Severity: integration gap. The player cannot select this cutting from Materials until the tray is wired.
3. Severity: observation. Shape on a bloom aims that pedicel, which can turn one group. Bending the stem moves the whole head. No new verb was added.
4. Severity: evidence gap. No physical phone. Desktop dpr was 1.

## Recommendation

Integrate if a cuttable flower head is the missing role. Keep it out of `reference-pair` and `all-four`. Smallest useful next pass: wire the Materials choice, then a physical-phone insert and prune of one group beside the flowering and leafy references. Do not add floret-level tools or a single decorative mesh.
