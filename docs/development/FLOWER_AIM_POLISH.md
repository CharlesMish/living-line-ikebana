# Flower aiming and material polish

Baseline: main `41475621703bd61a8f0863fe906ffdabcbc92229` (Round 3 combined).

Charlie reported flowers that stopped responding while aiming and small leaves
that were difficult to acquire on a phone. These observations exposed two
separate interaction problems, rather than a need for another material or an
independent flower-roll control.

## Corrections

- **Short stalk Aim:** the old squared-direction cutoff of `0.02` rejected
  acquisitions or targets within about `0.1414` world units of the branch root.
  The flower-volume crown stalk is only about `0.185` units long at seed 8278.
  Valid grabs could therefore stay motionless, and a moving preview could snap
  back when its requested target entered this region. Aim now uses the shared
  numerical geometry tolerance. Undefined directions remain no-ops; rotation
  still comes from the immutable acquisition snapshot and preserves stock,
  attachments and inactive history.
- **Leaf coverage:** the elliptic blade extends beyond its former hit sphere.
  A blade-centered proxy now covers the complete leaf and midrib for flowering,
  single-flower, flower-volume and trailer materials. The lanceolate reference
  leaf is unchanged.
- **Petal coverage:** the original flowering branch's cupped blooms also had
  petal tips outside their hit spheres. Their acquisition envelope now covers
  the complete flower without changing its geometry.
- **Visible organ picking:** leaf and flower surfaces must participate in hit
  ranking at the place touched, rather than only at their attachment point.
  Visible stem surfaces use the same rule, so a foreground stem can still win
  over a leaf behind it according to depth.
  Supporting-branch routing, selected-plant priority and transaction ownership
  remain the same.
- **Flower-volume appearance:** tufted petals have slightly shallower folds and raised
  rims. Their count, width, reach, material frames and five prunable group
  identities are unchanged. The other flower forms are unchanged.

No generators, catalog entries, fixtures, storage fields or insertion ordinals
change. Existing arrangements retain their material identity.

## Trailer decision

The arching trailer's low rest shape is intentional: it supplies a line across
the water beside taller material. It is a generic material study, not a claim
about a particular ikebana school or species. Its shape remains unchanged.
Overhanging the rim is distinct from penetrating the ceramic; this pass does
not introduce vessel collision constraints.

## Focused phone follow-up

Use a disposable working copy, keeping any arrangement you want first.

1. Insert flower-volume and use Front, then three-quarter. Grab several parts
   of the flower head and make short drags in both directions. Check that a
   valid grab starts moving and does not snap back over a broad dead region.
2. Repeat with single-flower and flowering branch. Try their small leaf tips
   and the portion near the stem; confirm that the acquired target matches the
   visible material touched.
3. Cancel a live aim by switching tools or leaving the page; confirm that the
   preview rolls back. Release a second aim normally and reload to check that
   the committed pose returns.
4. Prune one flower-volume group, first cancelling its preview and then
   committing it. The other groups must keep their identities and shape.

These checks do not test unrestricted axial roll. The existing fixed-plane Aim
mapping still has geometric limits, including an undefined direction exactly
at a branch root. If a remaining apparent limit is reported, capture the view,
selected material, grabbed part and drag direction before choosing new controls.

## Evidence boundaries

`npm ci` and `npm run verify` passed: **182 tests, zero failures**, typecheck,
production build and self-contained standalone validation. New regressions cover
short stalks, continuous near-root Aim, inactive history, complete leaf/petal
proxy coverage, exposed tuft selection, forgiving near misses and a foreground
stem occluding a rear leaf. Independent review found no remaining blockers
after the foreground-stem correction.

Automated checks exercise production core and renderer geometry/picking code;
they do not establish touch feel. The available cloud browser opened the public
game but could not initialize WebGL. No new physical-phone or rendered-browser
sign-off is claimed for this pass.

An offline triangle projection of the actual production flower meshes was used
to compare petal profiles at the same seed and camera. This diagnostic omits the
game's WebGL lighting and shadows. It rejected an overly shallow first attempt;
the retained change blends only 30% toward the softer profile to preserve the
cluster's volume. A normal in-game visual check remains useful.

See [the geometry diagnostic and method](reports/flower-aim-polish/GEOMETRY_PREVIEW.md).
