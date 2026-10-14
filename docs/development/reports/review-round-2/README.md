# Round 2 reviewer captures

Independent review of combined head `6c6abd61919754976d64f1a11d590c059056717e`.

These are **not** the PR #20 `unavailable-on-this-checkout` recipes. Those remain under `../workbench-profiles/` and must not be quoted as live bowls now that A and B are registered.

## Browser renderer reports (compact)

Captured by downloading **Download current report** after `createWorkbenchFixture` via the workbench modal. Headless Chrome, CSS viewport / drawing-buffer / window **1280×800**, `devicePixelRatio` 1, renderer pixel ratio 1, Front camera, seed 8278.

Full plant graphs were stripped here; `arrangementPlantCount` and `loadedFixture.composition` were checked against the live scene before archiving.

| File | profile | count | plants seen | composition | calls | triangles |
| --- | --- | --- | --- | --- | --- | --- |
| `reference-pair-count6.json` | `reference-pair` | 6 | 6 | 3+3 flowering/leafy | 463 | 65078 |
| `all-four-count6.json` | `all-four` | 6 | 6 | 2+2+1+1 | 356 | 52414 |
| `all-four-count12.json` | `all-four` | 12 | 12 | 3 of each | 598 | 84674 |
| `single-flower-count12.json` | `single-flower` | 12 | 12 | twelve single-flower | 367 | 60482 |

Do **not** use Candidate B’s mixed-6 `calls: 371` / `triangles: 54714` as any of these count-12 figures. `all-four`×6 is explicitly not two of each.

Draw calls and triangles are resource counts from one render, not FPS or phone performance.

`browser-harness-results.json` is the desktop PointerEvent/Garden/tray harness log. Synthetic pointer-drop “valid seat” rows failed because the drop missed the kenzan; a later real `mouse` drag seated plants. Isolation rows for three materials “failed” only because Garden already held the first keep; `originalUncut` / `workingStillCut` / `viewedMatchesGarden` were true for every material.

## Screenshots

Headed desktop Chrome device-mode stills from the computer-use pass, under `screenshots/`. They are desktop observations, not physical-phone evidence.
