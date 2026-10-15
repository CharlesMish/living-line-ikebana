# Visit your Garden and working backdrops

Owner commission: pair three saved 3D arrangements with their kept photographs in
one small place, and make backdrop choices visible while arranging. Baseline is
`689ce9b` (#97, owner-private preview). This branch changes presentation and adds
separate local display preferences. No botanical generators or craft laws change.

## Try it

1. Studio → Backdrop offers labeled samples of every opaque backdrop. Choose one
   while arranging; the accepted choice reloads with the working bowl. Photograph
   uses the same visual picker and additionally offers Transparent. A customized
   photo setup stays as you left it; Reset photo setup adopts the working setting.
2. Keep up to three moments in Garden (Photograph → Save keeps a prepared image
   and the corresponding arrangement). Studio → Garden → Visit your Garden opens
   the three most recent moments with their real vessel and botanical surfaces.
3. Tap a piece or use Left/Centre/Right to approach it. Drag to orbit, pinch or use
   +/− to change distance. Canvas arrow keys orbit, +/− zoom, Home resets the view.
4. View photograph inspects the saved cover pixels. Choose moment replaces that
   display reference; choosing a piece already on display swaps positions. Leave
   this position empty remembers an empty slot. Missing photographs stay blank.
5. Make a working copy uses the existing keep/replace/cancel flow. Back to Garden
   and closing Garden restore the untouched working bowl, posture, camera and Undo.

## Design and ownership

One shared plaster alcove, timber display bench and stone floor. Geometry stays
at world scale 1; wide stock earns wider spacing. The three botanical/vessel groups
share a single WebGL renderer and light rig. Each framed photograph keeps the
original image treatment. No per-piece lights, planted props, growth or scoring.

`ThreeStudio.createDisplayGroup` reuses established botanical/vessel builders
without a canvas, WebGL context or event handlers. Resource ownership is separate
for each entry even when the same plant IDs recur. Print decoding is asynchronous
and generation guarded. Display rendering is on demand and all owned resources
are released on close. Image decode failure is a per-print warning; graphics
failure leaves an explicit retry/close path and cannot touch saved work.

Preferences use `<Garden key>:display-v1` and contain only three entry IDs/nulls.
Opening is read-only. Choosing saves first, then applies; stale/corrupt preferences
cannot be overwritten. Deleting a saved entry leaves an empty display position.
Preferences are device/browser-local and excluded from existing Garden backup;
artworks and images remain fully covered by the existing backup path.

## Verification

Focused storage, UI event, derivation, resource and working-backdrop tests are
included. Full local verification and rendered CI results are recorded in the PR
and deployed provenance for the exact head. Browser checks use assisted ordinary
UI insertion and fresh profiles; they do not establish blind-player usability.

The render harness records empty/populated views, distinct saved materials/vessels,
all three focus positions, original cover pixels, selection/reload, rejected
storage writes, copying/cancellation, working Undo and preserved Garden bytes.
Screen cases include narrow portrait, short landscape, desktop and 150% root text.

## Limits and owner phone check

- No physical phone/Safari frame-time claim. Three complete bowls may be expensive
  for dense collections; start with three and measure before expanding to six.
- Kept covers are existing JPEG images, up to 640 px on the long edge. Close print
  inspection can show softness. The downloaded PNG is still the full image.
- Display choices do not travel in Garden backups. No backend or cross-device sync.
- The shared visit lighting intentionally differs from individual photographs.
- Overview can make a wide collection small on portrait; approach a position for
  inspection. There is no automatic scene expansion beyond three positions.

On iPhone: open a real collection, approach all positions, orbit/pinch, choose a
replacement, view a print, return to the bowl and use Undo. Check legibility,
selection comfort, graphics loss/background-resume, and whether the shared room
feels like somewhere worth revisiting. Report device and build separately from CI.
