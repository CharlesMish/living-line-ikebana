# Living Line architecture

The botanical graph is authoritative. Three.js is a replaceable presentation adapter.

- `src/core/` contains deterministic, renderer-free geometry, generation, pruning, shaping, serialization, and transaction snapshots.
- `src/presentation/` owns Three.js entities, projection, candidate collection, and canonical cameras.
- `src/input/` owns one deterministic gesture transaction at a time. Ordinary release commits; every interruption rolls back.
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
constructors and saved graphs remain supported. The fern tapers ten staggered
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
