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

Local autosave records only committed canonical graphs. A live preview is never serialized. Add `?fresh=1` when running a clean test session without loading the prior local arrangement — this also clears the acquisition telemetry described below.

The manual phone test is in `tests/browser/PHONE_WEB_TEST_CARD.md`. Use a physical iPhone for the acquisition and browser-ownership judgement; desktop emulation is useful for smoke testing but cannot stand in for Safari touch cancellation or native haptics.

## Acquisition telemetry and export

Every recorded acquisition (a pointer hit or miss) carries the bend variant active when it happened, how many misses preceded it in that attempt, how long the attempt took, and — once its transaction resolves — whether it committed, was cancelled, or was declined. This is what makes the two bend hypotheses in the info panel comparable from real phone sessions instead of only from developer intuition.

Telemetry persists locally (`ikebana-web-alpha:telemetry-v1`), keyed by variant, alongside but separate from the committed-graph autosave. It survives a reload; `?fresh=1` clears it along with the arrangement.

The info panel's **Export session data** button gets a session's records off the phone for comparison. It tries, in order:

1. The Web Share API with a JSON file payload — iOS Safari's native share sheet (Save to Files, AirDrop, Messages, Mail). This is the only one of the three that reliably moves an actual file off an iPhone without a server.
2. An anchor/blob `download` — works in a regular Safari tab when Share is unavailable, saving to Files/Downloads.
3. An on-screen read-only text panel for a manual select-all-and-copy, which needs no permission or API support and so cannot fail.

This diagnostic layer is intentionally separate from the botanical graph: it never touches `src/core/`, never gates a craft operation, and a cancelled edit's telemetry can never read as a committed one.
