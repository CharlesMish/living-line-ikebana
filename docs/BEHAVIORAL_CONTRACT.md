# Living Line behavioral contract

This is the implementation-backed authority for the web alpha. It protects the craft verb while rendering, tuning, content, and eventually the native adapter remain replaceable.

An intentional contract change is allowed, but it must be named as an experiment and land with matching tests, documentation, and any required schema, generator, fixture, or persistence migration. Do not create accidental new law inside a renderer or gesture callback.

## 1. Canonical identity and determinism

- The current graph uses `schemaVersion: 1` and `generatorVersion: "one-branch-v1"`.
- Successful seat ordinal `N`, starting at 1, reserves `plant-N` with seed `(7301 + N * 977) >>> 0`. Thus `plant-1` is seed `8278` and `plant-2` is seed `9255`.
- A cancelled or invalid insertion does not advance `N`.
- The pending ghost is the complete reserved graph, including branch continuations, petioles, pedicels, leaves, buds, and blooms. A valid release commits that graph at the exact valid previewed translation. It does not regenerate it.
- A pending graph may follow the pointer outside the usable pin field so invalidity remains legible. That preview cannot be committed. Base editing of an already seated plant is separately clamped to the usable kenzan radius.
- Procedural detail is seeded and stable. Editing one record cannot reroll or relocate unrelated detail.
- Canonical serialization includes active and inactive records, sorts branches and organs lexicographically by ID, and preserves every domain field.
- `fixtures/plant-1-one-branch-v1.json` is the golden `plant-1` graph at base `(0, 0.55, 0)`: 15 branches, 10 organs, and 94 total branch points.
- Mulberry32 seed `8278` begins with raw UInt32 values `1455703032`, `1240698700`, `1956662399`, and `3370247770`.
- `one-branch-v1` and its fixture remain available when new materials are added. New topology or generation laws receive new explicit versions.

## 2. Graph and material invariants

Each branch persistently owns its ID, kind, parent attachment, points, rest lengths, active length, radius, stiffness, reference normal, and active state. Each organ persistently owns its ID, kind, supporting branch, material distance, spin, scale, and active state.

- `points.length === restLengths.length + 1`.
- Every rest length is finite, positive, and matches its shaped segment length within shared tolerance.
- `activeLength` equals the sum of `restLengths`.
- The topology is one acyclic rooted graph. IDs are unique and all references resolve, including inactive history.
- Every active child branch attaches within its active parent and its first point coincides with the sampled parent attachment.
- Every active organ attaches within active supporting material.
- Attachment and cut-boundary comparisons use the shared `1e-8` tolerance.
- `referenceNormal` is persistent, unit length, and perpendicular to the base tangent. Organ facing is derived from the transported material frame plus persistent `spin`, never from an incidental renderer orientation.
- Inactive records remain frozen identity/history. They are not silently deleted, reused, or reactivated by an unrelated edit.

## 3. Craft operations

### Insert

- Insertion begins only while idle in Arrange.
- Acquiring the tray reserves the exact next identity and creates the one full graph used for both ghost and possible seat.
- Each preview is a translation of the acquisition graph.
- A valid release commits, selects the plant, advances the ordinal once, and autosaves committed graph state.
- An invalid release or interruption discards the ghost, leaves the document and ordinal unchanged, and does not autosave.

### Aim

- Aim rotates the acquired active continuation and its active descendants rigidly around the selected branch root.
- It preserves all rest lengths, attachments, stock length, identity, and inactive history.
- The trunk target has a default vertical floor of `root.y + 0.08`. Degenerate start or target directions produce no change.

### Bend

- Bending edits an actual branch curve. It is not a scale, point-index joint, free-chain IK solve, or cumulative drag.
- Eligible branches are active `trunk`, `lateral`, or `twig` records with at least four points, at least three rest segments, and a nondegenerate legal interior rest-arc interval. Petioles and pedicels are not bend-handle targets.
- The fixed experiment station is `0.54 * activeLength`, clamped between the first and last rest segments. The touch experiment samples an eligible middle span. In both cases, the chosen material distance freezes at acquisition.
- Both variants call the same broad smootherstep, stiffness-capped solver. Extreme input saturates instead of folding into free pretzel geometry.
- The solver reconstructs from unchanged rest lengths and remaps active descendants coherently. It does not stretch stock.
- In the touch variant, material fractions `0.24` through `0.72` inclusive acquire bend; other material hits acquire aim.

### Move base

- Base movement keeps the root height and clamps the requested radial position to the usable kenzan radius, currently `1.22` domain units.
- It translates every active point by one coherent vector and does not mutate inactive history.

### Prune

- Preview is non-mutating and names the exact distal branch and organ IDs that will leave.
- The minimum cut distance is `0.62` on the trunk and `0.045` on other branches. The distal margin is `0.025`.
- Release truncates the targeted branch at the previewed material distance and deactivates the previewed distal records. Records are retained; the plant is not regenerated or vertically scaled.
- An attachment at or within tolerance of the cut remains. A continuation or organ beyond `cut + 1e-8` leaves. Cutting a pedicel below its bloom deactivates that bloom.
- Unrelated geometry, seeded detail, material frames, and inactive history remain unchanged.

