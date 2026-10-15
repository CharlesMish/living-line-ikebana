# Argon consultation: checked assumptions and Silver seed refinement

Reviewed against `7a9a12dab892e48e758de845b5e091ec25431a47` (Visit your Garden,
draft #101). This branch is stacked on `feature/visit-garden`. Nothing here
requires merging the earlier draft studies or changing public main.

## Decision

Refine Silver seed's derived membrane and keep the existing botanical stocks
and editing laws. The dry Lunaria-inspired partition was carrying a leaf-like
midrib and three pairs of side veins. That is the one supported anatomical
correction in the consultation. Remove those ribbons; retain the shallow closed
body, outer rim, silhouette, attachment, and restrained variation on both faces.

The replacement shading suggests uneven paper rather than a large radial vein
pattern. It is a stylized tonal treatment, not an optical simulation or a claim
that microscopic cellulose domains are visible at bowl scale.

## What the evidence supports

| Argon finding | Check | Decision |
| --- | --- | --- |
| Silver membrane has leaf-like venation | Source constructs a central ribbon and six pinnate branches on each face. Flora of Pakistan describes Lunaria's septum as membranous and not veined. | Remove these anatomical ribbons. |
| Silver stalks are world-locked | Their initial vectors are authored near world-up. `applyAimRotation` rotates active descendants; `remapActiveDescendants` remaps the child anchor, points and reference normal through the changed parent frame. | No edit-time world lock. Keep the stock unchanged. |
| Calyx reverses are culled or shaded backward | The adapter supplies `MeshStandardMaterial` with `DoubleSide`. Three r181 flips the normal for back-facing fragments. | No demonstrated defect; do not duplicate the mesh. |
| Vertex multipliers greater than one inherently clip | Linear working color is open-domain. The default rim's base color multiplied by the cited values is approximately `[0.532, 0.431, 0.258]` before lighting. | No blanket clamp. Removing the ribbons incidentally removes those ribbon values. |
| Compact cannot be shortened without losing its terminal bloom | Correct under the distal-prune law. A different initial length changes stock; an extra bloom changes topology. | Worth a separate versioned design study, not a renderer fix. |
| Starry and Violet share a three-arm structure | Substantial structural similarity, with distinct head shapes. No new user evidence establishes redundancy. | Keep; any future topology revision needs a distinct generator version. |

The adapter was absent from Argon's limited source packet. Its caveat about
`DoubleSide` was useful, but the conditional concern must not be promoted into
a confirmed rendering bug.

## Botanical corrections to the consultation

- The persistent silvery membrane is the **septum**; **replum** denotes its
  surrounding fruit framework. They are not interchangeable names.
- Guidetti et al. describe microscopic cellulose domains and a largely
  homogeneous macroscopic membrane, with visible funicles as exceptions. This
  supports quiet paper variation, not an assertion that every interior mark is
  impossible or a prescribed large radial stripe pattern.
- Opposite maple leaves are a useful reference, but not all Acer leaves are
  palmately lobed. A generic trimmed lobed cutting need not model a complete
  uncut shoot, terminal bud and every successive node.
- Square stems and exactly divided lips are not universal Salvia requirements:
  the Flora of Southern Africa describes S. dolomitica with terete stems.
  Indigo spire remains a generic stylization.
- Astrantia is best described here as a compact simple **umbel** surrounded by
  papery bracts. Treating the head as one selectable organ is an intentional
  abstraction, not evidence of an incorrect connection.

No new species is added. Pendulous catkins and a flexuose vine remain possible
future studies; the proposed exact angles and repeated paired curtain pattern
are design choices, not verified botanical rules.

## Petal geometry: preserve the existing repair

Argon's alternating-whorl proposal is not a guaranteed nonintersection bound.
With its allowed cup-rise jitter at longitudinal fraction `t = 0.8`, neighboring
petals still overlap in projection (half-width about `0.5334 * sector`). Whorl
separation is `0.016 sin(pi*t) = 0.009405`; an adverse cup-rise difference is
`0.012 t^0.78 = 0.010083`, and combined shell thickness is `0.004600`.
Clearance is therefore about **-0.005278**, before ripple. It is positive at
`t = 0.5`, so surface ordering can reverse within the overlap zone.

Keep the repaired disjoint convex petal sectors and their existing regression
checks. Original-stock stations also preserve Broad blade's clipping and detail,
but do not prove global non-self-intersection under every accumulated bend.
The nodding bell's inner throat ring is open, so the consultation's word
"watertight" is too strong; no visible failure was established there.

## Verification

Focused checks cover closed membrane and rim winding, perimeter-only accessory
geometry, deterministic restrained color variation, exact visible-surface hit
proxies from both sides, prune/cancel restoration and bounded rendering cost.
The membrane's positions and indices and the rim's original tube remain intact;
canonical generators and fixture files are unchanged.

Matched rendered evidence compares this candidate to the exact reviewed base,
using the same Silver seed graph, camera and photo controls. It includes bowl
views and close front/reverse views on light and dark backdrops. This is assisted
Chromium/SwiftShader evidence, not blind play or a physical-phone result.
Final run IDs and outcomes are recorded in the PR and private build provenance.

## References

- [Flora of Pakistan: Lunaria annua](https://efloras.org/florataxon.aspx?flora_id=5&taxon_id=242416802)
  (also [World Flora Online treatment](https://www.worldfloraonline.org/taxon/wfo-0000362471)).
- Guidetti et al. (2020), [Photonic paper: Multiscale assembly of reflective cellulose sheets in Lunaria annua](https://doi.org/10.1126/sciadv.aba8966).
  [Published paper at MIT](https://dspace.mit.edu/entities/publication/61468c82-9d5d-4001-afbe-89fcf0a8d043).
- [Flora of Southern Africa: Salvia dolomitica](https://biodiversityadvisor.sanbi.org/search/detail/d0e594b9-62b3-4c9d-99aa-d03651aa0faa).
- [University of Illinois: Acer carpinifolium](https://www.life.illinois.edu/help/digitalflowers/Vegetative/53.htm).
- [Cut Flower Exports of Africa: Astrantia](https://itp.lucidcentral.org/id/cutflowers/key/Cut_Flower_Exports_of_Africa/Media/Html/Fact_sheets/Astrantia.htm).
- [Three.js color management](https://threejs.org/manual/pages/color-management.html),
  [r181 two-sided normal handling](https://github.com/mrdoob/three.js/blob/r181/src/renderers/shaders/ShaderChunk/normal_fragment_begin.glsl.js).
