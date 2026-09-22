# Independent Round 3 materials review

- Candidate: integrated lanes A, B, and C on draft PR #28
- Baseline: `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37`
- Head reviewed: `edfee16085106caece50a41311806911baffb94d`
- Branch reviewed: `cursor/round3-material-integration-360f`
- Parents preserved on that branch: reed #23 `60751b242aaee2c3dbf4aa0a690e171d07da646e`, flower volume #25 `5be5dc5b228d16498d7f00cd85c44a802f6079f4`, arching trailer #26 `5615a3b0e35314b1ffdfc33a1a1df9ed30501b3b`
- Independent reviewer: this session. Lanes A/B/C and the integration writeup were not authored here.
- Requested model: Grok 4.7 high thinking. Exposed run identity: `grok-4.7` (`originalModelName` on this cloud run). No separate thinking-budget field was exposed.
- Contract: preserved. This review does not revise it.

## Recommendation

**Pass.**

The three cuttings are registered additively, under their own names, and the frozen comparison scenes still mean what they meant. `one-branch-v1` and the flowering / leafy goldens are byte-identical to the baseline. Transactions, ordinals, inactive history, save, and Garden isolation behaved as the contract requires in a headless exercise on this head. Flower-volume pruning still removes one group and leaves the other organ records in the graph. Draw-call counts match the integration report and still track per-branch and per-organ meshes.

Accept this as the Round 3 materials draft. Leave the phone card open. This pass is not a feel sign-off, and it is not a merge.

Out of scope, recorded only so the boundary stays visible: Lane D facing diagnosis #27 and experimental roll #29, and Lane E Garden compare #24.

## Findings

Ordered by severity. None of these is a graph-correctness failure.

### 1. Evidence gap — physical phone was not run

Severity: evidence gap. It blocks a phone-feel sign-off. It does not block this draft.

No iPhone, no Safari, no real touch. The field card in `tests/browser/PHONE_WEB_TEST_CARD.md` is still the bar for first-try acquisition, cancellation, and Step Back ownership. Headless Chrome on Linux (SwiftShader, device pixel ratio 1) cannot stand in for that.

What the phone card still has to answer, on this build:

- Whether a finger can acquire the reed. Visible radius is `0.024`. The shared trunk hit tube is `max(radius × 2.8, 0.22)`, the same floor as every other trunk.
- Whether a finger can pick one flower-volume group when the stem tube sits in the same pixels. Desktop could, from an offset (finding 3).
- Whether a thumb can scroll the Materials list to Arching trailer and still drag only the one selected card.
- Whether an iOS interruption during prune preview rolls back and leaves the ordinal alone.

### 2. Correction — the integration note names the wrong CSS rule for the narrow menu

Severity: documentation. One sentence in `docs/development/REVIEW_round3-integration.md`.

That note says that at `max-width: 360px` the menu max-height is `min(12rem, 100dvh - 5.5rem)`. The 12rem rule in `src/styles.css` is `@media (max-height: 430px) and (orientation: landscape)`. Portrait 320 and 390 use the shared `.material-options` cap, `min(18rem, 50dvh)`.

Measured on this head, headless Chrome, device pixel ratio 1:

| Window | Computed `max-height` | Panel client / scroll | Fully visible at scroll 0 | Fully visible after scroll to end |
| --- | --- | --- | --- | --- |
| 320×568 | 284px | 282 / 319 | six names; Arching trailer clipped | six names; Flowering branch clipped |
| 390×844 | 288px | 286 / 319 | six names; Arching trailer clipped | six names; Flowering branch clipped |

284px is `50dvh` of 568. 288px is `18rem`. Both match `min(18rem, 50dvh)`. The integrator’s overflow of about one row matches this measurement (their 320 client 282 / scroll 319, and 390 client 286 / scroll 319). The rail stayed one selected card: 320 rail about 304×191 CSS px, 390 rail about 374×180 CSS px. Below 640px the row silhouettes stay hidden, which is the existing rule. The list scrolls (`overflow-y: auto`, `touch-action: pan-y`).

No CSS change follows from this review. Correct the sentence so a later pass does not edit the wrong query.

### 3. Observation — a flower-volume group is acquirable, and the stem occupies the naive sample

Severity: observation. Already disclosed by the integrator. Reproduced here. No change requested.

Player bowl, Front, CSS 1280×800, drawing buffer 1280×800, `?bend=touch`. `plant-2` is `flower-volume-v1`, seed 9255. Samples near the projected midpoints hit `plant-1:culm`, `plant-2:group-4`, and `plant-2:stem` before `plant-2:group-2` at about (630, 263).

At that point, Prune preview held canonical hash `d0095fa7`. Escape restored it. Release committed. `bloom-2` became inactive. Blooms 1, 3, 4, and 5 and both leaves stayed active. Branch count stayed 8. Organ count stayed 7. `group-2` active length changed from `0.3240643220022321` to `0.242885691922546` and still equalled its rest sum. The shortened pedicel stayed an active record. Autosave count went from 5 to 6 on the commit and did not move on the cancelled preview.

