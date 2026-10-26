# Living Line architecture

The botanical graph is authoritative. Three.js is a replaceable presentation adapter.

- `src/core/` contains deterministic, renderer-free geometry, generation, pruning, shaping, serialization, and transaction snapshots.
- `src/presentation/` owns Three.js entities, projection, candidate collection, and canonical cameras. `stageLens.ts` derives the main studio's projection from canvas size and the top-controls inset only, never from plant geometry.
- `src/input/` owns one deterministic gesture transaction at a time. Ordinary release commits; every interruption rolls back. It also owns one transient botanical undo checkpoint and explicit Undo/Remove document commands.
- `src/app/` owns the small DOM shell, tray, posture/tool/view commands, autosave, experiment flags, and the acquisition-telemetry/export diagnostic layer (`metrics.ts`, `telemetry.ts`, `telemetrySummary.ts`). That layer is strictly observational: it never touches `src/core/` and never gates a craft operation.

Material law and UI experiments are deliberately separated. The fixed-bead and touch-located bend variants use the same broad, stiffness-capped, rest-length-preserving solver.

## Dependency direction

- `core` imports no Three.js, DOM, browser, camera, or pointer types.
- `input` owns transaction lifecycle and accepts domain operations through adapters; it does not own rendering.
- `presentation` derives disposable meshes and hit candidates from canonical state.
- `app` composes the layers and owns browser-specific orchestration, never botanical law.

The behavioral authority for identity, editing, cancellation, targeting, and persistence is [`docs/BEHAVIORAL_CONTRACT.md`](docs/BEHAVIORAL_CONTRACT.md). An intentional change to those laws requires matching tests and documentation, not an adapter-only shortcut.


## Two reference materials, plus additive candidates

`generatorSupport.ts` owns deterministic chain, attachment-frame and branch
construction helpers. `generator.ts` preserves the flowering fixture;
`leafyShoot.ts` adds a separately versioned structure. `bareBranch.ts` and
`singleFlower.ts` are additive Round 2 candidates. Round 3 adds `reed.ts`
(one culm), `flowerVolume.ts` (a prunable head), and `archingTrailer.ts`
(an authored arch on the shared single-station solver). Round 4 adds
`foliageFan.ts` (one stem, three lateral arms, and small leaves),
`blossomSpray.ts` (a thin green line with separated flower groups), and
`noddingFlower.ts` (one authored neck and a bell surface). Phase 2 adds
`berryTwig.ts` (a woody line, short cluster laterals, and one berry organ
per short pedicel) and `fernFrond.ts` (one slender rachis and eight pinnae
on a divided surface). Generators consume authored
response values from `materialResponse.ts` once, persisting `stiffness` in each
branch. The shared solver still owns all bending.

The botanical refinement adds `fernFrondV2.ts`, `blossomSprayV2.ts`, and
`noddingFlowerV2.ts`. Their existing tray IDs select v2 for new stock; v1
constructors and saved graphs remain supported. `archingTrailerV2.ts` follows the same
pattern (October 21): a longer, leafier cane that reaches past the rim, with two
prunable side shoots. The fern tapers ten staggered
pinnae along a curved rachis. Spray laterals rise in gentle arcs. Nodding v2
separates its shapeable upper stem from its rigid terminal flower stalk.
`workbenchProfiles.ts` freezes generator versions for historical profiles;
`botanical-refinements` is the explicit v2 study and singles use the live catalog.
The optional `app/bendStations.ts` controller chooses one rest-arc station and
never changes the core solver, saved schema, or default shaping mode.

`materialCatalog.ts` registers durable generators and transient tray IDs.
`presentation/materialAppearance.ts` selects appearance by generator version;
`botanicalGeometry.ts` makes identity-seeded organ surfaces. Appearance never
enters the generator or canonical schema. `presentation/waterline.ts` places the
water surface above the unchanged kenzan insertion plane and derives one meniscus
per stem crossing from current graph points; it never feeds back into the graph.
Insertion binds the selected source card (`[data-material-id]`); the Materials
palette only changes that selection.
Extension details and remaining physical checks:
[Material references](docs/MATERIAL_REFERENCES.md).


## Craft recovery and acquisition cues

