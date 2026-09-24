# Independent review — Round 3 combined materials + Garden compare

Verdict: **Pass-with-notes**.

This review did not merge the candidate and did not implement organ roll. It reviewed only the combined tip named below. The candidate's own note, `docs/development/REVIEW_round3-combined.md`, was treated as a claim to check.

## SHA verified

`757be2a2969cff56c72d21d36865f6637f852e82`

Checked out that commit directly. `git rev-parse HEAD` returned that full SHA. `origin/cursor/round3-materials-garden-3351` and draft PR #31 point at the same commit.

The tip's only parent is `f27ab272e703e46fb27c4213163c76ad6dee3428`. That parent adds the combine note. The tip adds the verify paragraph to that note. No product file changes between those two commits.

## Model

Requested model: Grok 4.7 high thinking.

Exposed identity: Grok 4.7. Cursor cloud run-info reports `originalModelName` `grok-4.7` for this run (`bc-08add289-f42d-57f6-833d-a3db57d42264`). The run-info payload has no thinking-budget field. This session's model identity is Grok 4.7 and does not expose a thinking-budget control, so a high thinking budget cannot be confirmed from the exposed fields.

## Verify

`npm ci && npm run verify` on `757be2a2969cff56c72d21d36865f6637f852e82` exited 0.

- Typecheck (`tsc --noEmit`) passed.
- Tests: 173 passed, 0 failed, 0 skipped, 0 cancelled. The runner reported 29 bundled test files. Duration about 1039 ms.
- Build wrote `dist/ikebana-web-alpha-standalone.html`.
- Measured sizes: `dist/index.html` 28185 bytes, `dist/assets/index-DL8pkvE1.css` 19914 bytes, `dist/assets/index-Dow0-ksh.js` 678720 bytes, `dist/assets/index-Dow0-ksh.js.map` 3357374 bytes, standalone 863371 bytes.
- `validate-dist`: 5 files, standalone self-contained.

Those byte sizes match the sizes the candidate note lists for the parent commit. They were re-measured on the tip.

## Ancestry, palette, profiles, goldens

