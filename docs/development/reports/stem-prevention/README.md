# Stem-contact prevention study

Base: main `16bbc7de38994cbee44c037dbb02c561d0ed6ff1`, after Charlie merged #59.
This intentionally revises shaping only when **View → Prevent overlaps (study)**
is enabled. Off by default, session-only, draft against main. No new material,
schema, Garden workflow, collision with the bowl, or default physics.

## Try it

1. Enable **Prevent overlaps (study)** in View. It also displays contact/overlap
   marks while enabled; the separate Stem overlaps toggle still controls inspection
   when prevention is off.
2. Put a reed near a woody cutting. Aim, Bend, or slide its base toward the wood.
   The preview should stop near contact, identify the area, and release there.
   Back away, then try a different direction. There is no automatic sliding or
   rerouting around the obstacle.
3. Try a fast sweep whose destination is clear but whose path crosses the wood.
   The same stop should occur. Inspect from Above and Three-quarter.
4. Try a saved bowl that already overlaps. Those existing branch pairs remain
   free for that entire grab, so they can be separated; their warning stays visible.
   Release when clear and grab again to protect that pair. This does **not** promise
   monotonic repair: an exempt pair can also get worse during the grab.
5. Insert at an occupied pin. The ghost follows the finger but is invalid; releasing
   returns it to the tray without saving or consuming its reserved identity. Try a
   clear pin. Keyboard placement also declines a blocked seat without a success cue.
6. Cancel a held edit, interrupt it, and Undo a completed edit. Exact committed
   state must return. Toggle protection during a grab: cancellation occurs first.
7. In a dense bowl, watch for the movement-paused message. Try a smaller move or
   turn protection off. If this is frequent or feels sticky, retain inspection and
   revise this study before considering a default.

Physical iPhone and real-pointer browser play are **not run**. The prior local
browser preview attempt was blocked (`ERR_BLOCKED_BY_CLIENT`); no fresh rendered
or physical-phone sign-off is claimed. Automated results below are not feel tests.

## Motion and geometry

The model is finite-segment capsules using persisted branch radii, restricted to
active trunk/lateral/twig material of **different cuttings**. It uses inspection's
small grazing allowance: effective pair radius is the sum minus
`max(1e-5, .1 * smallerRadius)`. Rounded endcaps and bends approximate the render;
there can be a small visible gap or shallow tolerated penetration. Leaves, flowers,
stalks, self-contact, floor and ceramic remain unconstrained. Natural junctions
within a cutting are not obstacles. Water is not solid, and overhang stays possible.

Each transaction keeps its immutable acquisition graph plus the last accepted
motion parameter. Updates reconstruct from that graph; they never interpolate or
nudge canonical points or accumulate frame-to-frame deformation. The accepted
parameter path is intentionally gesture-history-dependent so an intermediate clear
pose cannot teleport through another stem when the requested direction changes.

- **Aim:** shortest quaternion arc between accepted and desired rotations; endpoint
  speed is arc angle times distance from the pivot. All active descendants travel
  with the grabbed continuation. An exact sinusoid-extrema split finds the first
  root-exit floor crossing even when the arc endpoints both satisfy the floor.
- **Bend:** straight interpolation between accepted and desired bend rotation
  vectors, through the existing smootherstep/rest-length reconstruction. A shared
  influence profile bounds each segment's angular speed. Prefix length sums bound
  point speeds; fixed rest-arc attachment interpolation and shortest-arc frame
  remapping bound every active descendant. The quaternion normalization bound is
  documented next to `bendPointSpeeds`. It requires rotation magnitude <=1 radian;
  the authored cap is <=.996. If a future law exceeds that, this study holds rather
  than applying an unsupported bound.
- **Base:** coherent translation between accepted and requested clamped bases.
- **Insert:** endpoint validity, because the unseated ghost is not a solid object
  moving through the arrangement. It may pass through material en route to a clear
  seat; it may not commit an intersecting seat.

