# Lane A foliage polish

Presentation only. Behavioral contract: preserved. No generator, golden, stock length, ordinal, camera, or verb change. Physical phone: not run. Draft only: no merge, no deploy.

## Tip and model

| | |
| --- | --- |
| Product base | `2aef05424d751cda2137f3749b2d71e7fdf0c6d1` (main, confirmed at start) |
| Branch | `cursor/polish-lane-a-foliage-af43` |
| Run | https://cursor.com/agents/bc-6a00d98f-2dbe-5263-b458-ed092459af43 |

`cursor-cloud` run-info `originalModelName` is `grok-4.7`. The payload has no `thinking-budget` field and no `reasoning_effort` field. The launch text requested Grok 4.7 with reasoning effort high. This agent is Grok 4.7. No other model was substituted. That budget cannot be confirmed from the session record.

## What shipped

Canonical graphs are unchanged. Seed 8278 count 1 still hashes `32a97877` (fern) and `0c41197f` (fan). Arrangement A still hashes `3b1e9ad9`.

Accepted draws, selected when the query flags are absent:

- Fern pinna: `tapered`. Three pinnule pairs, pointed outlines, a short base pair, a longer middle pair, a small leaned tip pair, a slight costa hook and curl, and restrained per-pinna seed variation. Gaps stay empty triangles. Triangle count matches the old comb.
- Fan leaf: profile `spray` on `foliage-fan-v1` only. Broader, more pointed, more cupped elliptic, still inside the existing hit sphere (`hitRadius` 0.37, `hitCenterY` 0.247). Leaf color `0x3e6b38`, vein `0xd5e6a6`, roughness `0.74`. Stem color stays `0x7c9a34`, so the basal stem and the arm sections stay lighter than the blades. Form stays `elliptic`.

Recoverable paths (workbench or player URL; they do not write the graph):

| Query | What you see |
| --- | --- |
| `?pinnate=baseline` | The original three-pair comb |
| `?pinnate=tapered` | Accepted frond (also the default) |
| `?pinnate=quilled` | Four narrower pairs, more curl |
| `?fanLeaf=shared` | Original elliptic outline on the fan. The new leaf color, vein, and roughness still apply |
| `?fanLeaf=spray` | Accepted fan blade |
| `?fanLeaf=separated` | Narrower, more twisted blades |

Unknown values are ignored. The full pre-polish fan, including the old leaf hex `0x5a8a3c`, is the `before/` stills. `fanLeaf=shared` rolls the outline back and leaves the accepted color in place.

## Accepted, rejected, deferred

**Accepted.** `tapered` plus `spray` and the deeper fan leaf color. On the count-1 Front still the frond reads as pointed leaflets that lean toward each pinna tip, with a shorter base and a smaller tip, and the notches between leaflets stay open. One removed pinna and a shortened rachis still read as a missing feather and a shorter stem, because those are still one organ and one branch cut. The fan blades are wider and cupped enough to separate from each other and from the yellow-green stem, and the stem below the first arm is still bare.

**Rejected, still in the code.**

- `quilled`. Four pairs fill the pinna. At Front scale it is busier and less airy, closer to a textured bar. Fern count 1 goes from 16726 triangles to 18262. Same 91 draw calls. Stills: `variant-quilled/`.
- `separated`. Narrower twisted blades. They separate as strokes and give up the broader face that makes a leaf readable from Above. Stills: `variant-separated/` (old color) and `variant-separated-deep/` (accepted color). Arrangement Front: `variant-arrangement-separated/`.
- Color alone on the old elliptic (`variant-fan-color/`). The blades stay the same ovals. The color change is part of the accepted fan, together with `spray`.
- Milder taper (`variant-tapered-mild/`). First pass. The size gradient was still too even, so it is not a live flag. The current `tapered` flag is the stronger gradient in `candidate/`.

**Deferred generator proposal.** Do not land this inside `fern-frond-v1` or `foliage-fan-v1`.

The eight pinnae are still attached at `0.3 + index * 0.082` with the existing organ scales. That even rhythm is the comb that remains at arrangement scale. Changing spacing, count, or stored scale is a new generator version and a new golden. Same for the fan: arm lengths and leaf scales `0.62`–`0.78` stay. A larger stored leaf would be `foliage-fan-v2`. This pass did not open that version.

