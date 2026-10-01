# Round 2 independent review — combined integration

- Candidate / role: Combined integration of Candidate A (`bare-branch-v1`), Candidate B (`single-flower-v1`), compact Materials picker, and Workbench named profiles
- Baseline SHA: `6e7d752e6ec15548ea6f2188409471a32fa1f26a` (`main`)
- Head SHA reviewed: `6c6abd61919754976d64f1a11d590c059056717e` (`experiment/material-round-2-integration`)
- Draft PR reviewed: https://github.com/CharlesMish/living-line-ikebana/pull/19
- Sources: A `703175a1ce3a1d48cc5b14166278168282fe2fa1` (PR #15); B `a4570f966cb5d89eba8d7732d46c9b9a5893a9e9` (PR #16); Workbench `a0485bd202d0803a768119300b08f45840a678ac` (PR #20)
- Author / independent reviewer: integration by the Round 2 integrator; this writeup is the Round 2 independent review
- New compositional choice: Two additive cuttings plus one selected-source card and a Materials panel; named workbench profiles instead of catalog-cycling `mixed`
- Main weakness: Workbench identity samples on this head still archive `unavailable-on-this-checkout` for candidate profiles even though A and B are now registered. Physical-phone feel is not run.

This review is of the **final combined head**, not only its parents. It does not merge to `main`. It does not redesign the tray, cameras, or generators.

Fetched `origin/experiment/material-round-2-integration` on 2026-09-21. The tip had not advanced past `6c6abd61919754976d64f1a11d590c059056717e`.

This change **preserves** the behavioral contract. Registration is additive. `one-branch-v1` / `leafy-shoot-v1` golden fixtures are unchanged versus `main`.

## Evidence channels

| Channel | Result |
| --- | --- |
| Automated (`npm ci` && `npm run verify` on `6c6abd6`) | **pass** — typecheck clean; **142 tests, 0 fail**; production build + dist validation |
| Desktop browser (headless Chrome / SwiftShader, plus a headed computer-use pass) | **pass** on the required craft, Garden isolation, tray, and named-profile checks below |
| Desktop touch emulation | useful only as smoke; **not** a physical-phone observation |
| Physical iPhone Safari | **not run** — no device on this reviewer VM |

Playable build from this head: `dist/ikebana-web-alpha-standalone.html` after `npm run verify`, or the preview of `dist/` at the review SHA.

## Evidence table

| Check | Result | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass | 142/142 on `6c6abd61919754976d64f1a11d590c059056717e` |
| Existing golden fixtures unchanged | pass | empty `git diff` vs `main` for `fixtures/plant-1-one-branch-v1.json` and `fixtures/plant-2-leafy-shoot-v1.json`; generator tests still match |
| Intentional candidate fixtures | pass (intentional add) | `fixtures/plant-1-bare-branch-v1.json`, `fixtures/plant-1-single-flower-v1.json` copied as authored |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/bareBranch.test.ts`, `tests/core/singleFlower.test.ts` |
| Palette select does not insert | pass | DOM: only `#selected-cutting` carries `data-material-id`; desktop: choosing Bare branch / Single flower updates the source card and leaves the bowl empty |
| Source drag → valid seat | pass (desktop mouse) | Playwright `mouse.down/move/up` seated flowering `plant-1` then single-flower `plant-2`. Synthetic `PointerEvent` drops at canvas-center were invalid and are **not** counted as a product failure |
| Invalid release | pass | all four materials: ordinal 0, 0 writes, 0 plants |
| Escape / cancel during insert | pass | held insert transaction, Escape, later owner `pointerup` inert; ordinal 0, 0 writes |
| Interrupted drag | pass | `interruptForTest("pointercancel")` then later release; ordinal 0, 0 writes |
| Keyboard selection + source activation | pass | Materials focus/Enter selected `bare-branch` without seating; source Enter seated `bare-branch-v1` as `plant-1` |
| Aim / bend preserve stock | pass (unit + desktop) | unit rest-length tests; browser aim/bend on seated bare-branch preserved every `restLengths` array while the canonical hash changed |
| Held prune preview → Escape | pass (desktop) | single-flower pedicel: acquired `prune`, Escape, later release; hash restored, no extra save. This **was** captured; it is not replaced by the unit-test prune-cancel path |
| Committed prune → reload | pass | Garden isolation path cut the copy; reload restored the cut working bowl |
| Flower-facing world transform | pass (reviewer probe of production groups) | camera-only `setCanonicalView("above")` left the bloom group world position/quaternion unchanged; stem bend moved it (`posDelta` 2.06, `faceDelta` 0.23). Pending ghost matched committed world transform at opacity 0.45; prune-ghost kept the same transform at opacity 0.14. The suite’s existing test still duplicates `faceFrom` instead of reading this group — see requested correction |
| Reference appearance after B’s shared bloom path | pass | `createBloomPetalGeometry(seed, "cupped")` byte-matches `createPetalGeometry`; default calyx remains 7-sepal; flowering `hitRadius` 0.46; leafy shares flowering bloom. Desktop: pink cupped heads vs cream open dish |
| Pending / prune-ghost blooms | pass (production sync path) | same world transform as committed; translucent / faded. Desktop stills of a *held* insert ghost were not filmed; Escape-held prune was |
| Keep → View → Copy → edit → reload → view original | pass | all four materials: original Garden entry stayed uncut; working copy stayed cut after reload; viewed original matched the kept graph. Player key `ikebana-web-alpha:studio-v1` vs workbench `ikebana-web-alpha:workbench-studio-v1` |
| Named profiles vs scene | pass | live `all-four`×12 is 12 cuttings, 3 of each; `all-four`×6 is 2+2+1+1, not two of each; `reference-pair`×6 is flowering+leafy only; `single-flower`×12 is twelve `single-flower-v1`. `bowlMatchesLoadedFixture: true` |
| Count-12 renderer capture | pass (this review, not the archived PR #20 files) | see [reports/review-round-2](reports/review-round-2/README.md). Do **not** quote B’s mixed-6 `calls: 371` / `triangles: 54714` as count 12 |
| Tray chrome 320 / 390 | pass | persistent `.top-chrome` height unchanged when the palette opens (320: 190.6px closed=open; 390: 179.8px closed=open). Panel is overlay, not extra persistent rows |
| Source card vs palette options | pass | source has `data-material-id`; palette options do not |
| Step Back / kept-Garden block editing | pass | Step Back hides craft chrome (`aria-hidden=true`); keyboard activation does not seat. Kept viewer is Step Back only; copy restores Arrange |
| Physical phone | **not run** | [PHONE_CARD_round-2.md](PHONE_CARD_round-2.md) |

## Rendering comparison (reviewer capture)

Browser: headless Google Chrome / SwiftShader on Linux 6.12.94+. CSS viewport = canvas client rect 1280×800. Browser window inner 1280×800. Drawing-buffer 1280×800. `devicePixelRatio` 1, renderer pixel ratio 1, cap 1.8. Canonical Front (`position.z === 15`). Seed 8278.

These are resource counts from one render, **not FPS**.

| Named profile | count | plants in report | composition | calls | triangles |
| --- | --- | --- | --- | --- | --- |
| `reference-pair` | 6 | 6 | flowering 3, leafy 3 | 463 | 65078 |
| `all-four` | 6 | 6 | flowering 2, leafy 2, bare 1, single-flower 1 | 356 | 52414 |
| `all-four` | 12 | 12 | 3 of each | 598 | 84674 |
| `single-flower` | 12 | 12 | single-flower ×12 | 367 | 60482 |

`all-four`×6 prints `balancedEqualCopies: false` and the warning that six cuttings are 2+2+1+1. Single-flower ×12 is **not** the mixed-6 figure 371 / 54714.

Archived files under `docs/development/reports/workbench-profiles/` for `references-plus-*` and `all-four` are still `unavailable-on-this-checkout` from PR #20’s writer. Live construction on this head succeeds. Treat those archived files as stale recipes, not as the live bowl.

## Independent findings

### Bugs / contract

None found that fail a craft, ordinal, save, isolation, or named-profile identity law on this combined head.

### Evidence gaps (not craft failures)

1. **Severity: evidence.** `tools/write-workbench-profile-reports.ts` still writes `unavailable-on-this-checkout` for candidate profiles after A and B are registered. Reproduction: `createWorkbenchFixture("all-four", 8278, 12)` succeeds and seats 12 plants; the committed JSON in `workbench-profiles/all-four-seed8278-count12.json` still lists `missingMaterialIds: ["bare-branch", "single-flower"]`. Proposed scope: one pass to emit identity samples from the live catalog, without inventing renderer numbers in Node.
2. **Severity: evidence.** The suite’s open-face test (`tests/presentation/botanical.test.ts`) recomputes `faceFrom` instead of reading the production organ group’s world transform. Production `syncPlantVisual` is correct (reviewer probe). Proposed scope: replace that duplicate with a stubbed-`ThreeStudio` check of `organVisual.group` world position/quaternion under camera-only vs bend/aim.
3. **Severity: evidence.** Physical-phone sign-off is absent. Desktop Chrome and 390 device-mode are not that sign-off.

### Taste / framing (not scored as bugs)

- Persistent rail at 320/390 is still two-plus rows (posture, Garden/View, Shape + source + Materials). An empty bowl stays visible; a seated flowering crown sits under the rail. Integrator already named this as a framing limit.
- At 320 portrait the Materials label is tight. A headed 320×694 screenshot showed “Materia”; headless measurement did not report `scrollWidth > clientWidth`. Names of the selected cutting remained readable. Do not rewrite cameras for this.
- Workbench modal on 390 portrait requires scrolling to reach **Load fixture**. Native `<select>` overlays the report button; the button is not a picker option (`mixed` is absent, as required).

## Recommendation

**Ready** for Charlie’s playtest. **Ready** for Astra’s finishing review of craft law on this head, with the non-blocking evidence pass above.

Do not merge #19 to `main` from this review. Do not merge #14/#18 as curriculum. Do not treat desktop stills as phone feel.

Smallest useful next pass (one bounded correction, not a redesign):

1. Stop writing `unavailable-on-this-checkout` for profiles the live catalog can construct; keep renderer captures in the browser.
2. Add the production organ-group world-transform check.

Keep species-likeness, tray density taste, and camera reframing out of that pass.
