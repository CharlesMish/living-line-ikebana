# Deliberate close photograph

Base: main `68433f4`. This branch adds bounded close framing to the existing
Photograph camera, without changing its fixed 44° projection, lights or geometry.

## Choice

The existing Closer slider already moved the camera to 2.8×. Adding a “macro
lens” field would make Garden View, Compare and saved cameras disagree unless
that larger projection contract were revised. This pass instead makes a useful,
explicit closer crop: Frame → Close detail → tap a visible point. The photograph
centres that point on its target plane and moves to at least 3.5×; the slider now
reaches 4.8×. Across/Height refine it. Whole view restores the reference frame.
No blur, autofocus, fit after edits, hidden material selection or new save field.

The tap uses the preview's actual aspect and the same FOV as capture. It centres
on the camera target plane, not on a guessed flower surface. Depth-separated
subjects may need a small correction with Across/Height. Pan bounds and floor
clearance still apply. At most one choice is armed; moving/interrupting the press
never produces a new frame. Existing sliders remain keyboard-operable.

Repeated Keep/reopen/zoom is bounded at 1.5 world units from the camera target.
Untouched older poses remain exact. The camera position/target/up alone stores
the result, so drafts, ordinary Garden validation and backup serialization do
not have a second zoom recipe that could apply twice. Whole view resets all six
framing offsets; scene, finish, lighting, plants and working storage are unchanged.

## Evidence

- `npm ci` completed.
- `npm run verify`: 595 tests pass, none fail or skip; typecheck, standalone build
  and distribution validation pass.
- 32 focused Photo UI/camera tests pass. New tests project selected target-plane
  points through actual Three camera matrices across Front/Above/¾, roll and all
  three aspect ratios. They check bounded extremes and repeated saved close-ups.
- Production UI adapter tests cover arm/tap, drag/cancel/foreign pointer/resized
  preview/hidden page, exact resume, Keep camera and capture camera, and Whole
  view restoration. The original working snapshot is checked unchanged.
- `tests/browser/photo-detail.mjs` adds an ordinary mouse/emulated-touch capture
  helper for the integrated rendered run; it has not been run in this worktree.
- No local browser or server was started in this managed environment. No physical
  phone, Safari, GPU cost or visual acceptance is claimed. Integration should
  run the helper after `photo-frame` in the existing rendered-evidence workflow.

## Deliberate limits

This is close perspective framing, not a depth-of-field simulation. It will make
simplified mesh details more apparent. There is no exposure meter, auto-follow,
plant collision change, texture sharpening or per-photo full-resolution storage.