The working `TransactionCoordinator` records a cloned botanical checkpoint before
changed graph commits. Canonical equality comes from its adapter, so an unchanged
selection tap cannot replace the last meaningful undo point. Undo restores plants
and selection without rewinding the camera or successful insertion ordinal; Remove
creates a checkpoint and deletes one plant from the working map. There is no redo.
The app supplies `beforeRecoveryCommit` to save the proposed recovery document
before the coordinator changes memory; save failure vetoes recovery. New
coordinators created by reload/fresh/copy have no checkpoint. Garden inspection
holds and restores the working coordinator, preserving its checkpoint while
blocking editing in the separate viewer. No storage schema or generator changes.

`core/turnCutting.ts` reuses rigid descendant reconstruction to turn a complete
cutting about its vertical seated axis. The Edit menu invokes
`TransactionCoordinator.commandTurnSelected` as an explicit, save-before-commit
document operation with one Undo checkpoint. `StemPrevention.turn` sweeps each
15-degree command through the existing conservative contact limiter; it never
tests only the endpoint or reuses transient state from another tap.

`ThreeStudio` keeps the actual pin-field outline visible for the full pending
insertion, independently of ghost visibility. Its CSS-pixel acquisition fallback
adds nearby structural stems and selected visible handles only when no direct
material surface was hit. Existing ordering and immutable acquisition ownership
still decide the operation. Visible bend decoration scales to a small screen-space
minimum; canonical branches and organs never scale to make a hit easier.

See the [craft-usability report](docs/development/reports/craft-usability/README.md)
for the tested-build distinction, retained collision limitation, and pending phone
checks. These intentionally revise recovery and acquisition behavior; ordinary
release and interruption rules remain intact.

## Stem-overlap inspection

`core/stemOverlaps.ts` is a pure, non-mutating segment-envelope diagnostic for
separate structural cuttings. `app/stemOverlapPreview.ts` adapts current presentation
and exact remaining prune material; it never writes the coordinator or storage.
`presentation/stemOverlapOverlay.ts` caches by structural geometry and draws at
most 32 unpickable camera-facing bracket marks in two instanced layers. The
uncapped count is available in View. Inspection starts on for the session and can be disabled; it constrains no edit.
Garden thumbnails and Compare stay clean. This detector is not a collision solver;
its approximation and any later constraint require separate acceptance.

## Opt-in contact prevention

`core/stemContact.ts` bounds and limits motion against structural capsule envelopes;
`core/rotationPath.ts` supplies a rigid path and analytic root-floor crossing.
`edit.ts` exposes acquisition-relative rotation parameters while sharing the existing
Aim/Bend reconstruction and influence law. `app/stemPrevention.ts` adapts each
transaction spec to a transient accepted parameter and frozen obstacle set. The
coordinator still owns commit/cancel/Undo and receives the actual constrained graph.
No solver state enters storage. View's default-off study supplies this optional
adapter; contact feedback is separate from the inspection count. See the
[study report](docs/development/reports/stem-prevention/README.md) for deliberate
legacy-pair exemptions, motion bounds and pending phone acceptance.


## Sparse lobed-leaf material

`core/lobedLeaf.ts` adds the durable `lobed-leaf-v1` generator using the existing
branch and leaf records. `presentation/lobedLeafGeometry.ts` derives a connected
five-lobed lamina and radiating veins from organ identity. Its leaf appearance
opts into exact-surface picking; `ThreeStudio` merges independent copies of the
lamina and vein triangles for that hit mesh. Empty notches stay empty without
changing older materials' acquisition proxies or the shared edit solver.


## Botanical and Photograph refinement

Three additive generators expand the live catalog while its established prefix
and frozen profiles retain identity: `compactFlower.ts`, `broadBlade.ts`, and
`lobedLeaf.ts`. Broad blade's lamina derives from original-stock distances and
material frames, with exact surface station picking; lobed leaves use their real
notched mesh for acquisition. Single flower direct-bloom hits use a bounded
camera-axis tilt inside the existing snapshot/coordinator transaction.

`openCupGeometry.ts` gives only Single flower an authored five-petal open cup,
with thin closed petal surfaces, a rear receptacle and attached stamens. This
replaces its shallow presentation dish while preserving `single-flower-v1`,
the material frame, hit envelope and direct-head tilt. Flowering branch retains
its original seven-petal surface. Compact and Blossom spray use distinct closed
corollas from `authoredFlowerGeometry.ts`; each petal occupies its own convex
sector so bounded seed variation cannot pierce its neighbours. Their graphs,
organ frames and acquisition spheres stay unchanged; archived flower-volume
keeps the older instanced tuft.

