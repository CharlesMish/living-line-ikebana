# Studio craft and photograph saving

This pass builds on the private Ultra Night preview / draft #87 at `51901de`,
not the deployed GitHub Pages build. Main was still `dd1ffe94` when checked.
It carries the earlier preview history and targets main directly, so the new
candidate can be reviewed without relying on a stale stacked PR base.

## What is ready to try

| Area | Change |
| --- | --- |
| Photograph | Larger framed preview, Scene / Frame / Save groups, readable framing values, optional composition grid |
| PNG delivery | Prepare an actual visible PNG; then explicitly Download, Share if supported, or Open image |
| Vessel colors | Chalk and Iron, alongside unchanged Sand, Celadon and Charcoal |
| Vessel surfaces | Satin microrelief and Speckled ceramic, alongside unchanged Glaze and Stoneware |
| Backdrops | Mist, Clay and Ink walls, alongside Warm paper, Sage and Dusk |
| Perches | Crafted oak bench, honed mineral stone, new low plaster plinth |
| Stem assessment | Lobed-leaf branch first; genuinely shapeable broad blade as a later study. No new stem shipped. |

The PNG change addresses a missing recovery path. It does not establish why the
owner's original download failed or prove that any particular embedded host
allows saving. Preparation creates a visible image and says it has not been
saved yet. A suppressed download no longer leaves the owner with no image or
alternative action. A stale asynchronous encode never replaces a current image.

Lighting remains fixed. Perch/detail work and the additional appearances are
presentation only; placement, tap/drag ownership, Undo, collision handling,
botanical geometry and garden identity are not revised in this pass. Layout
choices remain unchanged. Existing bench/stone scenes reopen using the refined
renderer; their old thumbnail pixels are retained. Saves using new appearance
IDs are refused safely by older clients that do not recognize those IDs.

## Verification and review

- `npm ci` completed on the integrating checkout.
- `npm run verify`: **488 passed, 0 failed, 0 skipped**; clean TypeScript check,
  successful build and self-contained distribution validation.
- New scene IDs, including Plaster plinth and a combined Iron / Speckled / Mist /
  Plinth setting, survive working save/reload and Garden export/import while
  preserving canonical plants, camera and legacy bytes.
- Production Photograph event-path tests use a non-rendering DOM/studio adapter;
  actual stage replacement/disposal methods exercise resource lifetime without
  a GPU. Both are automated source/control-flow evidence, not browser evidence.
- Independent review: **no source-level blocker for a draft owner playtest**;
  **35/35 focused tests** passed separately. [Full review](independent-review.md).
- Optional `photo-study.mjs` now exercises explicit Prepare then Download and
  current Garden v2 writes with legacy preservation; `photo-interruption.mjs`
  uses the new flow. Both pass syntax checks, **neither was run in a browser**.
- Actual procedural texture buffers were inspected as color/map sheets.
  **Fresh GPU rendering, browser layout and physical phone checks are unrun.**
  The managed environment has no supported browser-control capability.

Perch counts are in [the perch report](perches.md): the most detailed support,
Small bench, is 1,764 triangles and 14 mesh draws, plus its shadow pass. These are
counts, not phone performance measurements. Textures are small, deterministic,
self-contained and disposed with their owning renderer/stage.

## Short owner pass

1. In Studio → Vessel, try Chalk/Satin and Iron/Speckled. The plants must stay put.
2. In Photograph, try Mist with the bench, Clay with stone, and Ink with the
   plaster plinth. Check material detail feels quiet rather than distracting.
3. Prepare PNG. Confirm the actual image appears, then try Download; if the host
   declines, try Share or Open image. On iPhone, also try holding the image.
4. Change the live frame after preparing: the earlier image must stay available
   and be labelled. Prepare again; toggle the grid and check it is not exported.
5. Keep a scene in Garden, revisit it and reload. Transparent should omit all
   perches. A short portrait photo is enough to check the new mobile workspace.

## Lane reports

- [Photo delivery and framing](photo.md)
- [Vessel finishes and backdrops](finishes.md)
- [Perch craft, cost and ownership](perches.md)
- [Two botanical directions worth studying](stem-gaps.md)

No main merge is included in this work. The private preview is the playable
handoff. Final GitHub and Site commit identifiers are recorded in the PR and
preview provenance; the source report avoids a self-referential commit hash.
