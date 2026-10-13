# Photograph controls beside the composition

Base: PR #92, `38dea04deb3bfec6ecf92f5b527f6709513f4682`.

## User problem and change

Charlie and the external browser review both found that Finish controls had moved
far below the photograph in a tall phone form. The changed dialog is a bounded
workspace. Its live composition never belongs to the controls' scroll container.
Scene, Frame, Finish and Save tabs select one control panel, with arrow/Home/End
keyboard navigation and labelled tab panels. The selected controls scroll
independently. Sliders have at least 44 CSS pixels of vertical target space.

Portrait uses a preview above the controls; desktop and short landscape use a
preview beside them. At phone portrait widths the preview receives 36% of the
available workspace height, leaving the majority for controls. A particularly
short narrow window receives a smaller 29% preview. The dialog's compact heading
keeps Return to arranging and Close reachable. Large text can wrap without
moving the photograph into the controls' scroll content.

All three photo formats are contained in the mat rather than cropped or stretched.
CSS container units express the fitted frame width, using the selected aspect
ratio and the finite mat content box. This introduces no JavaScript measurement
loop and does not alter camera or export projection.

Prepared PNG, Download, Share and Open are in Save. Completing preparation selects
Save and focuses Download. Switching tabs retains the prepared image, and later
photo changes still label it as an earlier frame. The prepared image cannot make
the live-preview region grow. The session-only photo draft, latest committed
plants, Garden Keep, capture invalidation and export lifecycle are unchanged.

Reset photo setup and the memory explanation are in Save → About this photo setup.
Composition grid and output dimensions are in Frame. No controls are removed.

## Saturation

The UI range is now -1 to +1, with zero at its exact centre. The negative half maps
to the existing -1…0 recipe range; the positive half maps to 0…+0.6. The output
still shows actual recipe strength (-100…+60). The saved recipe range, validation,
renderer and old photo appearance do not change. A loaded recipe's exact saturation
is retained until that slider is edited, avoiding floating-point round-trip or
native range-step quantization when changing a different control or Keeping.

## Verification

- Typecheck passes.
- 25 focused UI/presentation tests pass, including existing capture/Share/context
  loss/session resume/Garden tests.
- Four added DOM adapter tests exercise panel isolation, prepared image retention,
  keyboard navigation, centred saturation endpoints, exact untouched old recipe
  preservation and draft resume.
- This lane used the root's completed `npm ci` dependencies; it did not run a
  second install against a shared symlink. Root will run the combined full verify.

The DOM adapter does not implement CSS layout or painting. No browser, GPU or
physical phone run was performed in this lane. The independent screenshot CI
lane targets 320×640, 390×844, 844×390 and desktop using the new stable tab IDs.
Enlarged-text and native Safari comfort still need rendered/device acceptance.

## Owner check

1. On the phone, open Photograph → Finish and scroll down to Warmth, Saturation
   and Vignette. The whole live photo should remain in sight while the controls
   move. Repeat with a Portrait frame and after rotating the phone.
2. Use larger text; check all four tabs and Return to arranging remain reachable.
3. Prepare a PNG in Save, then return to Finish. The saved image should not enlarge
   the preview. Return to Save to download it, or prepare a new one after editing.
4. Confirm Saturation starts in the centre and Reset finish returns it there.

## Optional browser-script compatibility follow-up

`photo-study.mjs`, `photo-interruption.mjs`, `combined-scene.mjs` and
`pinbed-release.mjs` now select the visible Scene, Frame or Save tab before their
existing control interactions. Interrupted insertion, delayed capture, failed
encoding/Keep, Garden persistence, layout recovery and pointer checks remain the
same. The latter two scripts also now follow Prepare PNG → wait for the new
prepared image → Download PNG; they previously assumed Prepare downloaded by
itself, an assumption already obsolete before the tabbed workspace.

All four commands below passed syntax checking only:

```sh
node --check tests/browser/photo-study.mjs
node --check tests/browser/photo-interruption.mjs
node --check tests/browser/combined-scene.mjs
node --check tests/browser/pinbed-release.mjs
```

These optional scripts were not executed in a browser in this environment. Their
existing recorded assertions are not new passed evidence. The separate screenshot
CI script was untouched by this compatibility follow-up.


## Rendered narrow-heading correction

The remote screenshot run subsequently passed the four standard-size workspace
cases but exposed a heading wrap at 320 pixels: the browser's native dialog
`max-width` reduced our authored width, leaving a lone final letter. The CSS now
sets `max-width` explicitly alongside the authored width in each viewport rule.
The Photograph heading stays on one line; the adjacent Return button keeps its
44-pixel minimum target and can wrap its label. This correction does not move the
preview or alter the controls' scroll ownership. Root will rerun screenshot CI;
this lane inspected the source and ran `git diff --check`, not a local browser.
