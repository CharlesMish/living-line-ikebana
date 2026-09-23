# Candidate review

- Candidate / role: Phase 2 Lane B — fine fern-like frond
- Baseline SHA / branch: `f666db8c1b9e46fc9daef05dba09a895844f8e86` (PR #39 materials combine). Bend-stations #36 and organ-roll experiments are not in this branch. Tip is the head of `cursor/fern-frond-v1-7a01`.
- Model: launched as Grok 4.7 with reasoning effort high requested. `originalModelName` from this run is `grok-4.7`. The run-info payload has no `thinking-budget` field and no `reasoning_effort` field.
- Self-verdict: **accept-candidate**. At ordinary Front scale it is a vertical feather of divided pinnae: finer than the leafy shoot's broad blades, and taller and flatter than the foliage fan's three-armed spread. One pinna, or the upper half of the rachis, is the prune, not each pinnule.

## Implementation

- Generator version / material ID: `fern-frond-v1` / `fern-frond`
- Frozen seeds: successful ordinals 1, 2, 3, 17, and 64 are seeds `8278`, `9255`, `10232`, `23910`, and `69829`. Golden `fixtures/plant-1-fern-frond-v1.json` is plant-1 at seed `8278`, base `(0, 0.55, 0)`.
- Topology: one `trunk` (`frond rachis`, 16 segments, radius `0.027`, length about `3.69..3.85` on the frozen seeds). Eight `petiole` pinna stalks, one leaf organ each. No laterals and no blooms. The first pinna stays past `0.95` on every frozen seed, so the base stays a grip. Randomness is consumed only at construction. Aim has no axial roll, so the feather's yaw stays inside ±0.25 radians and Front still sees the plane.
- Appearance: new `pinnate` surface in `botanicalGeometry.ts`. Each pinna is one mesh: a costa plus three pairs of separate pinnules. Elliptic and lanceolate blades are unchanged. Rachis `0x2c5c45`, roughness `0.72`. Pinna `0x7eae62`, costa vein `0xd2e6a0`, roughness `0.5`. Hit radius `0.78` centered at local Y `0.56`. The bloom slot copies flowering because the appearance record requires it; nothing generates a bloom.
- Response: `FERN_FROND_RESPONSE` is rachis `0.43`, stalk `0.18`, copied once. The rachis yields more than the foliage-fan stem (`0.47`) and holds more than the leafy ribbon (`0.39`). Pinna stalks are petioles, so the shared solver bends the rachis only. A loaded graph keeps a mutated stiffness; the profile is not reapplied.
- Named profile added: `references-plus-fern-frond` (flowering → leafy → fern-frond). `reference-pair`, `mixed`, `all-four`, `round3-three`, `round3-palette`, `round4-candidates`, and `round4-palette` are unchanged. `round4-palette` does not list this cutting.
- Shared files and why:
  - `src/core/fernFrond.ts` — new generator
  - `src/core/materialResponse.ts` — `FERN_FROND_RESPONSE`
  - `src/core/materialCatalog.ts` — registry plus a tray id appended after `nodding-flower`
  - `src/core/index.ts` — barrel export
  - `src/presentation/botanicalGeometry.ts` — `pinnate` pinna and costa
  - `src/presentation/materialAppearance.ts` — `fern-frond-v1` look
  - `src/app/workbenchProfiles.ts` — `references-plus-fern-frond` only
  - `index.html` — one Materials choice and one source template, after nodding flower
  - `docs/BEHAVIORAL_CONTRACT.md` — generator list names `fern-frond-v1`
  - `ARCHITECTURE.md`, `docs/MATERIAL_REFERENCES.md`, `docs/development/WORKBENCH_FIXTURE_PROFILES.md`
  - Focused tests, golden fixture, Garden study backup, capture script
- Requested interface extensions: the `pinnate` leaf form. No schema, persistence, solver, camera, or verb change. The integrator owns whether `references-plus-fern-frond` remains. Removing the catalog item leaves saved graphs loadable if the generator stays registered.

Contract: preserved. Existing generators, fixtures, seeds, insertion ordinals, and profile memberships stay. Aim, bend, and prune are the shared laws. A pinna cut at distance `0.06` deactivates that one blade and leaves the other records identical. A rachis cut midway between pinna 4 and pinna 5 deactivates pinnae 5–8 and leaves pinnae 1–4 identical. Records stay. Eight organs, not a pinnule swarm.

## Evidence

| Check | Result | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass — 218 tests, 0 failed | typecheck, Vite build, distribution valid (5 files; standalone self-contained) on this tip |
| Existing golden fixtures unchanged | pass | Flowering and leafy fixtures still match in `tests/core/fernFrond.test.ts` |
| Seeds 8278 / 9255 / 10232 / 23910 / 69829 | pass | Same test. Ordinals 17 and 64 are `23910` and `69829` |
| Aim / bend preserve stock | pass | Unit test at the five seeds. Headless Chrome aimed pinna 3, aimed the rachis, then bent the default bead at distance `2.025` |
| Exact prune and retained history | pass | Pinna cut and distal rachis cut in the unit test. Headless prune of pinna 2: Escape kept hash `2927113a`; release made `pinna-blade-2` inactive and left 8 organs and 9 branches |
| Cancel preserves hash | pass | Escape during an aim of pinna 6 kept hash `2927113a` |
| Reload after a committed edit | pass | Hash `30a5ab0b` matched after reload without `fresh=1`. The inactive blade stayed inactive. Ordinal stayed 1 |
| Garden Keep / View / Copy | pass | Kept title “Fern frond study”, viewed hash matched, copy hash matched, kept blade stayed inactive |
| Front / ¾ / Above | pass (headless Chrome) | `browser-fern-frond-seed8278-count1-*.png` and `study-*.png` |
| Several seeds on screen | pass | Front stills for seeds 8278, 9255, and 10232 |
| `references-plus-fern-frond` | pass | Count 6 is flowering, leafy, fern, flowering, leafy, fern. `round4-candidates` count 6 is still two of each Round 4 cutting and includes no fern |
| Narrow portrait / short landscape | pass with scroll / open list | 390×844 panel scrollHeight 495, clientHeight 286, fern choice in the DOM. 844×360 screenshot shows Fern frond in the open list; the panel box measurement returned 0, so no landscape scroll height is quoted |
| Physical phone | not run | Headless Chrome is not a phone signoff |

Study bowl `artifacts/fern-frond-garden.json`, title “A feather beside a leafy line and a fan”:

| Plant | Seed | Material | What it shows |
| --- | --- | --- | --- |
| plant-1 | 8278 | leafy-shoot-v1 | Taller leafy line |
| plant-2 | 9255 | foliage-fan-v1 | Shorter three-armed spread |
| plant-3 | 10232 | fern-frond-v1 | Whole feather |
| plant-4 | 11209 | fern-frond-v1 | Rachis cut between pinna 4 and 5; four basal blades active, four upper blades inactive |

## Rendering comparison

- Browser: Headless Chrome 148.0.7778.96 on Linux, SwiftShader (`--use-angle=swiftshader`). Not a physical phone.
- CSS viewport 1280×800. Drawing buffer 1280×800. Device pixel ratio 1. Browser window 1280×800.
- Same capture path for every count below: workbench load, Front, one forced view change, then three animation frames of wrapped `drawElements` / `drawArrays`. Mode 4 is counted as triangles.
- Report: `docs/development/reports/fern-frond-v1/browser-capture.json`.

| Scene | Draw calls | Triangles |
| --- | --- | --- |
| fern-frond ×1, seed 8278 | 91 | 16726 |
| leafy-shoot ×1, seed 8278 | 81 | 14034 |
| foliage-fan ×1, seed 8278 | 103 | 16134 |
| references-plus-fern-frond ×6, seed 8278 | 615 | 85054 |
| fern-frond ×12, seed 8278 | 1015 | 137902 |
| study bowl ×4 | 305 | 41138 |

One frond is 10 calls and 2692 triangles above one leafy shoot, and 12 calls below one foliage fan, under this capture. Twelve fronds are 1015 calls and 137902 triangles. These are resource counts, not phone frame time.

Frame schedule, same machine, 40 `requestAnimationFrame` deltas after the Front capture: median about 16.7 ms for one frond, one leafy shoot, one fan, the count-6 comparison, and the count-12 stress case. The minimum dipped to about 11.5–14.9 ms. That cadence is the headless display schedule on SwiftShader. It does not say how much of the frame the GPU used, and it is not a phone measurement.

## Silhouette checks that the tests lock

On the five frozen seeds, with organ geometry included:

- Frond height stays more than 0.6 above the fan and more than 0.6 below the leafy shoot.
- Fan width stays more than 0.15 above the frond. Seed 10232 is the close one (fan about 2.41, frond about 2.10).
- Frond depth stays under 0.55. Leafy depth exceeds it by more than 1. Leafy leaves spiral; the frond is one plane.
- The frond has no lateral arms. The fan has three.
- Leaf forms are `pinnate`, `lanceolate`, and `elliptic`.
- A y-band between pinnules contains only the costa. A y-band through a pinnule reaches past 0.25 in local X.

## Independent findings

None from a separate reviewer.

1. Phone: not run. The headless drag did perform the pinna prune, the bead bend, the cancel, the reload, and Garden Keep/View/Copy. That is not the phone card.
2. Twelve fronds cost more draw calls than one. Each pinna is still its own organ mesh; the pinnules share that mesh.
3. The acquisition sphere is larger than a single pinnule so the whole divided pinna stays pickable. Adjacent pinnae can have overlapping proxies. Arbitration still uses projected distance.

## Integrator notes

Append order is the live catalog only: `fern-frond` after `nodding-flower`. Do not add it to `round4-candidates` or `round4-palette` unless a later integration explicitly revises those profiles. `references-plus-fern-frond` is the comparison set for this candidate. The new surface name is `living-line/pinnate-pinna`, with `living-line/pinnate-costa` for the midrib.