| Claim | Result |
| --- | --- |
| Materials parent `c1cd491c011dd1944dfabf8e7b2f12f9b6c0b991` (#28) is an ancestor | Yes |
| Garden compare parent `4d7179cc1a2d2d9b47ab92020cb5e75982727c64` (#24) is an ancestor | Yes |
| Baseline main `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37` is an ancestor | Yes |
| Integration merge `a2d34c6626aa1cff7b4273053a6704437a68fa86` | First parent is the materials tip. Second parent is the Garden compare tip. |

`src/core/materialCatalog.ts`, `src/core/reed.ts`, `src/core/flowerVolume.ts`, and `src/core/archingTrailer.ts` match the materials parent. `src/app/gardenCompare.ts`, `src/app/gardenCompareView.ts`, and `tests/app/gardenCompare.test.ts` match the Garden parent.

The catalog order on the tip is the established four, then reed, flower volume, and arching trailer:

`flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower`, `reed`, `flower-volume`, `arching-trailer`.

The combine does not add an eighth material. `reference-pair` is still flowering then leafy. `all-four` is still flowering, leafy, bare, then single-flower. `mixed` still resolves to `reference-pair`. Those two profiles do not read the live catalog. Their definitions are unchanged from main; the profile diff only appends the Round 3 profiles. The headless workbench picker showed the same labels, enabled, and did not mention reed, flower volume, or the trailer inside `reference-pair` or `all-four`.

Established golden fixtures are byte-identical to main (`git rev-parse` blob ids match):

- `fixtures/plant-1-one-branch-v1.json` `d701ac6256ffb0c78d17deee378b000dc21f2edd`
- `fixtures/plant-2-leafy-shoot-v1.json` `363993c90f3a40f23531e3e00e858dcb81524a41`
- `fixtures/plant-1-bare-branch-v1.json` `1d51ba32b226b013392b25761d881fd6f9e48a96`
- `fixtures/plant-1-single-flower-v1.json` `c550d7963bbd3797614ef0fd8fcd1b828b788c7f`
- `fixtures/plant-graph.schema.json` `5c3d3f67252e006a7f959a720389d3e1b38db785`

`schemaVersion` remains 1. `gardenVersion` remains 1.

The only files changed on both parent branches since main are `index.html`, `src/presentation/ThreeStudio.ts`, and `docs/BEHAVIORAL_CONTRACT.md`. The added and removed lines from each parent are present in the merge. No conflict markers remain.

## Garden compare, exercised on this tip

Served the tip's `dist/` and drove it in headless Chrome (SwiftShader). The page loaded a saved one-plant studio, kept it twice under the titles `Short` and `Revision with a wrapping caption that should take two or three lines`, then opened Look at both. Pointer events were synthetic `PointerEvent`s. Canvas samples used `preserveDrawingBuffer` forced in the test page before app startup, so the product build was unchanged. A 48×48 draw of each comparison canvas had 9216 nonzero bytes, and the two panes hashed the same.

- Side by side at 760×900: caption text heights were 35px and 17px. Both canvases were 330×448 client pixels, inline style `332px` by `450px`.
- Stacked at 390×844: title offsets were 36px and 18px. Both canvases were 324×283.
- Owner drag changed both pane samples to one new shared hash (`2747507981` to `3228214188`). A second pointer down and move on the other canvas left that hash unchanged.
- `window` blur during the drag restored both samples to the start hash and left the comparison dialog open.
- A later `pointercancel` on the owner, after another move, restored both samples to the start hash and left the dialog open.
- Storage for `ikebana-web-alpha:garden-v1` and `ikebana-web-alpha:studio-v1` was identical before Look at both, while the comparison was open, and after Leave. Garden stayed `gardenVersion` 1 with those two titles. The working test bridge kept canonical hash `32e95bb3` and camera hash `f3827392`. Leave added no further storage key.

The 173 passing tests include `tests/app/gardenCompare.test.ts`, which covers the same ownership, rollback, equal-canvas, and no-write rules in process. The browser run is the UI check of that wiring.

## Materials spot-check

Still present on the tip:

- `reed-v1` in `src/core/reed.ts`, one culm, and the Materials menu entry `reed`.
- `flower-volume-v1` with `FLOWER_VOLUME_GROUP_COUNT` 5. Finish log `docs/development/reports/round3-finish/finish-log.json` records a prune of `plant-1:group-5` that turns `plant-1:bloom-5` inactive and leaves the other listed organs active. The verify run included the flower-volume group-prune test.
- `arching-trailer-v1` in `src/core/archingTrailer.ts`, root branch label trailing cane, menu entry `arching-trailer`.

`docs/development/reports/round3-finish/` is present and nonempty: `finish-log.json`, the flower-volume intact and opened stills, and the Garden original/revision stills and JSON. The headless Materials menu listed the seven ids in the catalog order above. Workbench profiles `references-plus-reed`, `references-plus-flower-volume`, `references-plus-arching-trailer`, `round3-three`, and `round3-palette` were present and enabled.

This review did not repeat the flower-volume prune gesture by hand. Presence is from the source, the passing tests, and the finish files.

## Organ roll and facing diagnosis

Absent from this candidate.

- PR #29 tip `103bd7b7f3f8d42ea59841ba2b861d969d973721` is not an ancestor.
- PR #27 tip `f54ee91e98ad42e0e0581b48996238004b7bd36e` is not an ancestor.
- `organ-roll`, `facing-diagnosis`, and `rollBloom` are absent from the tip outside the combine note's exclusion list, and absent from `dist/assets/index-Dow0-ksh.js`.
- `ExperimentConfig` has no organ-roll flag.

## Findings by severity

### Blockers

None.

### Notes

1. **Phone gap.** No physical phone was used for this review. The candidate note already says phone was not run for the combine and that parent phone gaps still apply. The headless Chrome session above is not a substitute for `tests/browser/PHONE_WEB_TEST_CARD.md`.
2. **Verify attribution in the candidate note.** `docs/development/REVIEW_round3-combined.md` on the tip says `npm run verify` passed on `f27ab272e703e46fb27c4213163c76ad6dee3428`. That sentence was added by the tip commit, so the tip itself was not the SHA named in the paragraph. The independent re-run on `757be2a2969cff56c72d21d36865f6637f852e82` passed with the same test count and the same dist byte sizes. The two commits differ only by that paragraph.

## Contract

Preserved. This review changes no generator, catalog, gesture law, or CSS.
