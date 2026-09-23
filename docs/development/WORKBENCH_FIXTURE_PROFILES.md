# Workbench fixture profiles — integrator contract

This branch owns **named fixture profiles, report metadata, and focused tests**.
The integrator owns **gardenUI.ts / tray HTML / the workbench modal picker**.

Behavioral contract, working autosave, Garden serialization, insertion ordinals,
cameras, cancellation, and material registration are unchanged. `mixed` cycling
the live catalog was a comparison-tooling flaw, not a persistence failure.

## Frozen IDs

| ID | Kind | Ordered material cycle | Available on current main |
| --- | --- | --- | --- |
| `reference-pair` | stable | `flowering-branch` → `leafy-shoot` | yes |
| `references-plus-bare` | stable | flowering → leafy → `bare-branch` | when A is registered |
| `references-plus-single-flower` | stable | flowering → leafy → `single-flower` | when B is registered |
| `all-four` | stable | flowering → leafy → bare → single-flower | when A and B are registered |
| `references-plus-reed` | stable | flowering → leafy → `reed` | Round 3 integration |
| `references-plus-flower-volume` | stable | flowering → leafy → `flower-volume` | Round 3 integration |
| `references-plus-arching-trailer` | stable | flowering → leafy → `arching-trailer` | Round 3 integration |
| `round3-three` | stable | `reed` → `flower-volume` → `arching-trailer` | Round 3 integration |
| `round3-palette` | stable | the four above, then reed → flower-volume → arching-trailer | Round 3 integration; **not** `all-four` |
| `references-plus-foliage-fan` | stable | flowering → leafy → `foliage-fan` | Round 4; does not change the rows above |
| `references-plus-blossom-spray` | stable | flowering → leafy → `blossom-spray` | Round 4; does not change the rows above |
| `blossom-compare` | stable | flowering branch → flower volume → `blossom-spray` | Round 4 lane B comparison; does not change the rows above |
| `references-plus-nodding-flower` | stable | flowering → leafy → `nodding-flower` | Round 4; does not change the rows above |
| `round4-candidates` | stable | `foliage-fan` → `blossom-spray` → `nodding-flower` | Round 4; lane order |
| `round4-palette` | stable | the seven established materials, then foliage-fan → blossom-spray → nodding-flower | Round 4; **not** `round3-palette` and **not** the live catalog |
| `all-registered-materials` | **dynamic** | live `getMaterialDefinitions()` order | yes; **not** a comparison baseline |
| `mixed` | alias | same as `reference-pair` | yes; keep only for the old picker |

Single registered material IDs (`flowering-branch`, `leafy-shoot`, and later
candidates) still load `count` copies of that one material.

Candidate material IDs expected by the stable profiles, matching MATERIAL_BRIEFS
and candidate SHAs A `703175a1ce3a1d48cc5b14166278168282fe2fa1` /
B `a4570f966cb5d89eba8d7732d46c9b9a5893a9e9`:

- `bare-branch`
- `single-flower`

This workbench branch does **not** register those materials.

## Construction law (all profiles)

- Plant IDs: `plant-1` … `plant-{count}`
- Seeds: `(startSeed + 977 × index) >>> 0`
- Bases: existing deterministic pin spiral (`index * 2.399963`, radius `min(0.86, sqrt(index) * 0.28)`, y = kenzan 0.55)
- Counts: 1, 2, 6, 12
- Default camera: canonical Front
- Arrangement.plants remains lexicographically sorted (so `plant-10` precedes `plant-2`). Reports also include construction / identity order.

`reference-pair` at the same seed/count/base must match the previous two-material
mixed bowl. Adding an unrelated registered material must not change those graphs.

## Composition (do not invent balance)

Cycling N materials across C cuttings is `index % N`. It is **not** round-robin
equal fill.

