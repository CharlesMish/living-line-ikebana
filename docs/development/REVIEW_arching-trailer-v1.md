# Candidate review

- Candidate / role: Naturally arching trailer — Lane C, Round 3. A line that can cross visible water or run toward the bowl edge.
- Baseline SHA / head SHA / branch: `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37` / (this branch head) / `cursor/arching-trailer-v1-5a9d`
- Author / independent reviewer: Lane C implementation. Requested model: Grok 4.7 high thinking. Exposed session identity: Grok 4.7. Independent review is not this pass.
- New compositional choice: One seated cane whose rest pose already rises, crests, and descends across the open water toward the rim. Three small leaves mark the descending limb. Shortening that limb is the useful cut. The upright references do not offer this low crossing.
- Main weakness: The arch is one rest curve plus the existing single bend station. A downward bend or aim can drive the tip through the water and, at bend saturation, through the basin floor. Sliding the base toward the arch carries the same stock out of the bowl. There is no collision response, and this pass does not add one.

This pass preserves the behavioral contract. It adds one generator version to the registered list. It does not add a bend station, a physics step, or a change to root, insertion, aim-floor, or base-clamp rules.

## Implementation

- Generator version / material ID: `arching-trailer-v1` / `arching-trailer`
- Topology and attachment decisions: One 18-segment trunk (`trail`) and three petioles with one elliptic leaf each. No blooms. Seed 8278 at the kenzan center: length 3.016, crest y 1.368, tip (−2.295, 0.659, 0.384), tip radius 2.327. Basal tangent is nearly vertical (first-step y component 0.996) so the cane still seats in the pins. The rest polyline is an equal-arc sample of one authored cubic. `makeChain` was not used for the cane: its envelope relaxes toward the original direction at the tip and cannot hold a descending trail. Petioles still use `makeChain`. Randomness is consumed only at construction. Hand, azimuth, reach, crest, and depth vary by seed; the review seeds 8278 / 9255 / 10232 all fall to the −X side and differ in depth and reach. Ordinal 17 (seed 23910) falls the other way.
- Appearance changes: Cool blue-green cane `0x3d6d62`, roughness 0.58, radius 0.031. Small elliptic leaves `0x2f5c48` with the existing leaf proxy (radius 0.34, center y 0). Unused bloom slot copies flowering. No new organ renderer.
- Response values and rationale: Cane stiffness 0.50, copied onto the trunk at generation. Petioles 0.18, and they are not bend targets. 0.50 sits between the leafy stem (0.39) and the flowering trunk (0.72), so one drag can lift or drop the trail without the first gesture behaving like the leafy ribbon. The shared solver is unchanged. Maximum rotation at this stiffness is `(0.28 + 0.5 * 0.55) * 1.2` ≈ 0.666 rad. Influence is still the one broad station.
- Shared files changed and why:
  - `src/core/archingTrailer.ts` — new generator
  - `src/core/materialResponse.ts` — additive `ARCHING_TRAILER_RESPONSE`
  - `src/core/materialCatalog.ts` — provisional registry and catalog entry after single-flower
  - `src/core/index.ts` — barrel export
  - `src/presentation/materialAppearance.ts` — additive look
  - `index.html` — one provisional Materials choice and source template
  - `docs/BEHAVIORAL_CONTRACT.md` — generator list names `arching-trailer-v1`
  - `ARCHITECTURE.md`, `docs/MATERIAL_REFERENCES.md` — additive notes
  - Tests that assert the live catalog order, the dynamic workbench cycle, or the Materials choices
  - `fixtures/plant-1-arching-trailer-v1.json` — new golden
  Named profiles `reference-pair` and `all-four` were not given this material. `all-registered-materials` cycles the live catalog, so a six-cutting dynamic scene now includes one trailer. That is the labeled dynamic profile, not a change to `all-four`.
