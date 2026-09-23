# Independent review — product polish integration

Draft only. This note does not merge anything and does not deploy. Product code on the reviewed tip is unchanged. This review did not author the integration or the lane tips.

Behavioral contract: preserved. No generator version, golden, stock length, ordinal, camera, or verb change was found on the tip. `src/core/` is untouched between the baseline and the product integration.

## Tip

| | |
| --- | --- |
| Exact tip reviewed | `56ec5389d105c788c591af632e04a53641133dbe` |
| Pull request under review | #51, `cursor/product-polish-foliage-flowers-picker-69f4` |
| Baseline main | `2aef05424d751cda2137f3749b2d71e7fdf0c6d1` |
| Product integration | `7ddb8ac07d4773d51b36df385877286fd7a6f530` |
| Evidence parent | `db64b72e418d994fef40c04181087e5f87e6cddd` |

`git rev-parse HEAD` at the start of this review was `56ec5389d105c788c591af632e04a53641133dbe`. Its only parent is `db64b72e`. That commit’s only parent is `7ddb8ac`. That commit’s only parent is `2aef054`. The tip commit only names the evidence commit. It does not change `src/`.

## Model

This review run is https://cursor.com/agents/bc-61439f6a-2492-5de2-9b62-12fdd2ef65fd.

`cursor-cloud` run-info `originalModelName` is `grok-4.7`. The payload has no `thinking-budget` field and no `reasoning_effort` field. The launch text requested Grok 4.7 with reasoning effort high. This agent is Grok 4.7. No other model was substituted. That budget cannot be confirmed from the session record.

## Parents, and what is not in this history

The lane tips are the sources the integrator named. They are not git ancestors of `56ec538`. `git merge-base --is-ancestor` is false for each of them. The product commit `7ddb8ac` replays their presentation changes onto `2aef054` as one new commit. Parent lane branches were left in place.

| Lane | Named commit | Ancestor of `56ec538`? | Sits on |
| --- | --- | --- | --- |
| A foliage tip | `f4d973dc457180c2335581b1a9e4477ef601c44a` | no | `f869a1919b5599897073340e79e5ce2e3d3e7ea6` |
| A foliage product | `f869a1919b5599897073340e79e5ce2e3d3e7ea6` | no | `2aef054` |
| B flowers | `6ba9acdde6f4fb91a1c06359bdf6c9f405e41af6` | no | `2aef054` |
| C product | `a04a60595edc0fa8c1d5b34a005b4d39b30898df` | no | `2aef054` |
| C PR head | `697ee86abe7704033d91c1ae63e686b0335a73de` | no | `a04a605` |

`f4d973d` and `697ee86` are documentation commits. `git diff` of `src/` and `tests/` against their product parents is empty. The sentence in the integration review that each parent sits directly on `2aef054` is true of the product commits that were copied (`f869a19`, `6ba9acd`, `a04a605`). It is not true of the named tips `f4d973d` and `697ee86`.

File contents match that replay:

- Files owned by one lane are byte-identical on `7ddb8ac` to that lane’s product commit.
- `botanicalGeometry.ts` and `materialAppearance.ts` match a merge of A then B onto `2aef054`.
- `ThreeStudio.ts` had one overlapping import. The integration keeps both sides: `tuftInstancePose` from B, and the foliage draw types from A. The rest of the file matches that merge.

Bend-stations stay out. `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7` (#36, still open, `cursor/bend-stations-220e`) is not an ancestor. `32bbfeaac99121358f752a53ed57f5248d5efda0` (#48, still open, `cursor/polish-lane-d-bend-stations-b600`) is not an ancestor. No commit subject on `56ec538` is a bend-station change. The fixed `0.54` station already on main is the bend this tip uses.

## Verify

`npm ci && npm run verify` on `56ec5389d105c788c591af632e04a53641133dbe`, before this review’s evidence commit. Node v22.14.0. `npm ci` added 63 packages.

| Check | Result |
| --- | --- |
| Typecheck | passed |
| Tests | 236 passed, 0 failed, 0 skipped |
| `dist/index.html` | 42122 bytes |
| `dist/assets/index-BfEkgxir.css` | 21247 bytes |
| `dist/assets/index-BMsVzBrE.js` | 702282 bytes |
| `dist/assets/index-BMsVzBrE.js.map` | 3464298 bytes |
| `dist/ikebana-web-alpha-standalone.html` | 909479 bytes |
| `validate-dist` | 5 files, standalone self-contained |

These counts and byte sizes match the integration report. `dist/` is not committed. On the same machine, `npm test` at `2aef054` is 229 passed, 0 failed, 0 skipped. The seven added tests are the five foliage presentation tests, the tuft-scatter test, and the materials-overflow test, and those files match the lane product commits.

## Fresh browser evidence

Captured from this tip into `docs/development/reports/polish-independent-review/`. Parent-lane stills and the integration stills were not reused. Machine log: `browser-capture.json`. Query-flag log: `query-flags.json`.

Headless Chrome 148.0.7778.96 on Linux. Page user agent `HeadlessChrome/148.0.0.0`. Renderer `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. CSS canvas 1280×800. Drawing buffer 1280×800. Device pixel ratio 1. Window 1280×800. WebGL2. Not a physical phone.

Chrome 148 did not open WebGL until it was started with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`). The renderer string then matched the integration report. The same Chrome captured the tip and a worktree of `2aef054` on port 5174.

