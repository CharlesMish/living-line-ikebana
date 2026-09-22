# Round 3 material integration

- Role: sole material integration of lanes A, B, and C
- Baseline: `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37` (main with #19 and #22)
- Branch: `cursor/round3-material-integration-360f`
- Draft PR: https://github.com/CharlesMish/living-line-ikebana/pull/28
- Candidate heads, preserved and merged onto this branch: reed #23 `60751b242aaee2c3dbf4aa0a690e171d07da646e`, flower volume #25 `5be5dc5b228d16498d7f00cd85c44a802f6079f4`, arching trailer #26 `5615a3b0e35314b1ffdfc33a1a1df9ed30501b3b`
- Facing prototype (Lane D) and Garden compare (Lane E) are absent from this branch
- Requested model: Grok 4.7 high thinking. Exposed session identity: Grok 4.7. No separate thinking-budget field was exposed.
- Contract: preserved. Section 1 now names the three added generator versions. `one-branch-v1` and the flowering/leafy goldens stay. Transactions, interruption rollback, insertion ordinals, inactive history, save compatibility, and Garden isolation are unchanged. Step Back does not edit plants.

## What each cutting enables

Catalog order is the four established cuttings, then `reed`, `flower-volume`, `arching-trailer`. Tray identity is that order. Saved graphs still store `generatorVersion` only.

| Cutting | What it adds in the bowl | Taste and limits to review |
| --- | --- | --- |
| Reed / `reed-v1` | Repeated vertical strokes. Height is the seeded stock (`3.35..6.25`) plus an ordinary prune. Lean is aim. One bend makes an arc and keeps stock length. Six reeds at seed 8278 are the repetition study. | Radius `0.024` is a faint olive stroke (`0x4e6240`). The shared trunk hit tube is wider than that stroke. Stiffness `0.56`. No nodes, no organs. Phone acquisition was not observed. |
| Flower volume / `flower-volume-v1` | A cuttable head: one stem, two leaves, five pedicel groups, each with one tufted bloom. Pruning `group-2` deactivates `bloom-2` and leaves the other blooms and both leaves active. Branch count stays 8 and organ count stays 7. | The groups sit close together. On a 1280×800 Front view the projected 0.55 point of a group often hits the stem; the bloom itself is a short offset away. Desktop found `group-2` that way. The head is five organ meshes, each an 8-petal instanced cup. Pedicels are aim/prune targets and are outside the touch-bend kinds. |
| Arching trailer / `arching-trailer-v1` | A low cane across the water, with three small leaves on the descending limb. The rest pose is an authored cubic, sampled once at generation. Aim, the single bend station, and prune are the shared laws. | Cane stiffness `0.50`. A downward bend or an edge seat can leave the bowl and can meet the water or the basin floor. There is no collision response, and this integration does not add one. |

## Profiles

`reference-pair` remains flowering → leafy. `all-four` remains flowering → leafy → bare → single-flower. `mixed` remains the alias of `reference-pair`.

New stable ids, after `all-four` and before the dynamic catalog profile:

- `references-plus-reed`
- `references-plus-flower-volume`
- `references-plus-arching-trailer`
- `round3-three` — reed → flower-volume → arching-trailer. Count 6 is two of each. Count 12 is four of each.
- `round3-palette` — the explicit seven-material list. Count 6 is one each of the first six and omits `arching-trailer`. Count 12 is two of the first five and one each of flower-volume and arching-trailer.

`all-registered-materials` still cycles the live catalog. With seven materials, count 6 is one each of the first six and omits the trailer. It is a different scene from `all-four`.

Workbench counts remain 1, 2, 6, and 12. A count of 3 is not a form option. The trailer-beside-references stills use `references-plus-arching-trailer` at count 6 (two flowering, two leafy, two trailers).

## Evidence channels

### Automated

`npm ci && npm run verify` is recorded on the final head in the draft PR. The suite covers the frozen `reference-pair` / `all-four` sequences, the new profile ids, catalog order, and the candidate generator tests that came in with the merges.

### Browser

Headless Chrome on Linux, SwiftShader (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`), device pixel ratio 1. This is a desktop browser capture. It is not a phone.

Artifacts: `docs/development/reports/round3-integration/`.

Composition stills, seed 8278, CSS viewport 1280×800, drawing buffer 1280×800:

- Repeated reeds: `reeds-front.png`, `reeds-three-quarter.png`, `reeds-above.png`, plus one bent culm in `reeds-one-bent-front.png`
- Flower-volume head: intact Front / ¾ / Above, then `flower-volume-prune-preview.png`, `flower-volume-prune-cancelled.png`, `flower-volume-pruned-front.png`
- Trailer across water: `trailer-front.png`, `trailer-three-quarter.png`, `trailer-above.png`, and `trailer-with-references-front.png` / `trailer-with-references-above.png` (count 6)
- Mixed bowl: `mixed-round3-three-front.png` and the ¾ / Above pair (`round3-three` × 6)

`exercise.json` is the clean log from one headless pass:

- Flower-volume group prune: hash `5c6ba5af` unchanged during preview, restored on cancel, committed hash `03620378` on `plant-1:group-2`. `bloom-2` inactive; blooms 1, 3, 4, 5 and both leaves active. 8 branches, 7 organs.
- Stem aim after that prune: operation `aim`, active length equals the rest sum `4.481007809303701`.
- Garden Keep → View → Copy: viewing posture `step-back`, copy hash matches the view, kept `bloom-3` stays active, the copy’s `bloom-3` is pruned. Reload without `fresh` matches that edited copy.
- Reed bend on `plant-4:culm`: operation `bend`, hash changed, active length equals the rest sum `5.917219051555731`.
- Player bowl (`?test=1&fresh=1&bend=touch`): pointer-drag seated a reed at ordinal 1; bend then prune preview, cancel, and commit; reload without `fresh` matches the commit. Keyboard-free flower-volume insert reached ordinal 2 and aimed `plant-2:group-2`. Trailer insert reached ordinal 3 and bent `plant-3:trail`. A Step Back pan left the canonical hash unchanged.
- Player Garden Keep → View → Copy, then a prune of the copy’s culm: kept active length `2.5689306016204463`, copy active length `1.4127166734359744`, three plants in the kept entry.

Garden backups from that session:

- `garden-flower-volume-pruned.json` — one flower-volume plant, `bloom-2` inactive, group-2 active length `0.2986592336674222` matching its rest sum
- `garden-reeds.json` — six `reed-v1` plants, newest title “Repeated reeds”
- `garden-mixed.json` — `round3-three` × 6, generators reed, flower-volume, arching-trailer, two of each
- `garden-player-mixed.json` — player reed, flower-volume, and trailer before the copy was pruned

Workbench Garden storage is origin-shared, so the reed and mixed backups also contain the earlier keeps from the same browser session. The newest entry is the titled scene.

Narrow layout, same headless Chrome, device pixel ratio 1. The Materials menu lists all seven choice ids at both widths. The panel scrolls (`overflow-y: auto`). Measured overflow is about one row:

| Width × height | Rail (w×h) | Panel client / scroll | Overflow | Canvas CSS and drawing buffer |
| --- | --- | --- | --- | --- |
| 320×568 | 304×191 | 282 / 319 | yes | 320×568 |
| 390×844 | 374×180 | 286 / 319 | yes | 390×844 |

Stills: `narrow-320-materials.png`, `narrow-320-materials-scrolled.png`, `narrow-320-front.png`, and the 390 set. At `max-width: 360px` the menu max-height is `min(12rem, 100dvh - 5.5rem)`. At 390 the shared cap `min(18rem, 50dvh)` applies. The selected source card stays in the top rail.

### Phone

Not run. No physical-phone observation is claimed. The field card in `tests/browser/PHONE_WEB_TEST_CARD.md` is still the bar for first-try acquisition, cancellation, and Step Back ownership.

## Rendering cost

Same conditions as the stills: seed 8278, Front, CSS 1280×800, drawing buffer 1280×800, device and renderer pixel ratio 1. Numbers are one `getRendererStats()` after `renderNow()`, copied from the workbench report into `renderer-comparison.json`. Draw calls, triangles, geometries, textures, and programs are resource counts. They are not FPS, frame time, or a phone measurement.

| Scene | Calls | Triangles | Geometries | Branch visuals | Organ visuals |
| --- | --- | --- | --- | --- | --- |
| `all-four` × 6 (baseline) | 356 | 52414 | 264 | 55 | 37 |
| `reference-pair` × 6 | 463 | 65078 | 343 | 69 | 51 |
| reed × 1 | 10 | 8278 | 9 | 1 | 0 |
| reed × 6 | 25 | 12218 | 19 | 6 | 0 |
| flower-volume × 1 | 69 | 20330 | 54 | 8 | 7 |
| flower-volume × 12 | 751 | 161570 | 571 | 96 | 84 |
| arching-trailer × 1 | 31 | 10462 | 24 | 4 | 3 |
| `references-plus-arching-trailer` × 6 | 359 | 51826 | 265 | 54 | 40 |
| `round3-three` × 6 | 185 | 40690 | 139 | 26 | 20 |
| `round3-palette` × 6 | 269 | 46846 | 201 | 41 | 27 |
| `round3-palette` × 12 | 493 | 76334 | 365 | 78 | 50 |

Why the counts move:

- `all-four` × 6 is two flowering, two leafy, one bare, one single-flower. Flowering and leafy own most of the organ meshes.
- `reference-pair` × 6 is three flowering and three leafy, so it is heavier than that baseline.
- Six reeds are cheaper than the baseline: six trunks, zero organs. The visible stroke is thin; the graph is still one branch per cutting.
- One flower-volume plant is 8 branches and 7 organs. Each bloom is its own instanced 8-petal mesh. Twelve plants are 96 branch visuals and 84 organ visuals, which is why that stress scene is 751 calls and 161570 triangles. Collapsing the head into one mesh would drop the count and would also drop the per-group prune. That was left alone.
- One trailer is one cane plus three petiole/leaf pairs (31 calls). `round3-three` × 6 stays under the four-material baseline because two reeds and two trailers replace the flowering/leafy organ mass.
- `round3-palette` × 12 is above the baseline because it keeps two flowering and two leafy and adds a flower-volume head plus a trailer.
- `references-plus-arching-trailer` × 6 lands next to the baseline (359 calls, 51826 triangles): two trailers stand where `all-four` × 6 has one bare branch and one single flower.

The first download of `references-plus-arching-trailer` used count 1, because the form has no count 3. That row was replaced with the count-6 measurement above. The correction note is in `renderer-comparison.json`.

## Recommendation for Astra and Charlie

Review in this order:

1. Arching trailer. It is the new line across the water. Confirm the rest arch in `trailer-front.png` and `trailer-with-references-above.png`, then decide whether the known water/floor intersection on a downward bend is acceptable for this round. Do not add a collision solver in review.
2. Flower volume. Confirm one group can be previewed, cancelled, and committed while the other four blooms stay. The desktop offset needed to hit a bloom, rather than the stem, is the phone risk.
3. Reed. Confirm six strokes read as a set, and that one bend arcs a single culm without stretching its neighbors (`reeds-one-bent-front.png`). The faint radius is a taste call, not a graph defect.

Ship nothing from this branch on phone feel until a device runs the phone card. `all-registered-materials` × 6 is no longer a stand-in for `all-four`.

## Preview

On this head:

```
npm ci && npm run build
```

Open `dist/ikebana-web-alpha-standalone.html`. The workbench modal is `?workbench=1`.
