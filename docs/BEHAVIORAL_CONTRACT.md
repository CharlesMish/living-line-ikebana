# Living Line behavioral contract

This is the implementation-backed authority for the web alpha. It protects the craft verb while rendering, tuning, content, and eventually the native adapter remain replaceable.

An intentional contract change is allowed, but it must be named as an experiment and land with matching tests, documentation, and any required schema, generator, fixture, or persistence migration. Do not create accidental new law inside a renderer or gesture callback.

## 1. Canonical identity and determinism

- The current graph uses `schemaVersion: 1`. The twelve original v1 generators remain registered, including the frozen `one-branch-v1`. New insertions of fern frond, blossom spray and nodding flower use their `-v2` generators; all other catalog entries remain v1. Loaded graphs retain their exact stored version, structure and copied response. Material choice never changes the global successful-seat ordinal. Historical named workbench profiles pin their original versions as well as their ordered material IDs.
- Successful seat ordinal `N`, starting at 1, reserves `plant-N` with seed `(7301 + N * 977) >>> 0`. Thus `plant-1` is seed `8278` and `plant-2` is seed `9255`.
- A cancelled or invalid insertion does not advance `N`.
- The pending ghost is the complete reserved graph, including branch continuations, petioles, pedicels, leaves, buds, and blooms. A valid release commits that graph at the exact valid previewed translation. It does not regenerate it.
- A pending graph may follow the pointer outside the usable pin field so invalidity remains legible. That preview cannot be committed. Base editing of an already seated plant follows its acquired planting component and legacy allowance (see Slide the base).
- Procedural detail is seeded and stable. Editing one record cannot reroll or relocate unrelated detail.
- Canonical serialization includes active and inactive records, sorts branches and organs lexicographically by ID, and preserves every domain field.
- `fixtures/plant-1-one-branch-v1.json` is the golden `plant-1` graph at base `(0, 0.55, 0)`: 15 branches, 10 organs, and 94 total branch points.
- Mulberry32 seed `8278` begins with raw UInt32 values `1455703032`, `1240698700`, `1956662399`, and `3370247770`.
- `one-branch-v1` and its fixture remain available when new materials are added. New topology or generation laws receive new explicit versions.

## 2. Graph and material invariants

Each branch persistently owns its ID, kind, parent attachment, points, rest lengths, active length, radius, stiffness, reference normal, and active state. Each organ persistently owns its ID, kind, supporting branch, material distance, spin, scale, and active state. Organ kinds are `leaf`, `bloom`, `bud`, and `berry`. A berry is one fruit on one supporting branch. `berry` is another allowed kind value, not a new field, and it does not change `schemaVersion`.

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
- The insertion target is the selected layout’s explicit planting areas on the insertion plane (radius `1.22` for Original). A destination outline follows that exact boundary throughout a tray drag, including while the source is over the rail or above the plane horizon and its ghost is hidden. Colour/text show validity; neither an outline nor the wider visible water changes the hit test. There is no whole-basin snapping.

### Aim

- Aim rotates the acquired active continuation and its active descendants rigidly around the selected branch root.
- It preserves all rest lengths, attachments, stock length, identity, and inactive history.
- The seated trunk exit stays upward: its first-segment unit tangent has a minimum vertical component of `min(acquiredExit.y, clamp(0.08 / activeLength, 0, 1))`. If an Aim would cross that limit, its rigid rotation stops at the limit. The descending end of an arch is not itself clamped to insertion height; this is not a water/ceramic collision solver. Existing lower poses never jump on acquisition. Degenerate start or target directions produce no change.
- A visible organ surface supplies the frozen world-space grip for Aim; the supporting branch root remains the pivot. Graph attachment distance still determines pruning and identity. A near-miss proxy without a surface intersection retains attachment-based Aim. Surface grip is transient acquisition context, never saved botanical state.
- Direction degeneracy uses the shared numerical geometry tolerance (`1e-6`
  units), not a minimum stalk or drag length. The September 22 correction
  removes the former `sqrt(0.02)`-unit dead zone, which froze short stalk grabs
  and reset valid previews when the target crossed near their root. Aim is
  still a rigid rotation from the acquisition snapshot, with no separate axial-roll operation.

### Bend

