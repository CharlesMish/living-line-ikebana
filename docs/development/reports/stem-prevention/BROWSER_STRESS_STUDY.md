# Browser stress study after #60

Tested baseline: main `9822fc81b816d73b2bb500c688d4f65703f6c036`.
Study date: September 29, 2026 (America/Chicago).

## Decision

Keep prevention default-off and **soften clear base travel** before further owner
play. The baseline strongly restricts a geometrically clear grazing path. The
candidate adds a continuous separating-plane certificate for straight base
translation, without increasing the work budget, accepting unchecked crossings,
or adding automatic sliding/rerouting. Aim and Bend retain their existing checks.
Dense Bend holds and crowded acquisition remain study limitations. This is not
physical-phone acceptance or a recommendation to make prevention the default.

## Evidence and limits

- Local source at the exact baseline SHA; isolated workbench storage only.
- Headless Microsoft Edge/Chromium `154.0.4258.37`, Playwright trusted mouse input,
  CSS viewports 1280x900, 390x844 and 844x390, software WebGL (SwiftShader).
  These are browser-window dimensions, not physical device measurements.
- Codex in-app browser: screenshot-guided Aim/Bend drags in its desktop view,
  plus Bend at 390x844 and 844x390; View controls operated through the UI.
  These were agent-driven browser interactions, not human mouse play.
- Four additional trusted CDP touch-emulation cases cover base crossing with
  protection off/on at 390x844 and 844x390. On-mode stopped and off-mode crossed;
  `touchCancel` restored exact committed state with zero saves in all four. This
  exercises Chromium's touch-event route, not a physical touchscreen or Safari.
- The local server transpiled source modules with TypeScript and exposed an
  observation handle to the existing app instance. It did not replace the input
  coordinator or edit laws. Fixture snapshots were loaded into isolated storage;
  gesture acquisition, movement, release, Escape, insertion and Undo used normal
  browser inputs and the production app. Readbacks included active displayed
  graphs, canonical graphs, protection feedback, save audit and visible cues.
- No physical phone, iPhone Safari, human finger play, native haptics, Safari
  browser-toolbar/edge-swipe ownership, or hardware GPU timing was tested.
  Browser automation and phone-sized viewports cannot establish those outcomes.

## Focused results

The main matrix and supplemental contact/insertion matrix each completed 27
scenarios (nine per viewport), with no page runtime errors. Results below refer
to these controlled scenes, not a player success rate.
An additional ten scenarios cover off-mode multiple obstacles, legacy movement,
dense Bend controls and emulated touch: 64 baseline scenarios in total. Six
focused candidate replays bring the complete browser study to 70 scenarios, with
no harness failures or page runtime errors.

| Case | Prevention off | Prevention on |
| --- | --- | --- |
| Aim and Bend | Free requested shaping | Clear movement followed the request; contact stopped motion; reversing was clear |
| Base fast crossing, clear destination | Reached x approximately +0.6 from -0.6 | Stopped around x=-0.04800552 before the other stem; release did not teleport |
| Aim/Bend fast crossing, clear destination | Reached the clear final pose | Stopped on the intermediate obstacle, including an attached lateral branch |
| Multiple obstacles | Crossed freely | First obstacle stopped approach; retreat was clear; opposite obstacle stopped the next approach |
| Pre-existing overlap | Free shaping | Existing pair was exempt during escape; releasing clear and regrabbing restored protection |
| Occupied insertion | Committed one seat/save | Rejected seat, zero saves, ordinal unchanged; ghost followed pointer and identified the obstruction |
| Clear insertion | Committed one seat/save | Committed one seat/save after the rejected attempt; identity ordinal advanced once |
| Escape Cancel | Exact canonical state restored, zero saves | Same, for Aim/Bend/base and insertion |
| Release and Undo | Stored displayed pose exactly; Undo restored acquisition | Same, including constrained Aim/Bend/base releases |

Aim and Bend's fast-sweep obstacles were placed on intermediate trajectories
whose requested endpoints were independently checked clear. Base crossing also
had a clear destination. These checks therefore exercise continuous-path
protection rather than only invalid destination rejection. Unrelated floor,
ceramic, organ and same-cutting collisions remain outside this study's scope.

