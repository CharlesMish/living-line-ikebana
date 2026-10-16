# Import and edit safety

Base: `578591453db2f6b31dd82f4347419c8f1cff7efe` (merged main).
This is a bounded-input policy change; there is no generator/schema change,
stock regeneration, pruning-history trimming, or storage rewrite on load.

## Corrections

- Seeds must already be UInt32 values. Neither read nor canonical serialization
  wraps negatives, fractions or oversized values with `>>> 0`.
- Studio and Garden v1/v2 now retain only the validated canonical botanical
  fields. Their original cutting order is preserved; branch/organ records use
  the existing canonical ID order. Optional scene, camera, lighting, finish and
  botanical-tone handling remain with the existing scene validator.
- Descendant collection is iterative and builds active adjacency once. Its DFS
  sibling order and caller-supplied result-set behavior stay unchanged. Malformed
  cycles cannot loop forever. Validation uses memoized iterative ancestry walks,
  rather than walking each branch independently back to the root.
- Numeric graph validation explicitly rejects non-finite active lengths and
  reference normals. Finite values outside the generous shared geometry envelope
  of magnitude 1,000,000 are refused before import decoding. This includes positions,
  stock/attachment distances, radius, organ scale and spin. A finite radius 1e300
  previously passed import and overflowed Float32 render buffers; it now fails
  cleanly. Values are rejected, never clamped into different artwork.

## Resource envelope

Every limit includes inactive botanical history. Whole imports fail atomically;
existing bytes remain available for export and are never silently trimmed.

| Scope | Branches | Organs | Material points | Ancestry depth |
| --- | ---: | ---: | ---: | ---: |
| One plant |512|1,024|8,192|128|
| One arrangement |4,096|8,192|32,768|per-plant limit|

The cheap array preflight also checks the points/rest-length cardinality before
mapping records, so oversized rest-length arrays cannot evade the point budget.
Garden's existing 64-plant / 24-entry / 1.8M-character bounds remain; working bowls
retain their greater-than-64-plant allowance. The existing 65-reed save regression
passes. These limits intentionally refuse pathological imported graphs, including
the previously accepted 4,400-branch chain. They are not performance promises for
arrangements near the limits.

Across all 22 shipped/current-and-archived generator versions at seeds 0, 8278, 9255
and 4294967295 (88 graphs), maxima were 15 branches, 14 organs, 94 points and depth 4.
No shipped stock approaches these limits. Existing frozen workbench fixture tests
and the flowering-branch golden JSON remain unchanged.

## Focused evidence

- `npm ci` completed. Typecheck passed.
- New tests cover invalid seeds; 12,000-branch direct traversal; DFS order; accepted
  depth 128 and rejected depth 129 including inactive records; plant and aggregate
  count limits; finite-overflow geometry; cycle/disconnected topology; and exact
  88-graph round trips with reversed raw branch/organ arrays and Aim/Bend/Prune.
- Scene persistence tests cover both v1/v2, extra nested fields, reverse cutting
  order, inactive history, existing photo recipes, canonical writes, zero writes
  on load, and atomic failure preserving existing Garden and working saves.
- Both new scene-persistence regressions fail against an isolated copy of baseline
 `5785914` (extra fields survive; negative seed import succeeds), and pass against
 the changes. The baseline run used unchanged production source and the exact
 new test file, bundled with the existing esbuild dependency.
- Physical phone/Safari was not run; these are data and deterministic core checks.
## Live edit boundary

The generic transaction coordinator now accepts typed adapter input validation.
Production botanical and camera adapters check inputs before invoking a solver.
Invalid acquisition changes neither selection nor transaction ownership. Invalid
Aim, Bend, base and Prune updates retain the last valid preview and can recover
on a later valid update. Invalid insertion updates disable the pending seat,
so an ordinary release cannot insert at stale coordinates or consume an ordinal.
Cancellation and ordinary-release laws are unchanged. Finite prune distances
still use the existing clamp; invalid direct core calls return an unchanged
clone. Descendant bend reconstruction is iterative.

Eleven new edit regressions pass; eight fail when the unchanged baseline edit,
coordinator and adapter source is substituted. Independent review also compared
828 Aim/Bend results across all 22 supported generator versions and four seeds:
every serialized result was byte-identical to baseline. A separate 171-edit
Aim/Bend/Prune comparison across the 19 live materials also matched exactly.

## Integrated verification

`npm run verify`: **680 passed, 0 failed, 0 skipped**; typecheck, production build
and self-contained distribution validation pass. This includes 21 new tests.
An independent read-only critic accepted the changes after checking canonical
persistence, inactive history, invalid edit recovery, and numeric overflow.
