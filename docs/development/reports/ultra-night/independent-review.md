# Ultra Night independent review

Reviewed product head: `26535dc2114839dd3230b659a7b2161b2e6ac538`.
Comparison base: placement PR #85 at `f8bec35`.

**Verdict: no remaining code blocker found in this focused review. Ready for
owner preview, with browser layout and physical-phone acceptance still open.**
This is not a claim that the phone presentation or touch feel has been validated.

## Interaction findings and regression proof

The review independently reproduced three pre-existing placement faults through
the production app methods and transaction coordinator: a second pointer could
replace an armed owner; a held tap could survive a view command; and a held tap
could survive a system interruption. Each stale release could seat a cutting.

The same three external harness tests fail against the original `f8bec35`
`IkebanaApp.ts` and pass against the corrected source. The old file was substituted
during bundling, without editing the checkout. A fourth mixed-input reproduction
found keyboard insertion could seat while a scene tap was held, followed by a
second insertion on pointer release. It now passes: keyboard activation refuses
while the pointer owns the pending action, and the owner's release seats once.

The integrated implementation clears arm ownership before releasing capture,
checks release travel even without an intermediate move, and rejects changed
canvas/projection conditions. It distinguishes a held pointer from idle ready
state, so Angles can retain readiness without reviving an interrupted press.
Ordinary no-op release saves remain deliberate contract behavior.

Independent placement/UI selection: **21 tests passed**. Existing drag, keyboard,
cancel, invalid-tap, undo, and persistence paths remain covered.

## Garden and phone presentation

Direct card copying uses the existing `offerReplacement` path and its Keep first /
Replace / Cancel choice. It does not mutate the saved original. Existing app
transition tests retain save-before-memory replacement, failure preservation,
read-only viewing, and working-coordinator/undo restoration. The new Garden UI
tests also exercise failed Keep-first, focused kept cards, comparison selection,
confirmed removal, and unreadable-storage backup access.

Cancel now belongs to the material rail. Its reserved slot and the overlaid
idle/ready instruction footprints avoid making readiness itself change the rail
height. Hidden instructions are excluded from accessibility exposure. The source
button remains the same node, and Step Back still hides and inerts its controls.
These source-level properties are supported; exact CSS fit, focus scrolling,
large-text behavior, and handset comfort require rendered/owner checks.

## Botanical projection and evidence bounds

The perspective correction is mathematically appropriate: for screen fraction
`s` and endpoint clip values `w0`, `w1`, the world fraction is
`s*w0 / ((1-s)*w1 + s*w0)`. Reusing `s` directly only works for equal-depth
endpoints. The implementation uses the corrected world fraction for the world
point and rest-arc station while retaining screen-distance ranking.

Independent old-source substitution confirms that the station round-trip test
and the production prune-mesh end-cap test both fail before the correction and
pass afterward. The prune test checks the displayed cap centre and committed
endpoint against the same intended material point; it is more than a helper
formula assertion. The measured old error is small and does not explain distant
selection misses. No generator, solver, stock, or acquisition-envelope change is
included.

I inspected C03 F4 screenshot `0004.png` and input-log sequences 5–7. The logged
points are near the grey floor shadow, below the actual green reed. The production
projection checks find no candidate there and acquire sampled visible reed
positions. This supports the narrow F4 diagnosis, not a general conclusion that
reeds are easy to see or that Charlie's earlier selection reports were mistaken.
The shadow-input test passes on both old and corrected source.

Independent Garden, acquisition, projected-station, and nodding selection:
**35 tests passed**. The lead's full verification is reported separately.

## Remaining owner checks

- At narrow and enlarged-text sizes, check source/Cancel fit, no readiness jump,
  visible rejection feedback, and normal drag behavior.
- Keep a bowl, copy it, cancel once, revise a copy, and compare; confirm the
  saved original and current working bowl remain distinguishable.
- Inspect reed versus shadow, then nodding-head and trailer handling. A saved
  affected scene is still needed for the intermittent missing bud support.

No new browser session, GPU rendering, physical-phone play, or frame-time
measurement was performed for this review. Supplied screenshots are historical
evidence, not renders of the final candidate.