A later Shape drag acquired aim on `plant-2:group-1` and left the hash unchanged. A following drag acquired aim on `plant-2:stem`, changed the hash, and left the stem active length equal to its rest sum `4.45788213011343`. Pedicels stayed outside bend, which is the shared law.

Workbench `flower-volume` × 1 still reports 8 branch visuals and 7 organ visuals. × 12 reports 96 and 84. The tufted head is one instanced petal mesh per bloom organ. The groups were not collapsed into one mesh.

### 4. Observation — the trailer’s rest arch clears the water; a bend may still leave the bowl

Severity: observation. The limit is the shared solver, which has no bowl collision. No collision change requested.

Workbench `arching-trailer` × 1, seed 8278, centered seat. Lowest trail sample over the open water (radial distance 1.34–2.345) was y `0.6592455569142476` at radius `2.326969748107764`. Clearance above the water disc (y `0.46`) after the cane radius `0.031` is `0.168`. That matches the clearance already published on the lane C review.

In the player bowl, Shape on `plant-3:trail` (seed 10232) acquired aim, then bend. Active length stayed `2.9931997278562616`, equal to the rest sum. This session did not remeasure the saturated downward tip. Lane C’s published tip-through-water and tip-through-floor figures remain that measurement.

### 5. Observation — at count 6 the dynamic catalog currently assigns the same cuttings as `round3-palette`

Severity: informational.

`all-registered-materials` is still the live catalog. `round3-palette` is an explicit seven-id list. On this catalog those sequences are the same, so count 6 of each is one flowering, one leafy, one bare, one single-flower, one reed, and one flower-volume, and the report warns that the count omits `arching-trailer`. Both scenes measured 269 calls, 46846 triangles, 201 geometries, 41 branch visuals, 27 organ visuals. A later registered material would move only the dynamic profile.

`reference-pair` × 6 stayed flowering / leafy / flowering / leafy / flowering / leafy. `all-four` × 6 stayed flowering / leafy / bare / single-flower / flowering / leafy, with the existing 2+2+1+1 warning.

## Corrections for the integrator

1. In `docs/development/REVIEW_round3-integration.md`, replace the `max-width: 360px` / `12rem` attribution with the landscape query and the shared `min(18rem, 50dvh)` cap. The measured overflow can stay.

No generator, transaction, catalog, or stylesheet change.

## Evidence

Automated and browser rows are from this session on `edfee16085106caece50a41311806911baffb94d`. Phone is a separate row because it was not run.

| Check | Result | Reproduction |
| --- | --- | --- |
| `npm ci` and `npm run verify` | pass | `npm ci` added 63 packages. `npm run verify` exit 0. Typecheck clean. **166 tests, 0 failed.** Vite build wrote `dist/ikebana-web-alpha-standalone.html`. `tools/validate-dist.mjs` reported the distribution valid. |
| `reference-pair` and `all-four` meanings | pass | `workbenchProfiles.ts` still lists `reference-pair` as flowering → leafy and `all-four` as flowering → leafy → bare → single-flower. `mixed` still resolves to `reference-pair`. Browser load, seed 8278, count 6, produced those generator sequences. New ids sit after `all-four`: `references-plus-reed`, `references-plus-flower-volume`, `references-plus-arching-trailer`, `round3-three`, `round3-palette`. |
| Golden fixtures | pass | Blob hashes equal baseline for `fixtures/plant-1-one-branch-v1.json` (`d701ac62…`), `fixtures/plant-2-leafy-shoot-v1.json` (`363993c9…`), `fixtures/plant-1-bare-branch-v1.json`, `fixtures/plant-1-single-flower-v1.json`, and `fixtures/plant-graph.schema.json`. The diff adds `plant-1-reed-v1.json`, `plant-1-flower-volume-v1.json`, and `plant-1-arching-trailer-v1.json`. |
| Insert reed / flower-volume / trailer | pass | Pointer-drag, status “Over the pins.”, release on the pin field. Ordinals 1, 2, 3. `reed-v1` seed 8278 (1 branch, 0 organs), `flower-volume-v1` seed 9255 (8 / 7), `arching-trailer-v1` seed 10232 (4 / 3). Render inventory listed every branch and organ id. |
| Invalid insert | pass | Release off the pins: status “Returned to the tray.” Ordinal unchanged. Canonical hash unchanged. Autosave write count unchanged. |
| Aim / bend keep stock | pass | Reed culm aim, then bend. Length stayed `4.671155800740235`. Trailer cane aim, then bend. Length stayed `2.9931997278562616`. Flower stem aim kept `4.45788213011343`. |
| Flower-volume prune preview / cancel / commit | pass | See finding 3. One group, one bloom, records retained. |
| Reload after commit | pass | Reload without `fresh` matched the edited player hash and ordinal 3. After the Garden copy was pruned again, reload matched that copy and differed from the kept entry. |
| Garden Keep → View → Copy | pass | Keep titled “Independent review keep” (3 plants). View posture `step-back`. View hash matched the keep. A Step Back pan left that hash unchanged and moved the camera hash. “Make a working copy” then “Replace without keeping” reproduced the keep. A later prune committed on `plant-2:petiole-2`. The stored Garden entry’s arrangement JSON was unchanged. |
| Step Back is not a plant edit | pass | Arrange → Step Back, drag. Transaction `camera`. Canonical hash unchanged. Ordinal unchanged. |
| Workbench / player storage | pass | After the player Keep, `?workbench=1` on the same origin still had the player Garden title, and `ikebana-web-alpha:workbench-garden-v1` and `ikebana-web-alpha:workbench-studio-v1` were unset. A second Keep inside the workbench, then a return to the player, was not repeated. |
| Front composition | pass (desktop stills plus this session’s loads) | Repeated reeds read as separate vertical strokes (`reeds-front.png`, and a Front load of reed × 6 here). Flower-volume head is one clustered crown (`flower-volume-intact-front.png`; prune preview and cancelled frames still show the crown; pruned frame shows the opened group). Trailer crosses the water in `trailer-front.png` and `trailer-with-references-above.png`. `round3-three` × 6 is two reeds, two flower volumes, two trailers (`mixed-round3-three-front.png` and the ¾ / Above pair). |
| Narrow 320 / 390 Materials | pass, with finding 2 | Seven choice ids present. One source card. Seventh row needs a short scroll. |
| Physical phone | not run | No device, no Safari, no touch recording. |