## Gallery

Headless Chrome 148 on Linux, ANGLE SwiftShader, WebGL2. CSS canvas 1280×800, drawing buffer 1280×800, device pixel ratio 1, window 1280×800. Full-page PNG. Not a phone.

Matched scenes: workbench count 1, seed 8278, and Garden Arrangement A imported from `artifacts/polish-baseline-arrangements.json` (copied from branch `cursor/polish-baseline-evidence-8602`). Garden id `b63160eb-bd11-4f91-bad9-654bd778160a`, kept hash `3b1e9ad9`. Seats: leafy 8278, fern 9255 with `pinna-blade-4` inactive, fan 10232.

Paths are under `docs/development/reports/polish-lane-a-foliage/`.

| | Front | Three-quarter | Above |
| --- | --- | --- | --- |
| Fern before | `before/fern-frond-seed8278-count1-front.png` | `before/fern-frond-seed8278-count1-three-quarter.png` | `before/fern-frond-seed8278-count1-above.png` |
| Fern accepted | `candidate/fern-frond-seed8278-count1-front.png` | `candidate/fern-frond-seed8278-count1-three-quarter.png` | `candidate/fern-frond-seed8278-count1-above.png` |
| Fan before | `before/foliage-fan-seed8278-count1-front.png` | `before/foliage-fan-seed8278-count1-three-quarter.png` | `before/foliage-fan-seed8278-count1-above.png` |
| Fan accepted | `candidate/foliage-fan-seed8278-count1-front.png` | `candidate/foliage-fan-seed8278-count1-three-quarter.png` | `candidate/foliage-fan-seed8278-count1-above.png` |
| Arrangement A before | `before/arrangement-a-leafy-fern-fan-front.png` | `before/arrangement-a-leafy-fern-fan-three-quarter.png` | `before/arrangement-a-leafy-fern-fan-above.png` |
| Arrangement A accepted | `candidate/arrangement-a-leafy-fern-fan-front.png` | `candidate/arrangement-a-leafy-fern-fan-three-quarter.png` | `candidate/arrangement-a-leafy-fern-fan-above.png` |

`?pinnate=baseline&fanLeaf=shared` captured before the fan color change is pixel-identical to `before/` for both count-1 Front stills (`variant-baseline/`). Leafy shoot, flowering branch, and arching trailer Front stills in `candidate/` are pixel-identical to `before/`.

## Cost

Same wrap as the polish baseline: `drawElements` / `drawArrays` before page scripts, mode 4 counted as triangles, counters reset, one view click, three animation frames. Vessel included. These are resource counts, not FPS and not phone frame time.

| Scene | Hash | Calls | Triangles | Delta vs before |
| --- | --- | --- | --- | --- |
| fern-frond ×1, seed 8278 | `32a97877` | 91 | 16726 | 0 calls, 0 triangles |
| foliage-fan ×1, seed 8278 | `0c41197f` | 103 | 16134 | 0 calls, 0 triangles |
| Arrangement A | `3b1e9ad9` | 255 | 34414 | 0 calls, 0 triangles |
| leafy-shoot ×1 | `6645d73a` | 81 | 14034 | unchanged |
| flowering-branch ×1 | `b81a82aa` | 153 | 26042 | unchanged |
| arching-trailer ×1 | `d0ebb2e1` | 41 | 10058 | unchanged |
| quilled fern ×1 (not shipped) | `32a97877` | 91 | 18262 | 0 calls, +1536 triangles |

Accepted fern and fan keep the old mesh topology (312 triangles on a pinna, the elliptic 208-triangle grid on a fan leaf). The extra code is vertex placement. Shared elliptic and lanceolate position hashes at seed 8278 stay `8817a40c` and `d85a146d`.

## Interaction

Headless Chrome, workbench, seed 8278, count 1, Front, fixed bead. Phone: not run.

