# Living Line — Three.js web alpha

A mobile-first interaction study for an eventual ikebana creative game. The toy begins with an empty shallow vessel and one persistent flowering cutting. Every placed cutting remains the same editable botanical graph through insertion, aiming, bending, base movement, pruning, inspection, saving, and later revision.

This is deliberately a craft-verb study, not a flower decorator. It has no score, progression, shop, judgement, or content library.

## Current alpha

The protected baseline contains one deterministic flowering material, repeatable cuttings, persistent shaping and pruning, constrained camera inspection, and committed-state local autosave. It is an interaction instrument, not yet the complete game loop.

Future flowers, branch structures, and a calm core loop should extend this baseline without replacing its identity, length, pruning, transaction, or camera-ownership laws. Those laws are collected in [`docs/BEHAVIORAL_CONTRACT.md`](docs/BEHAVIORAL_CONTRACT.md); contributors and coding agents should also read [`AGENTS.md`](AGENTS.md).

## Run it

Use Node.js 20.19 or newer.

```bash
npm ci
npm run dev
```

Then open the local URL on desktop or on a phone on the same network.

For a production build and a self-contained file:

```bash
npm run verify
```

The generated outputs are `dist/index.html` plus assets and `dist/ikebana-web-alpha-standalone.html`. The standalone file contains its JavaScript, CSS, and Three.js runtime and can be opened directly or hosted as one static file. `dist/` is intentionally uncommitted; source, contracts, fixtures, and tests remain authoritative.

## Gesture grammar

- Drag the flowering cutting from the tray onto the exposed pins; release over the usable pin field to seat that exact pending graph.
- In **Arrange · Shape**, drag a branch to aim its continuation, use the temporary base ring to move insertion, and use the current bend interaction to shape a broad curve.
- In **Arrange · Prune**, touch and slide along a branch, inspect the exact distal material that will leave, and release to cut.
- In **Step Back**, plant edits are locked. Drag to orbit, pinch to zoom, or use Front, 3/4, and Above.
- Any interruption, lost pointer, view/tool/posture change, or hidden tab cancels the live plant edit. Only an ordinary release commits.

## Bend experiment

The info panel switches between two acquisition hypotheses. They share the same material-distance addressing, stiffness cap, broad smootherstep solver, and segment-length constraints.

- **Fixed point** (default): a subordinate bead appears at 54% of the selected eligible branch’s active rest arc.
- **Where touched**: touching the eligible middle span freezes that exact material distance for the bend transaction; the bead is absent until acquisition.

Use `?bend=touch` to open directly in the touch-located variant. Omitting the parameter uses the fixed-point default; `?bend=fixed` currently falls back to that same default.

## Architecture

- `src/core/` — deterministic renderer-free botanical graph and edit laws.
- `src/input/` — snapshot-based, cancel-safe transaction coordinator.
- `src/presentation/` — Three.js scene, projection, targets, handles, cameras, and previews.
- `src/app/` — small UI binding layer, autosave of committed graphs, sound, and experiment state.
- `tests/` — domain invariants, transaction rollback, and phone/web test card.

The graph is authoritative. Three.js meshes, hit proxies, selection, and cameras may be discarded and rebuilt without changing botanical identity.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for dependency direction and [`tests/browser/PHONE_WEB_TEST_CARD.md`](tests/browser/PHONE_WEB_TEST_CARD.md) for the physical-phone protocol.

## Persistence and testing

Local autosave records only committed canonical graphs. A live preview is never serialized. Add `?fresh=1` when running a clean test session without loading the prior local arrangement. `?fresh=1` never touches acquisition telemetry — see below for why, and for the separate, explicit way to clear it.

The manual phone test is in `tests/browser/PHONE_WEB_TEST_CARD.md`. Use a physical iPhone for the acquisition and browser-ownership judgement; desktop emulation is useful for smoke testing but cannot stand in for Safari touch cancellation or native haptics.

## Acquisition telemetry and export

This is strictly observational diagnostic instrumentation, not a scored or validated measurement. Every recorded acquisition (a pointer hit or miss) carries the bend variant active when it happened, and — once its transaction resolves — whether it committed, was cancelled, was declined, or (for camera, which never edits the graph) was released. A hit also carries a raw, attempt-scoped miss count and elapsed time, reset at any bend-variant/posture/tool/test-block boundary so a miss from one context never attaches to a hit in another.

**What this can answer:** for acquisitions the instrument resolved as bend hits, how many committed vs. cancelled, and the mean of the raw timing/miss counters recorded for them, split by variant.

**What this cannot answer, and does not claim to:** which bend variant is faster or easier to use. A miss has no known intended operation, so it may reflect a mis-tap aimed at something else entirely; nothing here confirms the tester's intent, whether a touch matched what they meant to touch, or whether the resulting silhouette was correct. First-try acquisition, intended target, correction count, and silhouette completion remain observer-recorded in `tests/browser/PHONE_WEB_TEST_CARD.md` unless a future explicit trial lifecycle records intent directly. Comparative summaries are therefore bend-scoped only: camera and both insertion paths (pointer-drag and keyboard) are excluded from any comparison, though their raw records remain available for debugging.

Telemetry persists locally (`ikebana-web-alpha:telemetry-v1`), keyed by variant, alongside but separate from the committed-graph autosave, and the committed graph always saves first — a full storage quota can lose a telemetry write but must never block or fail the graph save. It survives an ordinary reload and `?fresh=1`. Deleting it is a separate, explicit action: add `?clearStudyData=1`.

The info panel's **Export local study data** button gets a session's records off the phone for comparison. It is treated as persistent chrome: tapping it while a plant edit is in progress cancels that edit first (recording it as cancelled), then proceeds. It tries, in order:

1. The Web Share API with a JSON file payload — iOS Safari's native share sheet (Save to Files, AirDrop, Messages, Mail). This is the only one of the three that reliably moves an actual file off an iPhone without a server. Dismissing the share sheet is reported honestly as a cancelled export and never silently falls through to a download.
2. An anchor/blob `download` — works in a regular Safari tab when Share is unavailable, saving to Files/Downloads.
3. An on-screen read-only text panel for a manual select-all-and-copy, which needs no permission or API support and so cannot fail.

The export is named "local study data," not "session data," because it is not scoped to the current session: it is the full accumulated cross-session history for this device/browser, which is the point of persisting it in the first place. The exported file includes an `instrumentVersion` (bumped when what is recorded changes, independent of the storage schema) and a short statement that everything is generated locally and nothing is uploaded automatically.

This diagnostic layer is intentionally separate from the botanical graph: it never touches `src/core/`, never gates a craft operation, and a cancelled edit's telemetry can never read as a committed one.
