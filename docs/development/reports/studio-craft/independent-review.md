# Independent studio-craft review

Reviewed product integration at `2a2543a`, against baseline `51901de`. Read-only reviewer; no product changes made. The root's later plinth persistence extension and final documentation were still in progress during this check.

**Disposition: no source-level blocker found for a draft owner playtest. Visual quality, embedded-host delivery and physical-phone acceptance remain unverified.**

## What changed the decision

- Baseline Photograph only requested an anchor download and directed the player to Downloads. It could not observe success and offered no retained-image recovery. The revision instead prepares a visible PNG and requires separate Download, Share or Open actions; feedback states that a download/open was requested, without claiming delivery.
- Actual Photograph event handlers are exercised with a small DOM adapter and a renderer seam. Tests cover pending capture after close/reopen, changed frames, context loss, a previous PNG surviving failed preparation, Share dismissal, and a late Share result after reopening. They are production control-flow tests, not browser-paint tests.
- Both session and frame revisions gate asynchronous completion. The Share call occurs directly in the user click, before any awaited operation. Dismissal leaves the image available and never triggers an automatic fallback download.
- Preview-only object URLs are revoked when replaced or closed. A URL explicitly opened in a separate image tab is deliberately retained until the source document unloads; closing the dialog therefore does not break that new tab. This exception is explicit and tested. A retained PNG is labelled as an earlier frame after the controls change.
- Perch maps are owned by each generated perch. The actual `ThreeStudio.setPhotoStage` replacement path and final `dispose` use a dedicated, idempotent disposer, including shared wood maps/materials. Transparent mode allocates no hidden perch maps. New ceramic maps are separately owned and cached by each studio and disposed on studio close.
- Appearance changes leave botanical graphs, stock geometry, camera and vessel support extents unchanged. Returning to existing Glaze/Stoneware removes the new maps and restores the old parameters. No solver, generator or canonical schema changed.
- Scene validation uses the same registered backdrop/perch IDs as the UI. Working and Garden roundtrips exercise all color/finish/backdrop options; unknown values still fail closed. Older builds will refuse saves containing new IDs, rather than silently substitute an appearance.

## Independent checks run

`npm test -- tests/app/photoExport.test.ts tests/app/photographUI.test.ts tests/app/scenePersistence.test.ts tests/presentation/photograph.test.ts tests/presentation/vesselSurfaces.test.ts tests/presentation/vesselFollowup.test.ts`

**35 passed, 0 failed, 0 skipped.** This included actual stage replacement/disposal, every frozen vessel's support-height checks, deterministic texture ownership, and Garden quota/stale/unknown-data safeguards. Root owns the complete verification run.

## Limits and remaining owner checks

- No fresh GPU rendering, browser layout or physical phone test was run here. Texture bytes, UV direction, support bounds and material settings are checked; the rendered wood/stone/ceramic appearance is still a taste and readability decision.
- The revised optional browser scripts were inspected as source, not run. Earlier script results cannot be reused as evidence for this build.
- The embedded host may still decline a download, file share or new tab. The retained PNG provides alternate actions, but this review does not prove which action succeeds on Charlie's iPhone or within ChatGPT.
- Check Prepare PNG → visibly inspect image → Download/Share/Open on the actual phone; then change the frame and confirm the old image is clearly marked until preparing again. Check a transparent cutout and a tall portrait photo.
- Old saved bench/stone scenes use the refined current renderer when reopened; existing stored cover images remain the original small images. Garden is a saved scene/view with a cover, not storage of the full-resolution PNG.

Two small findings during review were corrected before integration: Open image no longer asserts a new tab actually opened, and initialization failure disables capture even if it happens after renderer creation.