Script: `tools/capture-polish-integration.mjs` with smoke enabled, against Vite on this tip. Seed 8278, count 1, Front, three-quarter, and Above. Arrangement import used `artifacts/polish-baseline-arrangements.json` and reported `Imported 2 arrangements.`

| Scene | Hash this run | Still |
| --- | --- | --- |
| fern-frond | `32a97877` | `fern-frond-seed8278-count1-front.png` plus three-quarter and Above |
| foliage-fan | `0c41197f` | `foliage-fan-seed8278-count1-front.png` plus three-quarter and Above |
| berry-twig | `0d768a64` | `berry-twig-seed8278-count1-front.png` plus three-quarter and Above |
| blossom-spray | `e313704c` | `blossom-spray-seed8278-count1-front.png` plus three-quarter and Above |
| flower-volume | `5c6ba5af` | `flower-volume-seed8278-count1-front.png` plus three-quarter and Above |
| nodding-flower | `f4ed4497` | `nodding-flower-seed8278-count1-front.png` plus three-quarter and Above |
| Arrangement A, Leafy fern and fan | `3b1e9ad9` | `arrangement-a-leafy-fern-fan-front.png` plus three-quarter and Above |
| Arrangement B, Berry and flower accents | `1f7e3e94` | `arrangement-b-berry-flower-accents-front.png` plus three-quarter and Above |
| round5-palette ×12 | `6fd84a83` | `round5-palette-seed8278-count12-front.png` |

Three-quarter and Above repeated the Front hash and the Front triangle counts for every specimen and both arrangements.

Materials list at 1280×800, fresh session, hash `41418c67` before and after the fern click:

| State | What this run measured |
| --- | --- |
| `materials-list-1280x800.png` | `clientHeight` 286, `scrollHeight` 539, `scrollTop` 0. Below cue shown, above cue hidden. Fully visible: flowering branch through flower volume. `elementFromPoint` on the fade is `arching-trailer`. |
| fern choice | Source becomes fern frond. Menu closes. Plants 0. Ordinal 0. Hash stays `41418c67`. |
| `materials-list-1280x800-selected-reopen.png` | Reopen `scrollTop` 253. Fern frond pressed and fully visible, with arching trailer through berry twig. Above cue shown, below cue hidden. |
| `materials-list-1280x800-scrolled.png` | Same end position after `scrollTop` is set to the end: 253. |

On the baseline worktree the cue elements are absent, reopen stays at `scrollTop` 0, and the same fern click also leaves plants 0 and ordinal 0.

## Cost

Same wrap as the integration report: `drawElements` / `drawArrays` before page scripts, mode 4 counted as triangles, vessel included, counters reset, one view click, three animation frames. Instanced draws are counted beside that wrap and are not added into it. Baseline numbers below were measured this session on `2aef054`, not copied from the integration report. Front counts. Three-quarter and Above repeated them on both builds.

| Scene | Calls | Triangles baseline | Triangles tip | Protocol delta | Instanced baseline | Instanced tip | Instanced delta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| flowering-branch | 153 | 26042 | 26042 | 0 | 5428 | 5428 | 0 |
| leafy-shoot | 81 | 14034 | 14034 | 0 | 3700 | 3700 | 0 |
| bare-branch | 27 | 8766 | 8766 | 0 | 3700 | 3700 | 0 |
| single-flower | 51 | 12166 | 12166 | 0 | 4564 | 4564 | 0 |
| reed | 11 | 6838 | 6838 | 0 | 3700 | 3700 | 0 |
| flower-volume | 81 | 16734 | 16734 | 0 | 15220 | 18100 | +2880 |
| arching-trailer | 41 | 10058 | 10058 | 0 | 3700 | 3700 | 0 |
| foliage-fan | 103 | 16134 | 16134 | 0 | 3700 | 3700 | 0 |
| blossom-spray | 83 | 17998 | 17998 | 0 | 17524 | 20980 | +3456 |
| nodding-flower | 29 | 12302 | 12302 | 0 | 3700 | 3700 | 0 |
| berry-twig | 95 | 14338 | 15922 | +1584 | 3700 | 3700 | 0 |
| fern-frond | 91 | 16726 | 16726 | 0 | 3700 | 3700 | 0 |
| round5-palette ×12 | 777 | 110010 | 111770 | +1760 | 31636 | 37972 | +6336 |
| Arrangement A | 255 | 34414 | 34414 | 0 | 3700 | 3700 | 0 |
| Arrangement B | 253 | 42090 | 43674 | +1584 | 26740 | 32500 | +5760 |