- Bending edits an actual branch curve. It is not a scale, point-index joint, free-chain IK solve, or cumulative drag.
- Eligible branches are active `trunk`, `lateral`, or `twig` records with at least four points, at least three rest segments, and a nondegenerate legal interior rest-arc interval. Petioles and pedicels are not bend-handle targets.
- The fixed experiment station is `0.54 * activeLength`, clamped between the first and last rest segments. The touch experiment samples an eligible middle span. In both cases, the chosen material distance freezes at acquisition.
- Opt-in `?experiment=bend-stations` offers Lower/Middle/Upper at 0.32/0.54/0.76 through the same legal clamp and solver. It displays one bead. A branch change resets Middle; a station change during acquisition cancels before moving the bead. The choice is transient and omitted from saves. Touch excludes this study, and active station-study acquisitions do not enter fixed-versus-touch telemetry. Ordinary play remains the single fixed station.
- `nodding-flower-v2` has a two-section flowering stem: its arching upper section is an eligible `lateral` continuation with copied stiffness 0.62, attached at the lower stem's tip. Its terminal short `pedicel` stays rigid under Aim and cannot acquire Bend. This adds a shapeable authored stem section without changing the solver or the eligibility of old pedicels/petioles. V1 keeps its rigid curved pedicel and original appearance.
- Both variants call the same broad smootherstep, stiffness-capped solver. Extreme input saturates instead of folding into free pretzel geometry. The September 8 tuning intentionally extends the per-gesture input and rotation limits by 20%; small-drag gain and the broad influence profile are unchanged. This is an authored shaping range, not a fracture or elasticity simulation.
- The solver reconstructs from unchanged rest lengths and remaps active descendants coherently. It does not stretch stock.
- In the touch variant, material fractions `0.24` through `0.72` inclusive acquire bend; other material hits acquire aim.

### Slide the base

- Base movement keeps the root height and clamps the request to the planting component nearest the acquired base. Original has radius `1.22`. An existing base outside a newly selected layout receives a per-grab ellipse expanded just enough to contain that base; the secondary origin-centred guard must enclose that same ellipse. Acquisition and no-motion release retain the exact acquired coordinates, including remote bases from Separate small bowls. Deliberate movement can recover them onto the new field; layout selection never fits or moves them automatically.
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
- Only the acquired owner's ordinary `pointerup` release commits a gesture. This remains true if capture delivers that release outside the canvas or over chrome; moving there is not itself a cancellation command. Repeated release or the normal capture loss after release is an idle no-op. Named Undo/Remove and Garden fresh/copy are separate explicit document commands, described below, not alternate ways to commit a preview.
- `pointercancel`, premature lost capture, hidden visibility, `pagehide`, relevant viewport or orientation changes, WebGL context loss, and explicit cancellation restore the snapshot and write no save.
- A tool, view, posture, selection, or bend-experiment command cancels first, then applies the command.
- Persistent chrome remains usable as an interrupt command during a scene grab. A second scene pointer during a plant transaction is ignored.
- Arrange permits botanical acquisition and keeps the camera unchanged. Empty-space drag in Arrange does nothing; its message explains the active craft tool and, for Shape, how Step Back moves the view.
- Step Back permits constrained orbit, screen-space Pan and pinch while the canonical graph remains unchanged. Orbit radius is constrained to `5.7...15.5` on reference stages, and up to the stage lens maximum on narrow stages (see *Narrow-stage lens*); polar angle to `0.002...1.52` radians. A limit never pulls an acquired radius inward: a gesture that starts beyond the current maximum can only move toward the limits.

## 5. Deterministic target arbitration

Candidates are ranked independently of Three.js intersection-array order:

1. visible base or bend handle on the selected plant;
2. branch or organ material on the selected plant;
3. branch or organ material on another plant;
4. no target.

Within a tier, choose smallest CSS-pixel distance to projected material, then smallest ray depth emitted by the forward-facing raycaster, then lexicographically smallest stable ID. Organ hits route to their supporting branch for the current Shape and Prune grammar.

For a direct hit on a visible stem, leaf or flower surface, projected-material
distance is zero and depth comes from that surface. Enlarged hit proxies still
admit nearby misses, ranked by their projected branch or organ attachment.
Surface ranking never changes the acquired graph station: branches keep their
projected arc distance, and organs keep their supporting-branch attachment.

