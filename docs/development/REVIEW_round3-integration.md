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
| Flower volume / `flower-volume-v1` | A cuttable head: one stem, two leaves, five pedicel groups, each with one tufted bloom. Pruning one group deactivates that bloom and leaves the other blooms and both leaves active. Branch count stays 8 and organ count stays 7. | The groups sit close together. On a 1280×800 Front view the projected 0.55 point of a group often hits the stem; the bloom itself is a short offset away. The current renderer draws each bloom as its own instanced cup. That is a presentation choice. The cut itself is the pedicel and its bloom record. Pedicels are aim/prune targets and are outside the touch-bend kinds. |
| Arching trailer / `arching-trailer-v1` | A low cane across the water, with three small leaves on the descending limb. The rest pose is an authored cubic, sampled once at generation. Aim, the single bend station, and prune are the shared laws. | Cane stiffness `0.50`. Lane C measured two different limits. Centered rest: tip clearance above the water is 0.168 and clearance to the rim is 0.089, both after radii, so the tip does not enter the ceramic or the water. Edge seat: the cane passes over the lip and the free end overhangs past the rim (tip radius about 3.55). Downward bend: offset −0.25 already puts the tip through the water (y about 0.385); a saturated bend goes through the water and through the basin floor (tip y = −0.194, floor y = 0.19). Aim can also carry the tip through the water. Overhang and penetration are separate. There is no collision response. |

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

Stills: `narrow-320-materials.png`, `narrow-320-materials-scrolled.png`, `narrow-320-front.png`, and the 390 set. Portrait 320 and 390 both use the default menu cap `min(18rem, 50dvh)`. The `12rem` cap belongs to the short-landscape query (`max-height: 430px` and `orientation: landscape`); these portrait viewports do not match it. The overflow in the table is that default cap against scrollHeight 319. The selected source card stays in the top rail.

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
- One flower-volume plant is 8 branches and 7 organs. In this renderer each bloom is its own instanced 8-petal mesh, so twelve plants are 96 branch visuals and 84 organ visuals, and that stress scene measures 751 calls and 161570 triangles. Pruning a group is a graph fact: that pedicel shortens and its bloom becomes inactive. One mesh per bloom is how this renderer draws the head. It is not a requirement that a group cut use a separate draw call. The meshes were left as they are.
- One trailer is one cane plus three petiole/leaf pairs (31 calls). `round3-three` × 6 stays under the four-material baseline because two reeds and two trailers replace the flowering/leafy organ mass.
- `round3-palette` × 12 is above the baseline because it keeps two flowering and two leafy and adds a flower-volume head plus a trailer.
- `references-plus-arching-trailer` × 6 lands next to the baseline (359 calls, 51826 triangles): two trailers stand where `all-four` × 6 has one bare branch and one single flower.

The first download of `references-plus-arching-trailer` used count 1, because the form has no count 3. That row was replaced with the count-6 measurement above. The correction note is in `renderer-comparison.json`.

## Recommendation for Astra and Charlie

Review in this order:

1. Arching trailer. It is the new line across the water. The centered rest pose approaches the lip and stays clear of the ceramic and the water (`trailer-front.png`, `trailer-with-references-above.png`). An edge seat overhangs past the rim. A downward bend can penetrate the water and, at saturation, the basin floor. Those are separate limits. Do not add a collision solver in review.
2. Flower volume. Confirm one group can be previewed, cancelled, and committed while the other four blooms stay. The desktop offset needed to hit a bloom, rather than the stem, is the phone risk.
3. Reed. Confirm six strokes read as a set, and that one bend arcs a single culm without stretching its neighbors (`reeds-one-bent-front.png`). The faint radius is a taste call, not a graph defect.

Ship nothing from this branch on phone feel until a device runs the phone card. `all-registered-materials` × 6 is no longer a stand-in for `all-four`.

## Finish pass

Artifacts: `docs/development/reports/round3-finish/`. Same headless Chrome channel as the integration stills (SwiftShader, CSS 1280×800, device pixel ratio 1). Phone was not used. The log is `finish-log.json`.

### Garden original and revision

Workbench profile `round3-three`, seed 8278, count 6: reed, flower-volume, arching-trailer, two of each.

| Moment | Title | Canonical hash |
| --- | --- | --- |
| Kept original, and View of that entry before and after the revision | Round 3 original | `79d8e7b4` |
| Working copy immediately after Replace | — | `79d8e7b4` |
| After pruning `plant-3:trail` at material distance 1.280, and View of the kept revision | Round 3 revision | `9a0cf619` |

The copy matched the original. The revision does not. Viewing the original again after the revision was kept still hashed `79d8e7b4`. Stored plant JSON for the two entries differs. `plant-3:trail` active length goes from 2.993 to 1.280. All three leaves on that cane stay active in the original and are inactive in the revision. The other five plants are the same records.

View stills, Front / ¾ / Above: `garden-original-view-front.png`, `garden-original-view-three-quarter.png`, `garden-original-view-above.png`, and `garden-revision-view-front.png`, `garden-revision-view-three-quarter.png`, `garden-revision-view-above.png`. `garden-original-after-revision-view-front.png` is the original opened again after the revision existed. Backup: `garden-original-and-revision.json`.

That backup also contains an earlier keep from the same browser, title “Flower volume group opened”, because workbench Garden storage is origin-shared. The original and revision entries are the pair above.

### Flower-volume group cut

One `flower-volume` plant, seed 8278, canonical Front before and after the commit. Intact hash `5c6ba5af`. Committed prune of `plant-1:group-5` at material distance 0.172, hash `430edfb2`. `bloom-5` is inactive. Blooms 1–4 and both leaves stay active. Branch count stays 8 and organ count stays 7. Group-5 is the right-hand bloom of this seed, so the Front silhouette loses that side of the head.

Stills: `flower-volume-intact-front.png`, `flower-volume-group-opened-front.png`, plus Above `flower-volume-intact-above.png` and `flower-volume-group-opened-above.png`. Garden backup of the opened plant: `garden-flower-volume-opened.json`, title “Flower volume group opened”.

## Preview

On this head:

```
npm ci && npm run build
```

Open `dist/ikebana-web-alpha-standalone.html`. The workbench modal is `?workbench=1`.
