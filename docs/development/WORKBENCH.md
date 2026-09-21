# Material workbench

Run `npm ci`, then `npm run dev`. Open the usual app URL with
`?workbench=1` (or add `&workbench=1` to an existing query). Select **Workbench**
in the top rail. This is the same renderer and interaction implementation used by
players; fixtures are the only special construction path.

## Reproducible comparison

- Material: every entry returned by `getMaterialDefinitions()`, plus **mixed**.
  A newly registered candidate appears automatically. Mixed now cycles every
  registered material, so a four-material catalog is not comparable to the old
  two-material mixed bowls.
- Named comparison profiles live in [`src/app/workbenchProfiles.ts`](../../src/app/workbenchProfiles.ts).
  IDs are stable and must not change when the catalog grows:
  `reference-pair` (flowering + leafy only; same seed/count/base placement as the
  historic two-material mixed fixture), `references-plus-bare`,
  `references-plus-single-flower`, `all-four`, and optional
  `all-registered-materials`. This integration branch leaves a thin adapter:
  profiles are generated from those material lists. The Workbench agent owns
  named fixture graph DATA, report metadata and focused tests on a separate
  branch; import or replace that DATA through this file.
- Starting seeds: **8278, 9255, 10232**, or an explicit uint32 integer.
- Counts: **1**, **2**, **6**, **12**. Twelve is a stress scene, not a tutorial target.
- Later cuttings receive `seed + 977 × index` modulo uint32. Mixed cycles through
  the catalog. Bases use a deterministic spiral on the pins.
- Load the same fixture to reset. Loading explicitly replaces the developer bowl
  and resets its ordinal to its count. Unlike real insertion, this is a fixture
  command. Ordinary tray insertion/cancellation still uses production transactions.
- Examine Front, ¾ and Above; then select Shape and edit normally. Compare both
  references and the candidate in the same bowl using ordinary tray insertion.
- **Download current report** captures the committed graphs, camera, generator
  versions, seeds, active/history counts, presentation inventory and one render's
  draw-call/triangle/resource counts. It cancels a live preview before capturing.
  Human checks are explicitly `not recorded`; downloading is not a test pass.

Counts describe one render, not GPU timings or a frame-rate benchmark. Report the
actual browser/device and viewport alongside any performance observations.

## Isolation

Workbench autosave, Garden and telemetry use these separate keys:

- `ikebana-web-alpha:workbench-studio-v1`
- `ikebana-web-alpha:workbench-garden-v1`
- `ikebana-web-alpha:workbench-telemetry-v1`

They share the origin's storage quota but never replace player keys. Avoid opening
multiple editing tabs for the same mode: ordinary working autosave is not a
collaboration protocol. **Return to player studio** removes the workbench flag
and one-shot reset flags. Player data is read normally on that navigation.

A report is a development artifact, not a Garden backup. Garden's own export is
the portable collection format. To report a cut/bend bug, include the pre-edit
fixture settings, the report after editing, the exact actions and a clip if possible.

## Useful commands

```bash
npm ci
npm run typecheck
npm test -- tests/app/garden.test.ts tests/app/gardenTransitions.test.ts
npm run verify
```

`npm run verify` includes all domain, transaction, app and presentation unit tests,
the production build, and standalone validation. It does not simulate a physical
phone or establish visual quality. Record those observations separately.

Do not add a second gesture engine to the workbench. New materials extend the
catalog/generator/appearance contracts; all player verbs remain shared.