Base and bend handles may acquire only for the already selected plant. Shape acquisition of a branch or organ may select its plant. Temporary handles are subordinate and appear only where they resolve ambiguity.

The September 28 craft-usability revision adds bounded CSS-pixel near-miss
candidates only when acquisition found no true visible material-surface hit:
selected visible base/bend handles within `16` CSS pixels of their centre, and
active trunk/lateral/twig centreline material within `8` CSS pixels. Existing
world-space proxies and candidate ordering remain in use. This does not add
halos to petioles, pedicels or organs, and does not retarget an acquired gesture.
Candidates outside the canvas, behind the camera, or beyond clipping are excluded.
The visible bend bead has a minimum projected diameter of `12` CSS pixels;
only its decoration scales, not canonical geometry or the original hit proxy.
These are acquisition/readability bounds, not physical-phone acceptance.

## 6. Persistence and recovery

- Local storage key: `ikebana-web-alpha:studio-v2`; studio-v1 is a preserved read-only fallback.
- Payload version: `storageVersion: 2` with `savedAt`, `nextSuccessfulOrdinal`, and canonical plants.
- Autosave v2 contains committed canonical graphs, the next successful ordinal, the committed camera, and a versioned presentation scene. It excludes renderer objects, live previews, pending graphs, pointer ownership, hit candidates, camera tweens, and gesture state.
- Graph commits save. Ordinary owner releases of camera gestures and explicit canonical-view commands save the committed camera to v2. Camera previews/cancellation never save. Legacy v1 keys are read-only fallbacks; merely opening a save does not rewrite it.
- Invalid/cancelled insertion and every cancelled edit write nothing.
- Corrupt or unsupported stored data fails closed to an empty session with a terse warning; it never partially hydrates a graph.
- WebGL presentation may be discarded and rebuilt from canonical state without botanical identity or detail changing.

### Explicit botanical recovery — September 28 contract revision

The working coordinator keeps one transient botanical checkpoint, not a history
stack. `Edit → Undo last edit` restores the state before the most recent changed
Insert/Aim/Bend/base/Prune or Remove operation, including canonical inactive cut
history. Undo consumes the checkpoint and provides no redo. No-op releases,
cancelled edits, failed/invalid insertions, camera moves and selection/tool/view
commands retain the preceding checkpoint. A no-op release still follows the
ordinary-release commit/save law; it does not become an undoable botanical change.

`Edit → Remove selected cutting` removes the entire selected plant from the
working bowl while idle in Arrange. It is not a cut through the trunk, and does
not affect other graphs. It creates the one undo checkpoint, so immediate Undo
can restore that cutting. Undo may also be invoked in Step Back. Kept Garden
views cannot invoke either command. Opening Edit or using its recovery command
cancels any live preview before recovery; it never stores that preview in history.

Undo and Remove persist their proposed committed plants **before** replacing
in-memory plants or consuming/replacing the checkpoint. The app's save callback
can veto the operation on failure; both working state and checkpoint then remain
available for retry. Successful recovery is saved once. Camera framing and the
successful insertion ordinal do not rewind: undoing an insertion or removing a
cutting does not recycle its plant ID or seed ordinal.

The checkpoint is not serialized. Reload and explicit fresh-bowl/working-copy
replacement clear it; Keep, opening/closing Garden, temporary View/Return and
Compare retain the working coordinator and its checkpoint. Undo does not remove
or rewrite Garden entries, and Garden-entry removal is a separate operation.

### Garden and explicit bowl commands

