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

1. **Natural curvature in generators (new versions, additive).** Straight
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
5. **Petal-level variation** in compact, spray and violet heads: individual
   petal cupping and slight unevenness inside the authored corollas.
6. **Lighting response.** Leaves are opaque and evenly matte. A little
   transmission or back-lighting on thin leaves, and a soft sheen on glossy
   ones, would do as much for "not plastic" as more shape.
7. **Phone review.** Nothing here has been looked at on a phone. Thin tapered
   tips may need a minimum on-screen width at small sizes.
