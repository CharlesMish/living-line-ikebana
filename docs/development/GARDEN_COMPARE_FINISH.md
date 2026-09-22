# Garden comparison finish

Comparison stays a transient presentation. This pass hardens drag ownership,
interruption, and pane size on `cursor/garden-compare-ed63`. It does not add
materials, scoring, or a stored comparison.

## What changed

- One pointer owns a comparison orbit, pan, or zoom drag. A second pointer, a
  non-primary button, or the wheel does not replace that owner or its frozen
  start pose. The drag is recomputed from that start.
- The owner's release keeps the temporary shared view. Pointer cancel, lost
  capture, blur, a hidden page, and a mouse move with the button already up
  restore the start pose and stay in comparison. Escape during a drag does the
  same and does not close the view. Escape with no drag, and Leave comparison,
  discard the temporary view. A preset, zoom button, or Orbit/Pan switch
  cancels the drag before it applies. None of these paths write a Garden
  entry, a stored camera, or the working bowl.
- Both canvases use one width and one height. Side by side, the title row is
  as tall as the taller title. Stacked, the two canvas rows share the space
  left after both titles. A wrapping title does not shrink only one pane.
- Player copy in the guide and Garden is shorter. The across-the-table sentence
  stays a human brief. The scene still has no table or sightline, and nothing
  in the app decides whether an arrangement passes. That measurement limit
  stays in this note and in Garden docs; the player text no longer spells it
  out.

## How to verify

```sh
npm ci && npm run verify
```

Focused tests live in `tests/app/gardenCompare.test.ts`:

- a second pointer cannot steal a comparison drag, and interruption restores the start
- interrupting a comparison drag restores the shared start and writes nothing
- unequal and wrapping titles keep both comparison canvases the same size

In the browser, keep two arrangements whose titles differ a lot in length, open
Look at both, and confirm the canvas boxes match on a wide window and at 320px.
During a drag, a second pointer should not move the view. Escape, pointer
cancel, or leaving should drop the temporary view without changing the Garden
backup or the working bowl.

Physical-phone observations for comparison are still open. Screenshots from a
resized browser are not that pass.