## 4. Transaction and gesture ownership

- Exactly one transaction may be active.
- Acquisition freezes the operation, owner/pointer, stable plant and branch IDs, material station, spatial constraint, and immutable snapshot.
- Every update recomputes from that snapshot, never from the preceding preview.
- Crossing another plant, branch, handle, or empty space cannot transfer ownership or give the drag to the camera.
- Only the acquired owner's ordinary `pointerup` release commits. Repeated release or the normal capture loss after release is an idle no-op.
- `pointercancel`, premature lost capture, hidden visibility, `pagehide`, relevant viewport or orientation changes, WebGL context loss, and explicit cancellation restore the snapshot and write no save.
- A tool, view, posture, selection, or bend-experiment command cancels first, then applies the command.
- Persistent chrome remains usable as an interrupt command during a scene grab. A second scene pointer during a plant transaction is ignored.
- Arrange permits botanical acquisition and keeps the camera unchanged. Empty-space drag in Arrange does nothing except explain Step Back.
- Step Back permits constrained orbit and pinch while the canonical graph remains unchanged. Orbit radius is constrained to `5.7...15.5`; polar angle to `0.002...1.52` radians.

## 5. Deterministic target arbitration

Candidates are ranked independently of Three.js intersection-array order:

1. visible base or bend handle on the selected plant;
2. branch or organ material on the selected plant;
3. branch or organ material on another plant;
4. no target.

Within a tier, choose smallest CSS-pixel distance to projected material, then smallest ray depth emitted by the forward-facing raycaster, then lexicographically smallest stable ID. Organ hits route to their supporting branch for the current Shape and Prune grammar.

Base and bend handles may acquire only for the already selected plant. Shape acquisition of a branch or organ may select its plant. Temporary handles are subordinate and appear only where they resolve ambiguity.

## 6. Persistence and recovery

- Local storage key: `ikebana-web-alpha:studio-v1`.
- Payload version: `storageVersion: 1` with `savedAt`, `nextSuccessfulOrdinal`, and canonical plants.
- Autosave contains only committed canonical graphs and the next successful ordinal. It excludes renderer objects, live previews, pending graphs, pointer ownership, hit candidates, camera tweens, and gesture state.
- Graph commits save. With current coordinator options, camera gestures and canonical-view changes do not write persistence.
- Invalid/cancelled insertion and every cancelled edit write nothing.
- Corrupt or unsupported stored data fails closed to an empty session with a terse warning; it never partially hydrates a graph.
- WebGL presentation may be discarded and rebuilt from canonical state without botanical identity or detail changing.

## 7. Evidence and change gates

Automated verification must cover fixture determinism, serialization, graph validation, stock-length preservation, descendant attachment, prune identity, deterministic arbitration, transaction rollback, insertion ordinal law, persistence, build output, and browser smoke behavior.

Physical-phone evidence is separate. The current field threshold is at least 8 of 10 deliberate first-try acquisitions after two minutes of familiarization, no camera/plant ownership crossover, no cancelled commit, at most one corrective repair among five intended broad bends, and completion of the craft path without spoken developer instruction.

If those interaction thresholds still fail after two focused gesture-tuning passes—or if two of three testers prefer sliders or generic gizmos because direct shaping cannot be trusted—reconsider this interaction foundation instead of burying it under polish.

## 8. Acquisition telemetry (additive; does not revise sections 1–7)

This section documents diagnostic instrumentation added to make the bend-experiment hypotheses (fixed bead vs. touch-located) answerable from phone sessions. It is purely observational: it never gates, delays, or alters any craft operation, transaction, or camera law above, and it is not consulted by any core geometry or transaction code.

- Local storage key: `ikebana-web-alpha:telemetry-v1`, distinct from the `ikebana-web-alpha:studio-v1` autosave key. Corrupt or unsupported stored data fails closed to an empty telemetry session, mirroring autosave's recovery law; it never partially hydrates.
- Payload version `storageVersion: 1` with `savedAt` and per-variant (`bead`, `touch`) acquisition arrays.
- Every acquisition record carries the bend variant active at the moment it happened, an attempt-scoped miss count and elapsed time (misses immediately preceding a hit belong to that hit's attempt), and — once known — a transaction outcome of `committed`, `cancelled`, or `declined`.
- A record is written to storage only once its transaction is fully resolved (or immediately, for a miss, which never opens a transaction). Nothing pending, live, or previewed is ever persisted, matching autosave's live-preview exclusion.
- A cancelled transaction is written with `outcome: "cancelled"` and its cancellation reason; a committed one is written with `outcome: "committed"`. Neither can be produced by the other's code path, so a cancellation can never be misread as a commit.
- `?fresh=1` clears both the autosave and telemetry stores, yielding an empty session for both.
- Export is a deliberate, user-triggered action (not automatic upload): it tries the Web Share API with a file payload first, falls back to an anchor/blob download, and falls back again to an on-screen read-only manual-copy view. See `README.md` for why.