The Garden extension consumes committed snapshots; it does not change gesture
commit laws. Opening Garden cancels any live gesture before reading state and
preserves the working posture. Closing it returns to that posture; actual kept
entry viewing uses its own read-only Step Back coordinator. Keep
writes a separate versioned collection with canonical plants, retained cut history,
ordinal, camera and optional thumbnail. Viewing is Step Back only and writes no
working save. Make a working copy and Start a fresh bowl are explicit document
replacement commands: offer to preserve a nonempty working bowl, validate data,
write the new working save first, then replace in-memory state. A failed write
keeps the current working bowl intact. Originals are not mutated by copies.
Comparing two kept arrangements is optional and transient. It reads existing
entries and shows both under one shared camera pose, the studio vertical field
of view, and world scale 1. It does not frame each entry with its own stored
camera, and it does not fit either arrangement to its pane. Comparison writes
no Garden entry, no working save, and no change to either stored camera or the
current working arrangement. Leaving it discards the temporary view. The generic
comparison does not assign an unrelated study to those entries. The Garden keeps
its separately labelled optional study; that brief is for a person to interpret.
The app does not judge whether an arrangement satisfies it.
A comparison drag has one pointer owner. A second pointer does not replace
that owner or its start pose. The owner's release keeps the temporary shared
view. Pointer cancel, lost capture, blur, a hidden page, a mouse move with
the button up, and Escape during the drag restore that start pose and stay in
comparison. Escape with no drag, and Leave comparison, discard the temporary
view. A view command during a drag cancels the drag before it applies. Wheel
input during a drag is ignored. Neither path writes a Garden entry, a stored
camera, or the working bowl. Both panes use the same canvas width and height.
A longer or wrapping title does not resize one pane alone.

Player replacements preserve a safe insertion ordinal. Workbench fixture loading
explicitly resets developer fixture identities in an isolated storage namespace;
ordinary insertion laws stay unchanged. Garden import is bounded, validates every
graph, and fails atomically. Unknown/corrupt Garden data is preserved, not replaced
with an empty collection. See [Garden](GARDEN.md) and
[Workbench](development/WORKBENCH.md) for exact schemas, limits and evidence.

## 7. Evidence and change gates

### Step Back Pan extension

Orbit (the default) and Pan share the Step Back camera transaction. Pan
translates camera position and target together along camera right/screen-up,
preserving orientation and camera distance. At target depth the arrangement
follows pointer displacement in CSS pixels, scaled from the acquired projection
(the stage lens frame height and its vertical field of view). Above uses screen-up, not world vertical.

The acquired camera mode and viewport height freeze until release/cancel.
Pinch continues to zoom in either mode; with two fingers down, one-finger pan
or orbit pauses. Lifting the secondary finger establishes a fresh local drag
anchor at the current preview without replacing the transaction's original
rollback snapshot. An Orbit/Pan command cancels first, then changes mode.
Cancellation restores camera pose and whether a preset was selected.

View presets recenter the camera. The chosen Orbit/Pan mode is remembered
within the session and resets to Orbit on reload or test reset. Neither pan
nor zoom edits botanical graphs, advances insertion ordinals or writes plant
autosave. No solver, generator, fixture or persistence schema is changed.

### Narrow-stage lens (experiment)

The main studio derives a projection from two numbers only: the canvas CSS size
and how far the persistent top controls reach into it. Plant geometry is never
read, so the camera does not follow edits, and no content fitting occurs.

- Reference: where the controls cover at most 16% of the canvas, projection is
  exactly the 44° studio field with the target at canvas centre, and the radius
  limit is `15.5`. Desktop framing is therefore unchanged.
- Beyond that share, the optical centre moves down by half the excess, and the
  field widens so the unobstructed stage shows at least the reference vertical
  extent. The horizontal extent is at least 0.6 of the reference vertical
  extent.
- The maximum radius rises until full zoom-out shows at least 0.9 of the
  reference vertical extent horizontally at the base limit. For example, about
  23.2 at 390×844.
- Beyond `15.5`, fog near/far move out with the camera distance; at or within
  `15.5` they are unchanged.
- The lens is recomputed only after a viewport change: resize, rotation,
  browser chrome, or font load. Posture, tool, view, selection and edits do not
  remeasure the controls.
- However a measurement was scheduled (startup, font settle, or a frame queued
  after a resize that runs after a new acquisition), if applying it would change
  the projection, it first cancels any live gesture. An unchanged measurement,
  or an inset change that stays within the reference share, leaves a gesture
  alone.
- As a second guard, a release commits only if the canvas size and the
  projection still match those recorded at acquisition; otherwise it rolls back
  and nothing is saved.
- Picking, drag planes, projection and Pan all use the same camera matrices.
  Pan and zoom limits are frozen at acquisition.
- Canonical poses, saved coordinates, botanical scale and persistence are
  unchanged.
