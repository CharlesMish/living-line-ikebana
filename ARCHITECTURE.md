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
`singleFlower.ts` are additive Round 2 candidates. `reed.ts` is an additive
Round 3 candidate: one culm per insertion. Generators consume authored
response values from `materialResponse.ts` once, persisting `stiffness` in each
branch. The shared solver still owns all bending.

`materialCatalog.ts` registers durable generators and transient tray IDs.
`presentation/materialAppearance.ts` selects appearance by generator version;
`botanicalGeometry.ts` makes identity-seeded organ surfaces. Appearance never
enters the generator or canonical schema. Insertion binds the selected source
card (`[data-material-id]`); the Materials palette only changes that selection.
Extension details and remaining physical checks:
[Material references](docs/MATERIAL_REFERENCES.md).
