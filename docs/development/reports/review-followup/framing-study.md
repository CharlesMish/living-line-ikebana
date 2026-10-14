# Front framing: bounded follow-up study

**Disposition:** keep camera and acquisition behavior unchanged in the rendering/save repair. Investigate a fixed Front-preset translation separately. No auto-fit after edits is proposed.

This is a read-only source and CPU-projection assessment of the framing code on PR #92 at `85af92682d6e057c77f2b5db89dffd3f11ccf6c6`. It supports Claude's report that a newly seated flowering branch can hide behind the rail. It does not independently reproduce the browser's actual rail measurements or establish phone usability.

## Cause and present test gap

`src/presentation/stageLens.ts` deliberately leaves a roomy stage at the reference 44-degree field of view whenever the controls occupy at most 16% of canvas height. Narrower/shorter stages compensate only for the excess over that reference. This preserves the old desktop frame, including its small crown clearance.

The real first flowering branch (`createFloweringBranch("plant-1", 8278, {x:0,y:.55,z:0})`) ends its trunk at approximately `(-1.28059, 6.52826, .59787)`. With the production Front camera and a 127px inset, its centerline projects just behind the rail at 1280×800 and 844×390. The same assumed inset leaves it visible at 1440×900 and 1920×1080. Therefore “all desktop sizes” is an observation about the reviewer's tested sizes/rail, not a universal result.

The existing camera test projects the artificial point `(0,6.53,0)` through a bare 44-degree camera and accepts a crown between 105px and 180px. It does not use the seeded crown's depth, the stage lens, or a measured rail rectangle. That test can pass while the real crown is covered.

## Numerical candidate, not an adopted fix

Translate both the Front camera and its target along the camera's screen-up vector. The visible scene moves down; orientation, distance, lens, and projected planting width remain unchanged. This avoids buying headroom by making the pin target smaller.

For the current pose:

```text
position = (0, 3.7, 15)
target   = (0, 2.55, 0)
up       = (0, 1, 0)
screenUp = normalize(cross(cameraRight, target - position))
         = (0, 0.9970740035791589, -0.0764423402744022)
newPosition = position + amount * screenUp
newTarget   = target   + amount * screenUp
```

Two useful study amounts are 0.6 and 0.9 domain units. At 0.6:

```text
position = (0, 4.298244402147495, 14.95413459583536)
target   = (0, 3.148244402147495, -0.04586540416464132)
```

At 0.9:

```text
position = (0, 4.597366603221243, 14.931201893753038)
target   = (0, 3.447366603221243, -0.06879810624696199)
```

The following values are production-math projections in CSS pixels. Insets are explicit test inputs, **not browser measurements from this audit**. Crown clearance is the highest branch centerline minus the inset; positive is below the rail. Mesh extent and shadows are not included.

| Canvas / assumed inset | Current crown clearance | +0.6 clearance | +0.9 clearance | Planting width, unchanged | Root Y, current → +0.9 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1280×800 / 127 | −1.5 | 40.5 | 61.5 | 159.0 | 529.9 → 588.5 |
| 1440×900 / 127 | 14.2 | 61.5 | 85.1 | 178.8 | 596.2 → 662.1 |
| 1920×1080 / 127 | 42.5 | 99.2 | 127.5 | 214.6 | 715.4 → 794.5 |
| 844×390 / 127 | −11.3 | 5.7 | 14.3 | 64.7 | 280.1 → 304.0 |
| 390×844 / 237 | 13.0 | 47.1 | 64.2 | 129.2 | 578.5 → 626.2 |
| 320×640 / 228 | −21.7 | 5.3 | 18.8 | 102.2 | 466.3 → 504.0 |
| 390×844 / 355 | −37.1 | −4.3 | 12.0 | 124.0 | 633.3 → 679.1 |

The trade-off is bottom clearance. Moving the bowl down can crowd the status message or home-indicator region, especially with the largest bowl, short landscape, or enlarged text. A universal 0.9 offset has not earned acceptance from these numbers alone. It also cannot guarantee arbitrary edited arrangements remain visible.

## Next experiment

1. Capture current Front and the two fixed offsets using the same saved arrangement and **measured** rail/canvas rectangles. Include the first branch at center and edge seats, the largest bowl, a low arrangement, a tall mixed arrangement, 320×640, 390×844, 844×390, desktop, and enlarged text. Inspect both top and bottom occlusion. Record projected planting dimensions.
2. Apply any accepted change only at initialization of a fresh bowl and explicit Front commands. Do not refit during edits or overwrite restored/saved camera poses on load. Keep manual pan/zoom and gesture ownership intact.
3. Resolve the duplicated Front definitions in `src/app/camera.ts` and `ThreeStudio.ts` deliberately. A global preset revision also changes Garden Compare's initial Front and Photograph's explicit Front. Compare must still use identical pose, FOV, and world scale in both panes; existing saved entry poses must remain unchanged. If the change is limited to the working studio, make that scope explicit rather than allowing the two definitions to diverge accidentally.
4. Replace the false reassurance of the artificial crown test with a seeded projection/rail-clearance check, plus rendered evidence and a physical-phone check when available. Preserve projection/picking agreement, pan speed, orbit continuity, resize cancellation, and saved-camera restoration.
5. Document the intentional default-pose contract revision. The current narrow-stage contract promises unchanged canonical poses and desktop framing, so this is a small design change rather than a silent renderer correction.

## Acquisition recommendation

Do not enlarge targets based only on Grok's generic recommendation. The current implementation already has an 8 CSS-pixel fallback around active trunk/lateral/twig centerlines, 16px around selected base/bend handles, and a minimum 12px visible bend-bead diameter. Fallbacks apply only when no true visible material surface was hit; existing selected-target priority remains authoritative. This is documented in the contract and covered by tests.

Increasing these envelopes can increase wrong-part acquisition in a dense arrangement, including pruning. First record intended and acquired stable IDs in ordinary play, distinguish direct surface hits from fallback hits, and separate a hard-to-see target from incorrect arbitration. A visual selected-state cue can be studied without changing the hit envelope. Planting outlines must continue to match the exact accepted area; enlarging only the outline would reintroduce a misleading target.

## Verification and limits

`node --test tests/app/camera.test.ts tests/presentation/stageLens.test.ts tests/presentation/acquisitionCues.test.ts`: **21 passed, 0 failed**. Numerical projections used the actual generator, camera pose, Three.js perspective projection, and stage-lens function without a GPU. No browser, screenshot, touch, Safari, or physical-phone run was performed for this assessment. No camera or hit-target product code changed.