- Requested interface extensions (or none): None. The integrator owns the final Materials order and any named workbench profile. No second bend station, physics system, or root/insertion change is proposed.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | not run in this revision | Recorded after the verification pass |
| Existing golden fixtures unchanged | pass (local generation) | Flowering and leafy graphs still match their fixtures in `tests/core/archingTrailer.test.ts` |
| Seeds 8278 / 9255 / 10232 | pass (local generation) | Same test; fixture `fixtures/plant-1-arching-trailer-v1.json` is ordinal 1 / seed 8278 |
| Aim / bend preserve stock and attachments | pass (unit, pre-verify) | Rest lengths and stiffness unchanged. Petioles are not bend stations |
| Exact prune and retained history | pass (unit, pre-verify) | Cut at 0.7 of the cane removes `petiole-3` and `leaf-3` and keeps four branch records |
| Cancel / invalid insert preserve ordinal and save | pass (unit, pre-verify) | `tests/app/materialInsertion.test.ts` |
| Reload after a committed edit | pass (unit, pre-verify) | Bent graph round-trips through serialize |
| Garden original survives edited copy | pass (unit, pre-verify) | Keep, then prune a copy; the stored original is unchanged |
| Front / ¾ / Above | not run in this revision | Example `artifacts/arching-trailer-across-water.json` |
| Stable `reference-pair` scene | pass (unit, pre-verify) | Six-cutting `reference-pair` stays flowering/leafy alternating. `all-four` stays the four named versions |
| Narrow portrait / short landscape / large text | notes only | See composition notes. Phone not run |
| Physical phone | not run | No device |

## Rendering comparison

- Browser/device/OS; CSS viewport; window inner size; drawing-buffer size; pixel ratio: not captured in this revision.
- Same seed, count, camera and render conditions for baseline/candidate: graph comparison only so far. Centered seed 8278 trailer is 4 branches / 3 organs / 19 cane points. Flowering reference remains 15 / 10. Leafy remains 8 / 7.
- Report files for count 1 / stable `reference-pair` 6 / stress 12: not downloaded from a browser. Node identity of `reference-pair` and `all-four` is asserted in tests and was not rewritten.
- Resource-count differences: not measured in WebGL.
- Observed response/stalls: not measured.
- Missing measurements: browser viewport figures, draw calls, physical phone.

## Intersection limits

Measured on the centerline plus the 0.031 cane radius. Water disc y = 0.46, radius 2.345. Rim torus radius 2.48 at y = 0.635, tube radius 0.035. These are not hidden by a camera.

Centered seat, seed 8278, unbent:

- Lowest centerline over the open water (radius 1.34–2.345) is the tip, y = 0.659. Clearance above the water, after the cane radius, is 0.168. The centerline does not pierce the water disc.
- Clearance to the rim torus, after tube and cane radius, is 0.089. The tip approaches the lip and does not enter it.
- No centerline sample lies in the ceramic wall.
- Leaf attachments sit at about y = 1.42, 1.34, and 1.06. On this rest pose they stay above the water.

Limits, same stock, existing verbs only:

- Seat the base at the usable pin-field edge (radius 1.22) in the arch direction and the tip lands near radius 3.55, y = 0.659. The cane crosses the rim radius at about y = 1.27, so it passes over the lip, then the free end hangs outside the bowl. The base rule is unchanged; the reach is.
- A world-down bend at the 0.54 station with offset −0.25 already drops the tip to about y = 0.385 (through the water, radius about 2.18). Offsets of −1.0 and −1.4 saturate at the same pose: tip y = −0.194, radius 1.604, which is through the water and through the basin floor (y = 0.19). The solver has no bowl collision.
- Aim’s trunk floor still applies to the aim target (`root.y + 0.08`). A rigid aim of this already descending cane can still carry the tip to about y = 0.05, through the water. The floor does not lift every point of the arch.
- One station cannot add a second droop that hooks the tip over the lip while the crest stays put.

## Independent findings

None that should be scored as a graph-correctness failure. The intersection behavior above is the useful limit of authoring the arch as rest structure on the existing bend model.

## Recommendation

Integrate as a provisional fifth material after review, or keep the generator and let the integrator decide the Materials row. The compositional gain is a low line across the water that the four current cuttings do not provide. Do not treat the clearance numbers as a promise that bending or sliding will respect the bowl. Smallest next pass, if any, is a phone look at that one bend and at the fifth Materials row. Do not add a second station or a collision solver inside this candidate.
