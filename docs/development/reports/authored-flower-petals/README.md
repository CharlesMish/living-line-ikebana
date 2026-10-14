# Compact and Blossom spray: fitted petal surfaces

## Scope and evidence

Charlie's supplied close photograph shows triangular parts of neighbouring petals
piercing through the middle of Compact and Blossom spray's surfaces. Both draws
used the same broad eight-petal mesh with independently tilted/scaled instances.
The section crossings are real: an independent segment/triangle face-interior
probe finds them for both old scatter recipes at seeds 8278, 9255 and 10232.

This revision changes rebuildable appearance only. Compact's v1 graph and both
Blossom spray generator versions, saved organ scale/spin/frame, tone IDs,
pedicel ownership, .56 acquisition sphere, pruning and persistence stay exact.
Flower volume's archived eight-petal draw stays byte-identical; Single flower,
Flowering branch and all other forms are outside the change.

## Authored forms

- Compact: one eight-petal cup with rounder petals, .461 nominal radius, a
  deeper continuous rise, broad inner shoulders and gently relaxed tips. That is 12% wider than the
  former .412 nominal tuft and the new open spray; stem height is unchanged.
- Blossom spray: one lighter six-petal open flower per existing bloom. Nominal
  radius remains .412. The visible opening, petal count and shallow profile
  distinguish it from Compact without changing any group or bloom positions.
- Each thin petal has a closed, shaded reverse. Curved sepals and a filled rear
  receptacle connect the flower to its actual supporting stalk. Small physical
  filaments connect the anthers to the centre rather than leaving floating dots.
- Petals occupy disjoint convex polar sectors. Stable seed variation acts inside
  each sector. There is no independent whole-petal tilt that can pierce a
  neighbour. Small negative-space seams are deliberate, not missing back faces.

This is not collision protection between separate blooms, cuttings, petals and
leaves. Such arrangement-level overlaps retain the existing structural-only
collision scope. No new petal-editing or solver law is introduced.

## Verification

Initial repair: `npm ci` and `npm run verify` passed with clean typecheck, **615 tests**, zero
failures/skips, production build and self-contained distribution validation.

- Independent triangle crossing probe: old Compact and old spray fail; both
  new corollas pass the same check across three seeds.
- Constructive nonintersection guard on 35 seeds per form: infer petal components
  from connectivity and check every vertex in its separate convex sector. Every
  triangle is a convex combination of those vertices, so petals cannot intersect.
- Closed two-sided manifold, no zero-area faces, outward front/reverse winding,
  positive signed volume, finite unit normals, deterministic position/normal/color
  arrays, width/depth distinction and margin within the unchanged hit sphere.
- Three frozen flower-volume position/normal/color/index hashes hold.
- Existing canonical fixtures, pruning/rollback, head acquisition and other
  material invariants run in full verify; source core generators are unchanged.

CPU geometry is not rendered acceptance. The integration supplies whole-view
Front/Above and closer three-quarter/reverse images, plus browser save/reload.
Compact adds complete head-focused captures for the fullness revision. No
physical phone or Safari/frame-time claim is made.

### Compact fullness follow-up

The first safe-sector repair removed the piercings, but the rendered review
showed an overly open, regular eight-spoked face. Compact now widens quickly
above the attachment, keeps its shoulder broad and rises into a deeper cup.
Small seed variations in shoulder roundness and cup height stay within each
petal's sector. Its outer radius and the lighter spray recipe are unchanged.

An independent ray/triangle silhouette probe at face radii .14, .24 and .32
measures occupied angles. Across seeds 8278, 9255 and 10232, inner-radius
coverage rises from 83.9–84.2% to 97.8%; middle/outer coverage is 95.3–97.8%.
Peak cup height increases from about .195 to .249–.252. This restores body
without overlapping a second petal layer or changing the existing hit sphere.

The combined candidate passes **630/630** tests after the revision, with clean
types/build/distribution. All six focused authored-flower checks pass: the actual
triangle-piercing regression, 35-seed nonintersection/envelope proof, closed
outward shells, deterministic form distinction, projected fullness and the
frozen archived-tuft hashes. Matched rendered acceptance for this follow-up is
recorded separately by the combined candidate's browser report.

## Cost

One corolla mesh replaces the old instanced petal mesh. Receptacle/sepals remain
one draw. A fine-filament mesh adds one draw per bloom. Center remains unchanged;
anthers increase from eight to ten instances in their existing draw.

| Part triangles (seed 8278) | Old tuft | Compact cup | Spray cup |
| --- | ---: | ---: | ---: |
| Petals, actual instances included | 1152 | 3200 | 2400 |
| Calyx | 320 | 224 | 208 |
| Filaments | 0 | 160 | 160 |

Including the additional two anthers, the net addition is 2184 triangles for
Compact's one flower and 1368 per spray bloom. Closed petal backs and curved rims
are intentional close-photo detail; they do not add transparent rendering passes
or textures. Phone frame time has not been measured.
