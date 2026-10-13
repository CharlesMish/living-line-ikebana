# Photograph workspace and cutting facing

Owner follow-up to PR #92 at `38dea04deb3bfec6ecf92f5b527f6709513f4682`.
The owner confirmed the visual tone choices and photo resume, but could not see
the composition while scrolling to Finish and could not readily turn a cutting
whose flowers faced away. This pass addresses those two workflows.

## Changes

- Photograph holds the complete live frame in a bounded preview while its
  controls scroll separately. Scene, Frame, Finish and Save tabs replace the
  continuous form. Portrait stacks preview and controls; landscape/desktop put
  them alongside. Prepared PNGs stay in Save. Tabs support arrow/Home/End keys.
- Saturation's neutral is at the slider centre. Existing recipes retain their
  exact values and the existing canonical range of -1 to +0.6.
- In Shape, tap a stem to select its cutting, then open **Edit**. **Left 15° /
  Right 15°** turn the whole active cutting around its seated vertical axis.
  The menu stays open and names the selection. Lean, heights, stock lengths and
  inactive cut history are preserved. Each step is one Undoable, save-first edit.
- Prevent overlaps checks the entire turn arc, including carried branches. A
  blocked/no-motion step preserves the previous Undo checkpoint. The existing
  protection scope remains structural stems, not leaf and petal surfaces.
- The three lighting recipes remain. They reuse one hemisphere and two
  directional lights, with one shadow-casting key and one 1024-square shadow
  map. Choosing another recipe does not add a light rig or shadow pass. This is
  a resource inventory, not a phone performance measurement.

## Verification

- `npm ci` and `npm run verify`: 580 tests passed, none failed or skipped;
  typecheck, build and self-contained distribution validation passed.
- Independent read-only photo review: 39 focused tests passed; no product
  correctness issue found. Its browser-script compatibility finding was fixed.
- Independent read-only Turn review: 36 focused tests passed; no blocking issue
  found. Contact and computation-budget messages use the existing distinct copy.
- The optional older photo scripts now choose the appropriate tabs and use
  explicit Prepare/Download. They were syntax-checked, not re-played locally.
- GitHub Verify now has a separate bounded **Rendered evidence (Chromium,
  assisted)** job. Its artifact contains screenshots, exported PNGs and
  `checks.json` with the exact tested checkout and proposed head. Consult the
  matching run for rendered results; the mere existence of this job is not a
  claim that a browser ran locally.

The rendered job covers 320×640, 390×844, 844×390, 1280×800 and a 150% root-text
390×844 layout. It uses ordinary keyboard seating to prepare an explicitly
assisted scene, then real UI Turn/Undo, tone selection, Finish, export and resume.
This tests layout and workflow, not placement usability, blind-player preference,
Safari touch arbitration or phone frame times. No physical phone was available.

## Short owner pass

1. Open Photograph → Finish. Move Warmth and Saturation and scroll down to
   Vignette: the live composition should remain visible throughout.
2. Prepare and download a PNG in Save. Return to arranging, edit a cutting and
   reopen Photograph: your setup should resume around the current plants.
3. In Shape, select the away-facing flower/spray. Edit → Left/Right 15° should
   turn it without lowering its lean; Undo should reverse the last step.
4. With Prevent overlaps on, try turning a branch toward another stem. It should
   stop safely and allow an immediate turn back.

This remains the same owner-private preview and draft PR #92, targeting main
directly. Nothing is merged or published to GitHub Pages by this follow-up.

Details: [photo workspace](photo-workspace.md), [cutting turn](cutting-turn.md),
[rendered evidence and lighting](../photo-facing-followup/rendered-evidence-and-lighting.md).
