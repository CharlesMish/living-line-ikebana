# Polish lane B — flowers and berries

Presentation polish only. Draft. No merge, no deploy, no new material type, no new generator version. Behavioral contract: preserved. Physical phone: not run.

## Tip

| | |
| --- | --- |
| Start tip | `2aef05424d751cda2137f3749b2d71e7fdf0c6d1` |
| `origin/main` at this pass | same SHA |
| Branch | `cursor/polish-lane-b-flowers-c19a` |
| Baseline evidence | PR #46 `cursor/polish-baseline-evidence-8602`, read-only. Arrangement B Garden id `5a03717a-b69d-4be6-8c1a-d09a1474d8a5`, kept hash `1f7e3e94` |

Canonical graphs, goldens, organ scale, stock length, cameras, verbs, ordinals, and Garden semantics are unchanged. Intact specimen hashes and the Arrangement B hash match the baseline.

## Model

This run is https://cursor.com/agents/bc-d23d3a4b-8184-51b0-92f7-6292e46ec19a.

`cursor-cloud` run-info `originalModelName` is `grok-4.7`. The payload has no `thinking-budget` field and no `reasoning_effort` field. The launch text requested Grok 4.7 with reasoning effort high. This agent is Grok 4.7. No other model was substituted. That budget cannot be confirmed from the session record.

## What changed

Shared renderer only. `src/core/` is untouched.

| Material | Accepted presentation | Left alone |
| --- | --- | --- |
| Berry twig | One fruit: color `0xa63e56`, roughness `0.3`, radius `0.078`, 12×8 sphere (168 triangles), brighter crown in the vertex colors. Hit radius stays `0.145`, center stays local Y `0.055` | Wood colors, pedicel length, cluster spacing, graph |
| Blossom spray | Same tufted petal, sampled with 8 columns instead of 6. Instance scatter azimuth `0.22`, scale `0.09`, tilt `0.08`. Still one instanced mesh per bloom. Hit radius stays `0.56` | Stem and lateral angles, organ scale, pale color |
| Flower volume | Same 8-column tuft. Smaller scatter: azimuth `0.08`, scale `0.04`, tilt `0.035`. Hit radius stays `0.56` | Five-group head, dusty rose, leaves |
| Nodding flower | The existing bell shell starts a short sleeve behind the attachment (local Y `-0.052`, radius about `0.017`). Same triangle count. Hit radius `0.66` and `hitCenterY` `0.32` stay | Neck curve, pedicel kind, leaf, open-face single flower |

Cupped, open-face, lanceolate, elliptic, and pinnate paths do not read `tuftScatter`. `one-branch-v1` and `single-flower-v1` leave that field unset. A single-flower still was not captured; that mesh function was not edited, and the open-face extent test still passes.

Berry surface vertices stay inside the unchanged hit sphere, and the fruit center stays on the hit center. Tuft vertices, after scatter, stay inside radius `0.56`. The existing proxy-contains-surface test still passes for every registered material, including the bell sleeve.

## Before / after

Headless Chrome 148 on Linux, ANGLE SwiftShader. CSS canvas 1280×800, drawing buffer 1280×800, `devicePixelRatio` 1. Workbench `?workbench=1&test=1`, `fresh=1` for a clean bowl. Fixed bead. Not a phone.

Script: `tools/capture-polish-lane-b.mjs`. Draw counts use the baseline wrap: `drawElements` / `drawArrays` only, mode 4 counted as triangles, vessel included, counters reset, then one view click, then three animation frames. `InstancedMesh` submits `drawElementsInstanced`, which that wrap does not see. Tuft cost is reported separately below.

Matched stills, seed **8278**, count 1, and Arrangement B imported from the baseline Garden file:

`docs/development/reports/polish-lane-b/before/`
`docs/development/reports/polish-lane-b/after/`

Flower-volume orbit is a Step Back drag, 28 frames at 12 fps, about 2.3 seconds:

`docs/development/reports/polish-lane-b/before/flower-volume-seed8278-count1-orbit.mp4`
`docs/development/reports/polish-lane-b/after/flower-volume-seed8278-count1-orbit.mp4`

