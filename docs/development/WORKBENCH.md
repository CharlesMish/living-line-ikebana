# Material workbench

Run `npm ci`, then `npm run dev`. Open the usual app URL with
`?workbench=1` (or add `&workbench=1` to an existing query). Select **Workbench**
in the top rail. This is the same renderer and interaction implementation used by
players; fixtures are the only special construction path.

Named fixture profiles, report metadata and the integrator import contract live in
[Workbench fixture profiles](WORKBENCH_FIXTURE_PROFILES.md).

## Reproducible comparison

- **Stable profiles** (explicit ordered material lists):
  - `reference-pair` — flowering + leafy only. This is the comparison baseline.
    Registering another material must not change it.
  - `references-plus-bare` — flowering → leafy → bare-branch
  - `references-plus-single-flower` — flowering → leafy → single-flower
  - `all-four` — flowering → leafy → bare → single-flower
- **Dynamic (not a baseline):** `all-registered-materials` cycles the live catalog
  and must be labeled as such in reports.
- **Compatibility:** `mixed` is an alias of `reference-pair`. It no longer cycles
  the catalog. The workbench modal fills from `listWorkbenchFixtureOptions()`
  (registered singles, then named profiles). Unavailable options stay listed and
  disabled. `mixed` is not a picker row.
- Single registered material IDs still load that one material `count` times.
- Starting seeds: **8278, 9255, 10232**, or an explicit uint32 integer.
- Counts: **1**, **2**, **6**, **12**. Twelve is a stress scene, not a tutorial target.
- Later cuttings receive `seed + 977 × index` modulo uint32. Bases use a
  deterministic spiral on the pins. Plant IDs are `plant-1` … `plant-N`.
- Six cuttings of four materials is **2+2+1+1 in cycle order**, not two of each.
  Twelve cuttings of four materials is three of each. Reports print the actual
  `countsByMaterialId`.
- Load the same fixture to reset. Loading explicitly replaces the developer bowl
  and resets its ordinal to its count. Unlike real insertion, this is a fixture
  command. Ordinary tray insertion/cancellation still uses production transactions.
- Examine Front, ¾ and Above; then select Shape and edit normally. Compare both
  references and the candidate in the same bowl using ordinary tray insertion.
- **Download current report** (`reportVersion` 2) captures the committed graphs,
  named profile / material sequence, seed, count, camera, CSS viewport (canvas
  client rect), browser window inner size, drawing-buffer dimensions, device vs
  renderer pixel ratio, generator versions, seeds, active/history counts,
  presentation inventory and one render's draw-call/triangle/resource counts.
  It cancels a live preview before capturing. Human checks are explicitly
  `not recorded`; downloading is not a test pass.

Draw calls and triangles are resource counts from one render, not FPS, frame time,
or phone performance. CSS viewport, browser-window size, device-mode labels and
drawing-buffer resolution are different measurements; do not treat them as one
number. Do not quote a mixed-6 capture as a count-12 report.

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
npm test -- tests/app/garden.test.ts tests/app/gardenTransitions.test.ts tests/app/workbenchProfiles.test.ts tests/app/workbenchReport.test.ts
npm run verify
```

`npm run verify` includes all domain, transaction, app and presentation unit tests,
the production build, and standalone validation. It does not simulate a physical
phone or establish visual quality. Record those observations separately.

Do not add a second gesture engine to the workbench. New materials extend the
catalog/generator/appearance contracts; all player verbs remain shared.
