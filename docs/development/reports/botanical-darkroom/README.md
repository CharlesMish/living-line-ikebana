# Botanical choice and Photograph finish

Candidate follows the owner-played PR #90 tree (`3226687`). Source verification
was run at the tree committed as `91cbc76`; this report is a documentation-only
follow-up. This is a draft for owner play, not a main merge or phone acceptance.

## What changed

- Stem-overlap inspection starts on. Prevent overlaps remains off by default and
  still covers structural stems only, not petals or broad leaf surfaces.
- Bare branch, Leafy shoot, and original Flower volume remain available under
  Materials → More cuttings. Existing saves and frozen generators retain them.
- Single flower's visible head gets balanced camera-axis tilt. Its stalk and
  other flowers retain ordinary Aim. The actual stalk still moves rigidly;
  this is not an independent petal or axial-roll editor.
- Compact flower: one modest tufted head on a shorter stem and its own pedicel.
- Lobed-leaf branch: four whole five-lobed leaves on a sparse woody line. Its
  empty notches are also empty for picking. Autumn ochre and russet are available.
- Broad leaf: a continuous blade that follows its bendable midrib. Pruning clips
  original stock, retaining the surviving blade's width instead of retapering it.
- Studio → Botanical tones gives each supported material Natural and two curated
  alternatives. A choice affects every instance of that material in the bowl,
  including future insertions. Reed and arching trailer keep their original greens.
- Photograph → Finish adds Exposure, Contrast, Warmth, Saturation and Vignette,
  Original/Finish comparison and an independent reset. PNG and Garden Keep use
  the displayed choice. Garden remains the place to keep adjusted photographs;
  this pass does not add a separate corkboard or duplicate image database.

The user-confirmed PNG delivery workflow from #90 is retained. No download is
claimed completed merely because the browser received a request.

## Compatibility and ownership

The live catalog now has fifteen materials. The established twelve remain in
catalog order; the visual picker moves the three secondary choices to its last
fold. New generators append; old named profiles and canonical fixtures do not
change. New stock has explicit versions. Existing graphs are never converted.

Plain scenes remain `sceneVersion:1`. Applying botanical tones or a nonneutral
photo recipe explicitly writes `sceneVersion:2`, within the existing working and
Garden v2 envelopes. That makes older clients refuse an enhanced scene instead
of silently dropping its new fields. Read-only legacy loading writes nothing.
Both recipes round-trip together and reset independently; a previously enhanced
scene stays v2 after reset. Unknown versions, keys or invalid ranges fail closed.
Older builds also refuse the new generator IDs; use this build for bowls using
these additions. The private preview keeps its original origin and storage keys.

Working views, Garden views/copies/Compare and Photograph all receive both
recipes. Tones update owned materials in place, without graph or proxy changes.
The grade makes one GPU framebuffer copy and one fullscreen draw only when active.
Neutral has no grading allocation, copy or draw. Alpha coverage is retained.
Resources are separately owned by each studio and disposed; broad-leaf attributes
are reused while topology is stable, with disposal before topology replacement.

## Verification

- `npm ci` completed.
- `npm run verify`: typecheck; **534 tests passed, 0 failed, 0 skipped**; build and
  self-contained distribution validation passed.
- `LIVING_LINE_PLACE=all node tools/build-standalone.mjs` and
  `node tools/validate-dist.mjs`: all three placement variants generated and valid.
- Tap + drag `arrangement-3.html`: 1,096,386 bytes,
  SHA-256 `5a8ad32dcdf483e3a0c4d1282159216d39b73654f28d683922126c1194906878`.
- Drag-only `arrangement-1.html`: 1,096,340 bytes,
  SHA-256 `17a35eb48ad38d6b8e2fc4af2a1767e7e71c7894b0c8144c04ccd8153d4d9a21`.
- Independent read-only review at `91cbc76`: **Pass-with-notes**; **70/70 focused
  tests passed**. It found three integration omissions (photo tones, Garden/app
  finish, existing broad-blade tint updates), all fixed and rechecked. It also
  confirmed the final picker order, legacy identity, recipe preservation, and
  async PNG protections.
- Production Three.js meshes, raycasting, transaction paths, persistence and DOM
  event adapters were exercised in CPU tests. Those are not GPU screenshots or
  physical-phone observations.

No supported browser-control skill was available in this managed environment.
Browser/GPU rendering, real touch, Safari and phone frame time remain unrun. The
lobed-leaf image is explicitly a CPU mesh silhouette sheet, not a game screenshot.
The photo shader has numerical and lifecycle coverage; its actual GPU output still
needs owner visual acceptance, especially transparent edges and dark tones.

## Unresolved and deliberate limits

The reported first-drag roughly minute-long freeze was not reproduced. A CPU
construction probe cannot diagnose GPU compilation, browser scheduling or host
behavior, so no speculative timeout/reset was introduced and no freeze fix is
claimed. If repeated, distinguish a whole-page stall from a ghost that stops
following, and note whether Photograph had been opened first.

The single-flower gain is one degree per CSS pixel, bounded to 120° per grab.
CPU checks show much better vertical response and symmetric directions, but phone
sensitivity remains a judgement call. Other flower surfaces are unchanged.

Broad leaf is bendable continuous material, not a physical sheet solver. Lobed
leaves are whole editable organs, not independently editable lobes. Neither adds
leaf-area collision. The new generic foliage is botanically informed stock, not
an exact named-species simulation. Existing resources are not removed for lack of
use by one player. Color variants are not unlocks or a currency system.

## Where to try it

Use the existing private preview's main page for tap + drag. `/drag.html` remains
drag-only. Test Single flower first, then the three new cuttings, then Studio →
Botanical tones and Photograph → Finish. Keep one enhanced scene in Garden and
reopen it. The short physical checklist is appended to
[PHONE_WEB_TEST_CARD.md](../../../../tests/browser/PHONE_WEB_TEST_CARD.md).

Lane notes: [handling](handling.md), [compact flower](compact-flower.md),
[lobed leaf](lobed-leaf.md), [broad leaf](broad-blade.md),
[colors](../botanical-colorways/README.md), [Photograph](photograph.md).

This candidate carries #90, #87 and #85 history and targets main directly. Do not
merge those ancestors again after landing this candidate. No merge or external
publication is performed by this handoff; only the existing private preview is
updated. Experimental invitation PR #86 remains outside this candidate.