| Step | Fern | Fan |
| --- | --- | --- |
| Load | hash `32a97877`, ordinal 1 | hash `0c41197f`, ordinal 1 |
| Aim | pinna 3, hash `1069f03c`, ordinal 1 | stem, hash `90fbf98a`, rest length stayed `2.6202256124699494` |
| Bend | second grab on the rachis, operation `bend`, hash `92aa9f8e`, rest and active length stayed `3.75022561246995`, ordinal 1 | second grab on the stem, operation `bend`, hash `c3024a34`, rest length unchanged, ordinal 1 |
| Prune preview | pinna 4, cue “Cut leaf stem / Tip + 1 leaf · release to cut”, hash unchanged, no new save | opening arm, cue “Cut branch / Tip + 3 attached stems, 3 leaves · release to cut”, hash unchanged |
| Escape | hash unchanged, no new save | hash unchanged, `fanCancelAddedSave: false` |
| Commit | `pinna-blade-4` inactive, 8 organs remain, hash `05b5752d`, ordinal 1 | three opening leaves inactive, opening `activeLength` `0.42676371890049347`, 8 organs and 12 branches remain, hash `9c4b8f77`, ordinal 1 |
| Reload without `fresh=1` | `05b5752d` | leaf-cut hash `48335719` matched on the first pass |
| Garden Keep / View / Copy | viewed and copied `05b5752d` | viewed and copied `48335719` on the leaf-cut pass |

The 0.55 screen sample on the opening arm still acquires `petiole-opening-1` and cuts one leaf. That was already true on main. A point about a third of the way from the stem sample toward that arm sample acquires the arm and removes its three leaves. Records stay.

Clip, about 10 seconds, the first pass (fern aim, pinna preview and commit, fan aim, bend, one-leaf prune): `docs/development/reports/polish-lane-a-foliage/exercise/interaction-fern-fan.mp4`. Bend and arm-cut numbers: `exercise/bend-and-arm.json`. Step log: `exercise/exercise.json`.

## Verify

`npm ci && npm run verify` on this branch. Node v22.14.0. `npm ci` added 63 packages.

| Check | Result |
| --- | --- |
| Typecheck | passed |
| Tests | 234 passed, 0 failed, 0 skipped (baseline tip was 229; five new presentation tests) |
| `dist/index.html` | 41544 bytes |
| `dist/assets/index-BZXrXw7o.css` | 19942 bytes |
| `dist/assets/index-DUOMHedU.js` | 700504 bytes |
| `dist/assets/index-DUOMHedU.js.map` | 3455699 bytes |
| `dist/ikebana-web-alpha-standalone.html` | 905250 bytes |
| `validate-dist` | 5 files, standalone self-contained |

CSS and `index.html` byte sizes match the baseline tip. The JS bundle grew by 3740 bytes. `dist/` is not committed.

## Integrator

Shared rendering extension, presentation only:

- `createLeafGeometry` / `createLeafVeinGeometry` take an optional third argument, `LeafDrawOptions`.
- `PinnateDraw`: `baseline`, `tapered` (accepted), `quilled`.
- `FanLeafDraw`: `shared`, `spray` (accepted for the fan), `separated`. Only `foliage-fan-v1` receives a fan profile. Other elliptics stay on `leafSample`.
- `MaterialAppearance.leaf.profile` is optional. The fan sets `spray`.
- `ThreeStudio` options `pinnateDraw` and `fanLeafDraw` override those draws.
- `readExperimentConfig` reads `pinnate` and `fanLeaf`.

Geometry names stay `living-line/pinnate-pinna`, `living-line/pinnate-costa`, and `living-line/creased-leaf`. Hit radii are unchanged. No `src/core/` edit.

## Unresolved

- Phone: not run. Headless SwiftShader is not the phone card.
- The eight pinnae are still evenly spaced. That rhythm is the deferred `fern-frond-v2` proposal above.
- From Above, fan blades are still a thin spread over the bowl. `spray` widens each face inside the existing proxy. It does not turn the fan into a second leafy shoot.
- The opening-arm sample at mid-length still prefers a petiole. Grab nearer the arm base to cut the whole arm.
- `variant-tapered-mild/` is an intermediate capture and does not match a current query flag.
