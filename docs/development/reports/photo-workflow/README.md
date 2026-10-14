# Botanical choices and Photograph workflow

Owner-requested refinement of draft PR #91, based on `c707845de8e11904e991ff76bec0a3b8b8310c28`. Main remained `dd1ffe94bbaf7654f8067203e1dc140799bcf139` during implementation. This candidate continues the existing private preview; no merge or public Pages deployment is part of this work.

## What changed

| Owner problem | Result |
| --- | --- |
| Botanical tones was a long list of indistinguishable Natural selects | In-bowl families first; three labeled visual choices per material, with recognizable SVG samples and actual part-color strips. Other cuttings stay available in a disclosure. |
| Leaving Photograph to fix a cutting lost the setup | Explicit Return to arranging; the same bowl resumes its photo choices with the latest committed plants, vessel and tones. Reset photo setup remains separate. |
| Framing felt constrained | Wider zoom and screen-relative pan, with optional Turn, Elevation and Tilt. Changed framing stays above the stage; it never moves plants. |
| Photograph needed light/scenery choices | Studio, Soft window and Evening lighting; two static soft backdrops, Mist hills and Garden shade. |
| Lobed leaf's back looked unfinished | Paler, matte reverse and independent underside veins, with exact front buffers retained. |
| Single flower felt paper-like beside Compact | A curved open five-petal cup, rear receptacle and connected stamens. Compact remains a dense tuft; the original flowering branch is unchanged. |

The tone illustrations are deliberately unlit color/form samples, not exact seed renders. The scenic backdrops are quiet painted backgrounds, not outdoor environments with moving particles. This pass does not add another perch, vessel texture or material ID: those existing choices remain, while the workflow and two botanical surfaces receive the attention.

## Remembering a photograph

One small page-session draft belongs to the current working bowl. Ordinary edits, Undo, vessel/tone changes and temporary Garden inspection preserve that identity. A successful Fresh or working-copy replacement starts another identity; a failed save does not. Photograph always rebuilds from the latest committed botanical state. The draft cannot restore old plants or overwrite a vessel change.

Closing or Return to arranging remembers framing, backdrop, perch, lighting, finish, fibers, grid and title. A page reload clears the draft. Use **Keep photo in Garden** for a durable scene and view; no automatic Keep or working autosave is added. Read-only Garden photography cannot consume or overwrite the working draft. Prepared PNGs retain their existing modal-session scope and explicit delivery workflow.

The final camera pose stores its roll once through the existing `up` vector. Light recipes join optional sceneVersion2 presentation metadata. Unknown scene fields and IDs fail closed in older readers. Tones, finish and lighting reset independently; ordinary graph generation, pruning, gesture cancellation and stock length remain unchanged.

## Combined verification

At code head `f4b5c88`:

- Root `npm ci` completed. `npm run verify`: **569 passed, 0 failed, 0 skipped**, clean typecheck, Vite build and self-contained distribution validation.
- Existing generator identities, golden fixtures, acquisition/cancel/Undo behavior, scene storage and import guards pass in that full run.
- Lane tests cover production DOM events, real geometry/raycast paths, camera projection, source/recipe propagation, and resource teardown. DOM adapters do not paint or measure layout.
- Root inspected the authored SVG samples, procedural backdrop pixels and the CPU Single-flower geometry sheet. None is represented as a browser screenshot or GPU/phone evidence.
- Independent read-only review: **Pass with notes**, no remaining correctness blocker. It ran **65/65** focused checks before the final fixes and **29/29** after them.
- Independent review found and prompted fixes for photo panning below the floor and omitted light-shadow render-target disposal. The wider framing and repeated open/close lifecycle have explicit regressions.

A managed browser-control skill was unavailable in this environment. No browser server, alternate automation, GPU screenshot or physical-phone run was performed. The owner's final visual judgment is still needed for material translucency, soft scenery/floor transition, light color, phone readability and performance. The earlier one-minute freeze remains unreproduced; the teardown repair is not claimed to fix it.

Placement builds from this code:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `arrangement-3.html` (tap + drag) | 1,159,990 | `ac87cda706ec242e61e9c6d2a7eb06e450b27b9e373ade93d2d6718a8fe10855` |
| `arrangement-1.html` (drag only) | 1,159,944 | `eafa58e8b0c4856d0e15fed1fd175b37776429b16e13d24b916ebca21fec98f4` |

## Small owner play pass

1. Put two kinds of cutting in the bowl, open Botanical tones, and choose from the visual samples. They should be first; Other cuttings should stay optional. Check labels and selection at your normal phone text size.
2. In Photograph, choose a backdrop, perch, light and finish; frame a shot. Return to arranging, adjust a stem or vessel, then reopen. The photo setup should return around the updated bowl.
3. Expand Turn and tilt. Try a modest tilt and a close crop, then Reset framing. Keep a photo, View it from Garden, return to work, and confirm each scene keeps its own appearance.
4. Turn the Lobed leaf over and compare Single flower with Compact. Check the underside veins and the open cup at ordinary bowl scale, including Rose/Lilac.
5. Prepare a PNG, then change the light while a new image is preparing. An older preparation must not replace the new frame. Try Transparent once if you use it.

Stem intersection inspection/prevention still concerns structural stems. Leaf surfaces and petals can pass through one another; this visual/workflow pass does not introduce an organ collision solver.

## Supporting reports

- [Visual tone choices](tone-choices.md), with the lane's [actual SVG samples](tone-samples.svg).
- [Photo setup and return workflow](resume.md).
- [Camera and lighting](camera-light.md), including the reviewed floor-bound correction.
- [Scenic backdrops](backdrops.md).
- [Lobed reverse](lobed-reverse.md).
- [Single flower](single-flower.md) and [CPU geometry sheet](single-flower-cpu.png).
- [Rendering audit and teardown repair](rendering-audit.md).

Lane counts refer to their stated isolated baselines. The combined count above is authoritative for this candidate. Nothing is merged; a new draft PR targets main directly and includes the prior unmerged preview history, avoiding another stacked-base merge trap.
