# Handoff: audit before implementing penetration prevention

Status: design proposal only. Charlie requested detection/display first and a
separate audit before implementing prevention. No solver or acceptance change
is included in this branch.

## Decision to make after inspecting this version

Can the current approximation locate the reed/branch problem with sufficiently
few nuisance marks? Check endpoint capsule false positives, short thick stock,
multiple crossings, water-level bundles and repeated very shallow contact. If
not, improve the diagnostic before treating any output as a restriction.

Choose a narrow first enforcement scope: between separate structural cuttings.
Floor/ceramic containment needs separate signed-distance geometry and exceptions
for the insertion support. Water is not a solid obstacle. Legitimate overhang
must remain legal. The retained `craft-usability/nodding-below-floor-plant-8.json`
example should inform that separate study, not justify keeping all points in a bowl.
Leaves, petals, self-intersections and authored same-plant junctions remain outside
this first inter-cutting study. Do not invent a botanical contact law for them.

## Proposed interaction

Keep a visible, continuous legal preview and identify the contacting area when
movement reaches a boundary. No vanishing plant, silent rejected release, snap of
unrelated stems, automatic rerouting, or surprise movement on pointer-down.
Release commits the **displayed** constrained preview. Cancellation restores the
immutable acquisition snapshot with no save or ordinal change. Undo remains one
botanical step; inspection toggles never become history.

Preserve stock length, attachments, inactive records and the original acquisition
frame. Recompute candidate shapes from the immutable snapshot. A constraint may
limit progress through the existing operation; it must not accumulate deformation
or nudge canonical vertices after the solver. Insertion/base translation, rigid
Aim and non-rigid Bend need distinct motion paths even if their contact queries
share code. Pruning removes material and should never be prevented because the
starting arrangement already overlaps.

## Why a simple last-valid endpoint check is insufficient

- A large pointer step can pass entirely through another stem and end clear.
  Endpoints alone allow tunnelling. A binary search assuming one crossing is also
  insufficient: an operation path can enter and leave contact more than once.
- A bent branch carries descendants; every affected structural segment must be
  covered, not just the grabbed point or branch endpoint.
- A cursor-path-dependent stored last-valid pose can conflict with snapshot-based
  reconstruction. Specify whether the constraint follows gesture history or a
  deterministic path from acquisition, and test that choice explicitly.
- A rendered-tube approximation with rounded end caps may stop movement before
  actual visible contact. Detection's grazing tolerance is not yet a validated
  solver margin or clearance requirement.

Evaluate bounded conservative advancement or adaptive motion subdivision with
an actual displacement bound for **all affected geometry**. For rigid Aim, bound
angular sweep times the furthest affected radius. For translation, use translation
length. For Bend, derive a conservative bound from the solver or retain it as
warnings-only until one can be justified. Choose the first contact on that path,
then refine it. Define a safe, visible outcome if a computational budget is reached;
never silently accept an unchecked jump. Do not advertise exact continuous
collision detection from arbitrary fixed sampling.

## Existing overlaps must remain escapable

Saved bowls already contain penetration. Do not reject them on load, relocate
anything, or trap the next gesture at its acquired pose. Capture baseline contact
pairs/depths at acquisition. Audit an escape policy that permits separation while
preventing new/worsened penetration. A global maximum or contact count is inadequate:
it can hide worsening one pair by improving another. A strict pairwise monotonic
rule can itself trap valid escape paths, so this decision needs representative
fixtures and human play before becoming default. A warning-only fallback for
pre-existing overlaps may be the safer first experiment.

## Implementation boundary and proposed gates

Put pure contact/motion math in core; transaction adapters choose the constrained
preview; presentation only explains the result. Persist no mesh, mark, contact
cache or pointer trajectory. Any new per-gesture state must reset on all existing
interruption paths. Do not change the frozen generators or renderer geometry as a
shortcut to satisfying contact tests.

Before enabling even an opt-in constraint, require:

- No jump on acquisition, including old intersecting poses.
- Ordinary clear Aim/Bend/base/Insert matches the unconstrained result.
- Fast drag through thin reeds cannot tunnel; multi-contact and multiple-entry
  paths have explicit outcomes. Descendants are covered.
- Legitimate tangent touch, different-depth crossings and root attachments work.
- Contact limiting preserves lengths/attachments/identity, is stable on repeated
  input, and is evaluated independently of camera angle.
- Preview exactly equals committed graph; cancellation/interruption saves zero;
  Undo and Garden copies preserve exact graph identity.
- Real iPhone plus desktop checks: no sticky wall, unexpected jump, hidden clamp,
  accidental retarget or unacceptable frame cost in a 12-cutting bowl.

If those gates cannot be met simply, keep useful inspection and defer enforcement.
Do not mistake fewer intersections for a better shaping interaction automatically.
