# Independent review follow-up

Starting candidate: PR #92, `85af92682d6e057c77f2b5db89dffd3f11ccf6c6`.
Charlie supplied Grok's partial interaction/source review and Claude's rendered
review, including `prune_preview_tint.py`, and authorized agreed repairs.

## Decisions and changes

- **Repair prune-preview colour restoration.** Three 0.181.2 selects cached
  shader variants through `material.version`. Switching a DoubleSide plant
  surface through transparent preview and back did not invalidate that program.
  `setOpacity` now sets `needsUpdate` only when crossing the transparent/opaque
  boundary. Ordinary opacity updates do not repeatedly invalidate the material.
  No botanical graph, picking, prune plan or saved data changes.
- **Keep Photograph confirmations visible.** Its existing live message now sits
  outside the controls scrollport in a bounded row. Keep success and failure
  cannot be stranded below a prepared image. The separate preview retains its
  allocation. PNG guidance mentions Share only when actual file sharing is
  offered; an unavailable button is no longer suggested as a fallback.
- **Keep unsaved working edits visible.** Failed committed autosaves retain an
  independent warning and an explicit Retry save. Later craft hints do not erase
  it. Retry cancels a live preview/readied cutting before saving committed state;
  it does not consume an ordinal or replace Undo. Failed save-first proposals
  leave a previously saved bowl unmarked, and preserve any earlier pending
  warning. A complete successful working-document save clears it; keeping a
  Garden entry does not. Kept Garden views cannot retry their displayed scene
  into the working save.
- **Hold Front framing for a focused comparison.** CPU projection supports
  clipping at some sizes. A fixed camera translation could help without reducing
  target width, but also consumes lower clearance and affects shared presets.
  See [the quantified study](framing-study.md). No camera auto-fit is added.
- **Keep acquisition bounds.** The existing 8 CSS-pixel structural-stem fallback,
  16-pixel selected-handle fallback and 12-pixel visible bead already address
  some near misses. Tool-limited selection impressions do not justify increasing
  them without measuring which target the player intended; doing so can worsen
  wrong-part pruning.

## Verification approach

`tests/presentation/previewOpacity.test.ts` checks shader-version transitions on
the production material path, including hover restoration and cut/Undo reuse.
Its three new cases fail on the old source and pass with the change. This catches
the missing program invalidation, while existing opacity-value tests alone did
not establish rendered correctness.

The separate rendered CI job builds the pinned old candidate in an isolated
checkout and compares it with the proposed build using the same seeded cutting,
viewport and read-only projected target. `prune-preview-tint.mjs` adapts Claude's
reproduction to ordinary mouse hover/cut/Undo after disclosed keyboard seating.
It requires a real visibly ghosted flower, exact canonical restoration, zero
hover saves and a fixed original-petal pixel mask. The old build must fail on
colour restoration specifically; the new build must restore both hover and Undo.
It saves both image sets and numeric differences. This is assisted rendering
evidence, not blind play or a phone trial.

Run 187 produced the reported darkening on `85af926` and exact colour recovery
on the fixed candidate. Its first automated mask mistakenly excluded the warm
pink petals and measured a bud instead, so that run correctly failed the required
old-build-fails gate. The corrected check uses the supplied reproduction’s
upper-right flower region and original red-over-green mask, frozen from the
before image. Across 582 original flower pixels, mean RGB changed from
(207.753, 167.065, 156.172) to (124.247, 83.333, 78.440) on the old build; the
fixed hover image restored the original values exactly. The five viewport
workflow cases, Keep visibility and both failed-save/Retry cases passed in
that run. The subsequent matching CI run validates the corrected pixel gate.

The normal five rendered viewport cases also check the visible Keep confirmation
and capability-aware delivery text. At 390px, including 150% root text, an
explicitly labelled storage-fault diagnostic checks persistent unsaved feedback,
failed and successful Retry, disk contents and preservation of the prior Undo.
Only storage availability is injected; edits and commands use the ordinary UI.

`npm ci` and `npm run verify` pass: **591 tests, zero failures/skips**, clean
typecheck, build and self-contained distribution. The three new material tests
also fail on the old source. An independent source review found no blocking
issue in the new Retry/Garden ownership paths.

Targeted DOM and application tests cover Save success/error, share capability,
committed failures versus rejected proposals, retry, cancellation and Garden
ownership. Full verify and the matching GitHub run are recorded in the PR.

## Evidence limits

No local browser was launched in this authoring environment: the available
managed preview workflow had no control-browser capability. Rendered claims must
come from the matching CI artifact, not merely from adding these scripts.
No physical phone, Safari, native share sheet or real GPU frame-time measurement
was performed. The previous freeze remains unreproduced. Structural prevention
still excludes leaf/petal surfaces. Review agreement is not a substitute for
exercising an operation; Grok's report did not complete several core edit paths.
