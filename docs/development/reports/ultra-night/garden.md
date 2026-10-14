# Garden presentation — Ultra night

Base: PR #85 placement revision `f8bec35`. This lane does not include PR #86's
experience invitations and does not claim evidence of continued play or retention.

## Change and reason

The C03 supplied phone capture `p-D-3b-1-keep-in-garden.png` shows Keep feedback,
stopping/invitation controls, the naming form, and backup controls filling the
viewport while the saved arrangement remains below it. The supplied desktop
`d-D-1-bowl1-in-garden.png` also puts maintenance controls before the first card
and stretches its single thumbnail across the collection width. Those are existing
captures, not screenshots of this revision.

This bounded pass puts the collection before the optional study and backup
disclosure, reduces introductory copy, and uses stable-width desktop card columns
with a full-width single column on narrow screens. A successful explicit Keep
marks the new card `Just kept` and focuses its View button, bringing the saved
moment into view. An empty working bowl hides the inactive Keep form.

Every card offers Make a working copy through the existing replacement command.
The image button now says View in 3D, and the viewer explicitly labels the saved
original as view-only. Copying still offers Keep first / Replace / Cancel for a
nonempty working bowl; no Garden original is edited by copying. Compare announces
when one moment is selected and retains focus on its rebuilt card button, while
the existing sticky comparison action remains available. These changes support
revisiting and refining a piece without adopting a second-arrangement prompt.

Backups remain available after the collection. If storage is unreadable, their
disclosure opens automatically; export stays enabled and the original bytes remain
untouched. Optional Across the table remains an explicitly labelled study below
the collection. No invitation or automatic continuation has been added.

## Contract and verification

Behavioral contract preserved: no schema, generator, geometry, camera, insertion,
undo, Keep, comparison, or replacement-law changes. The only new operation entry
point is the card's working-copy button, using the same existing guarded path as
the viewer's button. `justKeptId` is transient presentation state.

Automated validation on this lane:

- `npm run verify`: **459 tests passed, 0 failed**, typecheck and standalone
  distribution validation pass. Uses the root's clean `npm ci` dependency install
  via a local, uncommitted node_modules symlink.
- Six focused tests execute the production GardenUI event bindings with a small
  DOM adapter and actual GardenStore: card-copy confirmation, failed Keep-first,
  Keep focus and one write, Compare focus with no writes, read-only view/removal
  confirmation, and unavailable-storage backup recovery.
- Existing Garden serialization, working-coordinator isolation, safe replacement,
  Undo preservation, comparison cancellation and equal-canvas tests pass.
- `git diff --check` passes.

No fresh browser rendering or physical-phone test was run. The available browser
workflow was unavailable in this environment, and no substitute browser was
installed. The DOM adapter tests event paths and persistence effects, not layout,
native focus scrolling, Safari interaction, or visual quality. Final combined-head
verification belongs to the integrating root.

## Five-minute owner check

1. On the preview origin, Keep a bowl with a name. The marked card should become
   visible without clearing the working bowl. On a narrow phone, verify its title,
   image, and working-copy button are readable and the scroll is comfortable.
2. Make a working copy from its card. Cancel once, then continue through the
   replacement choice. Change the copy, Keep it, and confirm the original remains.
3. Select Compare on both cards. The first selection should remain in focus and
   the shared-view action should stay reachable; return to the collection afterward.
4. View a kept original, orbit, then Return to my bowl. Confirm the original is
   clearly read-only and the working bowl is restored.
5. At enlarged text and in short landscape, reach Backups & storage and Close
   Garden by normal scrolling. No physical-phone result is yet claimed.

## Deferred

PR #86's invitation presentation and continuation questions remain separate.
If later reconsidered, the saved arrangement should remain the primary result
after Keep, with any next offer subordinate; this lane does not select or ship
that product direction.
