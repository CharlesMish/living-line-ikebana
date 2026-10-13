# Botanical tones: visible choices for the current bowl

This lane replaces thirteen largely indistinguishable dropdowns with material
cards. A card presents Natural and both alternatives together. Each option has
its own small stem illustration, the preset name, a strip of the colors of its
visible parts, and a persistent selected mark. Flowering branch, for example,
shows wood, leaf, blossom and bud colors together. Bare branch does not invent
flower or leaf swatches simply because its appearance record has unused slots.

The primary group contains only material families in the committed bowl, with a
cutting count. The other families are behind **Other cuttings**, where their tones
can still be chosen before placing them. Reed and trailer have no tone controls;
the explanatory text says that they retain their original greens. Empty bowls
have a short explanation pointing to the folded choices.

## What the images mean

`botanicalTonePreview.ts` makes compact, repo-native SVG illustrations for each
family. All visible part colors are read from `getMaterialAppearance` through
`resolveBotanicalAppearance`, the same recipe used by the scene renderer. There
is no second hand-authored color table, image fetch or WebGL thumbnail renderer.
The sample uses the first in-bowl generator version of that family, or the latest
registered tone-family version for material not in the bowl. If several durable
versions of one family coexist, the illustration represents the first one; the
existing family-wide tone choice still applies to every version.

These are unlit illustrations of color and form, not exact seed photographs or
predictions of lighting and Photograph finish. The UI explains that distinction.
The neighboring [SVG contact sheet](tone-samples.svg) contains the actual assets
from this lane. It was rendered with Inkscape and visually inspected; it is **not**
a browser layout capture or evidence of the Three.js render.

## Interaction and compatibility

- Buttons remain ordinary keyboard-operable buttons with family/preset accessible
  names, `aria-pressed`, visible text and a non-color selected mark. Controls have
  a 44px minimum height. Cards switch from two columns to one at narrow widths;
  the three options remain next to one another, with labels allowed to wrap.
- Opening still calls the owner's cancellation hook before presenting choices.
  Done/Escape keep the existing dialog behavior and return focus to Studio.
- A click on the current choice is a no-op rather than another save. Changes are
  confirmed by the owner's `update`; a failed save keeps the old choice selected.
- Reset removes only botanical tone overrides. Other material choices, scene
  settings, photo finish, graph identities and planting geometry are untouched.
- The app supplies current committed generator IDs only when this menu opens.
  There is no per-frame reordering, capture, generation or storage work.
- Persistence schemas and family-wide semantics are unchanged. This is a
  presentation/usability refinement, not a botanical or interaction-law change.

## Evidence

`npm run verify` passes: **540 tests, zero failed/skipped**, typecheck, build and
self-contained distribution validation. Six added tests exercise the production
UI event paths and sample/inventory helpers. The focused run with the existing
botanical persistence suite passes **11/11**. Dependencies came from the root's
completed `npm ci`; this lane used a non-committed dependency symlink.

The tests establish real recipe colors across all current presets and durable
versions, exclusion of nonexistent parts, bowl grouping, keeping other family
choices, Natural/reset behavior, failed-save selection, read-only blocking,
no-op current-choice clicks and focus return. The DOM adapter does not paint or
compute layout.

No browser or physical phone run was available in this environment. Still check
320px portrait and large text: card widths, readable miniatures, label wrapping,
44px controls, scrolling, keyboard focus, and choosing a tone then reopening the
menu after inserting/removing cuttings. Compare the chosen colors against the
real scene under its lighting; the tiny flat sample is deliberately not a photo.
