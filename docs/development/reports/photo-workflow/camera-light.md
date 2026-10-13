# Photograph camera and light refinement

Base: `c707845de8e11904e991ff76bec0a3b8b8310c28`.

## Intent and scope

The owner wanted more freedom to frame a Photograph and a few lighting choices.
This lane adds wider photo framing, three angle offsets, and three curated light
recipes. It does not change ordinary Arrange or Step Back controls, geometry,
collision rules, material generation, vessel placement or botanical persistence.
The Photograph UI and remembered setup are integrated by the parallel resume lane.

| Control | Range | Neutral |
| --- | --- | --- |
| Closer | 0.55–2.8× | 1× |
| Across / Height | −4.8–4.8 scene units | 0 |
| Turn | −60–60° | 0 |
| Elevation | −30–30° from reference | 0 |
| Tilt | −12–12° | 0 |

Changed elevation is clamped to 3–87° above its target. Neutral returns the exact
reference, including an existing Above view or an already tilted saved photo.
Every slider update derives from that same reference; there is no accumulated
transform. Pan follows the resulting screen axes and stops on that pan ray before
the camera crosses y=0.12 (the highest stage floor is y=−0.02). Position and target
move together, preserving view direction, roll and requested camera radius.
Closing in on an already low saved photo can lower its unpanned camera; that case
receives one minimal upward translation of both position and target before pan.
An untouched inherited pose remains exact, including a legacy below-floor pose;
changed framing may lift a low inherited pose but never pushes it farther down.
Camera roll uses the existing
finite, nonparallel `CameraPose.up`, so Keep and restore cannot double-apply a
second roll setting. Normal orbit and explicit preset behavior is unchanged.
The existing distance-adjusted fog already supports the wider zoom-out range.

## Light choices

- **Studio:** accepted hemisphere/key/fill values verbatim.
- **Soft window:** a cooler sky and increased fill with a milder key for reduced
  contrast. It uses the same shadow map; it is not a physical area-light model.
- **Evening:** a warm side key and a quiet cooler fill.

Each studio owns its own mutable lights. A switch changes their uniforms and key
position, and requests a new shadow draw; no lights, maps or geometries are added
per switch. It does not touch transparent background alpha, fog, camera, graph,
post-process recipe or tone-mapping exposure. Renderer factories restore the new
optional `photoLighting` sceneVersion2 field; absent means Studio. Old strict v2
readers refuse the field without dropping it.

## Automated evidence

- Focused camera/light plus existing Photograph, grade and ordinary camera tests:
  **30 passed, 0 failed**. Seven are new regression checks.
- Lane `npm run verify`: typecheck clean; **541 passed, 0 failed, 0 skipped**;
  Vite and standalone distribution validation pass. Shared dependencies were
  restored by the root's `npm ci` before the run.
- These counts cover this helper/renderer lane on the stated base. They do not
  claim final integrated Photograph UI, resume or scene-field propagation checks.

Tests exercise production framing, real Garden camera validation, actual Three.js
projection and the production renderer light setter using CPU adapters, not
rendered screenshots. They cover all bounded angle/zoom extremes, exact neutral
restoration, screen-relative pan after tilt, saved camera roll applied once,
ordinary orbit world-up, default light identity, scene isolation, and preserved
transparent background state.

## Acceptance still needed

No GPU browser or physical phone was available under the managed environment's
browser restrictions. The mathematical camera bounds and light values have not
been claimed as a phone visual playtest. Check side shadows, light colour on
translucent stock and wood, tilted framing and matching saved/photo appearance.
Wide pan intentionally permits unusual or empty crops above the stage; it does not auto-fit plants
or move the camera whenever stock changes.


## Integration audit follow-up: prevent camera crossing the floor

The initial framing implementation allowed Front with Height=4.8 to lower the
camera to about y=−1.086, below the one-sided ground. Two new tests failed against
that implementation before the fix: the camera-clearance grid and the saved-low
frame zoom case. The fixed targeted suite passes **25/25** (camera/light plus
existing Photograph and ordinary camera tests). The grid covers all three views,
zoom .55/1/2.8, both pan extremes and zero, both roll extremes and zero, and both
elevation extremes and zero. It verifies clearance, preserved viewing direction,
roll and radius; additional checks cover rolled Across-only motion, stopping on
the intended pan ray, zoom from a saved boundary pose and inherited low references.
The earlier 541-test full lane run predates this follow-up; the root runs the final
integrated gate. No browser or physical-phone evidence was added.
