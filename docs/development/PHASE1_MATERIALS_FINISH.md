# Phase 1 materials finish

Draft only. This note does not merge to main and does not promote bend-stations.

## Head

Phase 1 materials head: `f666db8c1b9e46fc9daef05dba09a895844f8e86`

No product correction. The integrated candidate on `cursor/round4-materials-combined-5bd7` (PR #39) is unchanged. Parent tips were re-fetched and still match the recorded state:

| Role | SHA | Branch |
| --- | --- | --- |
| main | `c002c8fe9c6b2372aa1ad59310379a47ec87b079` | `main` |
| Materials candidate | `f666db8c1b9e46fc9daef05dba09a895844f8e86` | `cursor/round4-materials-combined-5bd7` |
| Bend stations | `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7` | `cursor/bend-stations-220e` |

No intervening commits on those three tips. Contract: preserved. This branch adds the fresh check, the phone card, and the capture script.

## Model

`originalModelName`: `grok-4.7`

Run: https://cursor.com/agents/bc-f1483c81-c3b2-55c8-874b-730f0902faea

The run record has no thinking-budget field and no `reasoning_effort` field. The launch instruction requested Grok 4.7 with reasoning effort high. This agent is Grok 4.7. No other model was substituted.

## Verify

`npm ci && npm run verify` on `f666db8c1b9e46fc9daef05dba09a895844f8e86`.

- `npm ci`: 63 packages added.
- Typecheck passed.
- Tests: 209 passed, 0 failed, 0 skipped. Duration 1489.569 ms.
- Vite build: `dist/index.html` 36234 bytes, `dist/assets/index-DL8pkvE1.css` 19914 bytes, `dist/assets/index-BBjM0HHm.js` 689275 bytes, `dist/assets/index-BBjM0HHm.js.map` 3403366 bytes.
- `dist/ikebana-web-alpha-standalone.html` 884938 bytes.
- `validate-dist`: 5 files, standalone self-contained.

## Gate

**PASS.** Automated verification passed. Fresh headless Chrome checks found no blocking regression in acquisition, transactions, cancellation, persistence, or Garden isolation.

Physical phone: **not run**. That does not block Phase 1. Bend-stations stays off the materials head and off the default.

Phase 2 materials (berry-twig / fern-frond) are not started here.

## Fresh browser evidence

Headless Chrome 148.0.7778.96, SwiftShader, on the production `dist/` from this tip. Not a phone. Script: `tools/capture-phase1-browser.mjs`. Report: `docs/development/reports/phase1-materials/capture-report.json`. Every shot is labeled with the SHA, profile or seed, viewport, and browser.

Checked:

- All ten materials, in catalog order, in the Materials panel.
- Portrait 390×844 and short landscape 844×360: the panel scrolls, and the last row can be selected.
- Selecting a material does not insert it.
- Invalid insert leaves the bowl empty. A valid insert seats `plant-1` / `one-branch-v1` / seed 8278.
- Aim and bend preview, Escape, and commit. Stock rest lengths stay put. Reload without `fresh=1` keeps the player bowl.
- Workbench fixture loads do not rewrite `ikebana-web-alpha:studio-v1`. A Garden keep writes `ikebana-web-alpha:workbench-garden-v1` only. Returning to the player studio shows the player bowl.
- `mixed` is not a picker row. Loaded profiles at seed 8278 match their documented cycles, including `reference-pair`, `all-four`, `round3-three`, `round3-palette`, `round4-candidates`, `round4-palette` at count 6 and count 12, `references-plus-foliage-fan`, `blossom-compare`, and `references-plus-nodding-flower`.

### Opening-arm cut

Ordinary pointer events, not a graph API call. Workbench foliage fan, seed 8278, count 1.

Front, at the arm's midpoint (`666,425`): pointerdown acquires `plant-1:petiole-opening-1` and the cue names one leaf. Escape restores the intact hash `0c41197f`. That is the earlier miss. The leaf sits in front of the arm, so the shared surface rule picks the leaf.

Front, on the bare arm nearer the stem (`643,442`): pointerdown acquires `plant-1:arm-opening` at material distance `0.330`. The cue names a branch, three attached stems, and three leaves. Hover preview, pointer leave, and a second hover do not change the hash. Release commits. The opening arm's active length is `0.330`. `petiole-opening-1`, `petiole-opening-2`, and `petiole-opening-3` stay in the graph and become inactive, with all three opening leaves inactive. The answering arm and crown arm stay active. Reload of the workbench save keeps canonical hash `30456fe0`.

Three-quarter, at the arm midpoint: pointerdown acquires `plant-1:arm-opening` at a farther station (one distal leaf). Cancel restores the intact fan. The committed basal cut is shown from the front and from three-quarter, before and after reload.

Sequence stills:

- `fan-intact-front.png`, `fan-intact-three-quarter.png`
- `fan-preview-front.png`, `fan-preview-cancelled-front.png`, `fan-preview-again-front.png`
- `fan-preview-three-quarter.png`, `fan-preview-cancelled-three-quarter.png`
- `fan-acquired-preview-front.png`
- `fan-committed-front.png`, `fan-committed-three-quarter.png`
- `fan-reload-front.png`, `fan-reload-three-quarter.png`

No picking change. The bare proximal arm is an ordinary, repeatable target. A press on the leaf is a leaf cut. Broadening proxies so a leaf press cuts the arm would break the shared organ rule.

## Previews

GitHub Pages (`.github/workflows/pages.yml`) deploys `main` only. There is no preview host for these tips. Production stays `c002c8f`. Do not attach a new host.

Materials, this head:

```sh
git checkout f666db8c1b9e46fc9daef05dba09a895844f8e86
npm ci && npm run build
```

Open `dist/ikebana-web-alpha-standalone.html`. Purpose: Phase 1 ten-material palette. The file does not embed the commit; this note identifies it. `?workbench=1` opens the fixture loader.

Bend stations, separate tip, not the default:

```sh
git checkout 2b3e49023e0087fd317b89eb91e6d4020f1c0cd7
npm ci && npm run build
```

- Experiment: `dist/ikebana-web-alpha-standalone.html?experiment=bend-stations`
- Same build, normal shaping: `dist/ikebana-web-alpha-standalone.html`

Phone card: `docs/development/PHASE1_PHONE_CARD.md`. Physical phone: not run.
