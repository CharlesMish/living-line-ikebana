# Agent instructions

Living Line is an interaction experiment about persistent botanical material. It is not a generic flower decorator, transform-gizmo demo, or content race.

## Read before changing behavior

1. [`docs/BEHAVIORAL_CONTRACT.md`](docs/BEHAVIORAL_CONTRACT.md)
2. [`ARCHITECTURE.md`](ARCHITECTURE.md)
3. The tests nearest the proposed change
4. [`tests/browser/PHONE_WEB_TEST_CARD.md`](tests/browser/PHONE_WEB_TEST_CARD.md) for touch, camera, cancellation, or presentation work

The behavioral contract, golden fixture, and automated tests outrank renderer convenience. Phone observations outrank desktop intuition for touch feel, but cannot waive graph invariants.

## Non-negotiable rules

- Keep `src/core/` free of Three.js, DOM, camera, browser, and pointer types.
- Treat meshes, hit proxies, handles, selection decoration, and camera presentation as rebuildable derivatives.
- Recompute every live edit from its immutable acquisition snapshot. Do not accumulate frame-to-frame deformation.
- Only an ordinary owner release commits. Cancellation and interruption roll back, write no preview to storage, and never advance an insertion ordinal.
- Do not regenerate, rescale, reroll, or relocate unrelated botanical detail during an edit.
- Ordinary aim and bend preserve stock length. Shortening is an explicit prune.
- Preserve inactive records as same-material history; do not delete pruned graph records.
- Preserve `one-branch-v1` and its golden fixture. Add new generators or species additively and version them explicitly.
- Arrange owns plant editing. Step Back owns camera gestures. An acquired target never hands its drag to the camera.
- Do not commit `node_modules/`, `dist/`, `.vite/`, coverage output, or machine-specific files.

## Change discipline

- Keep each branch and pull request focused on one concern.
- State whether the change preserves or intentionally revises a behavioral contract.
- Add or update focused tests for changes to core geometry, transactions, fixture identity, persistence, hit arbitration, or browser interruption.
- A new species must be additive. A future core loop should consume committed domain state/events instead of rewriting gesture laws.
- Run `npm ci` and `npm run verify` before handoff. Report automated evidence separately from physical-phone observations.

Suggested branch prefixes: `fix/`, `experiment/`, `feature/species/`, and `feature/core-loop/`.

