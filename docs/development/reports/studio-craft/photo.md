# Photograph saving and studio pass

## Purpose

The owner prepared a PNG but could not find it in Downloads. That report does not establish which browser or embedded-host policy blocked delivery. The earlier export attempted a synthetic anchor click after asynchronous PNG encoding, removed the anchor, then told the owner to check Downloads. There was no persistent image or second saving route in the dialog.

## Changes

- **Prepare PNG** renders the exact output dimensions and retains an actual PNG image in Photograph. It does not claim to have saved a file.
- The prepared result supplies explicit **Download PNG**, supported file **Share image**, and **Open image** actions. The image itself allows native press-and-hold saving options. The browser may block any individual route; the image remains available.
- Share capability is tested with the actual PNG file. The file and share data are prepared beforehand, so the Share click calls the browser synchronously while user activation is available. A dismissed share sheet is reported as cancellation and never triggers a silent download.
- Closing/reopening, context loss, and any changed scene or framing invalidate in-flight encodes. A failed/stale encode cannot replace the last accepted PNG. Context loss blocks further capture/Keep until reopening, while preserving an earlier PNG for saving.
- A prepared PNG is explicitly labelled as an earlier frame when the live settings change. Download/Share continue to use that visible PNG until another is prepared.
- Preview-only object URLs are revoked on replacement, close, and destruction. A URL explicitly opened through **Open image** survives dialog cleanup so the external image tab can reload; the browser releases it when the originating page unloads.
- The workspace groups **Scene / Frame / Save**, gives the preview a quiet photographic mat, displays framing values, and offers a CSS thirds grid that never enters the captured canvas or saved scene. Backdrop/perch choices come from their shared registries.

## Preserved behavior

Photograph still uses a disposable renderer of the committed arrangement; no placement, botanical, camera-interaction, Undo, or autosave law changes. Keep preserves the existing scene/view plus Garden JPEG cover behavior. There is no new persistence field, image upload, lighting parameter, or client-side image-generation service.

## Verification

- Seven focused PNG lifecycle and Share capability/cancellation tests pass on this lane.
- Four production Photograph event-path tests cover retained-image delivery, changed-frame and close/reopen invalidation, context loss, Share dismissal, and stale-share completion. These use a deliberately non-rendering DOM/studio adapter. They do not prove CSS layout, GPU output, browser download acceptance, or touch behavior.
- The shared backdrop/perch registry commits are integrated. All eleven helper and production UI event-path tests pass on the combined source; full verification is recorded in the integration report.
- Optional `photo-interruption.mjs` now uses explicit Download after Prepare, and remains **unrun** here.
- Fresh browser rendering and physical-phone play were not available in this environment. No claim is made that the original download failure is reproduced or that host download policies have been bypassed.

## Owner checks

1. Prepare a PNG. Confirm the actual photograph appears below the live preview; save using Download or Share/Open image if the host suppresses downloads.
2. Press and hold the prepared image in iPhone Safari/in-app browser; record which saving options appear.
3. Change the backdrop/format/framing. The prepared image must remain visibly labelled as the earlier frame until Prepare new PNG.
4. Open image, then close Photograph. The separate image tab should remain available. Cancel Share and confirm no file is downloaded automatically.
5. Toggle the thirds grid. It should guide the live preview but be absent from the PNG and Garden cover.