- `all-four` × 6 = 2 flowering, 2 leafy, 1 bare, 1 single-flower
- `all-four` × 12 = 3 of each
- `round3-three` × 6 = 2 reed, 2 flower-volume, 2 arching-trailer
- `round3-three` × 12 = 4 of each
- `round3-palette` × 6 omits `arching-trailer` (one each of the first six)
- `round3-palette` × 12 = 2 of the first five and 1 each of flower-volume and arching-trailer
- `blossom-compare` × 6 = 2 flowering branch, 2 flower volume, 2 blossom spray
- `blossom-compare` × 12 = 4 of each
- `round4-candidates` × 6 = 2 foliage-fan, 2 blossom-spray, 2 nodding-flower
- `round4-candidates` × 12 = 4 of each
- `round4-palette` × 6 omits `arching-trailer`, `foliage-fan`, `blossom-spray`, and `nodding-flower`
- `round4-palette` × 12 = 2 flowering, 2 leafy, and 1 each of the other eight
- `all-registered-materials` × 6 still cycles the first six catalog entries and omits `arching-trailer` and the three Round 4 cuttings

Single material IDs `reed`, `flower-volume`, and `arching-trailer` still load `count`
copies of that one cutting. They are not substitutes for the named profiles above.

Reports must print `countsByMaterialId` and `balancedEqualCopies`. Never describe
a six-cutting four-material scene as two of each. Never quote a mixed-6 renderer
capture as a count-12 report.

## Integrator wiring

Replace the workbench `<select>` fill that currently does
`[...getMaterialDefinitions().map(m => m.materialId), "mixed"]` with:

```ts
import {
  createWorkbenchFixture,
  listWorkbenchFixtureOptions,
  WORKBENCH_SEEDS,
} from "./workbench.ts";

for (const option of listWorkbenchFixtureOptions()) {
  const element = document.createElement("option");
  element.value = option.id;
  element.textContent = option.label;
  element.disabled = !option.available;
  select.append(element);
}

const snapshot = createWorkbenchFixture(
  select.value,
  Number(seedInput.value),
  Number(countSelect.value),
);
```

Unavailable candidate profiles stay in the list (`available: false`,
`missingMaterialIds` populated) so the picker can disable them. Do not invent a
new catalog-cycling mixed default.

`createWorkbenchFixture("mixed", …)` remains a compatibility alias for
`reference-pair` so this branch does not have to rewrite the modal.

Downloads should keep using `actions.report()`. Report schema is
`living-line-workbench-report` version **2**. New fields live only on that
development artifact:

- `loadedFixture.profileId` / `materialSequence` / `seed` / `count` / `construction` / `composition`
- `capture.cssViewport` (canvas client rect)
- `capture.browserWindow` (innerWidth/innerHeight)
- `capture.drawingBuffer`
- `capture.pixelRatio.device` vs `capture.pixelRatio.renderer`
- `capture.visualViewport` when present
- `renderer` resource counts, labeled as **not FPS**

Do not add these fields to working or Garden JSON.

## Suggested picker labels

Keep profile IDs stable even if labels change:

- Reference pair (flowering + leafy)
- References plus bare-branch
- References plus single-flower
- All four (flowering → leafy → bare → single-flower)
- References plus reed
- References plus flower volume
- References plus arching trailer
- Round 3 three (reed → flower volume → arching trailer)
- Round 3 palette (established four, then reed → flower volume → arching trailer)
- References plus foliage fan
- References plus blossom spray
- Blossom compare (flowering branch → flower volume → blossom spray)
- References plus nodding flower
- Round 4 candidates (foliage fan → blossom spray → nodding flower)
- Round 4 palette (established seven, then foliage fan → blossom spray → nodding flower)
- All registered materials (dynamic — not a baseline)

## Round 4 stable profiles

Accepted cuttings, in lane order: `foliage-fan`, `blossom-spray`, `nodding-flower`.

`references-plus-foliage-fan`, `references-plus-blossom-spray`, and
`references-plus-nodding-flower` each append one of those cuttings to the
flowering and leafy references. `blossom-compare` stays as the lane B
composition of flowering branch, flower volume, and blossom spray.
`round4-candidates` and `round4-palette` use the orders in the frozen table.
`reference-pair`, `mixed`, `all-four`, `round3-three`, and `round3-palette`
keep the orders above them. `all-registered-materials` stays the only dynamic
profile, and it stays last.

## Out of scope on this branch

- `gardenUI.ts` tray/modal HTML
- New materials, appearance, tray cards
- Curriculum / lesson text
- Transaction, camera, cancellation, ordinal, or persistence schema changes
