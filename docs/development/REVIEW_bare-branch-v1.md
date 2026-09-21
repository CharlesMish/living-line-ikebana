# Candidate review

- Candidate / role: Candidate A — bare woody line / Agent A
- Baseline SHA / head SHA / branch: `251a94a1b176fb5f32cdbabfaed009deb92c7f57` / (see PR head) / `cursor/experiment-bare-branch-v1-2e72`
- Author / independent reviewer: Agent A implementation; independent review is Agent C's job
- New compositional choice: A sparse woody line with a clear basal stem, one answering fork, a shorter counter, a restrained distal fork, and one short spur. Cutting the answering fork removes the spur and opens empty space beside the main line. There are no leaves or flowers to hide that decision.
- Main weakness: The tray now has three cards in a two-column grid, so the third card wraps. Phone feel, Front/¾/Above visual quality, and renderer draw-call counts were not captured in a browser or on a device in this pass.

## Implementation

- Generator version / material ID: `bare-branch-v1` / `bare-branch`
- Topology and attachment decisions: Always five branches and zero organs. Trunk is 16 segments (fixture seed 8278: length 5.548, first fork at 1.711). Answering lateral (8 segments), opposite counter (7), distal twig (6), and a short spur on the answering fork (5). Attachment fractions sit around 0.31 / 0.55 / 0.75, which is a different rhythm from `one-branch-v1` laterals at 2.15 / 3.62 / 4.78 on a 6.15 trunk. Stock tapers 0.078 → 0.044 → 0.036 → 0.028 → 0.020. Seeded handedness, lean, lengths and attachment jitter; RNG is consumed only at construction.
- Appearance changes: Cooler, drier bark (`trunk` 0x3c322c, roughness 0.94). Leaf/bloom slots are unused fallbacks copied from flowering because the appearance record requires them. No `botanicalGeometry.ts` change.
- Response values and rationale: `BARE_RESPONSE` trunk 0.86, answering 0.66, counter 0.60, distal 0.50, spur 0.42. Copied at generation into persisted `stiffness`. Shared solver. Higher trunk stiffness than flowering 0.72 means the same drag saturates sooner and travels less: the line stays woody instead of ribbon-like. Laterals remain usable. This is an authored cap, not elasticity or breakage.
- Shared files changed and why:
  - `src/core/generatorSupport.ts`: additive `directionFromParent` helper
  - `src/core/materialResponse.ts`: additive `BARE_RESPONSE`
  - `src/core/materialCatalog.ts`: additive generator/tray registration
  - `src/core/index.ts`: barrel export, same pattern as leafy
  - `src/presentation/materialAppearance.ts`: additive `bare-branch-v1` look
  - `index.html`: one tray card
  - `tests/presentation/botanical.test.ts`, `tests/app/garden.test.ts`, `tests/app/materialInsertion.test.ts`: additive coverage
  Existing `one-branch-v1` / leafy fixtures, generators, transactions, cameras, persistence and Garden schemas were not edited.
- Requested interface extensions (or none): None required. Integrator should list `bare-branch-v1` in behavioral-contract section 1 if this candidate is kept. Optional later: tray layout for three cards (`auto-fit`) if the wrap crowds a phone rail.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass on baseline; branch verify recorded separately | Baseline: 112 tests, 0 failures at `251a94a`. Branch log: `docs/development/reports/bare-branch-v1/` |
| Existing golden fixtures unchanged | pass | `fixtures/plant-1-one-branch-v1.json` and `fixtures/plant-2-leafy-shoot-v1.json` have empty diffs |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/bareBranch.test.ts`; fixture `fixtures/plant-1-bare-branch-v1.json` |
| Aim / bend preserve stock and attachments | pass | same test; rest lengths unchanged after aim/bend |
| Exact prune and retained history | pass | Answering-fork cut at 0.08 deactivates `plant-1:spur` and keeps five records |
| Cancel / invalid insert preserve ordinal and save | pass | `tests/app/materialInsertion.test.ts` |
| Reload after a committed edit | pass | same; restored spur remains inactive |
| Garden original survives edited copy | pass | `tests/core/bareBranch.test.ts` keep-then-cut-copy |
| Front / ¾ / Above | not run | No browser capture in the first automated pass |
| Mixed reference scene | pass (graph) / not run (visual) | Workbench mixed ×6 cycles flowering, leafy, bare. Graph totals in `graph-comparison.json` |
| Narrow portrait / short landscape / large text | not run | Tray wrap is a likely phone crowding risk |
| Physical phone | not run | No device |

## Rendering comparison

- Browser/device/OS/viewport/pixel ratio: not recorded
- Same seed, count, camera and render conditions for baseline/candidate: graph inventories compared at seeds 8278 / 9255 / 10232 and counts 1 / 6 / 12; renderer stats were not captured from WebGL
- Report files for count 1 / mixed 6 / stress 12: `docs/development/reports/bare-branch-v1/graph-comparison.json`
- Resource-count differences (seed 8278, graph inventory, not draw calls):
  - count 1: flowering 15 branches / 10 organs; leafy 8 / 7; bare 5 / 0
  - mixed 6: 56 branches / 34 organs (two of each material)
  - bare ×12: 60 branches / 0 organs vs flowering ×12: 180 / 120
- Observed response/stalls, if actually measured: not measured
- Missing measurements: workbench download with `renderer.calls` / triangles; Front/¾/Above screenshots; narrow-window clip; physical-phone acquisition

## Independent findings

None from this implementing agent. Agent C should treat the following as review prompts, not scored bugs:

- Three tray cards wrap in the existing two-column grid.
- Behavioral contract text still names only `one-branch-v1` and `leafy-shoot-v1`.
- Mixed workbench fixtures now cycle three materials, so mixed graph identity differs from the two-material baseline.

## Recommendation

Revise after a visual/phone pass, then consider integrate. The candidate is a real line, not a hidden-organ flowering clone: different attachment rhythm, taper, stiffness and zero organs. One useful cut of the answering fork reveals space. Smallest next pass: workbench screenshots at seed 8278 counts 1 and mixed 6, Front/¾/Above, plus a Keep → View → Copy → Change → Reload clip. Do not add microtwigs or fake breakage to imply wood.

### Bend feel vs flowering reference

Flowering trunk stiffness 0.72 permits more end-of-drag rotation (`maximumRotation = (0.28 + 0.28) * 1.2`). Bare trunk 0.86 yields `(0.28 + 0.14) * 1.2`. The same broad smootherstep profile is used, so the gesture still makes a long curve, but it saturates earlier and stays shallower. There are no leaves/blooms riding the line, so the silhouette change is the whole composition. Laterals at 0.66/0.60 are stiffer than flowering 0.52/0.50 and much stiffer than the leafy stem 0.39.

### What one useful cut reveals

Prune the answering fork just above its minimum (`~0.08`). The spur leaves with it. The primary line, counter and distal remain. The choice is “keep the answering voice or open the space beside the line,” not “thin a leaf cluster.”