| Scene | Hash | Calls before = after | Triangles before | Triangles after | Protocol delta |
| --- | --- | --- | --- | --- | --- |
| berry-twig × 1 | `0d768a64` | 95 | 14338 | 15922 | +1584 |
| blossom-spray × 1 | `e313704c` | 83 | 17998 | 17998 | 0 |
| flower-volume × 1 | `5c6ba5af` | 81 | 16734 | 16734 | 0 |
| nodding-flower × 1 | `f4ed4497` | 29 | 12302 | 12302 | 0 |
| Arrangement B, Garden view | `1f7e3e94` | 253 | 42090 | 43674 | +1584 |

Front, three-quarter, and Above repeated those counts. Arrangement B seats: berry `plant-1` seed 8278, blossom `plant-2` seed 9255 (5 organs), flower volume `plant-3` seed 10232, nodding `plant-4` seed 11209. Ordinal 4. The after import in the same Chrome profile reported “Imported 0 arrangements” because the before run had already stored the file; View still opened hash `1f7e3e94`.

The +1584 is the berry only: 9 fruits × 88 new triangles × 2 submissions (color and shadow). Arrangement B moves by the same 1584, which is the check that the tuft and bell edits did not show up in this wrap.

Mesh census, shadows and the vessel excluded, instances multiplied. Draws stay 22 intact, 16 after the cluster-2 prune, and 273 across twelve berry twigs.

| Census | Before | After |
| --- | --- | --- |
| Berry twig, 9 shown fruits | 2200 | 2992 |
| Same twig, cluster 2 hidden (6 shown) | 1620 | 2148 |
| Twelve berry twigs | 27060 | 37004 |
| One tuft (8 petals) | 864 | 1152 |

The tufted blade is 10 rows. Six columns were 108 triangles per petal; eight columns are 144. Eight instances: +288 per bloom. Seed 8278 blossom has 6 blooms (+1728). Flower volume has 5 (+1440). Arrangement B has 5 blossom blooms and 5 volume blooms (+2880) in addition to the protocol berry delta. Shadow submission of those instanced triangles is extra GPU work the baseline counter never included, before or after. Nodding index count is unchanged (1888 triangles, 961 vertices).

## Accepted

**Berries.** The baseline stills read as dark dots, especially from Above, on an 8×6 sphere. The accepted pass lightens the fruit against the wood (`0x8a2e45` roughness `0.4` radius `0.07` → `0xa63e56` roughness `0.3` radius `0.078`), lifts the crown vertex color, and replaces the faceted sphere with 12×8. Radius `0.078` is still under the hit radius `0.145`. Clusters stay clusters. They are not enlarged into beads the size of a flower head.

**Blossom spray.** The repeated look was one identical eight-petal stamp, rotated by exact eighths, on a coarse blade. Wider scatter plus two extra columns breaks that stamp. Separated accents stay pale tufts on a thin green line. The sharp lateral departure is still the stored graph.

**Flower volume.** The same blade change, with a smaller scatter than the spray, so an orbit does not strobe a perfect gear and the five tufts still read as one head. Charlie’s note that the head is more convincing in motion is consistent with the orbit clip: the mass holds together while the outline is less regular than the before frames.

**Nodding flower.** The bell used to begin as a point on the pedicel tip (radius `0.015`) while the shell jumped outward. The sleeve is the same shell, behind that attachment, slightly wider than the pedicel once organ scale (about 1.06–1.16) is applied. It is not a second mesh and not a floating sepal. The neck is still a pedicel, so it is still not a bend handle.

## Rejected

- A larger fruit, around radius `0.10` or more. Berry centers in one cluster are only required to stay more than `0.12` apart. A much larger sphere fuses the cluster into one bead. Not built.
- Eight separate petal meshes per tuft. The spray test requires one instanced mesh per bloom and fewer draws than eight petals. Scatter stays in the instance matrix.
- Editing `blossom-spray-v1` departure angles inside this pass. That rewrites points, the golden, and any stored spray. See the deferred proposal.
- Leaving the 8×6 berry. At a zoom the facets were part of the hard silhouette. The 12×8 cost is the +1584 above, accepted with that number recorded.

## Deferred versioning proposal

Do not ship this as a silent generator edit.

