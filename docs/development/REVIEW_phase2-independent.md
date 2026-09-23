# Independent review — Phase 2 materials

Draft only. This note does not merge anything. Product code on the reviewed tip is unchanged.

## Tip

| | |
| --- | --- |
| Exact tip reviewed | `e579a4ef5a03612c9c3181351c0ab8bcf12ca821` |
| Pull request | #44, draft, `cursor/phase2-materials-integrate-7ce0` |
| Phase 1 base | `f666db8c1b9e46fc9daef05dba09a895844f8e86` (#39, still an open draft) |
| Lane A | `06c1fc1c70147b7f48413890aa9f30330e797525` (#42 berry-twig) |
| Lane B | `9bb5840f84b39e01ebbaeef58cae84e279b0834a` (#43 fern-frond) |
| Bend-stations | `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7` (#36). Not in this history |

`git merge-base --is-ancestor` is true for the Phase 1 base and for both lane tips. `2b3e490` is not an object in this checkout and is not an ancestor. PR #36 remains an open draft. Bend-stations was not promoted.

This review did not author the integration or the lane tips. Contract: preserved. `schemaVersion` stays 1. No new player verb.

## Model

This review run is https://cursor.com/agents/bc-c615d279-4d27-5b2f-ac1b-0bb0392d3c6f.

`cursor-cloud` run-info `originalModelName` is `grok-4.7`. The payload has no `thinking-budget` field and no `reasoning_effort` field. The launch text requested Grok 4.7 with reasoning effort high. This agent is Grok 4.7. No other model was substituted. That budget cannot be confirmed from the session record.

## Verify

`npm ci && npm run verify` on `e579a4ef5a03612c9c3181351c0ab8bcf12ca821`. Node v22.14.0. `npm ci` added 63 packages.

| Check | Result |
| --- | --- |
| Typecheck | passed |
| Tests | 229 passed, 0 failed, 0 skipped |
| `dist/index.html` | 41544 bytes |
| `dist/assets/index-BZXrXw7o.css` | 19942 bytes |
| `dist/assets/index-BqEN0oLZ.js` | 696764 bytes |
| `dist/assets/index-BqEN0oLZ.js.map` | 3436005 bytes |
| `dist/ikebana-web-alpha-standalone.html` | 900016 bytes |
| `validate-dist` | 5 files, standalone self-contained |

These counts and byte sizes match the claim recorded on this tip. The earlier claim was first taken on `f37f7f6`; this reproduction is on the review tip itself.

## Catalog and profiles

Live Materials list and `getMaterialDefinitions()` are the same twelve, ending berry-twig, then fern-frond:

1. flowering-branch / one-branch-v1
2. leafy-shoot / leafy-shoot-v1
3. bare-branch / bare-branch-v1
4. single-flower / single-flower-v1
5. reed / reed-v1
6. flower-volume / flower-volume-v1
7. arching-trailer / arching-trailer-v1
8. foliage-fan / foliage-fan-v1
9. blossom-spray / blossom-spray-v1
10. nodding-flower / nodding-flower-v1
11. berry-twig / berry-twig-v1
12. fern-frond / fern-frond-v1

The `reference-pair`, `round3-three`, `round3-palette`, `round4-candidates`, and `round4-palette` blocks in `src/app/workbenchProfiles.ts` are byte-identical to `f666db8`. `round4-palette` is still the ten materials through nodding flower. New stable profiles, after `round4-palette` and before `all-registered-materials`:

| ID | Ordered material IDs |
| --- | --- |
| `references-plus-berry-twig` | flowering-branch, leafy-shoot, berry-twig |
| `references-plus-fern-frond` | flowering-branch, leafy-shoot, fern-frond |
| `round5-candidates` | berry-twig, fern-frond |
| `round5-palette` | the Round 4 ten, then berry-twig, fern-frond |

`all-registered-materials` stays the last profile and is still the only dynamic one. `berryTwig.ts` matches the Lane A tip. Fern’s pinnate geometry is still present; berry sphere geometry was added beside it.

## Fresh browser evidence

Captured from this tip in a new directory, `docs/development/reports/phase2-independent-review/`. Parent-lane stills were not used. Machine log: `browser-capture.json`.

Headless Chrome. Binary `Google Chrome 148.0.7778.96`. Page user agent `HeadlessChrome/148.0.0.0`. SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`). CSS viewport 1280×800. Drawing buffer 1280×800. Device pixel ratio 1. WebGL2. Not a physical phone.

| Still | What this run observed |
| --- | --- |
| `materials-menu.png` / `materials-menu-scrolled.png` | Twelve named choices in catalog order. Before scroll, berry twig and fern frond are outside the panel. After scroll, both are fully visible. |
| `selected-fern-empty.png` | Fern frond pressed. Source card is fern frond. Plants 0, ordinal 0, hash `41418c67` before and after the berry click and the fern click. |
| `berry-cancel-front.png` | Seed 9255. Escape during a cluster-2 press. Hash stayed `8f9e8328`. |
| `berry-keep-front.png` | Same seed. Release on the cluster-2 screen target (distance about 0.523). `berry-2-2`, `berry-2-3`, and `berry-2-4` inactive. `berry-2-1` and both other clusters stay. Branch count 14. Hash `177b8582`. |
| `berry-clear-front.png` | Same seed, reloaded. A drag whose cue first read `4 berries` deactivated all four cluster-2 berries. Cluster 1 stayed. Cluster 2 stayed in the graph with `activeLength` about 0.306. Hash `549ddd66`. |
| `fern-pinna-front.png` | Seed 8278. Escape left hash `32a97877`. Release deactivated `pinna-blade-2` and left seven blades active. Eight organs, nine branches. Hash `4d0a39b1`. |
| `fern-reload-front.png` | Reload without `fresh=1`. Hash stayed `4d0a39b1`. Blade 2 stayed inactive. Ordinal stayed 1. |
| `fern-rachis-three-quarter.png` | Fresh frond, seed 10232. Cue `Tip + 4 attached stems, 4 leaves`. Blades 1–4 active, 5–8 inactive. Hash `993d8870`. |
| `garden-kept.png` / `garden-view.png` / `garden-copy.png` | Keep “Berry twig and fern frond” (`round5-candidates` × 2, hash `af70bac6`). View set `dataset.gardenViewing`. Copy via Replace returned that hash. Ordinal stayed 2. |
| `arrangement-kept-front.png` | Import opened “Clusters kept, one pinna cut”. Hash `99283ff9`. Pinna blade 2 inactive. Every berry still active. Ordinal 3. |
| `arrangement-opened-front.png` | Import opened “One cluster cleared, upper frond cut”. Hash `d7353afa`. Cluster-2 berries 1–4 inactive. Pinna blades 5–8 inactive. Ordinal 4. |
| `round5-palette-count12-front.png` | One of each of the twelve. Hash `6fd84a83`. |

Front hashes that this run recomputed and that the integration report already published: berry-twig seed 8278 `0d768a64`, fern-frond seed 8278 `32a97877`, berry-twig seed 9255 `8f9e8328`, reference-pair × 6 `1bdb37be`.

Draw calls and triangles, same wrap (mode 4 counted as triangles, vessel included), Front, one forced view change, three animation frames:

| Scene | Draw calls | Triangles |
| --- | --- | --- |
| berry-twig × 1, seed 8278 | 95 | 14338 |
| fern-frond × 1, seed 8278 | 91 | 16726 |
| round5-palette × 12, seed 8278 | 777 | 110010 |
| reference-pair × 6, seed 8278 | 667 | 91678 |

The first three rows match the integration report. These are SwiftShader resource counts, not phone frame time.

## Arrangements backup

`artifacts/phase2-arrangements-garden.json` parses as two entries. This run opened the workbench, used Garden → Import backup with that file, and got the status `Imported 2 arrangements.` Both cards opened:

| Entry | Opened hash | Inactive organs |
| --- | --- | --- |
| `phase2-clusters-kept-pinna-cut` | `99283ff9` | `plant-3:pinna-blade-2` only |
| `phase2-cluster-cleared-rachis-cut` | `d7353afa` | `plant-2:berry-2-1` through `berry-2-4`; `plant-3:pinna-blade-5` through `pinna-blade-8` |

Seeds are 8278, 9255, 10232, and 11209 on the opened bowl. No open failure.

## Findings

| Class | Finding |
| --- | --- |
| correctness | No blocker. Select does not insert. Cluster keep and cluster clear both commit as ordinary distal prunes and leave the other cluster and the branch records in place. Escape restores the berry hash and the fern hash. A pinna release removes that blade only. A rachis release on a whole seed-10232 frond leaves blades 1–4 and deactivates 5–8. Reload keeps the inactive pinna and ordinal 1. Garden Keep / View / Copy keeps hash `af70bac6` and ordinal 2. Both backup bowls open with the documented inactive sets. Round 3 and Round 4 profile text is unchanged. |
| usability | At 1280×800 the materials panel is 286 px tall and 539 px scrollable. Berry twig and fern frond sit below the fold until the list is scrolled. After scroll, both choices are fully on screen and selectable. |
| usability | On berry seed 9255, the cluster-2 screen target (about 0.523) keeps `berry-2-1` and removes the three distal berries. An 18 px move previews all four berries. The drag that first reports four berries leaves `activeLength` about 0.306, which is a longer stub than the frozen basal clear at distance 0.12. The 0.12 clear is the opened backup, not that first four-berry preview. |
| missing evidence | Physical phone: not run. Headless Chrome is the evidence above. Missing phone is not treated as a failure. |
| performance | Reproduced counts match the integration report for one berry twig, one frond, and `round5-palette` × 12. No stall was measured. The numbers are not phone frame time. |
| visual refinement | Berries stay small at bowl scale. The fern stills read as one divided frond with a visible pinna gap or a shortened upper rachis after the cuts above. No separate art change is required for this verdict. |

## Verdicts

| Question | Verdict | Reason |
| --- | --- | --- |
| Combined materials candidate | Pass-with-notes | Verify, catalog order, frozen Round 3/4 profiles, prune, cancel, reload, Garden, and both backup bowls hold on this tip. The notes are the below-fold materials list, the tight berry keep-versus-clear pointer gap, and the unrun phone. |
| berry-twig | accept | A screen-target release keeps the inner berry of cluster 2; a farther press clears that cluster’s berries and leaves cluster 1 and the branch records. Escape restores seed 9255 hash `8f9e8328`. |
| fern-frond | accept | Pinna 2’s release deactivates only that blade, reload keeps it, and a fresh rachis cut on seed 10232 leaves blades 1–4 active. |
| bend-stations | retain-as-study | Tip `2b3e490` is not in this history. PR #36 is still an open draft. It is not the bend on this materials tip. |

## Merge-order recommendation

Draft only. Do not merge from this review.

1. Leave #36 unmerged. Bend-stations stays a separate study.
2. #39 (`f666db8`, Round 4 combined) is still an open draft and is the parent of this tip. Main (`c002c8f`) does not contain it. Fourteen commits sit between main and that parent.
3. Land #39 before #44 if Round 4 and Phase 2 should arrive as separate merges. Merging #44 straight to main would carry that unmerged Round 4 history with the Phase 2 cuttings.
4. Treat `e579a4e` / #44 as the combined materials candidate. Lane tips `06c1fc1` and `9bb5840` are already inside it. Merging #42 or #43 as well would race the same generators. #43’s GitHub base is main even though the branch already contains `f666db8`.
