# Photos and violet cuttings — combined private preview

Base: main `68433f4`, after the owner accepted and published the prior round.
This preview integrates focused drafts #94 (Garden print wall), #95 (close
photographic details), and #96 (violet/indigo stock and nodding bell). It changes
no live GitHub Pages deployment. The individual reports describe behavior,
references, compatibility and remaining phone checks.

## Try it

- Keep photographs, then Garden → Print wall. Oak frames and Paper prints are
  two views of the same collection. A print opens its saved view; Open arrangement
  in 3D returns to the existing read-only Garden original.
- Photograph → Frame → Close detail, then tap a point in the picture. Across,
  Height and Closer refine it. Whole view restores the reference frame. This is
  bounded camera framing, without synthetic blur or automatic Arrange fitting.
- Violet sprig has short flowering arms. Indigo spire has separated flower tiers.
  Both can be shortened while retaining lower flowers. Botanical tones offers
  their violet/lavender/blue variants. Single flower remains in More cuttings so
  old saves and its material are not removed.
- The nodding v2 bell has a narrower, thin-rimmed five-lobed shell and a visible
  throat. Its graph, shaping and acquisition envelope remain unchanged.

## Verification and limits

Combined `LIVING_LINE_PLACE=all npm run verify`: **610 passed, 0 failed, 0 skipped**,
typecheck/build/distribution pass. All three standalone placement modes build.
Focused independent source review found and corrected inward Violet petal normals;
the final closed surfaces have normal/volume regression assertions. The first
print-wall rendered run caught overlapping short-screen rows, fixed with content-
sized grid rows and a rendered non-overlap assertion.

The existing opt-in rendered job runs five viewport/text cases, the unchanged
prune-tint regression, working-save failure feedback, the wall, close framing,
and three botanical appearance/persistence cases. Each run records its exact
head and limitations in the artifact. Inspect its screenshots; passing code
does not establish visual taste, ordinary placement usability or phone feel.

No physical Safari/device, GPU frame-time, full leaf/petal collision, depth-of-field
blur, extra lighting rig, or new game loop is claimed. The print wall stores no
second copy of the collection; full-resolution PNG downloads remain separate.

## Integration

The only merge resolutions combine distinct contract sections and rendered-test
imports. The combined preview carries all three component histories. Prefer this
integration candidate if accepting the entire round; do not also replay component
commits afterward. Nothing is merged until Charlie accepts the preview.
