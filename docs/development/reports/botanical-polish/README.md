# Botanical polish pass — stems, flat blades, repeated parts

November 16, 2026 · Claude Opus 5.5 · branch `experiment/botanical-polish`

The owner asked for a serious pass on what reads as artificial. That meant
stems that are perfect cylinders, blades that are perfectly flat plates, and
repeated parts that are identical every time. This is meant as a base that
Fable or Astra can refine after seeing it. It is presentation-only: no graph,
generator, schema, gesture or save changes. `?surface=baseline` restores the
earlier look in the main studio and the Garden viewer, for side-by-side review.

## What changed

**Stems** (`src/presentation/stemShape.ts`, used through an optional `TubeSkin`
in `geometry.ts`). Every value depends only on stock coordinates: distance from
the branch's own base along its original rest lengths, the uncut stock length
(regenerated deterministically from the generator and cached), and the graph
seed plus branch id.

- **Taper.** It is keyed by stem character: herbaceous, woody, grass-like or
  succulent stalks. Short stalks taper gently. Bending never changes a ring's
  radius, and a cut never re-tapers the stock that remains.
- **Side branches** start no thicker than their parent where they leave, and
  the parent swells into a small **collar** there. Collars are kept for pruned
  side branches too, because their records are retained.
- **Ends.** An uncut growing tip closes in its own colour: sharp on reeds and
  twigs, blunt and round on herbaceous stems. A stalk ending in a flower or
  berry swells slightly into a receptacle. Only a real cut, and the base in the
  pins, keep the pale cut face. Before this pass, every tip showed a pale cut
  face.
- **Variation.** A faint thickness wave, a slightly oval cross-section, and a
  tone from darker, warmer older tissue at the base to lighter young growth,
  with a per-branch tint, so two stems of one material are not identical.
- **Not changed:** ring centres stay exactly on the graph's points. Picking,
  cut caps and organ seats therefore match what is drawn, and the existing
  "tube follows graph" and "cut cap stays under the press" tests hold. Hit
  proxies keep their own uniform radius.

**Leaves and other blades** (`src/presentation/organNaturalism.ts`). This is a
final pass over each finished organ geometry, applied before any exact hit copy
is made. The authored geometry modules and their unit tests are untouched.

- **Long blades** (elliptic, lanceolate, fan, fern pinnae) get a seeded,
  length-preserving recurve of the midrib and a sideways curve. They also get a
  cup or flattening across the blade, a slight twist and an undulating margin.
  Veins get the same field and stay on the surface.
- **Lobed leaves:** each lobe sits at its own height and the outer lobes droop.
- **Parasol blades** settle on one side under their own weight, pucker slightly
  between ribs and flutter at the margin. The ribs follow.
- **Silver seed discs** vary in size and outline, twist slightly from the stalk,
  and have a satin rather than chalk finish (roughness 0.91 → 0.62).
- **Broad blade** (`broadBladeGeometry.ts`, `natural` argument): a slow twist
  about the midrib and an uneven cup on the two halves, by stock station.
- **Leaf colour:** a per-leaf value shift, and a warmer margin on about 30% of
  leaves (the older ones).
- **Repeated flowers:** a restrained per-head colour shift. Geometry and head
  transforms are untouched.

**Acquisition is never loosened.** Leaves that use a sphere proxy are bent only
as far as the proxy's real polygon faces allow, by a uniform scale of the whole
field, never a reshape. Elliptic leaves keep about 55% of their natural form on
average, because their proxy fits the tip closely. Lanceolate leaves keep all
of it. Exact-surface organs (lobed, parasol, seed disc, broad blade) acquire
exactly what is drawn.

## Evidence

Automated: `npm run verify` passes. New `tests/presentation/naturalSurfaces.test.ts`
covers:

- ring centres on the graph
- taper by stock distance
- bend invariance
- cut invariance of retained rings
- cut face vs closed tip
- parent fit and collars
- seat independence
- deterministic, organ-specific leaf curls inside their proxy
- seed disc and rim bending together
- the baseline draw being byte-identical to authored leaves, with no graph
  change

Every pre-existing test passes unchanged.

Headless Chrome 153 with software WebGL (not a phone, not a GPU timing):

- [`specimens-before.jpg`](specimens-before.jpg) / [`specimens-after.jpg`](specimens-after.jpg):
  every tray cutting, one per bowl.
- [`close-ups-before-after.jpg`](close-ups-before-after.jpg): closer looks at
  stems and blades.
