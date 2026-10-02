# Photograph and quiet staging study

Opt-in on `experiment/photo-staging-study`, based on `09db578` (PR #63).
Use `?photo=1` to reveal **More → Photograph**. No changes to core geometry,
generators, input ownership, contact policy, working save schema, or Garden schema.
This is an isolated playable prototype, not a default presentation change.

## Owner path

Run `npm ci`, then `npm run dev -- --port 4177 --host 127.0.0.1`.
Open `http://127.0.0.1:4177/?photo=1&workbench=1`. Workbench uses separate
bowl/Garden keys; use its disposable fixtures. Never clear a personal origin.
Alternatively open the generated standalone HTML with `?photo=1&workbench=1`.
A local HTTP origin is the tested route; physical Safari download behavior remains open.

1. Use More → Materials workbench to load a synthetic fixture, or arrange disposable stock.
2. Step Back to choose a view, then More → Photograph. Opening cancels any live edit.
3. Compare paper/ground to paper/stone, sage/stone and dusk/bench. Use View, Closer,
   Across and Height. These recompute a camera from one fixed pose; plants never move.
4. Export landscape (1600×1200), portrait (1200×1600) and square (1600×1600).
   Transparent cutout omits floor/perch and fog. The vessel and water remain.
5. Toggle stem fibers and look closely at a woody or green stem. Default off is
   the recommendation until someone prefers it; no extra silhouette geometry exists.
6. Keep photo in Garden explicitly. It adds one new v1 moment, with a ≤80,000-character
   360×270 JPEG cover and the exact committed graph copy plus the photo camera pose.
   Existing entries stay unchanged. Opening the card shows the arrangement in the
   ordinary studio. Dressing and frame aspect are not restored. This is a cover/bookmark,
   not a saved environment. A transparent cover receives a paper matte for JPEG.
7. Close/Escape and continue Arrange/Step Back. Try a changed edit and Undo.
   Repeat capture, close during capture, reopen, and Keep. Check the browser download.

## Presentation boundary and integration with vessel work

`Photograph` owns a temporary snapshot and separate `ThreeStudio` instance. Its
canvas has fixed vertical FOV 44 and an aspect matching export. Main camera,
posture, selection, Undo checkpoint, ordinal and graph autosave remain untouched.
The photo renderer copies pixels immediately at DPR 1, then restores the preview
size and projection in `finally`. Async encoding uses a session token so closing
cannot deliver an old capture in a new session. No upload or new analytics.

`ThreeStudio.setPhotoStage(backdrop, perch)` changes only floor/background/fog and
one disposable unpickable perch group. Fixed lights, tone mapping, exposure and
botanical materials are retained. All perch tops are at -0.025, just below the
current vessel bottom. This depends on the current vessel; the other lane is not edited.

For integration, a vessel presentation adapter should provide a transient staging
interface `{ contactY, footprintXZ, visualRoot }` (or equivalent bounds) to the
photo adapter. Perch tops then use `contactY` and minimum footprint clearance.
Do not derive seating bounds or planting geometry from those meshes. Keep vessel
profile persistence and validation in that lane. Pass a resolved profile to both
main and photo studios; do not translate graphs to make a perch fit. The current
study does not promise compatibility with future asymmetric/two-basin profiles.

### Independent vessel study (#65): unresolved persistence interface

PR #65 is intentionally separate. Its Garden backups do not preserve vessel
identity and require the same named layout on restore. A photo cover can record
that vessel visually, but the current v1 arrangement cannot reconstruct it.
Combining the two without a resolved layout descriptor could therefore show a
faithful cover and reopen a different vessel/planting footprint. The photo
renderer must receive the same resolved runtime vessel profile as the main
studio, and Garden restoration must have an explicit matching-layout policy.
This branch neither merges #65 nor extends the Garden save schema. Exact
vessel/staging restoration remains an integration blocker, not a cover migration.
Both lanes touch ThreeStudio presentation wiring; merge that interface deliberately
instead of replacing one buildStudio implementation with the other.

`stemSurface.ts` derives transported radial coordinates and rest-arc distance from
existing ten-facet tube rings. The shader modulates diffuse color by at most 7.5%;
no normal, roughness, position, index, radius or pick proxy changes. Angular
coordinates use a cosine/sine pair to avoid a seam-wrap stripe artifact. Detail
is stable through proximal pruning and is confined to structural stems in the
photo copy. It is not a botanical node model or a texture asset pipeline.

## Evidence and limits

- `npm ci` completed. Typecheck, build, standalone validation and diff whitespace check pass.
- 352/353 tests pass on macOS Node 24.19.0. The single failure is
  `the phase 2 garden backup is the two frozen bowls`: float differences around
  10^-16 in a strict frozen fixture comparison. Untouched baseline reproduces
  349/350 with the same failure. Do not call full verify green.
- 17 existing browser smoke checks and 7 toolbar/viewport cases pass in Chromium.
- Photo browser checks cover canonical/camera/ordinal/autosave invariance, repeated
  capture/Escape, Garden legacy entry preservation, reload/View/Return, quota failure,
  unknown Garden version preservation, PNG failure/retry and close during encoding.
- Photo controls fit 320×568, 390×844, 844×390 and 390×844 at 200% root text.
  This is desktop browser sizing evidence, not physical phone feel.
- Main scene pixels match the baseline in the scene area. Fiber-off restores exact
  clean photo pixels. Transparent exports have alpha 0...255 with zero-alpha corners;
  opaque exports have alpha 255 everywhere. Exports are deterministic chosen sizes.
- A second WebGL renderer is live only during Photograph; resource behavior on a real
  phone, iOS memory pressure, Safari Save Image/Files flow, and physical touch comfort
  remain untested. No phone timing, FPS or acceptance claim is made.

The smallest useful candidate is quiet staging plus framing/export and a Garden
cover. Fibers are a reversible close-up study; no default stem makeover is recommended.
