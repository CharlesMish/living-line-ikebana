# Agent C — round 1 independent review

Review-only. No candidate code was implemented here. No merge to `main`.

## Identities

| Item | Value |
| --- | --- |
| Baseline SHA | `251a94a1b176fb5f32cdbabfaed009deb92c7f57` |
| Review branch | `cursor/review-material-round-1-64cb` |
| Proposed-fix branch | none (no storage-loss or transaction-ownership blocker found) |
| Candidate A branch / head | `cursor/experiment-bare-branch-v1-2e72` / `30d577d221354cbc26db422e6216e1587387034e` |
| Candidate A PR | https://github.com/CharlesMish/living-line-ikebana/pull/15 (draft) |
| Candidate B branch / head | `cursor/experiment-material-single-flower-v1-bd04` / `98e71cb075d2dc5f40e1494a2e0c46e0d73d4605` |
| Candidate B PR | https://github.com/CharlesMish/living-line-ikebana/pull/16 (draft) |

Both candidate heads merge-base exactly at the baseline SHA.

## Evidence classes (do not collapse)

| Class | What ran | What it cannot claim |
| --- | --- | --- |
| Automated | `npm ci` + `npm run verify` on baseline, A, and B | Phone feel, visual quality, acquisition rate |
| Desktop browser | Chrome on Linux, Vite preview, Garden smoke on baseline; workbench fixtures and Front/¾/Above on A and B | Physical-phone acquisition, Safari cancellation, real-device crowding |
| Physical phone | not run | Anything about first-try acquisition or touch ownership |

Never infer phone feel from unit-test success.

## Phase 1 — baseline

Commands at `251a94a1`:

- `npm ci` — install succeeded. `npm audit` reports 3 high-severity issues in `wrangler` → `miniflare` → `sharp` (dev/hosting tooling). Not a craft-runtime integration blocker.
- `npm run verify` — **pass**. Typecheck pass. **112 tests, 0 fail**. Production build + `validate-dist` pass.

Garden and `?workbench=1` are present. Catalog at baseline: `flowering-branch` / `one-branch-v1` and `leafy-shoot` / `leafy-shoot-v1` only.

### Baseline browser (Google Chrome, Linux, `http://127.0.0.1:5173/`)

`GARDEN.md` records an earlier Cloud Browser `ERR_BLOCKED_BY_CLIENT` gap. In this environment the local preview loaded.

Garden smoke from `docs/GARDEN.md` (Arrange studio, `?fresh=1`):

1. Empty studio: Arrange + Shape, two material cards, Garden visible, Workbench hidden.
2. Drag-insert flowering branch, then leafy shoot.
3. Step Back → Front / ¾ / Above / Front. Plants stayed seated.
4. Garden dialog opened; plants were not destroyed.
5. Named **baseline mixed**, Keep this bowl → `1 / 24 moments kept`.
6. View card: kept banner; Arrange/tray editing blocked.
7. Make a working copy → Replace without keeping → editable copy.
8. Prune tool engaged (`Choose where to cut.`); Arrange still available.
9. Start a fresh bowl → Cancel left the bowl; Replace without keeping emptied it.
10. Reopened Garden: **baseline mixed** still present.

Workbench (`?workbench=1&fresh=1`): Workbench control visible. Loaded flowering 8278×1, mixed 8278×6, mixed 8278×12, leafy 9255×1, leafy 10232×1. Download current report produced `living-line-material-report.json` (last fixture was leafy 10232×1: 59 draw calls, 13150 triangles, 8 branch visuals, 7 organ visuals; `checks.*` = `not recorded`). Return to player studio hid Workbench.

Narrow 320×924: Garden actions remained in the scrollable dialog.

Gaps on baseline browser:

- Keep → View → Copy → **committed prune/shape on the copy → reload → view original** was not completed as one continuous instrumented path. Isolation is covered by `tests/app/garden.test.ts` and `gardenTransitions.test.ts`.
- Player Garden vs workbench Garden keys were not re-opened in the same profile after the workbench session. Isolation is implemented (`ikebana-web-alpha:workbench-*-v1` vs player keys) and unit-tested.
- Physical phone: not run.

No storage loss, no cancelled-commit, no camera/plant ownership crossover observed in the desktop smoke. No baseline integration blocker.

Graph inventory at seed 8278 (workbench construction, not WebGL): see `reports/agent-c-round-1/baseline-graph-inventory.json`.

## Phase 2 — candidates

Independent filled templates:

- [REVIEW_bare-branch-v1-agent-c.md](REVIEW_bare-branch-v1-agent-c.md)
- [REVIEW_single-flower-v1-agent-c.md](REVIEW_single-flower-v1-agent-c.md)

Screenshots: `docs/development/reports/agent-c-round-1/`.

### Protected-foundation check (both)

No edits to transaction ownership, cameras, cancellation, insertion ordinals, `one-branch-v1` / leafy generators, golden fixtures `plant-1-one-branch-v1.json` and `plant-2-leafy-shoot-v1.json` (SHA-256 unchanged), persistence fields, Garden store semantics, or hit-priority tables. No new craft verbs. Schema remains `1`.

Mixed workbench fixtures **do** change identity when a third catalog entry is registered (cycle length 3 instead of 2). That is a comparison-baseline shift, not a persistence-schema change. Integrator must not treat mixed-6 graphs as comparable across catalog sizes.

### Coordinator recommendations

| Candidate | Recommendation | Why |
| --- | --- | --- |
| A bare woody line | **Revise**, then consider integrate | Real sparse woody graph (5 branches, 0 organs), not hidden flowering organs. `verify` 119/119. Desktop Front/¾/Above and mixed 6/12 render. 320px tray wraps and drops silhouettes. Phone unrun. Shared CSS untouched. |
| B single flower face | **Revise**, then consider integrate | Distinct cream open-face bloom; reads clearly in mixed scenes and from Above. `verify` 119/119. Shared `ThreeStudio` bloom path is form-driven (cupped source matches the 7-sepal baseline). Shared tray `auto-fit` CSS is an integrator concern: at 320px it stacks all cards and would also restack a two-card tray. Phone unrun. |

Neither is idea-only. Neither is a clean integrate until a tray pass and a physical-phone clip exist. Do not land both without reconciling tray layout and mixed-fixture identity on a separate integration branch.

### Smallest useful next pass (shared)

1. One physical-phone clip per candidate: insert → aim → bend → prune preview → cancel → committed prune → reload, beside both references.
2. Keep → View → Copy → Change → Reload with the candidate in a mixed bowl.
3. Integrator-owned tray layout (do not bake competing CSS into both material PRs).
4. Downloaded workbench reports (renderer calls/triangles) at seed 8278 counts 1 / mixed 6 / 12 under matched viewport.

## Waiting / follow-up

Heads above were current when this package was written. If A or B push revisions, re-diff against `251a94a1` and re-run `npm run verify` on the new head. Do not review code that is not on a remote head.
