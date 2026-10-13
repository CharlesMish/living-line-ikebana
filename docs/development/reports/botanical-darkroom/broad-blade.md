# Broad blade v1 — edit law and bounded study

## Law written before implementation

One persistent `trunk` record is the complete petiole and midrib of one broad leaf. The bare basal portion is a petiole visually, but the complete centerline uses the existing structural branch grammar so the blade itself can bend. There is no enlarged rigid organ. A `broad-blade-v1` graph has no leaf organ records: its blade is an inseparable, versioned surface of that centerline.

The original stock dimensions and blade onset are immutable deterministic functions of the saved generator version and seed. Surface width, modest transverse cup, vein shading, and UVs are evaluated at **absolute rest-arc distance along that original stock**, never at a fraction of the remaining active length. Current persistent branch points and transported reference normal supply the centerline and face orientation. Aim rotates that whole material, and Bend deforms its centerline through the existing rest-length-preserving solver. No independent twist, fold, or elasticity simulation is promised.

A transverse Prune truncates the midrib through the existing prune law, and clips the distal lamina at that same material station. It does not resize the surviving blade, move its basal onset, reroll details, or replace its tip with a new tapered tip. The retained width at the new cut is the former stock width. Cutting below the blade leaves the basal petiole. A prune preview shows exactly the same retained lamina as applying that prune; the removed lamina is faded separately. Cancel restores the acquisition graph and its surface. The branch remains its original stable ID; reload reconstructs from the saved centerline, seed, version and activeLength.

A press on the actual lamina maps the intersected triangle's interpolated absolute rest-distance UV back to its supporting branch. That station, rather than the nearest projected centerline point, determines the acquired prune/bend station; the visible surface point supplies the Aim grip. The lamina has no spherical hit enlargement. Existing stem hit and screen-near-miss rules remain for the midrib itself. The leaf is double-sided in presentation and never faces the camera automatically.

Stem-overlap inspection and prevention still cover structural stem envelopes only, including this midrib. They do not prevent blade/leaf-area contact, self-intersection, folding or blade/bowl penetration. This is a craft study, not a botanical mechanics claim.

## Scope and evidence

Implementation and verification results follow below. No supported browser tool or physical phone is available in this environment; no GPU visual acceptance or player acceptance is claimed.

## Implemented

- Additive material `broad-blade`, generator `broad-blade-v1`; one 24-segment midrib, no organ records. New stock is 3.8–4.35 units long, with a clear 0.78–0.90-unit basal petiole and a blade about 1.0–1.2 units across at its widest. These are authored game proportions, not measured cultivar dimensions.
- The lamina is modestly cupped, dark green, two-sided, and carries restrained longitudinal vein shading. Fixed stock rows plus current midrib joints keep it attached along bends. A per-branch surface is rebuilt only with actual geometry/prune changes.
- Exact surface UV acquisition is used for both initial blade hits and later prune movement. Midrib tubes keep their old projected-station rule. The app integration accepts the blade's actual visible Aim grip (coordinated with flower-handling lane).
- Persistence and recovery use existing schema 1 graph fields. Unknown-generator refusal on old builds remains intentional; new stock must not be sent to an old client as though it were supported.

## Automated evidence

Five focused tests pass across seeds 8278, 9255 and 10232: deterministic catalog/valid stock; real lamina deformation under shared Bend; stable rest lengths, UV and color detail under Bend/reload; exact prune-preview/commit geometry with unchanged proximal vertices and full-width cut; production ThreeStudio surface hits and prune stations from Front, oblique and reverse cameras at 390×844 and 1280×800; and real coordinator insertion/prune cancellation, committed save and Undo. The tests use production Three.js geometry and raycasting with GPU drawing omitted. They are not browser or phone play.

The focused picking/visibility run is 13/13 including eight prior regressions. Typecheck, build and standalone distribution validation pass. The lane-wide run is 490/493: only three old exact-twelve catalog/list expectations fail after the additive catalog entry. Those shared assertions are intentionally left to the integration owner to update once all new material lanes are combined; this is not a claim of a passing full integration gate.

## Remaining checks

Owner should compare one broad blade plus one reed/woody line against leafy shoot, fern and foliage fan, view the face nearly edge-on, then cut through the broad portion and Undo. Determine whether the shared single-station bend offers enough useful face control. No blade-area contact protection, arbitrary folds, side notches, torn contours or independent axial twist has been added. A new material's compositional usefulness remains a player judgment.

### Resource review follow-up

Root review identified that replacing attributes on every blade update could orphan GPU buffers. The adapter now reuses position, normal, color, UV and index BufferAttributes while topology length is stable. When clipping/restoration changes topology, it dispatches `geometry.dispose()` before replacing any attributes; the reusable geometry is populated afterward. The sixth focused regression checks attribute identity through Aim/Bend, the old attributes still being attached at the disposal event, preview-to-commit reuse, and disposal before restoring uncut topology. All six focused tests and typecheck pass after this correction. This is a source/resource-lifecycle check, not a GPU memory measurement.