A swept broad phase excludes provably unreachable segment pairs. Conservative
advancement uses segment clearance divided by a bound on endpoint speed to certify
whole intervals. This is not endpoint-only checking or a fixed sampling grid.
Near contact, a small already-certified probe distinguishes separation from further
approach. Advancement is capped at 48 steps / 40,000 candidate-pair checks per update;
a budget exit keeps the last certified pose and exposes a distinct cue. Neither
budget exhaustion nor release accepts an unchecked requested endpoint. Floating-
point arithmetic and capsule geometry remain approximations, not exact mesh CCD.

Pre-existing **branch pairs** are exempt for one transaction, not all collisions
of the selected plant. A new obstacle remains protected. This is an explicit
escape policy, not a claim that every old intersection gets better. Prune is
unrestricted; it removes material and does not need a collision veto.

## Integration and retained behavior

`StemPrevention` belongs to the coordinator's domain adapters. WeakMap spec keys
keep transient path/environment state scoped to acquisition. Saved graphs contain
no contact cache or motion parameter. The working controller is retained across
Garden View/Return; Garden viewing cannot edit. Marks are presentation-only and
unpickable. Contact-limit marks do not inflate the reported overlap count, and the
existing thumbnail/Compare exclusions remain in effect.

Release commits the displayed graph; interruption restores acquisition with zero
saves. Undo remains one botanical step. Turning the study off restores the ordinary
laws. The default bend path keeps its original axis/angle arithmetic, so frozen
reed/Garden fixtures remain bit-identical; constrained clear outputs agree within
floating-point tolerance. No generators, fixtures or persisted radii were changed.

## Evidence

- `npm ci` completed; final `npm run verify`: **343 tests passed**, zero failed or
  skipped, clean typecheck, build and self-contained distribution validation.
- Focused regressions cover: clear endpoints with an intervening collision; reverse
  motion from contact; changing Aim directions; child-branch contact during Bend;
  multiple obstacles; pre-existing-pair escape; different-depth crossings; motion
  bounds; root-floor interior dips; stock/attachments; insertion identity; exact
  release/Cancel/Undo; toggle cancellation; Garden controller retention; and marks.
- Clear Aim/Bend agree with the ordinary solver across the twelve-material palette.
- Frozen reed arrangement equality and all existing generator goldens pass.
- CPU-only stress probe: `round5-palette`, seed8278, 12 cuttings, 16 alternating
  bend requests per cutting (192 total). One development run: median ~1.0ms,
  p95 ~11.0ms, maximum ~24.8ms; 115 contact stops, 30 budget pauses, 47 clear updates.
  This deliberately crowded synthetic sequence is not a miss rate, human playtest,
  GPU frame time, or phone-performance claim. The budget pauses are a real study
  limitation; do not describe the dense case as accepted phone feel.

Reproduce the CPU probe from the repository root (esbuild is already a dev dependency):

```sh
./node_modules/.bin/esbuild tools/probe-stem-prevention.ts --bundle --platform=node --format=esm --outfile=/tmp/living-line-prevention-probe.mjs
node /tmp/living-line-prevention-probe.mjs
```

## Verdict and next decision

Retain as an opt-in owner-playtest candidate. Do not promote to default without a
real-phone comparison of acquisition, clear movement, approaching contact, reversing,
near-tangential travel and dense arrangements. In particular, conservative stopping
can feel sticky on near-tangent paths; there is deliberately no contact sliding
solver. If the pauses or capsule approximation are distracting, disable the study
and keep #59 inspection while refining it.

The [earlier audit](../stem-overlaps/PREVENTION_AUDIT.md) was the starting proposal.
This implementation chooses explicit per-grab legacy-pair exemptions, bounded
continuous motion checks, and a default-off owner test. Physical-phone acceptance
from that audit remains open. No floor/bowl or organ-contact phase is implied.
