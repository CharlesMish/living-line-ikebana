# Photograph finish: small adjustments, one output path

This lane builds on PR #90 (`3226687`). It adds a restrained **Finish** group to Photograph: Exposure (−1 to +1 EV), Contrast, Warmth, Saturation (including monochrome), and Vignette. It does not add lights, alter plants, or grade the UI. Framing and finish have independent reset actions. **Show original / Show finish** compares against the unadjusted frame without discarding the sliders; saving while original is displayed intentionally saves that visible original, with an explicit status message.

The preview, prepared PNG, and newly kept Garden cover all use the same production `ThreeStudio.renderNow` route. Garden entries keep the recipe alongside scene/view; the main integration must propagate the optional recipe when reopening Garden View and Compare. Preparation still retains the actual PNG, and every finish change invalidates an in-progress encoding just like a framing change. Existing PNG delivery/share lifecycle remains unchanged.

## Rendering

The unchanged scene first renders to its ordinary framebuffer, preserving accepted lighting, tone mapping, antialiasing, backdrop and fog. A GPU framebuffer copy and one fullscreen triangle apply the recipe to those finished colors. There is no CPU readback, second scene render, CSS filter, additional light or separate export filter. It does not photograph HTML controls or the composition grid.

Neutral is an exact bypass: no copy, shader draw or allocation. Active grading owns one RGBA texture at the drawing-buffer size, a triangle and one shader. Resolution changes replace/dispose the texture; reset releases all resources; studio close is idempotent. Its draw count stays included in renderer diagnostics. Exposure acts on the finished image's linearized color, not on a raw/HDR scene. Warmth is a restrained red/blue balance; this is not a color-managed RAW editor or a claim of calibrated white balance.

Transparent pixels retain their coverage. The shader unpremultiplies covered colors, applies the grade, then restores the same alpha; vignette changes color only. Empty cutout pixels remain empty rather than receiving an opaque rectangle. Vignette is normalized to frame coordinates, so its strength is independent of preview/output resolution.

## Save compatibility

Existing plain scenes remain `sceneVersion: 1`, with the optional recipe absent. A non-neutral recipe writes `sceneVersion: 2`, so an old client rejects the new scene instead of silently dropping adjustments. The new reader accepts both versions, rejects recipes attached to version 1, and rejects unknown recipe versions, fields, non-finite or out-of-range values. Reset removes the recipe but preserves any already-required v2 scene envelope and other metadata. Botanical graphs, camera data and legacy fallback bytes stay unchanged.

Integration with the simultaneous botanical-tone lane must preserve **both** optional fields and version requirements. Propagate `photoAdjustments` through `IkebanaApp.createStudio`, non-rebuilding `applyScene`, and `gardenCompareView`; propagate `botanicalTones` through Photograph's factory. These are intentionally left for the owner of those overlapping app files.

## Evidence

- `npm run verify`: **498 tests pass**, 0 failures; typecheck and self-contained distribution validation pass on this lane. Installed dependencies reuse the shared verified project installation.
- New tests exercise numeric color effects, neutral identity, premultiplied edges/alpha, smooth frame-relative vignette, future-recipe rejection, working/Garden persistence, production UI finish events, stale PNG invalidation, visible-original Keep, resource reuse/resize/reset/disposal, independent studios, and the production render/capture ordering including restoration after capture failure.
- Shader math is checked with a numeric reference; renderer lifecycle uses a stub renderer with real Three.js geometry/material/texture objects. **These are not GPU shader execution or screenshot comparisons.**
- No browser, physical phone, frame-time measurement or exported-PNG visual check was run. The managed environment lacks its supported browser capability; no alternate preview server/browser was introduced.

## Owner checks

1. In Photograph, change each Finish slider; confirm a gentle change at small values and no arrangement movement. Toggle Show original and back, then Reset finish.
2. Make a non-neutral PNG and compare its visible colors/crop with the preview. Keep a photo and reopen it from Garden; compare its finish and botanical colors, then return to the working bowl.
3. Try a transparent PNG with Vignette: alpha should remain clear outside the vessel/plants, with no dark rectangle or halo at fine edges.
4. Try portrait and square, then prepare again. Confirm changing any finish while an encoding is pending prevents the stale delivery.
5. On a phone, check the Finish group, numeric labels and explicit save actions remain reachable at large text. GPU copy and shader cost are unmeasured there.

No corkboard/image-storage gallery or game-mode unlocks were added; Garden remains the photo collection for this pass.
