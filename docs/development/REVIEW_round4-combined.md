# Round 4 combined candidate — foliage fan, blossom spray, nodding flower

Draft only. This branch does not merge to main. Bend-stations is not in this branch.

## SHAs

| Role | SHA |
| --- | --- |
| Runtime baseline, merged PR #33 | `59e42e6554b05ff2fc415514370430716e9e8515` |
| Integration base, current main, docs-only PR #34 | `c002c8fe9c6b2372aa1ad59310379a47ec87b079` |
| Lane A parent, PR #35, foliage-fan-v1 | `3f16583f01a0a3ed93d6b365bd3c357de88fcfb5` |
| Lane B parent, PR #38, blossom-spray-v1 | `7cf593c18459130e40824d4653fef84a5bef99eb` |
| Lane C parent, PR #37, nodding-flower-v1 | `62e2c5e76e0347a37ab4d5a6a00bc7f366db79e4` |
| Catalog combine, first green verify | `7ba876ec2e9f6a5cea14422d986de3ab5e3cabcc` |

The catalog combine is a merge. Its parents are the blossom-spray merge (`5bb991c565dffb5933bd1719c6a60afa64276e00`, whose parents are the foliage-fan merge and the Lane B tip) and the Lane C tip. `git merge-base --is-ancestor` is true for all three frozen tips, for main, and for the runtime baseline. This review note is that combine's child and does not change generators, profiles, or tests. The draft PR records `git rev-parse HEAD` after this file lands.

## Model