`blossom-spray-v2` would be the place to soften the lateral departure. Today `directionFromParent` is called with a steep pitch (`0.9`) and the lateral is an 8-point `makeChain`. The joint is canonical geometry. A v2 would keep `blossom-spray-v1` and `fixtures/plant-1-blossom-spray-v1.json` loadable, register the new version additively, and retake the golden only for the new id. Stored bowls on v1 would not be rewritten.

Flower-volume repetition of five similar groups is also graph structure. This pass only scatters the rebuildable petal matrices. A denser or less regular head would be `flower-volume-v2`, same rule: v1 stays, including fixture `fixtures/plant-1-flower-volume-v1.json`.

Nodding attachment beyond the sleeve — a neck the player can bend — would change branch kind or the bend-target law. That is a contract change, not a polish of this shell.

## Interaction smoke

Same browser, count 1, seed 8278, Front, fixed bead, Shape then Prune. Stills under `docs/development/reports/polish-lane-b/smoke/`. Unit tests already cover cancelled prune writing nothing; this pass checks the live hashes.

| Step | Berry `plant-1:wood` / prune `plant-1:cluster-2` | Blossom `plant-1:stem` / `plant-1:group-2` | Volume `plant-1:stem` / `plant-1:group-2` | Nodding `plant-1:stem` / `plant-1:neck` |
| --- | --- | --- | --- | --- |
| Seated | `0d768a64` | `e313704c` | `5c6ba5af` | `f4ed4497` |
| Aim | acquired, hash `9fd75a98` | `81b56b19` | `f9081463` | `fec1a404` |
| Bend | acquired, hash `b25f83d5` | `1f47613f` | `b0796cd7` | `5bad3850` |
| Preview | “Cut branch / Tip + 2 attached stems, 2 berries”, hash stayed | “Cut branch / Tip + 1 attached stem, 1 flower”, hash stayed | “Cut flower stem / Tip + 1 flower”, hash stayed | “Cut flower stem / Tip + 1 flower”, hash stayed |
| Escape | transaction cleared, hash stayed | same | same | same |
| Commit | `22801613`, ordinal 1 | `7d054682`, ordinal 1 | `06589c4f`, ordinal 1 | `afc3b15a`, ordinal 1 |
| Reload without `fresh=1` | `22801613` | `7d054682` | `06589c4f` | `afc3b15a` |
| Garden view | same hash | same | same | same |
| Garden copy via Replace | same hash | same | same | same |

The berry press is the screen target near the middle of `cluster-2`, so the ordinary distal plan removes two berries and leaves the inner one. That matches the existing berry-twig cut, not a new pluck tool. The blossom press on `group-2` removes one distal flower, not the whole lateral. Ordinals stay 1.

## Verify

`npm ci` at the start of this run added 63 packages. Lockfile unchanged after that. `npm run verify` on the polished tree. Node v22.14.0.

| Check | Result |
| --- | --- |
| Typecheck | passed |
| Tests | 230 passed, 0 failed, 0 skipped |
| `dist/index.html` | 41544 bytes |
| `dist/assets/index-BZXrXw7o.css` | 19942 bytes |
| `dist/assets/index-DppalvUH.js` | 697352 bytes |
| `dist/assets/index-DppalvUH.js.map` | 3439508 bytes |
| `dist/ikebana-web-alpha-standalone.html` | 900841 bytes |
| `validate-dist` | 5 files, standalone self-contained |

Baseline on this tip was 229 tests and `index-BqEN0oLZ.js` at 696764 bytes, standalone 900016 bytes. HTML and CSS byte sizes are unchanged. The extra test is the tuft-scatter bound. `dist/` is not committed.

## Issues

1. Blossom laterals still leave the stem at a sharp stored angle. The petal stamp is less repetitive. The joint is the deferred v2.
2. Berry centers can sit just over `0.12` apart while the new diameter is `0.156` before organ scale. Fruits in a cluster can touch. They stay smaller than the hit proxy and smaller than a bloom.
3. The nodding sleeve is blue, because vertex colors multiply the bell material and cannot repaint the cuff green. Overlap is the attachment. The pedicel is still not bendable.
4. Protocol triangle counts hide instanced tuft cost. The census table is the one to use for that delta.
5. Physical phone: not run. No narrow-viewport pass, no large-text pass, no Safari chrome, no touch ownership.
