# Lobed-leaf reverse refinement

Source base: `c707845de8e11904e991ff76bec0a3b8b8310c28` (PR #91).

Charlie liked the front and connected lobed shape, but found the back less
finished. The source supports a specific explanation: the original lamina used
one double-sided material with the same color and roughness on both faces, and
all 208 vein triangles were raised toward local +Z. Seen from behind, the lamina
hid those veins. This explains the missing detail; it does not establish the
lighting or phone appearance of the owner's particular view.

## Changes

- Keep the existing connected lamina and front veins exactly. Five baseline
  SHA-256 hashes protect their positions, normals, vertex colors, UVs and indices.
- Give the reverse a paler, quieter version of its chosen foliage tone and a
  matte roughness floor of 0.86. Natural, Ochre and Russet each retain their hue
  family. The reverse uses less of the front's vertex-color contrast.
- Add the same palmate primary and secondary vein network to the underside,
  including the small basal rib leading toward the petiole. Its color is closer
  to the reverse lamina than the front vein color is to the front lamina.
- Seat these ribbons 0.0024 local units below the actual triangulated lamina.
  Using the rendered triangles rather than the smooth source formula prevents
  a ribbon from disappearing through a coarsely curved face.
- Cull each vein network to its own face. The lamina remains one double-sided
  surface with a front/back shader distinction, so there is no second coplanar
  leaf surface or ambiguous transparent face order.
- Include the reverse veins in the independently owned exact hit geometry.
  Notches remain empty and a reverse-surface press still aims/prunes the same
  supporting petiole. No per-vein target or enlarged halo is added.

This is presentation only. The generator, canonical leaf attachment, leaf
outline, core operations, saved scenes and existing Botanical tones choices do
not change. No new saved color field or botanically exact species claim is made.

## Evidence

Three new focused tests plus the existing lobed/tone tests: **10 passed**.
Typecheck and the full test run: **537 passed, zero failed/skipped**. The initial
verify stopped at Vite while the shared dependency installation was being
replaced. After it completed, the remaining `npm run build` and
`node tools/validate-dist.mjs` both passed: the standalone is self-contained.
The integration still needs its combined verification.

The new checks cover:

- Exact front buffers against the five pre-change hashes (seeds 0, 8278, 9255,
  10232 and 4294967295).
- Finite reverse normals and positive winding; every reverse triangle's
  vertices, edge midpoints and centroid stay inside and beneath the real lamina.
- Production Three.js raycasts from both sides, real notch gaps and the reverse
  vein as the foremost visible surface from behind.
- Standard shader alpha/output chunks retained, a live reverse-color uniform,
  and natural/ochre/russet updates without rebuilding geometry.
- Pending placement, doomed prune fade, cancellation reset and unchanged graphs.
- Independent geometry/material ownership and exactly one disposal event for
  each committed resource. No new texture or per-frame geometry work.

The shader was inspected and its standard-source transformation tested. These
are **CPU geometry/material tests, not a GPU render or physical-phone playtest**.
No screenshot is presented as evidence of finished appearance.

## Cost and remaining acceptance

Per leaf: one additional visible mesh containing 208 triangles, with another
208 triangles in its invisible acquisition mesh. A complete four-leaf cutting
adds 832 visible triangles and four visible mesh submissions, before shadow
passes. The original lamina is not duplicated. These are geometry/resource
counts, not measured draw calls or frame time.

The owner should orbit a Natural and a Russet lobed leaf, compare front/rear
vein contrast, and view a leaf near edge-on. Check the pending ghost and prune
fade from behind. The reverse should read as the same leaf's quieter underside,
with continuous attachment, rather than a dark blank cutout or pale sticker.
Front/reverse lighting and thin-vein stability at phone scale remain open for
that visual acceptance.
