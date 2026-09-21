# Candidate review

- Candidate / role: Candidate A — bare woody line / independent reviewer (Agent C)
- Baseline SHA / head SHA / branch: `251a94a1b176fb5f32cdbabfaed009deb92c7f57` / `30d577d221354cbc26db422e6216e1587387034e` / `cursor/experiment-bare-branch-v1-2e72`
- Author / independent reviewer: Agent A implementation; Agent C review
- New compositional choice: A sparse woody line with a clear basal stem and a few forks, no leaves or flowers. Cutting the answering fork drops the spur and opens space. It is a different branching rhythm from `one-branch-v1`, not the flowering graph with organs hidden.
- Main weakness: At 320px the third tray card wraps in the existing two-column grid, silhouettes disappear, and cards become cramped. Physical-phone feel is unknown. In mixed bowls the darker wood can sit next to flowering trunks without a strong color break.

## Implementation

- Generator version / material ID: `bare-branch-v1` / `bare-branch`
- Topology and attachment decisions: Always five branches, zero organs. 16-segment trunk; answering lateral; counter lateral; distal twig; spur on the answering fork. Attachment fractions ~0.31 / 0.55 / 0.75. All five branches meet bend eligibility in tests. RNG consumed only at construction.
- Appearance changes: Additive cooler/drier bark in `materialAppearance.ts`. Unused leaf/bloom slots copied from flowering because the appearance record requires them. No `botanicalGeometry.ts` or `ThreeStudio.ts` edits.
- Response values and rationale: `BARE_RESPONSE` trunk 0.86, answering 0.66, counter 0.60, distal 0.50, spur 0.42, copied at generation. Shared solver. Stiffer than flowering trunk 0.72 by design.
- Shared files changed and why:
  - `generatorSupport.ts`: additive `directionFromParent` (unused by existing generators)
  - `materialResponse.ts`, `materialCatalog.ts`, `core/index.ts`: additive registration
  - `materialAppearance.ts`: additive look
  - `index.html`: one tray card
  - tests: additive coverage; garden fixture loop includes `bare-branch`
- Requested interface extensions (or none): none required for craft law. Integrator should own tray layout if a third card ships. Contract §1 still names only the two references until integration.

Protected files untouched: `src/input/`, Garden store, persistence schema, golden flowering/leafy fixtures, cameras, hit-priority, `one-branch-v1` generator.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass (Agent C, worktree at head) | 119 tests, 0 fail; typecheck; build; dist valid |
| Existing golden fixtures unchanged | pass | SHA-256 of `fixtures/plant-1-one-branch-v1.json` and `plant-2-leafy-shoot-v1.json` match baseline |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/bareBranch.test.ts`; fixture `fixtures/plant-1-bare-branch-v1.json` |
| Aim / bend preserve stock and attachments | pass (automated) | same test file |
| Exact prune and retained history | pass (automated) | answering cut at 0.08 deactivates `plant-1:spur`; 5 records remain |
| Cancel / invalid insert preserve ordinal and save | pass (automated) | `tests/app/materialInsertion.test.ts` |
| Reload after a committed edit | pass (automated) | restored spur remains inactive |
| Garden original survives edited copy | pass (automated) / not run (browser with this material) | `bareBranch.test.ts` keep-then-cut-copy |
| Front / ¾ / Above | pass (desktop Chrome, workbench 8278×1) | `reports/agent-c-round-1/A_count1_*.png` |
| Mixed reference scene | pass (desktop graph + render) | mixed 8278×6 and ×12; `A_mixed6_front.png`, `A_mixed12_front.png` |
| Narrow portrait / short landscape / large text | fail (320px tray crowding) / not run (large text, short landscape) | `A_tray_320.png`; silhouettes dropped; third card wraps |
| Physical phone | not run | no device |

## Rendering comparison

- Browser/device/OS/viewport/pixel ratio: Google Chrome, Linux, desktop ~1280×800 for workbench views; 320×640 device metrics for tray check; SwiftShader WebGL
- Same seed, count, camera: workbench flowering-equivalent is not pixel-matched in one capture; baseline mixed-6 was captured in the same Chrome session (`baseline_workbench_mixed6_front.png`)
- Report files for count 1 / mixed 6 / stress 12: Agent A graph JSON on the candidate branch; Agent C did not download WebGL reports for this head. Graph at seed 8278: count 1 = 5 branches / 0 organs; mixed 6 = flowering+leafy+bare twice; bare×12 = 60 / 0 vs flowering×12 = 180 / 120
- Resource-count differences (WebGL): not captured for this candidate head
- Observed response/stalls: mixed 12 loaded without a crash in desktop Chrome; no frame-time measurement
- Missing measurements: draw calls/triangles at matched viewport; phone; insert→aim→bend pointer path

## Independent findings

1. **Medium — 320px tray wrap drops silhouettes.**
   - Steps: open `?workbench=1&fresh=1` at 320×640. Inspect `.material-tray`.
   - Expected: three labeled cards remain independently reachable with usable hit targets and visible silhouettes.
   - Observed: two columns ~81px; third card wraps; SVG silhouettes not visible; Bare branch still labeled.
   - IDs: tray cards `material-flowering-branch`, `material-leafy-shoot`, `material-bare-branch`.
   - Scope: integrator tray layout, not the generator. Do not “fix” this by deleting the card or adding a second gesture engine.

2. **Low — mixed brown-on-brown.**
   - Steps: workbench mixed / 8278 / 6, Front.
   - Expected: a compositional difference, not a unique-color requirement.
   - Observed: bare forks are readable as leafless wood but sit next to flowering trunks. Not a correctness failure.
   - Scope: art direction if a later pass wants a cooler bark or a clearer basal span.

3. **Observation — mixed fixture identity shift.**
   - Workbench mixed now cycles three materials. Mixed-6 graphs are not comparable to the two-material baseline. Expected once a third catalog entry exists.

4. **Gap — no physical-phone or live pointer craft path.**
   - Automated aim/bend/prune exist. Desktop screenshots are fixture-loaded, not drag-shaped. Do not treat that as phone signoff.

## Recommendation

**Revise**, then consider integrate. The candidate is a real line: different topology, taper, stiffness, and zero organs. One useful answering-fork cut is defined and tested. Smallest next pass: tray layout (integrator), Front/¾/Above already captured here, then a phone clip of insert → bend → answering-fork cut → cancel → commit → reload beside both references. Do not add microtwigs or fake breakage.