- Garden comparison panes do not use the lens. Both panes keep the shared
  field of view and world scale 1.

### Top-controls layout

Posture, tools, the material tray and help share the top rail. Its background
and spacing own pointer hits, so a press between controls cannot acquire
material behind the rail. Scene acquisition still requires a canvas press;
moving from a normal control into the scene does not acquire or retarget.

Front, three-quarter and Above are available in a downward-opening Angles
disclosure. Opening it cancels any acquired gesture before showing choices,
without changing the camera. Choosing a view retains cancel-then-command;
selection, Escape, outside press and focus leaving the disclosure close it.

An owned mouse move without the primary button held rolls back through the
pointer-cancel path. A missed release cannot continue shaping on later hover
or synthesize a commit. Other pointers cannot cancel the acquired owner.
No botanical solver, fixture, camera pose or persistence schema is revised.

### Single-branch presentation experiment

The core graph, generator, fixture, pruning and transaction laws in sections
1–6 are preserved. New organ surfaces are derived only from stable organ ID and
graph seed; a surface rebuild cannot reroll them. Visible stems have outward
faces and end caps without re-tapering stock. Acquisition proxies keep their
existing envelopes and double-sided material.

Mouse/hover-pen cues are observational: no selection, acquisition, telemetry,
ordinal change or save. Prune hover calls the same pure preview as acquisition.
Once acquired, cues follow the frozen target and active plan, never a new hit.
Color is redundant with action icons, material names and the exact cut preview.
Escape invokes the existing explicit-cancel path; subsequent pointer release
cannot commit that cancelled gesture.

The Above canonical position is intentionally adjusted from `(0.02,15.4,0.02)`
to `(0,15.4,0.03)`, preserving target/up and staying above the polar minimum.
This aligns its screen-up with orbit and removes the approximately 45-degree
roll at acquisition. Front/three-quarter poses and orbit limits are unchanged.

Automated geometry/orientation tests do not establish aesthetic quality or
physical-phone feel; the field checks below remain separate.

Automated verification must cover fixture determinism, serialization, graph validation, stock-length preservation, descendant attachment, prune identity, deterministic arbitration, transaction rollback, insertion ordinal law, persistence, build output, and browser smoke behavior.

Physical-phone evidence is separate. The current field threshold is at least 8 of 10 deliberate first-try acquisitions after two minutes of familiarization, no camera/plant ownership crossover, no cancelled commit, at most one corrective repair among five intended broad bends, and completion of the craft path without spoken developer instruction.

If those interaction thresholds still fail after two focused gesture-tuning passes—or if two of three testers prefer sliders or generic gizmos because direct shaping cannot be trusted—reconsider this interaction foundation instead of burying it under polish.

## 8. Acquisition telemetry (provisional; additive to, and does not revise, sections 1–7)

This section is provisional: it documents diagnostic instrumentation, not a craft law, and any claim in it that a future implementation cannot substantiate should be retracted rather than defended. It is strictly observational — it never gates, delays, or alters any craft operation, transaction, or camera law above, is not consulted by any core geometry or transaction code, and `src/core/` remains untouched by it.

