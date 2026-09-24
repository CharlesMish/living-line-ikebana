# Round 4 independent review

This reviewer did not author lanes A, B, or C, the materials combine, or bend-stations. The two tips were checked out and verified separately. They were not merged. No product code was changed.

## Reviewer

Requested model: Grok 4.7 with high thinking. Exposed run identity: `originalModelName` `grok-4.7` on https://cursor.com/agents/bc-d5432c82-b0f2-565c-9a8f-869c92971bda. This agent is Grok 4.7. No thinking-budget or `reasoning_effort` field was exposed on the run record or in the agent interface, so a high thinking budget cannot be confirmed from the session. Luna was not substituted.

## Verdicts

| Candidate | Grade | Recommendation | Reason |
| --- | --- | --- | --- |
| Materials combine, PR #39 | **Pass-with-notes** | Accept A, B, and C | The tip is the three frozen parents plus a catalog freeze. `npm run verify` on the exact tip passed 209 tests. The substitution, arm-cut, and lateral-cut claims hold in the tests that actually run. Phone and a fresh combined browser shoot are still missing. |
| Bend-stations, PR #36 | Opt-in only | Retain as a study. Defer making it the default. | Production without the flag still uses the 0.54 bead. Touch, interrupt-before-switch, save schema, and study recording match the brief. No phone comparison of clarity versus stem crowding exists. |

No bounded product correction follows from this pass.

## Materials tip actually verified