`src/core/` still has no Three.js import. The presentation diff adds a `tufted` bloom form and, inside that one organ, an instanced petal mesh. Cupped and open-face petals still go through `createPetalGeometry` and `createOpenFacePetalGeometry`.

## Rendering comparison

Browser: Headless Chrome 148 (`Mozilla/5.0 … HeadlessChrome/148.0.0.0`), Linux, SwiftShader (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`). CSS viewport 1280×800 from the canvas client rect. Browser window inner size 1280×800. Drawing buffer 1280×800. Device pixel ratio 1. Renderer pixel ratio 1. Renderer cap 1.8.

Same seed 8278, Front, and those pixel conditions. Numbers are one workbench report’s `getRendererStats()` after the fixture load. They are resource counts from one render. No frame time was measured. They are not a phone measurement.

| Scene | Calls | Triangles | Geometries | Branch visuals | Organ visuals | Match to `renderer-comparison.json` |
| --- | --- | --- | --- | --- | --- | --- |
| `reference-pair` × 6 | 463 | 65078 | 343 | 69 | 51 | exact |
| `all-four` × 6 | 356 | 52414 | 264 | 55 | 37 | exact |
| reed × 6 | 25 | 12218 | 19 | 6 | 0 | exact |
| flower-volume × 1 | 69 | 20330 | 54 | 8 | 7 | exact |
| flower-volume × 12 | 751 | 161570 | 571 | 96 | 84 | exact |
| arching-trailer × 1 | 31 | 10462 | 24 | 4 | 3 | exact |
| `references-plus-arching-trailer` × 6 | 359 | 51826 | 265 | 54 | 40 | exact |
| `round3-three` × 6 | 185 | 40690 | 139 | 26 | 20 | exact |
| `round3-palette` × 6 | 269 | 46846 | 201 | 41 | 27 | exact |

`round3-three` × 6 stays under `all-four` × 6 because two reeds and two trailers stand where the baseline has more flowering and leafy organ meshes. Flower-volume × 12 is the heavy scene because each plant is still 8 branch visuals and 7 organ visuals. Collapsing a head into one mesh would drop the count and would also drop the per-group prune. That collapse is absent.

Textures were 2 on these reports. Programs were in the same band as the published file (the integration note’s table does not list programs on every row). No GPU timing was taken.

## What each cutting is doing on this head

Catalog order is the four established cuttings, then `reed`, `flower-volume`, `arching-trailer`. Saved graphs store `generatorVersion`.

- Reed / `reed-v1`: one 16-segment culm, radius `0.024`, stiffness `0.56`, no organs. Six copies at seed 8278 are a set of separated verticals. One bend arcs the acquired culm and leaves its length alone.
- Flower volume / `flower-volume-v1`: one stem, two leaves, five pedicel groups, one tufted bloom each. Pruning one group deactivates that bloom.
- Arching trailer / `arching-trailer-v1`: one authored rest cubic, three leaves on the descending limb, cane stiffness `0.50`. The centered rest pose clears the water by about 0.168 after radius. The bend model can still carry the cane out of the bowl.
