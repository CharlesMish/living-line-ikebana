# Whole-cutting facing control

Owner feedback: a newly placed flowering material could face away from Front,
with no obvious phone control for turning it without laying it down.

## Implemented

Arrange → Edit now names the selected material and offers **Left 15° / Right
15°**. The menu stays open for repeated taps; buttons have 44 CSS-pixel minimum
height. Turning rotates the whole active cutting about world-up through its
seat. It preserves the lean and every point's height. It does not turn an organ
independently, move the base, change the camera or reroll stock. The selection
still identifies the cutting; the source card's currently chosen material does
not decide which cutting turns.

Each tap is a named coordinator document command, saved before changing memory,
and reversible by the existing one-step Undo. A blocked/no-motion turn makes no
save and retains the preceding useful checkpoint. Failed saving leaves geometry,
selection, ordinal and checkpoint untouched. Opening Edit and invoking Turn
cancel active previews; a stale pointer release cannot commit them. Read-only
Garden views and Step Back cannot turn a cutting.

Prevent overlaps sweeps the complete rigid arc using analytic point-speed bounds
and existing conservative advancement. A carried lateral can stop a turn even
when the selected trunk is stationary and the requested endpoint is clear.
Contact and work limits are reported through the ordinary status. Existing
structural-only coverage, same-cutting exclusions and initial-pair exemptions
are unchanged; this does not solve leaf/petal collision.

## Verification

- TypeScript typecheck: pass.
- 36 focused tests pass across core turn, command/prevention, production app
  transitions, production UI bindings and existing coordinator recovery.
- All 15 catalog materials retain rest lengths, attachment coincidence, organ
  records, identity and material frames; inactive pruning records stay exact.
- Production app route saves once before replacing memory, cancels a held base
  preview, leaves stale release inert, rolls back on failed saving and supports
  exact Undo. Kept Garden route refuses the command.
- A swept carried-arm fixture has clear start/end and an obstructed middle;
  protection stops it before penetration and permits turning away immediately.
- UI adapter checks material context, availability and repeat taps with the
  menu open. These are DOM/event-adapter checks, not rendered browser evidence.

No local browser, GPU or physical-phone run was performed in this lane. Root
integration owns the full verification and any separately available remote
rendered evidence. Phone acceptance should check selecting a blossom spray,
turning it toward Front, and whether 15-degree steps feel suitably fine.

Follow-up from remote rendered run 184: the phone Edit disclosure covered the
Single flower head while turning. The label and selected material now share one
compact heading; Undo and Remove share one row of 44-pixel-minimum controls.
All IDs, explicit accessible action names, command gates and disclosure behavior
remain. This reduces menu height without moving the camera or adding rail rows.
The existing production UI event tests pass; root will recapture the actual
layout remotely before claiming the obstruction improved.

Run 185 confirmed the compact panel was smaller but still covered the tall
Single flower in the assisted scene. On narrow screens the open Edit controls
now sit above the bottom status area instead. The rail keeps its exact safe-area
inset; no camera, gesture, selection or transaction rules change. The rendered
job explicitly checks the sheet is in the lower half and its four action targets
remain at least 44 pixels. The sheet is still dismissed by the ordinary Edit,
outside-press, focus and Escape paths.
