# Product polish integration — foliage, flowers, materials cue

Presentation only. Behavioral contract: preserved. No generator version, golden, stock length, ordinal, camera, or verb change. Lane D bend-stations are not in this branch. Draft only: no merge, no deploy. Physical phone: not run.

## Tip

| | |
| --- | --- |
| Start | `2aef05424d751cda2137f3749b2d71e7fdf0c6d1` (`git rev-parse HEAD` before the branch) |
| Product integration | `7ddb8ac07d4773d51b36df385877286fd7a6f530` |
| Evidence and this report | `EVIDENCE_SHA` |
| Branch | `cursor/product-polish-foliage-flowers-picker-69f4` |
| Pull request | https://github.com/CharlesMish/living-line-ikebana/pull/51 |

`EVIDENCE_SHA` is the commit that adds the matched stills and this report. The branch tip is that commit, or the one-line child that only fills this hash in. `git rev-parse HEAD^` or `git rev-parse HEAD` on the PR branch is the check. Parent lane branches were not rewritten.

## Model

This run is https://cursor.com/agents/bc-93449ca3-3467-5b63-9e2c-a2c4e1b169f4.

`cursor-cloud` run-info `originalModelName` is `grok-4.7`. The payload has no `thinking-budget` field and no `reasoning_effort` field. The launch text requested Grok 4.7 with reasoning effort high. This agent is Grok 4.7. No other model was substituted. That budget cannot be confirmed from the session record.

## Parents

Accepted comparison-backed polish only. Each parent sits directly on `2aef054`.

| Lane | PR | Branch | Tip | What was taken |
| --- | --- | --- | --- | --- |
| A foliage | #50 | `cursor/polish-lane-a-foliage-af43` | `f4d973dc457180c2335581b1a9e4477ef601c44a` | Fern `tapered` pinna default. Fan `spray` blades, color `0x3e6b38`, vein `0xd5e6a6`, roughness `0.74`. `?pinnate=` and `?fanLeaf=` stay recoverable |
| B flowers | #49 | `cursor/polish-lane-b-flowers-c19a` | `6ba9acdde6f4fb91a1c06359bdf6c9f405e41af6` | Berry `0xa63e56`, roughness `0.3`, radius `0.078`, 12×8 sphere. Rounder 8-column tuft. Blossom scatter wider than flower-volume scatter. Nodding sleeve on the same bell |
| C picker | #47 | `cursor/polish-lane-c-picker-b3bd` | `697ee86abe7704033d91c1ae63e686b0335a73de` | Materials-list fade and edge chevron. Opening the list scrolls the pressed row clear. Select does not insert. Product commit is `a04a60595edc0fa8c1d5b34a005b4d39b30898df`; `697ee86` only records Lane C's verify note |

Lane C's abbreviated `a04a605` is not the PR head. The head is `697ee86`. The picker source at that head is the `a04a605` change.

Explicitly out:

- Lane D / #48 / #36 bend-stations. Not merged.
- Baseline evidence #46 (`cursor/polish-baseline-evidence-8602` @ `bca018057f6cf0be37d7a3bece63a0f20490dbaa`) is not merged. This branch copies `artifacts/polish-baseline-arrangements.json` from that branch so Arrangement A and B can be imported. The before/after stills below were recaptured on this machine.

## Accepted, rejected, deferred

Shared renderer changes from A and B are both in `src/presentation/botanicalGeometry.ts`, `materialAppearance.ts`, and `ThreeStudio.ts`. `src/core/` is untouched. Leaf draws and tuft/bell/berry draws do not read each other's options.