## Clear grazing failure

A four-point upright stem of radius .02 starts at x=-.6, y=.55. The obstacle is
a separate radius-.03 cutting rooted at (0,.55,-.9), with a vertical trunk ending
at y=1.75 and an attached horizontal lateral from z=-.9 to z=.9. Both are valid
seated graph structures. Effective pair radius is .048. Move the base toward
x=+.6: it stops at approximately -.04800552. Without releasing, request movement
along z in twelve .03-unit increments, keeping that accepted x coordinate.
The whole .36-unit path is outside the obstacle capsule, including the grazing
allowance. The baseline nevertheless advances very little.

| Viewport | Budget holds / 12 requests | Contact holds | Actual z / requested .36 | Final pointer lag |
| --- | ---: | ---: | ---: | ---: |
| 1280x900 | 10 | 2 | .00238651 (0.66%) | 26.82 CSS px |
| 390x844 | 12 | 0 | .00286295 (0.80%) | 19.35 CSS px |
| 844x390 | 7 | 5 | .00167055 (0.46%) | 9.71 CSS px |

Off-mode controls followed all 36 grazing requests, with only subpixel projection
roundoff. Tiny coordinate differences from screen-to-plane projection explain
some contact-versus-budget variation; the severe lack of progress is reproduced
in all three sizes. This is a concrete excessive constraint, not merely a warning
that exact touch or near-tangent geometry is approximate.

## Dense bowl

Fixture `round5-palette`, seed 8278, count 12, Above view. A fresh copy was loaded
for each targeted root. Nine roots were acquired through the actual raycast and
visible fixed Bend bead. Plant-6, plant-10 and plant-11 root targets were occluded
or ranked to another cutting in this view; they were excluded, not counted as
successful bends. The sixteen alternating x/z requests on each acquired cutting
gave, in each of the three viewports:

- 144 trusted browser Bend requests: 90 contact stops, **20 budget holds (13.89%)**,
  34 clear updates. The paused cue was read from the rendered UI.
- Short off-mode controls use four requests per acquired root: **36 per viewport**,
  108 total, with **zero paused cues**. These have a different sequence length
  from the on-mode test and are not a paired success-rate experiment.
- The original CPU probe also reproduced its exact 192-request reason counts:
  115 contact, **30 budget (15.625%)**, 47 clear. CPU execution time under concurrent
  browser automation is not GPU frame time or phone timing.

The browser sequence covers only successfully acquired roots and is not the same
192-request population as the CPU probe. Round-trip browser automation timings
include rendering and orchestration and must not be presented as solver latency.

## Candidate and validation

The base adapter explicitly declares a straight coherent translation. For each
candidate segment pair, a fixed plane from their closest-point direction is
checked against **both endpoints** of both segments. The projected interval gap
changes affinely during translation. Positive gaps at both ends certify the full
path. An inward crossing fails this certificate and falls back to conservative
advancement. A second obstacle is checked independently. The certificate uses a
positive 1e-9 roundoff guard and its pair checks count toward the existing budget.
It never treats a clear requested endpoint alone as sufficient.

Candidate browser replay: all **36/36** grazing requests clear, **zero budget
holds**, full .36-unit travel, maximum measured pointer lag below .00006 CSS px.
All three viewport replays retain fast-crossing and multiple-obstacle contact,
immediate reversal, exact displayed-pose release, zero preview/cancel saves and
exact Undo. No default, generator, radius, rest-length, saved schema, or legacy
exemption policy changes.

Local `npm ci` completed and candidate typecheck passed. The native
`npm run verify` was attempted but blocked at esbuild's ancestor-directory read
by the Windows sandbox, before source compilation. A compatible TypeScript/JSON
module loader ran the complete suite: **348 passed**, zero failed/skipped. That
alternative run is not a production-build pass. Normal Linux CI must still run
the repository's unmodified verify command on the draft fix PR. Physical-phone
comparison remains open even if that CI passes.

Owner follow-up: compare both modes on a physical phone using the existing
seven-step card, especially clear grazing, reversing after contact, dense Bend,
target acquisition and browser interruption. Keep inspection available and the
prevention study opt-in while those observations remain open.