Requested model: Grok 4.7 with high thinking. Exposed run identity: `originalModelName` `grok-4.7` (https://cursor.com/agents/bc-f787698b-16e5-56d3-ba1c-fab1ffbc5bd7). This agent is Grok 4.7. No thinking-budget or `reasoning_effort` field was exposed on the run record or in the agent interface, so a high thinking budget cannot be confirmed from the session. Luna was not substituted.

## Decision

All three candidates are accepted. None are deferred, so the picker has no disabled phantom profile for a missing Round 4 cutting.

Lane C stays in the catalog because its substitution test showed that Aim and bend can hang the existing single flower, and they cannot produce an authored curved neck whose bell opens along that neck. The stills and numbers remain at `docs/development/reports/nodding-flower-v1/`.

Lane B kept `blossom-compare` (flowering branch → flower volume → blossom spray) because that bowl is the required comparison with the packed head. The missing `references-plus-<candidate>` id is added here as `references-plus-blossom-spray` (flowering → leafy → blossom-spray). Both profiles stay.

## In

- `foliage-fan-v1` / `foliage-fan` from PR #35
- `blossom-spray-v1` / `blossom-spray` from PR #38
- `nodding-flower-v1` / `nodding-flower` from PR #37, including the contained bell surface
- Their goldens, focused tests, and the evidence paths listed below
- One Materials choice and one source template for each, after the arching trailer, in lane order
- Contract section 1 names the ten generators once

Catalog order is the seven established materials, then the three accepted cuttings:

`flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower`, `reed`, `flower-volume`, `arching-trailer`, `foliage-fan`, `blossom-spray`, `nodding-flower`.

The bell is one shell in `createBellGeometry`, drawn from a `bloom.form === "bell"` branch in `createOrganVisual`. Its mouth follows local +Y, the supporting tangent. The acquisition sphere uses `hitCenterY` 0.32 and radius 0.66. Cupped, open-face, and tufted blooms stay on the existing radial path. Those forms do not set `hitCenterY`, so their proxies stay at the organ origin. `bloomSurfaceProfile("bell")` throws, so a bell cannot fall through into a petal ring.

Contract: preserved. Section 1's generator list is extended once. `schemaVersion` stays 1. Saved graphs still store `generatorVersion`, not a material id. Aim, bend, prune, cancellation, insertion ordinals, and Garden semantics are unchanged. Ordinary aim and bend still preserve stock length.

## Frozen profile IDs

Unchanged, in this order:

| ID | Ordered material IDs |
| --- | --- |
| `reference-pair` | `flowering-branch`, `leafy-shoot` |
| `mixed` | alias of `reference-pair` |
| `references-plus-bare` | `flowering-branch`, `leafy-shoot`, `bare-branch` |
| `references-plus-single-flower` | `flowering-branch`, `leafy-shoot`, `single-flower` |
| `all-four` | `flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower` |
| `references-plus-reed` | `flowering-branch`, `leafy-shoot`, `reed` |
| `references-plus-flower-volume` | `flowering-branch`, `leafy-shoot`, `flower-volume` |
| `references-plus-arching-trailer` | `flowering-branch`, `leafy-shoot`, `arching-trailer` |
| `round3-three` | `reed`, `flower-volume`, `arching-trailer` |
| `round3-palette` | `flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower`, `reed`, `flower-volume`, `arching-trailer` |

Accepted Round 4 profiles, after those and before the dynamic profile:

| ID | Ordered material IDs |
| --- | --- |
| `references-plus-foliage-fan` | `flowering-branch`, `leafy-shoot`, `foliage-fan` |
| `references-plus-blossom-spray` | `flowering-branch`, `leafy-shoot`, `blossom-spray` |
| `blossom-compare` | `flowering-branch`, `flower-volume`, `blossom-spray` |
| `references-plus-nodding-flower` | `flowering-branch`, `leafy-shoot`, `nodding-flower` |
| `round4-candidates` | `foliage-fan`, `blossom-spray`, `nodding-flower` |
| `round4-palette` | `flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower`, `reed`, `flower-volume`, `arching-trailer`, `foliage-fan`, `blossom-spray`, `nodding-flower` |
| `all-registered-materials` | live catalog order; the only dynamic profile; stays last |

`round4-candidates` × 6 is two of each. × 12 is four of each. `round4-palette` × 6 is one each of the first six and omits `arching-trailer`, `foliage-fan`, `blossom-spray`, and `nodding-flower`. × 12 is two flowering, two leafy, and one of each of the other eight. `all-registered-materials` × 6 still cycles the first six catalog entries.

## Out

- PR #36 bend-stations / `?experiment=bend-stations`
- Organ roll and facing diagnosis
- Any further material
- Merge to main or deploy

## Evidence carried forward

These are the parent lanes' captures. This combine did not re-shoot them and did not run a phone.

- Foliage fan: `docs/development/REVIEW_foliage-fan-v1.md`, `artifacts/foliage-fan/`, `artifacts/foliage-fan-garden.json`, `docs/development/reports/foliage-fan-v1/`, `fixtures/plant-1-foliage-fan-v1.json`. Parent note: 191 tests on evidence `454c9f41b01762b23de43e6dbdd8971d7bb47ef1`. Physical phone: not run.
- Blossom spray: `docs/development/REVIEW_blossom-spray-v1.md`, `docs/development/reports/blossom-spray-v1/`, `fixtures/plant-1-blossom-spray-v1.json`. Parent note: 190 tests on the lane tip. Physical phone: not run.
- Nodding flower: `docs/development/REVIEW_nodding-flower-v1.md`, `docs/development/reports/nodding-flower-v1/` (including `substitution-metrics.json` and the compare stills), `fixtures/plant-1-nodding-flower-v1.json`, `tools/capture-nodding-browser.mjs`, `tools/render-nodding-study.ts`. Parent note: 191 tests after the docs-only main merge. Physical phone: not run.

## Preview

```sh
npm ci && npm run build
```

Open `dist/ikebana-web-alpha-standalone.html`.

Materials: `?workbench=1`. The Materials menu lists the ten choices above, in that order. Useful bowls:

- `references-plus-foliage-fan` beside the leafy shoot
- `blossom-compare` beside the flowering branch and flower volume
- `references-plus-nodding-flower` beside the upright references
- `round4-candidates` for the three new cuttings (count 6 is two of each)
- `round4-palette` at count 12 if the whole ten-material cycle is needed. Count 6 of that profile does not show the new cuttings.

Phone: not run for this combine. Parent phone gaps still apply.

## Verify

`npm ci && npm run verify` passed on `7ba876ec2e9f6a5cea14422d986de3ab5e3cabcc`.

- Typecheck passed.
- Tests: 209 passed, 0 failed, 0 skipped.
- Build wrote `dist/ikebana-web-alpha-standalone.html`. Vite emitted `dist/index.html` (36234 bytes), `dist/assets/index-DL8pkvE1.css` (19914 bytes), `dist/assets/index-BBjM0HHm.js` (689275 bytes), and `dist/assets/index-BBjM0HHm.js.map` (3403366 bytes).
- `validate-dist`: 5 files, standalone self-contained. Standalone size 884938 bytes.

This paragraph does not change the app. The draft PR names the tip that contains this note and the re-run on that tip.
