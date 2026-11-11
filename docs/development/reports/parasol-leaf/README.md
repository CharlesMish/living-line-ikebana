# Parasol leaf — a plane held over the water

Study based on `668e4a3`, November 10 2026. Adds `parasol-leaf-v1`, material ID
`parasol-leaf`, at the end of the catalog. No feature flag, no replaced
generator, no migration, and no change to edit, transaction or persistence law.
It was authored during a guest arrangement of two bowls; the second bowl uses it.

## The gap it answers

Every cutting in the palette is a line, a point, or a surface that starts at
the pins. The second bowl was a low arrangement to look down into, in the Two
islands layout, and it needed a small plane held away from its root with open
water around it.

The closest existing cutting is Broad leaf. Aimed in Front its lamina stays on
edge, because Aim rotates in the camera plane and there is no axial roll. Leaned
toward its own face from a side view and then turned with Edit → Turn, it does
lie flat. It is then a 3.9-unit blade rooted at the pins that crosses the whole
bowl and overhangs the far rim. Pruned to 1.64 it is a squared stub of the
narrow base. Lobed-leaf branch has the right kind of leaf at a fifth of the
size, on tall wood. See `artifacts/parasol-leaf/closest-stock-broad-leaf.png`.

## Form and craft

- One 14-segment stalk, `1.7..2.7` long, leaning and bowing to a seeded side.
- A `0.15` neck at its tip carries one round blade: radius `0.66` at scale 1,
  scale `0.92..1.14`, rim `0.085` above the attachment. The blade's normal is
  the neck tangent and rests 24–48 degrees off vertical, toward the lean.
- A 9-segment young stalk leaves the main stalk `0.17..0.22` above the base,
  on the far side from the lean, and carries a leaf that is still furled.
  It is `0.27..0.37` of the stalk's length, so the roll stays beneath the blade.

Shaping uses the existing verbs only. Both stalks take the bend bead. The neck
is a petiole: pressing the blade aims it and tilts the blade about the stalk
tip. A grip near the rim gives a finer tilt than a grip near the centre, which
is the existing surface-grip law and not a new control. Three cuts give three
silhouettes: young stalk (open leaf alone), main stalk (furled leaf alone; the
young stalk attaches below the `0.62` minimum trunk cut, so it always
survives), and neck (bare stalk beside the furled leaf).

It uses the existing `leaf` and `bud` kinds. Craft cues say "young leaf stem"
and "furled leaf" for this generator only.

## Rendering and cost

Six visible draws per cutting: three stems, blade, ribs, furled leaf. The blade
is one closed mesh of 1,344 triangles with separate upper and lower faces and a
real edge. Ribs are 364–420 triangles across both faces, 13–15 per face, each
dividing once. The furled leaf is 420 triangles: a spindle whose radius grows
once around the roll and steps back, open only at the stalk and the point.
No textures, alpha blending in committed state, lights or shadow maps were
added. The pick meshes are owned copies of those surfaces. These are static
counts, not frame timing.

## Evidence

Automated, `npm ci` and `npm run verify`: typecheck, **697 tests passed, 0
failed or skipped**, build, and standalone distribution validation.

- Determinism at three seeds, round trip, valid attachments, golden fixture
  `fixtures/plant-1-parasol-leaf-v1.json`, registration last in the catalog.
- Rest pose at ordinals 1, 2, 3, 17 and 64: tilt range, facing the lean, young
  stalk below the trunk cut, furled leaf clear beneath the blade plane.
- The three cuts, their cue wording, retained inactive history, and that a
  main-stalk cut leaves the young stalk byte-identical.
- Neck Aim moves only the neck; Bend on either stalk keeps every rest length.
- Coordinator insert, Aim, Bend and prune cancellation: no save, no ordinal.
- Working save, Garden keep, export, import and copy; an unknown version
  imports nothing and leaves the Garden unchanged.
- Closed outward blade topology, bounds, paler reverse, entire margin; rib
  counts and containment; furled-leaf bounds, boundary and step.
- Both blade faces acquire the neck; a ray just outside the margin hits nothing.
- The shared proxy-coverage test now lists `leaf:parasol`. Four enumerating
  tests gain the new ID. No other existing expectation changed.

Rendered, headless Chrome 153 with software WebGL at 1280 × 900: placement by
tap, blade tilt, stalk bend, cut previews, Keep, Photograph and backup, and a
fresh-profile import, working copy, prune and reload on the built standalone.
See `artifacts/parasol-leaf/`.

Not done: physical phone, real touch, GPU or frame timing, the remote
rendered-evidence job, and narrow-screen review of the tray entry. One
acquisition note for that pass: from Front, the young stalk sits close to the
main stalk for some turns of the cutting, and a press between them takes
whichever stem is nearer the pointer. From Above the blade covers its own
stalk, so the stalk is aimed from the side. Both follow the existing
arbitration order.

Reference: [NC State Extension — Nelumbo lutea](https://plants.ces.ncsu.edu/plants/nelumbo-lutea/),
read 2026-11-10, for round leaves raised above the water in a bowl-like form.
The central attachment, rib pattern and furled companion are authored choices.