These are the integration report’s columns, reproduced. The protocol +1584 is the berry twig. Palette +1760 is that palette’s berry twig. Arrangement A has no berry. Instanced deltas are the eight-column tuft. Nodding’s instanced count stays 3700.

## Six materials that were not restyled

Flowering branch, leafy shoot, bare branch, single flower, reed, and arching trailer match the baseline on hash, calls, protocol triangles, and instanced triangles. Their Front stills are pixel-identical to the baseline capture from this session (1280×800 RGB). Leafy shoot loaded with `?pinnate=quilled&fanLeaf=separated` is also pixel-identical to the leafy Front still, hash `6645d73a`.

The six restyled Front stills are not identical to baseline. Pixel change, same frame:

| Still | Pixels changed | Mean channel delta on changed pixels |
| --- | --- | --- |
| fern-frond | 1.151% | 178.9 |
| foliage-fan | 0.221% | 140.5 |
| berry-twig | 0.094% | 97.2 |
| blossom-spray | 1.079% | 44.9 |
| flower-volume | 0.400% | 40.9 |
| nodding-flower | 0.299% | 14.4 |

Arrangement A Front changes by 1.051%. Arrangement B Front changes by 1.431%. The round5-palette Front changes by 2.717%. The materials list at `scrollTop` 0 changes by 0.322%, which is the cue.

## Interaction

Headless Chrome, workbench, seed 8278, count 1, Front, fixed bead, Shape then Prune. Phone: not run. Log: `browser-capture.json`. Stills: `smoke-*.png`.

| Step | Fern | Fan | Berry | Blossom | Volume | Nodding |
| --- | --- | --- | --- | --- | --- | --- |
| Seated | `32a97877`, ordinal 1, stock `3.75022561246995` | `0c41197f`, ordinal 1, stock `2.6202256124699494` | `0d768a64`, ordinal 1 | `e313704c`, ordinal 1 | `5c6ba5af`, ordinal 1 | `f4ed4497`, ordinal 1, stock `2.3528913545235985` |
| Aim | `1d40c4fa`, stock unchanged | `340805b0`, stock unchanged | `7b471a45` | `555cd6c1` | `1b55eda1` | `66a128ee`, stock unchanged |
| Bend | `13f16a3a`, stock unchanged | `5001d224`, stock unchanged | `b4b1052b` | `68b12171` | `c2390df3` | `78e8213d`, stock unchanged |
| Preview | Cut leaf stem / Tip + 1 leaf · release to cut | Cut branch / Tip + 1 attached stem, 1 leaf · release to cut | Cut branch / Tip + 2 attached stems, 2 berries · release to cut | Cut branch / Tip + 1 attached stem, 1 flower · release to cut | Cut flower stem / Tip + 1 flower · release to cut | Cut flower stem / Tip + 1 flower · release to cut |
| Escape | hash unchanged, transaction cleared, no new save | same | same | same | same | same |
| Commit | `3b040b1a`, `pinna-blade-4` inactive, ordinal 1 | `007233d5`, `leaf-opening-3` inactive, ordinal 1 | `f87c8680`, berries `2-2` and `2-3` inactive, ordinal 1 | `0fda66d1`, `bloom-2-2` inactive, ordinal 1 | `a7c68609`, `bloom-5` inactive, ordinal 1 | `fd6d29db`, `bloom` inactive, ordinal 1 |
| Reload, Garden view, Garden copy | all `3b040b1a` | all `007233d5` | all `f87c8680` | all `0fda66d1` | all `a7c68609` | all `fd6d29db` |

Stock length on fern, fan, and nodding stayed at the seated value through aim and bend. Ordinal stayed 1. These hashes match the integration smoke table. They are this run’s measurements.

## Recoverable draws

Absent query flags are the accepted draws. Hash stays on the count-1 specimen. Dialogs were closed and Front was clicked before each still.