| Item | Decision | Why |
| --- | --- | --- |
| Fern default `tapered` | Accepted | Same triangle count as the comb. Count-1 hash stays `32a97877`. Pointed leaflets, open notches |
| `?pinnate=baseline` and `?pinnate=quilled` | Kept, not the default | Lane A rejected them as the shipped look. They stay recoverable and do not write the graph. Unknown values are ignored |
| Fan default `spray` plus the deeper leaf color | Accepted | Hash stays `0c41197f`. Blades stay inside hit radius `0.37`. Stem color stays `0x7c9a34` |
| `?fanLeaf=shared` and `?fanLeaf=separated` | Kept, not the default | `shared` is the old elliptic outline. `separated` is the narrower alternative Lane A rejected as the default. Color stays the accepted fan color |
| `variant-tapered-mild` | Not adopted | Lane A: not a live flag |
| Berry 12×8, `0xa63e56`, radius `0.078` | Accepted | Hash stays `0d768a64`. Radius stays under hit radius `0.145`. Protocol cost +1584 triangles on the count-1 twig |
| Larger berry (~radius `0.10`) | Rejected | Lane B: cluster centers can sit just over `0.12` apart |
| Tuft 8 columns; blossom scatter `0.22/0.09/0.08`; volume scatter `0.08/0.04/0.035` | Accepted | One instanced mesh per bloom. Hit radius stays `0.56`. `one-branch-v1` and `single-flower-v1` leave `tuftScatter` unset |
| Eight separate petal meshes | Rejected | Would break the one-mesh-per-bloom draw |
| Nodding sleeve (local Y `-0.052`) | Accepted | Same bell, same triangle count, hash `f4ed4497`. Hit radius `0.66` and `hitCenterY` `0.32` stay. A stem-center press still acquires the neck, on baseline and on this tip |
| `blossom-spray-v2`, fern rhythm v2, `foliage-fan-v2`, `flower-volume-v2` | Deferred | Not landed. Spacing, stored scale, and departure angles stay on the v1 graphs |
| Bend-station study (#48 / #36) | Out | Separate shaping study |
| Materials fade, chevron, scroll-to-pressed | Accepted | Cues are `pointer-events: none` and `aria-hidden`. Choosing fern frond leaves ordinal 0 and plant count 0 |

## Canonical identity

Seed 8278, count 1, and the imported arrangements. Hashes match the baseline capture on this machine and the published targets.

| Scene | Hash | Generator |
| --- | --- | --- |
| flowering-branch | `b81a82aa` | `one-branch-v1` |
| leafy-shoot | `6645d73a` | `leafy-shoot-v1` |
| bare-branch | `eae353f1` | `bare-branch-v1` |
| single-flower | `21619d02` | `single-flower-v1` |
| reed | `7a30da1d` | `reed-v1` |
| flower-volume | `5c6ba5af` | `flower-volume-v1` |
| arching-trailer | `d0ebb2e1` | `arching-trailer-v1` |
| foliage-fan | `0c41197f` | `foliage-fan-v1` |
| blossom-spray | `e313704c` | `blossom-spray-v1` |
| nodding-flower | `f4ed4497` | `nodding-flower-v1` |
| berry-twig | `0d768a64` | `berry-twig-v1` |
| fern-frond | `32a97877` | `fern-frond-v1` |
| Arrangement A, imported | `3b1e9ad9` | leafy, fern, fan |
| Arrangement B, imported | `1f7e3e94` | berry, blossom, volume, nodding |
| round5-palette ×12 | `6fd84a83` | one of each v1 |

Arrangement file: `artifacts/polish-baseline-arrangements.json`. Garden ids `b63160eb-bd11-4f91-bad9-654bd778160a` (A) and `5a03717a-b69d-4be6-8c1a-d09a1474d8a5` (B). Import reported "Imported 2 arrangements."

## Gallery

Headless Chrome 148.0.7778.96 on Linux, ANGLE SwiftShader (`SwiftShader Device (Subzero)`), WebGL2. CSS canvas 1280×800, drawing buffer 1280×800, device pixel ratio 1, window 1280×800. Not a phone.

Both passes used `tools/capture-polish-integration.mjs` against Vite. Before is a worktree at `2aef054` on port 5174. After is this branch on port 5173. Same Chrome, same viewport, same arrangement file.

Paths:

- `docs/development/reports/polish-integration/before/`
- `docs/development/reports/polish-integration/after/`

Front, three-quarter, and Above for all twelve count-1 specimens, both arrangements, and the round5-palette Front still. Affected materials: fern, fan, berry, blossom, volume, nodding.

## Cost

Same wrap as the polish baseline: `drawElements` / `drawArrays` before page scripts, mode 4 counted as triangles, vessel included, counters reset, one view click, three animation frames. Instanced draws are counted beside that wrap and are not added into it. The published baseline numbers (round5-palette 777/110010, Arrangement A 255/34414, Arrangement B 253/42090) are the protocol columns. No mesh was simplified to chase a count.

Front counts. Three-quarter and Above repeated them.

| Scene | Calls | Triangles before | Triangles after | Protocol delta | Instanced triangles before | After | Instanced delta |
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

The protocol +1584 is one berry twig: 9 shown fruits × 88 new triangles × 2 submissions. Palette +1760 is the palette's own berry twig (10 shown fruits, a later seed than 8278). Arrangement A has no berry, so its protocol count is unchanged. Fern and fan keep the old grids.

Instanced deltas are the tuft only. Eight columns replace six: +288 triangles per bloom, and the shadow submission doubles that to +576 in this counter. Seed 8278 volume has 5 blooms (+2880). Seed 8278 blossom has 6 (+3456). Arrangement B has 5 + 5 (+5760). Palette has 11 tufted blooms (+6336). Nodding's instanced count stays 3700, which is the vessel shadow, not the bell.

Flowering, leafy, bare, single flower, reed, and arching trailer match the baseline on calls, protocol triangles, and instanced triangles. Their leaves stay on the shared elliptic or lanceolate. The position-hash test still expects `8817a40c` and `d85a146d`.

## Twelve-material spot check

Shared leaf code did not move the other ten materials' graphs or their protocol meshes.

- Fern and fan changed outline only. Counts unchanged.
- Berry changed sphere density and color. Tuft and bell code did not add draws to it.
- Blossom and volume changed petal columns and instance matrices. Protocol counts unchanged because instanced draws are outside that wrap.
- Nodding changed vertex placement inside the same index count.
- The other six materials match the before pass exactly, including single-flower's open face (`21619d02`, 51 calls, 12166 triangles).

## Interaction

Headless Chrome, workbench, seed 8278, count 1, Front, fixed bead, Shape then Prune. Phone: not run. Log: `after/browser-capture.json`. Stills: `after/smoke-*.png`.

| Step | Fern `rachis` / `pinna-4` | Fan `stem` / `arm-opening` | Berry `wood` / `cluster-2` | Blossom `stem` / `group-2` | Volume `stem` / `group-2` | Nodding `stem` / `neck` |
| --- | --- | --- | --- | --- | --- | --- |
| Seated | `32a97877`, ordinal 1, stock `3.75022561246995` | `0c41197f`, ordinal 1, stock `2.6202256124699494` | `0d768a64`, ordinal 1 | `e313704c`, ordinal 1 | `5c6ba5af`, ordinal 1 | `f4ed4497`, ordinal 1, stock `2.3528913545235985` |
| Aim | `1d40c4fa`, stock unchanged | `340805b0`, stock unchanged | `7b471a45` | `555cd6c1` | `1b55eda1` | `66a128ee`, stock unchanged |
| Bend | `13f16a3a`, stock unchanged | `5001d224`, stock unchanged | `b4b1052b` | `68b12171` | `c2390df3` | `78e8213d`, stock unchanged |
| Preview | "Cut leaf stem / Tip + 1 leaf · release to cut" | "Cut branch / Tip + 1 attached stem, 1 leaf · release to cut" | "Cut branch / Tip + 2 attached stems, 2 berries · release to cut" | "Cut branch / Tip + 1 attached stem, 1 flower · release to cut" | "Cut flower stem / Tip + 1 flower · release to cut" | "Cut flower stem / Tip + 1 flower · release to cut" |
| Escape | hash unchanged, transaction cleared, no new save | same | same | same | same | same |
| Commit | `3b040b1a`, `pinna-blade-4` inactive, ordinal 1 | `007233d5`, `leaf-opening-3` inactive, ordinal 1 | `f87c8680`, berries `2-2` and `2-3` inactive, ordinal 1 | `0fda66d1`, `bloom-2-2` inactive, ordinal 1 | `a7c68609`, `bloom-5` inactive, ordinal 1 | `fd6d29db`, `bloom` inactive, ordinal 1 |
| Reload, Garden view, Garden copy | all `3b040b1a` | all `007233d5` | all `f87c8680` | all `0fda66d1` | all `a7c68609` | all `fd6d29db` |

The nodding stem sample at 0.55 still acquires `plant-1:neck` (operation aim). The same four probes on the baseline worktree returned the same operations and branches. The sleeve did not move that hit. A press about 40px above that sample aims the stem. Stock length stayed `2.3528913545235985` through aim and bend.

The fan press after the bend acquired the opening arm's leaf stalk and removed one leaf. That is the existing preference for a petiole near the arm sample. The stem stock stayed `2.6202256124699494`.

Picker, fresh session, hash `41418c67`: choosing fern frond sets the source card, closes the menu, leaves plant count 0 and ordinal 0. Reopening scrolls to `scrollTop` 253 with fern pressed and fully visible. At `scrollTop` 0 the below cue is shown, the above cue is hidden, and `elementFromPoint` on the fade hits `arching-trailer`, so the cue does not take the press. On the baseline build the cue elements are absent and the same click also inserts nothing.

Clip, 100 frames, about 12 seconds: `docs/development/reports/polish-integration/after/interaction-fern-fan.mp4`. Fern aim, prune preview, cancel, commit, then the fan. The smoke table is the hash record. The clip is the look.

## Verify

`npm ci && npm run verify` on the product integration, before the evidence commit. Node v22.14.0. `npm ci` added 63 packages. The evidence commit does not change `src/` or the bundle inputs.

| Check | Result |
| --- | --- |
| Typecheck | passed |
| Tests | 236 passed, 0 failed, 0 skipped |
| `dist/index.html` | 42122 bytes (baseline 41544) |
| `dist/assets/index-BfEkgxir.css` | 21247 bytes (baseline `index-BZXrXw7o.css` 19942) |
| `dist/assets/index-BMsVzBrE.js` | 702282 bytes (baseline `index-BqEN0oLZ.js` 696764) |
| `dist/assets/index-BMsVzBrE.js.map` | 3464298 bytes (baseline 3436037) |
| `dist/ikebana-web-alpha-standalone.html` | 909479 bytes (baseline 900016) |
| `validate-dist` | 5 files, standalone self-contained |

Baseline on this machine was built from `2aef054` for those byte counts. Main's suite was 229 tests. This tip adds five foliage presentation tests, one tuft-scatter test, and one materials-overflow test. `dist/` is not committed.

## Preview

GitHub Pages publishes `main` only. This branch is not that deploy. From a checkout of this branch:

```
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/?workbench=1&fresh=1`. Absent query flags are the accepted draws. Comparisons that do not write the graph:

- `?pinnate=baseline` — the earlier fern comb
- `?pinnate=tapered` — the accepted frond
- `?pinnate=quilled` — four narrower pairs
- `?fanLeaf=shared` — the earlier elliptic outline on the fan; the accepted leaf color stays
- `?fanLeaf=spray` — the accepted fan blade
- `?fanLeaf=separated` — the narrower fan blade

A self-contained file, for a machine without the dev server:

```
npm run build
```

Open `dist/ikebana-web-alpha-standalone.html` in the browser. The same query flags work on that file. `npm run verify` builds it and checks that it does not reach back to the network for its script or style.

Import `artifacts/polish-baseline-arrangements.json` from Garden to view Arrangement A (`3b1e9ad9`) and Arrangement B (`1f7e3e94`).

## Unresolved

- Phone: not run. Headless SwiftShader is not the phone card. The fade, the chevron, and large-text wrapping of the twelve labels were not held in a hand.
- Fern pinnae are still evenly spaced. That rhythm stays on `fern-frond-v1`.
- Blossom laterals still leave the stem at the stored angle. That joint stays on `blossom-spray-v1`.
- Berry centers can sit just over `0.12` apart while the diameter is `0.156` before organ scale. Fruits in a cluster can touch. They stay inside the hit proxy.
- The nodding sleeve is blue, because vertex colors multiply the bell material. The pedicel is still not a bend handle.
- The 0.55 sample on the nodding stem still prefers the neck. That was already true on `2aef054`.
- The opening-arm sample can still prefer one petiole. Grab nearer the arm base to cut the whole arm.
- Protocol triangle counts hide instanced tuft cost. The instanced column above is the one to use for that delta.
