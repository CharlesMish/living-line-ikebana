# Ultra Night: placement, phone controls, and revisiting saved work

Date: 2026-10-12. Base: PR #85 revision 2, `f8bec35673155ee024c5881c5f9f1d939f3177ec`.
Main was verified at `dd1ffe94bbaf7654f8067203e1dc140799bcf139`.
This draft includes #85's placement experiment and the refinements below.
PR #86's experience invitations remain separate. Nothing is merged into main.

## Recommended play

The private Ultra Night preview opens with both drag and tap placement enabled.
No query parameter or local checkout is needed. Its `drag.html` sibling is the
same candidate with ordinary drag-only placement. These two preview pages share
their own browser storage; the production site's working bowl and Garden are on
a different origin and are untouched.

The preview is at <https://living-line-ultra-night.charlesmish.chatgpt.site>.
Publication status is recorded in the draft PR handoff; this address is not proof
of deployment by itself.

For a local build:

```sh
npm ci
npm run verify
LIVING_LINE_PLACE=all node tools/build-standalone.mjs
# Open dist/arrangement-3.html for tap + drag; arrangement-1.html for drag only.
```

## What earned a change

| Area | Change | Reason |
| --- | --- | --- |
| Tap placement | One pointer owns the held tap. Commands, capture loss, graphics interruption, and reframing discard it before a late release. | Independent reproductions placed after interruption or from a second pointer. |
| Mixed input | Keyboard insertion waits while a tap is held. | A keyboard activation followed by the held pointer's release could insert twice. |
| Release guard | Check actual travel, canvas size, and projection at release. | A missing move/resize event must not turn a drag or stale press into a tap. |
| Phone controls | Wider source row, shorter visible instruction, Cancel in a reserved top-rail slot. | Existing screenshots show cramped instructions and Cancel covering bottom feedback. |
| Garden | Saved cards precede maintenance; Keep focuses its new card; each card offers a guarded working copy. | Make the saved result and path back into arranging easier to find. |
| Botanical targeting | Convert projected segment fractions correctly under perspective. | Press-to-station math was slightly displaced along depth-slanted stems. |

The accepted pin area, seeds, generators, saved formats, Undo behavior, shaping
solver, and ordinary drag commit law are unchanged. A failed tap stays ready and
places/saves nothing. A successful tap uses the same insertion path as a drag.
Idle readiness can survive an Angles change; a held pointer cannot survive it.

The botanical correction is small (about 0.11 CSS px in the measured reed case).
It is not a claim that difficult head/trailer handling is solved. The recorded
C03 F4 reed misses were on the floor shadow, 88–98 px from the material, so this
pass does not enlarge the hit area to reach the shadow. See the [botanical
report](botanical.md) for the reconstruction and outstanding questions.

## Verification and its limits

- Integrated `npm run verify`: **469 passed, 0 failed, 0 skipped**; typecheck,
  production build and self-contained distribution validation pass.
- Independent original-source substitution: the three stale/secondary tap
  regressions fail on PR #85 and pass on this candidate. The mixed-input
  double-insert reproduction also passes after the fix.
- New coverage exercises real app/coordinator paths, production Garden UI/store
  event paths, and production projection/cut geometry. DOM adapters and omitted
  GPU drawing are disclosed in the lane reports.
- Existing saved-state, cancellation, narrow lens, nodding-head Aim, trailer,
  material golden, overlap prevention, and comparison tests pass.
- No fresh browser render, physical-phone play, phone performance, or new player
  session was run here. The supported browser-control workflow was unavailable.
  Layout and feel remain owner checks, not proven by unit tests or deployment.

Lane details: [phone](phone.md), [Garden](garden.md), [botanical](botanical.md).
The independent review is recorded separately in this folder.

## Five-minute owner pass

1. Tap the source, then a pin position; drag the next cutting normally. Tap outside
   the boundary once: the cutting stays ready, with no new plant. Use Cancel.
2. Check the source name/instruction and Cancel at ordinary and enlarged text.
   Ready and idle should not shift the bowl or cover bottom feedback.
3. Hold a ready placement tap, change view with another input or interrupt the
   page, then release. No cutting should appear from that stale press.
4. Keep a named bowl. The new card should be visible. Make a working copy, cancel
   once, then accept, edit, Keep, and Compare. The original remains unchanged.
5. Try the reed, nodding head, and trailer in Front and three-quarter views. Note
   the selected cutting when a wrong target wins; export the bowl if it recurs.

## Next decision

Try this candidate before another invitation campaign. If phone placement and
Garden feel comfortable, it can become the next product draft. The wider
question of what makes another arrangement worth starting is still unanswered:
this pass supplies no new retention evidence and does not adopt #86. Shadow
readability, crowded selection, and the intermittently missing bud support remain
honest follow-ups, preferably with a saved scene and a physical-phone recording.