| URL | Hash | Pixels versus the accepted Front |
| --- | --- | --- |
| fern, no `pinnate` | `32a97877` | identical to `fern-frond-seed8278-count1-front.png` and to `?pinnate=tapered` |
| `?pinnate=baseline` | `32a97877` | 1.151% changed, mean 178.9 |
| `?pinnate=quilled` | `32a97877` | 0.576% changed, mean 189.7 |
| `?pinnate=not-a-draw` | `32a97877` | identical to the accepted Front |
| fan, no `fanLeaf` | `0c41197f` | identical to `foliage-fan-seed8278-count1-front.png` and to `?fanLeaf=spray` |
| `?fanLeaf=shared` | `0c41197f` | 0.221% changed, mean 101.4 |
| `?fanLeaf=separated` | `0c41197f` | 0.223% changed, mean 102.6 |
| `?fanLeaf=not-a-draw` | `0c41197f` | identical to the accepted Front |

`shared` and `separated` also differ from each other (0.189%). The flags still switch the fern and fan draws and still leave the graph alone.

## Findings

| Class | Finding |
| --- | --- |
| correctness | No blocker. Select does not insert. Aim and bend keep stock length. Escape clears the transaction and writes no save. Commit deactivates the previewed distal organ and leaves the ordinal at 1. Reload, Garden view, and Garden copy return that commit hash for all six affected materials. Arrangement hashes stay `3b1e9ad9` and `1f7e3e94`. Query flags do not change hashes. `src/core/` is unchanged. The replayed `src/` and `tests/` match the lane product commits, including the combined ThreeStudio import. |
| usability | At 1280×800 the list is still 286 px of a 539 px scroll. The below cue is visible at the top and does not take the press. Opening the list after fern frond scrolls that row clear at `scrollTop` 253. Phone feel of the fade is unknown. |
| missing evidence | Physical phone: not run. Headless SwiftShader is the evidence above. Missing phone is not treated as a failure. Baseline comparison stills from this session were not committed; the tip stills and both cost logs’ numbers are. |
| performance | Remeasured protocol and instanced counts match the integration table for the twelve count-1 specimens, round5-palette ×12, Arrangement A, and Arrangement B. No mesh was simplified. The numbers are not phone frame time. Instanced tuft triangles stay outside the protocol column. |
| visual refinement | The six non-restyled Fronts are pixel-identical to baseline. Fern, fan, berry, blossom, volume, and nodding Fronts differ in the amounts above, with hashes unchanged. The nodding delta is the smallest of the six. No separate art change is required for this verdict. Even pinna spacing, stored blossom angles, berries that can sit close enough to touch, and the blue sleeve remain as the integrator left them. |

## Verdicts

| Question | Verdict | Reason |
| --- | --- | --- |
| Combined product polish | Pass-with-notes | Verify is 236/0/0 and the dist bytes match the claim. Hashes, prune, cancel, reload, Garden, picker select, and both arrangement imports hold on `56ec538`. Cost deltas match a fresh baseline measurement. The notes are the unrun phone, the instanced tuft cost living outside the protocol counter, and the fact that the named lane tips were replayed rather than merged. |
| foliage | accept | Default fern matches `?pinnate=tapered` and differs from `baseline` and `quilled`. Default fan matches `?fanLeaf=spray` and differs from `shared` and `separated`. Count-1 hashes stay `32a97877` and `0c41197f`. Protocol triangles stay 16726 and 16134. Unknown query values are ignored. |
| flowers-berries | accept | Berry hash stays `0d768a64` with protocol +1584. Blossom and volume hashes stay `e313704c` and `5c6ba5af` with protocol delta 0 and instanced +3456 and +2880. Nodding hash stays `f4ed4497` with protocol and instanced delta 0. Aim, bend, prune cancel, commit, reload, and Garden hold. |
| picker | accept | The fade and chevron are present at 1280×800. Choosing fern frond leaves plants 0, ordinal 0, and hash `41418c67`. Reopen scrolls to 253 with fern pressed and fully visible. The fade does not receive the press. |
| bend-stations | retain-as-study | #36 (`2b3e490`) and #48 (`32bbfea`) are open and are not ancestors of `56ec538`. This tip’s bend is the existing fixed station. |

## Merge-order recommendation

Draft only. Do not merge from this review. Do not deploy this branch. GitHub Pages publishes `main` only.

1. Leave #36 and #48 unmerged. Bend-stations stays a separate study.
2. Treat `56ec538` / #51 as the combined presentation candidate. The lane branches are the sources of that replay, not additional merges. Merging #47, #49, or #50 as well would race the same presentation files.
3. Land #51 only after someone accepts this note. This review does not accept it on a phone.
