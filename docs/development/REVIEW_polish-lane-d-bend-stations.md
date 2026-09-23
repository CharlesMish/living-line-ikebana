# Polish lane D — bend stations on the twelve-material tip

Separate shaping study. This lane re-applies PR #36 onto current main. It stays out of the product-polish integration.

- Role: Lane D, opt-in bend-position study (`?experiment=bend-stations`)
- Port base: `2aef05424d751cda2137f3749b2d71e7fdf0c6d1` (merge of PR #45, twelve registered materials)
- Original study: PR #36, branch `cursor/bend-stations-220e`, tip `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7`
- Original behavior commit: `e7dea13c4037c022b45ffdcf67d6cdea778a4877` on baseline `59e42e6554b05ff2fc415514370430716e9e8515` (PR #33)
- Reapplied commits on this branch: `0603600` (behavior) and `48c58da` (original review SHA line)
- This lane's branch: `cursor/polish-lane-d-bend-stations-b600`
- Exact tip SHA: the pull-request head on `cursor/polish-lane-d-bend-stations-b600`. The verify-green content commit is recorded in the evidence table after it is created; the head that contains this file is the lane tip.
- Contract: preserved. Default acquisition stays the 54% bead. The flag does not revise the solver, gain, caps, stiffness, rest lengths, frame transport, transactions, persistence, `one-branch-v1`, or `?bend=touch`.
- Assessment: **limited**
- Physical phone: **not run**

## Model

- Run: [Polish Lane D: bend-stations on current main](https://cursor.com/agents/bc-d193a169-88bc-5b22-a285-b1642182b600)
- `originalModelName`: `grok-4.7`
- Owning user on the run record: charles mish
- The run record has no `reasoning_effort` field.
- Port analysis was launched as a read-only pass on `grok-4.7-high` (high reasoning), agent `bc-60ca2b93-4c26-52b8-8155-21c937b4025b`.
- Luna was not used.

## How PR #36 was preserved

`origin/cursor/bend-stations-220e` was not checked out and was not pushed. After the port it is still `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7`.

The two study commits were cherry-picked onto `2aef054`, in order:

1. `e7dea13` — opt-in stations, one bead, touch exclusion, telemetry skip, focused tests.
2. `2b3e490` — records that experiment commit in `docs/development/REVIEW_bend-stations.md`.

Git auto-merged the six files both sides had touched. The twelve-material tree kept:

- `shapeCue(..., graph)` at both call sites in `IkebanaApp`
- bell blooms and berry meshes in `ThreeStudio`
- all twelve `data-material-choice` tray ids
- `.cutting-berry`
- the twelve generator ids and organ kind `berry` in the behavioral contract

The study additions landed around those hunks: `src/app/bendStations.ts`, the `?experiment=bend-stations` flag, the craft-row selector, optional `beadStationDistance` (omitted still means the 54% bead), and the early return in `trackAcquisition` when `recordsFixedTouchStudy` is false.

`src/core/` is unchanged. There is no new solver, no saved control point, and no default-interaction change. `TELEMETRY_INSTRUMENT_VERSION` stays `"4"`.

`docs/development/REVIEW_bend-stations.md` remains the writeup of the original study against PR #33. This file is the twelve-material port.

## Study behavior on this tip

Confirmed in `tests/app/bendStations.test.ts`, `tests/app/bendStationsTwelveMaterials.test.ts`, and headless Chrome.

- Lower / Middle / Upper use fractions `0.32` / `0.54` / `0.76`, each passed through `bendStationAtFraction`.
- One pale bead. `ThreeStudio` still owns a single bend handle. Headless stills show that one bead moving when the station changes, on the fern rachis and the other seated specimens.
- Default off. A URL without the exact parameter `experiment=bend-stations` hides the selector. The seated leafy shoot kept `bendStations: "off"`.
- `bend=touch` forces mode `excluded`. The selector hides. The page shows “Bend stations stay off while touch bend is active.” The touch arm still records.
- While mode is `on`, acquisitions are not appended to either study bucket. A keyboard seat with the flag left bead `0` and touch `0`. The same seat without the flag appended one bead record. The excluded touch session appended one touch record. Instrument version stayed `4`.
- A station change during a live edit cancels with `experiment-command` before the preference moves. Repeating the effective station does not cancel.
- The preference is temporary. A different branch returns it to Middle.
- Fewer than two distinct clamped distances hides the selector. Exact aliases share one button. Petioles and pedicels produce no bead.

## Exercise matrix

Seed `8278` unless an arrangement plant names another seed. Measure: Lower `+0.45` then opposite Upper `-0.45`, signed local turning against the resting curve. `split` means the proximal and distal extremes have opposite signs and each exceeds 0.01 rad. Stock length, branch count, organ identity, and attachments were checked on every paired bend.

Primary stems, full stock:

| Class | Material / branch | Length | Stations | Separation | Result |
| --- | --- | --- | --- | --- | --- |
| Woody | flowering-branch `trunk` | 6.150 | 3 | 2.706 | split |
| Woody | bare-branch `trunk` | 5.548 | 3 | 2.441 | split |
| Leafy | leafy-shoot `stem` | 4.686 | 3 | 2.062 | split |
| Reed | reed `culm` | 4.671 | 3 | 2.055 | split |
| Trailer | arching-trailer `trail` | 3.016 | 3 | 1.327 | same-sign |
| Flower | single-flower `stem` | 5.308 | 3 | 2.336 | split |
| Flower | flower-volume `stem` | 4.481 | 3 | 1.972 | split |
| Flower | blossom-spray `stem` | 5.218 | 3 | 2.296 | split |
| Flower | nodding-flower `stem` | 2.353 | 3 | 1.035 | split |
| Frond | fern-frond `rachis` | 3.750 | 3 | 1.650 | split |
| Fan | foliage-fan `stem` | 2.620 | 3 | 1.153 | split |
| Berry | berry-twig `wood` | 4.696 | 3 | 2.066 | split |

Eligible laterals and twigs on these specimens also resolved three stations and split, including flowering-branch twigs down to length 1.200 and berry clusters near 0.74. The full row log is the `BEND_STATIONS_MATRIX` output of `tests/app/bendStationsTwelveMaterials.test.ts`.

Shortest legal trunk cut (distance `0.62`, the trunk minimum):

| Material | Stations after the cut | What the page would offer |
| --- | --- | --- |
| flowering-branch, bare-branch, single-flower, flower-volume, blossom-spray | 0, ineligible | Selector hidden. No bead. The guide returns to “Drag the pale point into a broad curve.” |
| leafy-shoot, reed, berry-twig | 3, same-sign | Lower, Middle, and Upper stay visible. One lobe of the paired bend is about 0.004–0.005 rad. |
| arching-trailer, nodding-flower, fern-frond, foliage-fan | 3, split | Three buttons still name two directions on this short remainder. |

Arrangement A and B are the plant graphs from PR #46 `artifacts/polish-baseline-arrangements.json` (branch `cursor/polish-baseline-evidence-8602`, tip `bca018057f6cf0be37d7a3bece63a0f20490dbaa`), thumbnails omitted, in `tests/fixtures/polish-baseline-arrangements.plants.json`. Eligible branches there match the single-plant results: Arrangement A rachis (`plant-2`, seed 9255) splits; Arrangement B nodding stem (`plant-4`, seed 11209) splits. The committed Arrangement A cut leaves `plant-2:pinna-blade-4` inactive. That pinna is a petiole, so it has no bead. A later middle bend of the rachis kept the inactive blade inactive and kept stock.

### Checks

| Check | Result |
| --- | --- |
| Station switch during an edit cancels first | Pass. Coordinator cases for bare branch, leafy, reed, trailer, single flower, and fern: live Lower-to-Upper sets `cancelFirst`, `interrupt("experiment-command")` restores points, ordinal stays. Headless Chrome: a bend acquired on `plant-2:rachis`, then Lower, left the transaction null, the station `lower`, and canonical hash `1918b562` unchanged. |
| Repeated shaping preserves stock and attached detail | Pass on every paired bend above, including arrangement graphs and a one-station shortened bend where a station remains. |
| Branch change resets the temporary preference | Pass. `preferenceAfterBranchChange` returns Middle across flowering-branch ids and from a woody root to a fern rachis. Headless: Upper on leafy `plant-1:stem`, then seating fern, selected `plant-2:rachis` at Middle. Ordinal 2. |
| Short stems and redundant choices | Mixed, and this is why the assessment is limited. Exact duplicate clamps hide. The shortest woody and several flower trunks become ineligible with no sentence that the bead is gone. Leafy, reed, and berry at `0.62` still show three names when the paired bend stays one sign. The guide still says to choose Lower, Middle, or Upper. |
| Telemetry separate from fixed-versus-touch | Pass. Mode `on` recorded 0/0 after a keyboard seat. Mode `off` recorded bead 1. Mode `excluded` recorded touch 1. Version stayed `4`. |

## Headless Chrome

Chrome 1400×900, SwiftShader, Vite on port 5173, `?test=1`. Stills under the run artifacts as `bend-stations-lane-d/`.

- Production leafy shoot: selector hidden, `bendStations` `off`, guide “Drag the pale point into a broad curve. The stem keeps its length.”
- Flag on, Middle then Upper, for leafy, bare branch, reed, trailer, single flower, fern, nodding flower, and berry twig: three buttons, one bead, Middle pressed after seating, Upper after the click, canonical hash unchanged until a bend is released.
- Fern Middle versus Upper: the single pale bead sits on the rachis and moves upward with the station.
- Touch exclusion on reed: selector hidden, exclusion sentence visible, touch guide, no bead.
- Second plant resets the station to Middle, as in the table.

Headless Chrome is not a phone observation.

## Assessment

**Limited.** On this twelve-material tip the existing solver, aimed from a second legal station, does add a two-direction curve on the long woody, leafy, reed, flower, frond, fan, and berry stems, and on their eligible side branches. The arching trailer keeps one sign; its authored arch deepens and the stations do not supply a reversal. That matches the original study.

The same three buttons are a weak control on shortened stock. A minimum trunk cut either removes the bead (woody trunks and several flowers) while the ordinary pale-point sentence remains, or keeps Lower / Middle / Upper when the broad influence has already collapsed the gesture into one sign (leafy, reed, berry). The study explains only exact distance aliases, by hiding the duplicate. It does not explain a practically ineffective remainder.

Crowded Arrangement A and B do not change that law. Neighboring plants do not add handles. Selecting another branch returns the temporary choice to Middle. The craft-row selector stayed one group in a two-plant headless scene.

Keep the flag opt-in. Leave this lane out of the product-polish integration. A later phone pass can ask whether the craft-row names are clearer than they are busy. A change that explained short or ineligible stems would be a new study, not a silent default.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| `npm ci` | pass | 63 packages, before verify |
| `npm run verify` | pass | typecheck, 247 tests, 0 failures, production build, dist validation (5 files, standalone self-contained). Baseline at `2aef054` was 229 tests; this port adds the 11 study tests and 7 twelve-material exercise tests. |
| Original #36 branch | untouched | `origin/cursor/bend-stations-220e` remains `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7` |
| Golden `one-branch-v1` / solver files | unchanged | `src/core/` has no diff against `2aef054` |
| Physical phone | not run | No device. Desktop headless Chrome cannot stand in for acquisition feel, Safari cancellation, or whether the selector crowds a real stem. |