`botanicalTones.ts` defines per-material presentation recipes. `photoGrade.ts`
applies a neutral-bypassed GPU finish to the completed scene framebuffer.
`scene.ts` accepts legacy sceneVersion1 and enhanced sceneVersion2; both optional
recipes flow through the working studio, Garden views/comparison and Photograph.
The botanical graph schema and old generators are unchanged. See the combined
[report](docs/development/reports/botanical-darkroom/README.md) for verification,
resource ownership, and the unrun GPU/phone checks.

`app/photoDraft.ts` owns one bounded, in-memory Photograph setup keyed to an explicit working-document generation. The app advances that generation only after a successful fresh/copy write, never after ordinary editing. Read-only Garden views use a null draft context so they cannot consume or overwrite the working setup. Drafts contain only Photograph presentation controls; `Photograph.open` always reacquires authoritative committed plants and scene before applying a draft.


## Visual tone choices and photographic setting

`app/botanicalTonePreview.ts` derives code-native botanical samples and part-color
strips from the same appearance resolver as the scene. `botanicalTonesUI.ts` reads
the committed bowl inventory when opened, places those families first, and keeps
other materials available in a disclosure. The controls retain the existing
family-level scene command and save-before-apply path.

`presentation/photoFraming.ts` evaluates bounded photo offsets from one reference
pose; saved `camera.up` already expresses roll. `photoLighting.ts` applies named
recipes to each studio's owned lights; optional `scene.photoLighting` is strictly
validated and propagated through working, Photograph and Garden renderers.
`atmosphericBackdrops.ts` owns small procedural background textures, with the
same crop evaluated before both preview and capture. Existing geometry and
planting coordinates do not depend on these presentation controls.

See [the photo-workflow report](docs/development/reports/photo-workflow/README.md)
for the combined evidence and remaining visual acceptance.

## Visiting a kept collection

`GardenVisitUI` owns a disposable modal and explicit reference choices through
`GardenDisplayStore`. It delegates working-copy replacement to the existing
Garden UI rather than writing working state itself. The separate display key
is stale-guarded and never changes the Garden backup schema.

`GardenVisitStudio` owns one renderer and one shared room for three saved
arrangements. `ThreeStudio.createDisplayGroup` uses the established vessel and
botanical builders through a canvas-free derivation path: no extra WebGL contexts,
observers, camera commands or input adapters. Each group owns independent materials
and textures, even if multiple entries contain the same plant IDs. Visible bounds
allocate display spacing; no graph is scaled, rerolled or edited. Covers become
unlit textures and late image loads are generation-guarded. The visitor renders
on demand and disposes all scene resources on close.

`BackdropPicker` supplies controlled, labeled visual choices to both working
Studio and Photograph. Working choices use `changeScene` and its save-first
boundary; photo choices remain in the existing PhotoDraftMemory ownership.

## Violet cuttings

`violetSprig.ts` and `indigoSpire.ts` add two deterministic v1 stocks with multiple
flowering stations, keeping the existing graph and pruning law. Their additive
forms in `violetBloomGeometry.ts` are closed, derived corollas; catalog appearance,
tone samples and tray silhouettes resolve by their durable generator version.
`bellGeometry.ts` refines only the existing nodding-v2 draw while leaving its
canonical graph and nodding-v1 arrays unchanged. Single flower remains registered
and accessible under More cuttings. See the [candidate report](docs/development/reports/violet-cuttings/README.md).

## Starry pincushion study

`core/starryPincushion.ts` adds `starry-pincushion-v1`: three flower heads on
separately prunable arms, using existing branch, bloom and leaf records.
`presentation/starryHeadGeometry.ts` derives one merged, closed head surface
with ten bracts and a compact floret dome. Tone recipes and tray/preview
silhouettes are presentation only. All frozen profile definitions stay intact.

## Silver seed spray study

`core/silverSeed.ts` adds versioned sparse dried stock and the semantic `seedpod`
organ kind. The existing serializer, validator and craft cues explicitly accept
that kind. `presentation/seedDiscGeometry.ts` constructs a closed shallow
partition with quiet paper shading and a closed perimeter rim. The Argon
follow-up removes the earlier leaf-like vein ribbons; both membrane faces remain
authored. `ThreeStudio` merges
copies of those exact surfaces for picking and routes them to the existing
supporting stalk operation. Scene tones have distinct membrane/rim colors;
there are no new persistent graph fields, texture files or alpha-sort layers.
