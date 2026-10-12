# Ultra Night: botanical handling audit

Base: placement PR #85 at `f8bec35`. Scope: reed acquisition, nodding-head Aim,
arching-trailer handling, and projection-derived edit stations. No new material,
generator, solver, saved field, canonical stock, or acquisition-priority change.

## Decision

Retain the existing reed, nodding, and trailer geometry and acquisition envelopes.
Fix one mathematical defect in converting a projected branch press to material
distance. It is a precision correction, not evidence of improved phone feel.

## The C03 low-reed misses touched the shadow

Sources: C03 F4 `input-log.jsonl` sequences 5–7 and `shots/0004.png`, supplied in
the campaign package. The screenshot shows the green reed above the bowl and a
separate thin grey floor shadow below it. The three unsuccessful inputs follow
the shadow. The final saved first reed was also inspected; the test reconstructs
the experiment's `reed-forward` recipe with ordinary public craft operations.

| Recorded input | Distance from projected reed centreline | Result |
| --- | ---: | --- |
| Drag starts at (860, 652) | 98.04 CSS px | No candidate |
| Tap at (829, 638) | 88.56 CSS px | No candidate |
| Tap at (824, 636) | 87.79 CSS px | No candidate |

At the same 1280×800 Front camera, the actual reed tip projects to approximately
(858.31, 553.98). A press near the visible tip at (856, 556) acquires the reed;
five sampled interior points also acquire it. An 8px near-miss envelope should
not span an 88–98px gap and turn a floor shadow into editable material.

This is evidence of visual interpretation difficulty in that agent session,
not three failures of the hit test on visible reed material. It does not dismiss
Charlie's separate reports about real-device selection or prove human visibility
adequate. Shadows can be assessed visually in a future owner pass. No shadow,
lighting, stem thickness, or hit-radius change is bundled without that evidence.

## Fixed: perspective-correct material station

`ThreeStudio.closestProjectedOnBranch` found the nearest fraction along a 2D
projected segment, then reused that fraction to interpolate world geometry and
rest-arc distance. Those fractions differ when segment endpoints have different
camera depths. The helper now retains each endpoint's clip W and converts the
screen fraction to the corresponding world-segment fraction before deriving the
station. Ranking still uses the same projected distance, selected-target tier,
depth and stable ID. No branch or organ geometry changes.

Concrete low-reed example, last segment midpoint at Front 1280×800:

| Quantity | Before | After |
| --- | ---: | ---: |
| Intended rest-arc station | 4.525182181967102 | same |
| Acquired rest-arc station | 4.523454882567379 | correct within 1e-8 |
| World-station error | 0.0017272994 | sampled maximum below 3.2e-15 |
| Reprojection error at this point | 0.1106902 CSS px | below 1e-7 CSS px |

The screen press is approximately (849.109932, 551.750053). The size of this
error is small; it cannot explain F4's distant shadow inputs. Correctness matters
because the same helper supplies Aim grips, touch-bend stations, and Prune.
The focused prune test checks the production preview mesh's end-cap centre and
the committed cut against the intended point. Both now agree with the press.

This preserves the behavioral contract's projected-material station rule and
clarifies its perspective calculation. It does not revise selected-plant
priority, exact-surface ranking, near-miss bounds or transaction ownership.

## Nodding head and trailer findings

- The nodding corolla already supplies the actual visible surface intersection
  as its frozen Aim grip. Its short stalk remains the pivot and only that
  continuation moves. Existing v1/v2 app tests verify no acquisition jump,
  unchanged lower/upper stem, reverse-to-start, cancel/no-save, ordinary-release
  save, rest lengths, attachments, and serialization. Those tests pass here.
- The trailer already constrains its seated exit direction instead of clamping
  the descending tip to insertion height. Existing tests pass for a lowered tip,
  reacquisition and extreme requests with stock and attachments intact. Its
  authored arch and the single bend station still limit which forms are easy;
  this pass adds neither free joints nor a new physical simulation.
- Existing selected-plant and selected-handle priority can still make a crowded
  bowl ambiguous. That is the documented acquisition policy. This audit does not
  silently replace it with a global nearest-surface rule or enlarge petiole,
  pedicel, and organ halos.
- The intermittently missing bud support is still unresolved. Existing
  production mesh/state checks pass, but no affected saved scene or real-device
  reproduction was available to establish a renderer fix.

## Verification

- Dependencies: clean `npm ci --offline --no-audit --no-fund` from the same lockfile.
- `npm run verify`: 456 tests passed, zero failed or skipped; typecheck, production
  build and self-contained distribution checks pass.
- Added three presentation tests. The round-trip and cut-position tests fail
  against the old production source and pass after correction. The shadow-input
  case passes on both, documenting why the bounds should remain unchanged.
- Round-trip probes cover every segment at 20%, 50% and 80% for the authored low
  reed, nodding v2 and trailer in 1280×800 and 390×844 projected canvases.
- Re-ran existing production organ picking, acquisition bounds, nodding app Aim
  transaction and trailer core Aim checks. The full suite also covers goldens,
  save/undo, cancellation, overlap studies, and all unchanged material generators.

These are production geometry/projection/unit tests with GPU drawing omitted,
plus inspection of supplied session screenshots. No new browser play, physical
phone test, GPU render or phone frame-time measurement was performed by this lane.

## Focused owner check

On the recommended preview, place a reed and trailer, then inspect Front and ¾.
Touch green material rather than its grey floor shadow. Turn the nodding bell
slightly, reverse, then separately select its arch and bend. In a crowded bowl,
note what was already selected when the wrong target wins. A screenshot plus a
kept/exported scene is more useful than enlarging all hit targets indiscriminately.
