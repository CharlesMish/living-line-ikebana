# Candidate review

- Candidate / role: Candidate A — bare woody line / Agent A
- Baseline SHA / head SHA / branch: `251a94a1b176fb5f32cdbabfaed009deb92c7f57` / (PR head; see last commit on `cursor/experiment-bare-branch-v1-2e72`) / `cursor/experiment-bare-branch-v1-2e72`
- Author / independent reviewer: Agent A implementation; independent review is Agent C's job
- New compositional choice: A sparse woody line with a clear basal stem, one answering fork, a shorter counter, a restrained distal fork, and one short spur. Cutting the answering fork removes the spur and opens empty space beside the main line. There are no leaves or flowers to hide that decision.
- Main weakness: The third tray card wraps in the existing two-column grid. At 360px the chrome is tall. Physical-phone feel was not measured. WebGL stats exist only for bare ×12 in a 360×924 device-mode viewport, not a matched desktop comparison against flowering/leafy.

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
| npm ci + npm run verify | pass | Baseline: 112 tests at `251a94a`. Branch: 119 tests. `docs/development/reports/bare-branch-v1/baseline-verify.md`, `branch-verify.md` |
| Existing golden fixtures unchanged | pass | `fixtures/plant-1-one-branch-v1.json` and `fixtures/plant-2-leafy-shoot-v1.json` have empty diffs |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/bareBranch.test.ts`; fixture `fixtures/plant-1-bare-branch-v1.json` |
| Aim / bend preserve stock and attachments | pass (unit) / observed (desktop Chrome) | Unit rest lengths unchanged. Desktop: trunk aimed then bent; status “Set.” `bare_8278_after_aim_bend.webp` |
| Exact prune and retained history | pass (unit) / observed (desktop Chrome) | Unit: answering cut at 0.08 deactivates spur, keeps five records. Desktop: committed cut of the lower fork. `bare_8278_after_answering_cut.webp` |
| Cancel / invalid insert preserve ordinal and save | pass | `tests/app/materialInsertion.test.ts` |
| Reload after a committed edit | pass | same; restored spur remains inactive |
| Garden original survives edited copy | pass (unit) / observed (desktop Chrome) | Unit keep-then-cut-copy. Desktop: Keep “Bare line study”, view in Step Back / Orbit. `garden_view_kept_bare_line_study.webp` |
| Front / ¾ / Above | pass (desktop Chrome) | `bare_8278_front.webp`, `bare_8278_three_quarter.webp`, `bare_8278_above.webp` |
| Mixed reference scene | pass (graph + desktop Chrome) | Mixed ×6 Front/¾. Darker woody lines remain readable beside flowers and leaves. `mixed_8278_x6_front.webp` |
| Narrow portrait / short landscape / large text | pass (360px portrait only) | Three cards remain labeled and tappable; chrome is tall and covers the crown. `tray_360px_portrait.webp`. Short landscape and large text not captured |
| Physical phone | not run | No device. Desktop Chrome and 360px device-mode are not a phone signoff |

## Rendering comparison

- Browser/device/OS/viewport/pixel ratio: desktop Chrome on the cloud agent VM; one capture in DevTools device mode 360×924, DPR 1
- Same seed, count, camera and render conditions for baseline/candidate: graph inventories compared at seeds 8278 / 9255 / 10232 and counts 1 / 6 / 12. WebGL stats were **not** captured for flowering/leafy under the same viewport as the candidate
- Report files:
  - Graph inventories: `docs/development/reports/bare-branch-v1/graph-comparison.json`
  - Workbench download, bare ×12 seed 8278: `workbench-bare-8278-x12.json` and `workbench-bare-8278-x12-summary.json`
- Resource-count differences (seed 8278, graph inventory):
  - count 1: flowering 15 branches / 10 organs; leafy 8 / 7; bare 5 / 0
  - mixed 6: 56 branches / 34 organs (two of each material)
  - bare ×12: 60 branches / 0 organs vs flowering ×12: 180 / 120
- One WebGL sample (bare ×12, 360×924 device mode, drawingBuffer 649×1663): 187 calls, 32882 triangles, 136 geometries, 60 branch visuals, 0 organ visuals
- Observed response/stalls, if actually measured: not measured
- Missing measurements: matched-viewport flowering/leafy/mixed draw-call reports; short landscape; physical-phone acquisition; video model review of the long walkthrough clip (file larger than the 15MB review cap)

## Independent findings

None from this implementing agent that should block graph correctness. Agent C should treat the following as review prompts, not scored bugs:

- Three tray cards wrap in the existing two-column grid (`tray_three_cards_desktop.webp`).
- At 360px the wrapped tray plus Shape/Prune chrome is tall and covers the plant crown.
- Behavioral contract text still names only `one-branch-v1` and `leafy-shoot-v1`.
- Mixed workbench fixtures now cycle three materials, so mixed graph identity differs from the two-material baseline.
- Mixed ×6 on the default spiral is spatially crowded; the bare line still reads, but spacing is a workbench placement property, not a generator claim.

## Recommendation

Consider integrate after Agent C’s independent pass. The candidate is a real line, not a hidden-organ flowering clone: different attachment rhythm, taper, stiffness and zero organs. Desktop Chrome shows a readable primary line, useful forks, and a cut that opens space. Do not treat this as a physical-phone signoff. Smallest next pass: tray layout for three cards, and a matched workbench report of flowering/leafy/bare at the same desktop viewport. Do not add microtwigs or fake breakage to imply wood.

### Bend feel vs flowering reference

Flowering trunk stiffness 0.72 permits more end-of-drag rotation (`maximumRotation = (0.28 + 0.28) * 1.2`). Bare trunk 0.86 yields `(0.28 + 0.14) * 1.2`. The same broad smootherstep profile is used, so the gesture still makes a long curve, but it saturates earlier and stays shallower. There are no leaves/blooms riding the line, so the silhouette change is the whole composition. Laterals at 0.66/0.60 are stiffer than flowering 0.52/0.50 and much stiffer than the leafy stem 0.39. Desktop observation: the trunk took a clear lean from aim and a shallower mid-span curve from bend; this is not a phone-feel measurement.

### What one useful cut reveals

Prune the answering fork just above its minimum (`~0.08`). The spur leaves with it. The primary line, counter and distal remain. The choice is “keep the answering voice or open the space beside the line,” not “thin a leaf cluster.” Desktop: after the committed cut the lower fork is a short stub and the space to the right of the trunk is empty.
