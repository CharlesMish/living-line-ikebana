# Agent C — round 1 independent review

Review-only. No candidate code was implemented here. No merge to `main`.

## Identities

| Item | Value |
| --- | --- |
| Baseline SHA | `251a94a1b176fb5f32cdbabfaed009deb92c7f57` |
| Review branch | `cursor/review-material-round-1-64cb` |
| Proposed-fix branch | none (no storage-loss or transaction-ownership blocker found) |
| Candidate A branch / head | `cursor/experiment-bare-branch-v1-2e72` / `703175a1ce3a1d48cc5b14166278168282fe2fa1` (implementation still `30d577d`; later commits are evidence docs only) |
| Candidate A PR | https://github.com/CharlesMish/living-line-ikebana/pull/15 (draft) |
| Candidate B branch / head | `cursor/experiment-material-single-flower-v1-bd04` / `a4570f966cb5d89eba8d7732d46c9b9a5893a9e9` (implementation still `98e71cb`; later commit is evidence docs only) |
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
| A bare woody line | **Revise**, then consider integrate | Generator unchanged since `30d577d` (`verify` 119/119). New evidence stills show desktop aim/bend, an answering-fork cut, Garden keep+view, and bare×12 WebGL 187 calls / 32882 triangles at 360×924. Tray wrap and crown-covering chrome remain (Agent A’s 360px still agrees). Phone unrun. |
| B single flower face | **Revise**, then consider integrate | Runtime unchanged since `98e71cb` (`verify` 119/119). New stills: stem cut removes the face; Garden view of kept mixed original; 390px stacks three cards; ~700×430 keeps three labeled cards. Count 1: 37 calls / 11906 triangles; mixed 6: 371 / 54714 at 1785×996. Count-12 renderer download was mixed-6 by operator error. Shared `auto-fit` CSS still in this PR. Phone unrun. |

Neither is idea-only. Neither is a clean integrate until a tray pass and a physical-phone clip exist. Do not land both without reconciling tray layout and mixed-fixture identity on a separate integration branch.

### Smallest useful next pass (shared)

1. One physical-phone clip per candidate: insert → aim → bend → prune preview → cancel → committed prune → reload, beside both references.
2. Keep → View → Copy → Change → Reload with the candidate in a mixed bowl.
3. Integrator-owned tray layout (do not bake competing CSS into both material PRs).
4. Downloaded workbench reports (renderer calls/triangles) at seed 8278 counts 1 / mixed 6 / 12 under matched viewport.

## Resync — Candidate A `703175a` (2026-09-21)

PR #15 synchronized with two commits after the first Agent C pass: verify log, workbench ×12 report, browser stills, and SHA stamps. Diff vs reviewed implementation `30d577d` is **docs and images only** (`src/`, `index.html`, tests, fixtures unchanged). `npm run verify` was not re-run on `703175a`; the runtime tree is identical to the 119/119 pass at `30d577d`. Merge-base remains `251a94a1`.

Independent look at Agent A’s new stills:

- `bare_8278_after_answering_cut.webp`: lower fork is a short stub; space to the right of the trunk is open; status “Cut.”
- `garden_view_kept_bare_line_study.webp`: mixed bowl kept as “Bare line study”; Step Back / Orbit / Pan; Arrange chrome hidden.
- `tray_360px_portrait.webp`: third card wraps, silhouettes missing, chrome covers the plant crown. Agent A marked this pass; Agent C still scores it a tray defect, not a graph defect.

Candidate B head remains `a4570f9` after an evidence-only sync (see below). Recommendation for A is unchanged: **revise tray on an integrator branch**; the generator itself is still integrate-ready.

## Resync — Candidate B `a4570f9` (2026-09-21)

PR #16 added `a4570f9` (“Record single-flower-v1 workbench evidence and review”). Diff vs implementation `98e71cb` is **docs and images only**. `npm run verify` was not re-run on `a4570f9`; the runtime tree is identical to the 119/119 pass at `98e71cb`. Merge-base remains `251a94a1`.

Independent look at Agent B’s new stills and reports:

- `count1-prune.webp`: committed stem cut; bloom and leaves gone; status “Cut.”
- `garden-view-original.webp`: kept mixed bowl “single flower mixed” in Step Back; cream faces still present. Copy→change of a working copy is claimed, not shown in this frame.
- `narrow-390x844.webp`: three full-width stacked cards, silhouettes gone; bowl still visible. Agrees with Agent C’s 320px stack.
- `short-700x430.webp`: three labeled cards in one row with silhouettes; names wrap. Short landscape is usable for three cards.
- Renderer: count 1 = 37 calls / 11906 triangles; mixed 6 = 371 / 54714 at drawingBuffer 1785×996. Count-12 JSON is documented as a mixed-6 mix-up.

Shared tray CSS is unchanged. Agent B now recommends integrate; Agent C still wants that CSS on an integrator branch and a phone clip.

## Waiting / follow-up

Further A/B **code** changes will be re-diffed against `251a94a1`. Do not review code that is not on a remote head.