- Local storage key: `ikebana-web-alpha:telemetry-v1`, distinct from the `ikebana-web-alpha:studio-v2` autosave key. Corrupt or unsupported stored data fails closed (malformed individual records are dropped; a fully corrupt payload, or one written by a different `instrumentVersion`, fails closed to an empty session rather than mixing schemas), mirroring autosave's recovery law; it never partially hydrates a record.
- Payload version `storageVersion: 1` plus an `instrumentVersion` **persisted with the dataset itself** (not only the export envelope), `savedAt`, and per-variant (`bead`, `touch`) acquisition arrays. Every hydrated and appended record is canonicalized — reconstructed field-by-field from an explicit allowlist — never a pass-through of parsed JSON, so undeclared/tampered fields are always dropped, never retained. Canonicalization enforces bucket/variant agreement (a record's own `bendVariant` must match the bucket it is stored under), the resolved-hit requirement (a `"hit"` is only ever valid with a final, non-null `outcome`), miss invariants (a `"miss"` never carries an `outcome` or a timing), and the semantic combination rules below. A hit's outcome resolves at most once (resolve-once); a later attempt to resolve it again is a no-op.
- **Semantic combination rules**, enforced at canonicalization (an invalid combination is dropped, never partially trusted): a hit always carries an `operation`; camera may resolve only `released` or `cancelled`; a graph edit (aim/bend/base/prune) may resolve only `committed` or `cancelled`; only insertion may resolve `declined` — this is the honest, enforceable rule at the storage layer, which has no way to independently verify "invalid": the production app alone is responsible for only ever producing `declined` on an invalid release (see `IkebanaApp.ts`), and this layer does not add a separate validity field to check that claim; `insert` always carries both `materialId` and `inputMethod` together, and no other operation carries either; `cancelReason` is only ever valid alongside `outcome === "cancelled"` (rejected on a miss or any other outcome), and a `cancelled` outcome always carries a nonempty one; every timing value (`at`, `wallClockMs`, `timeToAcquireMs`, `transactionDurationMs`) is finite and nonnegative.
- The complete persisted payload (both variants, every field) is bounded to 256 KiB. When appending would exceed that, the globally oldest record (by wall-clock time, across both buckets) is dropped repeatedly until it fits; a payload that cannot serialize under the cap is never left in storage.
- The craft-critical commit path never performs a synchronous whole-history parse/stringify/`localStorage` write. Recording an acquisition only mutates a small in-memory buffer and schedules a deferred flush on a later timer task; the expensive serialize-and-trim-to-256-KiB work happens after the current event stack has yielded, off the path that must not block a craft commit. This task boundary gives the browser an opportunity to paint but does not guarantee that a paint occurs before the timer runs. The buffer is always read-consistent with its own not-yet-flushed appends.
- The committed botanical graph is always saved before this diagnostic layer is written, and telemetry is strictly subordinate to it over time, not only within one release: if a graph autosave fails (for example, a shared per-origin storage quota that telemetry has been occupying), telemetry yields storage — it is evicted (cleared) — and the graph save is retried exactly once before ever reporting a failure to the tester. Telemetry is best-effort in the other direction too: a full storage quota or a disabled storage API can lose a telemetry record, but must never block, delay, or fail the graph autosave it accompanies, and must never surface as an app-visible error.
- Every acquisition record carries the bend variant active at the moment it happened, and — for an insertion — the `materialId` from the material registry and whether it was acquired by pointer or keyboard. Nothing here hardcodes a material id.
- Every acquisition record carries an attempt-scoped miss count and elapsed time (misses immediately preceding a hit belong to that hit's attempt). These are raw instrument counters, not a validated measure of difficulty: a miss has no known intended operation, so misses preceding a given hit may include mis-taps aimed at something else entirely. Switching the bend variant, posture, tool, or canonical view, or a test-block boundary (a full reset), all clear this in-progress state so a miss from one context can never attach to a hit in another.
- Once known, a transaction resolves to `committed` (an insert/aim/bend/base/prune graph commit), `cancelled` (rolled back, with a reason), `declined` (an ordinary release that chose not to commit — currently only an invalid insertion returned to the tray), or `released` (an ordinary camera release). Camera never edits the graph and is deliberately never `"committed"`. A record is written to storage only once its transaction is fully resolved (or immediately, for a miss, which never opens a transaction); nothing pending, live, or previewed is ever persisted, matching autosave's live-preview exclusion. A cancelled transaction can never be produced by the committed code path, so it can never be misread as a commit.
- **Comparative summaries are bend-scoped only**: they count only resolved bend hits — `operation === "bend"` and `outcome` is `committed` or `cancelled`, never `released`, never `declined`, and never a still-pending/unresolved hit — and explicitly exclude camera and both insertion paths (pointer-drag and keyboard activation) — those remain in the raw per-acquisition records for debugging, but are never treated as a craft-acquisition comparison. This instrumentation does **not** establish which bend variant is faster or easier to use, and must not be described that way anywhere (UI copy, exports, or docs): it has no notion of the tester's intended target, whether a touch matched that intent, or whether the resulting silhouette was correct. First-try acquisition, intended target, correction count, and silhouette completion remain observer-recorded per `tests/browser/PHONE_WEB_TEST_CARD.md` unless a future explicit trial lifecycle records intent directly — that would be a new, separately-tested capability, not an extension of this one.
- A fresh specimen (`?fresh=1`) never deletes study telemetry — that would silently destroy the comparison data a test block exists to produce. Deleting study telemetry is a separate, explicit, one-shot action (`?clearStudyData=1`): the app clears it once and immediately strips the flag from the current URL (`history.replaceState`) and from every URL-construction helper, so an ordinary reload of that same address, or a later variant switch, never re-clears it. The test bridge's `resetForTest` exposes `clearAutosave` and `clearTelemetry` as independent flags for the same reason.
- Export ("Export local study data") is a deliberate, user-triggered action, is treated as persistent chrome (it cancels any active transaction first, resolving that acquisition as cancelled, before proceeding), and is never an automatic upload. It tries the Web Share API with a file payload first; a tester dismissing that share sheet is a distinct, honestly-reported cancellation and never silently falls through to a download. Failing or unavailable Share falls back to an anchor/blob download, then to an on-screen read-only manual-copy view. See `README.md` for why. The export payload includes the same `instrumentVersion` persisted with the dataset (bumped when recording/storage semantics change, independent of `storageVersion`) and a precise disclosure: the export contains timestamps and a randomly generated session ID, and does not contain any direct identifier (name, email, account) or the arrangement's actual botanical content.


## 9. Normal play and optional looking study

- Player-facing camera language is Orbit / Pan. Plant placement language is
  Slide the base. The internal camera token `move` and existing automation hook
  `camera-move` are retained; the naming change does not alter camera/edit laws.
- Normal help presents the fixed-point bend grammar. `?debug=1` explicitly reveals
  Testing tools for comparing bend variants and exporting telemetry. Hidden tools
  are inert and cannot dispatch variant/export commands from their controls. Explicit `?bend=touch`
  links and the test bridge remain available; help describes the active grammar.
- The optional Line and water study is a native disclosure in the help panel.
  Opening/closing it changes no graph, camera, saved data, inventory or ordinal.
  Opening the containing guide cancels an active gesture through the existing
  interruption path. Escape closes the guide and returns focus to its opener.
-   The prompt imposes no count, school roles, target angles, completion detector or
  correctness score. Any number of copies of any registered material is allowed.
  Finishing is the player's decision. Open play is the default.

### Optional studies and stopping

The guide offers Line and water, Two voices, and Before one more cut as freely
available disclosures. They are original prompts, not a school curriculum.
Stop and look cancels any acquired transaction, resets acquisition-attempt
metrics, closes the guide/view menu and enters Step Back. It preserves the last
released camera pose and chosen Orbit/Pan mode. It does not finish a live edit,
write a save, advance an ordinal, certify a composition, or archive an arrangement.
The DOM returns focus to Arrange, which remains immediately available. No tools
or materials are gated, and no cut, view visit, angle or water threshold is required.

### Optional stem-overlap inspection — September 28 presentation study

`Angles → Stem overlaps` is off by default and session-only. It marks approximate
3D penetration between active structural stems (trunk/lateral/twig) of separate
cuttings using their current points and radii. Same-plant contact, organs/stalks,
vessel and floor are not checked. Capsule envelopes are approximate at end caps
and faceted bends; marks mean **possible overlap**, not a physical validity score.
Exact touching and very shallow numerical grazing are excluded. A depth-separated
screen crossing is not enough to mark an area.

Visible insertion, Aim/Bend/base, and remaining-material prune previews feed the
inspection; hover prune uses the same remaining graph. Cancel/Undo restores cues
from the restored material. Toggling cancels an active edit first but writes no
save and changes no camera, selection, ordinal or Undo checkpoint. Marks are
unpickable and never constrain shaping. They stay out of canonical graphs and
Garden thumbnails; Compare studios do not enable them. One kept entry may be
inspected read-only. Off-state hides all marks and avoids detection work.

The presentation uses four angular corners with an open centre, distinct from
the round bend bead. The two-tone mark denotes a possible stem overlap or a
contact stop; it is never an acquisition target. Phone chrome groups Arrange /
Step Back above Edit / Angles / Studio. Studio contains Vessel, Photograph, Garden and the cutting guide;
opening it cancels a live preview, and closing a secondary destination returns
focus to the visible Studio disclosure. This changes presentation only, not the
gesture, persistence, geometry, or independently optional study laws.

See [scope, evidence and phone checks](development/reports/stem-overlaps/README.md)
and the [separate prevention audit](development/reports/stem-overlaps/PREVENTION_AUDIT.md).

### Opt-in stem prevention study

**Angles → Prevent overlaps (study)** is default-off, session-only, and separate
from overlap inspection. Toggling cancels active work first. While on, Aim, Bend
and base translation limit motion against the capsule envelopes of separate active
trunk/lateral/twig branches. Petioles, pedicels, organs, same-cutting contact, floor
and bowl are excluded. Inspection's grazing allowance also applies here.

Every graph still reconstructs from immutable acquisition. Transient accepted
motion parameters define a continuous path from the preceding displayed pose;
this intentionally makes constrained progress gesture-history-dependent without
accumulating vertex deformation. Conservative advancement checks the whole path,
including carried descendants. Contact or work-budget exhaustion keeps a certified
preview and explains the stop. No post-solver nudging, shortening, auto-rerouting,
or unchecked jump at release is allowed. Release commits exactly the displayed
graph; existing cancellation and Undo laws remain authoritative.

Branch pairs already overlapping at acquisition are exempt for that whole gesture,
so old bowls remain editable. Their warnings remain visible, and they may worsen
as well as improve; this is an explicit legacy escape policy, not monotonic repair.
Other branch pairs remain constrained. Exemptions expire at the end of the grab.
Pruning is never blocked by this study.

A pending insertion follows its requested translation freely, but contact with
another cutting makes its seat invalid. Such a release saves nothing and does not
advance the successful-seat ordinal; keyboard insertion obeys the same validity.
Normal kenzan validity remains required. No new storage field or generator law.

The [implementation report](development/reports/stem-prevention/README.md) defines
motion bounds, approximation, bounded-work behavior and unrun phone gates. This
study does not establish exact mesh collision or accepted default phone feel.

### Vessel-footprint study and combined release (October 2)

Recognized `?vesselStudy=` profiles intentionally replace the ordinary circular
insertion/base boundary with explicit elliptical components in separate study
storage. All graph, stock-length, transaction, protection and recovery laws
remain unchanged. Base acquisition locks a component; imported out-of-field
roots retain a documented per-grab legacy allowance. No stored graph is scaled
or moved by selecting a layout. The default layout remains Original. The combined release exposes layouts through Studio → Vessel and persists their identity in the separate v2 envelope described below. See the [profile definitions, exact exceptions,
compatibility limits and evidence](development/reports/vessel-study/README.md).

## Combined presentation and save version 2

Vessel layout and appearance are presentation metadata alongside the canonical botanical document. Layout changes cancel owned previews first, retain every graph/history record, and never fit/scale/relocate existing plants. The same coordinator retains its Undo checkpoint. Footprint laws use the acquired connected planting area; existing protection and overlap markers remain authoritative.

Garden v2 and studio v2 retain sceneVersion1, stable layout/color/finish IDs, backdrop/perch, photo frame format and optional fibers. Camera is a committed pose, independent of graph geometry. Garden View restores this metadata read-only; Return restores the exact working coordinator and scene. Compare restores each scene under the same temporary camera/world scale. Photograph uses a disposable renderer with independently owned materials, fixed lighting and exact output pixels.

New writes use separate v2 keys. Read-only v1 fallbacks remain byte-for-byte intact; missing presentation defaults to Original/Sand/Glaze/Paper/Ground. v1 Garden backups import through validation; v2 backups fail closed in older clients. Invalid/future data blocks writes instead of being overwritten. Stale guards include both v2 and legacy keys. A still-open older client has a separate legacy document; reload the updated app before continuing. No automatic personal-data rewrite or external creation upload occurs.

### Smaller pinbeds and base recovery (October 4)

Small bed, Single small bowl and Medium oval add three stable layout IDs to the existing seven; Original remains the default. No graph schema, storage envelope or legacy fallback changes. Angles groups presets and stem checks; Studio groups Vessel/Photograph and Garden/Guide. A contact or bounded-work stop names Prevent overlaps during the grab and after release, with the Angles escape route. Actual collision protection is unchanged. See [release evidence and owner checks](development/PINBED_RELEASE.md).