- [`guest-arrangements-before-after.jpg`](guest-arrangements-before-after.jpg):
  the six guest arrangements in the Garden viewer.

Stems are the clearest change. Fable's bare branch now thins to fine twigs
instead of ending in a blunt, pale-capped log. Leaf changes are deliberately
restrained when seen face-on and read most clearly at grazing angles and from
above.

## Tried and taken back

- **A gentle bow in plain stalks.** It moved the visible tube off the graph,
  which breaks picking alignment, the cut-cap-under-the-press rule and "tube
  follows graph". A natural curve in a stalk belongs in a new generator
  version. See the hand-off list below.
- **Per-flower size, depth and tilt, and spikes opening from the bottom.**
  These moved visible petals relative to their acquisition spheres and to the
  head grips that tilt them. Colour-only variety replaced them.
- **A rippled margin on the broad blade.** A cut preview re-rows the lamina,
  and the ripple stopped a press from holding its exact station during prune
  movement.

## Hand-off list for Fable or Astra

Highest value first:

1. **Natural curvature in generators (new versions, additive).** *Second pass:
   new tray cuttings now settle into a seeded natural pose, which covers the
   sway and the uneven arms. Authored kinks at nodes and less regular
   branching are still generator work.* Straight
   stalks are now the most "drawn" thing left. Examples are the starry
   pincushion's trunk and pedicels, the silver seed stalks, indigo and lantern
   pedicels, and the reed. Versioned generators (for example
   `starry-pincushion-v2`) with slight bows, kinks at nodes and less regular
   branching would fix this at the source, without breaking the presentation
   rules above. The starry pincushion trunk also continues past its top side
   branch as a bare stub, which reads oddly.
2. **Flower variety at the generator level.** Organ scale and opening stage
   vary along a raceme, as buds, half-open and open flowers. Indigo spire,
   lantern spray and blossom spray would benefit most. This needs the
   acquisition proxies to follow, so it belongs with the generator and its
   appearance, not in a presentation pass.
3. **Starry pincushion leaves.** They are small, flat and cut-out. They need
   the same blade treatment, but they are exact-surface pinnate shapes of
   their own.
4. **Leaf proxies for elliptic leaves.** Their spheres hug the tip, which caps
   how much they can recurve. A slightly larger or ellipsoidal proxy would let
   them keep their full form. That is an acquisition change and needs phone
   checks.
5. **Petal-level variation** in compact, spray and violet heads *(second pass:
   the whole corolla now warps; per-petal cupping is still open)*: individual
   petal cupping and slight unevenness inside the authored corollas.
6. **Lighting response.** Leaves are opaque and evenly matte. A little
   transmission or back-lighting on thin leaves, and a soft sheen on glossy
   ones, would do as much for "not plastic" as more shape.
7. **Phone review.** Nothing here has been looked at on a phone. Thin tapered
   tips may need a minimum on-screen width at small sizes.

## Second pass — November 22

Claude Fable 5.2 · branch `experiment/botanical-polish-2`, from `main` at
`80989c2`. Not merged, no pull request.

The owner's note: cuttings were still "slightly too perfectly symmetric", with
stems lacking any slight natural variation, and flat parts that were all flat
in parallel. He asked for slight curvature in petals and leaves with two
folds, without losing what makes each plant read as itself.

### What changed

**1. A natural pose for new cuttings (revises the contract; see its note).**
The first pass learned that the drawn tube cannot leave the graph, so the
variation has to be in the graph. Twenty-one new generator versions would be
heavy and would leave older builds unable to open new saves. Instead
`src/core/naturalPose.ts` settles the generator's stock, once, when the app
prepares a tray cutting:

- Each bendable stem takes two broad seeded bends through the shared Bend
  law, the upper one mostly answering the lower, so a stem sways instead of
  arcing. Stiffer stock sways less.
- Each side branch, twig and stalk is aimed a few degrees off its drawn
  angle through the shared Aim law, carrying everything it bears. Paired arms
  stop mirroring each other.
- Leaf and flower stalks with no side shoots take a slight fixed curve. Their
  first segment keeps its direction.
- Each organ rolls a little about its stalk and differs in size by up to 7%.