Checked out and left at `f666db8c1b9e46fc9daef05dba09a895844f8e86` (`cursor/round4-materials-combined-5bd7`, draft PR #39). `git rev-parse HEAD` matched that SHA before `npm ci`.

`npm ci && npm run verify` on that SHA:

- Typecheck passed.
- Tests: **209 passed, 0 failed, 0 skipped, 0 todo**.
- Build wrote `dist/ikebana-web-alpha-standalone.html`.
- Vite: `dist/index.html` 36234 bytes, `dist/assets/index-DL8pkvE1.css` 19914 bytes, `dist/assets/index-BBjM0HHm.js` 689275 bytes, `dist/assets/index-BBjM0HHm.js.map` 3403366 bytes.
- `validate-dist`: 5 files, standalone self-contained, standalone 884938 bytes.

The combine note records the same 209 and the same byte sizes for the catalog combine `7ba876ec2e9f6a5cea14422d986de3ab5e3cabcc`. This review executed the child tip, not that parent. The only difference is `docs/development/REVIEW_round4-combined.md` (120 lines). The matching bundle bytes are consistent with that note leaving the app unchanged. The ancestry and profile claims below were re-checked in git and in source, not copied from the note.

### Parents

`git merge-base --is-ancestor` is true for:

| Role | SHA |
| --- | --- |
| Lane A, PR #35, foliage-fan | `3f16583f01a0a3ed93d6b365bd3c357de88fcfb5` |
| Lane B, PR #38, blossom-spray | `7cf593c18459130e40824d4653fef84a5bef99eb` |
| Lane C, PR #37, nodding-flower | `62e2c5e76e0347a37ab4d5a6a00bc7f366db79e4` |
| Runtime baseline, PR #33 | `59e42e6554b05ff2fc415514370430716e9e8515` |
| Docs main, PR #34 | `c002c8fe9c6b2372aa1ad59310379a47ec87b079` |

Merge parents, read from the commits:

- `53566b6` merges `c002c8f` with Lane A `3f16583`.
- `5bb991c` merges `53566b6` with Lane B `7cf593c`.
- `7ba876e` merges `5bb991c` with Lane C `62e2c5e`.
- `f666db8` has the single parent `7ba876e`.

`src/core/foliageFan.ts`, `blossomSpray.ts`, and `noddingFlower.ts`, their three golden fixtures, and the focused lane tests are byte-identical to those parent tips.

Bend-stations `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7` is absent from this history. `git merge-base --is-ancestor` is false. The merge-base of the two tips is the runtime baseline `59e42e6`. `src/app/bendStations.ts` is not in the materials tree.

### Catalog

`getMaterialDefinitions()` on this tip is exactly ten entries, in this order:

`flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower`, `reed`, `flower-volume`, `arching-trailer`, `foliage-fan`, `blossom-spray`, `nodding-flower`.

The Materials list and source templates in `index.html` follow that order. There is no eighth speculative material and no disabled phantom profile. `tests/app/workbenchProfiles.test.ts` asserts every listed option is available, and that `mixed` is not its own menu row.

Contract section 1 names those ten generators. `schemaVersion` stays 1. The diff of `docs/BEHAVIORAL_CONTRACT.md` against the runtime baseline is that one sentence. Aim, bend, prune, transaction, and persistence sources are unchanged against `59e42e6`.

### Frozen profiles

Unchanged against the runtime baseline, and still in this order: `reference-pair`, `references-plus-bare`, `references-plus-single-flower`, `all-four`, `references-plus-reed`, `references-plus-flower-volume`, `references-plus-arching-trailer`, `round3-three`, `round3-palette`. `mixed` still resolves to `reference-pair`.

Ordered IDs, from `WORKBENCH_FIXTURE_PROFILES` and the profile test:

| ID | Ordered material IDs |
| --- | --- |
| `reference-pair` | `flowering-branch`, `leafy-shoot` |
| `mixed` | alias of `reference-pair` |
| `references-plus-bare` | `flowering-branch`, `leafy-shoot`, `bare-branch` |
| `references-plus-single-flower` | `flowering-branch`, `leafy-shoot`, `single-flower` |
| `all-four` | `flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower` |
| `references-plus-reed` | `flowering-branch`, `leafy-shoot`, `reed` |
| `references-plus-flower-volume` | `flowering-branch`, `leafy-shoot`, `flower-volume` |
| `references-plus-arching-trailer` | `flowering-branch`, `leafy-shoot`, `arching-trailer` |
| `round3-three` | `reed`, `flower-volume`, `arching-trailer` |
| `round3-palette` | `flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower`, `reed`, `flower-volume`, `arching-trailer` |
| `references-plus-foliage-fan` | `flowering-branch`, `leafy-shoot`, `foliage-fan` |
| `references-plus-blossom-spray` | `flowering-branch`, `leafy-shoot`, `blossom-spray` |
| `blossom-compare` | `flowering-branch`, `flower-volume`, `blossom-spray` |
| `references-plus-nodding-flower` | `flowering-branch`, `leafy-shoot`, `nodding-flower` |
| `round4-candidates` | `foliage-fan`, `blossom-spray`, `nodding-flower` |
| `round4-palette` | the seven established IDs, then `foliage-fan`, `blossom-spray`, `nodding-flower` |
| `all-registered-materials` | live catalog; still last; still the only dynamic profile |

`round4-candidates` × 6 is two of each. `round4-palette` × 6 is the first six established materials and omits `arching-trailer`, `foliage-fan`, `blossom-spray`, and `nodding-flower`. × 12 is two flowering, two leafy, and one of each of the other eight. Those counts are asserted in `tests/app/workbenchProfiles.test.ts`. The omission at count 6 is the same cycle rule as `round3-palette`. It is specified behavior.

### Established goldens

Blob IDs of the seven established fixtures match `59e42e6` exactly:

| Fixture | Blob |
| --- | --- |
| `fixtures/plant-1-one-branch-v1.json` | `d701ac6256ffb0c78d17deee378b000dc21f2edd` |
| `fixtures/plant-2-leafy-shoot-v1.json` | `363993c90f3a40f23531e3e00e858dcb81524a41` |
| `fixtures/plant-1-bare-branch-v1.json` | `1d51ba32b226b013392b25761d881fd6f9e48a96` |
| `fixtures/plant-1-single-flower-v1.json` | `c550d7963bbd3797614ef0fd8fcd1b828b788c7f` |
| `fixtures/plant-1-reed-v1.json` | `bc47178f7333736e36e39561b2a4d001b3c9325e` |
| `fixtures/plant-1-flower-volume-v1.json` | `937ecf696c5bc47601394806c67cdfee077cca46` |
| `fixtures/plant-1-arching-trailer-v1.json` | `251469d1d72618c03f4337c58a2240c376cfb0df` |

The only fixture additions since the baseline are `plant-1-foliage-fan-v1.json`, `plant-1-blossom-spray-v1.json`, and `plant-1-nodding-flower-v1.json`.

### Spot checks

Foliage-fan arm cut. `tests/core/foliageFan.test.ts` cuts `plant-1:arm-opening` at the opening distance, keeps answering and crown branches and organs identical, deactivates that arm's three leaves, retains branch and organ counts, and requires the bounds to narrow by more than 0.7. The study plant at seed 10232 repeats that gap. This is a graph cut. The lane note that a headless drag acquired `petiole-opening-1` instead is an interaction observation, and this review did not repeat that drag.

Blossom lateral cut. `tests/core/blossomSpray.test.ts` at seed 8278: a cut on `plant-1:stalk-2-1` deactivates only `plant-1:bloom-2-1`; a cut at distance 1.2 on `plant-1:group-2` removes only the distal stalk; a cut at 0.12 removes both stalks and both blooms of that group and leaves groups 1 and 3 in place. Seeds 9255 and 10232 get the same stalk-versus-lateral split. `tests/presentation/blossomSprayPicking.test.ts` raycasts each bloom at a 390×844 front camera, including the instanced tuft, and checks that a group cut hides those two organs without allocating a new petal mesh. That camera size is a desktop projection. It is not a phone.

Nodding flower versus single flower. `tests/core/noddingFlower.test.ts` aims the single-flower pedicel across a sphere of directions, aims the stem downward, and applies four saturated stem bends. The open-face mouth stays perpendicular to its stalk (`dot` under `1e-5`). Pedicel turning stays at the rest value. The search includes at least one stalk with tangent Y below −0.45. `docs/development/reports/nodding-flower-v1/substitution-metrics.json` records the hung single flower at tangent Y −0.508 with alignment about 0 and stalk turn 0.047, against a nodding neck turn of 1.783 and tangent Y −0.592. `createBellGeometry` builds one shell along local +Y. `ThreeStudio` maps the organ's supporting tangent to that axis. `bloomSurfaceProfile("bell")` and `createBloomPetalGeometry(..., "bell")` throw, so a bell cannot fall through into the petal ring. Cupped, open-face, and tufted petal functions are unchanged against the baseline; the geometry diff adds the bell type, the throw, and `createBellGeometry`. That is enough to keep Lane C in the catalog. Aim and bend can hang the existing single flower, and they leave its stalk nearly straight with the mouth across the stalk.

PR #33 acquisition. `tests/core/aim.test.ts`, `tests/presentation/organPicking.test.ts`, and `src/core/edit.ts` are unchanged against `59e42e6`. The short-stalk aim tests are in that unchanged file and ran inside the 209. The combined suite also passed, by name: "a visible small leaf wins over the stem behind it", "an exposed flower-volume tuft selects its own group independent of intersection order", "visible organ hits retain selected-plant priority and the enlarged near-miss envelope", and "a real foreground stem wins over a leaf behind it even off the stem centerline". The acquisition census now includes the three new materials and passed.

### Materials findings

| Finding | Class | Effect on the grade |
| --- | --- | --- |
| Physical phone was not run. Both the combine note and the three parent reviews say so. This review also had no device. | Missing evidence | Note. Disclosed, so it does not fail the candidate. |
| This review did not re-shoot Front, three-quarter, Above, or the narrow Materials menu. Parent stills stay applicable: A/B generators match their tips, existing petal functions are untouched, and the nodding renderer matches Lane C. | Missing evidence | Note. |
| A headless foliage drag in the parent review acquired a leaf stalk instead of the opening arm. The arm cut itself is covered by the unit test. | Missing evidence | Note. The graph operation is present. A phone pass can still try the arm base. |
| `round4-palette` at count 6 hides the new cuttings. | Taste, already specified | No change. The test and the combine note both say so. |

No correctness failure.

Per cutting: accept foliage-fan, accept blossom-spray, accept nodding-flower. Lane C stays a catalog entry because the substitution test shows a hung single flower whose mouth stays perpendicular to a nearly straight stalk, while the bell continues an authored neck.

## Bend-stations tip actually verified

Checked out `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7` (`cursor/bend-stations-220e`, draft PR #36). `git rev-parse HEAD` matched that SHA.

`npm ci && npm run verify` on that SHA:

- Typecheck passed.
- Tests: **193 passed, 0 failed, 0 skipped, 0 todo**.
- `validate-dist`: 5 files, standalone self-contained, standalone 870499 bytes.

The parent experiment commit is `e7dea13c4037c022b45ffdcf67d6cdea778a4877`. The tip adds two lines to `docs/development/REVIEW_bend-stations.md` that name that commit. The lane note's 193 was recorded on `e7dea13`. This review re-ran the tip and got 193 again.

`src/core/` has an empty diff against `59e42e6`. `bendStationAtFraction` still defaults to `0.54`. `src/app/persistence.ts`, `telemetry.ts`, and `metrics.ts` are unchanged, so there is no save-field migration and `instrumentVersion` is untouched.

Production default. `readExperimentConfig` without the flag sets `bendStationsMode` to `"off"`. `#bend-stations` and `#bend-stations-exclusion` are hidden in `index.html`. With the mode off, the app passes `beadStationDistance: undefined`, and `ThreeStudio` resolves that omission with `bendStationAtFraction(branch, 0.54)`. `tests/presentation/bendStationBead.test.ts` covers that omitted path. Touch still hides the bead.

Touch exclusion. `?experiment=bend-stations&bend=touch` resolves to mode `"excluded"`. `set-bend-variant` interrupts while recording is still suppressed, then clears the station choices, then calls `commandBendVariant`. `resetForTest` recomputes the mode from the remembered request and the requested variant, and sets the exclusion status when the result is `"excluded"`.

Interrupt before a station switch. `planBendStationChange` sets `cancelFirst` when the mode is on, a transaction is active, and the clamped distance actually changes. Repeating the current station does not cancel. `IkebanaApp` calls `interruptActive("experiment-command")` before it writes `bendStationPreference`. The prune-then-switch test commits one prune, cancels the following live bend, and checks that the second event is a cancel with no second save.

Study recording. `recordsFixedTouchStudy("on")` is false. `trackAcquisition` returns before `recordAcquisition` and before `telemetryStore.append`, so a live bend-stations session does not write a fixed-bead or touch observation and does not clear old study data. Mode `"excluded"` still records, which keeps the touch arm when the flag was requested and touch won.

Garden view clears the selected branch, which drops the temporary station. Replacing the bowl does the same. Returning to the working bowl restores the branch through `assignSelectedBranch`, and the cleared selection makes that a branch change, so the preference returns to Middle. The choice stays out of the arrangement snapshot.

`git merge-tree` of this tip with current main (`c002c8f`) reports no conflict. The two candidate branches still edit overlapping presentation files, which is why they stay separate.

### Bend-stations findings

| Finding | Class | Effect |
| --- | --- | --- |
| Physical phone was not run. The lane note says so. This review had no device, so clarity versus crowding the stem is unmeasured. The craft-row placement is a layout fact, not a phone observation. | Missing evidence | Defer the default. |
| Headless Chrome stills in the lane note were not re-shot here. | Missing evidence | The automated station, cancel, and exclusion tests were re-run. |

No correctness failure in the opt-in path.

## Recommendation

Accept the materials combine as the Round 4 catalog: foliage-fan, blossom-spray, and nodding-flower, in that order, with the profiles listed above. Leave PR #39 a draft until the owner wants it.

Keep bend-stations opt-in under `?experiment=bend-stations`. Defer any decision to make it the default until a physical phone shows that Lower / Middle / Upper is clear and that the controls do not crowd stem acquisition. Leave PR #36 a draft. Do not merge it into PR #39.

No integrator pass is required for a product or contract correction.
