# Phase 2 integration — berry twig and fern frond

Draft only. This branch does not merge to main. Bend-stations (#36) and organ-roll are not in this branch. Evidence-only #41 is not the product base.

## SHAs

| Role | SHA |
| --- | --- |
| Phase 1 product base, PR #39 | `f666db8c1b9e46fc9daef05dba09a895844f8e86` |
| Lane A parent, PR #42, `cursor/berry-twig-v1-1829` | `06c1fc1c70147b7f48413890aa9f30330e797525` |
| Lane B parent, PR #43, `cursor/fern-frond-v1-7a01` | `9bb5840f84b39e01ebbaeef58cae84e279b0834a` |
| Berry merge (parents: base, Lane A tip) | `2f65ab18e23fe909e2d94548ce23e7daf1a27eb3` |
| Fern merge (parents: berry merge, Lane B tip) | `ae5e72bc10f0de94784c6525f9e1d101c6b9f543` |
| Round 5 profiles and frozen bowls | `313122e73e01d1ba8196a7787548f80c456104e0` |
| Verified code tip, before these stills | `f37f7f6a2d7d96938945cdd8b083874bff854acd` |

`git merge-base --is-ancestor` is true for the Phase 1 base and for both frozen lane tips. The parent lane branches were not rewritten. This note and the stills under `docs/development/reports/phase2-integration/` do not change generators, profiles, or tests. The draft PR records `git rev-parse HEAD` after this file lands.

## Model

Requested launch: Grok 4.7 with reasoning effort high. `cursor-cloud` run-info `originalModelName` is `grok-4.7` (https://cursor.com/agents/bc-2972fb6f-e64f-5a71-8778-6f391d237ce0). This agent is Grok 4.7. The run-info payload has no `thinking-budget` field and no `reasoning_effort` field, so that budget cannot be confirmed from the session. No other model was substituted.

## Decision

Both accepted candidates are in the catalog. None are deferred.

Contract: preserved. `schemaVersion` stays 1. The lane-accepted organ kind `berry` and the lane-accepted `pinnate` leaf form stay. No new player verb, persistence field, solver edit, or curriculum. Aim, bend, prune, cancellation, insertion ordinals, and Garden semantics stay the shared laws. Ordinary aim and bend still preserve stock length. Graphs store `generatorVersion`, not a material id. `one-branch-v1` and the earlier goldens stay.

## Catalog order

Twelve materials. The first ten stay in their previous order. Phase 2 appends lane A, then lane B:

1. `flowering-branch` / `one-branch-v1`
2. `leafy-shoot` / `leafy-shoot-v1`
3. `bare-branch` / `bare-branch-v1`
4. `single-flower` / `single-flower-v1`
5. `reed` / `reed-v1`
6. `flower-volume` / `flower-volume-v1`
7. `arching-trailer` / `arching-trailer-v1`
8. `foliage-fan` / `foliage-fan-v1`
9. `blossom-spray` / `blossom-spray-v1`
10. `nodding-flower` / `nodding-flower-v1`
11. `berry-twig` / `berry-twig-v1`
12. `fern-frond` / `fern-frond-v1`

## Profiles

Round 3 and Round 4 membership is unchanged. `round4-palette` is still the ten materials through nodding flower. `round4-candidates` is still foliage fan → blossom spray → nodding flower. `reference-pair`, `mixed`, `all-four`, `round3-three`, and `round3-palette` do not list either new cutting.

New stable profiles, after `round4-palette` and before the dynamic profile:

| ID | Ordered material IDs |
| --- | --- |
| `references-plus-berry-twig` | `flowering-branch`, `leafy-shoot`, `berry-twig` |
| `references-plus-fern-frond` | `flowering-branch`, `leafy-shoot`, `fern-frond` |
| `round5-candidates` | `berry-twig`, `fern-frond` |
| `round5-palette` | the Round 4 ten, then `berry-twig`, `fern-frond` |
| `all-registered-materials` | live catalog; the only dynamic profile; stays last |

`round5-candidates` × 6 is three of each. × 12 is six of each. `round5-palette` × 6 is the first six materials and omits the trailer, the three Round 4 cuttings, and both Phase 2 cuttings. × 12 is one of each of the twelve.

## Frozen arrangements

Backup: `artifacts/phase2-arrangements-garden.json`.

Open the workbench (`?workbench=1`), then Garden → Import backup, and choose that file. Each entry opens from its card. These are small player choices, not a teaching composition and not an ikebana claim.

Seeds are the successful-seat seeds for those ordinals: ordinal 1 is `8278`, 2 is `9255`, 3 is `10232`, 4 is `11209`.

| Entry | Title | Plants |
| --- | --- | --- |
| `phase2-clusters-kept-pinna-cut` | Clusters kept, one pinna cut | plant-1 flowering branch, seed 8278, whole. plant-2 berry twig, seed 9255, every berry still active. plant-3 fern frond, seed 10232, pinna 2 cut at distance `0.06`. Seven blades stay active. Pinna 1 is unchanged. |
| `phase2-cluster-cleared-rachis-cut` | One cluster cleared, upper frond cut | plant-1 leafy shoot, seed 8278, whole. plant-2 berry twig, seed 9255, cluster 2 cleared at distance `0.12` (four berries inactive, cluster 1 unchanged and still active). plant-3 fern frond, seed 10232, rachis cut between pinna 4 and pinna 5 (blades 1–4 active, 5–8 inactive). plant-4 foliage fan, seed 11209, whole. |

A basal cluster clear is distance `0.12`. A screen-target press near the middle of a cluster is a different, distal plan.

## Fresh browser evidence

Captured from this integrated workbench, not from the parent lane stills. Directory: `docs/development/reports/phase2-integration/`. Machine log: `browser-capture.json`.

Environment: Headless Chrome 148.0.7778.96 on Linux, SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`). CSS viewport 1280×800. Drawing buffer 1280×800. Device pixel ratio 1. WebGL2. Not a physical phone.

| Still | What it is |
| --- | --- |
| `berry-twig-seed8278-count1-front.png` | Berry twig, seed 8278, Front. Hash `0d768a64` |
| `berry-twig-seed8278-count1-three-quarter.png` | Same plant, three-quarter |
| `berry-twig-seed8278-count1-above.png` | Same plant, Above |
| `berry-twig-seed9255-count1-front.png` | Seed 9255, Front. Hash `8f9e8328` |
| `berry-twig-seed10232-count1-front.png` | Seed 10232, Front. Hash `885be1da` |
| `fern-frond-seed8278-count1-front.png` | Fern frond, seed 8278, Front. Hash `32a97877` |
| `fern-frond-seed8278-count1-three-quarter.png` | Same frond, three-quarter |
| `fern-frond-seed8278-count1-above.png` | Same frond, Above |
| `fern-frond-seed9255-count1-front.png` | Seed 9255, Front. Hash `d2874760` |
| `fern-frond-seed10232-count1-front.png` | Seed 10232, Front. Hash `57e8e200` |
| `round5-candidates-seed8278-count6-front.png` | Three berry twigs and three fronds. Hash `410aad96` |
| `round5-candidates-seed8278-count6-three-quarter.png` | Same bowl, three-quarter |
| `round5-candidates-seed8278-count6-above.png` | Same bowl, Above |
| `references-plus-berry-twig-seed8278-count6-front.png` | Hash `8ac91406` |
| `references-plus-fern-frond-seed8278-count6-front.png` | Hash `947cf810` |
| `reference-pair-seed8278-count6-front.png` | Hash `1bdb37be`, the same document hash the berry lane recorded for this profile. No berry twig and no fern |
| `berry-seed8278-prune-cancel-front.png` | Escape during a cluster press. Hash stayed `0d768a64`. The preview cue was `Cut branch` / `Tip + 3 attached stems, 3 berries` |
| `berry-seed8278-cluster-cut-front.png` | Released press on `plant-1:cluster-2` at its screen target (about distance 0.42). `berry-2-2` and `berry-2-3` inactive. `berry-2-1` and both other clusters stay. Hash `86481fb8`. Branch count stayed 13 |
| `berry-seed8278-aim-three-quarter.png` | After that cut, a drag that the hit test acquired as a bend of the selected cluster. Hash `86481fb8` to `6cca6689`. Escape before that drag left the hash unchanged |
| `fern-seed8278-pinna-cut-front.png` | Escape on pinna 2 left hash `32a97877`. Release deactivated `pinna-blade-2` and left 7 blades active, 8 organs, 9 branches. Hash `4d0a39b1` |
| `fern-seed8278-after-reload-front.png` | Reload without `fresh=1`. Hash stayed `4d0a39b1`. The blade stayed inactive. Ordinal stayed 1 |
| `fern-seed8278-rachis-cut-three-quarter.png` | Rachis press on that already-shortened frond. Cue: `Tip + 4 attached stems, 4 leaves`. Blades 5–8 became inactive. Blades 1, 3, and 4 stayed active. Hash `0508d965` |
| `fern-seed8278-aim-above.png` | Escape during an aim of the rachis left hash `32a97877` on a fresh frond. The following drag bent the rachis. Hash `c47f3bbc` |
| `garden-kept.png` / `garden-view.png` / `garden-copy.png` | Keep “Berry twig and fern frond” (`round5-candidates` × 2, hash `af70bac6`). View set `dataset.gardenViewing`. Copy via Replace returned that same hash. Ordinal stayed 2 |
| `arrangement-kept-front.png` and the three-quarter and Above pair | Imported bowl, clusters kept, one pinna cut. Hash `99283ff9` |
| `arrangement-opened-front.png` and the three-quarter and Above pair | Imported bowl, one cluster cleared, upper frond cut. Hash `d7353afa` |
| `materials-menu.png` / `materials-menu-scrolled.png` | Twelve choices, berry twig then fern frond last. Panel clientHeight 286, scrollHeight 539 |
| `round5-palette-seed8278-count12-front.png` | One of each of the twelve. Hash `6fd84a83` |
| `berry-twig-seed8278-count12-front.png` | Twelve berry twigs. Hash `8aeff027` |
| `fern-frond-seed8278-count12-front.png` | Twelve fronds. Hash `a7fa9652` |

## Draw calls and triangles

Same capture path: workbench load, one forced view change, then three animation frames of wrapped `drawElements` / `drawArrays`. Mode 4 is counted as triangles. Counts include the vessel. This is Headless Chrome on SwiftShader at 1280×800, not a phone.

| Scene | Draw calls | Triangles |
| --- | --- | --- |
| berry-twig × 1, seed 8278, Front | 95 | 14338 |
| fern-frond × 1, seed 8278, Front | 91 | 16726 |
| round5-palette × 12, seed 8278, Front | 777 | 110010 |
| berry-twig × 12, seed 8278, Front | 1099 | 112218 |
| fern-frond × 12, seed 8278, Front | 1015 | 137902 |

The count-12 stress for the integrated palette is `round5-palette` × 12: 777 calls and 110010 triangles. The single-material rows are the same count with one cutting repeated. These are resource counts, not phone frame time.

## Verify

`npm ci && npm run verify` on `f37f7f6a2d7d96938945cdd8b083874bff854acd`.

- Typecheck passed.
- Tests: 229 passed, 0 failed, 0 skipped.
- Vite build wrote `dist/index.html` (41544 bytes), `dist/assets/index-BZXrXw7o.css` (19942 bytes), `dist/assets/index-BqEN0oLZ.js` (696764 bytes), and `dist/assets/index-BqEN0oLZ.js.map` (3436005 bytes).
- Standalone `dist/ikebana-web-alpha-standalone.html` is 900016 bytes.
- `validate-dist`: 5 files, standalone self-contained.

## Known limits

- Berries are small at bowl scale. A midpoint press on a cluster removes the distal berries and can leave the inner one. Clearing the whole cluster is a cut near the lateral base (distance 0.12), frozen in the second arrangement. The browser cancel preview named three berries; the committed browser press was the midpoint plan.
- The rachis still in the browser was taken after pinna 2 was already inactive, so the remaining active blades were 1, 3, and 4. The frozen arrangement cuts a whole frond between pinna 4 and pinna 5 and leaves blades 1–4 active.
- The wood drag after the berry cut was acquired as a bend of the selected cluster. The fern Escape was an aim of the rachis; the following drag bent that rachis.
- Phone: not run. Do not read the SwiftShader counts as phone performance.

## Self note for the independent reviewer

Ready for review. Both accepted cuttings are in one successor of `f666db8`. Round 3 and Round 4 profile membership is unchanged. Parent lane branches were not rewritten. Phone was not run. Do not merge.