Everything is seeded by the graph's own seed and record ids. Topology, ids,
rest lengths, stations, radii and stiffness are the generator's, so taper,
collars and cut faces from the first pass are unaffected, and the result is a
graph that builds recognizing that generator version can open. Per-generator
profiles temper the pose where a gesture is authored: nodding flowers and
lantern stalks are disturbed less, the reed sways more, fern pinnae vary more.
`?pose=stock` seats the stock design for comparison. Generators, Workbench
fixtures and the golden fixture are unchanged. Reopening an existing bowl or
guest arrangement restores its saved stems and edits without applying a new
pose. Its live leaves and petals can catch the light differently under the new
surface draw. Previously saved covers and exported photographs do not change.

**2. Depth in leaves and flowers (presentation only, `organNaturalism.ts`).**

- **Two folds, never alike.** Each half of a blade folds from the midrib by
  its own seeded amount and turns back down a little at its margin. Most
  blades are a lopsided V, some lie nearly flat, a few roof downward.
- **Divided blades** (fern pinnae) vary the fold from leaflet to leaflet.
- **Lobed leaves** pleat along their five main veins, each lobe by its own
  depth, instead of lying as one plate.
- **Flowers that face forward** (cupped, open-face, open-cup, compact, spray,
  violet and starry heads) take a low seeded warp across the whole corolla:
  some petals reflex, others reach forward, the face tips slightly, petals
  differ a little in reach. It fades to nothing at the centre so the eye,
  calyx and anthers stay seated. Separate petals share one field, so the
  flower reads as one thing.

All of it is bounded by the existing acquisition proxies. Separate petals
needed the proxy's faces turned into each petal's own frame, and vertices
already resting on a proxy face may now only slide along it. Bell, lantern,
indigo and tufted heads are untouched: they are bodies of revolution about a
different axis and want their own treatment.

### Evidence

Automated: `npm run verify` passes (722 tests, typecheck, build, dist
validation). New `tests/core/naturalPose.test.ts` checks, for every tray
material at three ordinals: unchanged identities, order, stations, radii and
rest lengths; every segment at its stock length; every child still attached
at its parent station; the cut end unmoved; a valid graph; repeatability;
different cuttings settling differently; a bounded departure from the design;
and that a settled cutting seats elsewhere, bends and prunes under the same
laws. It also covers `?pose=stock`, zero strength and that core insertion is
untouched. `naturalSurfaces.test.ts` gains the uneven folds and the corolla
(repeatable, one field across turned petals, quiet centre, inside its proxy).
The existing all-materials proxy containment test passes with the new fields.

Played in headless Chrome with software WebGL (not a phone, no GPU timing):
blossom spray, silver seed and fern frond were each seated by a pointer drag
from the tray, had the trunk dragged and a side branch dragged in Shape, a
stalk cut in Prune, and the page reloaded. Each edit reported "Set." or
"Cut.", stock lengths held after every step, pruned records were kept, and
the reloaded bowl was identical to the one before reload. No page errors. Two
404 resource loads appeared in the console during those runs and were not
traced; they do not appear on first load.

Rendered, same build and camera, `main` on the left:

- [`pass2-cuttings-before-after-1.jpg`](pass2-cuttings-before-after-1.jpg),
  [`pass2-cuttings-before-after-2.jpg`](pass2-cuttings-before-after-2.jpg):
  all 21 tray cuttings.
- [`pass2-stems-close-before-after.jpg`](pass2-stems-close-before-after.jpg)
  and [`pass2-leaves-petals-before-after.jpg`](pass2-leaves-petals-before-after.jpg):
  closer, against `?pose=stock&surface=baseline`.

Inferred, not checked: organ picking on resized organs (the organ frame
scales the drawn surface and its proxy together, and the containment test
runs on stock scale); the Home room and the invitations branch, which seat
through the same app path and should simply receive settled cuttings; cost on
a phone (about 2 ms for the largest cutting in Node here, once per insertion).

### What to look at

1. **Amounts.** They are set to be felt more than seen: clearest in the
   silver seed stalks, starry pincushion, fern, blossom spray and the plain
   single stems. `settleNaturalPose` takes a strength, and the limits are
   named constants at the top of the file.
2. **Parasol leaf.** Its drip tip can now turn enough to show its darker
   underside as a small dark fleck from some angles.
3. **Single-segment stalks** cannot curve, only aim. A curve there needs more
   points from the generator.
4. **The bowed-axis starry study (#122)** would stack with the pose if
   promoted. Not tried together.
5. **A phone pass** for touch picking on the smallest flowers, since petals
   now leave their plane slightly.
